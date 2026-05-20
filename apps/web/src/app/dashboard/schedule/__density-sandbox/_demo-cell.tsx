"use client";

// _demo-cell.tsx
// Why: visual canvas for each density tier — renders a single grid cell
// (one employee × one day) with all shift fixtures.
// This is NOT production code — it's the exploration surface Pontus reviews
// before approving live integration in T5.

import { AlertCircle, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { DensityStrip, SHIFT_INDICATOR_STYLES_MAP } from "../_components/density-strip";
import { formatTimeShort, formatTimeFull } from "../_utils/format-time";
import type { ScheduleDensity } from "../_components/density-selector";
import type { ShiftFixture } from "./_fixtures";

// ── Helper: derive dominant indicator for heatmap color ──────────────────────

function dominantIndicator(shifts: ShiftFixture[]): string {
  // Simple majority: first non-conflict shift wins in V1
  const primary = shifts.find((s) => !s.hasConflict) ?? shifts[0];
  return primary?.indicator ?? "orange";
}

// ── Cozy cell (120px) ────────────────────────────────────────────────────────

function CozyShiftCard({ shift }: { shift: ShiftFixture }) {
  const fullTime = formatTimeFull(shift.startTime, shift.endTime);
  const hours = (() => {
    const startParts = shift.startTime.split(":");
    const endParts = shift.endTime.split(":");
    const sh = Number(startParts[0] ?? "0");
    const sm = Number(startParts[1] ?? "0");
    let eh = Number(endParts[0] ?? "0");
    const em = Number(endParts[1] ?? "0");
    // cross-midnight adjustment
    if (eh < sh) eh += 24;
    const total = (eh - sh) * 60 + (em - sm);
    return (total / 60).toFixed(1).replace(".0", "") + "t";
  })();

  return (
    <div
      title={shift.hasConflict ? "Overlappende vakter" : fullTime}
      className={cn(
        "relative flex flex-col gap-1.5 overflow-hidden rounded-lg border p-2.5",
        "bg-card border-border",
        shift.hasConflict && "ring-destructive/60 ring-2",
      )}
    >
      <DensityStrip indicator={shift.indicator} hasConflict={!!shift.hasConflict} tier="cozy" />
      <div className="pl-2">
        <div className="flex items-start justify-between">
          <span className="text-foreground line-clamp-1 text-xs leading-tight font-semibold">
            {shift.role}
          </span>
          {shift.hasConflict && (
            <AlertCircle className="text-destructive ml-1 h-3.5 w-3.5 shrink-0" />
          )}
        </div>
        {shift.zone && (
          <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{shift.zone}</span>
          </div>
        )}
        <div className="text-muted-foreground mt-auto flex items-center gap-1 pt-1 text-[10px]">
          <Clock className="h-2.5 w-2.5" />
          <span>{fullTime}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>{hours}</span>
        </div>
      </div>
    </div>
  );
}

// ── Default cell (100px) ─────────────────────────────────────────────────────

function DefaultShiftCard({ shift }: { shift: ShiftFixture }) {
  const fullTime = formatTimeFull(shift.startTime, shift.endTime);

  return (
    <div
      title={shift.hasConflict ? "Overlappende vakter" : fullTime}
      className={cn(
        "relative flex flex-col gap-2 overflow-hidden rounded-lg border p-2",
        "bg-card border-border",
        shift.hasConflict && "ring-destructive/60 ring-2",
      )}
    >
      <DensityStrip indicator={shift.indicator} hasConflict={!!shift.hasConflict} tier="default" />
      <div className="pl-2">
        <div className="flex items-start justify-between">
          <span className="text-foreground line-clamp-1 text-sm leading-tight font-semibold">
            {shift.role}
          </span>
          {shift.hasConflict && (
            <AlertCircle className="text-destructive ml-1 h-3.5 w-3.5 shrink-0" />
          )}
        </div>
        {shift.zone && (
          <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px]">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{shift.zone}</span>
          </div>
        )}
        <div className="text-muted-foreground mt-auto flex items-center gap-1 pt-1 text-xs">
          <Clock className="h-3 w-3" />
          <span>{fullTime}</span>
        </div>
      </div>
    </div>
  );
}

// ── Compact cell (52px) ──────────────────────────────────────────────────────

function CompactShiftCard({ shift }: { shift: ShiftFixture }) {
  const shortTime = formatTimeShort(shift.startTime, shift.endTime);
  const fullTime = formatTimeFull(shift.startTime, shift.endTime);

  return (
    <div
      title={shift.hasConflict ? `Overlappende vakter — ${fullTime}` : fullTime}
      className={cn(
        "relative flex items-center gap-2 overflow-hidden rounded-md border px-2 py-1",
        "bg-card border-border",
        shift.hasConflict && "ring-destructive/60 ring-2",
      )}
    >
      <DensityStrip indicator={shift.indicator} hasConflict={!!shift.hasConflict} tier="compact" />
      <span className="text-foreground truncate pl-1 text-[11px] leading-tight font-semibold">
        {shift.role}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {shift.hasConflict && <AlertCircle className="text-destructive h-3 w-3" />}
        <span className="text-muted-foreground text-[10px] font-medium">{shortTime}</span>
      </div>
    </div>
  );
}

// ── Pulse cell variants ───────────────────────────────────────────────────────

/** 28px heatmap baseline — no conflict, solid role color */
function PulseHeatmapCell({ shifts }: { shifts: ShiftFixture[] }) {
  const indicator = dominantIndicator(shifts);
  const colorClass =
    SHIFT_INDICATOR_STYLES_MAP[indicator as keyof typeof SHIFT_INDICATOR_STYLES_MAP] ??
    "bg-orange-400/40";

  return (
    <div
      title={shifts.map((s) => formatTimeFull(s.startTime, s.endTime)).join(", ")}
      className={cn("h-7 w-full rounded-md", colorClass)}
    />
  );
}

/** 40px mini-card escape — has conflict, strip + initials + short time */
function PulseMiniCard({ shift, initials }: { shift: ShiftFixture; initials: string }) {
  const shortTime = formatTimeShort(shift.startTime, shift.endTime);
  const fullTime = formatTimeFull(shift.startTime, shift.endTime);

  return (
    <div
      title={`Konflikt — ${fullTime}`}
      className={cn(
        "relative flex items-center gap-1.5 overflow-hidden rounded-md border px-1.5 py-1",
        "bg-card border-destructive/40",
        "ring-destructive/60 h-10 ring-2",
      )}
    >
      <DensityStrip indicator={shift.indicator} hasConflict={true} tier="pulse" />
      <span className="text-foreground pl-1 text-[10px] font-bold">{initials}</span>
      <span className="text-muted-foreground ml-auto text-[10px] font-medium">{shortTime}</span>
    </div>
  );
}

// ── Public DemoCell ───────────────────────────────────────────────────────────

type DemoCellProps = {
  tier: ScheduleDensity;
  shifts: ShiftFixture[];
  /** Used by Pulse mini-card for role initials */
  employeeInitials: string;
};

/**
 * DemoCell — renders one grid cell for the sandbox.
 * Switches layout based on `tier`. This is the visual exploration canvas.
 */
export function DemoCell({ tier, shifts, employeeInitials }: DemoCellProps) {
  // ── Empty cell ────────────────────────────────────────────────────────────
  if (shifts.length === 0) {
    if (tier === "pulse") {
      return <div className="bg-muted/20 h-7 w-full rounded-md" />;
    }
    return (
      <div
        className={cn(
          "border-border/30 rounded-lg border border-dashed",
          tier === "cozy" && "h-[120px]",
          tier === "default" && "h-[100px]",
          tier === "compact" && "h-[52px]",
        )}
      />
    );
  }

  const hasAnyConflict = shifts.some((s) => s.hasConflict);

  // ── Pulse ─────────────────────────────────────────────────────────────────
  if (tier === "pulse") {
    if (hasAnyConflict) {
      // Conflict escape: render mini-cards for conflicting shifts
      return (
        <div className="flex flex-col gap-0.5">
          {shifts.map((shift) => (
            <PulseMiniCard key={shift.id} shift={shift} initials={employeeInitials} />
          ))}
        </div>
      );
    }
    // Heatmap baseline
    return <PulseHeatmapCell shifts={shifts} />;
  }

  // ── Cozy ──────────────────────────────────────────────────────────────────
  if (tier === "cozy") {
    return (
      <div
        className={cn(
          "flex flex-col gap-1.5",
          // Fixed row height — multiple shifts stack; no blowup by design (sandbox shows stacking)
          shifts.length === 1 && "h-[120px]",
        )}
      >
        {shifts.map((shift) => (
          <CozyShiftCard key={shift.id} shift={shift} />
        ))}
      </div>
    );
  }

  // ── Default ───────────────────────────────────────────────────────────────
  if (tier === "default") {
    return (
      <div className={cn("flex flex-col gap-1", shifts.length === 1 && "h-[100px]")}>
        {shifts.map((shift) => (
          <DefaultShiftCard key={shift.id} shift={shift} />
        ))}
      </div>
    );
  }

  // ── Compact ───────────────────────────────────────────────────────────────
  return (
    <div className={cn("flex flex-col gap-1", shifts.length === 1 && "h-[52px]")}>
      {shifts.map((shift) => (
        <CompactShiftCard key={shift.id} shift={shift} />
      ))}
    </div>
  );
}
