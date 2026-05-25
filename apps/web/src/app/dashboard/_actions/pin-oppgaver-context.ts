"use server";

/**
 * pinOppgaverContextAction — pin /dashboard/oppgaver view context to
 * engine_memory so the global Botsson agent knows what the manager is
 * looking at. TTL 24h.
 *
 * L-0177: throws / returns { ok: false } on missing workspace_id /
 * profile_id. No silent fallback.
 *
 * KNOWN DEBT: write does NOT pass through gateAction per ADR-0099. Pattern
 * inherits the latent gap from pinDayControlContextAction (P10). A follow-up
 * sortie wraps both (and any future pin-* actions) in a unified gate.
 * Tracked in HANDOFF + Linear issue.
 *
 * ADR-0238 + L-0178: surface declares DomainChatOwnership separately
 * (ManagerTimelineShell). This action only writes context; the dual-surface
 * trap is prevented by Orb passive-mode wiring upstream.
 */

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { resolveCurrentProfile } from "./_shared";

const PinSchema = z.object({
  date_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active_view: z.enum(["area", "role", "person"]),
  active_filters: z.object({
    area_ids: z.array(z.string().uuid()).optional(),
    team_ids: z.array(z.string().uuid()).optional(),
    role_codes: z.array(z.string()).optional(),
  }),
  focused_entity: z.string().optional(),
});
export type PinOppgaverContextInput = z.infer<typeof PinSchema>;

export async function pinOppgaverContextAction(
  input: PinOppgaverContextInput,
): Promise<{ ok: boolean }> {
  const parsed = PinSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false };
  if (!profile.workspaceId) return { ok: false };
  if (!profile.profileId) return { ok: false };

  const sb = await createClient();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const filters = parsed.data.active_filters;
  const filterDesc = [
    filters.area_ids?.length ? `areas=${filters.area_ids.length}` : null,
    filters.team_ids?.length ? `teams=${filters.team_ids.length}` : null,
    filters.role_codes?.length ? `roles=${filters.role_codes.join(",")}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const content =
    `Viewing /dashboard/oppgaver on date=${parsed.data.date_iso} mode=${parsed.data.active_view}` +
    (filterDesc ? ` filters[${filterDesc}]` : "") +
    (parsed.data.focused_entity ? ` focused=${parsed.data.focused_entity}` : "");

  const { error } = await sb.from("engine_memory").insert({
    profile_id: profile.profileId,
    workspace_id: profile.workspaceId,
    memory_type: "fact",
    content,
    expires_at: expires,
  });
  if (error) return { ok: false };
  return { ok: true };
}
