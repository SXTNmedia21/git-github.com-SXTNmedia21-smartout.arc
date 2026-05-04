"use server";

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { resolveCurrentProfile } from "@/app/dashboard/_actions/_shared";
import { hasMinimumRole } from "@/app/dashboard/_actions/_shared-utils";
import { emit, nonEmpty } from "@smartout/telemetry";

/**
 * setTipsEnabledAction — admin-only Server Action to toggle the tips module
 * for the current workspace.
 *
 * Flow:
 * 1. Validate input via Zod.
 * 2. Resolve actor server-side (ADR-0151 — never trust profile_id from body).
 * 3. Enforce admin role floor via hasMinimumRole (tips toggle is a workspace
 *    settings operation, not an AI capability — no engine_authority_config row).
 * 4. UPSERT tips_workspace_settings (workspace_id UNIQUE per Phase 1.7 schema).
 * 5. Emit `tips_workspace_settings toggled` on success (4.4 telemetry gate).
 *
 * Invariant compliance:
 *  - ADR-0151: actor resolved server-side, never from request body.
 *  - ADR-0193: nonEmpty() wraps workspace_id + actor_id before emit.
 *  - L-0094 / ADR-0196 I11: emit only on ok:true branch, never on failure.
 */

const InputSchema = z.object({
  enabled: z.boolean(),
});

type Result = { ok: true } | { ok: false; error: string };

export async function setTipsEnabledAction(raw: unknown): Promise<Result> {
  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "unauthenticated" };

  if (!hasMinimumRole(profile.role, "admin")) {
    return { ok: false, error: "admin_required" };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("tips_workspace_settings").upsert(
    {
      workspace_id: profile.workspaceId,
      tips_enabled: parsed.data.enabled,
    },
    { onConflict: "workspace_id" },
  );

  if (error) {
    return { ok: false, error: `db_error:${error.code}` };
  }

  // Emit only on success (ADR-0196 I11 / L-0094 phantom-emit prevention).
  await emit({
    event: "tips_workspace_settings toggled",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "workspace",
        entity_id: profile.workspaceId,
      },
      data: {
        enabled: parsed.data.enabled,
      },
    },
  });

  return { ok: true };
}
