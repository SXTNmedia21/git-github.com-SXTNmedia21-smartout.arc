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
 * Unlike publishMission this action does NOT transition status — the guide
 * publish is independent of the mission publish (see ADR-0173). The spec
 * expects both to be achievable from the same `ready_publish` state, and
 * the row only moves to `published` when the admin explicitly triggers it
 * (via transitionJourneyVersionStatusAction). Running guide alone keeps the
 * row at `ready_publish` so mission publish can still fire.
 *
 * Authority: `assertPlatformAdmin()` is the OUTER auth gate (godmode only).
 * `gate_action` is the inner C4 governance gate (ADR-0099 / ADR-0176) —
 * honours workspace-level `engine_authority_config` disables + role floors.
 * Both must pass; admin bypass is NOT a substitute for C4 (code-reviewer
 * finding 2026-04-22).
 *
 * Stub detection: the S1.4 capability is a skeleton (USER-GUIDE generator
 * lands in M5). Until then we surface `capability_not_implemented` so
 * admins do not see a fake success toast.
 */
const InputSchema = z.object({
  journeyVersionId: z.string().uuid(),
});

export type PublishGuideResult = { ok: true; runId: string } | { ok: false; error: string };

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

  // Code-reviewer Finding 2 (2026-04-22): surface stub state explicitly.
  // publish-guide does not transition status, so there is no ghost-publish
  // row risk on this path — but admins should still see a truthful error
  // instead of a green "published" toast when nothing persisted. The M5
  // sub-sortie drops the skeleton marker when it wires the real generator.
  const noteStr = typeof capResult.note === "string" ? capResult.note : "";
  if (noteStr.toLowerCase().includes("skeleton")) {
    return {
      ok: false,
      error:
        "capability_not_implemented: publishGuideTool is still a skeleton — M5 wires the USER-GUIDE generator.",
    };
  }

  revalidatePath(`/platform-admin/journeys/versions/${parsed.data.journeyVersionId}`);
  return { ok: true, runId: capResult.run_id };
}
