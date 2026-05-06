/**
 * POST /api/contracts/employment/upsert
 *
 * What: Inline upsert of employment_contract + optional employee_payroll_profile.
 *       Used by Agent T's HR-tab Ansettelse-section UI.
 *
 * Why:  ADR-0114 (API route as mutation primitive), ADR-0151 (forgery defence),
 *       ADR-0244 (framework_snapshot discipline), ADR-0243 (MATERIAL field gate).
 *
 * ADR-0151 forgery defence:
 *   - workspace_id derived server-side from JWT (never from body)
 *   - actor profile_id resolved from JWT (never from body)
 *   - body's profile_id = subject under contract (verified to be in caller's workspace)
 *
 * Cross-field validation gates (§14-6 / Aml.):
 *   - end_date must be > start_date when present
 *   - fixed_term employment_form requires end_date
 *   - trial_period_months ≤ 6 (Aml. §15-6)
 *   - remuneration_type !== 'commissionOnly' requires at least one of monthly_salary / hourly_rate
 *   - hourly_rate below tariff_min → 200 with warning (admin override accepted)
 *
 * MATERIAL change guard (ADR-0243):
 *   - If status='active' AND any MATERIAL field changes → 409 (use amendment-flow)
 *
 * Telemetry:
 *   // TODO: emit() — Cycle 6 Wave 2 (Agent V)
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { FIELD_CLASSIFICATION } from "@smartout/contracts";

// ── Enum literals derived from database.types.ts ──────────────────────────────
//
// employment_form_enum: "permanent" | "temporary" | "apprentice" | "practice" | "freelance"
// working_hours_scheme_enum: "notShiftWork" | "shiftWork" | "offshoreWork" | "continuousShiftWork335" | "rotation336"
// remuneration_type_enum: "monthlyWage" | "hourlyWage" | "commissionOnly"
// sync_status_enum: "pending" | "synced" | "divergent" | "not_synced"
// contract_status: "draft" | "pending_data" | "ready_to_send" | "sent" | "active" | "superseded" | ...

// ── Body schema ───────────────────────────────────────────────────────────────

const BodySchema = z.object({
  contract_id: z.string().uuid().nullable(),
  // Subject under contract (body-supplied). Verified server-side to be in caller's workspace.
  profile_id: z.string().uuid(),

  // §14-6 fields — enum values match database.types.ts exactly
  position_title: z.string().min(1),
  employment_form: z.enum(["permanent", "temporary", "apprentice", "practice", "freelance"]),
  working_hours_scheme: z.enum([
    "notShiftWork",
    "shiftWork",
    "offshoreWork",
    "continuousShiftWork335",
    "rotation336",
  ]),
  start_date: z.coerce.date(),
  end_date: z.coerce.date().nullable(),
  end_date_reason: z.string().nullable(),
  agreed_weekly_hours: z.number().min(0).max(168),
  employment_percentage: z.number().min(0).max(100),
  monthly_salary: z.number().min(0).nullable(),
  hourly_rate: z.number().min(0).nullable(),
  remuneration_type: z.enum(["monthlyWage", "hourlyWage", "commissionOnly"]),
  trial_period_months: z.number().int().min(0).max(6).nullable(),
  notice_period_months: z.number().min(0).nullable(),
  break_minutes_per_day: z.number().int().min(0),
  training_rights: z.string().nullable(),

  // Optional payroll profile fields
  payroll: z
    .object({
      tripletex_employee_id: z.string().nullable(),
      payroll_sync_status: z.enum(["pending", "synced", "divergent", "not_synced"]).optional(),
    })
    .optional(),
});

type Body = z.infer<typeof BodySchema>;

// ── MATERIAL field set — single source of truth in @smartout/contracts ────────

const MATERIAL_COLUMNS = new Set(
  Object.entries(FIELD_CLASSIFICATION)
    .filter(([, entry]) => entry.classification === "material")
    .map(([col]) => col),
);

// ── §14-6 readiness check ─────────────────────────────────────────────────────

type ContractRow = {
  position_title: string | null;
  employment_form: string | null;
  working_hours_scheme: string | null;
  start_date: string | null;
  agreed_weekly_hours: number | null;
  employment_percentage: number | null;
  remuneration_type: string | null;
  monthly_salary: number | null;
  hourly_rate: number | null;
};

function isReadyToSend(row: ContractRow, frameworkBound: boolean): boolean {
  // All §14-6 mandatory fields must be non-null
  const requiredFilled =
    !!row.position_title &&
    !!row.employment_form &&
    !!row.working_hours_scheme &&
    !!row.start_date &&
    row.agreed_weekly_hours !== null &&
    row.employment_percentage !== null &&
    !!row.remuneration_type &&
    (row.monthly_salary !== null ||
      row.hourly_rate !== null ||
      row.remuneration_type === "commissionOnly");

  return requiredFilled && frameworkBound;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── 1. Auth gate (ADR-0151) ─────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 });
  }

  // ── 2. Resolve actor profile + workspace from JWT (ADR-0151) ────────────────
  const { data: actorProfile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  // L-0177: fail-fast on null workspace_id — no silent fallback
  if (!actorProfile || !actorProfile.workspace_id) {
    return NextResponse.json(
      { error: "Ingen aktiv profil funnet — kan ikke utlede workspace" },
      { status: 403 },
    );
  }

  const workspaceId = actorProfile.workspace_id;
  const actorProfileId = actorProfile.profile_id;

  // ── 3. Authority check: caller must be admin in workspace ────────────────────
  const { data: isAdmin, error: adminCheckError } = await supabase.rpc("is_admin_in_workspace", {
    uid: user.id,
    wid: workspaceId,
  });

  if (adminCheckError || !isAdmin) {
    return NextResponse.json(
      { error: "Forbidden: admin-rolle kreves for å redigere ansettelseskontrakter" },
      { status: 403 },
    );
  }

  // ── 4. Parse + basic Zod validation ──────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON-body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Valideringsfeil", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body: Body = parsed.data;

  // ── 5. Cross-field validation ────────────────────────────────────────────────

  // 5a. end_date must be > start_date
  if (body.end_date !== null && body.end_date <= body.start_date) {
    return NextResponse.json(
      { error: "Sluttdato må være etter startdato", field: "end_date" },
      { status: 400 },
    );
  }

  // 5b. fixed_term (temporary) requires end_date
  if (body.employment_form === "temporary" && body.end_date === null) {
    return NextResponse.json(
      {
        error: "Midlertidig ansettelse (temporary) krever at sluttdato er satt",
        field: "end_date",
      },
      { status: 400 },
    );
  }

  // 5c. trial_period_months ≤ 6 (Aml. §15-6) — Zod caps at 6, but belt-and-suspenders
  if (body.trial_period_months !== null && body.trial_period_months > 6) {
    return NextResponse.json(
      {
        error: "Prøvetid kan ikke overstige 6 måneder (Aml. §15-6)",
        field: "trial_period_months",
      },
      { status: 400 },
    );
  }

  // 5d. Unless commissionOnly, at least one salary field must be set
  if (
    body.remuneration_type !== "commissionOnly" &&
    body.monthly_salary === null &&
    body.hourly_rate === null
  ) {
    return NextResponse.json(
      {
        error: "Enten månedlig grunnlønn eller timesats må angis for valgt lønnssystem",
        field: "monthly_salary",
      },
      { status: 400 },
    );
  }

  // ── 6. Service-role client for subsequent writes ─────────────────────────────
  const admin = createAdminClient();

  // ── 7. Verify subject profile is in caller's workspace (ADR-0151) ────────────
  const { data: subjectProfile } = await admin
    .from("profile")
    .select("profile_id")
    .eq("profile_id", body.profile_id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!subjectProfile) {
    return NextResponse.json(
      { error: "Ansatt-profilen tilhører ikke ditt arbeidsområde" },
      { status: 403 },
    );
  }

  // ── 8. Resolve tariff_min for hourly_rate warning ────────────────────────────
  //
  // Join: workspace_framework_binding → framework_rule (category='wage_minimum')
  // No hard block — admin override is accepted; return 200 with warning.
  const warnings: string[] = [];

  if (body.hourly_rate !== null && body.hourly_rate > 0) {
    const { data: bindingRow } = await admin
      .from("workspace_framework_binding")
      .select("framework_id")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .maybeSingle();

    if (bindingRow?.framework_id) {
      // evaluation_config is JSON — the tariff min may live under different keys
      // depending on framework version. We look for `min_hourly_rate` in the
      // evaluation_config JSONB blob. Absent = no minimum defined, skip warning.
      const { data: wageMins } = await admin
        .from("framework_rule")
        .select("evaluation_config, code")
        .eq("framework_id", bindingRow.framework_id)
        .eq("category", "wage_minimum")
        .limit(10);

      if (wageMins && wageMins.length > 0) {
        for (const rule of wageMins) {
          const cfg = rule.evaluation_config as Record<string, unknown> | null;
          const minRate = typeof cfg?.min_hourly_rate === "number" ? cfg.min_hourly_rate : null;
          if (minRate !== null && body.hourly_rate < minRate) {
            warnings.push(
              `hourly_rate (${body.hourly_rate}) er under tariff-minimum ${minRate} kr/t (${rule.code}) — admin-overstyring akseptert`,
            );
          }
        }
      }
    }
  }

  // ── 9. Resolve existing draft when contract_id null (idempotent upsert) ──────
  //
  // When the caller (e.g. MissingInfoSheet popup) does not know an existing
  // contract_id, look for any draft|pending_data row for this profile and
  // adopt it. Prevents duplicate drafts per popup-attempt + unifies popup
  // and people-page write paths.
  if (body.contract_id === null) {
    const { data: existingDraft } = await admin
      .from("employment_contract")
      .select("contract_id")
      .eq("workspace_id", workspaceId)
      .eq("profile_id", body.profile_id)
      .in("status", ["draft", "pending_data", "ready_to_send"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDraft) {
      // Adopt existing draft for this UPSERT — switches code path to UPDATE branch
      body.contract_id = existingDraft.contract_id;
    }
  }

  // ── 10. Framework binding for ready_to_send gate ──────────────────────────────
  //
  // Parallel resolution: existing contract (if UPDATE) + framework binding check
  const [existingContractResult, frameworkBindingResult] = await Promise.all([
    body.contract_id !== null
      ? admin
          .from("employment_contract")
          .select(
            "contract_id, status, position_title, employment_form, working_hours_scheme, start_date, agreed_weekly_hours, employment_percentage, remuneration_type, monthly_salary, hourly_rate, end_date",
          )
          .eq("contract_id", body.contract_id)
          .eq("workspace_id", workspaceId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from("workspace_framework_binding")
      .select("framework_id")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const frameworkBound = !!frameworkBindingResult.data?.framework_id;

  // ── 10. MATERIAL change guard for active contracts (ADR-0243) ─────────────────
  if (body.contract_id !== null) {
    if (existingContractResult.error || !existingContractResult.data) {
      return NextResponse.json(
        { error: "Kontrakten ble ikke funnet eller tilhører ikke dette arbeidsområdet" },
        { status: 404 },
      );
    }

    const existing = existingContractResult.data;

    // Active contracts: block MATERIAL changes — caller must use amendment-flow
    if (existing.status === "active") {
      const changedMaterialFields: string[] = [];

      // Map of fields we may update → body values (dates coerced via slice, not split[0])
      const fieldMap: Record<string, unknown> = {
        position_title: body.position_title,
        employment_form: body.employment_form,
        working_hours_scheme: body.working_hours_scheme,
        start_date: body.start_date.toISOString().slice(0, 10),
        agreed_weekly_hours: body.agreed_weekly_hours,
        monthly_salary: body.monthly_salary,
        hourly_rate: body.hourly_rate,
        remuneration_type: body.remuneration_type,
        end_date: body.end_date ? body.end_date.toISOString().slice(0, 10) : null,
      };

      for (const [col, newVal] of Object.entries(fieldMap)) {
        if (!MATERIAL_COLUMNS.has(col)) continue;
        const existingVal = existing[col as keyof typeof existing];
        // Compare as strings for date fields; primitives otherwise
        if (String(existingVal ?? "") !== String(newVal ?? "")) {
          changedMaterialFields.push(col);
        }
      }

      if (changedMaterialFields.length > 0) {
        return NextResponse.json(
          {
            error:
              "Aktiv kontrakt kan ikke endres direkte for vesentlige (MATERIAL) felt. Bruk endringsprosessen (amendment-flow).",
            material_fields_changed: changedMaterialFields,
          },
          { status: 409 },
        );
      }
    }
  }

  // ── 11. Shared payload for INSERT / UPDATE ────────────────────────────────────

  // Helper: toISOString()[0] returns string|undefined per TS; we know it's always valid here.
  const toDateStr = (d: Date): string => d.toISOString().slice(0, 10);

  const contractPayload = {
    profile_id: body.profile_id,
    workspace_id: workspaceId,
    position_title: body.position_title,
    employment_form: body.employment_form,
    working_hours_scheme: body.working_hours_scheme,
    start_date: toDateStr(body.start_date),
    end_date: body.end_date ? toDateStr(body.end_date) : null,
    end_date_reason: body.end_date_reason,
    agreed_weekly_hours: body.agreed_weekly_hours,
    employment_percentage: body.employment_percentage,
    monthly_salary: body.monthly_salary,
    hourly_rate: body.hourly_rate,
    remuneration_type: body.remuneration_type,
    trial_period_months: body.trial_period_months,
    notice_period_months: body.notice_period_months ?? 0,
    break_minutes_per_day: body.break_minutes_per_day,
    training_rights: body.training_rights,
    // employment_category is required by the DB but owned by the compose flow.
    // This upsert route operates on draft/pending_data contracts where
    // employment_category was already set (or defaults to 'fast' on INSERT).
    updated_at: new Date().toISOString(),
  };

  let contractId: string;
  let resultStatus: string;

  if (body.contract_id === null) {
    // ── INSERT: new draft contract ──────────────────────────────────────────────
    const { data: inserted, error: insertError } = await admin
      .from("employment_contract")
      .insert({
        ...contractPayload,
        status: "draft",
        // employment_category required (NOT NULL) — default to 'fast' on direct insert.
        // The compose flow (POST /api/employment-contracts) derives this from D2 profile;
        // direct HR-tab authoring falls back to 'fast'. Admin can correct via amendment.
        employment_category: "fast",
        created_by: actorProfileId,
        // source CHECK constraint allows: operational | bubble_migration | v3_engine.
        // HR-tab + popup writes use 'operational' (manual ops authoring).
        source: "operational",
      } as never)
      .select("contract_id, status")
      .single();

    if (insertError || !inserted) {
      console.error("[contracts/employment/upsert] INSERT failed:", insertError);
      return NextResponse.json(
        { error: insertError?.message ?? "Kunne ikke opprette kontrakt" },
        { status: 500 },
      );
    }

    // TODO: emit() — Cycle 6 Wave 2 (Agent V)
    // emit({ event: "contract.employment_upserted", workspace_id, actor_id, ... })

    contractId = (inserted as { contract_id: string }).contract_id;
    resultStatus = (inserted as { status: string }).status;
  } else {
    // ── UPDATE: patch existing contract ────────────────────────────────────────
    const { data: updated, error: updateError } = await admin
      .from("employment_contract")
      .update(contractPayload as never)
      .eq("contract_id", body.contract_id)
      .eq("workspace_id", workspaceId)
      .select("contract_id, status")
      .single();

    if (updateError || !updated) {
      console.error("[contracts/employment/upsert] UPDATE failed:", updateError);
      return NextResponse.json(
        { error: updateError?.message ?? "Kunne ikke oppdatere kontrakt" },
        { status: 500 },
      );
    }

    // TODO: emit() — Cycle 6 Wave 2 (Agent V)
    // emit({ event: "contract.employment_upserted", workspace_id, actor_id, ... })

    contractId = (updated as { contract_id: string }).contract_id;
    resultStatus = (updated as { status: string }).status;
  }

  // ── 12. Upsert employee_payroll_profile (optional) ───────────────────────────
  if (body.payroll) {
    const payrollPayload: Record<string, unknown> = {
      workspace_id: workspaceId,
      profile_id: body.profile_id,
      employment_contract_id: contractId,
      updated_at: new Date().toISOString(),
    };

    if (body.payroll.tripletex_employee_id !== undefined) {
      // payroll_tripletex_employee_id is a numeric column in the DB.
      // Accept a string ID from the UI and coerce — null = explicit unset.
      const tid = body.payroll.tripletex_employee_id;
      payrollPayload["payroll_tripletex_employee_id"] = tid !== null ? Number(tid) : null;
    }
    if (body.payroll.payroll_sync_status !== undefined) {
      payrollPayload["payroll_sync_status"] = body.payroll.payroll_sync_status;
    }

    // Upsert keyed on profile_id — one payroll profile per employee.
    const { error: payrollError } = await admin
      .from("employee_payroll_profile")
      .upsert(payrollPayload as never, { onConflict: "profile_id", ignoreDuplicates: false });

    if (payrollError) {
      // Log but do not fail the whole request — payroll is supplementary.
      console.error("[contracts/employment/upsert] payroll upsert failed:", payrollError);
      warnings.push(
        `Lønnsprofildata ble ikke lagret: ${payrollError.message}. Kontrakten er lagret.`,
      );
    }
    // TODO: emit() — Cycle 6 Wave 2 (Agent V) (payroll_profile.upserted)
  }

  // ── 13. Derive ready_to_send ─────────────────────────────────────────────────
  //
  // Hydrate latest row snapshot for the gate. For INSERT the payload IS the
  // row; for UPDATE we reuse the values from contractPayload.
  const rowSnapshot: ContractRow = {
    position_title: contractPayload.position_title ?? null,
    employment_form: contractPayload.employment_form ?? null,
    working_hours_scheme: contractPayload.working_hours_scheme ?? null,
    start_date: contractPayload.start_date ?? null,
    agreed_weekly_hours: contractPayload.agreed_weekly_hours ?? null,
    employment_percentage: contractPayload.employment_percentage ?? null,
    remuneration_type: contractPayload.remuneration_type ?? null,
    monthly_salary: contractPayload.monthly_salary ?? null,
    hourly_rate: contractPayload.hourly_rate ?? null,
  };

  const readyToSend = isReadyToSend(rowSnapshot, frameworkBound);

  // ── 14. Response ─────────────────────────────────────────────────────────────

  return NextResponse.json({
    contract_id: contractId,
    status: resultStatus,
    ready_to_send: readyToSend,
    warnings,
  });
}
