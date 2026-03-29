"use client";

/**
 * ShiftClockHeader — Displays live elapsed time, status badge, and shift details.
 *
 * The timer updates every second via setInterval. Uses monospace font (Geist Mono)
 * for the time display to prevent layout shift. Status badge toggles between
 * green "PA VAKT" and orange "PAUSE".
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type ShiftClockHeaderProps = {
  punchInTime: string;
  isOnBreak: boolean;
  department?: string;
  zone?: string;
};

/** Format seconds into HH:MM:SS */
function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function ShiftClockHeader({
  punchInTime,
  isOnBreak,
  department,
  zone,
}: ShiftClockHeaderProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startMs = new Date(punchInTime).getTime();

    const tick = () => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [punchInTime]);

  return (
    <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-4">
      {/* Live elapsed timer */}
      <div className="text-foreground font-mono text-5xl font-bold tracking-tight">
        {formatTimer(elapsed)}
      </div>

      {/* Status badge */}
      <Badge
        variant="outline"
        className={
          isOnBreak
            ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
        }
      >
        {isOnBreak ? "PAUSE" : "PA VAKT"}
      </Badge>

      {/* Department and zone info */}
      {(department || zone) && (
        <div className="text-muted-foreground flex gap-2 text-xs">
          {department && <span>{department}</span>}
          {department && zone && <span>·</span>}
          {zone && <span>{zone}</span>}
        </div>
      )}
    </div>
  );
}
