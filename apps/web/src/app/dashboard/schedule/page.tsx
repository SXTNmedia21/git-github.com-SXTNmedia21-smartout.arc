"use client";

import React, { useContext, useState } from "react";
import {
  Users,
  Briefcase,
  Network,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
  MoreVertical,
  Printer,
  Ban,
} from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  DndContext,
  type CollisionDetection,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { PlannerCommandBar } from "./_components/planner-command-bar";
import { StatusStrip } from "./_components/status-strip";
import { GridSurface } from "./_components/grid-surface";
import { DayInspector } from "./_components/day-inspector";
import { GridContent } from "./_components/daily-grid";
import { ShiftCard, OpenShiftCard, TemplateCard, AbsenceCard } from "./_components/grid-cards";
import { ScheduleDragOverlay } from "./_components/schedule-drag-overlay";
import { DailyBriefingPanel } from "./_components/daily-briefing";
import {
  dummyEmployees,
  dummyDays,
  dailyShifts,
  openShiftItems,
} from "./_components/schedule-data";

// ---------------------------------------------------------------------------
// Collision detection: pointer-first, rect fallback
// ---------------------------------------------------------------------------
const scheduleCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

// ---------------------------------------------------------------------------
// SchedulePage — thin composition layer
// ---------------------------------------------------------------------------
export default function SchedulePage() {
  const { isDark, scheduleLayout } = useContext(DashboardContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterSituation, setFilterSituation] = useState("Alle");
  const [showGuide, setShowGuide] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"open" | "templates">("open");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const statusSummary = React.useMemo(() => {
    const coverageRisks = dummyDays.filter((day) => Boolean(day.coverageAlert)).length;
    const overtimeRisks = dummyEmployees.filter(
      (employee) => Number.parseFloat(employee.hours) > 37.5,
    ).length;
    const complianceRisks = dailyShifts.filter((shift) => shift.type === "absence").length;
    const openShiftQueue = openShiftItems.length;
    const draftCount = dailyShifts.filter((shift) => shift.status === "draft").length;
    const publishedCount = dailyShifts.filter((shift) => shift.status === "published").length;
    const activeCount = dailyShifts.filter((shift) => shift.status === "active").length;
    const completedCount = dailyShifts.filter((shift) => shift.status === "completed").length;
    const publishedState = draftCount > 0 ? "Draft endringer" : "Publisert";

    return {
      coverageRisks,
      overtimeRisks,
      complianceRisks,
      openShiftQueue,
      draftCount,
      publishedCount,
      activeCount,
      completedCount,
      publishedState,
    };
  }, []);

  return (
    <div
      className={`flex flex-1 flex-col ${isDark ? "bg-[#050505]" : "bg-zinc-50"} relative h-full overflow-hidden rounded-2xl border border-white/[0.04] font-sans text-zinc-100 shadow-2xl print:block print:h-auto print:overflow-visible print:border-none print:bg-white print:shadow-none`}
    >
      {/* AMBIENT BACKGROUND */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl opacity-10">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-orange-600/20 mix-blend-screen blur-[120px]" />
      </div>

      <PlannerCommandBar
        isDark={isDark}
        filterSituation={filterSituation}
        setFilterSituation={setFilterSituation}
        showGuide={showGuide}
        setShowGuide={setShowGuide}
      />

      <StatusStrip isDark={isDark} statusSummary={statusSummary} />

      {/* MAIN CONTENT AREA */}
      <DndContext
        sensors={sensors}
        collisionDetection={scheduleCollisionDetection}
        autoScroll={false}
      >
        <GridSurface
          isDark={isDark}
          leftSidebar={
            <ScheduleSidebar
              isDark={isDark}
              isSidebarOpen={isSidebarOpen}
              sidebarMode={sidebarMode}
              setSidebarMode={setSidebarMode}
            />
          }
          centerContent={
            <>
              {scheduleLayout === "daily" && (
                <GridContent
                  isSidebarOpen={isSidebarOpen}
                  setIsSidebarOpen={setIsSidebarOpen}
                  onDateClick={setSelectedDate}
                  filterSituation={filterSituation}
                />
              )}
              {scheduleLayout === "weekly" && (
                <WeeklyGridContent
                  isSidebarOpen={isSidebarOpen}
                  setIsSidebarOpen={setIsSidebarOpen}
                  onDateClick={setSelectedDate}
                />
              )}
              {scheduleLayout === "monthly" && (
                <MonthlyGridContent
                  isSidebarOpen={isSidebarOpen}
                  setIsSidebarOpen={setIsSidebarOpen}
                />
              )}
              {scheduleLayout === "list" && <ListGridContent onDateClick={setSelectedDate} />}
            </>
          }
          dayInspector={
            <DayInspector isDark={isDark} selectedDate={selectedDate}>
              <DailyBriefingPanel date={selectedDate} onClose={() => setSelectedDate(null)} />
            </DayInspector>
          }
        />

        <ScheduleDragOverlay isDark={isDark} />
      </DndContext>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScheduleSidebar — open shifts & templates drag source panel
// ---------------------------------------------------------------------------
function ScheduleSidebar({
  isDark,
  isSidebarOpen,
  sidebarMode,
  setSidebarMode,
}: {
  isDark: boolean;
  isSidebarOpen: boolean;
  sidebarMode: "open" | "templates";
  setSidebarMode: (m: "open" | "templates") => void;
}) {
  return (
    <aside
      className={`border-r border-white/[0.04] ${isDark ? "bg-[#0a0a0c]/40" : "bg-white/60"} z-20 hidden shrink-0 flex-col backdrop-blur-md transition-all duration-300 ease-in-out lg:flex ${isSidebarOpen ? "w-64 opacity-100 xl:w-72" : "w-0 overflow-hidden border-none opacity-0"} print:hidden`}
    >
      <div className="flex w-64 flex-1 flex-col overflow-y-auto p-4 xl:w-72 xl:p-5">
        <div
          className={`mb-4 flex gap-1 rounded-xl p-1 ${isDark ? "bg-white/[0.03]" : "bg-zinc-200/50"}`}
        >
          <button
            onClick={() => setSidebarMode("open")}
            className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold transition-all ${sidebarMode === "open" ? (isDark ? "bg-zinc-800 text-white shadow-sm" : "bg-white text-zinc-900 shadow-sm") : "text-zinc-500 hover:text-zinc-400"}`}
          >
            Ledige vakter
          </button>
          <button
            onClick={() => setSidebarMode("templates")}
            className={`flex-1 rounded-lg py-1.5 text-[10px] font-bold transition-all ${sidebarMode === "templates" ? (isDark ? "bg-zinc-800 text-white shadow-sm" : "bg-white text-zinc-900 shadow-sm") : "text-zinc-500 hover:text-zinc-400"}`}
          >
            Vaktmaler
          </button>
        </div>

        {sidebarMode === "open" ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[10px] font-black tracking-widest text-zinc-500 uppercase xl:text-xs">
                Åpen Vakt
              </h3>
              <button
                className="rounded-md bg-orange-500/10 p-1 text-orange-400 transition-colors hover:text-orange-300"
                title="Opprett ny åpen vakt"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {openShiftItems.map((shift) => (
                <OpenShiftCard key={shift.id} id={shift.id} title={shift.title} time={shift.time} />
              ))}
            </div>
          </>
        ) : (
          <>
            <h3 className="mb-4 text-[10px] font-black tracking-widest text-zinc-500 uppercase xl:text-xs">
              Maler per avdeling
            </h3>
            <div className="space-y-6">
              {["Servering", "Kjøkken"].map((team) => (
                <div key={team}>
                  <h4 className="mb-3 flex items-center gap-1.5 border-b border-white/5 pb-1 text-[10px] font-black tracking-widest text-zinc-400 uppercase">
                    <Briefcase className="h-3.5 w-3.5" /> {team}
                  </h4>
                  <div className="space-y-2">
                    {team === "Servering" ? (
                      <>
                        <TemplateCard
                          id={`tpl-${team}-1`}
                          title="Åpningsvakt"
                          team={team}
                          hours="08:00 - 16:00"
                          routines={3}
                        />
                        <TemplateCard
                          id={`tpl-${team}-2`}
                          title="Stengevakt"
                          team={team}
                          hours="16:00 - 00:00"
                          routines={5}
                        />
                      </>
                    ) : (
                      <TemplateCard
                        id={`tpl-${team}-3`}
                        title="Kjøkkensjef"
                        team={team}
                        hours="10:00 - 18:00"
                        routines={8}
                      />
                    )}
                  </div>
                </div>
              ))}
              <button
                className={`flex w-full items-center justify-center gap-2 border border-dashed py-2 ${isDark ? "border-zinc-500/30 text-zinc-500 hover:bg-white/5 hover:text-white" : "border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"} rounded-xl text-xs font-bold transition-all`}
              >
                <Plus className="h-3.5 w-3.5" /> Opprett ny mal
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY GRID (Rolling 1-10 view)
// ═══════════════════════════════════════════════════════════════════════════
function WeeklyGridContent({
  isSidebarOpen,
  setIsSidebarOpen,
  onDateClick,
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick?: (d: string) => void;
}) {
  const { isDark, scheduleView, weeklyPeriodCount } = useContext(DashboardContext);
  const columns = Array.from({ length: weeklyPeriodCount }, (_, i) => i + 1);

  return (
    <div className="flex w-full">
      <div
        className={`w-[200px] shrink-0 border-r border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]/60" : "bg-white/80"} sticky left-0 z-30 flex flex-col shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md`}
      >
        <div
          className={`h-24 border-b xl:h-28 ${isDark ? "border-white/5" : "border-zinc-200"} relative flex flex-col justify-between p-4`}
        >
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-zinc-500 uppercase xl:text-[10px]">
              <Network className="h-3.5 w-3.5 text-orange-500" />
              Rullerende
            </div>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`rounded-md p-1 text-zinc-500 hover:text-white ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} transition-colors`}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
          </div>
          <div
            className={`mt-auto rounded-lg border border-white/5 px-2 py-1 ${isDark ? "bg-[#050505]" : "bg-zinc-50"}`}
          >
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Visning:{" "}
              {scheduleView === "ansatt" ? "Ansatt" : scheduleView === "jobb" ? "Rolle" : "Team"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TeamGroup title="Kjøkken" count={2}>
            <EntityRow
              name="Lars Erik Johansen"
              subtitle="Sous Chef"
              hours="38.5"
              shifts="5"
              avatarColor="bg-blue-500/20 text-blue-400 border-blue-500/30"
              initials="LJ"
            />
            <EntityRow
              name="Ahmad Reza"
              subtitle="Kokk"
              hours="30"
              shifts="4"
              avatarColor="bg-orange-500/20 text-orange-400 border-orange-500/30"
              initials="AR"
            />
          </TeamGroup>
          <TeamGroup title="Sal & Service" count={1}>
            <EntityRow
              name="Ingrid Haugen"
              subtitle="Manager"
              hours="40"
              shifts="5"
              avatarColor="bg-purple-500/20 text-purple-400 border-purple-500/30"
              initials="IH"
            />
          </TeamGroup>
          <TeamGroup title="Drift" count={1}>
            <EntityRow
              name="Fatima Abdi"
              subtitle="Housekeeping"
              hours="24"
              shifts="4"
              avatarColor="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              initials="FA"
            />
          </TeamGroup>
        </div>
      </div>

      {columns.map((col) => (
        <div
          key={col}
          className={`min-w-0 flex-1 border-r ${isDark ? "border-white/5" : "border-zinc-200"} flex flex-col transition-colors hover:bg-white/[0.02] ${col === 3 ? "bg-orange-500/[0.02]" : ""}`}
        >
          <div
            onClick={() => onDateClick && onDateClick(`Uke ${col}`)}
            className={`sticky top-0 h-24 border-b border-white/5 p-3 xl:h-28 xl:p-4 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/90"} relative z-20 flex cursor-pointer flex-col items-center justify-center backdrop-blur-xl hover:bg-white/5`}
          >
            {col === 3 && (
              <div className="absolute top-2 right-2 rounded border border-orange-500/30 bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-black text-orange-400 uppercase">
                Aktiv
              </div>
            )}
            <h2
              className={`font-black tracking-tighter ${weeklyPeriodCount > 5 ? "text-lg xl:text-xl" : "text-xl xl:text-3xl"} ${col === 3 ? "text-orange-400" : isDark ? "text-white" : "text-zinc-900"}`}
            >
              {col}
            </h2>
            <span className="mt-1 text-[9px] font-bold tracking-widest text-zinc-500 uppercase xl:text-[10px]">
              Uke / Periode
            </span>
          </div>

          <WeeklyGridCell>
            {col % 2 !== 0 ? (
              <ShiftCard role="Sous Chef" time="5 vakter" status="published" indicator="blue" />
            ) : (
              <WeeklyEmptyCell />
            )}
          </WeeklyGridCell>
          <WeeklyGridCell>
            <ShiftCard
              role="Manager"
              time="5 vakter"
              status={col === 3 ? "active" : "published"}
              indicator="purple"
            />
          </WeeklyGridCell>
          <WeeklyGridCell>
            {col % 4 === 0 ? (
              <AbsenceCard type="Avspasering" reason="Rotasjon" />
            ) : (
              <ShiftCard role="Kokk" time="4 vakter" status="draft" indicator="orange" />
            )}
          </WeeklyGridCell>
          <WeeklyGridCell>
            <ShiftCard role="Housekeeping" time="4 vakter" status="published" indicator="emerald" />
          </WeeklyGridCell>
        </div>
      ))}
    </div>
  );
}

function TeamGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className="mb-4 flex flex-col">
      <div
        className={`flex items-center justify-between border-b border-white/5 px-3 py-2 ${isDark ? "bg-white/5" : "bg-zinc-100"}`}
      >
        <span
          className={`text-xs font-bold ${isDark ? "text-white" : "text-zinc-900"} tracking-wider uppercase`}
        >
          {title}
        </span>
        <span
          className={`text-[9px] font-medium text-zinc-400 ${isDark ? "bg-white/10" : "bg-zinc-200"} rounded px-1.5 py-0.5`}
        >
          {count}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function EntityRow({
  name,
  subtitle,
  hours,
  shifts,
  avatarColor,
  initials,
  contractedHours = 37.5,
}: {
  name: string;
  subtitle?: string;
  hours: string;
  shifts: string;
  avatarColor: string;
  initials: string;
  contractedHours?: number;
}) {
  const { isDark } = useContext(DashboardContext);
  const scheduledHours = parseFloat(hours) || 0;
  const percentage = Math.min((scheduledHours / contractedHours) * 100, 100);
  const isOvertime = scheduledHours > contractedHours;

  let barColor = "bg-zinc-600";
  if (isOvertime) barColor = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]";
  else if (percentage >= 95) barColor = "bg-emerald-500/80";
  else if (percentage >= 70) barColor = "bg-zinc-500";

  return (
    <div
      className={`group flex h-24 cursor-pointer items-center gap-2 border-b border-white/5 p-2 transition-colors hover:bg-white/[0.02] ${isDark ? "bg-[#0a0a0c]" : "bg-white"}`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[9px] font-black ${avatarColor}`}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h3
          className={`text-[11px] font-bold xl:text-xs ${isDark ? "text-white" : "text-zinc-900"} truncate leading-tight transition-colors group-hover:text-zinc-300`}
        >
          {name}
        </h3>
        <p className="mb-1 truncate text-[9px] leading-tight text-zinc-500 xl:text-[10px]">
          {subtitle}
        </p>
        <div className="mt-1 space-y-1">
          <div className="flex items-center justify-between text-[8px] font-bold tracking-widest uppercase">
            <span className="text-zinc-500">{shifts} vakter</span>
            <span
              className={
                isOvertime ? "text-red-400" : "text-zinc-400"
              }
            >
              {hours} <span className="text-zinc-600">/{contractedHours}</span>
            </span>
          </div>
          <div
            className={`h-1 w-full ${isDark ? "bg-white/5" : "bg-zinc-100"} overflow-hidden rounded-full`}
          >
            <div
              className={`h-full ${barColor} rounded-full transition-all`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WeeklyGridCell({ children, id }: { children?: React.ReactNode; id?: string }) {
  const { isDark } = useContext(DashboardContext);
  const defaultId = React.useId();
  const droppableId = id || defaultId;
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      className={`h-24 border-b border-white/5 ${isDark ? "bg-[#050505]" : "bg-zinc-50"}/40 relative flex flex-col gap-1 overflow-hidden p-1 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-colors ${isOver ? "z-10 scale-[1.02] rounded-lg border border-dashed border-orange-500/50 bg-orange-500/20" : "hover:bg-white/[0.04]"}`}
    >
      {children}
    </div>
  );
}

function WeeklyEmptyCell() {
  const { isDark } = useContext(DashboardContext);
  return (
    <button
      className={`absolute inset-x-1 inset-y-1 rounded-md border border-dashed ${isDark ? "border-white/10" : "border-zinc-300"} flex cursor-pointer items-center justify-center bg-white/[0.01] text-orange-500/0 opacity-0 transition-all hover:border-orange-500/30 hover:bg-white/[0.03] hover:text-orange-500/50 hover:opacity-100`}
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MONTHLY HEATMAP (Strategic View)
// ═══════════════════════════════════════════════════════════════════════════
function MonthlyGridContent({
  isSidebarOpen,
  setIsSidebarOpen,
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const columns = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div
      className={`flex h-full w-full min-w-[800px] flex-col ${isDark ? "bg-[#050505]" : "bg-zinc-50"}`}
    >
      <div
        className={`h-16 shrink-0 border-b border-white/5 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/90"} sticky top-0 z-30 flex items-center gap-6 px-6`}
      >
        <div className="flex w-[200px] items-center gap-1.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
          <Clock className="h-3.5 w-3.5 text-orange-500" />
          Måned: Dekning &amp; Kostnad
        </div>
        <div className="flex flex-1 gap-8">
          <div className="flex flex-col">
            <span className="mb-0.5 text-[9px] font-bold tracking-wider text-zinc-500 uppercase">
              Est. Lønnskostnad
            </span>
            <span className={`text-sm font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
              482,500 <span className="text-[10px] font-medium text-zinc-500">NOK</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="mb-0.5 text-[9px] font-bold tracking-wider text-zinc-500 uppercase">
              Lønn % av Salg
            </span>
            <span className="text-sm font-black text-green-400">
              28.4% <span className="text-[10px] font-medium text-zinc-500">(Mål 30%)</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="mb-0.5 text-[9px] font-bold tracking-wider text-zinc-500 uppercase">
              Underbemannede Vakter
            </span>
            <span className="text-sm font-black text-rose-400">
              12 <span className="text-[10px] font-medium text-zinc-500">denne måneden</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={`w-[200px] shrink-0 border-r border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]/60" : "bg-white/80"} sticky left-0 z-20 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]`}
        >
          <div
            className={`h-[60px] border-b ${isDark ? "border-white/5" : "border-zinc-200"} bg-transparent`}
          />
          <div className="flex-1 overflow-y-auto">
            <TeamCoverageRow title="Kjøkken" target={8} current={7} />
            <TeamCoverageRow title="Sal & Service" target={12} current={12} isPerfect />
            <TeamCoverageRow title="Bar" target={4} current={3} isWarning />
            <TeamCoverageRow title="Drift / Renhold" target={3} current={3} isPerfect />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {columns.map((col) => {
            const isWeekend = col % 7 === 6 || col % 7 === 0;
            const isToday = col === 15;

            const getHeatmapColor = (rowIdx: number) => {
              if (isWeekend && rowIdx === 2) return "bg-rose-500/20 border-rose-500/50";
              if (rowIdx === 0 && col % 5 === 0) return "bg-orange-500/20 border-orange-500/50";
              return "bg-emerald-500/10 border-emerald-500/20";
            };

            return (
              <div
                key={col}
                className={`min-w-[32px] flex-1 border-r sm:min-w-[40px] ${isDark ? "border-white/5" : "border-zinc-200"} flex flex-col transition-colors ${isToday ? "bg-orange-500/[0.04]" : isWeekend ? "bg-indigo-500/[0.02]" : ""}`}
              >
                <div
                  className={`sticky top-0 h-[60px] border-b border-white/5 p-1 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/90"} group relative z-10 flex cursor-pointer flex-col items-center justify-end pb-2 backdrop-blur-xl hover:bg-white/5`}
                >
                  {isToday && (
                    <div className="absolute top-1 right-1/2 h-1.5 w-1.5 translate-x-1/2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                  )}
                  <h2
                    className={`text-[11px] font-black tracking-tight xl:text-xs ${isToday ? "text-orange-400" : isWeekend ? "text-indigo-400" : isDark ? "text-white" : "text-zinc-900"}`}
                  >
                    {col}
                  </h2>
                  <span
                    className={`mt-0.5 text-[6px] font-bold tracking-widest uppercase ${isWeekend ? "text-indigo-500" : "text-zinc-600"}`}
                  >
                    {isWeekend ? "Heg" : "Hvd"}
                  </span>
                </div>
                <HeatmapCell colorClass={getHeatmapColor(0)} />
                <HeatmapCell colorClass={getHeatmapColor(1)} />
                <HeatmapCell colorClass={getHeatmapColor(2)} />
                <HeatmapCell colorClass={getHeatmapColor(3)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TeamCoverageRow({
  title,
  target,
  current,
  isWarning,
  isPerfect,
}: {
  title: string;
  target: number;
  current: number;
  isWarning?: boolean;
  isPerfect?: boolean;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div
      className={`h-16 border-b ${isDark ? "border-white/5" : "border-zinc-200"} flex cursor-pointer flex-col justify-center px-4 py-2 hover:bg-white/[0.02]`}
    >
      <h3
        className={`text-xs font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-1.5 leading-none tracking-tight`}
      >
        {title}
      </h3>
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-black ${isPerfect ? "text-emerald-400" : isWarning ? "text-rose-400" : "text-orange-400"}`}
        >
          {current} <span className="font-medium text-zinc-500">/ {target} dekket</span>
        </span>
        {!isPerfect && (
          <AlertCircle
            className={`h-3.5 w-3.5 ${isWarning ? "text-rose-400" : "text-orange-400"}`}
          />
        )}
      </div>
    </div>
  );
}

function HeatmapCell({ colorClass }: { colorClass: string }) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className={`h-16 border-b ${isDark ? "border-white/5" : "border-zinc-200"} px-0.5 py-1`}>
      <div
        className={`h-full w-full rounded-sm border ${colorClass} cursor-pointer opacity-80 transition-opacity hover:opacity-100`}
        title="Klikk for detaljer"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST VIEW (Printable Weekly)
// ═══════════════════════════════════════════════════════════════════════════
function ListGridContent({ onDateClick }: { onDateClick: (d: string) => void }) {
  const { isDark } = useContext(DashboardContext);

  return (
    <div
      className={`mx-auto flex h-full w-full max-w-5xl flex-col p-4 md:p-8 xl:p-12 print:block print:h-auto print:bg-white print:p-0 print:text-black`}
    >
      <div className="mb-8 flex items-center justify-between print:hidden">
        <div>
          <h2 className={`text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
            Uke 52, 2026
          </h2>
          <p className="text-sm font-medium text-zinc-500">Kompakt vaktlista for utskrift</p>
        </div>
        <button
          onClick={() => window.print()}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all ${isDark ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"} shadow-sm`}
        >
          <Printer className="h-4 w-4" /> Skriv ut
        </button>
      </div>

      <div className="hidden print:mb-8 print:block">
        <h2 className="text-2xl font-black text-black">Bårdshaug Vegkro</h2>
        <p className="text-sm font-bold text-gray-500">Vaktliste &bull; Uke 52, 2026</p>
      </div>

      <div className="space-y-8 print:space-y-4">
        {dummyDays.map((day) => {
          const dayShifts = dailyShifts
            .filter((s) => s.dateId === day.id)
            .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

          if (dayShifts.length === 0) return null;

          return (
            <div
              key={day.id}
              className={`rounded-2xl border ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-white"} overflow-hidden p-5 transition-colors hover:border-orange-500/30 xl:p-6 print:rounded-none print:border-gray-300 print:bg-white`}
            >
              <div className="mb-4 flex items-end justify-between border-b border-orange-500/20 pb-3 print:border-gray-300">
                <div
                  className="group flex cursor-pointer items-center gap-2"
                  onClick={() => onDateClick(day.label)}
                >
                  <h3
                    className={`text-lg font-black ${day.isToday ? "text-orange-400" : isDark ? "text-white" : "text-zinc-900"} transition-colors group-hover:text-orange-400`}
                  >
                    {day.label}
                  </h3>
                  {day.isToday && (
                    <span className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-orange-400 uppercase print:border-gray-300">
                      I Dag
                    </span>
                  )}
                </div>
                <div className="hidden gap-3 text-[10px] font-bold tracking-widest text-zinc-500 uppercase sm:flex print:hidden">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {day.staff} Ansatte
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {dayShifts.length} Vakter
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
                {dayShifts.map((shift) => {
                  const emp = dummyEmployees.find((e) => e.id === shift.employeeId);
                  if (!emp) return null;
                  return (
                    <div
                      key={shift.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 ${isDark ? "border-white/5 bg-[#0a0a0c] hover:border-white/10" : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"} transition-colors print:border-gray-200 print:bg-white`}
                    >
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-800 print:border-black">
                        {emp.role === "Leder" ? (
                          <Briefcase className="h-4 w-4 text-purple-400" />
                        ) : (
                          <Users className="h-4 w-4 text-zinc-400" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={`truncate text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"} print:text-black`}
                        >
                          {emp.name}
                        </span>
                        <div className="mt-0.5 flex items-center justify-between">
                          <span className="truncate text-[10px] font-bold tracking-widest text-[#a1a1aa] uppercase print:text-gray-600">
                            {shift.role}
                          </span>
                          <span
                            className={`shrink-0 text-[10px] font-black tracking-widest ${isDark ? "text-orange-400" : "text-orange-600"} flex items-center gap-1 print:text-black`}
                          >
                            <Clock className="h-3 w-3 text-orange-500/50" />{" "}
                            {shift.time || shift.absenceType || "Hele Dagen"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
