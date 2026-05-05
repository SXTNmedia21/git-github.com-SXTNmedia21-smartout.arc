/**
 * tips capability tools — Sortie 1 skeletons.
 *
 * Four tools for tip pool management:
 *   - tips.set_pot             (suggest/manager — record pool + calculate distribution)
 *   - tips.adjust_share        (confirm/manager — adjust a single employee share)
 *   - tips.approve_distribution (confirm/manager — lock pool + distributions)
 *   - tips.query_own_share     (read_only/employee — read own share)
 *
 * Sortie 1 scope: ALL tools return `{ ok: false, error: "not_implemented" }`.
 * Per ADR-0196 Invariant 11 (phantom-emit prevention): skeletons MUST NOT
 * emit *_started events without producing the declared artefact. Bodies land
 * in Sortie 2 (tips-leader-flows) and Sortie 3 (tips-employee-mobile).
 *
 * Binding ADRs: 0078 (chat-only PII-near), 0099 (gate mandatory),
 *               0196 (no phantom emit), 0201 (gate_action before mutation).
 */

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

// Dotted capability literals — one engine_authority_config row per tool.
const CAPABILITY_SET_POT = "tips.set_pot" as const;
const CAPABILITY_ADJUST_SHARE = "tips.adjust_share" as const;
const CAPABILITY_APPROVE_DISTRIBUTION = "tips.approve_distribution" as const;
const CAPABILITY_QUERY_OWN_SHARE = "tips.query_own_share" as const;

// ── tips.set_pot ─────────────────────────────────────────────────────────────
// Manager tool: record tip pool amount for a department session and calculate
// per-employee distribution. Default authority: suggest.
// Body lands in Sortie 2 (tips-leader-flows).
export const tipsSetPotTool = defineTool({
  name: "tips.set_pot",
  description:
    "Register tip pool amount for a department session and calculate distribution. Chat-only (ADR-0078).",
  capability: CAPABILITY_SET_POT,
  schema: z.object({
    department_session_id: z
      .string()
      .uuid()
      .describe("The department session to attach this tip pool to."),
    amount_nok: z.number().min(0).describe("Total tip amount in NOK."),
    notes: z.string().optional().describe("Optional leader notes for this pool."),
  }),
  execute: async (_params, _ctx: AgentToolContext): Promise<string> => {
    // Sortie 1 skeleton — no DB writes, no emit (ADR-0196 Invariant 11).
    return JSON.stringify({
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in Sortie 2 tips-leader-flows",
    });
  },
});

// ── tips.adjust_share ────────────────────────────────────────────────────────
// Manager tool: adjust a single tip distribution amount with required reason.
// Default authority: confirm. Requires reason ≥ 5 chars.
// Body lands in Sortie 2 (tips-leader-flows).
export const tipsAdjustShareTool = defineTool({
  name: "tips.adjust_share",
  description: "Adjust a single employee tip share with a mandatory reason. Chat-only (ADR-0078).",
  capability: CAPABILITY_ADJUST_SHARE,
  schema: z.object({
    distribution_id: z.string().uuid().describe("The tip_distribution row to adjust."),
    new_amount: z.number().min(0).describe("New amount in NOK."),
    reason: z.string().min(5).describe("Required reason (min 5 chars) — shown to employee."),
  }),
  execute: async (_params, _ctx: AgentToolContext): Promise<string> => {
    return JSON.stringify({
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in Sortie 2 tips-leader-flows",
    });
  },
});

// ── tips.approve_distribution ────────────────────────────────────────────────
// Manager tool: approve a tip pool, locking distributions.
// Default authority: confirm. Triggers approval-time side-effects in Sortie 2.
// Body lands in Sortie 2 (tips-leader-flows).
export const tipsApproveDistributionTool = defineTool({
  name: "tips.approve_distribution",
  description:
    "Approve a tip pool — locks all distributions and makes them visible to employees. Chat-only (ADR-0078).",
  capability: CAPABILITY_APPROVE_DISTRIBUTION,
  schema: z.object({
    pool_id: z.string().uuid().describe("The tip_pool to approve."),
  }),
  execute: async (_params, _ctx: AgentToolContext): Promise<string> => {
    return JSON.stringify({
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in Sortie 2 tips-leader-flows",
    });
  },
});

// ── tips.query_own_share ─────────────────────────────────────────────────────
// Employee tool: read own tip distributions for a date range.
// Default authority: read_only. "read_only" does NOT mean skip the gate
// (L-0066 / L-0097 — gate row is the CVE safety line).
// Body lands in Sortie 3 (tips-employee-mobile).
export const tipsQueryOwnShareTool = defineTool({
  name: "tips.query_own_share",
  description: "Read your own tip distributions for a date range. Chat-only (ADR-0078).",
  capability: CAPABILITY_QUERY_OWN_SHARE,
  schema: z.object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Start date (YYYY-MM-DD, inclusive)."),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("End date (YYYY-MM-DD, inclusive)."),
  }),
  execute: async (_params, _ctx: AgentToolContext): Promise<string> => {
    return JSON.stringify({
      ok: false as const,
      error: "not_implemented",
      note: "Skeleton — body lands in Sortie 3 tips-employee-mobile",
    });
  },
});
