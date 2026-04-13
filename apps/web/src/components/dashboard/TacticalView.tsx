"use client";

import { useState, useMemo, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileSignature,
  GraduationCap,
  MailWarning,
  ShieldCheck,
  UserPlus,
  UserMinus,
  Users,
} from "lucide-react";
import { DashboardCard } from "./DashboardCard";
import { LeaderPulseCard } from "./LeaderPulseCard";
import { ShiftStatusWidget } from "./ShiftStatusWidget";
import {
  useStaffingCoverage,
  getCurrentWeekStart,
  useTrainingReadiness,
  useActionItems,
  useGovernanceOverview,
  useWorkforcePipeline,
  useActiveSeason,
  type DayCoverage,
  type ActionCounts,
  type ProtocolOverviewItem,
  type PipelineData,
  type ActiveSeasonData,
} from "@/app/dashboard/_hooks";

// UI Events:
// - nav: onDateClick(date) — opens DayControlSheet via parent
// - action: setSignalsOpen(toggle) — expand/collapse signal cards
// - action: setProtocolsOpen(toggle) — expand/collapse protocol section
// - color-regime: status-based (good=emerald, warning=orange, critical=red)
// - visual: ringChart in Staffing card shows fill donut
// - visual: progressBar in Training card shows completion ratio
// - visual: action items strip shows urgent counts with color-coded badges
// - visual: protocol cards show real completion data from useGovernanceOverview
// - visual: workforce pulse shows pipeline metrics
// - visual: season card shows active season stage (conditional render)
// - interaction: SignalCards expand on click to show detail breakdown

interface TacticalViewProps {
  isDark: boolean;
  onDateClick?: (date: string) => void;
}

function getWeekStart(offset: number): string {
  const base = new Date(getCurrentWeekStart());
  base.setDate(base.getDate() + offset * 7);
  return base.toISOString().split("T")[0]!;
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
                className={`w-full rounded-md transition-colors duration-500 ${getStatusColor(d.fillPercent)}`}
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
      label: "Fullfort",
      value: training.completed,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Ventende",
      value: training.pending,
      icon: GraduationCap,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Utlopt",
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

// ── Action Items Strip ─────────────────────────────────────────────────

const ACTION_CONFIG: {
  key: keyof Omit<ActionCounts, "total">;
  label: string;
  icon: typeof AlertTriangle;
  priority: "critical" | "warning" | "info";
}[] = [
  { key: "shiftGaps", label: "Ledige skift", icon: CalendarClock, priority: "critical" },
  {
    key: "pendingContracts",
    label: "Ventende kontrakter",
    icon: FileSignature,
    priority: "warning",
  },
  { key: "stuckOnboarding", label: "Fastlast onboarding", icon: Clock, priority: "critical" },
  {
    key: "pendingProtocols",
    label: "Ventende protokoller",
    icon: ShieldCheck,
    priority: "warning",
  },
  { key: "staleInvitations", label: "Gamle invitasjoner", icon: MailWarning, priority: "info" },
];

const PRIORITY_STYLES = {
  critical: {
    badge: "border-red-500/20 bg-red-500/10 text-red-500",
    dot: "bg-red-500",
  },
  warning: {
    badge: "border-orange-500/20 bg-orange-500/10 text-orange-500",
    dot: "bg-orange-500",
  },
  info: {
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-500",
    dot: "bg-blue-500",
  },
} as const;

function ActionItemsStrip({ counts }: { counts: ActionCounts }) {
  const activeItems = ACTION_CONFIG.filter((item) => counts[item.key] > 0);

  if (activeItems.length === 0) return null;

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border/50 flex items-center gap-2 border-b px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <h3 className="text-foreground text-sm font-bold">Krever handling</h3>
        <span className="ml-auto rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-bold text-orange-500 tabular-nums">
          {counts.total}
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5 px-4 py-3.5">
        {activeItems.map((item) => {
          const styles = PRIORITY_STYLES[item.priority];
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${styles.badge}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{item.label}</span>
              <span className="text-xs font-black tabular-nums">{counts[item.key]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Protocol Cards Section (real data) ─────────────────────────────────

function ProtocolCardsSection({ protocols }: { protocols: ProtocolOverviewItem[] }) {
  const [isOpen, setIsOpen] = useState(true);

  if (protocols.length === 0) {
    return null;
  }

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
          {protocols.length}
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
            {protocols.map((protocol) => (
              <ProtocolCard key={protocol.protocolId} protocol={protocol} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProtocolCard({ protocol }: { protocol: ProtocolOverviewItem }) {
  const readiness = protocol.completionPercent;
  const isComplete = readiness === 100;
  const statusColor = isComplete
    ? "border-emerald-500/20"
    : readiness >= 70
      ? "border-orange-500/20"
      : "border-red-500/20";

  return (
    <div
      className={`group border-border bg-card relative overflow-hidden rounded-xl border p-5 transition-shadow duration-200 hover:shadow-md ${statusColor}`}
    >
      {/* Readiness indicator bar at top */}
      <div className="bg-muted absolute top-0 right-0 left-0 h-1 overflow-hidden rounded-t-xl">
        <div
          className={`h-full transition-[width] duration-700 ease-out ${
            isComplete ? "bg-emerald-500" : readiness >= 70 ? "bg-orange-500" : "bg-red-500"
          }`}
          style={{ width: `${readiness}%` }}
        />
      </div>

      {/* Header */}
      <div className="mt-1 mb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h4 className="text-foreground truncate text-sm font-bold">{protocol.protocolName}</h4>
            <p className="text-muted-foreground truncate text-[10px] capitalize">
              {protocol.policyType.replace(/_/g, " ")}
            </p>
          </div>
          <div
            className={`ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${
              isComplete
                ? "bg-emerald-500/10 text-emerald-500"
                : readiness >= 70
                  ? "bg-orange-500/10 text-orange-500"
                  : "bg-red-500/10 text-red-500"
            }`}
          >
            {readiness}%
          </div>
        </div>
      </div>

      {/* Assignment breakdown */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <CheckCircle2
            className={`h-3.5 w-3.5 ${protocol.completedCount > 0 ? "text-emerald-500" : "text-muted-foreground"}`}
          />
          <span
            className={`text-[9px] font-bold tabular-nums ${protocol.completedCount > 0 ? "text-emerald-500" : "text-muted-foreground"}`}
          >
            {protocol.completedCount} fullfort
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Clock
            className={`h-3.5 w-3.5 ${protocol.pendingCount > 0 ? "text-orange-500" : "text-muted-foreground"}`}
          />
          <span
            className={`text-[9px] font-bold tabular-nums ${protocol.pendingCount > 0 ? "text-orange-500" : "text-muted-foreground"}`}
          >
            {protocol.pendingCount} ventende
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <AlertCircle
            className={`h-3.5 w-3.5 ${protocol.expiredCount > 0 ? "text-red-500" : "text-muted-foreground"}`}
          />
          <span
            className={`text-[9px] font-bold tabular-nums ${protocol.expiredCount > 0 ? "text-red-500" : "text-muted-foreground"}`}
          >
            {protocol.expiredCount} utlopt
          </span>
        </div>
      </div>

      {/* Assignment footer */}
      <div className="border-border flex items-center gap-2 border-t pt-2.5">
        <Users className="text-muted-foreground h-3 w-3" />
        <span className="text-muted-foreground text-[10px] font-semibold">
          {protocol.completedCount}/{protocol.totalAssigned} ansatte fullfort
        </span>
      </div>
    </div>
  );
}

// ── Workforce Pulse ────────────────────────────────────────────────────

function WorkforcePulse({ pipeline }: { pipeline: PipelineData }) {
  const metrics = [
    {
      label: "Aktive ansatte",
      value: pipeline.activeStaff,
      icon: Users,
      color: "text-foreground",
      bg: "bg-muted/50",
    },
    {
      label: "Nyansatte (30d)",
      value: pipeline.newHires30d,
      icon: UserPlus,
      color: pipeline.newHires30d > 0 ? "text-emerald-500" : "text-foreground",
      bg: pipeline.newHires30d > 0 ? "bg-emerald-500/5" : "bg-muted/50",
    },
    {
      label: "Under opplaering",
      value: pipeline.onboarding,
      icon: GraduationCap,
      color: pipeline.onboarding > 0 ? "text-blue-500" : "text-foreground",
      bg: pipeline.onboarding > 0 ? "bg-blue-500/5" : "bg-muted/50",
    },
    {
      label: "Avganger (30d)",
      value: pipeline.departures30d,
      icon: UserMinus,
      color: pipeline.departures30d > 0 ? "text-red-500" : "text-foreground",
      bg: pipeline.departures30d > 0 ? "bg-red-500/5" : "bg-muted/50",
    },
  ];

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border/50 flex items-center gap-2 border-b px-4 py-2.5">
        <Users className="text-muted-foreground h-4 w-4" />
        <h3 className="text-foreground text-sm font-bold">Bemanning</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={`flex flex-col items-center gap-1.5 rounded-xl p-3 ${m.bg}`}
            >
              <Icon className={`h-4 w-4 ${m.color}`} />
              <span className={`text-xl font-black tabular-nums ${m.color}`}>{m.value}</span>
              <span className="text-muted-foreground text-center text-[10px] leading-tight font-semibold">
                {m.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Season Card ────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  seed: "Planlegging",
  revenue: "Budsjett",
  concept: "Konsept",
  staffing: "Bemanning",
  prepare: "Forberedelse",
  ready: "Klar",
  running: "Aktiv",
  reflect: "Evaluering",
};

function SeasonCard({ season }: { season: ActiveSeasonData }) {
  const stageLabel = STAGE_LABELS[season.currentStage] ?? season.currentStage;
  const totalStages = 8;
  const completedCount = season.stagesCompleted.length;
  const progressPercent = Math.round(((completedCount + 1) / totalStages) * 100);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
  };

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="border-border/50 flex items-center gap-2 border-b px-4 py-2.5">
        <Calendar className="text-muted-foreground h-4 w-4" />
        <h3 className="text-foreground text-sm font-bold">Årshjul</h3>
        <span className="text-muted-foreground ml-auto text-[10px] font-semibold capitalize">
          {season.type.replace(/_/g, " ")}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-foreground text-sm font-bold">{season.name}</h4>
            <p className="text-muted-foreground text-[10px] font-medium">
              {formatDate(season.startDate)} — {formatDate(season.endDate)}
            </p>
          </div>
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold text-orange-500">
            {stageLabel}
          </div>
        </div>
        {/* Progress bar */}
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-orange-500 transition-[width] duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-muted-foreground text-[10px] font-medium">
          Fase {completedCount + 1} av {totalStages}
        </p>
      </div>
    </div>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="border-border bg-card animate-pulse rounded-xl border p-4">
      <div className="bg-muted/50 mb-3 h-4 w-32 rounded-lg" />
      <div className="bg-muted/50 h-8 w-full rounded-lg" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function TacticalView({ onDateClick }: TacticalViewProps) {
  const [weekOffset] = useState(0);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const weekStart = getWeekStart(weekOffset);

  const { data: coverage } = useStaffingCoverage(weekStart);
  const { data: training } = useTrainingReadiness();
  const { data: actionCounts, isLoading: actionsLoading } = useActionItems();
  const { data: protocols, isLoading: protocolsLoading } = useGovernanceOverview();
  const { data: pipeline, isLoading: pipelineLoading } = useWorkforcePipeline();
  const { data: season } = useActiveSeason();

  // Stable today string — only changes once per day
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0]!, []);

  // Stable callback for signal card toggle
  const toggleSignals = useCallback(() => setSignalsOpen((v) => !v), []);

  // Compute overall staffing fill %
  const overallFill =
    coverage && coverage.length > 0
      ? Math.round(
          coverage.reduce((sum: number, d: DayCoverage) => sum + d.fillPercent, 0) /
            coverage.length,
        )
      : null;

  const todayGaps = useMemo(() => {
    if (!coverage) return 0;
    const today = coverage.find((d: DayCoverage) => d.date === todayStr);
    return today ? today.totalShifts - today.assignedShifts : 0;
  }, [coverage, todayStr]);

  const sparklineData = useMemo(() => {
    if (!coverage || coverage.length === 0) return undefined;
    return coverage.map((d: DayCoverage) => d.fillPercent);
  }, [coverage]);

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

  const stableProtocols = useMemo(() => protocols ?? [], [protocols]);

  // Hide workforce pulse if all zeros
  const hasPipelineData =
    pipeline &&
    (pipeline.activeStaff > 0 ||
      pipeline.newHires30d > 0 ||
      pipeline.onboarding > 0 ||
      pipeline.departures30d > 0);

  // Hide action strip if all zeros (no need for "alt i orden" taking space)
  const hasActionItems = actionCounts && actionCounts.total > 0;

  return (
    <div className="dashboard-enter flex min-w-0 flex-col gap-6 pb-8">
      {/* Leader Pulse — self-hides when empty */}
      <LeaderPulseCard />

      {/* Signal Cards */}
      <div className="grid flex-shrink-0 grid-cols-1 gap-4 md:grid-cols-2">
        <DashboardCard
          label="Bemanning"
          subtitle="Andel skift med tilordnet personale denne uken"
          value={overallFill !== null ? `${overallFill}%` : "--"}
          target="mal 100%"
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
          onCardClick={toggleSignals}
        />
        <DashboardCard
          label="Opplaering"
          subtitle="Protokoller fullfort av alle tilordnede ansatte"
          value={training ? `${training.readinessPercent}%` : "--"}
          target="mal 100%"
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
          onCardClick={toggleSignals}
        />
      </div>

      {/* Action Items — only renders when there ARE items to act on */}
      {actionsLoading ? (
        <SectionSkeleton />
      ) : hasActionItems ? (
        <ActionItemsStrip counts={actionCounts} />
      ) : null}

      {/* Protocol Overview — only renders when protocols exist */}
      {protocolsLoading ? (
        <SectionSkeleton />
      ) : stableProtocols.length > 0 ? (
        <ProtocolCardsSection protocols={stableProtocols} />
      ) : null}

      {/* Workforce Pulse — only renders when there's data worth showing */}
      {pipelineLoading ? (
        <SectionSkeleton />
      ) : hasPipelineData ? (
        <WorkforcePulse pipeline={pipeline} />
      ) : null}

      {/* Live shift status — shows active/late/waiting shifts */}
      <ShiftStatusWidget />

      {/* Season — only if active season exists */}
      {season && <SeasonCard season={season} />}
    </div>
  );
}
