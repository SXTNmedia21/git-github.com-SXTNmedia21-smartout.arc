"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { publishMissionTool } from "@smartout/ai/capabilities/journey";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import { resolveAdminProfile, assertPlatformAdmin } from "./_shared";
import { gateAction } from "@/app/dashboard/_actions/_shared";
import { transitionJourneyVersionStatusAction } from "./transition-status";

/**
 * publishMissionAction — Server Action invoking the `journey.publish_mission`
 * capability (ADR-0173 / ADR-0176). This is the single web authoring
 * entry-point for publishing a journey-version as a runtime mission.
 *
 * Actor resolution: admin session JWT → profile join (see
 * ./_shared.ts::resolveAdminProfile + ADR-0176 appendix §Dev + Publish).
 * The capability body runs its own ADR-0134 non-empty guard as defense-in-
 * depth — this action already refuses to proceed if the profile is null.
 *
 * Authority: `assertPlatformAdmin()` is the OUTER auth gate (godmode only).
 * `gate_action` is the inner C4 governance gate (ADR-0099 / ADR-0176) — it
 * honours workspace-level `engine_authority_config` disables + role floors
 * seeded per capability. Both must pass; admin bypass via `is_godmode` is
 * NOT a substitute for the C4 layer (code-reviewer finding 2026-04-22).
 *
 * On success the action also transitions the row from `ready_publish` to
 * `published` (the capability emits `journey run_started` but does NOT
 * update journey_version.status — that's the authoring concern). The
 * transition is refused if the capability is still an S1.4 skeleton —
 * see the stub detection below (code-reviewer Finding 2, M5 ghost-publish).
 */
const InputSchema = z.object({
  journeyVersionId: z.string().uuid(),
});

export type PublishMissionResult = { ok: true; runId: string } | { ok: false; error: string };

export async function publishMissionAction(
  input: z.infer<typeof InputSchema>,
): Promise<PublishMissionResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const profile = await resolveAdminProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };
  if (!(await assertPlatformAdmin(profile.userId))) {
    return { ok: false, error: "Platform-admin required." };
  }

  const admin = createAdminClient();

  // Pre-flight: must be in `ready_publish` to publish. We explicitly do NOT
  // require `published` already — the capability is responsible for the
  // mutation; status transition is a post-step.
  const { data: row, error: fetchErr } = await admin
    .from("journey_version")
    .select("status, workspace_id")
    .eq("journey_version_id", parsed.data.journeyVersionId)
    .single();
  if (fetchErr || !row) return { ok: false, error: `Not found: ${fetchErr?.message}` };
  if (row.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Cross-workspace publish forbidden." };
  }
  if (row.status !== "ready_publish") {
    return {
      ok: false,
      error: `publish_mission requires ready_publish; current status is ${row.status}.`,
    };
  }

  // ADR-0099 / ADR-0176: canonical C4 authority gate. Seeded row is
  // `suggest` / workspace_admin; godmode passes role floors but workspace
  // overrides can still `disable` the capability. We must honour that.
  // Server Actions have no `suggest`-confirm loop — a downgrade_to=`suggest`
  // with no manual approval path means deny here.
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "journey.publish_mission",
    channel: "chat", // ADR-0078 — journey capability is chat-only
    actorProfileId: profile.profileId,
    actionType: "publish_mission",
    entityId: parsed.data.journeyVersionId,
  });
  if (!gate.allow) {
    return {
      ok: false,
      error: `capability_disabled: ${gate.reason ?? "forbidden"}`,
    };
  }
  if (gate.downgrade_to === "suggest") {
    return {
      ok: false,
      error:
        "capability_disabled: publish_mission downgraded to suggest; no confirm path in admin UI.",
    };
  }

  // Build the AgentToolContext minimally — Server Action call-site, not a
  // chat session, so sessionId is a synthetic label. The capability body
  // reads workspaceId + profileId; everything else is optional.
  const ctx: AgentToolContext = {
    workspaceId: profile.workspaceId,
    profileId: profile.profileId,
    userId: profile.userId,
    sessionId: `platform-admin:${profile.userId}`,
    supabaseAdmin: admin,
    channel: "chat", // ADR-0078 — journey capability is chat-only
  };

  const raw = await publishMissionTool.execute(
    { journey_version_id: parsed.data.journeyVersionId },
    ctx,
  );

  let capResult: {
    ok?: boolean;
    run_id?: string;
    error?: string;
    message?: string;
    note?: string;
  };
  try {
    capResult = JSON.parse(raw) as typeof capResult;
  } catch {
    return { ok: false, error: "Capability returned non-JSON response." };
  }

  if (!capResult.ok || !capResult.run_id) {
    return {
      ok: false,
      error: capResult.message ?? capResult.error ?? "Capability rejected invocation.",
    };
  }

  // Code-reviewer Finding 2 (2026-04-22): block ghost publishes.
  //
  // The S1.4 capability stub returns `{ok: true, run_id}` WITHOUT inserting
  // into `engine_missions` — only `emit('journey run_started')` fires. If we
  // blindly transition the row to `published` we create a state-integrity
  // violation: a `published` journey_version with no backing mission row.
  //
  // The M5 sub-sortie wires the real engine_missions insert and will update
  // the stub's response shape (dropping the `skeleton` marker in `note`).
  // Until then: refuse the status transition and surface a clear error.
  //
  // Criterion: no code path in M4 transitions journey_version.status →
  // 'published'. Admin can still save drafts + manually transition up to
  // `ready_publish`; the final hop is blocked until M5 lands.
  const noteStr = typeof capResult.note === "string" ? capResult.note : "";
  if (noteStr.toLowerCase().includes("skeleton")) {
    return {
      ok: false,
      error:
        "capability_not_implemented: publishMissionTool is still a skeleton — M5 wires the engine_missions insert. Status transition to 'published' is blocked until then (M4 scope boundary).",
    };
  }

  // Post-step: advance the row's lifecycle. Any transition error is surfaced
  // but does not roll back the capability emit — the audit trail already
  // captured `journey.run_started` with surface=admin.
  const transition = await transitionJourneyVersionStatusAction({
    journeyVersionId: parsed.data.journeyVersionId,
    toStatus: "published",
  });
  if (!transition.ok) {
    return {
      ok: false,
      error: `Capability succeeded but status transition failed: ${transition.error}`,
    };
  }

  revalidatePath(`/platform-admin/journeys/versions/${parsed.data.journeyVersionId}`);
  revalidatePath("/platform-admin/journeys/versions");
  return { ok: true, runId: capResult.run_id };
}
