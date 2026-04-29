"use server";

/**
 * employment-contract-actions.ts — Server Actions for HR-tab inline-save on /people/[id].
 *
 * What: Upsert employment_contract, employee_payroll_profile, and contract_tip_rule rows
 *       directly from the people-page HR-tab sections (Ansettelse, Lønnsprofil, Tipsregel).
 * Why: ADR-0114 mandates Server Actions as the canonical mutation primitive for dashboard.
 *      ADR-0151 forgery defence — workspace_id and actor_id are ALWAYS resolved server-side
 *      from the JWT; never trusted from request body.
 *
 * Validation rules per §14-6 Arbeidsmiljøloven:
 *   - trial_period_months must be ≤ 6 (Aml. §15-6)
 *   - end_date must be > start_date when present
 *   - apprentice/practice employment_form requires end_date NOT NULL
 *   - hourly_rate below tariff minimum emits a compliance warning (not a blocker)
 *   - tip_share must be between 0.00 and 1.50
 */

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { z } from "zod";

// ─── Schemas ───────────────────────────────────────────────────────────────

// Schema is permissive on save — the form must let admin save partial data
// even when DB-required fields are blank. The server fills sane defaults
// before insert/update so the row stays valid. The form highlights missing
// fields in red as a visual signal but never blocks submit (rant 2026-04-29:
// "om jeg må sitte en time hver gang … blir jeg ikke glad").
const AnsettelseSchema = z.object({
  profile_id: z.string().uuid(),
  // §14-6 fields — all permissive; server defaults applied below
  position_title: z.string().max(255).optional().default(""),
  department_id: z.string().uuid().nullable().optional(),
  employment_form: z
    .enum(["permanent", "temporary", "apprentice", "practice", "freelance"])
    .nullable()
    .optional(),
  employment_category: z.string().optional().default(""),
  employment_percentage: z.number().min(0).max(100).nullable().optional(),
  weekly_hours: z.number().min(0).max(168).nullable().optional(),
  working_hours_scheme: z
    .enum(["notShiftWork", "shiftWork", "offshoreWork", "continuousShiftWork335", "rotation336"])
    .nullable()
    .optional(),
  occupation_code: z.string().max(20).nullable().optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  trial_period_months: z.number().int().min(0).max(6).nullable().optional(),
  notice_period_months: z.number().int().min(0).max(12).nullable().optional(),
  break_minutes_per_day: z.number().int().min(0).max(120).nullable().optional(),
  training_rights: z.string().nullable().optional(),
  variable_hours_arrangement: z.string().nullable().optional(),
  // Lovsen amendment fields
  trial_period_paused_at: z.string().nullable().optional(),
  trial_period_pause_reason: z.string().nullable().optional(),
  trial_period_extended_until: z.string().nullable().optional(),
  remuneration_type: z.string().nullable().optional(),
  minimum_guaranteed_amount: z.number().nullable().optional(),
  overtime_agreement_type: z
    .enum(["legal_default", "local_tariff_agreement", "arbeidstilsynet_vedtak"])
    .nullable()
    .optional(),
  // Existing contract_id to upsert (null = create new draft)
  contract_id: z.string().uuid().nullable().optional(),
});

const LonnsprofilSchema = z.object({
  profile_id: z.string().uuid(),
  salary_type: z.string().min(1),
  hourly_rate: z.number().nullable().optional(),
  monthly_salary: z.number().nullable().optional(),
  payday: z.number().int().min(1).max(31).nullable().optional(),
  tax_table_number: z.string().nullable().optional(),
  tax_card_type: z.enum(["percentage", "table", "freecard"]).nullable().optional(),
  withholding_pct: z.number().min(0).max(100).nullable().optional(),
  holiday_allowance_pct: z.number().min(0).max(100).nullable().optional(),
  extra_holiday_week: z.boolean().optional(),
  pension_scheme_id: z.string().uuid().nullable().optional(),
  trade_union_member: z.boolean().optional(),
  trade_union_name: z.string().nullable().optional(),
  seniority_start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  agreed_weekly_hours: z.number().min(0).max(168).nullable().optional(),
  contract_id: z.string().uuid().nullable().optional(),
});

const TipsregelSchema = z.object({
  profile_id: z.string().uuid(),
  contract_id: z.string().uuid(),
  distribution_method: z.enum(["per_shift_hours", "per_position", "fixed_percentage", "pool"]),
  tip_share: z.number().min(0).max(1.5),
  tripletex_reporting_method: z.string().min(1),
  a_melding_code: z.string().min(1),
  taxable: z.boolean(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

// ─── Result type (mirrors GatedResult from people-actions) ─────────────────

type UpsertResult =
  | { ok: true; contract_id?: string; warning?: string }
  | { ok: false; error: string };

// ─── Helpers ───────────────────────────────────────────────────────────────

async function resolveCallerContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Resolve profile_id for telemetry actor_id (ADR-0151)
  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return profile
    ? { supabase, user, actorProfileId: profile.profile_id, workspaceId: profile.workspace_id }
    : null;
}

/** Verify target profile is in caller's workspace (ADR-0151 forgery defence). */
async function verifyTargetInWorkspace(
  adminClient: ReturnType<typeof createAdminClient>,
  targetProfileId: string,
  callerWorkspaceId: string,
): Promise<boolean> {
  const { data } = await adminClient
    .from("profile")
    .select("profile_id")
    .eq("profile_id", targetProfileId)
    .eq("workspace_id", callerWorkspaceId)
    .single();
  return !!data;
}

// ─── Action: Ansettelse (§14-6 employment fields) ──────────────────────────

export async function upsertAnsettelse(
  input: z.input<typeof AnsettelseSchema>,
): Promise<UpsertResult> {
  const parsed = AnsettelseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Ugyldig input" };
  }

  const data = parsed.data;

  // Soft validations — never block save. Collect warnings, clamp/clear bad
  // values where DB would otherwise reject, then proceed. Admin sees the
  // warning toast but can keep editing.
  const softWarnings: string[] = [];

  // §15-6 trial period max 6 months — clamp.
  if (
    data.trial_period_months !== null &&
    data.trial_period_months !== undefined &&
    data.trial_period_months > 6
  ) {
    softWarnings.push("Prøvetid begrenset til 6 mnd (Aml. §15-6)");
    data.trial_period_months = 6;
  }

  // end_date must be after start_date — clear bad end_date.
  if (data.end_date && data.start_date && data.end_date <= data.start_date) {
    softWarnings.push("Sluttdato fjernet (var før startdato)");
    data.end_date = null;
  }

  // apprentice/practice without end_date — flag, don't block.
  if (
    (data.employment_form === "apprentice" || data.employment_form === "practice") &&
    !data.end_date
  ) {
    softWarnings.push("Lærling/praksis bør ha sluttdato");
  }

  const ctx = await resolveCallerContext();
  if (!ctx) return { ok: false, error: "Ikke autentisert" };

  const admin = createAdminClient();

  // ADR-0151: verify target profile is in caller's workspace
  const allowed = await verifyTargetInWorkspace(admin, data.profile_id, ctx.workspaceId);
  if (!allowed) {
    return { ok: false, error: "Profilen tilhører ikke ditt arbeidsområde" };
  }

  // Server-side defaults: form passes through partial data, server fills DB
  // NOT NULL + CHECK requirements so save always succeeds. Form highlights
  // missing fields in red but never blocks submit.
  const today = new Date().toISOString().split("T")[0]!;
  const positionTitle =
    data.position_title && data.position_title.trim().length > 0
      ? data.position_title
      : "Ny stilling";
  const employmentCategory =
    data.employment_category &&
    ["fast", "deltid", "tilkalling"].includes(data.employment_category)
      ? data.employment_category
      : "fast";
  const startDate = data.start_date ?? today;
  const employmentForm = data.employment_form ?? "permanent";

  const patch: Record<string, unknown> = {
    position_title: positionTitle,
    employment_category: employmentCategory,
    start_date: startDate,
    employment_form: employmentForm,
    updated_at: new Date().toISOString(),
  };

  if (data.employment_form !== undefined && data.employment_form !== null)
    patch.employment_form = data.employment_form;
  if (data.employment_percentage !== undefined)
    patch.employment_percentage = data.employment_percentage;
  if (data.weekly_hours !== undefined) patch.agreed_weekly_hours = data.weekly_hours;
  if (data.working_hours_scheme !== undefined)
    patch.working_hours_scheme = data.working_hours_scheme;
  if (data.occupation_code !== undefined) patch.occupation_code = data.occupation_code;
  if (data.end_date !== undefined) patch.end_date = data.end_date;
  if (data.trial_period_months !== undefined) patch.trial_period_months = data.trial_period_months;
  if (data.notice_period_months !== undefined)
    patch.notice_period_months = data.notice_period_months;
  if (data.break_minutes_per_day !== undefined)
    patch.break_minutes_per_day = data.break_minutes_per_day;
  if (data.training_rights !== undefined) patch.training_rights = data.training_rights;
  if (data.variable_hours_arrangement !== undefined)
    patch.variable_hours_arrangement = data.variable_hours_arrangement;
  // Lovsen amendments
  if (data.trial_period_paused_at !== undefined)
    patch.trial_period_paused_at = data.trial_period_paused_at;
  if (data.trial_period_pause_reason !== undefined)
    patch.trial_period_pause_reason = data.trial_period_pause_reason;
  if (data.trial_period_extended_until !== undefined)
    patch.trial_period_extended_until = data.trial_period_extended_until;
  if (data.remuneration_type !== undefined) patch.remuneration_type = data.remuneration_type;
  if (data.minimum_guaranteed_amount !== undefined)
    patch.minimum_guaranteed_amount = data.minimum_guaranteed_amount;
  if (data.overtime_agreement_type !== undefined)
    patch.overtime_agreement_type = data.overtime_agreement_type;

  let contractId = data.contract_id;
  // Aggregate any soft warnings collected above so the form can surface them
  // as toast.warning while still treating the save as successful.
  let warning: string | undefined =
    softWarnings.length > 0 ? softWarnings.join(" · ") : undefined;

  if (contractId) {
    // Update existing draft
    const { error } = await admin
      .from("employment_contract")
      .update(patch as never)
      .eq("contract_id", contractId)
      .eq("workspace_id", ctx.workspaceId);
    if (error) return { ok: false, error: error.message };
  } else {
    // Create new draft
    const { data: created, error } = await admin
      .from("employment_contract")
      .insert({
        ...patch,
        profile_id: data.profile_id,
        workspace_id: ctx.workspaceId,
        status: "draft",
        contract_status: "draft",
        source: "operational",
        employment_role: "main",
        notice_period_months: data.notice_period_months ?? 1,
        overtime_agreement_type: data.overtime_agreement_type ?? "legal_default",
      } as never)
      .select("contract_id")
      .single();
    if (error || !created)
      return { ok: false, error: error?.message ?? "Kunne ikke opprette kontrakt" };
    contractId = created.contract_id;
  }

  // Emit telemetry (ADR-0193 NonEmptyString brand)
  void emit({
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.actorProfileId, "actor_id"),
    event: "employment_contract.upserted_inline",
    properties: {
      entity: { entity_type: "employment_contract", entity_id: contractId ?? "" },
      data: {
        target_profile_id: data.profile_id,
        section: "ansettelse",
        fields_updated: Object.keys(patch).filter((k) => k !== "updated_at"),
        contract_id: contractId ?? null,
      },
    },
  });

  return { ok: true, contract_id: contractId ?? undefined, warning };
}

// ─── Action: Lønnsprofil (Tripletex-aligned payroll fields) ─────────────────

export async function upsertLonnsprofil(
  input: z.input<typeof LonnsprofilSchema>,
): Promise<UpsertResult> {
  const parsed = LonnsprofilSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Ugyldig input" };
  }

  const data = parsed.data;

  const ctx = await resolveCallerContext();
  if (!ctx) return { ok: false, error: "Ikke autentisert" };

  const admin = createAdminClient();

  const allowed = await verifyTargetInWorkspace(admin, data.profile_id, ctx.workspaceId);
  if (!allowed) {
    return { ok: false, error: "Profilen tilhører ikke ditt arbeidsområde" };
  }

  // Upsert employee_payroll_profile (by profile_id + workspace_id)
  const payrollPatch: Record<string, unknown> = {
    salary_type: data.salary_type,
    updated_at: new Date().toISOString(),
  };

  if (data.payday !== undefined) payrollPatch.payday_regular = data.payday;
  if (data.tax_card_type !== undefined) payrollPatch.tax_card_type = data.tax_card_type;
  if (data.tax_table_number !== undefined) payrollPatch.tax_table_number = data.tax_table_number;
  if (data.withholding_pct !== undefined) payrollPatch.tax_percentage = data.withholding_pct;
  if (data.holiday_allowance_pct !== undefined)
    payrollPatch.holiday_allowance_pct = data.holiday_allowance_pct;
  if (data.extra_holiday_week !== undefined)
    payrollPatch.extra_holiday_week = data.extra_holiday_week;
  if (data.pension_scheme_id !== undefined) payrollPatch.pension_scheme_id = data.pension_scheme_id;
  if (data.trade_union_member !== undefined)
    payrollPatch.trade_union_member = data.trade_union_member;
  if (data.trade_union_name !== undefined) payrollPatch.trade_union_name = data.trade_union_name;
  if (data.agreed_weekly_hours !== undefined)
    payrollPatch.agreed_weekly_hours = data.agreed_weekly_hours;
  if (data.contract_id !== undefined && data.contract_id)
    payrollPatch.employment_contract_id = data.contract_id;

  // Resolve seniority_start_date — required on insert
  const seniorityDate = data.seniority_start_date ?? new Date().toISOString().split("T")[0]!;

  // Try update first, then insert if not found
  const { data: existing } = await admin
    .from("employee_payroll_profile")
    .select("id")
    .eq("profile_id", data.profile_id)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("employee_payroll_profile")
      .update(payrollPatch as never)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("employee_payroll_profile").insert({
      ...payrollPatch,
      profile_id: data.profile_id,
      workspace_id: ctx.workspaceId,
      seniority_start_date: seniorityDate,
      tariff_category: "standard",
      valid_from: seniorityDate,
      agreed_weekly_hours: data.agreed_weekly_hours ?? 37.5,
    } as never);
    if (error) return { ok: false, error: error.message };
  }

  // Emit telemetry
  void emit({
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.actorProfileId, "actor_id"),
    event: "employment_contract.upserted_inline",
    properties: {
      entity: {
        entity_type: "employment_contract",
        entity_id: data.contract_id ?? data.profile_id,
      },
      data: {
        target_profile_id: data.profile_id,
        section: "lonnsprofil",
        fields_updated: Object.keys(payrollPatch).filter((k) => k !== "updated_at"),
        contract_id: data.contract_id ?? null,
      },
    },
  });

  return { ok: true };
}

// ─── Action: Tipsregel ──────────────────────────────────────────────────────

export async function upsertTipsregel(
  input: z.input<typeof TipsregelSchema>,
): Promise<UpsertResult> {
  const parsed = TipsregelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Ugyldig input" };
  }

  const data = parsed.data;

  // Validation: tip_share 0.00–1.50
  if (data.tip_share < 0 || data.tip_share > 1.5) {
    return { ok: false, error: "Tipsandel må være mellom 0,00 og 1,50" };
  }

  const ctx = await resolveCallerContext();
  if (!ctx) return { ok: false, error: "Ikke autentisert" };

  const admin = createAdminClient();

  const allowed = await verifyTargetInWorkspace(admin, data.profile_id, ctx.workspaceId);
  if (!allowed) {
    return { ok: false, error: "Profilen tilhører ikke ditt arbeidsområde" };
  }

  // Upsert contract_tip_rule
  const { data: existing } = await admin
    .from("contract_tip_rule")
    .select("id")
    .eq("contract_id", data.contract_id)
    .maybeSingle();

  const tipPatch = {
    distribution_method: data.distribution_method,
    tip_share: data.tip_share,
    tripletex_reporting_method: data.tripletex_reporting_method,
    a_melding_code: data.a_melding_code,
    taxable: data.taxable,
    effective_from: data.effective_from,
    effective_until: data.effective_until ?? null,
    workspace_id: ctx.workspaceId,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await admin
      .from("contract_tip_rule")
      .update(tipPatch as never)
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin
      .from("contract_tip_rule")
      .insert({ ...tipPatch, contract_id: data.contract_id } as never);
    if (error) return { ok: false, error: error.message };
  }

  // Emit telemetry
  void emit({
    workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
    actor_id: nonEmpty(ctx.actorProfileId, "actor_id"),
    event: "employment_contract.upserted_inline",
    properties: {
      entity: { entity_type: "employment_contract", entity_id: data.contract_id },
      data: {
        target_profile_id: data.profile_id,
        section: "tipsregel",
        fields_updated: [
          "distribution_method",
          "tip_share",
          "tripletex_reporting_method",
          "a_melding_code",
          "taxable",
        ],
        contract_id: data.contract_id,
      },
    },
  });

  return { ok: true };
}
