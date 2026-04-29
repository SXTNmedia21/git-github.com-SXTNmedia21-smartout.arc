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
// PLACEHOLDER (Phase 0c / Phase 5). Returns stub data until
// shift_pay_calculation integration is complete.

export const salaryQuery = defineTool({
  name: "salary_query",
  description:
    "Query salary information for an employee — base rate, latest payslip summary. Read-only. Admin or self. Chat only. Note: shift-pay calculation details are Phase 0c.",
  capability: CAPABILITY,
  schema: z.object({
    profile_id: z.string().uuid().describe("The employee profile_id."),
    period_month: z
      .string()
      .optional()
      .describe("ISO month (YYYY-MM) to query. Defaults to current month."),
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

    // Verify workspace membership (ADR-0151).
    const { data, error } = await ctx.supabaseAdmin
      .from("employee_payroll_profile")
      .select("monthly_salary, hourly_rate, remuneration_type, currency")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (error || !data) {
      return JSON.stringify({ ok: false, reason: "not_found" });
    }

    void emit({
      event: "payroll.salary_queried",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "employment_contract" as const, entity_id: params.profile_id },
        data: {
          target_profile_id: params.profile_id,
          period_month: params.period_month ?? null,
          is_self: params.profile_id === ctx.profileId,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      monthly_salary: data.monthly_salary ?? null,
      hourly_rate: data.hourly_rate ?? null,
      remuneration_type: data.remuneration_type ?? null,
      currency: data.currency ?? "NOK",
      shift_pay_detail: "Detaljert skiftlønnsberegning er tilgjengelig i Phase 0c.",
    });
  },
});
