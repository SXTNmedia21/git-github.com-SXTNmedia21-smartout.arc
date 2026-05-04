"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import {
  JOURNEY_VERSION_STATUS_ORDER,
  canTransition,
  type JourneyVersionStatus,
} from "../_lib/version-status";
import { resolveAdminProfile, assertPlatformAdmin } from "./_shared";

/**
 * transitionJourneyVersionStatusAction — move a journey_version between
 * lifecycle states (ADR-0172). Enforces ALLOWED_TRANSITIONS — the UI
 * hides disallowed options, this action rejects them as defense-in-depth.
 *
 * This action does NOT invoke the publish capabilities — those are separate
 * Server Actions (publish-mission.ts / publish-guide.ts). A transition to
 * `published` from this action is allowed only from `ready_publish` and
 * represents an external publish (e.g. manual after both capabilities fired).
 */

const InputSchema = z.object({
  journeyVersionId: z.string().uuid(),
  toStatus: z.enum(JOURNEY_VERSION_STATUS_ORDER as unknown as [string, ...string[]]),
});

export type TransitionResult =
  | { ok: true; from: JourneyVersionStatus; to: JourneyVersionStatus }
  | { ok: false; error: string };

export async function transitionJourneyVersionStatusAction(
  input: z.infer<typeof InputSchema>,
): Promise<TransitionResult> {
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

  const { data: current, error: fetchErr } = await admin
    .from("journey_version")
    .select("journey_version_id, status, workspace_id, version_number, ir_json")
    .eq("journey_version_id", parsed.data.journeyVersionId)
    .single();
  if (fetchErr || !current) {
    return { ok: false, error: `Not found: ${fetchErr?.message ?? "unknown"}` };
  }
  if (current.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Cross-workspace transition forbidden." };
  }

  const from = current.status;
  const to = parsed.data.toStatus as JourneyVersionStatus;

  if (from === to) {
    return { ok: true, from, to };
  }

  if (!canTransition(from, to)) {
    return {
      ok: false,
      error: `Transition not allowed: ${from} → ${to}.`,
    };
  }

  const { error: updateErr } = await admin
    .from("journey_version")
    .update({ status: to })
    .eq("journey_version_id", parsed.data.journeyVersionId);

  if (updateErr) {
    return { ok: false, error: `Update failed: ${updateErr.message}` };
  }

  // Best-effort label for the entity row — ir_json holds slug, but we fall
  // back to the ID if the IR is malformed.
  const ir = current.ir_json as { slug?: string } | null;
  const label = `${ir?.slug ?? current.journey_version_id}@v${current.version_number}`;

  await emit({
    event: "journey_version transitioned",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      journey_version_id: parsed.data.journeyVersionId,
      from_status: from,
      to_status: to,
      actor_id: profile.profileId,
      workspace_id: profile.workspaceId,
      entity: {
        entity_type: "journey_version",
        entity_id: parsed.data.journeyVersionId,
        entity_label: label,
      },
    },
  });

  if (to === "archived") {
    // Additional explicit archive event — noisier than transitioned alone,
    // but the audit log reads "what terminated this version" in one grep.
    await emit({
      event: "journey_version archived",
      workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
      actor_id: nonEmpty(profile.profileId, "actor_id"),
      properties: {
        journey_version_id: parsed.data.journeyVersionId,
        actor_id: profile.profileId,
        workspace_id: profile.workspaceId,
        entity: {
          entity_type: "journey_version",
          entity_id: parsed.data.journeyVersionId,
          entity_label: label,
        },
      },
    });
  }

  revalidatePath(`/platform-admin/journeys/versions/${parsed.data.journeyVersionId}`);
  revalidatePath("/platform-admin/journeys/versions");
  return { ok: true, from, to };
}
