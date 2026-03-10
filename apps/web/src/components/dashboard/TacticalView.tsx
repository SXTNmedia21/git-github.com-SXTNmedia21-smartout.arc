"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ShieldCheck,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  FileSignature,
  Users,
  Calendar,
} from "lucide-react";
import { DashboardCard } from "./DashboardCard";
import { LeaderPulseCard } from "./LeaderPulseCard";
import { DayInfoDialog } from "@/app/dashboard/schedule/_components/day-info-dialog";
import {
  useStaffingCoverage,
  getCurrentWeekStart,
  useTrainingReadiness,
  type DayCoverage,
} from "@/app/dashboard/_hooks";

// UI Events:
// - nav: onDateClick(date) — opens DayControlSheet via parent
// - action: setWeekOffset(+/-1) — week navigation
// - action: setWeekOffset(0) — "I dag" button resets to current week
// - action: setShowEventDialog(true) — opens DayInfoDialog
// - color-regime: status-based (good=emerald, warning=orange, critical=red)
// - visual: ringChart in Staffing card shows fill donut
// - visual: progressBar in Training card shows completion ratio
// - interaction: SignalCards expand on click to show detail breakdown
// - conditional: training alert strip only renders when pending > 0

interface TacticalViewProps {
  isDark: boolean;
  onDateClick?: (date: string) => void;
}

function getWeekStart(offset: number): string {
  const base = new Date(getCurrentWeekStart());
  base.setDate(base.getDate() + offset * 7);
  return base.toISOString().split("T")[0]!;
}

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getStatusColor(fillPercent: number): string {
  if (fillPercent >= 100) return "bg-emerald-500";
  if (fillPercent >= 80) return "bg-orange-500";
  return "bg-red-500";
}

function getStatusTextColor(fillPercent: number): string {
  if (fillPercent >= 100) return "text-emerald-500";
  if (fillPercent >= 80) return "text-orange-500";
  return "text-red-500";
}

// ── Staffing Expand Content ────────────────────────────────────────────

function StaffingBreakdown({ coverage }: { coverage: DayCoverage[] | undefined }) {
  if (!coverage || coverage.length === 0) {
    return <p className="text-muted-foreground text-xs">Ingen data tilgjengelig</p>;
  }

  const totalShifts = coverage.reduce((s, d) => s + d.totalShifts, 0);
  const totalAssigned = coverage.reduce((s, d) => s + d.assignedShifts, 0);
  const totalGaps = totalShifts - totalAssigned;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p className="text-foreground text-2xl font-black">{totalShifts}</p>
          <p className="text-muted-foreground mt-1 text-[11px] font-semibold">Planlagte skift</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-emerald-500">{totalAssigned}</p>
          <p className="text-muted-foreground mt-1 text-[11px] font-semibold">Tilordnet</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p
            className={`text-2xl font-black ${totalGaps > 0 ? "text-orange-500" : "text-emerald-500"}`}
          >
            {totalGaps}
          </p>
          <p className="text-muted-foreground mt-1 text-[11px] font-semibold">Udekket</p>
        </div>
      </div>
      {/* Day-by-day bars */}
      <div className="flex items-end gap-2">
        {coverage.map((d) => {
          const h = Math.max(d.fillPercent * 0.56, 6);
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={`w-full rounded-md transition-all duration-700 ${getStatusColor(d.fillPercent)}`}
                style={{ height: `${h}px` }}
              />
              <span className="text-muted-foreground text-[10px] font-bold">{d.dayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Training Expand Content ────────────────────────────────────────────

function TrainingBreakdown({
  training,
}: {
  training:
    | { totalAssignments: number; completed: number; pending: number; expired: number }
    | undefined;
}) {
  if (!training) {
    return <p className="text-muted-foreground text-xs">Ingen data tilgjengelig</p>;
  }

  const items = [
    {
      label: "Fullført",
      value: training.completed,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Ventende",
      value: training.pending,
      icon: BookOpen,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Utløpt",
      value: training.expired,
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-4">
          <div className={`rounded-lg p-2.5 ${item.bg}`}>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </div>
          <span className="text-foreground flex-1 text-sm font-semibold">{item.label}</span>
          <span className={`text-xl font-black tabular-nums ${item.color}`}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Protocol Cards Section ─────────────────────────────────────────────

const DEMO_PROTOCOLS = [
  {
    id: "1",
    name: "Matservering",
    policyName: "Hygiene & Servering",
    status: "active" as const,
    procedures: 4,
    proceduresCompleted: 3,
    controlLists: 2,
    knowledgeTests: 1,
    testsPassed: 0,
    confirmations: 1,
    confirmationsSigned: 1,
    assignedTo: 12,
    completedBy: 8,
  },
  {
    id: "2",
    name: "Brannvern",
    policyName: "HMS & Sikkerhet",
    status: "active" as const,
    procedures: 3,
    proceduresCompleted: 3,
    controlLists: 1,
    knowledgeTests: 1,
    testsPassed: 1,
    confirmations: 1,
    confirmationsSigned: 1,
    assignedTo: 18,
    completedBy: 18,
  },
  {
    id: "3",
    name: "Kassasystem",
    policyName: "Daglig Drift",
    status: "active" as const,
    procedures: 6,
    proceduresCompleted: 2,
    controlLists: 0,
    knowledgeTests: 2,
    testsPassed: 1,
    confirmations: 1,
    confirmationsSigned: 0,
    assignedTo: 8,
    completedBy: 3,
  },
  {
    id: "4",
    name: "Allergener",
    policyName: "Mattrygghet (HACCP)",
    status: "active" as const,
    procedures: 5,
    proceduresCompleted: 5,
    controlLists: 3,
    knowledgeTests: 1,
    testsPassed: 1,
    confirmations: 1,
    confirmationsSigned: 1,
    assignedTo: 15,
    completedBy: 14,
  },
];

function ProtocolCardsSection() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="hover:bg-accent/50 mb-3 flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1 transition-colors duration-150"
      >
        <ShieldCheck className="text-muted-foreground h-4 w-4" />
        <h3 className="text-foreground flex-1 text-left text-sm font-extrabold">
          Aktive Protokoller
        </h3>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-bold">
          {DEMO_PROTOCOLS.length}
        </span>
        <ChevronDown
          className={`text-muted-foreground h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 380ms cubic-bezier(0.4, 0, 0.2, 1), opacity 280ms ease",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            {DEMO_PROTOCOLS.map((protocol) => (
              <ProtocolCard key={protocol.id} protocol={protocol} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProtocolCard({ protocol }: { protocol: (typeof DEMO_PROTOCOLS)[number] }) {
  const readiness =
    protocol.assignedTo > 0 ? Math.round((protocol.completedBy / protocol.assignedTo) * 100) : 100;

  const isComplete = readiness === 100;
  const statusColor = isComplete
    ? "border-emerald-500/20"
    : readiness >= 70
      ? "border-orange-500/20"
      : "border-red-500/20";

  const statusBg = isComplete
    ? "bg-emerald-500/5"
    : readiness >= 70
      ? "bg-orange-500/5"
      : "bg-red-500/5";

  return (
    <div
      className={`group border-border bg-card relative overflow-hidden rounded-xl border p-4 transition-all hover:shadow-md ${statusColor}`}
    >
      {/* Readiness indicator bar at top */}
      <div className="bg-muted absolute top-0 right-0 left-0 h-1 overflow-hidden rounded-t-xl">
        <div
          className={`h-full transition-all duration-1000 ease-out ${
            isComplete ? "bg-emerald-500" : readiness >= 70 ? "bg-orange-500" : "bg-red-500"
          }`}
          style={{ width: `${readiness}%` }}
        />
      </div>

      {/* Header */}
      <div className="mt-1 mb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h4 className="text-foreground truncate text-sm font-bold">{protocol.name}</h4>
            <p className="text-muted-foreground truncate text-[10px]">{protocol.policyName}</p>
          </div>
          <div
            className={`ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${statusBg} ${
              isComplete ? "text-emerald-500" : readiness >= 70 ? "text-orange-500" : "text-red-500"
            }`}
          >
            {readiness}%
          </div>
        </div>
      </div>

      {/* Component counts */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        <ComponentBadge
          icon={BookOpen}
          count={protocol.procedures}
          done={protocol.proceduresCompleted}
          label="Prosedyrer"
        />
        <ComponentBadge
          icon={ClipboardCheck}
          count={protocol.controlLists}
          done={protocol.controlLists}
          label="Kontroller"
        />
        <ComponentBadge
          icon={GraduationCap}
          count={protocol.knowledgeTests}
          done={protocol.testsPassed}
          label="Tester"
        />
        <ComponentBadge
          icon={FileSignature}
          count={protocol.confirmations}
          done={protocol.confirmationsSigned}
          label="Bekreftelser"
        />
      </div>

      {/* Assignment footer */}
      <div className="border-border flex items-center gap-2 border-t pt-2.5">
        <Users className="text-muted-foreground h-3 w-3" />
        <span className="text-muted-foreground text-[10px] font-semibold">
          {protocol.completedBy}/{protocol.assignedTo} ansatte fullfort
        </span>
      </div>
    </div>
  );
}

function ComponentBadge({
  icon: Icon,
  count,
  done,
  label,
}: {
  icon: typeof BookOpen;
  count: number;
  done: number;
  label: string;
}) {
  if (count === 0) {
    return (
      <div className="flex flex-col items-center gap-0.5 opacity-30">
        <Icon className="text-muted-foreground h-3.5 w-3.5" />
        <span className="text-muted-foreground text-[8px] font-bold">0</span>
      </div>
    );
  }

  const allDone = done >= count;

  return (
    <div className="flex flex-col items-center gap-0.5" title={label}>
      <Icon className={`h-3.5 w-3.5 ${allDone ? "text-emerald-500" : "text-muted-foreground"}`} />
      <span
        className={`text-[8px] font-bold ${allDone ? "text-emerald-500" : "text-muted-foreground"}`}
      >
        {done}/{count}
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function TacticalView({ onDateClick }: TacticalViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const weekStart = getWeekStart(weekOffset);
  const weekNum = getWeekNumber(weekStart);

  const { data: coverage, isLoading: coverageLoading } = useStaffingCoverage(weekStart);
  const { data: training } = useTrainingReadiness();

  // Compute overall staffing fill %
  const overallFill =
    coverage && coverage.length > 0
      ? Math.round(
          coverage.reduce((sum: number, d: DayCoverage) => sum + d.fillPercent, 0) /
            coverage.length,
        )
      : null;

  // Today's gaps for secondary text
  const todayStr = new Date().toISOString().split("T")[0];
  const todayGaps = useMemo(() => {
    if (!coverage) return 0;
    const today = coverage.find((d: DayCoverage) => d.date === todayStr);
    return today ? today.totalShifts - today.assignedShifts : 0;
  }, [coverage, todayStr]);

  // Sparkline data: fill percentages for each day of the week
  const sparklineData = useMemo(() => {
    if (!coverage || coverage.length === 0) return undefined;
    return coverage.map((d: DayCoverage) => d.fillPercent);
  }, [coverage]);

  // Totals for ring chart
  const totalShifts = useMemo(() => {
    if (!coverage) return { total: 0, assigned: 0 };
    return {
      total: coverage.reduce((s, d) => s + d.totalShifts, 0),
      assigned: coverage.reduce((s, d) => s + d.assignedShifts, 0),
    };
  }, [coverage]);

  const staffingStatus =
    overallFill === null
      ? "good"
      : overallFill >= 90
        ? "good"
        : overallFill >= 70
          ? "warning"
          : "critical";

  const trainingStatus = !training
    ? "good"
    : training.readinessPercent >= 90
      ? "good"
      : training.readinessPercent >= 70
        ? "warning"
        : "critical";

  return (
    <div className="dashboard-enter flex min-w-0 flex-col gap-5 pb-6">
      {/* Leader Pulse — pending engagement questions, self-hides when empty */}
      <LeaderPulseCard />

      {/* Signal Cards — 2 cards, 50/50 width. One click toggles both. */}
      <div className="grid flex-shrink-0 grid-cols-1 gap-4 md:grid-cols-2">
        <DashboardCard
          label="Bemanning"
          subtitle="Andel skift med tilordnet personale denne uken"
          value={overallFill !== null ? `${overallFill}%` : "--"}
          target="mål 100%"
          status={staffingStatus}
          icon={<Calendar className="h-4 w-4" />}
          ringChart={
            totalShifts.total > 0
              ? { value: totalShifts.assigned, max: totalShifts.total }
              : undefined
          }
          sparkline={!totalShifts.total ? sparklineData : undefined}
          secondary={
            todayGaps > 0
              ? `${todayGaps} ${todayGaps === 1 ? "ledig skift" : "ledige skift"} i dag`
              : undefined
          }
          expandContent={<StaffingBreakdown coverage={coverage} />}
          isActive={signalsOpen}
          onCardClick={() => setSignalsOpen((v) => !v)}
        />
        <DashboardCard
          label="Opplæring"
          subtitle="Protokoller fullført av alle tilordnede ansatte"
          value={training ? `${training.readinessPercent}%` : "--"}
          target="mål 100%"
          status={trainingStatus}
          icon={<GraduationCap className="h-4 w-4" />}
          trend={
            training
              ? {
                  direction: training.readinessPercent >= 90 ? "up" : "down",
                  label: `${training.completed}/${training.totalAssignments}`,
                }
              : undefined
          }
          progressBar={
            training ? { value: training.completed, max: training.totalAssignments } : undefined
          }
          secondary={training && training.pending > 0 ? `${training.pending} ventende` : undefined}
          expandContent={<TrainingBreakdown training={training} />}
          isActive={signalsOpen}
          onCardClick={() => setSignalsOpen((v) => !v)}
        />
      </div>

      {/* Protocol Cards */}
      <ProtocolCardsSection />

      {/* Weekly Staffing — hidden, gives more air to signal cards */}
      {false && (
        <div className="border-border bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border p-4 shadow-sm">
          {/* Header with week navigation */}
          <div className="mb-4 flex min-w-0 items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => setWeekOffset((o) => o - 1)}
                className="border-border text-muted-foreground hover:bg-accent rounded-lg border p-1.5 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="text-foreground truncate text-xl font-extrabold">Uke {weekNum}</h2>
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                className="border-border text-muted-foreground hover:bg-accent rounded-lg border p-1.5 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-muted-foreground hover:text-foreground rounded-lg px-2 py-1 text-xs font-semibold transition-colors"
                >
                  I dag
                </button>
              )}
            </div>
          </div>

          {/* 7-column day grid */}
          <div className="flex min-h-0 flex-1 flex-col">
            {coverageLoading ? (
              <div className="grid flex-1 grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-muted/50 flex flex-col items-center gap-2 rounded-xl p-3"
                  >
                    <div className="bg-muted h-3 w-8 animate-pulse rounded" />
                    <div className="bg-muted h-16 w-full animate-pulse rounded-lg" />
                    <div className="bg-muted h-3 w-6 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : (coverage?.length ?? 0) > 0 ? (
              <div className="grid flex-1 grid-cols-7 gap-2">
                {coverage!.map((d: DayCoverage) => {
                  const gapCount = d.totalShifts - d.assignedShifts;
                  const isToday = d.date === todayStr;
                  const hasShifts = d.totalShifts > 0;
                  const fillCapped = Math.min(d.fillPercent, 100);

                  return (
                    <button
                      key={d.date}
                      onClick={() => onDateClick?.(d.date)}
                      className={`group hover:bg-accent flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${
                        isToday ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card"
                      }`}
                    >
                      {/* Day label */}
                      <span
                        className={`text-xs font-bold uppercase ${
                          isToday ? "text-orange-500" : "text-muted-foreground"
                        }`}
                      >
                        {d.dayLabel}
                      </span>

                      {/* Fill percentage column */}
                      {hasShifts ? (
                        <div className="flex w-full flex-1 flex-col items-center justify-end gap-1">
                          {/* Vertical fill bar */}
                          <div className="bg-muted relative h-16 w-full overflow-hidden rounded-lg">
                            <div
                              className={`absolute bottom-0 left-0 w-full rounded-lg ${getStatusColor(d.fillPercent)} transition-all duration-1000 ease-out`}
                              style={{ height: `${fillCapped}%` }}
                            />
                          </div>
                          {/* Percentage */}
                          <span
                            className={`text-sm font-bold ${getStatusTextColor(d.fillPercent)}`}
                          >
                            {d.fillPercent}%
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-1 flex-col items-center justify-center">
                          <span className="text-muted-foreground text-xs">--</span>
                        </div>
                      )}

                      {/* Gap count or check */}
                      <div className="flex h-4 items-center">
                        {!hasShifts ? null : gapCount > 0 ? (
                          <span className="text-xs font-semibold text-orange-500">
                            {gapCount} ledig{gapCount !== 1 ? "e" : ""}
                          </span>
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-muted-foreground text-sm">Ingen skift planlagt denne uken</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Training alert strip — only renders when pending > 0 */}
      {training && training.pending > 0 && (
        <div className="flex flex-shrink-0 items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-orange-500" />
            <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
          </div>
          <p className="text-foreground flex-1 text-sm font-semibold">
            {training.pending} ventende protokoller
            <span className="text-muted-foreground mx-1.5">&middot;</span>
            <span className="text-muted-foreground">{training.readinessPercent}% klarhet</span>
          </p>
          <button
            onClick={() => setShowEventDialog(true)}
            className="text-xs font-bold text-orange-500 transition-colors hover:text-orange-400"
          >
            Vis alle &rarr;
          </button>
        </div>
      )}

      <DayInfoDialog dateId={weekStart} open={showEventDialog} onOpenChange={setShowEventDialog} />
    </div>
  );
}
