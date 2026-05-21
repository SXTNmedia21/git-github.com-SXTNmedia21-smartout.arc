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
 *
 * ADR-0379a (A3): `list_mandatory_protocols_for_role` names the runtime
 * reader for the `profession_training` spine so I1 role→protocol data is
 * not phantom knowledge. Read-only. Zero behavior change to `check_readiness`.
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
  capability: "governance",
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

// ── ADR-0379a (A3) ───────────────────────────────────────────────────────────
// Read the `profession_training` spine (revived by ADR-0379a) to surface the
// mandatory protocols for a given role slug.
//
// Resolution strategy (workspace-preferring platform fallback):
//   1. Resolve `profession` by slug within the caller's workspace
//      (`workspace_id = ctx.workspaceId`).
//   2. If not found, fall back to platform rows (`workspace_id IS NULL`).
//   3. Select all `profession_training` rows where `is_required = true` for
//      the resolved `profession_id`, joined to `protocol` for the name.
//
// This tool is read-only; it does NOT call gate_action (ADR-0099).
// Workspace is always taken from `ctx.workspaceId` — never from a body field
// (ADR-0151 / L-0177 forgeable-ID class).
// Edge cases:
//   - Unknown `role_slug` → returns empty `mandatory_protocols: []` (NOT an error).
//   - No required rows → empty `mandatory_protocols: []`.
// ─────────────────────────────────────────────────────────────────────────────

type ProfessionRow = { profession_id: string; name: string };

type ProfessionTrainingRow = {
  protocol_id: string;
  protocol: { protocol_id: string; name: string } | null;
};

export const listMandatoryProtocolsForRole = defineTool({
  name: "list_mandatory_protocols_for_role",
  description:
    "Return the mandatory protocols a role must complete, sourced from the profession_training spine (ADR-0379a). Read-only — does not mutate. Unknown role slug returns an empty list, not an error.",
  capability: "governance",
  schema: z
    .object({
      role_slug: z
        .string()
        .min(1)
        .max(100)
        .describe(
          "The role slug to look up (e.g. 'bartender', 'kokk'). Matched against profession.slug.",
        ),
    })
    .strict(),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // Step 1: workspace-scoped profession lookup.
    const { data: wsProfession, error: wsErr } = await supabase
      .from("profession")
      .select("profession_id, name")
      .eq("workspace_id", ctx.workspaceId)
      .eq("slug", params.role_slug)
      .maybeSingle();

    if (wsErr) return `Error resolving role: ${wsErr.message}`;

    // Step 2: platform fallback (workspace_id IS NULL).
    let profession: ProfessionRow | null = wsProfession as ProfessionRow | null;
    if (!profession) {
      const { data: platformProfession, error: platformErr } = await supabase
        .from("profession")
        .select("profession_id, name")
        .is("workspace_id", null)
        .eq("slug", params.role_slug)
        .maybeSingle();

      if (platformErr) return `Error resolving platform role: ${platformErr.message}`;
      profession = platformProfession as ProfessionRow | null;
    }

    // Unknown role slug → empty list (not an error per ADR-0379a A3 contract).
    if (!profession) {
      return JSON.stringify({
        role_slug: params.role_slug,
        profession_name: null,
        mandatory_protocols: [],
      });
    }

    // Step 3: select required profession_training rows, join protocol for name.
    const { data: trainingRows, error: trainingErr } = await supabase
      .from("profession_training")
      .select("protocol_id, protocol:protocol_id(protocol_id, name)")
      .eq("profession_id", profession.profession_id)
      .eq("is_required", true);

    if (trainingErr) return `Error loading mandatory protocols: ${trainingErr.message}`;

    const rows = (trainingRows ?? []) as unknown as ProfessionTrainingRow[];

    const mandatoryProtocols = rows
      .filter((r) => r.protocol !== null)
      .map((r) => ({
        protocol_id: r.protocol_id,
        // r.protocol is guaranteed non-null by the filter above.
        name: r.protocol!.name,
      }));

    return JSON.stringify({
      role_slug: params.role_slug,
      profession_name: profession.name,
      mandatory_protocols: mandatoryProtocols,
    });
  },
});
