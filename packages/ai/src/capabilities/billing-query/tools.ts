// packages/ai/src/capabilities/billing-query/tools.ts
//
// Read-only billing tools for the Smartout agent. Phase 11 of
// Billing Engine Fase 1. Every tool follows the pattern:
//
//   1. (Optional) channel guard — hard-reject when ctx.channel is
//      anything other than 'chat'. Billing is chat-only per ADR-0078
//      + the capability's allowedChannels config. This is belt-and-
//      suspenders; the selector also gates.
//   2. resolveCompanyId(ctx) — anchors on the caller's company.
//      This call throws on missing workspace linkage (see helper
//      JSDoc for upstream membership-check caveat).
//   3. Scope check on any row-level input (invoice_id) — verify the
//      target row belongs to the same company before reading detail.
//   4. Return stringified JSON for the LLM to narrate. Never compute
//      or re-derive amounts — the database holds truth.

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defineTool } from "../../types.js";
import { resolveCompanyId } from "../../lib/resolveCompanyId.js";
import type { AgentToolContext } from "../types.js";

function requireChatChannel(ctx: AgentToolContext): string | null {
  if (ctx.channel && ctx.channel !== "chat") {
    return "Error: billing tools are chat-only. Please ask this question via chat.";
  }
  return null;
}

export const listMyInvoices = defineTool({
  name: "list_my_invoices",
  description: "List recent invoices for the viewer's company. Sorted newest first. Read-only.",
  capability: "billing_query",
  schema: z.object({
    limit: z.number().int().min(1).max(50).default(10),
    status: z
      .enum(["draft", "issued", "sent", "paid", "overdue", "void", "uncollectible"])
      .optional(),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channelError = requireChatChannel(ctx);
    if (channelError) return channelError;

    const companyId = await resolveCompanyId(ctx);
    const supabase = ctx.supabaseAdmin as SupabaseClient;
    let query = supabase
      .from("invoice")
      .select(
        "invoice_id, invoice_number, period_from, period_to, amount_incl_vat, status, dunning_status, due_at",
      )
      .eq("company_id", companyId)
      .order("issued_at", { ascending: false, nullsFirst: true })
      .limit(params.limit);
    if (params.status) {
      query = query.eq("status", params.status);
    }
    const { data, error } = await query;
    if (error) return `Error: ${error.message}`;
    return JSON.stringify(data ?? []);
  },
});

export const getMyInvoice = defineTool({
  name: "get_my_invoice",
  description:
    "Fetch header + line items for a specific invoice belonging to the viewer's company.",
  capability: "billing_query",
  schema: z.object({
    invoice_id: z.string().uuid(),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channelError = requireChatChannel(ctx);
    if (channelError) return channelError;

    const companyId = await resolveCompanyId(ctx);
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    const { data: invoice, error } = await supabase
      .from("invoice")
      .select("*")
      .eq("invoice_id", params.invoice_id)
      .maybeSingle();

    if (error) return `Error: ${error.message}`;
    if (!invoice) return "Invoice not found.";
    if (invoice.company_id !== companyId) {
      return "Invoice does not belong to your company.";
    }

    const { data: lineItems } = await supabase
      .from("invoice_line_item")
      .select("*")
      .eq("invoice_id", invoice.invoice_id);

    return JSON.stringify({ invoice, line_items: lineItems ?? [] });
  },
});

export const explainInvoiceBasis = defineTool({
  name: "explain_invoice_basis",
  description:
    "Explain the basis for an invoice amount (line items + usage snapshots + pricing terms at issue). Reads get_invoice_basis RPC verbatim — the LLM narrates, never computes. Refuses drafts (not yet finalised).",
  capability: "billing_query",
  schema: z.object({
    invoice_id: z.string().uuid(),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channelError = requireChatChannel(ctx);
    if (channelError) return channelError;

    const companyId = await resolveCompanyId(ctx);
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Scope + state check before the heavier RPC.
    const { data: invoice, error: invErr } = await supabase
      .from("invoice")
      .select("invoice_id, company_id, status")
      .eq("invoice_id", params.invoice_id)
      .maybeSingle();

    if (invErr) return `Error: ${invErr.message}`;
    if (!invoice) return "Invoice not found.";
    if (invoice.company_id !== companyId) {
      return "Invoice does not belong to your company.";
    }
    if (invoice.status === "draft") {
      return "This invoice is still a draft — no final basis to explain yet.";
    }

    const { data, error } = await supabase.rpc("get_invoice_basis", {
      p_invoice_id: params.invoice_id,
    });

    if (error) return `Error: ${error.message}`;
    return JSON.stringify(data ?? null);
  },
});

export const listOverdue = defineTool({
  name: "list_overdue_invoices",
  description:
    "List the viewer's invoices currently marked as overdue (past due_at). Includes days_overdue for each row.",
  capability: "billing_query",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const channelError = requireChatChannel(ctx);
    if (channelError) return channelError;

    const companyId = await resolveCompanyId(ctx);
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    const { data, error } = await supabase
      .from("invoice")
      .select(
        "invoice_id, invoice_number, period_from, period_to, amount_incl_vat, due_at, dunning_status",
      )
      .eq("company_id", companyId)
      .eq("status", "overdue")
      .order("due_at", { ascending: true });

    if (error) return `Error: ${error.message}`;

    const today = Date.now();
    const enriched = (data ?? []).map((inv) => {
      const dueMs = inv.due_at ? new Date(inv.due_at).getTime() : today;
      const days_overdue = Math.max(0, Math.floor((today - dueMs) / (24 * 60 * 60 * 1000)));
      return { ...inv, days_overdue };
    });

    return JSON.stringify(enriched);
  },
});

/**
 * Sanitise an email to "a***@example.com" for LLM narration. Fase 2 Trust
 * Gate: dispatch rows carry the full recipient in `target` (audit fidelity),
 * but the LLM only needs enough to say "yes, we sent it to you (a***@…)."
 * Non-email targets are passed through unchanged — platform-admin UI is
 * the place for full PII.
 */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const masked = local.length <= 1 ? "***" : `${local[0]}***`;
  return `${masked}${domain}`;
}

function sanitiseTarget(target: unknown): unknown {
  if (!target || typeof target !== "object") return target;
  const t = target as Record<string, unknown>;
  const clone: Record<string, unknown> = { ...t };
  if (typeof clone.email === "string") clone.email = maskEmail(clone.email);
  if (typeof clone.to === "string") clone.to = maskEmail(clone.to);
  return clone;
}

export const listInvoiceDispatches = defineTool({
  name: "list_invoice_dispatches",
  description:
    "Se hvilke kanaler en faktura ble sendt på (email, API, etc.) og om leveringen lyktes. Returnerer leveranser fra Fase 2 (2026-04-17+). Fakturaer fra før dette kan vise tom liste — sjekk `invoice.delivery_status` for historikk.",
  capability: "billing_query",
  schema: z.object({
    invoice_id: z.string().uuid(),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channelError = requireChatChannel(ctx);
    if (channelError) return channelError;

    const companyId = await resolveCompanyId(ctx);
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Scope check first — never leak "exists but not yours".
    const { data: invoice, error: invErr } = await supabase
      .from("invoice")
      .select("invoice_id, company_id")
      .eq("invoice_id", params.invoice_id)
      .maybeSingle();

    if (invErr) return `Error: ${invErr.message}`;
    if (!invoice) return "Invoice not found.";
    if (invoice.company_id !== companyId) {
      return "Invoice does not belong to your company.";
    }

    const { data, error } = await supabase
      .from("invoice_dispatch")
      .select(
        "channel, target, status, attempts, last_attempt_at, delivered_at, error_code, error_message, external_reference, created_at",
      )
      .eq("invoice_id", params.invoice_id)
      .order("created_at", { ascending: false });

    if (error) return `Error: ${error.message}`;

    // Mask recipient PII before handing to the LLM. Audit UI keeps the full
    // target; the agent only narrates "sent to a***@example.com".
    const sanitised = (data ?? []).map((row) => ({
      ...row,
      target: sanitiseTarget(row.target),
    }));

    return JSON.stringify(sanitised);
  },
});

export const getUsageSnapshot = defineTool({
  name: "get_usage_snapshot",
  description:
    "Fetch the frozen usage snapshot (active users + billable users + counted_profile_ids) for a billing period. Read-only.",
  capability: "billing_query",
  schema: z.object({
    workspace_id: z.string().uuid(),
    period_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
    period_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const channelError = requireChatChannel(ctx);
    if (channelError) return channelError;

    const companyId = await resolveCompanyId(ctx);
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    const { data, error } = await supabase
      .from("usage_snapshot")
      .select("*")
      .eq("company_id", companyId)
      .eq("workspace_id", params.workspace_id)
      .eq("period_from", params.period_from)
      .eq("period_to", params.period_to)
      .maybeSingle();

    if (error) return `Error: ${error.message}`;
    if (!data) return "No snapshot found for this workspace + period.";
    return JSON.stringify(data);
  },
});
