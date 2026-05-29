/**
 * shift-zones — resolve zone assignments for shifts (ADR-0430 M:N readback).
 *
 * Lives in packages/data per ADR-0133 mobile-parity doctrine: the resolution
 * logic + types are shared; web and mobile both inject their own supabase client.
 *
 * Post-M4, schedule_shift has no scalar `zone`. Zones are an M:N relation:
 *   schedule_shift → shift_session (schedule_shift_id)
 *                  → shift_zone   (shift_session_id, keyed via the day_line junction)
 *                  → zone         (zone_id → name)
 *
 * shift_zone's FK to its parent is COMPOSITE ((shift_session_id, day_line_id) →
 * shift_session_day_line), so a single PostgREST embed from schedule_shift is not
 * reliable. We resolve in two keyed queries and flatten — robust + RLS-safe (every
 * table is workspace-scoped; the caller's client carries the JWT/anon context).
 */

/** A zone assigned to a shift (de-duplicated by zone_id). */
export type ShiftZone = {
  zone_id: string;
  name: string;
};

/**
 * Minimal supabase-client surface this helper needs. Each app injects its own
 * typed client (mobile: @/lib/supabase; web: server/client helpers).
 */
export type ZoneQueryClient = {
  from: (table: string) => {
    select: (cols: string) => {
      in: (col: string, vals: string[]) => Promise<{ data: unknown[] | null; error: unknown }>;
    };
  };
};

/**
 * Resolve zones[] for a set of schedule_shift_ids.
 * Returns a Map<schedule_shift_id, ShiftZone[]>. Shifts with no session/zone get [].
 */
export async function resolveZonesByShift(
  client: ZoneQueryClient,
  scheduleShiftIds: string[],
): Promise<Map<string, ShiftZone[]>> {
  const byShift = new Map<string, ShiftZone[]>();
  for (const id of scheduleShiftIds) byShift.set(id, []);
  if (scheduleShiftIds.length === 0) return byShift;

  // 1. schedule_shift_id → shift_session_id
  const { data: sessionRows } = await client
    .from("shift_session")
    .select("schedule_shift_id, shift_session_id")
    .in("schedule_shift_id", scheduleShiftIds);
  const sessions = (sessionRows ?? []) as Array<{
    schedule_shift_id: string;
    shift_session_id: string;
  }>;
  if (sessions.length === 0) return byShift;

  const sessionIds = sessions.map((s) => s.shift_session_id);

  // 2. shift_session_id → zone(zone_id, name) via shift_zone
  const { data: zoneRows } = await client
    .from("shift_zone")
    .select("shift_session_id, zone:zone_id(zone_id, name)")
    .in("shift_session_id", sessionIds);
  const zones = (zoneRows ?? []) as Array<{
    shift_session_id: string;
    zone: { zone_id: string; name: string } | null;
  }>;

  // zones per session (de-dup by zone_id)
  const zonesBySession = new Map<string, ShiftZone[]>();
  for (const z of zones) {
    if (!z.zone) continue;
    const list = zonesBySession.get(z.shift_session_id) ?? [];
    if (!list.some((x) => x.zone_id === z.zone!.zone_id)) {
      list.push({ zone_id: z.zone.zone_id, name: z.zone.name });
    }
    zonesBySession.set(z.shift_session_id, list);
  }

  // fold back to shift
  for (const s of sessions) {
    const list = zonesBySession.get(s.shift_session_id) ?? [];
    const existing = byShift.get(s.schedule_shift_id) ?? [];
    for (const z of list) {
      if (!existing.some((x) => x.zone_id === z.zone_id)) existing.push(z);
    }
    byShift.set(s.schedule_shift_id, existing);
  }

  return byShift;
}
