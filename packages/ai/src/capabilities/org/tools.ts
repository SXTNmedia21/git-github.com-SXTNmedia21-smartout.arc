/**
 * Org capability tools — ADR-0367 BT2.
 *
 * One tool: update_dept_areas — links or unlinks department_location records.
 *
 * Own namespace write — no cross-namespace delegation needed (department_location
 * is within the org namespace; not owned by schedule, cascade, or any frozen-4 sibling).
 *
 * Authority: confirm, admin+, chat-only V1.
 *   Gate: org.update_dept_areas (single gate per ADR-0099).
 *
 * Channel: chat-only. Voice rejected at tool body (ADR-0078, admin org-structure operations
 * carry implicit location PII via department_id linking).
 *
 * Cross-workspace guard (L-0177):
 *   Tool verifies department.workspace_id === ctx.workspaceId before any write.
 *   Fail-fast on mismatch — no silent fallback to JWT-default workspace.
 *
 * Duplicate-key handling on "add":
 *   INSERT ON CONFLICT DO NOTHING pattern — idempotent at DB layer.
 *   Returns success even when the pair already exists (no 409 error surface).
 *
 * Emit: org.dept_areas_updated (once per call — 3 destinations per telemetry registry).
 */

import { z } from "zod";
import { emit, nonEmpty } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gateOrgAction } from "./gate.js";

const CAPABILITY = "org" as const;

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

// ─────────────────────────────────────────────────────────────────────────────
// Tool — org.update_dept_areas
// Channel: CHAT-ONLY (ADR-0078 — admin org-structure operation)
// Gate: org.update_dept_areas, confirm, admin+
// Writes to: department_location (own namespace — no delegation needed)
// ─────────────────────────────────────────────────────────────────────────────

export const updateDeptAreas = defineTool({
  name: "update_dept_areas",
  description:
    "Kobler eller avkobler en avdeling fra en lokasjon (department_location). " +
    "Bruk når en administrator sier 'legg til avdeling X på lokasjon Y', " +
    "'fjern avdeling fra lokasjonen', 'endre avdelingslokasjoner'. " +
    "Krever admin+ tilgangsnivå. Kun tilgjengelig i chat (ikke stemme) — V1 kanal-policy. " +
    "action='add' er idempotent (duplikat ignoreres). action='remove' fjerner koblingen.",
  capability: CAPABILITY,
  schema: z
    .object({
      department_id: z.string().uuid().describe("UUID for avdelingen som skal kobles/avkobles."),
      location_id: z.string().uuid().describe("UUID for lokasjonen å knytte avdelingen til."),
      action: z.enum(["add", "remove"]).describe("'add' kobler, 'remove' avkobler."),
    })
    .strict(),
  execute: async (params, ctx: AgentToolContext) => {
    // Channel guard (ADR-0078): chat-only in V1.
    const channel = normaliseChannel(ctx.channel);
    if (channel === "voice") {
      return "Av sikkerhetshensyn kan org-strukturendringer bare utføres i chat, ikke via stemme (V1-policy).";
    }

    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Step 1 — verify department belongs to this workspace (L-0177, ADR-0151).
    // Fail-fast: no silent fallback to JWT-default workspace on row-not-found.
    const { data: dept, error: deptError } = await supabase
      .from("department")
      .select("id, workspace_id")
      .eq("id", params.department_id)
      .maybeSingle();

    if (deptError) {
      return JSON.stringify({
        ok: false,
        error: `department lookup failed: ${deptError.message}`,
      });
    }
    if (!dept) {
      return JSON.stringify({ ok: false, error: "department_not_found" });
    }
    if (dept.workspace_id !== ctx.workspaceId) {
      return JSON.stringify({ ok: false, error: "department_wrong_workspace" });
    }

    // Step 2 — C4 authority gate (ADR-0099 / ADR-0287).
    const gate = await gateOrgAction(supabase, ctx.workspaceId, ctx.profileId, {
      actionType: `${CAPABILITY}.update_dept_areas`,
      channel,
      entityId: params.department_id,
    });
    if (!gate.allow) {
      return JSON.stringify({ ok: false, error: gate.reason ?? "ikke_tillatt" });
    }

    // Step 3 — perform the add or remove operation.
    if (params.action === "add") {
      // Idempotent insert — ignore duplicate-key errors (pair already exists = success).
      const { error: insertError } = await supabase.from("department_location").upsert(
        {
          department_id: params.department_id,
          location_id: params.location_id,
          workspace_id: ctx.workspaceId,
        },
        { onConflict: "department_id,location_id", ignoreDuplicates: true },
      );

      if (insertError) {
        return JSON.stringify({ ok: false, error: insertError.message });
      }
    } else {
      // Remove the matching pair — workspace_id scope enforces ADR-0099 Law 1.
      const { error: deleteError } = await supabase
        .from("department_location")
        .delete()
        .eq("department_id", params.department_id)
        .eq("location_id", params.location_id)
        .eq("workspace_id", ctx.workspaceId);

      if (deleteError) {
        return JSON.stringify({ ok: false, error: deleteError.message });
      }
    }

    // Step 4 — emit org.dept_areas_updated (3 destinations per telemetry registry).
    await emit({
      event: "org.dept_areas_updated",
      workspace_id: nonEmpty(ctx.workspaceId, "workspace_id"),
      actor_id: nonEmpty(ctx.profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "department",
          entity_id: params.department_id,
        },
        data: {
          department_id: params.department_id,
          location_id: params.location_id,
          action: params.action,
        },
      },
    });

    return JSON.stringify({ ok: true, action: params.action });
  },
});
