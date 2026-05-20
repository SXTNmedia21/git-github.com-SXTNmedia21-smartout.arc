"use client";

/**
 * LeaderOverview.tsx — Manager's real-time view of all active shifts for today.
 *
 * Shows a card grid of every employee with a scheduled shift today, grouped
 * visually by status: clocked_in (green), on_break (orange), waiting (dimmed).
 *
 * Data sources:
 *   - schedule_shift (public schema) → who is scheduled today
 *   - timesheet.time_entry (timesheet schema) → who is currently clocked in / on break
 *
 * Realtime: subscribes to INSERT/UPDATE on timesheet.time_entry and invalidates
 * the relevant queries so cards update without a full page reload.
 *
 * Manual punch: leaders can punch in a waiting employee directly from the card.
 *
 * Connected to: /dashboard/shift-clock page (leader path)
 */

import { useContext, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, LogIn, Coffee, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { Json } from "@smartout/supabase";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

type ScheduledEmployee = {
  schedule_shift_id: string;
  employee_id: string | null;
  start_time: string;
  end_time: string;
  role: string;
  department_id: string | null;
  profile: {
    display_name: string | null;
  } | null;
  department: {
    name: string;
  } | null;
};

type ActiveEntry = {
  time_entry_id: string;
  profile_id: string;
  shift_id: string | null;
  punch_in: string;
  punch_out: string | null;
  breaks: Json;
};

/** Resolved card model — one per scheduled employee */
type EmployeeCard = {
  schedule_shift_id: string;
  profile_id: string;
  name: string;
  role: string;
  department: string;
  shiftStart: string; // ISO
  shiftStartLabel: string; // "15:00"
  status: "clocked_in" | "on_break" | "waiting";
  punchInTime: string | null;
  punchInLabel: string | null; // "15:00"
  workDuration: string | null; // "2t 07m" (live, recomputed on render)
  breakDuration: string | null; // "12m" (live)
  minutesUntilStart: number | null;
  timeEntryId: string | null;
};

// ── Avatar color palette — warm, varied, never gray (ADR-0366: CSS vars) ──────────
const AVATAR_COLORS = [
  "var(--status-trainee)", // blue ~250
  "var(--brand-purple)", // purple ~300
  "var(--dept-floor)", // teal ~160 (floor dept hue)
  "var(--brand-orange-dark)", // warm orange ~30-40
  "var(--dept-storage)", // cyan ~200
  "var(--komm-quiz)", // rose ~340
];

function avatarColor(profileId: string): string {
  // Stable color derived from profile ID — same person always gets same color
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) {
    hash = (hash * 31 + profileId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

// ══════════════════════════════════════════════════════════════
// Time helpers
// ══════════════════════════════════════════════════════════════

function toTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatElapsed(fromIso: string): string {
  const ms = Date.now() - new Date(fromIso).getTime();
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}t ${minutes}m`;
  return `${minutes}m`;
}

function minutesUntil(isoTime: string): number {
  return Math.round((new Date(isoTime).getTime() - Date.now()) / 60_000);
}

/** Returns the start of today and end of today in ISO format (local TZ aware) */
function todayRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Today formatted as "24. mars" in Norwegian */
function todayLabel(): string {
  return new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long" });
}

// ══════════════════════════════════════════════════════════════
// Query keys
// ══════════════════════════════════════════════════════════════

const leaderKeys = {
  scheduledShifts: (workspaceId: string) => ["leader-overview-shifts", workspaceId] as const,
  activeEntries: (workspaceId: string) => ["leader-overview-entries", workspaceId] as const,
};

// ══════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════

export function LeaderOverview() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  // ── Query: today's scheduled shifts with profile + department ──
  const shiftsQuery = useQuery<ScheduledEmployee[]>({
    queryKey: leaderKeys.scheduledShifts(workspace.workspace_id),
    queryFn: async () => {
      const supabase = createClient();
      const { from, to } = todayRange();

      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          `schedule_shift_id, employee_id, start_time, end_time, role,
           department_id,
           profile:employee_id ( display_name ),
           department:department_id ( name )`,
        )
        .eq("workspace_id", workspace.workspace_id)
        .gte("start_time", from)
        .lte("start_time", to)
        .not("employee_id", "is", null)
        .order("start_time", { ascending: true });

      if (error) throw error;

      // Supabase join returns an array for 1:1 relations via FK — normalise to object
      return (data ?? []).map((row) => ({
        ...row,
        profile: Array.isArray(row.profile) ? (row.profile[0] ?? null) : row.profile,
        department: Array.isArray(row.department) ? (row.department[0] ?? null) : row.department,
      })) as ScheduledEmployee[];
    },
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });

  // ── Query: active time entries for the workspace today ───────
  const entriesQuery = useQuery<ActiveEntry[]>({
    queryKey: leaderKeys.activeEntries(workspace.workspace_id),
    queryFn: async () => {
      const supabase = createClient();
      const { from } = todayRange();

      const { data, error } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .select("time_entry_id, profile_id, shift_id, punch_in, punch_out, breaks")
        .eq("workspace_id", workspace.workspace_id)
        .gte("punch_in", from)
        .is("punch_out", null);

      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 90_000,
    refetchIntervalInBackground: false,
  });

  // ── Realtime: invalidate queries when time_entry changes ─────
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`leader-overview-${workspace.workspace_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "timesheet",
          table: "time_entry",
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: leaderKeys.activeEntries(workspace.workspace_id),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspace.workspace_id, queryClient]);

  // ── Mutation: manual punch-in by leader ───────────────────────
  const manualPunchMutation = useMutation({
    mutationFn: async ({
      targetProfileId,
      shiftId,
    }: {
      targetProfileId: string;
      shiftId: string;
    }) => {
      const supabase = createClient();
      const now = new Date().toISOString();

      const { error } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .insert({
          shift_id: shiftId,
          profile_id: targetProfileId,
          workspace_id: workspace.workspace_id,
          punch_in: now,
          breaks: [] as unknown as Json,
        });

      if (error) throw error;

      // Update shift status to active so other views reflect reality
      await supabase
        .from("schedule_shift")
        .update({ status: "active" })
        .eq("schedule_shift_id", shiftId);

      void emit({
        event: "shift punched_in",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity_type: "shift" as const,
          entity_id: shiftId,
          data: {
            shift_id: shiftId,
            time_entry_id: "",
            punch_time: now,
            is_adhoc: false,
            gps_verified: false,
            gps_distance_meters: null,
          },
        },
      });
    },

    onSuccess: () => {
      toast.success("Ansatt stemplet inn manuelt");
      void queryClient.invalidateQueries({
        queryKey: leaderKeys.activeEntries(workspace.workspace_id),
      });
    },

    onError: () => {
      toast.error("Kunne ikke stemple inn ansatt");
    },
  });

  // ── Derive card data from shifts + entries ───────────────────
  const cards: EmployeeCard[] = useMemo(() => {
    const shifts = shiftsQuery.data ?? [];
    const entries = entriesQuery.data ?? [];

    // Build a lookup map: profile_id → active entry
    const entryByProfile = new Map<string, ActiveEntry>();
    for (const entry of entries) {
      entryByProfile.set(entry.profile_id, entry);
    }

    return shifts.map((shift): EmployeeCard => {
      const name = shift.profile?.display_name || "Ukjent";
      const department = shift.department?.name ?? "—";
      const role = shift.role ?? "—";

      // employee_id maps to profile.profile_id via FK schedule_shift_employee_id_fkey
      const entry = entryByProfile.get(shift.employee_id ?? "") ?? null;

      let status: EmployeeCard["status"] = "waiting";
      let workDuration: string | null = null;
      let breakDuration: string | null = null;
      let punchInLabel: string | null = null;

      if (entry) {
        const breaks = (entry.breaks as Array<{ start: string; end: string | null }> | null) ?? [];
        const hasOpenBreak = breaks.some((b) => b.end === null);
        status = hasOpenBreak ? "on_break" : "clocked_in";
        punchInLabel = toTimeLabel(entry.punch_in);
        workDuration = formatElapsed(entry.punch_in);

        if (hasOpenBreak) {
          const openBreak = breaks.find((b) => b.end === null);
          breakDuration = openBreak ? formatElapsed(openBreak.start) : null;
        }
      }

      const minsUntil = minutesUntil(shift.start_time);

      return {
        schedule_shift_id: shift.schedule_shift_id,
        profile_id: shift.employee_id ?? "",
        name,
        role,
        department,
        shiftStart: shift.start_time,
        shiftStartLabel: toTimeLabel(shift.start_time),
        status,
        punchInTime: entry?.punch_in ?? null,
        punchInLabel,
        workDuration,
        breakDuration,
        minutesUntilStart: status === "waiting" ? minsUntil : null,
        timeEntryId: entry?.time_entry_id ?? null,
      };
    });
  }, [shiftsQuery.data, entriesQuery.data]);

  // ── Summary counts ────────────────────────────────────────────
  const countClocked = cards.filter((c) => c.status === "clocked_in").length;
  const countBreak = cards.filter((c) => c.status === "on_break").length;
  const countWaiting = cards.filter((c) => c.status === "waiting").length;

  const isLoading = shiftsQuery.isLoading || entriesQuery.isLoading;

  // ══════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-foreground text-2xl">Aktive vakter</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {workspace.name} · I dag {todayLabel()}
          </p>
        </div>

        {/* Status summary badges */}
        <div className="flex flex-wrap gap-2">
          <StatusPill color="var(--status-active)" label={`${countClocked} på vakt`} />
          <StatusPill color="var(--brand-orange)" label={`${countBreak} på pause`} />
          <StatusPill color="var(--muted-foreground)" label={`${countWaiting} venter`} />
        </div>
      </div>

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && cards.length === 0 && (
        <div className="border-border bg-card flex flex-col items-center justify-center gap-3 rounded-xl border py-16 text-center">
          <Users className="text-muted-foreground size-8" strokeWidth={1.5} />
          <p className="text-muted-foreground text-sm">Ingen planlagte vakter i dag</p>
        </div>
      )}

      {/* ── Employee card grid ── */}
      {!isLoading && cards.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <EmployeeShiftCard
              key={card.schedule_shift_id}
              card={card}
              onManualPunch={() =>
                manualPunchMutation.mutate({
                  targetProfileId: card.profile_id,
                  shiftId: card.schedule_shift_id,
                })
              }
              isPunching={manualPunchMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════

/** Small pill badge with a colored dot — used in the header summary row */
function StatusPill({ color, label }: { color: string; label: string }) {
  return (
    <div className="border-border bg-card text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}

/** Individual employee shift card */
function EmployeeShiftCard({
  card,
  onManualPunch,
  isPunching,
}: {
  card: EmployeeCard;
  onManualPunch: () => void;
  isPunching: boolean;
}) {
  const isWaiting = card.status === "waiting";
  const isOnBreak = card.status === "on_break";
  const isClockedIn = card.status === "clocked_in";

  // Border color reinforces the status at a glance
  const borderColor = isClockedIn
    ? "color-mix(in oklch, var(--success) 40%, transparent)" // green tint
    : isOnBreak
      ? "color-mix(in oklch, var(--brand-orange) 40%, transparent)" // orange tint
      : "var(--border)"; // neutral border from design token

  return (
    <div
      className="bg-card relative flex flex-col gap-3 rounded-xl border p-4 transition-all duration-300"
      style={{
        borderColor,
        opacity: isWaiting ? 0.65 : 1,
      }}
    >
      {/* Avatar + badge row */}
      <div className="flex items-center justify-between">
        <div
          className="flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: avatarColor(card.profile_id) }}
          aria-label={card.name}
        >
          {/* Initials */}
          {card.name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0]?.toUpperCase() ?? "")
            .join("")}
        </div>

        <StatusBadge status={card.status} />
      </div>

      {/* Name + role */}
      <div>
        <div className="text-foreground text-sm font-medium">{card.name}</div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          {card.role} · {card.department}
        </div>
      </div>

      {/* Timer row */}
      <div className="flex items-center justify-between text-xs">
        {isClockedIn && (
          <>
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" strokeWidth={1.5} />
              Inn: {card.punchInLabel}
            </span>
            <span className="text-foreground font-mono font-medium">{card.workDuration}</span>
          </>
        )}

        {isOnBreak && (
          <>
            <span className="text-muted-foreground flex items-center gap-1">
              <Coffee className="size-3" strokeWidth={1.5} />
              Pause: {card.breakDuration}
            </span>
            <span className="text-foreground font-mono font-medium">{card.workDuration}</span>
          </>
        )}

        {isWaiting && (
          <>
            <span className="text-muted-foreground">Starter: {card.shiftStartLabel}</span>
            <span className="text-muted-foreground font-mono">
              {card.minutesUntilStart !== null && card.minutesUntilStart > 0
                ? `om ${card.minutesUntilStart}m`
                : "nå"}
            </span>
          </>
        )}
      </div>

      {/* Manual punch button — only shown on waiting cards */}
      {isWaiting && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={onManualPunch}
          disabled={isPunching}
        >
          <LogIn className="size-3" strokeWidth={1.5} />
          Stemple inn manuelt
        </Button>
      )}
    </div>
  );
}

/** Status badge — maps phase to visual treatment */
function StatusBadge({ status }: { status: EmployeeCard["status"] }) {
  if (status === "clocked_in") {
    return (
      <Badge
        className="border-none text-[11px] font-semibold tracking-wide uppercase"
        style={{
          background: "color-mix(in oklch, var(--success) 15%, transparent)",
          color: "var(--success)",
        }}
      >
        På vakt
      </Badge>
    );
  }

  if (status === "on_break") {
    return (
      <Badge
        className="border-none text-[11px] font-semibold tracking-wide uppercase"
        style={{
          background: "color-mix(in oklch, var(--brand-orange) 15%, transparent)",
          color: "var(--brand-orange-dark)",
        }}
      >
        Pause
      </Badge>
    );
  }

  // waiting
  return (
    <Badge
      className="border-none text-[11px] font-semibold tracking-wide uppercase"
      style={{
        background: "color-mix(in oklch, var(--muted-foreground) 15%, transparent)",
        color: "var(--muted-foreground)",
      }}
    >
      Venter
    </Badge>
  );
}

/** Skeleton placeholder card shown during initial load */
function SkeletonCard() {
  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="bg-muted size-9 animate-pulse rounded-full" />
        <div className="bg-muted h-5 w-16 animate-pulse rounded-md" />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="bg-muted h-4 w-28 animate-pulse rounded" />
        <div className="bg-muted h-3 w-20 animate-pulse rounded" />
      </div>
      <div className="flex justify-between">
        <div className="bg-muted h-3 w-16 animate-pulse rounded" />
        <div className="bg-muted h-3 w-12 animate-pulse rounded" />
      </div>
    </div>
  );
}
