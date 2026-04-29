/**
 * Payroll capability tools (ADR-0234).
 *
 * Six skeleton tools covering Høy-PII payroll operations:
 *   - update_payroll_profile  (mutation, admin-only)
 *   - query_tax_card          (read, admin or self)
 *   - set_pension_scheme      (mutation, admin)
 *   - view_personal_number    (read, admin or self — PLACEHOLDER; RevealableField wiring Phase 0c)
 *   - view_bank_account       (read, admin or self — PLACEHOLDER; RevealableField wiring Phase 0c)
 *   - salary_query            (read — PLACEHOLDER; Phase 0c shift_pay_calculation integration)
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
 * view_personal_number + view_bank_account are Phase 0c placeholders. They return a
 * masked indicator only — actual PII reveal with RevealableField audit-emit is Phase 0c.
 *
 * salary_query is a Phase 0c placeholder — returns stub data until shift_pay_calculation
 * integration (Phase 5) is complete.
 */

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";

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
    "Update an employee's payroll profile (base salary, payroll system ID, payment method). Admin only. Chat channel only. Requires confirmation before write.",
  capability: CAPABILITY,
  schema: z.object({
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

    void emit({
      event: "payroll.update_payroll_profile",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
        data: {
          target_profile_id: params.profile_id,
          fields_updated: Object.keys(updates).filter((k) => k !== "updated_at"),
          gate_evaluation_id: gate.gateEvaluationId ?? null,
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
      .select("tax_card_type, withholding_percentage, tax_municipality_code")
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
      withholding_percentage: data.withholding_percentage ?? null,
      tax_municipality_code: data.tax_municipality_code ?? null,
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
// PLACEHOLDER (Phase 0c). Returns masked indicator only.
// Actual PII reveal with RevealableField + audit-emit is Phase 0c.

export const viewPersonalNumber = defineTool({
  name: "view_personal_number",
  description:
    "Check whether an employee has a personal number (fødselsnummer) on file. Returns only a presence indicator — NEVER the actual number. Full PII reveal is Phase 0c only. Admin or self. Chat only.",
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

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        detail: gate.reason ?? "denied",
      });
    }

    // Verify workspace membership (ADR-0151).
    const { data, error } = await ctx.supabaseAdmin
      .from("employee_payroll_profile")
      .select("id")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .not("personal_id_number", "is", null)
      .single();

    void emit({
      event: "contract.pii.revealed",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
        data: {
          pii_field: "personal_id_number",
          revealed: false, // Phase 0c — placeholder; no actual reveal
          target_profile_id: params.profile_id,
          is_self: params.profile_id === ctx.profileId,
        },
      },
    });

    if (error || !data) {
      return JSON.stringify({ ok: true, has_personal_number: false });
    }
    return JSON.stringify({
      ok: true,
      has_personal_number: true,
      note: "Full fødselsnummer-visning er ikke tilgjengelig via Botsson (Phase 0c). Kontakt admin.",
    });
  },
});

// ── view_bank_account ───────────────────────────────────────────────────────
// PLACEHOLDER (Phase 0c). Returns masked indicator only.

export const viewBankAccount = defineTool({
  name: "view_bank_account",
  description:
    "Check whether an employee has a bank account on file. Returns only a presence indicator — NEVER the full account number. Full PII reveal is Phase 0c. Admin or self. Chat only.",
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

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        reason: "authority_denied",
        detail: gate.reason ?? "denied",
      });
    }

    // Verify workspace membership (ADR-0151).
    const { data, error } = await ctx.supabaseAdmin
      .from("employee_payroll_profile")
      .select("id")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .not("bank_account_number", "is", null)
      .single();

    void emit({
      event: "contract.pii.revealed",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
        data: {
          pii_field: "bank_account_number",
          revealed: false, // Phase 0c placeholder
          target_profile_id: params.profile_id,
          is_self: params.profile_id === ctx.profileId,
        },
      },
    });

    if (error || !data) {
      return JSON.stringify({ ok: true, has_bank_account: false });
    }
    return JSON.stringify({
      ok: true,
      has_bank_account: true,
      note: "Full kontonummer-visning er ikke tilgjengelig via Botsson (Phase 0c). Kontakt admin.",
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
