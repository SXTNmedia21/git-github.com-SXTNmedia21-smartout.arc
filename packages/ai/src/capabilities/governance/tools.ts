/**
 * Governance capability tools.
 *
 * Phase 5 (ADR-0095): exposes read-only readiness checks used by
 * `shift_lifecycle.publish` and `shift_lifecycle.approve` to verify that
 * an employee has completed their assigned policies/protocols before a
 * Decision-layer mutation (ADR-0095 Decision layer) is issued.
 *
 * Readiness is derived from `protocol_assignment` rows per profile.
 * `policy_assignment` does not exist as a standalone table — policies
 * are inherited via `protocol.policy_id`. `missing_policies` is derived
 * from the distinct policy_ids whose protocols are not yet completed.
 *
 * This tool is read-only; it does NOT call gate_action.
 */

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

type ProtocolAssignmentRow = {
  assignment_id: string;
  protocol_id: string;
  status: "pending" | "completed" | "expired";
  completed_at: string | null;
  assigned_at: string;
  protocol?: { protocol_id: string; policy_id: string | null } | null;
};

export const checkReadiness = defineTool({
  name: "check_readiness",
  description:
    "Check whether a profile is ready (all assigned protocols completed). Returns missing policy/protocol IDs and the most recent attempt timestamp. Read-only — does not mutate.",
  schema: z.object({
    profile_id: z.string().uuid().describe("Profile to check readiness for"),
    requirement_set_id: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Optional requirement-set scope. If omitted, checks all active protocol assignments.",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // Verify profile belongs to the workspace.
    const { data: profile, error: profileErr } = await supabase
      .from("profile")
      .select("profile_id, workspace_id")
      .eq("profile_id", params.profile_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (profileErr) return `Error loading profile: ${profileErr.message}`;
    if (!profile) return "Profile not found in workspace.";

    // Pull assignments joined to their protocol (for policy_id derivation).
    // requirement_set_id is forwarded as a filter if it matches a protocol
    // column — today no such table exists, so we treat it as a no-op filter.
    const { data, error } = await supabase
      .from("protocol_assignment")
      .select(
        "assignment_id, protocol_id, status, completed_at, assigned_at, protocol:protocol_id(protocol_id, policy_id)",
      )
      .eq("profile_id", params.profile_id);

    if (error) return `Error loading assignments: ${error.message}`;

    const rows = (data ?? []) as unknown as ProtocolAssignmentRow[];

    const missingProtocols: string[] = [];
    const missingPolicies = new Set<string>();
    let lastAttemptAt: string | null = null;

    for (const row of rows) {
      if (row.status !== "completed") {
        missingProtocols.push(row.protocol_id);
        const policyId = row.protocol?.policy_id ?? null;
        if (policyId) missingPolicies.add(policyId);
      }
      const candidate = row.completed_at ?? row.assigned_at;
      if (candidate && (!lastAttemptAt || candidate > lastAttemptAt)) {
        lastAttemptAt = candidate;
      }
    }

    const ready = missingProtocols.length === 0 && rows.length > 0;

    return JSON.stringify({
      ready,
      missing_policies: Array.from(missingPolicies),
      missing_protocols: missingProtocols,
      last_attempt_at: lastAttemptAt,
    });
  },
});
