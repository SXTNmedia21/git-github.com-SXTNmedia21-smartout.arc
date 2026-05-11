"use client";

/**
 * ManualTimeEntryDialog — payroll-surface admin dialog for correcting punch-in/out on a shift.
 *
 * What: Dialog that lets an admin retroactively set or correct time-entry data for a
 * specific shift. Wraps the existing `manualTimeEntryAction` server action — this component
 * owns the UI only; the server action owns auth, gating, and the DB write.
 *
 * Why: ADR-0251 "100% Transparency" — lønnsgrunnlaget must trace to actual worked hours.
 * When a manager spots a wrong punch in the payroll period view, they need to correct it
 * without leaving the payroll context. This dialog is mounted on each CalcRow in LineDrawer's
 * Vakter-tab.
 *
 * Gate: `shift.manual_time_entry` capability (admin-only per authority seed).
 * Telemetry: emitted by the server action (`shift punched_in`, `manual=true`). No second emit.
 * Audit: written to `timesheet.time_entry` with `source='manual'`, `status='edited'` + notes.
 *
 * Nordic Split: Dialog surface, Geist Mono for time inputs, Instrument Serif for title.
 * ADR-0133: Web-only authoring surface.
 */

import { useTransition, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { manualTimeEntryAction } from "@/app/dashboard/_actions/manual-time-entry-action";
import { payrollKeys } from "../../_hooks/payroll-keys";

// ─── Constants ───────────────────────────────────────────────────────────────

const MIN_REASON_LENGTH = 8;

// ─── Datetime helpers ────────────────────────────────────────────────────────

/**
 * Converts a `<input type="datetime-local">` string (browser local-tz) to UTC ISO.
 * Server action expects `z.string().datetime()` = UTC ISO.
 */
function localToISO(value: string): string {
  return new Date(value).toISOString();
}

/**
 * Builds the datetime-local default from a full ISO timestamp.
 * Extracts `YYYY-MM-DDTHH:mm` which the datetime-local input accepts.
 */
function isoToDatetimeLocal(iso: string): string {
  try {
    const d = new Date(iso);
    // Pad to YYYY-MM-DDTHH:mm in local time
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

export type ManualTimeEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** UUID of the shift to correct. Passed directly to the server action. */
  shiftId: string;
  /** ISO timestamp — used to pre-fill the punch-in datetime-local input. */
  scheduledStart: string;
  /** ISO timestamp — used to pre-fill the punch-out datetime-local input. */
  scheduledEnd: string;
  /** Used for query invalidation after a successful write. */
  periodId: string;
  /** Used for granular calculation-row invalidation. */
  profileId: string;
  /** Display label shown in the dialog title (e.g. "Mandag 12. mai 08:00 — 16:00"). */
  shiftLabel?: string;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ManualTimeEntryDialog({
  open,
  onOpenChange,
  shiftId,
  scheduledStart,
  scheduledEnd,
  periodId,
  profileId,
  shiftLabel,
}: ManualTimeEntryDialogProps) {
  const [punchIn, setPunchIn] = useState(() => isoToDatetimeLocal(scheduledStart));
  const [punchOut, setPunchOut] = useState(() => isoToDatetimeLocal(scheduledEnd));
  const [noPunchOut, setNoPunchOut] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const qc = useQueryClient();

  const reasonTrimmed = reason.trim();
  const reasonTooShort = reasonTrimmed.length < MIN_REASON_LENGTH;
  const remaining = MIN_REASON_LENGTH - reasonTrimmed.length;
  const canSubmit = !reasonTooShort && punchIn.length > 0 && (noPunchOut || punchOut.length > 0);

  function handleClose() {
    if (isPending) return;
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        const result = await manualTimeEntryAction({
          shiftId,
          punchedInAt: localToISO(punchIn),
          punchedOutAt: noPunchOut ? null : localToISO(punchOut),
          reason: reasonTrimmed,
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        toast.success("Tidsregistrering korrigert. Loggført i revisjonsloggen.");

        // Invalidate the per-profile calculation rows shown in Vakter-tab
        void qc.invalidateQueries({
          queryKey: payrollKeys.calculations(periodId, profileId),
        });
        // Invalidate the aggregated period lines (updates totals in LinesTable)
        void qc.invalidateQueries({
          queryKey: payrollKeys.lines(periodId),
        });

        // Reset form and close
        setReason("");
        setNoPunchOut(false);
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ukjent feil.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Korriger tidsregistrering
            {shiftLabel ? (
              <span className="text-muted-foreground ml-1.5 text-sm font-normal">
                — {shiftLabel}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1.5 text-sm">
              <p>
                Sett eller korriger stemple-tidene for denne vakten. Brukes når ansatt glemte å
                stemple, eller når admin må justere retroaktivt.
              </p>
              <p className="text-muted-foreground text-xs">
                Lagres som <code className="font-mono">source=manual</code> i timeregistreringen med
                din profil som aktør og begrunnelse i notater.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Punch-in / punch-out */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor={`te-punch-in-${shiftId}`} className="text-sm font-medium">
                Inn-stempling
              </label>
              <input
                id={`te-punch-in-${shiftId}`}
                type="datetime-local"
                value={punchIn}
                onChange={(e) => setPunchIn(e.target.value)}
                required
                className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`te-punch-out-${shiftId}`} className="text-sm font-medium">
                Ut-stempling
              </label>
              <input
                id={`te-punch-out-${shiftId}`}
                type="datetime-local"
                value={punchOut}
                onChange={(e) => setPunchOut(e.target.value)}
                disabled={noPunchOut}
                className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* Still on shift */}
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={noPunchOut}
              onChange={(e) => setNoPunchOut(e.target.checked)}
              className="rounded"
            />
            <span className="text-muted-foreground">
              Ansatt er fortsatt på vakt (ingen ut-stempling ennå)
            </span>
          </label>

          {/* Reason */}
          <div className="space-y-1.5">
            <label htmlFor={`te-reason-${shiftId}`} className="text-sm font-medium">
              Begrunnelse{" "}
              <span className="text-muted-foreground font-normal">
                (minst {MIN_REASON_LENGTH} tegn)
              </span>
            </label>
            <textarea
              id={`te-reason-${shiftId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="F.eks. Ansatt glemte å stemple ut kl 22:00, bekreftet over telefon."
              className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-describedby={`te-reason-hint-${shiftId}`}
            />
            <p
              id={`te-reason-hint-${shiftId}`}
              className={
                reasonTooShort ? "text-destructive text-xs" : "text-muted-foreground text-xs"
              }
              aria-live="polite"
            >
              {reasonTooShort ? `${remaining} tegn igjen før du kan lagre.` : "Klar til å lagre."}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Avbryt
            </Button>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
              Lagre korreksjon
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
