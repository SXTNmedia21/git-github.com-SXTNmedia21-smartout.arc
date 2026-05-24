"use server";

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { resolveCurrentProfile } from "./_shared";

const PinSchema = z.object({
  sessionId: z.string().uuid(),
  departmentName: z.string().min(1),
  date: z.string().min(1),
});

export type PinDayControlPanelContextInput = z.infer<typeof PinSchema>;

/**
 * Pins the active DayControlPanel view into engine_memory so Botsson has
 * contextual grounding when the panel is open on schedule/calendar/AdminDashboard.
 *
 * Sibling of pinDayControlContextAction (which serves WebDayControl). The
 * `via DayControlPanel` suffix lets engine_memory consumers distinguish surface.
 * TTL 24h. Caller is the viewing profile (resolved server-side per ADR-0151).
 * L-0177 fail-fast: returns { ok:false } on missing profile OR workspace.
 */
export async function pinDayControlPanelContextAction(
  input: PinDayControlPanelContextInput,
): Promise<{ ok: boolean }> {
  const parsed = PinSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false };

  const supabase = await createClient();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const content =
    `Viewing department_session=${parsed.data.sessionId} ` +
    `for department=${parsed.data.departmentName} ` +
    `on date=${parsed.data.date} via DayControlPanel`;

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
