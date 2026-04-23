"use client";

/**
 * AvailabilitySidebar — per-profile availability overlay for RosterTab.
 *
 * Renders a compact list of workspace profiles with their availability
 * status for a single day. Used by managers to spot "who can I reach out
 * to" when a shift opens up, or "why is X unavailable?" when reviewing
 * a roster.
 *
 * Council 2026-04-23 frontend-designer spec:
 * - Sort: available → preferred → unavailable → absent
 * - Status dot (Lucide Circle) + label + optional reason
 * - Hover tooltip with full reason text (manager sees reason regardless
 *   of per-profile visibility per ADR-0202 / plan acceptance criteria)
 * - Empty state: informational, not dead-end (Invariant #13-style)
 *
 * Data source: Task L's `useTeamAvailability` hook (web). Until that
 * hook lands, the import is TODO-stubbed (see `RosterTab.tsx`).
 */
import { Circle } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Resolved per-profile status for a single day.
 *  `absent` is derived from `schedule_absence` by Task L's hook; the
 *  other three statuses come from `employee_availability.preference_type`
 *  (with `blocked` collapsed to `unavailable` for display — a manager
 *  doesn't need to distinguish at this glance layer). */
export type AvailabilityStatus = "available" | "preferred" | "unavailable" | "absent";

export type ProfileAvailability = {
  profile_id: string;
  display_name: string;
  status: AvailabilityStatus;
  /** Optional reason text — null when the row has no reason or the
   *  manager is not allowed to see it. */
  reason: string | null;
};

/** Sort order: available first (most useful to a manager), then
 *  preferred, then unavailable, then absent. Within the same bucket,
 *  alphabetical by display_name for stability. */
const STATUS_ORDER: Record<AvailabilityStatus, number> = {
  available: 0,
  preferred: 1,
  unavailable: 2,
  absent: 3,
};

const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  available: "Tilgjengelig",
  preferred: "Foretrukket",
  unavailable: "Opptatt",
  absent: "Fraværende",
};

const STATUS_COLOR: Record<AvailabilityStatus, string> = {
  available: "text-success",
  preferred: "text-accent",
  unavailable: "text-muted-foreground",
  absent: "text-destructive",
};

function toInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function sortByStatusThenName(a: ProfileAvailability, b: ProfileAvailability): number {
  const bucket = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (bucket !== 0) return bucket;
  return a.display_name.localeCompare(b.display_name, "nb");
}

export function AvailabilitySidebar({
  profiles,
  isLoading,
}: {
  profiles: ProfileAvailability[];
  isLoading: boolean;
}) {
  const sorted = [...profiles].sort(sortByStatusThenName);
  const showEmpty = !isLoading && sorted.length === 0;

  return (
    <div className="space-y-3">
      <h3 className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
        Tilgjengelighet
      </h3>
      <div className="bg-card border-border overflow-hidden rounded-[14px] border">
        {isLoading ? (
          <div className="text-muted-foreground px-4 py-3 text-[11px]">Laster tilgjengelighet…</div>
        ) : showEmpty ? (
          <div className="text-muted-foreground px-4 py-3 text-[11px]">
            Ingen tilgjengelighets-data for denne dagen
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <ul className="divide-border divide-y">
              {sorted.map((p) => (
                <AvailabilityRow key={p.profile_id} profile={p} />
              ))}
            </ul>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

function AvailabilityRow({ profile }: { profile: ProfileAvailability }) {
  const colorClass = STATUS_COLOR[profile.status];
  const label = STATUS_LABEL[profile.status];
  const row = (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Avatar size="sm">
        <AvatarFallback>{toInitials(profile.display_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{profile.display_name}</div>
        {profile.reason ? (
          <div className="text-muted-foreground truncate text-[11px]">{profile.reason}</div>
        ) : null}
      </div>
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${colorClass}`}>
        <Circle aria-hidden className="h-2 w-2 fill-current" />
        {label}
      </span>
    </li>
  );

  // Tooltip only adds value when a reason exists. No reason = no tooltip,
  // avoiding the dead-hover footprint on every row.
  if (!profile.reason) return row;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="left" className="max-w-[260px]">
        {profile.reason}
      </TooltipContent>
    </Tooltip>
  );
}
