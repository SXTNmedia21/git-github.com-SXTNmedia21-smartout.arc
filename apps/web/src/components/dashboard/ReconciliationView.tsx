"use client";

import { motion as motionTokens } from "@smartout/design-tokens";
import React, { useState, useMemo, useCallback, useContext } from "react";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  ArrowUpRight,
  MessageSquare,
  CheckCircle2,
  Send,
  RotateCcw,
  Users,
  Timer,
  Building2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { useMutation } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useDepartmentShifts } from "@/app/dashboard/_hooks/use-department-shifts";
import {
  useApproveReconciliation,
  useRejectReconciliation,
} from "@/app/dashboard/reconciliation/_hooks/useReconciliation";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useEntityDrawer } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import type {
  DepartmentShiftGroup,
  DepartmentShiftDetail,
} from "@/app/dashboard/_hooks/dashboard-types";
import { ReconciliationToolsBridge } from "@/components/dashboard/_tools/reconciliation-tools-bridge";

// ── Types ─────────────────────────────────────────────────────────────────────

type ShiftStatus = "pending" | "approved" | "disputed" | "handoff";
type ShiftDecisions = Record<string, ShiftStatus>;
type HandoffDraft = { shiftId: string; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("nb-NO", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "I dag";
  if (d.toDateString() === yesterday.toDateString()) return "I går";
  return d.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getDateOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0]!;
}

function formatTime(time: string): string {
  if (!time || time === "—") return "—";
  const parts = time.split("T");
  const timePart = parts[1] ?? parts[0] ?? time;
  return timePart.slice(0, 5);
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ReconciliationView({ isDark: _isDark }: { isDark: boolean }) {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  // Default to yesterday — the morning routine starts here
  const [dateOffset, setDateOffset] = useState(-1);
  const selectedDate = getDateOffset(dateOffset);

  const [decisions, setDecisions] = useState<ShiftDecisions>({});
  const [handoffDraft, setHandoffDraft] = useState<HandoffDraft | null>(null);
  const [dayApproved, setDayApproved] = useState(false);

  const { data: departments, isLoading } = useDepartmentShifts(selectedDate);

  // ── DB mutations for reconciliation persistence ──
  const approveReconciliation = useApproveReconciliation();
  const rejectReconciliation = useRejectReconciliation();

  /** Upsert a daily_reconciliation row for the given department+date, returns its ID */
  const ensureReconciliation = useMutation({
    mutationFn: async (departmentId: string) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("daily_reconciliation")
        .upsert(
          {
            workspace_id: workspace.workspace_id,
            department_id: departmentId,
            reconciliation_date: selectedDate,
            status: "open" as const,
          },
          { onConflict: "workspace_id,department_id,reconciliation_date" },
        )
        .select("reconciliation_id")
        .single();
      if (error) throw error;
      return data.reconciliation_id as string;
    },
  });

  const allShifts = useMemo(() => {
    if (!departments) return [];
    return departments.flatMap((d) => d.shifts);
  }, [departments]);

  const totalShifts = allShifts.length;
  const handledCount = allShifts.filter(
    (s) => decisions[s.shiftId] && decisions[s.shiftId] !== "pending",
  ).length;
  const allHandled = totalShifts > 0 && handledCount === totalShifts;

  const decide = useCallback(
    async (shiftId: string, status: ShiftStatus) => {
      setDecisions((prev) => ({ ...prev, [shiftId]: status }));
      if (status === "approved") toast.success("Vakt godkjent");
      if (status === "disputed") {
        toast.error("Vakt bestridt — flagget for oppfølging");
        // Persist dispute: find the department for this shift, ensure reconciliation, reject
        const dept = departments?.find((d) => d.shifts.some((s) => s.shiftId === shiftId));
        if (dept) {
          try {
            const reconciliationId = await ensureReconciliation.mutateAsync(dept.departmentId);
            await rejectReconciliation.mutateAsync({
              reconciliationId,
              profileId: profileId ?? "",
              reason: `Vakt ${shiftId} bestridt av leder`,
            });
          } catch {
            // Dispute is tracked locally even if DB write fails
          }
        }
      }
    },
    [departments, ensureReconciliation, rejectReconciliation],
  );

  const resetShift = useCallback(
    (shiftId: string) => {
      setDecisions((prev) => {
        const next = { ...prev };
        delete next[shiftId];
        return next;
      });
      if (handoffDraft?.shiftId === shiftId) setHandoffDraft(null);
    },
    [handoffDraft],
  );

  const { t } = useTranslation("dashboard");

  const sendHandoff = useCallback(
    (shiftId: string) => {
      setDecisions((prev) => ({ ...prev, [shiftId]: "handoff" }));
      setHandoffDraft(null);
      toast.info(t("reconciliation.handoff_not_ready"));
    },
    [t],
  );

  const approveDay = useCallback(async () => {
    if (!departments) return;
    try {
      // Ensure reconciliation exists for each department, then approve
      for (const dept of departments) {
        const reconciliationId = await ensureReconciliation.mutateAsync(dept.departmentId);
        await approveReconciliation.mutateAsync({
          reconciliationId,
          profileId: "", // Resolved server-side from auth context
        });
      }
      setDayApproved(true);
      toast.success(`${formatDateShort(selectedDate)} godkjent og låst`);
    } catch {
      toast.error("Kunne ikke godkjenne dagen");
    }
  }, [selectedDate, departments, ensureReconciliation, approveReconciliation]);

  const changeDate = useCallback((newOffset: number) => {
    setDateOffset(newOffset);
    setDecisions({});
    setDayApproved(false);
    setHandoffDraft(null);
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-y-auto">
      {/* ── Page header ── */}
      <div className="flex flex-shrink-0 flex-col justify-between gap-4 pt-2 pb-6 md:flex-row md:items-start">
        <div>
          <h1 className="text-foreground text-2xl font-black tracking-tight">Daglig avstemming</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Gjennomgå vakter og bekreft driften for godkjenning.
          </p>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDate(dateOffset - 1)}
            className="border-border text-muted-foreground hover:bg-muted/50 rounded-lg border p-2 transition-colors"
            aria-label="Forrige dag"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="border-border bg-background flex items-center gap-2.5 rounded-xl border px-4 py-2 shadow-sm">
            <Calendar className="text-muted-foreground h-4 w-4 shrink-0" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-foreground text-sm font-bold">
                {formatDateShort(selectedDate)}
              </span>
              <span className="text-muted-foreground hidden text-xs sm:block">
                {formatDate(selectedDate).split(" ").slice(1).join(" ")}
              </span>
            </div>
          </div>

          <button
            onClick={() => changeDate(dateOffset + 1)}
            className="border-border text-muted-foreground hover:bg-muted/50 rounded-lg border p-2 transition-colors"
            aria-label="Neste dag"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {dateOffset !== -1 && (
            <button
              onClick={() => changeDate(-1)}
              className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
            >
              I går
            </button>
          )}
        </div>
      </div>

      {/* ── Botsson tool bridge — mounts when data is ready (non-loading, non-empty) ── */}
      {!isLoading && departments && departments.length > 0 && (
        <ReconciliationToolsBridge
          selectedDate={selectedDate}
          departments={departments}
          dayApproved={dayApproved}
          decisions={decisions}
        />
      )}

      {/* ── Main content ── */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : !departments || departments.length === 0 ? (
        <EmptyState date={selectedDate} />
      ) : dayApproved ? (
        <DayApprovedState
          date={selectedDate}
          total={totalShifts}
          onReset={() => {
            setDayApproved(false);
            setDecisions({});
          }}
        />
      ) : (
        <div className="flex flex-col gap-3 pb-24">
          {/* Progress summary */}
          <ProgressHeader
            total={totalShifts}
            handled={handledCount}
            allHandled={allHandled}
            departments={departments}
          />

          {/* One section per department */}
          {departments.map((dept) => (
            <DeptSection
              key={dept.departmentId}
              dept={dept}
              decisions={decisions}
              handoffDraft={handoffDraft}
              onDecide={decide}
              onResetShift={resetShift}
              onHandoffOpen={(shiftId) => setHandoffDraft({ shiftId, message: "" })}
              onHandoffChange={(msg) =>
                setHandoffDraft((prev) => (prev ? { ...prev, message: msg } : null))
              }
              onHandoffSend={sendHandoff}
              onHandoffCancel={() => setHandoffDraft(null)}
            />
          ))}

          {/* Sticky approve CTA */}
          <AnimatePresence>
            {allHandled && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ type: "spring", ...motionTokens.spring }}
                className="border-border bg-background fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-6 rounded-2xl border px-6 py-4 shadow-xl"
              >
                <div>
                  <p className="text-foreground text-sm font-bold">Alle vakter behandlet</p>
                  <p className="text-muted-foreground text-xs">
                    {handledCount} av {totalShifts} godkjent eller håndtert
                  </p>
                </div>
                <button
                  onClick={approveDay}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 active:scale-95"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Godkjenn dag
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── Progress Header ───────────────────────────────────────────────────────────

function ProgressHeader({
  total,
  handled,
  allHandled,
  departments,
}: {
  total: number;
  handled: number;
  allHandled: boolean;
  departments: DepartmentShiftGroup[];
}) {
  const totalHours = departments.reduce((s, d) => s + d.totalHours, 0);
  const pct = total > 0 ? Math.round((handled / total) * 100) : 0;

  return (
    <div className="border-border bg-background rounded-2xl border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Users className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-foreground text-sm font-bold">{total} vakter</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Timer className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-foreground text-sm font-bold">
              {totalHours.toFixed(1)}h totalt
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Building2 className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-foreground text-sm font-bold">
              {departments.length} {departments.length === 1 ? "avdeling" : "avdelinger"}
            </span>
          </div>
        </div>
        <span
          className={`text-sm font-bold ${allHandled ? "text-emerald-500" : "text-muted-foreground"}`}
        >
          {handled}/{total} behandlet
        </span>
      </div>

      {/* Progress bar */}
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            allHandled ? "bg-emerald-500" : "bg-orange-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Department Section ────────────────────────────────────────────────────────

function DeptSection({
  dept,
  decisions,
  handoffDraft,
  onDecide,
  onResetShift,
  onHandoffOpen,
  onHandoffChange,
  onHandoffSend,
  onHandoffCancel,
}: {
  dept: DepartmentShiftGroup;
  decisions: ShiftDecisions;
  handoffDraft: HandoffDraft | null;
  onDecide: (id: string, s: ShiftStatus) => void;
  onResetShift: (id: string) => void;
  onHandoffOpen: (id: string) => void;
  onHandoffChange: (msg: string) => void;
  onHandoffSend: (id: string) => void;
  onHandoffCancel: () => void;
}) {
  const deptHandled = dept.shifts.filter(
    (s) => decisions[s.shiftId] && decisions[s.shiftId] !== "pending",
  ).length;
  const deptTotal = dept.shifts.length;
  const allDeptDone = deptHandled === deptTotal;

  return (
    <div className="border-border overflow-hidden rounded-2xl border">
      {/* Department header */}
      <div className="bg-muted/30 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          {dept.departmentColor && (
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: dept.departmentColor }}
            />
          )}
          <span className="text-foreground text-sm font-bold">{dept.departmentName}</span>
          <span className="text-muted-foreground text-xs">
            {dept.shifts.length} vakter · {dept.totalHours.toFixed(1)}h
          </span>
        </div>
        <span
          className={`text-xs font-semibold transition-colors ${
            allDeptDone ? "text-emerald-500" : "text-muted-foreground"
          }`}
        >
          {deptHandled}/{deptTotal}
        </span>
      </div>

      {/* Shift rows */}
      <div className="divide-border divide-y">
        {dept.shifts.map((shift) => (
          <ShiftRow
            key={shift.shiftId}
            shift={shift}
            deptColor={dept.departmentColor}
            status={decisions[shift.shiftId] ?? "pending"}
            handoffDraft={handoffDraft?.shiftId === shift.shiftId ? handoffDraft : null}
            onDecide={(s) => onDecide(shift.shiftId, s)}
            onReset={() => onResetShift(shift.shiftId)}
            onHandoffOpen={() => onHandoffOpen(shift.shiftId)}
            onHandoffChange={onHandoffChange}
            onHandoffSend={() => onHandoffSend(shift.shiftId)}
            onHandoffCancel={onHandoffCancel}
          />
        ))}
      </div>
    </div>
  );
}

// ── Shift Row ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ShiftStatus, { label: string; pill: string }> = {
  pending: {
    label: "Venter",
    pill: "text-muted-foreground bg-muted/60",
  },
  approved: {
    label: "Godkjent",
    pill: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  },
  disputed: {
    label: "Bestridt",
    pill: "text-red-600 bg-red-500/10 dark:text-red-400",
  },
  handoff: {
    label: "Handoff sendt",
    pill: "text-blue-600 bg-blue-500/10 dark:text-blue-400",
  },
};

function ShiftRow({
  shift,
  deptColor,
  status,
  handoffDraft,
  onDecide,
  onReset,
  onHandoffOpen,
  onHandoffChange,
  onHandoffSend,
  onHandoffCancel,
}: {
  shift: DepartmentShiftDetail;
  deptColor: string | null;
  status: ShiftStatus;
  handoffDraft: HandoffDraft | null;
  onDecide: (s: ShiftStatus) => void;
  onReset: () => void;
  onHandoffOpen: () => void;
  onHandoffChange: (msg: string) => void;
  onHandoffSend: () => void;
  onHandoffCancel: () => void;
}) {
  const { openDrawer } = useEntityDrawer();
  const isHandled = status !== "pending";
  const cfg = STATUS_CONFIG[status];
  const initials = (shift.employeeName ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`transition-opacity duration-300 ${isHandled ? "opacity-50" : "opacity-100"}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Dept color stripe */}
        <div
          className="h-8 w-0.5 shrink-0 rounded-full"
          style={{ backgroundColor: deptColor ?? "#6366f1" }}
        />

        {/* Avatar */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: deptColor ?? "#6366f1" }}
        >
          {initials}
        </div>

        {/* Name + role + time — clickable to open shift drawer */}
        <button
          type="button"
          onClick={() => openDrawer("shift", shift.shiftId)}
          className="min-w-0 flex-1 text-left transition-opacity hover:opacity-70"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-foreground truncate text-sm font-semibold">
              {shift.employeeName ?? "Ikke tildelt"}
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {shift.positionName ?? shift.role}
            </span>
          </div>
          <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
            </span>
            <span className="text-foreground font-semibold">· {shift.workHours.toFixed(1)}h</span>
          </div>
        </button>

        {/* Status pill */}
        <span
          className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:block ${cfg.pill}`}
        >
          {cfg.label}
        </span>

        {/* Action buttons */}
        {!isHandled ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => onDecide("approved")}
              title="Godkjenn"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-500 transition-colors hover:bg-emerald-500/10 active:scale-90"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDecide("disputed")}
              title="Bestrid"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-500/10 active:scale-90"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={onHandoffOpen}
              title="Send handoff — be om avklaring"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-500 transition-colors hover:bg-blue-500/10 active:scale-90"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onReset}
            title="Angre"
            className="text-muted-foreground hover:text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Handoff inline panel */}
      <AnimatePresence>
        {handoffDraft && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: motionTokens.exitMs / 1000, ease: motionTokens.easingArray }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-blue-500">
                <MessageSquare className="h-3.5 w-3.5" />
                Send melding til {shift.employeeName ?? "ansatt"}
              </p>
              <textarea
                value={handoffDraft.message}
                onChange={(e) => onHandoffChange(e.target.value)}
                placeholder={`Hei — trenger avklaring om vakten ${formatTime(shift.startTime)}–${formatTime(shift.endTime)}. Kan du bekrefte timene?`}
                rows={2}
                autoFocus
                className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500/50"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">
                  Sendes via Smartout-meldinger
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={onHandoffCancel}
                    className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={onHandoffSend}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600 active:scale-95"
                  >
                    <Send className="h-3 w-3" />
                    Send handoff
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Day Approved State ────────────────────────────────────────────────────────

function DayApprovedState({
  date,
  total,
  onReset,
}: {
  date: string;
  total: number;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 p-12">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      </div>
      <p className="text-foreground text-lg font-bold">{formatDateShort(date)} er godkjent</p>
      <p className="text-muted-foreground mt-1 text-sm">
        {total} vakter bekreftet — {formatDate(date)}
      </p>
      <button
        onClick={onReset}
        className="text-muted-foreground hover:text-foreground mt-5 text-xs font-medium underline-offset-2 transition-colors hover:underline"
      >
        Åpne igjen og angre
      </button>
    </div>
  );
}

// ── Loading / Empty ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="border-border bg-muted/20 h-20 animate-pulse rounded-2xl border" />
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="border-border bg-muted/10 h-14 animate-pulse rounded-xl border"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

function EmptyState({ date }: { date: string }) {
  return (
    <div className="border-border flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed p-12">
      <div className="text-center">
        <Calendar className="text-muted-foreground mx-auto mb-3 h-8 w-8 opacity-20" />
        <p className="text-muted-foreground font-semibold">
          Ingen vakter planlagt for {formatDateShort(date)}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{formatDate(date)}</p>
      </div>
    </div>
  );
}
