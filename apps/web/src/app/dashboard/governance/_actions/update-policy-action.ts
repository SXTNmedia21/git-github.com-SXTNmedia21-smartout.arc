"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import { gateAction, resolveCurrentProfile } from "@/app/dashboard/_actions/_shared";

const policyUpdateSchema = z.object({
  policy_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  statement: z.string().min(1),
  description: z.string().optional(),
  policy_type: z.enum(["operational", "haccp", "hr", "safety", "access", "payroll", "custom"]),
  policy_scope: z.enum(["workspace", "department", "team", "location"]),
  enforcement_status: z.enum(["aspirational", "enforced"]).optional(),
});

export type UpdatePolicyInput = z.infer<typeof policyUpdateSchema>;

export type UpdatePolicyResult = { ok: true; policy_id: string } | { ok: false; error: string };

export async function updatePolicyAction(input: UpdatePolicyInput): Promise<UpdatePolicyResult> {
  const parsed = policyUpdateSchema.safeParse(input);
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
    capability: "policy",
    channel: "system",
    actorProfileId: profileId,
    actionType: "update",
    entityId: parsed.data.policy_id,
  });
  if (!gate.allow) {
    return {
      ok: false,
      error: `gate_action denied: ${gate.reason ?? "unknown"}`,
    };
  }

  const supabase = await createClient();
  const { policy_id, ...updateFields } = parsed.data;
  const { error: updateErr } = await supabase
    .from("policy")
    .update({ ...updateFields, updated_at: new Date().toISOString() })
    .eq("policy_id", policy_id);

  if (updateErr) {
    return { ok: false, error: `Update failed: ${updateErr.message}` };
  }

  // TODO T7: emit governance.content_updated once event registered.
  // Will trigger ingest-workspace-knowledge re-ingest via engine_event/
  // engine-dispatch route added in T8.

  revalidatePath("/dashboard/governance");

  return { ok: true, policy_id };
}
