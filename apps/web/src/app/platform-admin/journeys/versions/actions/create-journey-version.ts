"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase/database.types";
import { emit } from "@smartout/telemetry";
import { JourneyIRSchema, type JourneyIR } from "@smartout/journey-ir";
import { resolveAdminProfile, assertPlatformAdmin } from "./_shared";

// Creation form input. We build a minimal JourneyIR with one placeholder
// step so the version row has a non-null ir_json from day one.
const InputSchema = z.object({
  journeyId: z.string().uuid(),
  title: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Slug must be lowercase kebab-case (e.g. onboarding-employee)."),
  module: z.string().min(1).max(48),
});

export type CreateJourneyVersionInput = z.infer<typeof InputSchema>;
export type CreateJourneyVersionResult =
  | { ok: true; journeyVersionId: string }
  | { ok: false; error: string };

export async function createJourneyVersionAction(
  input: CreateJourneyVersionInput,
): Promise<CreateJourneyVersionResult> {
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

  // Compute next version_number for (workspace_id, journey_id). The unique
  // constraint on (workspace_id, journey_id, version_number) gives us a
  // natural race guard — two concurrent creates will conflict, not silently
  // create duplicate v1.
  const { data: latest } = await admin
    .from("journey_version")
    .select("version_number")
    .eq("workspace_id", profile.workspaceId)
    .eq("journey_id", parsed.data.journeyId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest?.version_number ?? 0) + 1;

  // Minimal IR v1 scaffold — one placeholder step so validators downstream
  // don't trip on empty `steps[]`. M3.5 will re-mint this when the IR v2
  // family lands (actor/platform/preconditions/actions[]).
  const seedIr: JourneyIR = {
    version: "1.0.0",
    slug: parsed.data.slug,
    title: parsed.data.title,
    module: parsed.data.module,
    steps: [
      {
        key: "step-1",
        title: "First step",
        action: "Describe what the actor does in this step.",
        assertion: "Describe what must be true after this step.",
      },
    ],
  };

  const parsedIr = JourneyIRSchema.safeParse(seedIr);
  if (!parsedIr.success) {
    return { ok: false, error: `IR scaffold invalid: ${parsedIr.error.message}` };
  }

  const { data: row, error } = await admin
    .from("journey_version")
    .insert({
      workspace_id: profile.workspaceId,
      journey_id: parsed.data.journeyId,
      version_number: nextVersion,
      status: "draft",
      ir_json: parsedIr.data as unknown as Json,
      created_by: profile.profileId,
    })
    .select("journey_version_id")
    .single();

  if (error || !row) {
    return { ok: false, error: `Insert failed: ${error?.message ?? "unknown"}` };
  }

  await emit({
    event: "journey_version created",
    workspace_id: profile.workspaceId,
    actor_id: profile.profileId,
    properties: {
      journey_version_id: row.journey_version_id,
      journey_id: parsed.data.journeyId,
      version_number: nextVersion,
      actor_id: profile.profileId,
      workspace_id: profile.workspaceId,
      entity: {
        entity_type: "journey_version",
        entity_id: row.journey_version_id,
        entity_label: `${parsed.data.slug}@v${nextVersion}`,
      },
    },
  });

  revalidatePath("/platform-admin/journeys/versions");
  return { ok: true, journeyVersionId: row.journey_version_id };
}
