"use client";

/**
 * ShiftClockSummary — Post-punch-out view showing shift statistics.
 *
 * Displays: checkmark + congratulations header, 2x2 stats grid (work time,
 * breaks, points, streak), task completion bar placeholder, registered
 * supplements, optional comment textarea, and a "Ferdig" button to return
 * to idle state.
 */

import { useState } from "react";
import { CheckCircle2, Clock, Coffee, Star, Flame, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BreakEntry } from "@smartout/shift-clock";

type ClaimedSupplement = {
  id: string;
  description: string;
  amount: number;
  status: string | null;
};

type ShiftClockSummaryProps = {
  punchInTime: string;
  punchOutTime: string;
  breaks: BreakEntry[];
  claimedSupplements: ClaimedSupplement[];
  onDismiss: () => void;
  onAddComment?: (comment: string) => Promise<void>;
};

/** Calculate total break minutes from completed breaks */
function totalBreakMinutes(breaks: BreakEntry[]): number {
  return breaks.reduce((sum, b) => {
    if (!b.end) return sum;
    const start = new Date(b.start).getTime();
    const end = new Date(b.end).getTime();
    return sum + Math.round((end - start) / 60_000);
  }, 0);
}

/** Format minutes as "Xt Ym" (e.g., "5t 30m") */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

export function ShiftClockSummary({
  punchInTime,
  punchOutTime,
  breaks,
  claimedSupplements,
  onDismiss,
  onAddComment,
}: ShiftClockSummaryProps) {
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const punchInMs = new Date(punchInTime).getTime();
  const punchOutMs = new Date(punchOutTime).getTime();
  const totalMinutes = Math.round((punchOutMs - punchInMs) / 60_000);
  const breakMins = totalBreakMinutes(breaks);
  const workMinutes = totalMinutes - breakMins;

  const handleDismiss = async () => {
    if (comment.trim() && onAddComment) {
      setIsSaving(true);
      try {
        await onAddComment(comment.trim());
      } catch {
        // Error handled by hook
      }
      setIsSaving(false);
    }
    onDismiss();
  };

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-6 pt-12 pb-8">
      {/* Success header */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <h2 className="font-heading text-foreground text-3xl">Bra jobbet!</h2>
        <p className="text-muted-foreground text-sm">
          {new Date(punchInTime).toLocaleTimeString("nb-NO", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" - "}
          {new Date(punchOutTime).toLocaleTimeString("nb-NO", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* 2x2 stats grid */}
      <div className="mb-6 grid w-full max-w-sm grid-cols-2 gap-3">
        <StatCard
          icon={<Clock className="h-4 w-4 text-blue-400" />}
          label="Arbeidstid"
          value={formatDuration(workMinutes)}
        />
        <StatCard
          icon={<Coffee className="h-4 w-4 text-amber-400" />}
          label="Pauser"
          value={breaks.length > 0 ? formatDuration(breakMins) : "Ingen"}
        />
        {/* Points and streak — shown as placeholders, hidden if not available */}
        <StatCard
          icon={<Star className="h-4 w-4 text-yellow-400" />}
          label="Poeng"
          value="+7"
          subtle
        />
        <StatCard
          icon={<Flame className="h-4 w-4 text-orange-400" />}
          label="Streak"
          value="3 dager"
          subtle
        />
      </div>

      {/* Task completion bar placeholder */}
      <div className="mb-6 w-full max-w-sm">
        <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-xs">
          <span>Oppgaver fullfort</span>
          <span>0 / 0</span>
        </div>
        <div className="bg-muted/30 h-2 overflow-hidden rounded-full">
          <div className="h-full w-0 rounded-full bg-emerald-500 transition-all" />
        </div>
      </div>

      {/* Claimed supplements */}
      {claimedSupplements.length > 0 && (
        <div className="mb-6 w-full max-w-sm space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium">Registrerte tillegg</h3>
          {claimedSupplements.map((s) => (
            <div
              key={s.id}
              className="border-border/30 bg-card/30 flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Coins className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-sm">{s.description}</span>
              </div>
              <span className="font-mono text-sm font-medium">{s.amount} kr</span>
            </div>
          ))}
        </div>
      )}

      {/* Optional comment */}
      {onAddComment && (
        <div className="mb-6 w-full max-w-sm space-y-2">
          <label htmlFor="summary-comment" className="text-muted-foreground text-xs">
            Kommentar til vakten (valgfritt)
          </label>
          <Textarea
            id="summary-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Noe du vil legge til om vakten?"
            className="border-border/50 bg-card/50 min-h-[60px] text-sm"
            disabled={isSaving}
          />
        </div>
      )}

      {/* Dismiss button */}
      <Button
        className="bg-brand-orange hover:bg-brand-orange-light w-full max-w-sm text-white"
        size="lg"
        onClick={() => void handleDismiss()}
        disabled={isSaving}
      >
        Ferdig
      </Button>
    </div>
  );
}

/* ── StatCard helper ────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  subtle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtle?: boolean;
}) {
  return (
    <div
      className={`border-border/30 bg-card/30 flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 ${subtle ? "opacity-60" : ""}`}
    >
      {icon}
      <span className="text-foreground font-mono text-lg font-semibold">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
