/**
 * Payroll capability tools (ADR-0242).
 *
 * Six tools covering Høy-PII payroll operations:
 *   - update_payroll_profile  (mutation, admin-only)
 *   - query_tax_card          (read, admin or self)
 *   - set_pension_scheme      (mutation, admin)
 *   - view_personal_number    (read, admin or self — full PII reveal, Phase 5, 2026-05-08)
 *   - view_bank_account       (read, admin or self — full PII reveal, Phase 5, 2026-05-08)
 *   - salary_query            (read — admin or self; reads rate columns added in 20260601000000)
 *
 * ALL tools:
 *   1. Assert ctx.channel === "chat" (ADR-0078 Høy-PII defence-in-depth; capability-level
 *      allowedChannels ["chat"] enforces at router-time; this guards execute-time).
 *   2. Call gate_action via callGateAction BEFORE any DB read/write (ADR-0099 / L-0066).
 *   3. Emit via @smartout/telemetry with NonEmptyString actor_id + workspace_id (ADR-0193).
 *
 * Mutation tools wrap ALL persistence calls in callGateAction; if gate denies, no write
 * occurs (ADR-0204 pattern — gated mutations, never direct .from().insert/update without gate).
 *
 * view_personal_number + view_bank_account perform full PII reveal with audit-emit per
 * ADR-0077 (Phase 5, 2026-05-08). They SELECT from the profile table (personal_number +
 * bank_account columns), apply ADR-0151 workspace-scoped forgery defence, and emit
 * payroll.personal_number_revealed / payroll.bank_account_revealed on EVERY access
 * attempt (including cross-workspace attempts and null-value reveals).
 *
 */

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";
import {
  generateCsv,
  generateFilename,
  computeFileHash,
  generateBundlePdfs,
  computeFeriepengerBasis,
} from "@smartout/payroll-export";
import type {
  AggregateRow,
  AuditRow,
  ExportOptions,
  LonnsgrunnlagPdfOptions,
} from "@smartout/payroll-export";

const CAPABILITY = "payroll" as const;
const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

/** Guard: payroll tools are chat-only (ADR-0078 Høy-PII). */
function assertChatChannel(
  channel: SessionChannel,
): { denied: false } | { denied: true; msg: string } {
  if (channel !== "chat") {
    return {
      denied: true,
      msg: "Lønnsdata er kun tilgjengelig via chat. Bytt til chat-kanalen. (ADR-0078 Høy-PII)",
    };
  }
  return { denied: false };
}

// ── update_payroll_profile ──────────────────────────────────────────────────

export const updatePayrollProfile = defineTool({
  name: "update_payroll_profile",
  description:
    "Update an employee's payroll profile (base salary, payroll system ID, payment method, tax-card fields). Admin only. Chat channel only. Requires confirmation before write. Tax-card fields (tax_card_type, tax_percentage, tax_table_number, tax_card_year) are writable here — used for manual entry when Tripletex sync (Phase 7) is unavailable. Mutations are gated via callGateAction (ADR-0099); on gate pass, .update() is called directly on employee_payroll_profile — no separate gatedMutation wrapper (gate-then-update is the established payroll convention).",
  capability: CAPABILITY,
  schema: z
    .object({
      profile_id: z.string().uuid().describe("The employee profile_id to update."),
      monthly_salary: z.number().positive().optional().describe("New monthly gross salary in NOK."),
      hourly_rate: z.number().positive().optional().describe("New hourly rate in NOK."),
      payroll_system_id: z
        .string()
        .optional()
        .describe("External payroll system employee ID (e.g. Tripletex employee ID)."),
      payment_method: z
        .enum(["bank_transfer", "cash"])
        .optional()
        .describe("Preferred payment method."),
      // ── Tax-card fields (manual entry, Phase 7 sync alternative) ──────────
      tax_card_type: z
        .enum(["percentage", "table", "freecard"])
        .nullable()
        .optional()
        .describe(
          "Tax-card type. percentage=fixed rate, table=trekktabell, freecard=frikort. null clears.",
        ),
      tax_table_number: z
        .string()
        .regex(/^\d{4}$/)
        .nullable()
        .optional()
        .describe("Skattetabellnummer. 4 digits when tax_card_type='table'."),
      tax_percentage: z
        .number()
        .min(0)
        .max(100)
        .nullable()
        .optional()
        .describe("Tax withholding rate when tax_card_type='percentage'. 0-100 inclusive."),
      tax_card_year: z
        .number()
        .int()
        .min(2024)
        .max(2030)
        .nullable()
        .optional()
        .describe("Tax card year (kortår). YYYY format. Required if any tax field is set."),
    })
    .refine(
      (d) => {
        const anyTaxSet =
          d.tax_card_type !== undefined ||
          d.tax_table_number !== undefined ||
          d.tax_percentage !== undefined ||
          d.tax_card_year !== undefined;
        // If any tax field is non-undefined, tax_card_year must be provided and non-null.
        if (anyTaxSet && (d.tax_card_year === undefined || d.tax_card_year === null)) return false;
        // type=percentage → withholding rate must be non-null.
        if (
          d.tax_card_type === "percentage" &&
          (d.tax_percentage === undefined || d.tax_percentage === null)
        )
          return false;
        // type=table → table number must be non-null.
        if (
          d.tax_card_type === "table" &&
          (d.tax_table_number === undefined || d.tax_table_number === null)
        )
          return false;
        return true;
      },
      { message: "Inkonsistent skattekort-data — sjekk type vs felter" },
    ),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({ ok: false, reason: "channel_forbidden", detail: channelCheck.msg });
    }

    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "update_payroll_profile",
      entityId: params.profile_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        detail: gate.reason ?? "denied",
      });
    }

    // Verify target profile belongs to caller's workspace (ADR-0151 forgery defence).
    const { data: targetProfile, error: profileErr } = await ctx.supabaseAdmin
      .from("employee_payroll_profile")
      .select("id, workspace_id")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (profileErr || !targetProfile) {
      return JSON.stringify({
        ok: false,
        reason: "not_found",
        detail: "Payroll profile not found in this workspace.",
      });
    }

    // Build update payload — only include provided fields.
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (params.monthly_salary !== undefined) updates.monthly_salary = params.monthly_salary;
    if (params.hourly_rate !== undefined) updates.hourly_rate = params.hourly_rate;
    if (params.payroll_system_id !== undefined)
      updates.payroll_system_id = params.payroll_system_id;
    if (params.payment_method !== undefined) updates.payment_method = params.payment_method;

    // Tax-card fields — manual entry path (Phase 7 Tripletex sync alternative).
    // tax_card_fetched_at is set automatically whenever any tax field is written,
    // recording the manual-entry timestamp (mirrors what Skatteetaten fetch would do).
    const taxFieldsTouched =
      params.tax_card_type !== undefined ||
      params.tax_table_number !== undefined ||
      params.tax_percentage !== undefined ||
      params.tax_card_year !== undefined;

    if (params.tax_card_type !== undefined) updates.tax_card_type = params.tax_card_type;
    if (params.tax_table_number !== undefined) updates.tax_table_number = params.tax_table_number;
    if (params.tax_percentage !== undefined) updates.tax_percentage = params.tax_percentage;
    if (params.tax_card_year !== undefined) updates.tax_card_year = params.tax_card_year;
    if (taxFieldsTouched) updates.tax_card_fetched_at = new Date().toISOString();

    const { data: updated, error: updateErr } = await ctx.supabaseAdmin
      .from("employee_payroll_profile")
      .update(updates)
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .select("id")
      .single();

    if (updateErr || !updated) {
      return JSON.stringify({
        ok: false,
        reason: "update_failed",
        detail: updateErr?.message ?? "no row returned",
      });
    }

    // fields_changed: all param keys that were explicitly provided (undefined = not provided).
    const taxSchemaKeys = [
      "tax_card_type",
      "tax_table_number",
      "tax_percentage",
      "tax_card_year",
    ] as const;
    const salarySchemaKeys = [
      "monthly_salary",
      "hourly_rate",
      "payroll_system_id",
      "payment_method",
    ] as const;
    const allSchemaKeys = [...salarySchemaKeys, ...taxSchemaKeys] as const;
    const fieldsChanged = allSchemaKeys.filter(
      (k) => params[k as keyof typeof params] !== undefined,
    );

    void emit({
      event: "payroll.update_payroll_profile",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
        data: {
          target_profile_id: params.profile_id,
          fields_updated: Object.keys(updates).filter(
            (k) => k !== "updated_at" && k !== "tax_card_fetched_at",
          ),
          gate_evaluation_id: gate.gateEvaluationId ?? null,
          fields_changed: fieldsChanged,
          tax_fields_touched: taxFieldsTouched,
        },
      },
    });

    return JSON.stringify({ ok: true, payroll_profile_id: updated.id });
  },
});

// ── query_tax_card ──────────────────────────────────────────────────────────

export const queryTaxCard = defineTool({
  name: "query_tax_card",
  description:
    "Read an employee's tax card status (withholding percentage, deduction card type). Admin or self (own tax card). Chat channel only. Read-only.",
  capability: CAPABILITY,
  schema: z.object({
    profile_id: z
      .string()
      .uuid()
      .describe("The employee profile_id. Self-access: pass own profile_id."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({ ok: false, reason: "channel_forbidden", detail: channelCheck.msg });
    }

    // Self-access or admin: gate_action will resolve min_role for cross-profile reads.
    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "query_tax_card",
      entityId: params.profile_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        detail: gate.reason ?? "denied",
      });
    }

    // Verify target belongs to workspace (ADR-0151).
    const { data, error } = await ctx.supabaseAdmin
      .from("employee_payroll_profile")
      .select("tax_card_type, tax_percentage")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (error || !data) {
      return JSON.stringify({ ok: false, reason: "not_found" });
    }

    void emit({
      event: "payroll.tax_card_queried",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
        data: {
          target_profile_id: params.profile_id,
          is_self: params.profile_id === ctx.profileId,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      tax_card_type: data.tax_card_type ?? null,
      tax_percentage: data.tax_percentage ?? null,
    });
  },
});

// ── set_pension_scheme ──────────────────────────────────────────────────────

export const setPensionScheme = defineTool({
  name: "set_pension_scheme",
  description:
    "Set or update an employee's pension scheme association. Admin only. Chat channel only. Requires confirmation.",
  capability: CAPABILITY,
  schema: z.object({
    profile_id: z.string().uuid().describe("The employee profile_id."),
    pension_scheme_id: z.string().uuid().describe("The pension_scheme.id to associate."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({ ok: false, reason: "channel_forbidden", detail: channelCheck.msg });
    }

    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "set_pension_scheme",
      entityId: params.profile_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        detail: gate.reason ?? "denied",
      });
    }

    // Verify target payroll profile belongs to workspace (ADR-0151).
    const { data: existing, error: existErr } = await ctx.supabaseAdmin
      .from("employee_payroll_profile")
      .select("id, workspace_id")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (existErr || !existing) {
      return JSON.stringify({ ok: false, reason: "not_found" });
    }

    const { data: updated, error: updateErr } = await ctx.supabaseAdmin
      .from("employee_payroll_profile")
      .update({
        pension_scheme_id: params.pension_scheme_id,
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .select("id")
      .single();

    if (updateErr || !updated) {
      return JSON.stringify({
        ok: false,
        reason: "update_failed",
        detail: updateErr?.message ?? "no row returned",
      });
    }

    void emit({
      event: "payroll.set_pension_scheme",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
        data: {
          target_profile_id: params.profile_id,
          pension_scheme_id: params.pension_scheme_id,
          gate_evaluation_id: gate.gateEvaluationId ?? null,
        },
      },
    });

    return JSON.stringify({ ok: true, payroll_profile_id: updated.id });
  },
});

// ── view_personal_number ────────────────────────────────────────────────────

export const viewPersonalNumber = defineTool({
  name: "view_personal_number",
  description:
    "Reveal an employee's full personnummer (fødselsnummer). Admin or self. Audit-emitted on every reveal (success + denied). Chat channel only. ADR-0077 PII access compliance.",
  capability: CAPABILITY,
  schema: z.object({
    profile_id: z.string().uuid().describe("The employee profile_id."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({ ok: false, reason: "channel_forbidden", detail: channelCheck.msg });
    }

    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "view_personal_number",
      entityId: params.profile_id,
    });

    // ADR-0077: emit on EVERY reveal attempt — gate-denial included.
    // was_revealed=false on denial so audit trail distinguishes "blocked" from "sent to caller".
    // gate_evaluation_id is set even on denial (callGateAction always returns it).
    if (!gate.allow) {
      void emit({
        event: "payroll.personal_number_revealed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
          data: {
            target_profile_id: params.profile_id,
            is_self: params.profile_id === ctx.profileId,
            gate_evaluation_id: gate.gateEvaluationId ?? null,
            was_revealed: false,
          },
        },
      });
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        detail: gate.reason ?? "denied",
      });
    }

    // ADR-0151 workspace-scoped forgery defence: SELECT from profile with both
    // profile_id = params.profile_id AND workspace_id = ctx.workspaceId. If the
    // profile belongs to a different workspace the row is not found and we return
    // not_found without leaking cross-workspace existence. NO silent fallback to
    // JWT-default workspace (L-0177 anti-pattern).
    const { data, error } = await ctx.supabaseAdmin
      .from("profile")
      .select("personal_number, workspace_id")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    const isSelf = params.profile_id === ctx.profileId;

    if (error || !data) {
      // Audit the cross-workspace / not-found attempt — was_revealed=false, value absent.
      void emit({
        event: "payroll.personal_number_revealed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
          data: {
            target_profile_id: params.profile_id,
            is_self: isSelf,
            gate_evaluation_id: gate.gateEvaluationId ?? null,
            was_revealed: false,
          },
        },
      });
      return JSON.stringify({ ok: false, reason: "not_found" });
    }

    // Emit on every successful reveal — including when the column is null (no PII on file).
    // was_revealed=true because the value (or null sentinel) is returned to the caller.
    void emit({
      event: "payroll.personal_number_revealed",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
        data: {
          target_profile_id: params.profile_id,
          is_self: isSelf,
          gate_evaluation_id: gate.gateEvaluationId ?? null,
          was_revealed: true,
        },
      },
    });

    if (data.personal_number === null || data.personal_number === undefined) {
      return JSON.stringify({
        ok: true,
        value: null,
        is_self: isSelf,
        has_value: false,
        gate_evaluation_id: gate.gateEvaluationId ?? null,
      });
    }

    return JSON.stringify({
      ok: true,
      value: data.personal_number,
      is_self: isSelf,
      has_value: true,
      gate_evaluation_id: gate.gateEvaluationId ?? null,
    });
  },
});

// ── view_bank_account ───────────────────────────────────────────────────────

export const viewBankAccount = defineTool({
  name: "view_bank_account",
  description:
    "Reveal an employee's full bank account number. Admin or self. Audit-emitted on every reveal. Chat channel only. ADR-0077 PII access compliance.",
  capability: CAPABILITY,
  schema: z.object({
    profile_id: z.string().uuid().describe("The employee profile_id."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({ ok: false, reason: "channel_forbidden", detail: channelCheck.msg });
    }

    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "view_bank_account",
      entityId: params.profile_id,
    });

    // ADR-0077: emit on EVERY reveal attempt — gate-denial included.
    // was_revealed=false on denial so audit trail distinguishes "blocked" from "sent to caller".
    if (!gate.allow) {
      void emit({
        event: "payroll.bank_account_revealed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
          data: {
            target_profile_id: params.profile_id,
            is_self: params.profile_id === ctx.profileId,
            gate_evaluation_id: gate.gateEvaluationId ?? null,
            was_revealed: false,
          },
        },
      });
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        detail: gate.reason ?? "denied",
      });
    }

    // ADR-0151 workspace-scoped forgery defence: SELECT from profile with both
    // profile_id = params.profile_id AND workspace_id = ctx.workspaceId. If the
    // profile belongs to a different workspace the row is not found and we return
    // not_found without leaking cross-workspace existence. NO silent fallback to
    // JWT-default workspace (L-0177 anti-pattern).
    const { data, error } = await ctx.supabaseAdmin
      .from("profile")
      .select("bank_account, workspace_id")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    const isSelf = params.profile_id === ctx.profileId;

    if (error || !data) {
      // Audit the cross-workspace / not-found attempt — was_revealed=false, value absent.
      void emit({
        event: "payroll.bank_account_revealed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
          data: {
            target_profile_id: params.profile_id,
            is_self: isSelf,
            gate_evaluation_id: gate.gateEvaluationId ?? null,
            was_revealed: false,
          },
        },
      });
      return JSON.stringify({ ok: false, reason: "not_found" });
    }

    // Emit on successful reveal — was_revealed=true because value is returned to caller.
    void emit({
      event: "payroll.bank_account_revealed",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
        data: {
          target_profile_id: params.profile_id,
          is_self: isSelf,
          gate_evaluation_id: gate.gateEvaluationId ?? null,
          was_revealed: true,
        },
      },
    });

    if (data.bank_account === null || data.bank_account === undefined) {
      return JSON.stringify({
        ok: true,
        value: null,
        is_self: isSelf,
        has_value: false,
        gate_evaluation_id: gate.gateEvaluationId ?? null,
      });
    }

    return JSON.stringify({
      ok: true,
      value: data.bank_account,
      is_self: isSelf,
      has_value: true,
      gate_evaluation_id: gate.gateEvaluationId ?? null,
    });
  },
});

// ── salary_query ────────────────────────────────────────────────────────────
// WS1C (Wave 5, Journey 4 step 4): reads shift_cost_snapshot for recent shifts,
// contract_pay_rule for rate citations, and framework_rule for Riksavtalen reference.
// Returns breakdown per shift + Riksavtalen source citation ("Riksavtalen §3.2").
// Read-only. Admin or self. Chat channel only (ADR-0078 Høy-PII).
//
// Authority: employee can query own data (self); admin/manager can query team.
// ADR-0151: workspace membership verified via .eq("workspace_id", ctx.workspaceId).

export const salaryQuery = defineTool({
  name: "salary_query",
  description:
    "Query salary information for an employee — base rate, recent shift pay breakdown with Riksavtalen citations. Read-only. Admin or self. Chat only.",
  capability: CAPABILITY,
  schema: z.object({
    profile_id: z.string().uuid().describe("The employee profile_id."),
    period_month: z
      .string()
      .optional()
      .describe("ISO month (YYYY-MM) to query. Defaults to current month."),
    last_n_shifts: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe("Number of recent shifts to include in the breakdown (default 10)."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({ ok: false, reason: "channel_forbidden", detail: channelCheck.msg });
    }

    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "salary_query",
      entityId: params.profile_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        detail: gate.reason ?? "denied",
      });
    }

    // Verify workspace membership (ADR-0151 forgery defence).
    const { data: payrollData, error: payrollErr } = await ctx.supabaseAdmin
      .from("employee_payroll_profile")
      .select("monthly_salary, hourly_rate, remuneration_type, currency")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (payrollErr || !payrollData) {
      return JSON.stringify({
        ok: false,
        reason: "not_found",
        detail: "Payroll profile not found in this workspace.",
      });
    }

    // Build date range for the requested month (or current month).
    const isoMonth = params.period_month ?? new Date().toISOString().slice(0, 7);
    const [year, month] = isoMonth.split("-").map(Number);
    const periodStart = new Date(year!, month! - 1, 1).toISOString();
    const periodEnd = new Date(year!, month!, 0, 23, 59, 59).toISOString();
    const limit = params.last_n_shifts ?? 10;

    // Fetch shift_cost_snapshots for this employee in the period.
    // shift_cost_snapshot links to schedule_shift via shift_id (Wave 3 schema).
    const { data: snapshots, error: snapErr } = await ctx.supabaseAdmin
      .from("shift_cost_snapshot")
      .select(
        "id, shift_id, base_amount, supplement_amount, total_amount, currency, pay_rule_ids, session_date",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("profile_id", params.profile_id)
      .gte("session_date", periodStart.slice(0, 10))
      .lte("session_date", periodEnd.slice(0, 10))
      .order("session_date", { ascending: false })
      .limit(limit);

    if (snapErr) {
      // Graceful degradation — return base rate even if snapshots unavailable.
      void emit({
        event: "payroll.salary_queried",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
          data: {
            target_profile_id: params.profile_id,
            period_month: isoMonth,
            is_self: params.profile_id === ctx.profileId,
          },
        },
      });
      return JSON.stringify({
        ok: true,
        period_month: isoMonth,
        monthly_salary: payrollData.monthly_salary ?? null,
        hourly_rate: payrollData.hourly_rate ?? null,
        remuneration_type: payrollData.remuneration_type ?? null,
        currency: payrollData.currency ?? "NOK",
        shift_breakdown: [],
        total_period_amount: null,
        note: "Detaljert skiftdata midlertidig utilgjengelig.",
      });
    }

    // Collect unique pay_rule_ids for citation lookup.
    const allRuleIds: string[] = [];
    for (const snap of snapshots ?? []) {
      const ids = Array.isArray(snap.pay_rule_ids) ? (snap.pay_rule_ids as string[]) : [];
      allRuleIds.push(...ids);
    }
    const uniqueRuleIds = [...new Set(allRuleIds)];

    // Fetch contract_pay_rule source_text (Riksavtalen citation).
    let ruleSourceMap: Record<string, string> = {};
    if (uniqueRuleIds.length > 0) {
      const { data: rules } = await ctx.supabaseAdmin
        .from("contract_pay_rule")
        .select("id, source_text, rule_type")
        .in("id", uniqueRuleIds)
        .eq("workspace_id", ctx.workspaceId);

      if (rules) {
        ruleSourceMap = Object.fromEntries(
          rules.map((r) => [r.id, r.source_text ?? r.rule_type ?? "ukjent"]),
        );
      }
    }

    // Build shift breakdown.
    const shiftBreakdown = (snapshots ?? []).map((snap) => {
      const ruleIds = Array.isArray(snap.pay_rule_ids) ? (snap.pay_rule_ids as string[]) : [];
      const citations = ruleIds.map((id) => ruleSourceMap[id] ?? id).filter(Boolean);
      return {
        shift_id: snap.shift_id,
        session_date: snap.session_date,
        base_amount: snap.base_amount ?? 0,
        supplement_amount: snap.supplement_amount ?? 0,
        total_amount: snap.total_amount ?? 0,
        currency: snap.currency ?? payrollData.currency ?? "NOK",
        citations,
      };
    });

    const totalPeriodAmount = shiftBreakdown.reduce((sum, s) => sum + (s.total_amount ?? 0), 0);

    void emit({
      event: "payroll.salary_queried",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
        data: {
          target_profile_id: params.profile_id,
          period_month: isoMonth,
          is_self: params.profile_id === ctx.profileId,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      period_month: isoMonth,
      monthly_salary: payrollData.monthly_salary ?? null,
      hourly_rate: payrollData.hourly_rate ?? null,
      remuneration_type: payrollData.remuneration_type ?? null,
      currency: payrollData.currency ?? "NOK",
      shift_breakdown: shiftBreakdown,
      total_period_amount: totalPeriodAmount,
    });
  },
});

// ── lock_period ─────────────────────────────────────────────────────────────
// Locks a payroll period after verifying no unacknowledged error deviations.
// Admin-only, chat-only (ADR-0078). gate_action before write (ADR-0204).
export const lockPeriod = defineTool({
  name: "lock_period",
  description:
    "Lock a payroll period to prevent further changes. Fails if there are unacknowledged error-severity deviations. Admin only. Use period_id from list_payroll_periods.",
  schema: z.object({
    period_id: z.string().uuid().describe("UUID of the payroll period to lock"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const chGuard = assertChatChannel(channel);
    if (chGuard.denied) return chGuard.msg;

    const supabase = ctx.supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "lock_period",
      entityId: params.period_id,
    });
    if (!gate.allow) return `Ikke tillatt: ${gate.reason ?? "ingen tilgang"}`;

    // Verify period belongs to workspace (L-0177 forgery defence).
    const { data: period, error: periodErr } = await supabase
      .schema("payroll")
      .from("period")
      .select("id, status, start_date, end_date")
      .eq("id", params.period_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (periodErr || !period) return "Periode ikke funnet i dette arbeidsområdet.";
    if (period.status === "locked" || period.status === "approved") {
      return `Periode er allerede ${period.status}.`;
    }

    // Block if unacknowledged error deviations exist.
    const { data: errors } = await supabase
      .schema("payroll")
      .from("deviation")
      .select("id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("period_id", params.period_id)
      .eq("severity", "error")
      .is("acknowledged_by", null);

    if (errors && errors.length > 0) {
      await emit({
        event: "payroll.deviation_blocked_approval",
        workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
        actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
        properties: {
          entity: { entity_type: "payroll_period" as const, entity_id: params.period_id },
          data: {
            period_id: params.period_id,
            blocking_deviation_count: errors.length,
            check_codes: [],
          },
        },
      });
      return `Kan ikke låse periode: ${errors.length} ukveitterte feilsavvik gjenstår. Bekreft avvikene først.`;
    }

    // Lock the period.
    const now = new Date().toISOString();
    const { error: lockErr } = await supabase
      .schema("payroll")
      .from("period")
      .update({ status: "locked", locked_at: now, locked_by: ctx.profileId })
      .eq("id", params.period_id)
      .eq("workspace_id", ctx.workspaceId);

    if (lockErr) return `Feil ved låsing: ${lockErr.message}`;

    // ADR-0303 Amendment 2 (L-0237, F-CT-01 5th occurrence): capability-tool emit removed.
    // BFF route at apps/web/src/app/api/payroll/lock-period/route.ts:163 is canonical
    // emit-site — it computes real profiles_count/total_lines + affected_profile_ids[].
    // This capability tool delegates emit to the route to preserve single source of truth
    // for the payroll.period_locked subscriber (engine_process payroll_period_locked_notifier).
    // Re-introducing emit here will cause N×2 notifications per lock once subscriber ships.

    return JSON.stringify({
      ok: true,
      period_id: params.period_id,
      status: "locked",
      locked_at: now,
    });
  },
});

// ── acknowledge_deviation ──────────────────────────────────────────────────
// Manager-level: mark a deviation as acknowledged with optional resolution note.
export const acknowledgeDeviation = defineTool({
  name: "acknowledge_deviation",
  description:
    "Acknowledge a payroll deviation (warning or error) and optionally provide a resolution note. Manager or admin only.",
  schema: z.object({
    deviation_id: z.string().uuid().describe("UUID of the payroll.deviation row"),
    resolution: z.string().max(500).optional().describe("Optional resolution note (max 500 chars)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const chGuard = assertChatChannel(channel);
    if (chGuard.denied) return chGuard.msg;

    const supabase = ctx.supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "acknowledge_deviation",
      entityId: params.deviation_id,
    });
    if (!gate.allow) return `Ikke tillatt: ${gate.reason ?? "ingen tilgang"}`;

    // Verify deviation belongs to workspace (L-0177).
    const { data: deviation, error: devErr } = await supabase
      .schema("payroll")
      .from("deviation")
      .select("id, check_id, severity, period_id, acknowledged_by")
      .eq("id", params.deviation_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (devErr || !deviation) return "Avvik ikke funnet i dette arbeidsområdet.";
    if (deviation.acknowledged_by) return "Avviket er allerede bekreftet.";

    const now = new Date().toISOString();
    const { error: ackErr } = await supabase
      .schema("payroll")
      .from("deviation")
      .update({
        acknowledged_by: ctx.profileId,
        acknowledged_at: now,
        resolution: params.resolution ?? null,
      })
      .eq("id", params.deviation_id)
      .eq("workspace_id", ctx.workspaceId);

    if (ackErr) return `Feil ved bekreftelse: ${ackErr.message}`;

    await emit({
      event: "payroll.deviation_acknowledged",
      workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
      actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
      properties: {
        entity: { entity_type: "payroll_deviation" as const, entity_id: params.deviation_id },
        data: {
          deviation_id: params.deviation_id,
          period_id: deviation.period_id ?? "",
          check_code: deviation.check_id,
          severity: deviation.severity as "error" | "warning",
          acknowledged_by_profile_id: ctx.profileId,
          gate_evaluation_id: gate.gateEvaluationId,
        },
      },
    });

    return JSON.stringify({ ok: true, deviation_id: params.deviation_id, acknowledged_at: now });
  },
});

// ── set_overtime_mode ──────────────────────────────────────────────────────
// Admin: switch an employee between paid_out and banked overtime mode.
// If switching to 'banked', toil_agreement_signed_at must not be NULL.
export const setOvertimeMode = defineTool({
  name: "set_overtime_mode",
  description:
    "Switch an employee's overtime mode between 'paid_out' (default) and 'banked' (TOIL). " +
    "Switching to 'banked' requires a signed TOIL agreement (toil_agreement_signed_at set). Admin only.",
  schema: z.object({
    profile_id: z.string().uuid().describe("Profile ID of the employee"),
    overtime_mode: z.enum(["paid_out", "banked"]).describe("New overtime mode"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const chGuard = assertChatChannel(channel);
    if (chGuard.denied) return chGuard.msg;

    const supabase = ctx.supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "set_overtime_mode",
      entityId: params.profile_id,
    });
    if (!gate.allow) return `Ikke tillatt: ${gate.reason ?? "ingen tilgang"}`;

    // Verify payroll profile in workspace (L-0177).
    const { data: pp, error: ppErr } = await supabase
      .from("employee_payroll_profile")
      .select("id, profile_id, overtime_mode, toil_agreement_signed_at")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (ppErr || !pp) return "Lønnsprofil ikke funnet i dette arbeidsområdet.";

    // Block switch to 'banked' without TOIL agreement (ADR-0254).
    if (params.overtime_mode === "banked" && !pp.toil_agreement_signed_at) {
      return "Kan ikke bytte til 'banked': TOIL-avtale ikke signert (toil_agreement_signed_at er null). Last opp signert avtale først.";
    }

    const fromMode = pp.overtime_mode as "paid_out" | "banked" | null;

    const { error: updateErr } = await supabase
      .from("employee_payroll_profile")
      .update({ overtime_mode: params.overtime_mode })
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId);

    if (updateErr) return `Feil ved oppdatering: ${updateErr.message}`;

    await emit({
      event: "payroll.overtime_mode_changed",
      workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
      actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
      properties: {
        entity: { entity_type: "profile" as const, entity_id: params.profile_id },
        data: {
          target_profile_id: params.profile_id,
          from_mode: fromMode,
          to_mode: params.overtime_mode,
          toil_agreement_signed: !!pp.toil_agreement_signed_at,
          gate_evaluation_id: gate.gateEvaluationId,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      profile_id: params.profile_id,
      overtime_mode: params.overtime_mode,
    });
  },
});

// ── adjust_timebank_balance ────────────────────────────────────────────────
// Admin: insert an adjustment entry into payroll.timebank_entry with reason.
export const adjustTimebankBalance = defineTool({
  name: "adjust_timebank_balance",
  description:
    "Adjust an employee's time-bank balance by inserting an adjustment entry. " +
    "account_type: 'toil' | 'wellness' | 'feriepenger'. Positive delta = credit, negative = debit. Admin only.",
  schema: z.object({
    profile_id: z.string().uuid(),
    account_type: z
      .enum(["toil", "wellness", "feriepenger"])
      .describe("Which time-bank account to adjust"),
    hours: z.number().describe("Delta in hours (positive = credit, negative = debit)"),
    reason: z.string().min(5).max(200).describe("Reason for adjustment (min 5 chars)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const chGuard = assertChatChannel(channel);
    if (chGuard.denied) return chGuard.msg;

    const supabase = ctx.supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "adjust_timebank_balance",
      entityId: params.profile_id,
    });
    if (!gate.allow) return `Ikke tillatt: ${gate.reason ?? "ingen tilgang"}`;

    // Verify profile in workspace (L-0177).
    const { data: profile } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (!profile) return "Ansatt ikke funnet i dette arbeidsområdet.";

    const today = new Date().toISOString().slice(0, 10);
    const { error: insertErr } = await supabase
      .schema("payroll")
      .from("timebank_entry")
      .insert({
        workspace_id: ctx.workspaceId,
        profile_id: params.profile_id,
        account_type: params.account_type,
        entry_type: "adjustment",
        hours: params.hours,
        value_amount: Math.abs(params.hours),
        value_unit: "hours",
        description: params.reason,
        effective_date: today,
        created_by: ctx.profileId,
      });

    if (insertErr) return `Feil ved justering: ${insertErr.message}`;

    await emit({
      event: "payroll.timebank_balance_adjusted",
      workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
      actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
      properties: {
        entity: { entity_type: "profile" as const, entity_id: params.profile_id },
        data: {
          target_profile_id: params.profile_id,
          account_type: params.account_type,
          delta_amount: params.hours,
          delta_unit: "hours" as const,
          reason: params.reason,
          gate_evaluation_id: gate.gateEvaluationId,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      profile_id: params.profile_id,
      account_type: params.account_type,
      hours_adjusted: params.hours,
    });
  },
});

// ── force_timebank_payout ─────────────────────────────────────────────────
// Admin: force immediate payout of a time-bank balance (e.g., when employee leaves).
export const forceTimebankPayout = defineTool({
  name: "force_timebank_payout",
  description:
    "Force an immediate payout of an employee's time-bank balance. " +
    "Inserts a payout entry. Admin only. Use when employee leaves or requests early payout.",
  schema: z.object({
    profile_id: z.string().uuid(),
    account_type: z.enum(["toil", "wellness", "feriepenger"]),
    hours: z.number().positive().describe("Hours to pay out (must be > 0)"),
    reason: z.string().min(5).max(200),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const chGuard = assertChatChannel(channel);
    if (chGuard.denied) return chGuard.msg;

    const supabase = ctx.supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "force_timebank_payout",
      entityId: params.profile_id,
    });
    if (!gate.allow) return `Ikke tillatt: ${gate.reason ?? "ingen tilgang"}`;

    // Verify profile in workspace (L-0177).
    const { data: profile } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (!profile) return "Ansatt ikke funnet i dette arbeidsområdet.";

    const today = new Date().toISOString().slice(0, 10);
    const { error: insertErr } = await supabase.schema("payroll").from("timebank_entry").insert({
      workspace_id: ctx.workspaceId,
      profile_id: params.profile_id,
      account_type: params.account_type,
      entry_type: "payout",
      hours: -params.hours, // negative = debit
      value_amount: params.hours,
      value_unit: "hours",
      description: params.reason,
      effective_date: today,
      created_by: ctx.profileId,
    });

    if (insertErr) return `Feil ved utbetaling: ${insertErr.message}`;

    await emit({
      event: "payroll.timebank_payout_forced",
      workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
      actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
      properties: {
        entity: { entity_type: "profile" as const, entity_id: params.profile_id },
        data: {
          target_profile_id: params.profile_id,
          account_type: params.account_type,
          payout_amount: params.hours,
          payout_unit: "hours" as const,
          gate_evaluation_id: gate.gateEvaluationId,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      profile_id: params.profile_id,
      account_type: params.account_type,
      hours_paid_out: params.hours,
    });
  },
});

// ── query_timebank_balance ─────────────────────────────────────────────────
// Read-only: employee can query own balance; admin can query any.
export const queryTimebankBalance = defineTool({
  name: "query_timebank_balance",
  description:
    "Get an employee's time-bank balance across all account types (toil, wellness, feriepenger). " +
    "Employees can query their own balance. Admins can query any employee.",
  schema: z.object({
    profile_id: z.string().uuid().optional().describe("Profile ID (default: own profile)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const chGuard = assertChatChannel(channel);
    if (chGuard.denied) return chGuard.msg;

    const targetProfileId = params.profile_id ?? ctx.profileId;

    const supabase = ctx.supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "query_timebank_balance",
      entityId: targetProfileId,
    });
    if (!gate.allow) return `Ikke tillatt: ${gate.reason ?? "ingen tilgang"}`;

    // Employees can only query their own balance.
    if (targetProfileId !== ctx.profileId) {
      // Allow if gate returned allow (admin path). Already checked above.
    }

    // Verify target profile in workspace (L-0177).
    const { data: profile } = await supabase
      .from("profile")
      .select("profile_id")
      .eq("profile_id", targetProfileId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (!profile) return "Ansatt ikke funnet i dette arbeidsområdet.";

    const { data: entries, error: entErr } = await supabase
      .schema("payroll")
      .from("timebank_entry")
      .select(
        "account_type, hours, value_amount, value_unit, entry_type, effective_date, description",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("profile_id", targetProfileId)
      .order("effective_date", { ascending: false });

    if (entErr) return `Feil ved henting: ${entErr.message}`;

    // Sum per account_type.
    const balances: Record<string, number> = {};
    for (const e of entries ?? []) {
      balances[e.account_type] = (balances[e.account_type] ?? 0) + e.hours;
    }

    return JSON.stringify({
      ok: true,
      profile_id: targetProfileId,
      balances,
      entries: (entries ?? []).slice(0, 20),
    });
  },
});

// ── override_calculation_line ─────────────────────────────────────────────
// Manager: propose a wage-line override for a derived payroll.calculation_line.
// Creates a change_proposal (kind='wage_line_override', status='pending') which
// an admin must approve before the line is updated. Authority level=confirm,
// min_role=manager (seeded by 20260507110200_payroll_phase2_authority_seed.sql,
// capability='payroll.override_calculation_line').
//
// This tool was written body-first (L-0176). ADR compliance verified in body before
// docstring was written.
//
// Body compliance verified:
//   ADR-0078  — chat-only guard (channel check, line 1)
//   ADR-0204  — gate_action before any DB write (callGateAction before INSERT)
//   ADR-0151  — workspace_id resolved server-side via period_id lookup, never from body
//   L-0177    — fail fast: period not found → explicit error, no silent fallback
//   ADR-0099  — gate_action RPC wraps the mutation path
//   ADR-0134  — emit() with non-empty workspace_id + profileId after successful INSERT
//   ADR-0292  — inserts change_proposal(kind='wage_line_override') payload per spec
export const overrideCalculationLine = defineTool({
  name: "override_calculation_line",
  description:
    "Propose a new amount for a derived payroll calculation line. " +
    "Manager-only (confirm authority required). Creates a change_proposal with kind='wage_line_override' " +
    "that an admin must approve. Cannot override lines that are already pending override, " +
    "already have source='manual', or belong to a locked period. Chat only.",
  capability: CAPABILITY,
  schema: z.object({
    period_id: z
      .string()
      .uuid()
      .describe("UUID of the payroll.period the calculation line belongs to"),
    calculation_line_id: z
      .string()
      .uuid()
      .describe("UUID of the payroll.calculation_line row to override"),
    proposed_amount: z
      .number()
      .positive()
      .describe("Proposed replacement amount in NOK (must be positive)"),
    reason: z
      .string()
      .min(10)
      .describe("Reason for the override, min 10 chars. Shown in admin inbox."),
    category: z
      .enum(["manual_adjustment", "tariff_interpretation", "shift_data_error", "other"])
      .describe("Category classifying the override reason"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // Step 1 — Chat-only guard (ADR-0078 Høy-PII).
    const channel = normaliseChannel(ctx.channel);
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({ ok: false, reason: "channel_forbidden", detail: channelCheck.msg });
    }

    // Step 2 — Authority gate before any DB access (ADR-0204, ADR-0099).
    const supabase = ctx.supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "payroll.override_calculation_line",
      channel,
      actionType: "override_calculation_line",
      entityId: params.calculation_line_id,
    });
    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        detail: gate.reason ?? "ingen tilgang",
      });
    }

    // Step 3 — Resolve and verify period in workspace (ADR-0151, L-0177).
    // workspace_id is derived server-side from the authenticated ctx.workspaceId;
    // period_id comes from the body but is verified against ctx.workspaceId — if it
    // doesn't exist in this workspace, return explicit 404 (no silent fallback).
    const { data: period, error: periodErr } = await supabase
      .schema("payroll")
      .from("period")
      .select("id, status, workspace_id")
      .eq("id", params.period_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (periodErr || !period) {
      // L-0177: fail fast — no silent fallback to another workspace.
      return JSON.stringify({
        ok: false,
        reason: "not_found",
        detail: "Periode ikke funnet i dette arbeidsområdet.",
      });
    }

    // Step 4 — Reject if period is locked (Bokføringsloven §13 + journey spec).
    if (period.status === "locked" || period.status === "approved") {
      return JSON.stringify({
        ok: false,
        reason: "period_frozen",
        detail: `Kan ikke foreslå overstyring: perioden er ${period.status}.`,
      });
    }

    // Step 5 — Verify calculation_line exists in this workspace and period (L-0177).
    // Also fetch the parent calculation row to get calculation_id and the original amount.
    const { data: calcLine, error: lineErr } = await supabase
      .schema("payroll")
      .from("calculation_line")
      .select("id, workspace_id, calculation_id, amount, line_type, salary_code, description")
      .eq("id", params.calculation_line_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (lineErr || !calcLine) {
      return JSON.stringify({
        ok: false,
        reason: "not_found",
        detail: "Beregningslinje ikke funnet i dette arbeidsområdet.",
      });
    }

    // Step 6 — Verify parent calculation belongs to the requested period (L-0177).
    const { data: parentCalc, error: calcErr } = await supabase
      .schema("payroll")
      .from("calculation")
      .select("id, period_id, profile_id, calculation_version")
      .eq("id", calcLine.calculation_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (calcErr || !parentCalc) {
      return JSON.stringify({
        ok: false,
        reason: "not_found",
        detail: "Overordnet beregning ikke funnet.",
      });
    }

    if (parentCalc.period_id !== params.period_id) {
      return JSON.stringify({
        ok: false,
        reason: "period_mismatch",
        detail: "Beregningslinjen tilhører ikke den angitte perioden.",
      });
    }

    // Step 7 — Reject if a pending override already exists for this calculation_line
    // (concurrent-edit guard per journey error path §"Concurrent edit").
    // We check change_proposal for kind='wage_line_override', status='pending',
    // and changes->>'calculation_line_id' = this line's ID.
    // Note: 'kind' and the changes->>check are not in database.types.ts (added by T1.1
    // migration, types not regenerated). Cast as any to avoid TS error.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingProposal } = await (supabase as any)
      .from("change_proposal")
      .select("change_proposal_id, status")
      .eq("workspace_id", ctx.workspaceId)
      .eq("kind", "wage_line_override")
      .eq("status", "pending")
      .filter("changes->>'calculation_line_id'", "eq", params.calculation_line_id)
      .maybeSingle();

    if (existingProposal) {
      return JSON.stringify({
        ok: false,
        reason: "pending_override_exists",
        detail:
          "Det finnes allerede et ubehandlet overstyringforslag for denne linjen. Vent til admin avgjør.",
      });
    }

    // Step 8 — Insert change_proposal (ADR-0292, ADR-0204).
    // The payload shape is documented in 20260507110000_payroll_phase2_change_proposal_wage_line_override.sql.
    // Note: proposed_amount + original_amount are stored as cents (integer) for precision.
    const originalAmountCents = Math.round((calcLine.amount as number) * 100);
    const proposedAmountCents = Math.round(params.proposed_amount * 100);

    const proposalPayload = {
      calculation_line_id: params.calculation_line_id,
      calculation_id: calcLine.calculation_id,
      original_amount_cents: originalAmountCents,
      proposed_amount_cents: proposedAmountCents,
      reason: params.reason,
      category: params.category,
      period_id: params.period_id,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: proposal, error: proposalErr } = await (supabase as any)
      .from("change_proposal")
      .insert({
        workspace_id: ctx.workspaceId,
        initiated_by: ctx.profileId,
        kind: "wage_line_override",
        status: "pending",
        approval_required: true,
        trigger_entity_type: "payroll_calculation_line",
        trigger_entity_id: params.calculation_line_id,
        trigger_type: "manual",
        changes: proposalPayload,
        preview: {
          calculation_line_id: params.calculation_line_id,
          original_amount: calcLine.amount,
          proposed_amount: params.proposed_amount,
          reason: params.reason,
        },
        created_by_plane: "app",
      })
      .select("change_proposal_id")
      .single();

    if (proposalErr || !proposal) {
      return JSON.stringify({
        ok: false,
        reason: "insert_failed",
        detail:
          (proposalErr as { message?: string } | null)?.message ?? "kunne ikke opprette forslag",
      });
    }

    // Step 9 — Emit telemetry (ADR-0134). Non-empty IDs guaranteed by gate + period check above.
    // entity_type uses "payroll_calculation" — payroll_calculation_line is not yet in EntityType.
    await emit({
      event: "payroll.line_override_proposed",
      workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
      actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
      properties: {
        entity: {
          entity_type: "payroll_calculation" as const,
          entity_id: calcLine.calculation_id,
        },
        data: {
          change_proposal_id: proposal.change_proposal_id as string,
          calculation_id: calcLine.calculation_id,
          period_id: params.period_id,
          target_profile_id: parentCalc.profile_id,
          original_amount_cents: originalAmountCents,
          proposed_amount_cents: proposedAmountCents,
          category: params.category,
          gate_evaluation_id: gate.gateEvaluationId,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      change_proposal_id: proposal.change_proposal_id,
      status: "pending",
      original_amount: calcLine.amount,
      proposed_amount: params.proposed_amount,
    });
  },
});

// ── add_manual_supplement ─────────────────────────────────────────────────
// Admin: add a manual supplement to a shift in an open period.
export const addManualSupplement = defineTool({
  name: "add_manual_supplement",
  description:
    "Add a manual pay supplement to a specific shift. Period must be open (not locked/approved). " +
    "Admin only. Provide shift_id, amount, and a description.",
  schema: z.object({
    shift_id: z.string().uuid().describe("schedule_shift_id of the target shift"),
    amount: z.number().describe("Supplement amount in NOK (positive)"),
    description: z.string().min(3).max(200).describe("Reason for the supplement"),
    salary_code: z.string().optional().describe("Optional salary code (e.g. '6300')"),
    supplement_rule_id: z
      .string()
      .uuid()
      .optional()
      .describe("Optional supplement_rule.id if rule-driven"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const chGuard = assertChatChannel(channel);
    if (chGuard.denied) return chGuard.msg;

    const supabase = ctx.supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "add_manual_supplement",
      entityId: params.shift_id,
    });
    if (!gate.allow) return `Ikke tillatt: ${gate.reason ?? "ingen tilgang"}`;

    // Verify shift belongs to workspace (L-0177).
    const { data: shift, error: shiftErr } = await supabase
      .from("schedule_shift")
      .select("schedule_shift_id, start_time, employee_id")
      .eq("schedule_shift_id", params.shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (shiftErr || !shift) return "Vakt ikke funnet i dette arbeidsområdet.";

    // Verify period is open (not locked or approved).
    // Find the period that covers this shift's date.
    const shiftDate = shift.start_time.slice(0, 10);
    const { data: period } = await supabase
      .schema("payroll")
      .from("period")
      .select("id, status")
      .eq("workspace_id", ctx.workspaceId)
      .lte("start_date", shiftDate)
      .gte("end_date", shiftDate)
      .maybeSingle();

    if (period && (period.status === "locked" || period.status === "approved")) {
      return `Kan ikke legge til tillegg: Perioden er ${period.status}.`;
    }

    // Insert manual supplement (payroll schema — NOT public).
    const { data: sup, error: supErr } = await supabase
      .schema("payroll")
      .from("manual_supplement")
      .insert({
        workspace_id: ctx.workspaceId,
        schedule_shift_id: params.shift_id,
        added_by: ctx.profileId,
        amount: params.amount,
        description: params.description,
        salary_code: params.salary_code ?? null,
        supplement_rule_id: params.supplement_rule_id ?? null,
      })
      .select("id")
      .single();

    if (supErr) return `Feil ved innsetting: ${supErr.message}`;

    await emit({
      event: "payroll.manual_supplement_added",
      workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
      actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
      properties: {
        entity: { entity_type: "shift" as const, entity_id: params.shift_id },
        data: {
          supplement_id: sup.id,
          period_id: period?.id ?? "",
          target_profile_id: shift.employee_id ?? ctx.profileId,
          shift_id: params.shift_id,
          salary_code: params.salary_code ?? null,
          amount: params.amount,
          gate_evaluation_id: gate.gateEvaluationId,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      supplement_id: sup.id,
      shift_id: params.shift_id,
      amount: params.amount,
    });
  },
});

// ── export_period ─────────────────────────────────────────────────────────────
// Admin: generate CSV export for a locked payroll period (aggregate or audit variant).
// Returns CSV bytes + filename + export_event_id for the BFF stream route.
//
// Body compliance verified before docstring (L-0176):
//   ADR-0078  — chat-only guard (assertChatChannel, first guard)
//   ADR-0204  — callGateAction before any DB write
//   ADR-0151  — workspace_id resolved from period_id lookup vs ctx.workspaceId (server-side)
//   L-0177    — fail fast: period not found → explicit error, no silent fallback
//   ADR-0240  — only writes to payroll.export_event (no cross-namespace writes)
//   ADR-0134  — emit() with non-empty workspace_id + actor_id after INSERT
//   Bokføringsloven §13 — export_event is append-only (INSERT only, no UPDATE)
export const exportPeriod = defineTool({
  name: "export_period",
  description:
    "Generate an export for a locked payroll period. " +
    "format='csv': CSV with 'aggregate' (one row per employee) or 'audit' (one row per calculation line with rule provenance). " +
    "format='pdf': per-employee PDF lønnsgrunnlag bundle uploaded to storage; variant is N/A. " +
    "PII is masked by default. Admin only. Chat only.",
  capability: CAPABILITY,
  schema: z.object({
    period_id: z.string().uuid().describe("UUID of the payroll.period to export (must be locked)"),
    format: z
      .enum(["csv", "pdf"])
      .default("csv")
      .describe(
        "'csv' = spreadsheet export (default); 'pdf' = per-employee PDF lønnsgrunnlag bundle",
      ),
    variant: z
      .enum(["aggregate", "audit"])
      .default("aggregate")
      .describe(
        "CSV only — 'aggregate' = one row per profile; 'audit' = one row per calculation line. Ignored for format='pdf'.",
      ),
    include_unmasked: z
      .boolean()
      .default(false)
      .describe(
        "When true, personnummer + bankkonto are exported as raw values. Triggers high-PII audit emit.",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // Step 1 — Chat-only guard (ADR-0078 Høy-PII).
    const channel = normaliseChannel(ctx.channel);
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({ ok: false, reason: "channel_forbidden", detail: channelCheck.msg });
    }

    // Step 2 — Authority gate before any DB access (ADR-0204, ADR-0099).
    const supabase = ctx.supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "export_period",
      entityId: params.period_id,
    });
    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        detail: gate.reason ?? "ingen tilgang",
      });
    }

    // Step 3 — Resolve + verify period in workspace (ADR-0151, L-0177).
    const { data: period, error: periodErr } = await supabase
      .schema("payroll")
      .from("period")
      .select("id, status, start_date, end_date, workspace_id")
      .eq("id", params.period_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (periodErr || !period) {
      // L-0177: fail fast — no silent fallback to another workspace.
      return JSON.stringify({
        ok: false,
        reason: "not_found",
        detail: "Periode ikke funnet i dette arbeidsområdet.",
      });
    }

    // Step 4 — Reject if period is not locked (Bokføringsloven §13 + journey spec).
    if (period.status !== "locked") {
      return JSON.stringify({
        ok: false,
        reason: "period_not_locked",
        detail: `Kan ikke eksportere: perioden er ${period.status}. Lås perioden først.`,
      });
    }

    // Step 5 — Fetch workspace slug (+ orgnr + name for PDF) for filename generation.
    const { data: workspace, error: wsErr } = await supabase
      .from("workspace")
      .select("slug, name, org_number")
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (wsErr || !workspace) {
      return JSON.stringify({
        ok: false,
        reason: "workspace_not_found",
        detail: "Arbeidsområde ikke funnet.",
      });
    }

    // ── PDF branch (format='pdf') ────────────────────────────────────────────
    // When format='pdf', skip CSV logic entirely: build AggregateRows from the
    // latest calculation_version per profile, render a PDF bundle via
    // generateBundlePdfs(), upload each buffer to the payroll-lonnsgrunnlag
    // storage bucket, INSERT a single export_event row, and emit
    // payroll.lonnsgrunnlag_generated (ADR-0134).
    if (params.format === "pdf") {
      // Fetch aggregate rows (same query as CSV aggregate branch).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pdfCalcs, error: pdfCalcErr } = await (supabase.schema("payroll") as any)
        .from("calculation")
        .select(
          "id, profile_id, base_pay, total_supplements, total_deductions, total_pay, calculation_version",
        )
        .eq("workspace_id", ctx.workspaceId)
        .eq("period_id", params.period_id)
        .order("calculation_version", { ascending: false });

      if (pdfCalcErr) {
        return JSON.stringify({
          ok: false,
          reason: "db_error",
          detail: `Feil ved henting av beregninger: ${pdfCalcErr.message}`,
        });
      }

      type PdfCalcRow = {
        id: string;
        profile_id: string;
        base_pay: number | null;
        total_supplements: number | null;
        total_deductions: number | null;
        total_pay: number | null;
        calculation_version: number | null;
      };
      const typedPdfCalcs = (pdfCalcs ?? []) as PdfCalcRow[];

      // De-duplicate: keep only the highest calculation_version per profile.
      const pdfSeen = new Set<string>();
      const latestPdfCalcs = typedPdfCalcs.filter((c) => {
        if (pdfSeen.has(c.profile_id)) return false;
        pdfSeen.add(c.profile_id);
        return true;
      });

      if (latestPdfCalcs.length === 0) {
        return JSON.stringify({
          ok: false,
          reason: "no_rows",
          detail: "Ingen beregningsrader funnet for denne perioden.",
        });
      }

      // Fetch PII + display_name + holiday_allowance_pct (ADR-0295 feriepenger_basis).
      type PdfPii = {
        profile_id: string;
        personal_id_number: string | null;
        bank_account_number: string | null;
        holiday_allowance_pct: number | null;
      };
      const pdfProfileIds = latestPdfCalcs.map((c) => c.profile_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ data: pdfPiiRaw, error: pdfPiiErr }, { data: pdfProfiles, error: pdfProfErr }] =
        await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from("employee_payroll_profile")
            .select("profile_id, personal_id_number, bank_account_number, holiday_allowance_pct")
            .in("profile_id", pdfProfileIds)
            .eq("workspace_id", ctx.workspaceId),
          supabase
            .from("profile")
            .select("profile_id, display_name")
            .in("profile_id", pdfProfileIds)
            .eq("workspace_id", ctx.workspaceId),
        ]);

      if (pdfPiiErr || pdfProfErr) {
        return JSON.stringify({
          ok: false,
          reason: "db_error",
          detail: "Feil ved henting av ansattdata for PDF-generering.",
        });
      }

      const pdfPiiMap = new Map(
        ((pdfPiiRaw ?? []) as unknown as PdfPii[]).map((pp) => [pp.profile_id, pp]),
      );
      const pdfProfileMap = new Map((pdfProfiles ?? []).map((p) => [p.profile_id, p]));

      const pdfExportedAt = new Date();
      const pdfPeriodLabel = (period as { start_date: string; end_date: string }).start_date.slice(
        0,
        7,
      );
      const pdfWorkspaceSlug = workspace.slug ?? ctx.workspaceId.slice(0, 8);

      // ADR-0295: compute feriepenger basis per profile via canonical helper.
      // Capability tool parity with BFF routes (apps/web/src/app/api/payroll/export-period
      // and generate-pdf-{bundle,single}). F-CL-13 (audit 2026-05-13) closed by this site.
      type FeriepengerEmitInput = {
        profile_id: string;
        basePay: number;
        pctApplied: number;
        basisAmount: number;
      };
      const pdfFeriepengerEmits: FeriepengerEmitInput[] = [];

      const pdfAggRows: AggregateRow[] = latestPdfCalcs.map((c) => {
        const pp = pdfPiiMap.get(c.profile_id);
        const prof = pdfProfileMap.get(c.profile_id);
        const basePay = Number(c.base_pay ?? 0);
        const pctApplied = Number(pp?.holiday_allowance_pct ?? 12);
        const basisAmount = computeFeriepengerBasis({
          basePayTotal: basePay,
          holidayAllowancePct: pctApplied,
        });
        pdfFeriepengerEmits.push({
          profile_id: c.profile_id,
          basePay,
          pctApplied,
          basisAmount,
        });
        return {
          profile_id: c.profile_id,
          profile_name: prof?.display_name ?? c.profile_id,
          personnummer: pp?.personal_id_number ?? null,
          bankkonto: pp?.bank_account_number ?? null,
          base_pay: basePay,
          total_supplements: Number(c.total_supplements ?? 0),
          total_deductions: Number(c.total_deductions ?? 0),
          total_pay: Number(c.total_pay ?? 0),
          taxable_pay: Number(c.total_pay ?? 0),
          // ADR-0295: basis = base_pay × holiday_allowance_pct / 100 (default 12 %).
          feriepenger_basis: basisAmount,
        } satisfies AggregateRow;
      });

      // Emit payroll.feriepenger_basis_computed per profile (ADR-0295, ADR-0134).
      // Logger + activity_trail routing only (no PostHog) per registry config.
      await Promise.allSettled(
        pdfFeriepengerEmits.map((f) =>
          emit({
            event: "payroll.feriepenger_basis_computed",
            workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
            actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
            properties: {
              entity: {
                entity_type: "payroll_period" as const,
                entity_id: params.period_id,
              },
              data: {
                workspace_id: ctx.workspaceId,
                period_id: params.period_id,
                profile_id: f.profile_id,
                basis_amount: f.basisAmount,
                pct_applied: f.pctApplied,
                base_pay_total: f.basePay,
                channel: "system" as const,
              },
            },
          }),
        ),
      );

      // Build PDF options.
      const pdfPeriod = period as { start_date: string; end_date: string };
      const pdfOpts: LonnsgrunnlagPdfOptions = {
        workspaceOrgnr: (workspace as { org_number?: string | null }).org_number ?? "000000000",
        workspaceName: (workspace as { name?: string | null }).name ?? pdfWorkspaceSlug,
        periodStartDate: pdfPeriod.start_date,
        periodEndDate: pdfPeriod.end_date,
        periodId: params.period_id,
        workspaceSlug: pdfWorkspaceSlug,
        periodLabel: pdfPeriodLabel,
        exportedAt: pdfExportedAt,
        includeUnmasked: params.include_unmasked,
        generatedAt: pdfExportedAt.toISOString(),
      };

      // Generate PDF bundle (sequential to avoid memory spikes; <5s for 12 employees).
      let pdfBundle: Awaited<ReturnType<typeof generateBundlePdfs>>;
      try {
        pdfBundle = await generateBundlePdfs(pdfAggRows, pdfOpts);
      } catch (renderErr) {
        await emit({
          event: "payroll.lonnsgrunnlag_generation_failed",
          workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
          actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
          properties: {
            entity: { entity_type: "payroll_export_event" as const, entity_id: params.period_id },
            data: {
              period_id: params.period_id,
              error_code: "render_error",
            },
          },
        });
        return JSON.stringify({
          ok: false,
          reason: "render_error",
          detail: (renderErr as Error).message ?? "PDF-generering feilet.",
        });
      }

      // Upload each PDF to storage bucket payroll-lonnsgrunnlag.
      // Path convention: {workspace_id}/{period_id}/{profile_id}.pdf (ADR-0294).
      const uploadResults: { profile_id: string; path: string; sha256: string }[] = [];
      for (const item of pdfBundle) {
        const storagePath = `${ctx.workspaceId}/${params.period_id}/${item.profile_id}.pdf`;
        const { error: uploadErr } = await supabase.storage
          .from("payroll-lonnsgrunnlag")
          .upload(storagePath, item.buffer, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadErr) {
          await emit({
            event: "payroll.lonnsgrunnlag_generation_failed",
            workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
            actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
            properties: {
              entity: {
                entity_type: "payroll_export_event" as const,
                entity_id: params.period_id,
              },
              data: {
                period_id: params.period_id,
                error_code: "storage_upload_failed",
              },
            },
          });
          return JSON.stringify({
            ok: false,
            reason: "storage_upload_failed",
            detail: `Feil ved opplasting av PDF for profil ${item.profile_id}: ${uploadErr.message}`,
          });
        }
        uploadResults.push({ profile_id: item.profile_id, path: storagePath, sha256: item.sha256 });
      }

      // Compute a combined content hash over all individual sha256 values.
      const combinedHash = computeFileHash(pdfBundle.map((b) => b.sha256).join("\n"));

      // INSERT payroll.export_event (Bokføringsloven §13).
      const pdfIdempotencyKey = `${params.period_id}-pdf-${pdfExportedAt.toISOString()}`;
      // Cast to any: payroll schema types not yet generated for Phase 4 columns.
      // Same pattern as capabilities/payroll/tools.ts other export_event inserts.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payrollAdminAny = supabase.schema("payroll") as any;
      const { data: pdfExportEvent, error: pdfExportErr } = await payrollAdminAny
        .from("export_event")
        .insert({
          workspace_id: ctx.workspaceId,
          period_id: params.period_id,
          exported_by: ctx.profileId,
          export_format: "pdf",
          status: "completed",
          started_at: pdfExportedAt.toISOString(),
          completed_at: new Date().toISOString(),
          variant: "aggregate", // PDF is always per-employee aggregate
          masked: !params.include_unmasked,
          file_hash: combinedHash,
          idempotency_key: pdfIdempotencyKey,
          row_count: pdfBundle.length,
        })
        .select("id")
        .single();

      if (pdfExportErr || !pdfExportEvent) {
        const isConflict = pdfExportErr?.code === "23505";
        return JSON.stringify({
          ok: false,
          reason: isConflict ? "duplicate_export" : "db_write_failed",
          detail: pdfExportErr?.message ?? "kunne ikke opprette eksportevent",
        });
      }

      // Emit telemetry (ADR-0134) — one event for the entire bundle.
      await emit({
        event: "payroll.lonnsgrunnlag_generated",
        workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
        actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
        properties: {
          entity: {
            entity_type: "payroll_export_event" as const,
            entity_id: pdfExportEvent.id,
          },
          data: {
            export_event_id: pdfExportEvent.id,
            period_id: params.period_id,
            profile_count: pdfBundle.length,
            format: "pdf",
            masked: !params.include_unmasked,
          },
        },
      });

      return JSON.stringify({
        ok: true,
        event_id: pdfExportEvent.id,
        format: "pdf",
        profile_count: pdfBundle.length,
        files: uploadResults,
      });
    }

    // Step 6 — Fetch employee data for the period.
    // Aggregate variant: 1 row per profile from payroll.calculation (latest version per profile).
    // Audit variant: 1 row per payroll.calculation row joined with shift_pay_calculation_event
    //   for provenance (rule_id, tariff_version, paragraf).
    const exportedAt = new Date();
    const periodLabel = period.start_date.slice(0, 7); // "yyyy-MM"
    const workspaceSlug = workspace.slug ?? ctx.workspaceId.slice(0, 8);

    let csvRows: AggregateRow[] | AuditRow[];

    if (params.variant === "aggregate") {
      // Aggregate: latest calculation_version per profile + employee_payroll_profile for PII.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: calcs, error: calcErr } = await (supabase.schema("payroll") as any)
        .from("calculation")
        .select(
          "id, profile_id, base_pay, total_supplements, total_deductions, total_pay, calculation_version",
        )
        .eq("workspace_id", ctx.workspaceId)
        .eq("period_id", params.period_id)
        .order("calculation_version", { ascending: false });

      if (calcErr) {
        return JSON.stringify({
          ok: false,
          reason: "db_error",
          detail: `Feil ved henting av beregninger: ${calcErr.message}`,
        });
      }

      // De-duplicate to keep only the highest calculation_version per profile.
      // calcs is untyped (payroll schema cast), so we cast each row.
      type CalcRow = {
        id: string;
        profile_id: string;
        base_pay: number | null;
        total_supplements: number | null;
        total_deductions: number | null;
        total_pay: number | null;
        calculation_version: number | null;
      };
      const typedCalcs = (calcs ?? []) as CalcRow[];
      const seen = new Set<string>();
      const latestCalcs = typedCalcs.filter((c) => {
        if (seen.has(c.profile_id)) return false;
        seen.add(c.profile_id);
        return true;
      });

      if (latestCalcs.length === 0) {
        return JSON.stringify({
          ok: false,
          reason: "no_rows",
          detail: "Ingen beregningsrader funnet for denne perioden.",
        });
      }

      // Fetch PII from employee_payroll_profile (personnummer, bankkonto)
      // + holiday_allowance_pct for ADR-0295 feriepenger_basis compute.
      // personal_id_number + bank_account_number not yet in generated types — cast.
      type AggPii = {
        profile_id: string;
        personal_id_number: string | null;
        bank_account_number: string | null;
        holiday_allowance_pct: number | null;
      };
      const profileIds = latestCalcs.map((c) => c.profile_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: payrollProfilesRaw, error: ppErr } = await (supabase as any)
        .from("employee_payroll_profile")
        .select("profile_id, personal_id_number, bank_account_number, holiday_allowance_pct")
        .in("profile_id", profileIds)
        .eq("workspace_id", ctx.workspaceId);

      if (ppErr) {
        return JSON.stringify({
          ok: false,
          reason: "db_error",
          detail: `Feil ved henting av lønnsprofiler: ${ppErr.message}`,
        });
      }

      const payrollProfiles = (payrollProfilesRaw ?? []) as unknown as AggPii[];

      // Fetch display_name from profile.
      const { data: profiles, error: profErr } = await supabase
        .from("profile")
        .select("profile_id, display_name")
        .in("profile_id", profileIds)
        .eq("workspace_id", ctx.workspaceId);

      if (profErr) {
        return JSON.stringify({
          ok: false,
          reason: "db_error",
          detail: `Feil ved henting av profiler: ${profErr.message}`,
        });
      }

      const ppMap = new Map(payrollProfiles.map((pp) => [pp.profile_id, pp]));
      const profileMap = new Map((profiles ?? []).map((p) => [p.profile_id, p]));

      // ADR-0295: compute feriepenger_basis per profile via canonical helper.
      // F-CL-13 (audit 2026-05-13) closed by this site — capability path now matches BFF.
      type AggFeriepengerEmitInput = {
        profile_id: string;
        basePay: number;
        pctApplied: number;
        basisAmount: number;
      };
      const aggFeriepengerEmits: AggFeriepengerEmitInput[] = [];

      csvRows = latestCalcs.map((c) => {
        const pp = ppMap.get(c.profile_id);
        const prof = profileMap.get(c.profile_id);
        const basePay = Number(c.base_pay ?? 0);
        const pctApplied = Number(pp?.holiday_allowance_pct ?? 12);
        const basisAmount = computeFeriepengerBasis({
          basePayTotal: basePay,
          holidayAllowancePct: pctApplied,
        });
        aggFeriepengerEmits.push({
          profile_id: c.profile_id,
          basePay,
          pctApplied,
          basisAmount,
        });
        return {
          profile_id: c.profile_id,
          profile_name: prof?.display_name ?? c.profile_id,
          personnummer: pp?.personal_id_number ?? null,
          bankkonto: pp?.bank_account_number ?? null,
          base_pay: basePay,
          total_supplements: Number(c.total_supplements ?? 0),
          total_deductions: Number(c.total_deductions ?? 0),
          total_pay: Number(c.total_pay ?? 0),
          taxable_pay: Number(c.total_pay ?? 0), // Phase 1 proxy: taxable = total_pay
          // ADR-0295: basis = base_pay × holiday_allowance_pct / 100 (default 12 %).
          feriepenger_basis: basisAmount,
        } satisfies AggregateRow;
      });

      // Emit payroll.feriepenger_basis_computed per profile (ADR-0295, ADR-0134).
      await Promise.allSettled(
        aggFeriepengerEmits.map((f) =>
          emit({
            event: "payroll.feriepenger_basis_computed",
            workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
            actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
            properties: {
              entity: {
                entity_type: "payroll_period" as const,
                entity_id: params.period_id,
              },
              data: {
                workspace_id: ctx.workspaceId,
                period_id: params.period_id,
                profile_id: f.profile_id,
                basis_amount: f.basisAmount,
                pct_applied: f.pctApplied,
                base_pay_total: f.basePay,
                channel: "system" as const,
              },
            },
          }),
        ),
      );
    } else {
      // Audit variant: 1 row per calculation row joined with shift_pay_calculation_event.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: calcs, error: calcErr } = await (supabase.schema("payroll") as any)
        .from("calculation")
        .select(
          "id, profile_id, base_pay, total_supplements, total_deductions, total_pay, " +
            "calculation_version, schedule_shift_id, shift_date, provenance",
        )
        .eq("workspace_id", ctx.workspaceId)
        .eq("period_id", params.period_id)
        .order("profile_id")
        .order("calculation_version", { ascending: false });

      if (calcErr) {
        return JSON.stringify({
          ok: false,
          reason: "db_error",
          detail: `Feil ved henting av beregninger: ${calcErr.message}`,
        });
      }

      if (!calcs || calcs.length === 0) {
        return JSON.stringify({
          ok: false,
          reason: "no_rows",
          detail: "Ingen beregningsrader funnet for denne perioden.",
        });
      }

      // calcs is untyped (payroll schema cast), so we cast each row.
      type AuditCalcRow = {
        id: string;
        profile_id: string;
        base_pay: number | null;
        total_supplements: number | null;
        total_deductions: number | null;
        total_pay: number | null;
        calculation_version: number | null;
        schedule_shift_id: string;
        shift_date: string;
        provenance: Record<string, unknown> | null;
      };
      const typedCalcs = (calcs ?? []) as AuditCalcRow[];

      // Fetch the latest shift_pay_calculation_event per shift (provenance).
      const shiftIds = [...new Set(typedCalcs.map((c) => c.schedule_shift_id))];
      const { data: events } = await supabase
        .from("shift_pay_calculation_event")
        .select(
          "id, shift_id, rule_type, source_text_applied, derivation_version, " +
            "superseded_by_event_id",
        )
        .in("shift_id", shiftIds)
        .eq("workspace_id", ctx.workspaceId)
        .is("superseded_by_event_id", null)
        .order("derivation_version", { ascending: false });

      // Build a map of shift_id → latest event.
      type ShiftEvent = {
        id: string;
        shift_id: string;
        rule_type: string | null;
        source_text_applied: string | null;
        derivation_version: number | null;
        superseded_by_event_id: string | null;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const safeEvents = (events ?? []) as unknown as ShiftEvent[];
      const eventMap = new Map<string, ShiftEvent>();
      for (const ev of safeEvents) {
        if (!eventMap.has(ev.shift_id)) {
          eventMap.set(ev.shift_id, ev);
        }
      }

      // Fetch PII + profile names + holiday_allowance_pct (ADR-0295 feriepenger_basis).
      // personal_id_number + bank_account_number not yet in generated types — cast.
      type AuditPii = {
        profile_id: string;
        personal_id_number: string | null;
        bank_account_number: string | null;
        holiday_allowance_pct: number | null;
      };
      const profileIds = [...new Set(typedCalcs.map((c) => c.profile_id))];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ data: auditPayrollProfilesRaw }, { data: profiles }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("employee_payroll_profile")
          .select("profile_id, personal_id_number, bank_account_number, holiday_allowance_pct")
          .in("profile_id", profileIds)
          .eq("workspace_id", ctx.workspaceId),
        supabase
          .from("profile")
          .select("profile_id, display_name")
          .in("profile_id", profileIds)
          .eq("workspace_id", ctx.workspaceId),
      ]);

      const auditPayrollProfiles = (auditPayrollProfilesRaw ?? []) as unknown as AuditPii[];
      const ppMap = new Map(auditPayrollProfiles.map((pp) => [pp.profile_id, pp]));
      const profileMap = new Map((profiles ?? []).map((p) => [p.profile_id, p]));

      // ADR-0295: compute feriepenger_basis per row via canonical helper.
      // Audit variant emits per-row (matches BFF apps/web/.../export-period/route.ts).
      // F-CL-13 (audit 2026-05-13) closed by this site.
      type AuditFeriepengerEmitInput = {
        profile_id: string;
        basePay: number;
        pctApplied: number;
        basisAmount: number;
      };
      const auditFeriepengerEmits: AuditFeriepengerEmitInput[] = [];

      csvRows = typedCalcs.map((c) => {
        const pp = ppMap.get(c.profile_id);
        const prof = profileMap.get(c.profile_id);
        const ev = eventMap.get(c.schedule_shift_id);
        // Extract provenance from the calculation row (set by override applier or calculator).
        const prov = c.provenance as Record<string, unknown> | null;
        const auditBasePay = Number(c.base_pay ?? 0);
        const auditPctApplied = Number(pp?.holiday_allowance_pct ?? 12);
        const auditBasisAmount = computeFeriepengerBasis({
          basePayTotal: auditBasePay,
          holidayAllowancePct: auditPctApplied,
        });
        auditFeriepengerEmits.push({
          profile_id: c.profile_id,
          basePay: auditBasePay,
          pctApplied: auditPctApplied,
          basisAmount: auditBasisAmount,
        });
        return {
          profile_id: c.profile_id,
          profile_name: prof?.display_name ?? c.profile_id,
          personnummer: pp?.personal_id_number ?? null,
          bankkonto: pp?.bank_account_number ?? null,
          base_pay: auditBasePay,
          total_supplements: Number(c.total_supplements ?? 0),
          total_deductions: Number(c.total_deductions ?? 0),
          total_pay: Number(c.total_pay ?? 0),
          taxable_pay: Number(c.total_pay ?? 0),
          // ADR-0295: basis = base_pay × holiday_allowance_pct / 100 (default 12 %).
          feriepenger_basis: auditBasisAmount,
          // Audit-specific columns:
          calculation_line_id: c.id,
          shift_id: c.schedule_shift_id,
          shift_date: c.shift_date,
          rule_id: (prov?.rule_id as string | null) ?? ev?.rule_type ?? null,
          tariff_version: (prov?.tariff_version as string | null) ?? null,
          paragraf: (prov?.paragraf as string | null) ?? ev?.source_text_applied ?? null,
          rule_amount: Number(c.total_pay ?? 0),
          derivation_version: c.calculation_version ?? 1,
        } satisfies AuditRow;
      });

      // Emit payroll.feriepenger_basis_computed per row (ADR-0295, ADR-0134).
      // Audit-variant parity with BFF: one event per calculation line.
      await Promise.allSettled(
        auditFeriepengerEmits.map((f) =>
          emit({
            event: "payroll.feriepenger_basis_computed",
            workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
            actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
            properties: {
              entity: {
                entity_type: "payroll_period" as const,
                entity_id: params.period_id,
              },
              data: {
                workspace_id: ctx.workspaceId,
                period_id: params.period_id,
                profile_id: f.profile_id,
                basis_amount: f.basisAmount,
                pct_applied: f.pctApplied,
                base_pay_total: f.basePay,
                channel: "system" as const,
              },
            },
          }),
        ),
      );
    }

    // Step 7 — Generate CSV via @smartout/payroll-export (pure, deterministic).
    const opts: ExportOptions = {
      variant: params.variant,
      includeUnmasked: params.include_unmasked,
      workspaceSlug,
      periodLabel,
      exportedAt,
    };

    const csv = generateCsv(csvRows, opts);

    if (!csv) {
      return JSON.stringify({
        ok: false,
        reason: "empty_csv",
        detail: "Ingen rader å eksportere.",
      });
    }

    const filename = generateFilename(opts);
    const fileHash = computeFileHash(csv);
    const rowCount = csvRows.length;

    // Step 8 — INSERT payroll.export_event (Bokføringsloven §13 audit trail).
    // idempotency_key = {period_id}-{variant}-{isoTimestamp} (unique per export attempt).
    const idempotencyKey = `${params.period_id}-${params.variant}-${exportedAt.toISOString()}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: exportEvent, error: exportErr } = await (supabase.schema("payroll") as any)
      .from("export_event")
      .insert({
        workspace_id: ctx.workspaceId,
        period_id: params.period_id,
        exported_by: ctx.profileId,
        export_format: "csv",
        status: "completed",
        started_at: exportedAt.toISOString(),
        completed_at: new Date().toISOString(),
        variant: params.variant,
        masked: !params.include_unmasked,
        file_hash: fileHash,
        idempotency_key: idempotencyKey,
        row_count: rowCount,
      })
      .select("id")
      .single();

    if (exportErr || !exportEvent) {
      // Idempotency violation returns 23505 unique-constraint error — surface clearly.
      const isIdempotencyConflict = exportErr?.code === "23505";
      return JSON.stringify({
        ok: false,
        reason: isIdempotencyConflict ? "duplicate_export" : "db_write_failed",
        detail: exportErr?.message ?? "kunne ikke opprette eksportevent",
      });
    }

    // Step 9 — Emit telemetry (ADR-0134).
    // Always emit payroll.csv_exported.
    // Additionally emit payroll.csv_export_unmasked when PII is included (high-PII audit).
    await emit({
      event: "payroll.csv_exported",
      workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
      actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
      properties: {
        entity: { entity_type: "payroll_export_event" as const, entity_id: exportEvent.id },
        data: {
          export_event_id: exportEvent.id,
          period_id: params.period_id,
          variant: params.variant,
          masked: !params.include_unmasked,
          row_count: rowCount,
        },
      },
    });

    if (params.include_unmasked) {
      await emit({
        event: "payroll.csv_export_unmasked",
        workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
        actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
        properties: {
          entity: { entity_type: "payroll_export_event" as const, entity_id: exportEvent.id },
          data: {
            export_event_id: exportEvent.id,
            period_id: params.period_id,
            variant: params.variant,
            row_count: rowCount,
          },
        },
      });
    }

    // Step 10 — Return CSV bytes + filename + event ID for BFF stream route.
    return JSON.stringify({
      ok: true,
      export_event_id: exportEvent.id,
      filename,
      csv, // BFF route streams this directly; chat surface can signal download ready
      row_count: rowCount,
      masked: !params.include_unmasked,
    });
  },
});

// ── delete_manual_supplement ──────────────────────────────────────────────────
// Manager/Admin: delete a manual supplement from an open period.
// Pattern B sync-chain via BFF route — recalculate-period called after delete.
export const deleteManualSupplement = defineTool({
  name: "delete_manual_supplement",
  description:
    "Delete a manual pay supplement that was added to a shift. Period must be open. " +
    "Manager or Admin only. Requires the supplement_id (UUID). " +
    "Payroll totals are recalculated immediately after deletion.",
  schema: z.object({
    supplement_id: z.string().uuid().describe("UUID of the manual_supplement row to delete"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);
    const chGuard = assertChatChannel(channel);
    if (chGuard.denied) return chGuard.msg;

    const supabase = ctx.supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "delete_manual_supplement",
      entityId: params.supplement_id,
    });
    if (!gate.allow) return `Ikke tillatt: ${gate.reason ?? "ingen tilgang"}`;

    // Verify supplement belongs to workspace before delete (L-0177).
    const { data: sup, error: supErr } = await supabase
      .schema("payroll")
      .from("manual_supplement")
      .select("id, workspace_id, amount, salary_code, schedule_shift_id")
      .eq("id", params.supplement_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (supErr || !sup) return "Tillegg ikke funnet i dette arbeidsområdet.";

    // Verify the shift's period is still open (L-0177).
    const { data: shift } = await supabase
      .from("schedule_shift")
      .select("start_time")
      .eq("schedule_shift_id", sup.schedule_shift_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (shift) {
      const shiftDate = shift.start_time.slice(0, 10);
      const { data: period } = await supabase
        .schema("payroll")
        .from("period")
        .select("id, status")
        .eq("workspace_id", ctx.workspaceId)
        .lte("start_date", shiftDate)
        .gte("end_date", shiftDate)
        .maybeSingle();

      if (period && (period.status === "locked" || period.status === "approved")) {
        return `Kan ikke slette tillegg: Perioden er ${period.status}.`;
      }
    }

    // Delete the supplement (DB trigger fires DELETE event automatically).
    const { error: deleteErr } = await supabase
      .schema("payroll")
      .from("manual_supplement")
      .delete()
      .eq("id", params.supplement_id)
      .eq("workspace_id", ctx.workspaceId);

    if (deleteErr) return `Feil ved sletting: ${deleteErr.message}`;

    await emit({
      event: "payroll.manual_supplement_deleted",
      workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
      actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
      properties: {
        entity: { entity_type: "shift" as const, entity_id: sup.schedule_shift_id },
        data: {
          supplement_id: sup.id,
          period_id: "",
          target_profile_id: ctx.profileId,
          shift_id: sup.schedule_shift_id,
          salary_code: sup.salary_code ?? null,
          amount: Number(sup.amount),
          gate_evaluation_id: gate.gateEvaluationId,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      supplement_id: sup.id,
      note: "Tillegg slettet. Lønnsberegningen oppdateres automatisk.",
    });
  },
});

// ── view_lonnsgrunnlag ─────────────────────────────────────────────────────────
// Phase 4 Wave B (T3.2, ADR-0294).
// Employee self-service + admin: fetch a signed URL for a previously generated
// PDF lønnsgrunnlag from the payroll-lonnsgrunnlag storage bucket.
//
// Body compliance verified before docstring (L-0176):
//   ADR-0078  — chat-only guard (assertChatChannel, first guard)
//   ADR-0099  — callGateAction before any DB access (read still gated; signed URLs are PII-bearing)
//   ADR-0151  — workspace_id from ctx (server-derived), profileId from ctx; never from body
//   L-0177    — fail fast on export_event not found / wrong format / wrong workspace / wrong profile
//   ADR-0134  — emit() with non-empty workspace_id + actor_id
//   ADR-0240  — read-only, no cross-namespace writes
//   ADR-0294  — signed URL expiry: 3600s (employee) / 86400s (admin)

export const viewLonnsgrunnlag = defineTool({
  name: "view_lonnsgrunnlag",
  description:
    "Fetch a signed download URL for a previously generated PDF lønnsgrunnlag. " +
    "Employee: fetches own document (profile_id optional — defaults to caller). " +
    "Admin: must supply profile_id of the target employee. " +
    "URL expires in 1 hour (employee) or 24 hours (admin). Chat only. Read-only.",
  capability: CAPABILITY,
  schema: z.object({
    lonnsgrunnlag_id: z
      .string()
      .uuid()
      .describe("UUID of the payroll.export_event (the PDF bundle export event)."),
    profile_id: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Employee profile_id whose lønnsgrunnlag to fetch. " +
          "Admin: required. Employee: optional — defaults to own profile_id.",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // Step 1 — Chat-only guard (ADR-0078 Høy-PII).
    const channel = normaliseChannel(ctx.channel);
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({ ok: false, reason: "channel_forbidden", detail: channelCheck.msg });
    }

    // Step 2 — Authority gate before any DB access (ADR-0204, ADR-0099).
    const supabase = ctx.supabaseAdmin as import("@supabase/supabase-js").SupabaseClient;
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: CAPABILITY,
      channel,
      actionType: "view_lonnsgrunnlag",
      entityId: params.lonnsgrunnlag_id,
    });
    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        detail: gate.reason ?? "ingen tilgang",
      });
    }

    // Step 3 — Determine whether caller is admin.
    // Authority level 'suggest' or above → admin path. read_only → employee path.
    // We rely on the gate having already verified access; we use role from profile
    // to distinguish self-service vs cross-profile access.
    const { data: callerProfile } = await supabase
      .from("profile")
      .select("role")
      .eq("profile_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    const callerRole = (callerProfile as { role?: string } | null)?.role ?? "employee";
    const isAdmin = callerRole === "admin" || callerRole === "owner" || callerRole === "manager";

    // Step 4 — Resolve target profile_id (L-0177: fail fast, no silent fallback).
    let targetProfileId: string;
    if (isAdmin) {
      if (!params.profile_id) {
        return JSON.stringify({
          ok: false,
          reason: "profile_id_required",
          detail: "Admin må oppgi profile_id for å hente en ansatts lønnsgrunnlag.",
        });
      }
      // Verify target profile is in this workspace (ADR-0151 forgery defence).
      const { data: targetProfile } = await supabase
        .from("profile")
        .select("profile_id")
        .eq("profile_id", params.profile_id)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();

      if (!targetProfile) {
        return JSON.stringify({
          ok: false,
          reason: "profile_not_found",
          detail: "Ansattprofil ikke funnet i dette arbeidsområdet.",
        });
      }
      targetProfileId = params.profile_id;
    } else {
      // Employee: profile_id arg must equal own profile_id (or be omitted).
      if (params.profile_id && params.profile_id !== ctx.profileId) {
        return JSON.stringify({
          ok: false,
          reason: "access_denied",
          detail: "Du kan kun se ditt eget lønnsgrunnlag.",
        });
      }
      targetProfileId = ctx.profileId;
    }

    // Step 5 — Verify export_event in workspace + correct format (ADR-0151, L-0177).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: exportEvent, error: eventErr } = await (supabase.schema("payroll") as any)
      .from("export_event")
      .select("id, workspace_id, period_id, export_format")
      .eq("id", params.lonnsgrunnlag_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (eventErr || !exportEvent) {
      // L-0177: fail fast — no silent fallback.
      return JSON.stringify({
        ok: false,
        reason: "not_found",
        detail: "Lønnsgrunnlag-eksport ikke funnet i dette arbeidsområdet.",
      });
    }

    const ev = exportEvent as {
      id: string;
      workspace_id: string;
      period_id: string;
      export_format: string;
    };

    if (ev.export_format !== "pdf") {
      return JSON.stringify({
        ok: false,
        reason: "wrong_format",
        detail: `Eksporthendelseformatet er '${ev.export_format}' — kun PDF-eksporter støttes av denne verktøyet.`,
      });
    }

    // Step 6 — Construct storage path and generate signed URL.
    // Path convention: {workspace_id}/{period_id}/{profile_id}.pdf (ADR-0294).
    const storagePath = `${ctx.workspaceId}/${ev.period_id}/${targetProfileId}.pdf`;
    const expiresInSeconds = isAdmin ? 86400 : 3600;

    const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
      .from("payroll-lonnsgrunnlag")
      .createSignedUrl(storagePath, expiresInSeconds);

    if (signedUrlErr || !signedUrlData?.signedUrl) {
      return JSON.stringify({
        ok: false,
        reason: "signed_url_failed",
        detail: signedUrlErr?.message ?? "Kunne ikke generere nedlastingslenke.",
      });
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    // Step 7 — Emit high-PII audit event (ADR-0134). Every signed URL grant is audited.
    await emit({
      event: "payroll.lonnsgrunnlag_url_granted",
      workspace_id: ctx.workspaceId as import("@smartout/telemetry").NonEmptyString,
      actor_id: ctx.profileId as import("@smartout/telemetry").NonEmptyString,
      properties: {
        entity: {
          entity_type: "payroll_export_event" as const,
          entity_id: params.lonnsgrunnlag_id,
        },
        data: {
          export_event_id: params.lonnsgrunnlag_id,
          profile_id: targetProfileId,
          expires_in_seconds: expiresInSeconds,
          granted_to: isAdmin ? "admin" : "employee",
        },
      },
    });

    return JSON.stringify({
      ok: true,
      signed_url: signedUrlData.signedUrl,
      expires_at: expiresAt,
      profile_id: targetProfileId,
      period_id: ev.period_id,
    });
  },
});

// ─── Phase 7f tariff tools (delegated to cascade per ADR-0356) ───────────────
// Implemented in tariff-tools.ts to keep this file manageable.
// Three delegation tools: setup_workspace_tariff, change_workspace_tariff, add_supplement_override.
export {
  setupWorkspaceTariffTool,
  changeWorkspaceTariffTool,
  addSupplementOverrideTool,
} from "./tariff-tools.js";
