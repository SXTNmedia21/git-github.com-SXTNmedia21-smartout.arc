"use client";

/**
 * BreakToggle — Button that starts or ends a break.
 *
 * When clocked in: shows "Pause" button with Coffee icon.
 * When on break: shows elapsed break time in orange with a "Tilbake" button.
 * Uses GPS guard for snapshots at break start/end.
 */

import { useEffect, useState } from "react";
import { Coffee, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BreakEntry, GPSSnapshot } from "@smartout/shift-clock";

type BreakToggleProps = {
  isOnBreak: boolean;
  currentBreak: BreakEntry | null;
  onStartBreak: (gps?: GPSSnapshot | null) => Promise<void>;
  onEndBreak: (gps?: GPSSnapshot | null) => Promise<void>;
  isLoading?: boolean;
};

/** Format elapsed seconds into MM:SS or HH:MM:SS */
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function BreakToggle({
  isOnBreak,
  currentBreak,
  onStartBreak,
  onEndBreak,
  isLoading,
}: BreakToggleProps) {
  const [breakSeconds, setBreakSeconds] = useState(0);

  // Live break timer — ticks every second while on break
  useEffect(() => {
    if (!isOnBreak || !currentBreak) {
      setBreakSeconds(0);
      return;
    }

    const startMs = new Date(currentBreak.start).getTime();

    const tick = () => {
      setBreakSeconds(Math.floor((Date.now() - startMs) / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isOnBreak, currentBreak]);

  if (isOnBreak) {
    return (
      <Button
        variant="outline"
        className="flex h-auto flex-col items-center gap-2 rounded-2xl border-orange-500/30 bg-orange-500/10 px-4 py-4 transition-colors hover:bg-orange-500/20"
        onClick={() => void onEndBreak()}
        disabled={isLoading}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20">
          <Play className="h-5 w-5 text-orange-400" />
        </div>
        <span className="font-mono text-sm font-semibold text-orange-400">
          {formatElapsed(breakSeconds)}
        </span>
        <span className="text-xs text-orange-300/80">Tilbake fra pause</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      className="border-border/50 bg-card/50 hover:bg-card/80 flex h-auto flex-col items-center gap-2 rounded-2xl px-4 py-4 backdrop-blur-sm transition-colors"
      onClick={() => void onStartBreak()}
      disabled={isLoading}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
        <Coffee className="h-5 w-5 text-amber-400" />
      </div>
      <span className="text-muted-foreground text-xs">Pause</span>
    </Button>
  );
}
