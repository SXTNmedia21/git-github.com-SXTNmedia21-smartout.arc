"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { publishGuideTool } from "@smartout/ai/capabilities/journey";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import { resolveAdminProfile, assertPlatformAdmin } from "./_shared";
import { gateAction } from "@/app/dashboard/_actions/_shared";

/**
 * publishGuideAction — Server Action invoking `journey.publish_guide`.
 *
 * Publishes a JourneyIR as a USER-GUIDE MDX document stored in the
 * `journey_guide` DB table (ADR-0217). The guide publish is independent of
 * mission publish (ADR-0173) — both are available from `ready_publish` state.
 * Status does NOT transition here; the row moves to `published` only when
 * the admin explicitly calls `transitionJourneyVersionStatusAction`.
 *
 * Authority: `assertPlatformAdmin()` is the OUTER auth gate (godmode only).
 * `gate_action` is the inner C4 governance gate (ADR-0099 / ADR-0176) —
 * honours workspace-level `engine_authority_config` disables + role floors.
 * Both must pass; admin bypass is NOT a substitute for C4 (code-reviewer
 * finding 2026-04-22).
 *
 * Returns `{ok:true, runId, guideId}` on success so the UI can surface
 * the journey_guide UUID in the success toast.
 */
const InputSchema = z.object({
  journeyVersionId: z.string().uuid(),
});

export type PublishGuideResult =
  | { ok: true; runId: string; guideId: string }
  | { ok: false; error: string };

export async function publishGuideAction(
  input: z.infer<typeof InputSchema>,
): Promise<PublishGuideResult> {
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

  const { data: row, error: fetchErr } = await admin
    .from("journey_version")
    .select("status, workspace_id")
    .eq("journey_version_id", parsed.data.journeyVersionId)
    .single();
  if (fetchErr || !row) return { ok: false, error: `Not found: ${fetchErr?.message}` };
  if (row.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Cross-workspace publish forbidden." };
  }
  if (row.status !== "ready_publish" && row.status !== "published") {
    return {
      ok: false,
      error: `publish_guide requires ready_publish or published; current status is ${row.status}.`,
    };
  }

  // ADR-0099 / ADR-0176: canonical C4 authority gate. Seeded row is
  // `suggest` / workspace_admin.
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "journey.publish_guide",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "publish_guide",
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
        "capability_disabled: publish_guide downgraded to suggest; no confirm path in admin UI.",
    };
  }

  const ctx: AgentToolContext = {
    workspaceId: profile.workspaceId,
    profileId: profile.profileId,
    userId: profile.userId,
    sessionId: `platform-admin:${profile.userId}`,
    supabaseAdmin: admin,
    channel: "chat",
  };

  const raw = await publishGuideTool.execute(
    { journey_version_id: parsed.data.journeyVersionId },
    ctx,
  );

  let capResult: {
    ok?: boolean;
    run_id?: string;
    guide_id?: string;
    journey_version_id?: string;
    error?: string;
    message?: string;
    missing_fields?: string[];
  };
  try {
    capResult = JSON.parse(raw) as typeof capResult;
  } catch {
    return { ok: false, error: "Capability returned non-JSON response." };
  }

  if (!capResult.ok || !capResult.run_id || !capResult.guide_id) {
    // Surface validation_failed with missing fields for author UX.
    if (capResult.error === "validation_failed" && capResult.missing_fields?.length) {
      return {
        ok: false,
        error: `validation_failed: missing ${capResult.missing_fields.join(", ")}`,
      };
    }
    return {
      ok: false,
      error: capResult.message ?? capResult.error ?? "Capability rejected invocation.",
    };
  }

  // publish_guide does not transition journey_version.status — the guide
  // publish is independent of mission publish per ADR-0173. Both are
  // available from `ready_publish` state; status transitions are explicit.
  revalidatePath(`/platform-admin/journeys/versions/${parsed.data.journeyVersionId}`);
  return { ok: true, runId: capResult.run_id, guideId: capResult.guide_id };
}
