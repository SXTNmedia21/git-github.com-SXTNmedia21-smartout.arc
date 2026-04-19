"use server";

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { resolveCurrentProfile } from "./_shared";

const PinSchema = z.object({
  sessionId: z.string().uuid(),
  departmentName: z.string(),
  date: z.string(),
});

export type PinDayControlContextInput = z.infer<typeof PinSchema>;

/**
 * Pins the current WebDayControl view into engine_memory so Botsson has
 * contextual grounding — when the leder asks "hvor mange avvik i dag?",
 * the stage-engine's loadRecentMemories pulls this fact.
 *
 * TTL 24h. Caller is the viewing profile (resolved server-side).
 */
export async function pinDayControlContextAction(
  input: PinDayControlContextInput,
): Promise<{ ok: boolean }> {
  const parsed = PinSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false };

  const supabase = await createClient();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const content = `Viewing department_session=${parsed.data.sessionId} for department=${parsed.data.departmentName} on date=${parsed.data.date} via WebDayControl`;

  const { error } = await supabase.from("engine_memory").insert({
    profile_id: profile.profileId,
    workspace_id: profile.workspaceId,
    memory_type: "fact",
    content,
    expires_at: expires,
  });

  if (error) return { ok: false };
  return { ok: true };
}
