"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase/database.types";
import { emit, nonEmpty } from "@smartout/telemetry";
import { JourneyIRSchema } from "@smartout/journey-ir";
import { resolveAdminProfile, assertPlatformAdmin } from "./_shared";

/**
 * saveJourneyVersionDraftAction — persist an edited JourneyIR on an
 * existing journey_version row. Only allowed while status is
 * `draft | ready_test | testing`. Published / archived rows are read-only.
 *
 * The Zod schema from @smartout/journey-ir is the only validator — we do not
 * re-declare the IR shape here. M3.5's IR-v2 upgrade changes that schema in
 * one place and this action picks it up for free.
 */

const InputSchema = z.object({
  journeyVersionId: z.string().uuid(),
  ir: z.unknown(), // validated by JourneyIRSchema below
});

export type SaveJourneyVersionDraftResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string };

export async function saveJourneyVersionDraftAction(
  input: z.infer<typeof InputSchema>,
): Promise<SaveJourneyVersionDraftResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const irParsed = JourneyIRSchema.safeParse(parsed.data.ir);
  if (!irParsed.success) {
    return { ok: false, error: `IR invalid: ${irParsed.error.issues[0]?.message ?? "see schema"}` };
  }

  const profile = await resolveAdminProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };
  if (!(await assertPlatformAdmin(profile.userId))) {
    return { ok: false, error: "Platform-admin required." };
  }

  const admin = createAdminClient();

  // Guard: cannot edit published/archived rows. Transition back to draft
  // (via transition-status) first if the spec needs a revision.
  const { data: current, error: fetchErr } = await admin
    .from("journey_version")
    .select("journey_version_id, status, workspace_id, version_number, ir_json")
    .eq("journey_version_id", parsed.data.journeyVersionId)
    .single();
  if (fetchErr || !current) {
    return { ok: false, error: `Not found: ${fetchErr?.message ?? "unknown"}` };
  }
  if (current.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Cross-workspace edit forbidden." };
  }
  if (current.status === "published" || current.status === "archived") {
    return {
      ok: false,
      error: `Cannot edit a ${current.status} version. Transition to draft first.`,
    };
  }

  const { data: updated, error: updateErr } = await admin
    .from("journey_version")
    .update({ ir_json: irParsed.data as unknown as Json })
    .eq("journey_version_id", parsed.data.journeyVersionId)
    .select("updated_at")
    .single();

  if (updateErr || !updated) {
    return { ok: false, error: `Update failed: ${updateErr?.message ?? "unknown"}` };
  }

  await emit({
    event: "journey_version saved",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      journey_version_id: parsed.data.journeyVersionId,
      actor_id: profile.profileId,
      workspace_id: profile.workspaceId,
      fields_changed: ["ir_json"] as const,
      entity: {
        entity_type: "journey_version",
        entity_id: parsed.data.journeyVersionId,
        entity_label: `${irParsed.data.slug}@v${current.version_number}`,
      },
    },
  });

  revalidatePath(`/platform-admin/journeys/versions/${parsed.data.journeyVersionId}`);
  revalidatePath("/platform-admin/journeys/versions");
  return { ok: true, updatedAt: updated.updated_at };
}
