"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
import { gateAction, resolveCurrentProfile } from "@/app/dashboard/_actions/_shared";

const protocolUpdateSchema = z.object({
  protocol_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  policy_id: z.string().uuid(),
  owner_profile_id: z.string().uuid(),
  version: z.string().optional(),
});

export type UpdateProtocolInput = z.infer<typeof protocolUpdateSchema>;

export type UpdateProtocolResult = { ok: true; protocol_id: string } | { ok: false; error: string };

export async function updateProtocolAction(
  input: UpdateProtocolInput,
): Promise<UpdateProtocolResult> {
  const parsed = protocolUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Validation failed: ${parsed.error.message}` };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }
  const { profileId, workspaceId } = profile;

  const gate = await gateAction({
    workspaceId,
    capability: "protocol",
    channel: "system",
    actorProfileId: profileId,
    actionType: "update",
    entityId: parsed.data.protocol_id,
  });
  if (!gate.allow) {
    return {
      ok: false,
      error: `gate_action denied: ${gate.reason ?? "unknown"}`,
    };
  }

  const supabase = await createClient();
  const { protocol_id, ...updateFields } = parsed.data;
  const { error: updateErr } = await supabase
    .from("protocol")
    .update({ ...updateFields, updated_at: new Date().toISOString() })
    .eq("protocol_id", protocol_id);

  if (updateErr) {
    return { ok: false, error: `Update failed: ${updateErr.message}` };
  }

  await emit({
    event: "governance.content_updated",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(profileId, "actor_id"),
    properties: {
      source_type: "protocol",
      source_id: nonEmpty(protocol_id, "source_id"),
      trigger: "update",
    },
  });

  revalidatePath("/dashboard/governance");

  return { ok: true, protocol_id };
}
