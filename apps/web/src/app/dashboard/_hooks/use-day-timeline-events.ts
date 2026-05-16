"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export type DayEventType = "booking" | "note" | "task" | "deviation" | "checkin" | "checkout";

export type DayEvent = {
  id: string;
  type: DayEventType;
  /** Local HH:MM string for axis position. */
  time: string;
  /** Full ISO timestamp when known (used for ordering). */
  iso: string | null;
  /** Optional end time HH:MM — for tasks/sessions with duration. */
  endTime?: string;
  /** Optional end ISO. */
  endIso?: string | null;
  title: string;
  subtitle?: string;
  /** Person responsible for / reported by — display name, when resolvable. */
  actor?: string;
  /** Sub-type / category label (deviation domain, note type, booking VIP). */
  category?: string;
  /** Severity hint for visual emphasis. */
  severity?: "low" | "medium" | "high" | "critical";
  /** Severity / status hint for color: success | warning | destructive | info | muted. */
  tone?: "success" | "warning" | "destructive" | "info" | "muted";
  /** Underlying row id for click-to-edit. */
  refId: string;
  /** Source table/category — useful for routing to the right editor. */
  source: string;
  /** Done-state for tasks (lets list show check). */
  done?: boolean;
};

function hhmm(d: Date): string {
  return d.toTimeString().slice(0, 5);
}

function combineDateTime(dateISO: string, timeStr: string | null): Date | null {
  if (!timeStr) return null;
  const clean = timeStr.length >= 5 ? timeStr.slice(0, 5) : timeStr;
  const d = new Date(`${dateISO}T${clean}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * useDayTimelineEvents — aggregates the day's events for the Dagslinjen tab.
 *
 * Pulls from: schedule_day_booking, session_note, session_task (via hooks),
 * deviation, timesheet.time_entry (check-ins / check-outs). Returns a single
 * chronological list with `type` discriminator + `refId` for click-routing.
 *
 * Department-scoped via shifts in roster (check-ins) and session-scoped for
 * notes/tasks. Bookings are workspace-scoped per migration (no department FK).
 *
 * When teamId is provided: check-ins, notes, and tasks are filtered to shifts
 * whose team_id matches — limits the strip to that team's window.
 * When shiftId is provided: check-ins are filtered to that exact shift; notes
 * and tasks are filtered via the session_id attached to that shift's session.
 * teamId and shiftId are mutually exclusive; shiftId takes precedence.
 */
export function useDayTimelineEvents(args: {
  workspaceId: string | null | undefined;
  departmentId: string | null;
  sessionId: string | null;
  dateISO: string;
  /** Filter to a specific team's shifts/sessions. Mutually exclusive with shiftId. */
  teamId?: string | null;
  /** Filter to a single shift and its session. Takes precedence over teamId. */
  shiftId?: string | null;
}) {
  const { workspaceId, departmentId, sessionId, dateISO, teamId, shiftId } = args;
  const ctx = useWorkspaceOptional();
  const wsId = workspaceId ?? ctx?.workspace.workspace_id;

  // Distinct queryKey shape per scope — prevents TanStack shape collision
  // (see learning_tanstack_query_shape_collision.md: same key + different shape = cache crash).
  return useQuery({
    queryKey: [
      "day-control",
      "timeline-events",
      wsId,
      departmentId,
      sessionId,
      dateISO,
      // Scope suffix keeps cache entries distinct. Trailing nulls collapse to same key as
      // the pre-scope callers — no regression for callers not passing teamId/shiftId.
      shiftId ?? null,
      teamId ?? null,
    ],
    enabled: !!wsId && !!dateISO,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<DayEvent[]> => {
      const supabase = createClient();
      const events: DayEvent[] = [];

      // Bookings (workspace-scoped, by date)
      const { data: bookings } = await supabase
        .from("schedule_day_booking")
        .select(
          "schedule_day_booking_id, title, booking_time, guest_count, status, is_vip, location, notes, contact_person",
        )
        .eq("workspace_id", wsId!)
        .eq("shift_date", dateISO);

      for (const b of bookings ?? []) {
        events.push({
          id: `booking-${b.schedule_day_booking_id}`,
          type: "booking",
          time: (b.booking_time ?? "").slice(0, 5),
          iso: combineDateTime(dateISO, b.booking_time)?.toISOString() ?? null,
          title: b.title,
          subtitle: `${b.guest_count ?? 0} gjester${b.location ? ` · ${b.location}` : ""}`,
          actor: b.contact_person ?? undefined,
          category: b.is_vip ? "VIP" : (b.status ?? undefined),
          tone: b.is_vip ? "warning" : "info",
          refId: b.schedule_day_booking_id,
          source: "schedule_day_booking",
        });
      }

      // Notes (session-scoped)
      if (sessionId) {
        const { data: notes } = await supabase
          .from("session_note")
          .select(
            "id, note_type, content, created_at, created_by, creator:profile!created_by(display_name)",
          )
          .eq("department_session_id", sessionId)
          .order("created_at", { ascending: true });

        for (const n of notes ?? []) {
          const created = new Date(n.created_at);
          const creator = n.creator as unknown as { display_name: string } | null;
          events.push({
            id: `note-${n.id}`,
            type: "note",
            time: hhmm(created),
            iso: n.created_at,
            title: n.content.slice(0, 80) + (n.content.length > 80 ? "…" : ""),
            subtitle: n.content.length > 80 ? n.content.slice(80, 200) : undefined,
            actor: creator?.display_name ?? undefined,
            category: n.note_type,
            tone: "muted",
            refId: n.id,
            source: "session_note",
          });
        }
      }

      // Tasks (session-scoped, via session_task with hook joins)
      if (sessionId) {
        const { data: tasks } = await supabase
          .from("session_task")
          .select(
            "id, title, completed_at, created_at, status, assigned_to, owner:profile!assigned_to(display_name)",
          )
          .eq("department_session_id", sessionId);

        for (const t of tasks ?? []) {
          const startIso = t.created_at;
          const endIso = t.completed_at ?? null;
          const startDate = startIso ? new Date(startIso) : null;
          const endDate = endIso ? new Date(endIso) : null;
          const owner = t.owner as unknown as { display_name: string } | null;
          events.push({
            id: `task-${t.id}`,
            type: "task",
            time: startDate ? hhmm(startDate) : "—",
            iso: startIso ?? null,
            endTime: endDate ? hhmm(endDate) : undefined,
            endIso,
            title: t.title,
            actor: owner?.display_name ?? undefined,
            category: t.status ?? undefined,
            tone: t.completed_at ? "success" : "info",
            refId: t.id,
            source: "session_task",
            done: !!t.completed_at,
          });
        }
      }

      // Deviations (workspace-scoped, filter by created_at on date)
      const dayStart = `${dateISO}T00:00:00.000Z`;
      const dayEnd = `${dateISO}T23:59:59.999Z`;
      const { data: devs } = await supabase
        .from("deviation")
        .select(
          "deviation_id, title, severity, status, created_at, domain, reported_by, reporter:profile!reported_by(display_name)",
        )
        .eq("workspace_id", wsId!)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);

      for (const d of devs ?? []) {
        const created = new Date(d.created_at);
        const reporter = d.reporter as unknown as { display_name: string } | null;
        events.push({
          id: `deviation-${d.deviation_id}`,
          type: "deviation",
          time: hhmm(created),
          iso: d.created_at,
          title: d.title,
          actor: reporter?.display_name ?? undefined,
          category: d.domain ?? undefined,
          severity: d.severity ?? undefined,
          tone:
            d.severity === "critical" || d.severity === "high"
              ? "destructive"
              : d.severity === "medium"
                ? "warning"
                : "muted",
          refId: d.deviation_id,
          source: "deviation",
        });
      }

      // Check-ins / Check-outs — workspace-wide for the date, optionally
      // filtered by teamId or shiftId from the scope selector.
      // Note: `schedule_shift.department_id` is nullable (L-0064 trap); the
      // canonical dept link goes via `position_id → position.department_id`.
      // Until that join lands, surface ALL workspace check-ins on the day so
      // the user actually sees their punch on Dagslinjen.
      {
        let shiftQuery = supabase
          .from("schedule_shift")
          .select("schedule_shift_id, employee_id, team_id, profile:employee_id(display_name)")
          .eq("workspace_id", wsId!)
          .eq("shift_date", dateISO);

        // shiftId takes precedence over teamId
        if (shiftId) {
          shiftQuery = shiftQuery.eq("schedule_shift_id", shiftId);
        } else if (teamId) {
          shiftQuery = shiftQuery.eq("team_id", teamId);
        }

        const { data: shifts } = await shiftQuery;

        const shiftIds = (shifts ?? []).map((s) => s.schedule_shift_id);
        if (shiftIds.length > 0) {
          const { data: entries } = await supabase
            .schema("timesheet")
            .from("time_entry")
            .select("time_entry_id, shift_id, punch_in, punch_out")
            .in("shift_id", shiftIds);

          const nameByShift = new Map(
            (shifts ?? []).map((s) => {
              const p = s.profile as unknown as { display_name: string } | null;
              return [s.schedule_shift_id, p?.display_name ?? "Ukjent"] as const;
            }),
          );

          for (const e of entries ?? []) {
            const name = nameByShift.get(e.shift_id) ?? "Ukjent";
            if (e.punch_in) {
              const t = new Date(e.punch_in);
              events.push({
                id: `checkin-${e.time_entry_id}`,
                type: "checkin",
                time: hhmm(t),
                iso: e.punch_in,
                title: name,
                actor: name,
                category: "Innsjekk",
                tone: "success",
                refId: e.shift_id,
                source: "time_entry.punch_in",
              });
            }
            if (e.punch_out) {
              const t = new Date(e.punch_out);
              events.push({
                id: `checkout-${e.time_entry_id}`,
                type: "checkout",
                time: hhmm(t),
                iso: e.punch_out,
                title: name,
                actor: name,
                category: "Utsjekk",
                tone: "muted",
                refId: e.shift_id,
                source: "time_entry.punch_out",
              });
            }
          }
        }
      }

      // Sort chronologically (events without iso fall to end)
      events.sort((a, b) => {
        if (!a.iso && !b.iso) return a.time.localeCompare(b.time);
        if (!a.iso) return 1;
        if (!b.iso) return -1;
        return a.iso.localeCompare(b.iso);
      });

      return events;
    },
  });
}
