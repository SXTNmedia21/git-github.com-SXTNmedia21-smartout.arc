"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import {
  ArrowDownUp,
  Building2,
  Clock as ClockIcon,
  Loader2,
  MapPin,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useRoster } from "@/app/dashboard/_hooks/use-roster";
import { useLiveShifts } from "@/app/dashboard/_hooks/use-live-shifts";
import { ShiftSheet } from "@/components/shift-timeline/ShiftSheet";
import type { DayShift, DeptKey } from "@smartout/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const isToday = dateISO === new Date().toISOString().slice(0, 10);
  const live = useLiveShifts();
  const liveEntries = isToday ? (live.data?.entries ?? []) : [];

  const rosterShifts: DayShift[] = useMemo(
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

  /**
   * Per memory L-`useRoster`-deptfilter — `useRoster` filters
   * `.eq("department_id", ...)` directly and misses rows where
   * `schedule_shift.department_id` is NULL (Cascade D1 denorm not
   * backfilled). When that happens, fall back to `useLiveShifts`
   * (workspace-scoped) so the grid still shows who's on today.
   * Mapped to DayShift shape with best-effort fields.
   */
  const fallbackFromLive: DayShift[] = useMemo(
    () =>
      liveEntries.map((e) => ({
        id: e.shiftId,
        displayName: e.employeeName,
        role: e.role,
        initials: e.employeeName
          .split(" ")
          .map((n) => n[0] ?? "")
          .join("")
          .toUpperCase()
          .slice(0, 2),
        deptKey,
        start: e.startTime ?? "—",
        end: "—",
        status:
          e.status === "clocked_in" || e.status === "on_break" ? "active" : "upcoming",
        live: e.status === "clocked_in" || e.status === "on_break",
        breakState: e.status === "on_break" ? "pause" : null,
        plannedHours: 0,
        actualHours: 0,
      })),
    [liveEntries, deptKey],
  );

  const shifts: DayShift[] =
    rosterShifts.length > 0 ? rosterShifts : fallbackFromLive;

  if (q.isLoading) {
    return <div className="text-muted-foreground text-[13px]">Laster bemanning…</div>;
  }

  if (shifts.length === 0) {
    return (
      <div className="bg-card border-border flex flex-col items-center gap-3 rounded-[14px] border p-6 text-center">
        <h3 className="font-heading text-[18px]">Ingen vakter på denne dagen</h3>
        <p className="text-muted-foreground max-w-[360px] text-[13px]">
          Opprett en vakt direkte her — eller planlegg en hel uke via{" "}
          <code className="text-foreground font-mono text-[12px]">/dashboard/schedule</code>.
        </p>
        <AddShiftDialog dateISO={dateISO} departmentId={departmentId} />
      </div>
    );
  }

  return <RosterGrid shifts={shifts} dateISO={dateISO} />;
}

type SortKey = "time" | "name" | "status";
type TimeBucket = "all" | "morning" | "lunch" | "evening" | "night";

const TIME_BUCKETS: { key: TimeBucket; label: string; range: [number, number]; Icon: typeof Sun }[] = [
  { key: "all", label: "Hele dagen", range: [0, 24], Icon: ClockIcon },
  { key: "morning", label: "Morgen", range: [0, 11], Icon: Sunrise },
  { key: "lunch", label: "Lunsj", range: [11, 16], Icon: Sun },
  { key: "evening", label: "Kveld", range: [16, 22], Icon: Sunset },
  { key: "night", label: "Natt", range: [22, 24], Icon: Moon },
];

function parseHour(hhmm: string): number {
  if (!hhmm || hhmm === "—") return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
}

function shiftOverlaps(shift: DayShift, range: [number, number]): boolean {
  const start = parseHour(shift.start);
  const end = parseHour(shift.end);
  const [from, to] = range;
  return start < to && end > from;
}

const STATUS_RANK: Record<string, number> = { active: 0, upcoming: 1, completed: 2 };

function RosterGrid({ shifts, dateISO }: { shifts: DayShift[]; dateISO: string }) {
  const [sort, setSort] = useState<SortKey>("time");
  const [bucket, setBucket] = useState<TimeBucket>("all");

  const filtered = useMemo(() => {
    const range = TIME_BUCKETS.find((b) => b.key === bucket)?.range ?? [0, 24];
    let list = bucket === "all" ? shifts : shifts.filter((s) => shiftOverlaps(s, range));
    list = [...list];
    if (sort === "time") {
      list.sort((a, b) => parseHour(a.start) - parseHour(b.start));
    } else if (sort === "name") {
      list.sort((a, b) => a.displayName.localeCompare(b.displayName, "nb"));
    } else if (sort === "status") {
      list.sort(
        (a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99),
      );
    }
    return list;
  }, [shifts, sort, bucket]);

  const onDuty = filtered.filter((s) => s.status === "active").length;
  const upcoming = filtered.filter((s) => s.status === "upcoming").length;
  const done = filtered.filter((s) => s.status === "completed").length;

  const [openShiftId, setOpenShiftId] = useState<string | null>(null);
  const openShift = openShiftId
    ? filtered.find((s) => s.id === openShiftId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Stats line */}
      <p className="text-muted-foreground text-xs">
        <span className="text-foreground font-semibold">{filtered.length}</span> på vakt
        {filtered.length !== shifts.length ? (
          <>
            {" "}
            <span className="text-muted-foreground/70">av {shifts.length}</span>
          </>
        ) : null}{" "}
        · <span className="text-[color:var(--success)] font-medium">{onDuty} aktive</span> ·{" "}
        <span className="text-[color:var(--info)] font-medium">{upcoming} kommer</span> ·{" "}
        <span className="text-muted-foreground">{done} ferdig</span>
      </p>

      {/* Filter rail */}
      <RosterFilters sort={sort} onSortChange={setSort} bucket={bucket} onBucketChange={setBucket} />

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="border-border bg-muted/20 rounded-2xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground text-sm">Ingen vakter matcher filteret.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s, i) => (
            <ProfileShiftCard
              key={s.id}
              shift={s}
              dateISO={dateISO}
              index={i}
              onOpen={() => setOpenShiftId(s.id)}
            />
          ))}
        </div>
      )}

      <ShiftSheet
        shiftId={openShiftId}
        onClose={() => setOpenShiftId(null)}
        header={
          openShift
            ? {
                employeeName: openShift.displayName,
                dateLabel: dateISO,
              }
            : undefined
        }
      />
    </div>
  );
}

function RosterFilters({
  sort,
  onSortChange,
  bucket,
  onBucketChange,
}: {
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  bucket: TimeBucket;
  onBucketChange: (b: TimeBucket) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Time-of-day chips */}
      <div className="border-border bg-muted/40 inline-flex items-center gap-1 rounded-full border p-1">
        {TIME_BUCKETS.map((b) => {
          const active = bucket === b.key;
          return (
            <button
              key={b.key}
              onClick={() => onBucketChange(b.key)}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="roster-bucket-pill"
                  className="bg-background absolute inset-0 rounded-full shadow-sm"
                  transition={{ type: "spring", ...motionTokens.springSnappy }}
                />
              ) : null}
              <b.Icon className="relative h-3 w-3" />
              <span className="relative">{b.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scaffold filters — wired into UI, real data lands when roster row carries dept/team/location */}
      <ScaffoldFilter Icon={Building2} label="Avdeling" />
      <ScaffoldFilter Icon={UsersIcon} label="Team" />
      <ScaffoldFilter Icon={MapPin} label="Lokasjon" />

      <div className="ml-auto">
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
          <SelectTrigger className="bg-muted/40 h-8 w-[140px] gap-1.5 rounded-full border-border text-[11px] font-semibold">
            <ArrowDownUp className="h-3 w-3" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="time">Sortert: Tid</SelectItem>
            <SelectItem value="name">Sortert: Navn</SelectItem>
            <SelectItem value="status">Sortert: Status</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ScaffoldFilter({ Icon, label }: { Icon: typeof Building2; label: string }) {
  return (
    <button
      onClick={() =>
        toast.message(`${label}-filter`, {
          description: "Wires inn når roster-row får dimensjon-data (D1/D2).",
        })
      }
      className="border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors"
    >
      <Icon className="h-3 w-3" />
      {label}
      <span className="text-muted-foreground/70">: Alle</span>
    </button>
  );
}

function ProfileShiftCard({
  shift,
  dateISO,
  index,
  onOpen,
}: {
  shift: DayShift;
  dateISO: string;
  index: number;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const accent =
    shift.status === "active"
      ? "var(--success)"
      : shift.status === "completed"
        ? "var(--muted-foreground)"
        : "var(--info)";
  const statusLabel =
    shift.status === "active"
      ? shift.breakState === "pause"
        ? "Pause"
        : "Aktiv"
      : shift.status === "completed"
        ? "Ferdig"
        : "Kommer";

  const entrance = reduce
    ? { initial: false as const, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: {
          delay: index * 0.025,
          type: "spring" as const,
          ...motionTokens.spring,
        },
      };

  return (
    <motion.div
      {...entrance}
      whileHover={reduce ? undefined : { y: -2, transition: { type: "spring", ...motionTokens.springSnappy } }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group bg-card border-border relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
    >
      {/* Subtle accent rail on left edge */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `color-mix(in oklch, ${accent} 60%, transparent)` }}
      />

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          aria-hidden
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold tracking-tight"
          style={{
            background:
              "radial-gradient(circle at 30% 25%, color-mix(in oklch, var(--brand-orange) 18%, var(--card)) 0%, var(--card) 75%)",
            color: "var(--foreground)",
            boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--border) 80%, transparent)",
          }}
        >
          {shift.initials}
          {shift.live ? (
            <span
              aria-hidden
              className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--card)]"
              style={{ background: accent }}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate text-sm font-semibold">
            {shift.displayName}
          </div>
          <div className="text-muted-foreground truncate text-xs">{shift.role}</div>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <ManualTimeEntryDialog shift={shift} dateISO={dateISO} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-foreground font-mono text-base font-semibold tabular-nums">
            {shift.start}
            <span className="text-muted-foreground/60 mx-1 text-xs font-normal">–</span>
            {shift.end}
          </span>
          <span className="text-muted-foreground mt-0.5 font-mono text-[10px] tabular-nums">
            {shift.actualHours.toFixed(1)}t / {shift.plannedHours.toFixed(1)}t
          </span>
        </div>

        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{
            background: `color-mix(in oklch, ${accent} 12%, transparent)`,
            color: accent,
          }}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${shift.live ? "motion-safe:animate-pulse" : ""}`}
            style={{ background: accent }}
          />
          {statusLabel}
        </span>
      </div>
    </motion.div>
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
          <ClockIcon className="h-3.5 w-3.5" aria-hidden />
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
