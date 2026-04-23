"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useRoster } from "@/app/dashboard/_hooks/use-roster";
import { useTeamAvailability } from "@/app/dashboard/_hooks/use-team-availability";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import type { DayShift, DeptKey } from "@smartout/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { manualTimeEntryAction } from "@/app/dashboard/_actions/manual-time-entry-action";
import { AddShiftDialog } from "@/components/day/AddShiftDialog";
import {
  AvailabilitySidebar,
  type ProfileAvailability,
} from "@/components/day/AvailabilitySidebar";

const MIN_REASON_LENGTH = 8;

/**
 * ISO-ify a `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm` in the
 * browser's local tz). Returns UTC ISO string the Server Action expects.
 */
function localToISO(value: string): string {
  // `new Date("YYYY-MM-DDTHH:mm")` interprets as local time.
  return new Date(value).toISOString();
}

/**
 * Given an HH:MM string and the session date (YYYY-MM-DD), build the
 * `datetime-local` default the browser accepts: `YYYY-MM-DDTHH:mm`.
 */
function defaultDatetimeLocal(dateISO: string, hhmm: string): string {
  if (!hhmm || hhmm === "—") return `${dateISO}T12:00`;
  // Strip seconds if the HH:MM came with extra precision
  const clean = hhmm.length >= 5 ? hhmm.slice(0, 5) : hhmm;
  return `${dateISO}T${clean}`;
}

export function RosterTab({
  departmentId,
  dateISO,
  deptKey,
}: {
  departmentId: string;
  dateISO: string;
  deptKey: DeptKey;
}) {
  const q = useRoster(departmentId, dateISO);
  const wsCtx = useWorkspaceOptional();
  const workspaceId = wsCtx?.workspace.workspace_id;
  const availability = useTeamAvailability({
    // Hook gates on Boolean(workspaceId); empty string keeps the call
    // disabled until the context resolves.
    workspaceId: workspaceId ?? "",
    departmentId,
    dateISO,
  });

  const shifts: DayShift[] = useMemo(
    () =>
      (q.data ?? []).map((r) => ({
        id: r.shiftId,
        displayName: r.employeeName,
        role: r.role,
        initials: r.initials,
        deptKey,
        start: r.startTime,
        end: r.endTime,
        status: r.status,
        live: r.live,
        breakState: r.onBreak ? "pause" : null,
        plannedHours: r.plannedHours,
        actualHours: r.actualHours,
      })),
    [q.data, deptKey],
  );

  // Adapt Task L's hook result to AvailabilitySidebar's row shape. The
  // hook emits at most three statuses today (`available | unavailable |
  // preferred`); `absent` is reserved for a future absence-aware
  // selector and passes through if the hook ever starts emitting it.
  const availabilityProfiles: ProfileAvailability[] = useMemo(
    () =>
      (availability.data?.profiles ?? []).map((p) => ({
        profile_id: p.profile_id,
        display_name: p.display_name,
        status: p.daily_status,
        reason: p.reason ?? null,
      })),
    [availability.data],
  );

  const sidebar = (
    <AvailabilitySidebar profiles={availabilityProfiles} isLoading={availability.isLoading} />
  );

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        {sidebar}
        <div className="text-muted-foreground text-[13px]">Laster bemanning…</div>
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className="space-y-4">
        {sidebar}
        <div className="bg-card border-border flex flex-col items-center gap-3 rounded-[14px] border p-6 text-center">
          <h3 className="font-heading text-[18px]">Ingen vakter på denne dagen</h3>
          <p className="text-muted-foreground max-w-[360px] text-[13px]">
            Opprett en vakt direkte her — eller planlegg en hel uke via{" "}
            <code className="text-foreground font-mono text-[12px]">/dashboard/schedule</code>.
          </p>
          <AddShiftDialog dateISO={dateISO} departmentId={departmentId} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sidebar}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
            Bemanning
          </h3>
          <AddShiftDialog
            dateISO={dateISO}
            departmentId={departmentId}
            triggerVariant="ghost"
            triggerLabel="Legg til vakt"
          />
        </div>
        <div className="bg-card border-border overflow-hidden rounded-[14px] border">
          <div className="text-muted-foreground bg-muted border-border grid grid-cols-[100px_1fr_120px_120px_110px_56px] border-b px-4 py-2.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
            <span>Tid</span>
            <span>Person</span>
            <span>Planlagt</span>
            <span>Faktisk</span>
            <span>Status</span>
            <span className="sr-only">Rediger</span>
          </div>
          <div className="grid gap-0">
            {shifts.map((s) => (
              <RosterRowView key={s.id} shift={s} dateISO={dateISO} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RosterRowView({ shift, dateISO }: { shift: DayShift; dateISO: string }) {
  const statusColor =
    shift.status === "active"
      ? "text-[color:var(--success)]"
      : shift.status === "completed"
        ? "text-muted-foreground"
        : "text-[color:var(--info)]";
  const statusDot =
    shift.status === "active"
      ? "bg-[color:var(--success)]"
      : shift.status === "completed"
        ? "bg-muted-foreground"
        : "bg-[color:var(--info)]";
  const statusLabel =
    shift.status === "active"
      ? shift.breakState === "pause"
        ? "Pause"
        : "Aktiv"
      : shift.status === "completed"
        ? "Ferdig"
        : "Kommer";

  return (
    <div className="border-border grid grid-cols-[100px_1fr_120px_120px_110px_56px] items-center border-b px-4 py-3 text-[13px] last:border-b-0">
      <span className="font-mono text-[13px] font-semibold tabular-nums">
        {shift.start}–{shift.end}
      </span>
      <div>
        <div className="font-semibold">{shift.displayName}</div>
        <div className="text-muted-foreground text-[11px]">{shift.role}</div>
      </div>
      <span className="text-muted-foreground font-mono tabular-nums">
        {shift.plannedHours.toFixed(1)}t
      </span>
      <span className="font-mono font-semibold tabular-nums">{shift.actualHours.toFixed(1)}t</span>
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${statusColor}`}>
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${statusDot} ${shift.live ? "motion-safe:animate-pulse" : ""}`}
        />
        {statusLabel}
      </span>
      <div className="flex justify-end">
        <ManualTimeEntryDialog shift={shift} dateISO={dateISO} />
      </div>
    </div>
  );
}

/**
 * ManualTimeEntryDialog — admin retroactively sets punch-in/out for a shift.
 *
 * Pattern mirrors `AdminOverrideDialog`: controlled open-state, Zod-shaped
 * inputs at submit, mutation invalidates affected queries, toast on success.
 *
 * `<input type="datetime-local">` returns local time strings — we convert to
 * UTC ISO via `localToISO` before calling the Server Action.
 */
function ManualTimeEntryDialog({ shift, dateISO }: { shift: DayShift; dateISO: string }) {
  const [open, setOpen] = useState(false);
  const [punchIn, setPunchIn] = useState(() => defaultDatetimeLocal(dateISO, shift.start));
  const [punchOut, setPunchOut] = useState(() => defaultDatetimeLocal(dateISO, shift.end));
  const [noPunchOut, setNoPunchOut] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const qc = useQueryClient();

  const reasonTrimmed = reason.trim();
  const reasonTooShort = reasonTrimmed.length < MIN_REASON_LENGTH;
  const remaining = MIN_REASON_LENGTH - reasonTrimmed.length;
  const canSubmit = !reasonTooShort && punchIn.length > 0 && (noPunchOut || punchOut.length > 0);

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    startTransition(async () => {
      try {
        const result = await manualTimeEntryAction({
          shiftId: shift.id,
          punchedInAt: localToISO(punchIn),
          punchedOutAt: noPunchOut ? null : localToISO(punchOut),
          reason: reasonTrimmed,
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        toast.success("Tidsregistrering lagret. Loggført i revisjonsloggen.");
        qc.invalidateQueries({ queryKey: ["time-entries"] });
        qc.invalidateQueries({ queryKey: ["roster"] });
        qc.invalidateQueries({ queryKey: ["shift-approvals"] });
        // use-roster's query key starts with ["day-control", "roster", ...]
        qc.invalidateQueries({ queryKey: ["day-control", "roster"] });
        setReason("");
        setNoPunchOut(false);
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ukjent feil.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Rediger tidsregistrering for ${shift.displayName}`}
          className="h-8 w-8"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">
            Manuell tidsregistrering — {shift.displayName}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Sett eller korriger stemple-tidene for denne vakten. Brukes når ansatt glemte å
                stemple, eller når admin må justere retroaktivt.
              </p>
              <p className="text-muted-foreground">
                Handlingen lagres som <code className="font-mono">source=manual</code> i
                revisjonsloggen med din profil som aktør og begrunnelse i notater.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor={`punch-in-${shift.id}`} className="text-sm font-medium">
                Inn-stempling
              </label>
              <input
                id={`punch-in-${shift.id}`}
                type="datetime-local"
                value={punchIn}
                onChange={(e) => setPunchIn(e.target.value)}
                className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`punch-out-${shift.id}`} className="text-sm font-medium">
                Ut-stempling
              </label>
              <input
                id={`punch-out-${shift.id}`}
                type="datetime-local"
                value={punchOut}
                onChange={(e) => setPunchOut(e.target.value)}
                disabled={noPunchOut}
                className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={noPunchOut}
              onChange={(e) => setNoPunchOut(e.target.checked)}
            />
            <span className="text-muted-foreground">
              Ansatt er fortsatt på vakt (ingen ut-stempling)
            </span>
          </label>

          <div className="space-y-1.5">
            <label htmlFor={`reason-${shift.id}`} className="text-sm font-medium">
              Begrunnelse{" "}
              <span className="text-muted-foreground">(minst {MIN_REASON_LENGTH} tegn)</span>
            </label>
            <textarea
              id={`reason-${shift.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="F.eks. Ansatt glemte å stemple ut kl 22:00, bekreftet over telefon."
              className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-describedby={`reason-hint-${shift.id}`}
            />
            <p
              id={`reason-hint-${shift.id}`}
              className={
                reasonTooShort ? "text-destructive text-xs" : "text-muted-foreground text-xs"
              }
              aria-live="polite"
            >
              {reasonTooShort ? `${remaining} tegn igjen før du kan lagre.` : "Klar til å lagre."}
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={!canSubmit || isPending}>
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            Lagre tidsregistrering
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
