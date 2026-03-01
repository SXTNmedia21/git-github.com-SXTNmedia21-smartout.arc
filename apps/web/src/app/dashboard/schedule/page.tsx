"use client";

import React, { useContext, useEffect, useState } from "react";
import {
  Users,
  Briefcase,
  Network,
  Plus,
  Clock,
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
} from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
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
import type { ShiftTemplate } from "./_components/schedule-types";
import { ScheduleDragOverlay } from "./_components/schedule-drag-overlay";
import { DailyBriefingPanel } from "./_components/daily-briefing";
import { dummyEmployees, dummyDays, dailyShifts } from "./_components/schedule-data";
import { ScheduleProvider, useSchedule } from "./_components/schedule-context";
import { OpenShiftDialog } from "./_components/open-shift-dialog";
import { CreateTemplateDialog } from "./_components/create-template-dialog";
import { EditTemplateDialog } from "./_components/edit-template-dialog";
import { ShiftModal } from "./_components/shift-modal";
import { BatchActionBar } from "./_components/batch-action-bar";
import { AbsencePopover } from "./_components/absence-popover";
import { useScheduleToast } from "./_components/schedule-toasts";

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
  return (
    <ScheduleProvider legacyShifts={dailyShifts}>
      <SchedulePageInner />
    </ScheduleProvider>
  );
}

/**
 * Inner schedule page that has access to the ScheduleProvider context.
 * Separated from the default export so useSchedule() works correctly.
 */
function SchedulePageInner() {
  const { isDark, scheduleLayout, setOnPublishAll, setScheduleDraftCount } =
    useContext(DashboardContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterSituation, setFilterSituation] = useState("Alle");
  const [showGuide, setShowGuide] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"open" | "templates">("open");
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { state, dispatch, computed } = useSchedule();
  const dispatchWithToast = useScheduleToast();
  const statusSummary = computed.getStatusSummary();

  // Register the publish-all callback and draft count with the DashboardShell header
  const draftCount = state.shifts.filter(
    (s) => s.status === "created" || s.status === "assigned",
  ).length;

  useEffect(() => {
    setScheduleDraftCount(draftCount);
    setOnPublishAll(() => dispatch({ type: "PUBLISH_ALL_DRAFTS" }));
    return () => {
      setOnPublishAll(null);
      setScheduleDraftCount(0);
    };
  }, [draftCount, dispatch, setOnPublishAll, setScheduleDraftCount]);

  /**
   * Handles DnD drop events.
   * Parses droppable ID format: "cell::employeeId::dateId" or "day-header::dateId"
   * and dispatches the appropriate action based on drag source type.
   * Uses dispatchWithToast so DnD actions get toast feedback.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const sourceType = active.data.current?.type as string | undefined;
    const droppableId = String(over.id);

    // Parse droppable ID
    const cellMatch = droppableId.match(/^cell::(.+)::(.+)$/);
    const dayHeaderMatch = droppableId.match(/^day-header::(.+)$/);

    if (cellMatch && sourceType === "shift") {
      // Shift dropped on employee cell → move shift
      const [, toEmployeeId, toDateId] = cellMatch;
      const shiftId = active.data.current?.shiftId as string | undefined;
      if (shiftId && toEmployeeId && toDateId) {
        dispatchWithToast({
          type: "MOVE_SHIFT",
          payload: { shiftId, toEmployeeId, toDateId },
        });
      }
    } else if (cellMatch && sourceType === "open-shift") {
      // Open shift dropped on employee cell → assign
      const [, employeeId, dateId] = cellMatch;
      if (employeeId && dateId) {
        dispatchWithToast({
          type: "ASSIGN_OPEN_SHIFT",
          payload: { openShiftId: String(active.id), employeeId, dateId },
        });
      }
    } else if (cellMatch && sourceType === "shift-template") {
      // Template dropped on employee cell → create shift from template
      const templateId = active.data.current?.templateId as string | undefined;
      const [, , dateId] = cellMatch;
      if (templateId && dateId) {
        dispatchWithToast({
          type: "LOAD_TEMPLATE",
          payload: { templateId, targetDateId: dateId },
        });
      }
    } else if (dayHeaderMatch && sourceType === "shift-template") {
      // Template dropped on day header → apply whole template to day
      const templateId = active.data.current?.templateId as string | undefined;
      const [, dateId] = dayHeaderMatch;
      if (templateId && dateId) {
        dispatchWithToast({
          type: "LOAD_TEMPLATE",
          payload: { templateId, targetDateId: dateId },
        });
      }
    }
  };

  return (
    <div
      className={`flex flex-1 flex-col ${isDark ? "bg-[#050505]" : "bg-zinc-50"} relative h-full overflow-hidden rounded-2xl border border-white/[0.04] font-sans text-zinc-100 shadow-2xl print:block print:h-auto print:overflow-visible print:border-none print:bg-white print:shadow-none`}
    >
      {/* AMBIENT BACKGROUND */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl opacity-10">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-orange-600/20 mix-blend-screen blur-[120px]" />
      </div>

      {/* MAIN CONTENT AREA — sidebar spans full height alongside command bar, status strip, and grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={scheduleCollisionDetection}
        autoScroll={false}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — full height from top of schedule container to bottom */}
          <ScheduleSidebar
            isDark={isDark}
            isSidebarOpen={isSidebarOpen}
            sidebarMode={sidebarMode}
            setSidebarMode={setSidebarMode}
          />

          {/* Main content column — command bar, status strip, then grid */}
          <div className="flex min-w-0 flex-1 flex-col">
            <PlannerCommandBar
              isDark={isDark}
              filterSituation={filterSituation}
              setFilterSituation={setFilterSituation}
              showGuide={showGuide}
              setShowGuide={setShowGuide}
            />

            <StatusStrip
              isDark={isDark}
              statusSummary={statusSummary}
              activeFilter={activeStatusFilter}
              onFilterClick={setActiveStatusFilter}
            />

            <GridSurface
              isDark={isDark}
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
                      filterSituation={filterSituation}
                    />
                  )}
                  {scheduleLayout === "monthly" && (
                    <MonthlyGridContent
                      onDateClick={setSelectedDate}
                      filterSituation={filterSituation}
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
          </div>
        </div>

        <ScheduleDragOverlay isDark={isDark} />
      </DndContext>

      {/* Global modals and overlays rendered at the page level */}
      <ShiftModal />
      <BatchActionBar />
      <AbsencePopover />
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
  const { state } = useSchedule();
  const templates = state.templates;
  const openShifts = state.openShifts;
  const [openShiftDialogOpen, setOpenShiftDialogOpen] = React.useState(false);
  const [createTemplateOpen, setCreateTemplateOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<ShiftTemplate | null>(null);

  // Group templates by department
  const templatesByDept = React.useMemo(() => {
    const map = new Map<string, typeof templates>();
    for (const t of templates) {
      const existing = map.get(t.department) ?? [];
      existing.push(t);
      map.set(t.department, existing);
    }
    return map;
  }, [templates]);

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
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${sidebarMode === "open" ? (isDark ? "bg-zinc-800 text-white shadow-sm" : "bg-white text-zinc-900 shadow-sm") : "text-zinc-500 hover:text-zinc-400"}`}
          >
            Ledige vakter
          </button>
          <button
            onClick={() => setSidebarMode("templates")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${sidebarMode === "templates" ? (isDark ? "bg-zinc-800 text-white shadow-sm" : "bg-white text-zinc-900 shadow-sm") : "text-zinc-500 hover:text-zinc-400"}`}
          >
            Vaktmaler
          </button>
        </div>

        {sidebarMode === "open" ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-black tracking-widest text-zinc-500 uppercase">
                Åpen Vakt
              </h3>
              <button
                onClick={() => setOpenShiftDialogOpen(true)}
                className="rounded-md bg-orange-500/10 p-1 text-orange-400 transition-colors hover:text-orange-300"
                title="Opprett ny åpen vakt"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {openShifts.map((shift) => (
                <OpenShiftCard key={shift.id} id={shift.id} title={shift.title} time={shift.time} />
              ))}
              {openShifts.length === 0 && (
                <p className="text-center text-xs text-zinc-500">Ingen åpne vakter</p>
              )}
            </div>
            <OpenShiftDialog open={openShiftDialogOpen} onOpenChange={setOpenShiftDialogOpen} />
          </>
        ) : (
          <>
            <h3 className="mb-4 text-xs font-black tracking-widest text-zinc-500 uppercase">
              Maler per avdeling
            </h3>
            <div className="space-y-6">
              {Array.from(templatesByDept.entries()).map(([dept, templates]) => (
                <div key={dept}>
                  <h4 className="mb-3 flex items-center gap-1.5 border-b border-white/5 pb-1 text-xs font-black tracking-widest text-zinc-400 uppercase">
                    <Briefcase className="h-3.5 w-3.5" /> {dept}
                  </h4>
                  <div className="space-y-2">
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setEditingTemplate(t)}
                        className="cursor-pointer"
                      >
                        <TemplateCard
                          id={t.id}
                          title={t.name}
                          team={t.department}
                          hours={t.shifts[0]?.time ?? ""}
                          routines={t.shifts.length}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setCreateTemplateOpen(true)}
                className={`flex w-full items-center justify-center gap-2 border border-dashed py-2 ${isDark ? "border-zinc-500/30 text-zinc-500 hover:bg-white/5 hover:text-white" : "border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"} rounded-xl text-xs font-bold transition-all`}
              >
                <Plus className="h-3.5 w-3.5" /> Opprett ny mal
              </button>
            </div>
            <CreateTemplateDialog open={createTemplateOpen} onOpenChange={setCreateTemplateOpen} />
            {editingTemplate && (
              <EditTemplateDialog
                open={!!editingTemplate}
                onOpenChange={(o) => {
                  if (!o) setEditingTemplate(null);
                }}
                template={editingTemplate}
              />
            )}
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
  filterSituation,
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick?: (d: string) => void;
  filterSituation: string;
}) {
  const { isDark, scheduleView, weeklyPeriodCount } = useContext(DashboardContext);
  const { dispatch } = useSchedule();
  const columns = Array.from({ length: weeklyPeriodCount }, (_, i) => i + 1);

  /**
   * Groups employees dynamically based on the current scheduleView.
   * - "team": grouped by team name (Kjokken, Sal & Service, Drift)
   * - "jobb": grouped by role (Sous Chef, Kokk, Manager, etc.)
   * - "ansatt": flat list with no grouping headers
   */
  const groupedEmployees = React.useMemo(() => {
    if (scheduleView === "team") {
      const map = new Map<string, typeof dummyEmployees>();
      for (const emp of dummyEmployees) {
        const list = map.get(emp.team) ?? [];
        list.push(emp);
        map.set(emp.team, list);
      }
      return Array.from(map.entries());
    }
    if (scheduleView === "jobb") {
      const map = new Map<string, typeof dummyEmployees>();
      for (const emp of dummyEmployees) {
        const list = map.get(emp.role) ?? [];
        list.push(emp);
        map.set(emp.role, list);
      }
      return Array.from(map.entries());
    }
    // "ansatt" — flat list, single group
    return [["Alle ansatte", dummyEmployees] as [string, typeof dummyEmployees]];
  }, [scheduleView]);

  return (
    <div className="flex h-full w-full overflow-y-auto">
      <div
        className={`w-[200px] shrink-0 border-r border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]/60" : "bg-white/80"} sticky left-0 z-30 flex flex-col shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md`}
      >
        <div
          className={`sticky top-0 z-30 h-24 border-b xl:h-28 ${isDark ? "border-white/5 bg-[#0a0a0c]" : "border-zinc-200 bg-white"} relative flex flex-col justify-between p-4`}
        >
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-zinc-500 uppercase xl:text-xs">
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
            <span className="text-xs font-bold tracking-widest text-zinc-500 uppercase">
              Visning:{" "}
              {scheduleView === "ansatt" ? "Ansatt" : scheduleView === "jobb" ? "Rolle" : "Team"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groupedEmployees.map(([groupName, employees]) => (
            <TeamGroup key={groupName} title={groupName} count={employees.length}>
              {employees.map((emp) => (
                <EntityRow
                  key={emp.id}
                  name={emp.name}
                  subtitle={scheduleView === "jobb" ? emp.team : emp.role}
                  hours={emp.hours}
                  shifts={emp.shifts}
                  avatarColor={emp.avatarColor}
                  initials={emp.initials}
                />
              ))}
            </TeamGroup>
          ))}
        </div>
      </div>

      {columns.map((col) => {
        /**
         * Determines the situation-based background tint for this column.
         * - "Selskap": even columns get an orange tint (simulating booking days)
         * - "Krise": every 3rd column gets a red tint (simulating coverage risk days)
         * - "Normal" / "Alle": only the active column (3) gets a subtle orange tint
         */
        const situationTint =
          filterSituation === "Selskap" && col % 2 === 0
            ? "bg-orange-500/[0.04]"
            : filterSituation === "Krise" && col % 3 === 0
              ? "bg-rose-500/[0.04]"
              : col === 3
                ? "bg-orange-500/[0.02]"
                : "";

        return (
          <div
            key={col}
            className={`min-w-0 flex-1 border-r ${isDark ? "border-white/5" : "border-zinc-200"} flex flex-col transition-colors hover:bg-white/[0.02] ${situationTint}`}
          >
            <div
              onClick={() => onDateClick && onDateClick(`Uke ${col}`)}
              className={`sticky top-0 h-24 border-b border-white/5 p-3 xl:h-28 xl:p-4 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/90"} relative z-20 flex cursor-pointer flex-col items-center justify-center backdrop-blur-xl hover:bg-white/5`}
            >
              {col === 3 && (
                <div className="absolute top-2 right-2 rounded border border-orange-500/30 bg-orange-500/20 px-1.5 py-0.5 text-[11px] font-black text-orange-400 uppercase">
                  Aktiv
                </div>
              )}
              <h2
                className={`font-black tracking-tighter ${weeklyPeriodCount > 5 ? "text-lg xl:text-xl" : "text-xl xl:text-3xl"} ${col === 3 ? "text-orange-400" : isDark ? "text-white" : "text-zinc-900"}`}
              >
                {col}
              </h2>
              <span className="mt-1 text-[11px] font-bold tracking-widest text-zinc-500 uppercase xl:text-xs">
                Uke / Periode
              </span>
            </div>

            <WeeklyGridCell>
              {col % 2 !== 0 ? (
                <ShiftCard role="Sous Chef" time="5 vakter" status="published" indicator="blue" />
              ) : (
                <WeeklyEmptyCell
                  onClick={() =>
                    dispatch({
                      type: "SET_CREATE_SHIFT_CONTEXT",
                      payload: { dateId: `week::${col}` },
                    })
                  }
                />
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
              <ShiftCard
                role="Housekeeping"
                time="4 vakter"
                status="published"
                indicator="emerald"
              />
            </WeeklyGridCell>
          </div>
        );
      })}
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
          className={`text-[10px] font-medium text-zinc-400 ${isDark ? "bg-white/10" : "bg-zinc-200"} rounded px-1.5 py-0.5`}
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
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-black ${avatarColor}`}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h3
          className={`text-xs font-bold xl:text-[13px] ${isDark ? "text-white" : "text-zinc-900"} truncate leading-tight transition-colors group-hover:text-zinc-300`}
        >
          {name}
        </h3>
        <p className="mb-1 truncate text-[11px] leading-tight text-zinc-500 xl:text-xs">
          {subtitle}
        </p>
        <div className="mt-1 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase">
            <span className="text-zinc-500">{shifts} vakter</span>
            <span className={isOvertime ? "text-red-400" : "text-zinc-400"}>
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

function WeeklyEmptyCell({ onClick }: { onClick?: () => void }) {
  const { isDark } = useContext(DashboardContext);
  return (
    <button
      onClick={onClick}
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
  onDateClick,
  filterSituation,
}: {
  onDateClick?: (d: string) => void;
  filterSituation: string;
}) {
  const { isDark } = useContext(DashboardContext);
  const { state, dispatch, computed } = useSchedule();
  const columns = Array.from({ length: 31 }, (_, i) => i + 1);

  /** Estimated total wage cost across all shifts */
  const estimatedWageCost = state.shifts.reduce((sum, s) => sum + s.workHours * 250, 0);
  const statusSummary = computed.getStatusSummary();

  /** Aggregate team coverage across all days with data */
  const teamCoverageData = React.useMemo(() => {
    const uniqueDays = new Set(state.shifts.map((s) => s.dateId));
    const teamTotals = new Map<string, { target: number; current: number }>();

    for (const dateId of uniqueDays) {
      const coverage = computed.getCoverageForDay(dateId);
      for (const [team, data] of Object.entries(coverage.byTeam)) {
        const existing = teamTotals.get(team) ?? { target: 0, current: 0 };
        existing.target += data.target;
        existing.current += data.current;
        teamTotals.set(team, existing);
      }
    }

    return Array.from(teamTotals.entries()).map(([title, data]) => ({
      title,
      target: data.target,
      current: data.current,
    }));
  }, [state.shifts, computed]);

  return (
    <div
      className={`flex h-full w-full min-w-[800px] flex-col ${isDark ? "bg-[#050505]" : "bg-zinc-50"}`}
    >
      <div
        className={`h-16 shrink-0 border-b border-white/5 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/90"} sticky top-0 z-30 flex items-center gap-6 px-6`}
      >
        <div className="flex w-[200px] items-center gap-1.5 text-xs font-bold tracking-widest text-zinc-500 uppercase">
          <Clock className="h-3.5 w-3.5 text-orange-500" />
          Måned: Dekning &amp; Kostnad
        </div>
        <div className="flex flex-1 gap-8">
          <div className="flex flex-col">
            <span className="mb-0.5 text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
              Est. Lønnskostnad
            </span>
            <span className={`text-sm font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
              {estimatedWageCost.toLocaleString("nb-NO")}{" "}
              <span className="text-[10px] font-medium text-zinc-500">NOK</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="mb-0.5 text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
              Lønn % av Salg
            </span>
            <span className="text-sm font-black text-green-400">
              – <span className="text-[10px] font-medium text-zinc-500">(ingen salgsdata)</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="mb-0.5 text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
              Underbemannede Vakter
            </span>
            <span className="text-sm font-black text-rose-400">
              {statusSummary.coverageRisks}{" "}
              <span className="text-[10px] font-medium text-zinc-500">denne måneden</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-y-auto">
        <div
          className={`w-[200px] shrink-0 border-r border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]/60" : "bg-white/80"} sticky left-0 z-20 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]`}
        >
          <div
            className={`sticky top-16 z-20 h-[60px] border-b ${isDark ? "border-white/5" : "border-zinc-200"} ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/90"} backdrop-blur-xl`}
          />
          <div className="flex-1 overflow-y-auto">
            {teamCoverageData.map((team) => (
              <TeamCoverageRow
                key={team.title}
                title={team.title}
                target={team.target}
                current={team.current}
                isPerfect={team.current >= team.target}
                isWarning={team.current < team.target - 1}
              />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {columns.map((col) => {
            const isWeekend = col % 7 === 6 || col % 7 === 0;
            const isToday = col === 15;

            /** Map column index to a dummyDay dateId if within range */
            const dateId = col <= dummyDays.length ? dummyDays[col - 1]?.id : undefined;

            /**
             * Returns coverage-based heatmap color for a team row.
             * Green = at or above target, orange = 1 below, red = 2+ below, neutral = no data.
             */
            const getHeatmapColor = (rowIdx: number) => {
              if (!dateId || rowIdx >= teamCoverageData.length) {
                return "bg-zinc-500/5 border-zinc-500/10";
              }
              const team = teamCoverageData[rowIdx];
              if (!team) return "bg-zinc-500/5 border-zinc-500/10";
              const coverage = computed.getCoverageForDay(dateId);
              const teamName = team.title;
              const teamData = coverage.byTeam[teamName];
              if (!teamData) return "bg-zinc-500/5 border-zinc-500/10";
              const { target, current } = teamData;
              if (current >= target) return "bg-emerald-500/10 border-emerald-500/20";
              if (current >= target - 1) return "bg-orange-500/20 border-orange-500/50";
              return "bg-rose-500/20 border-rose-500/50";
            };

            /** All shifts for this day — used to compute per-cell info */
            const dayShifts = dateId ? state.shifts.filter((s) => s.dateId === dateId) : [];
            const teamCount = Math.max(teamCoverageData.length, 1);

            /**
             * Returns shift count and time range for a team row.
             * Distributes day shifts evenly across team rows since
             * shifts don't carry team info in local state.
             */
            const getCellInfo = (rowIdx: number) => {
              if (dayShifts.length === 0) return { shiftCount: 0, timeRange: undefined };
              // Distribute shifts across team rows
              const base = Math.floor(dayShifts.length / teamCount);
              const remainder = dayShifts.length % teamCount;
              const shiftCount = base + (rowIdx < remainder ? 1 : 0);
              if (shiftCount === 0) return { shiftCount: 0, timeRange: undefined };
              // Compute time range from earliest start to latest end across all day shifts
              const sorted = [...dayShifts].sort((a, b) => a.startTime.localeCompare(b.startTime));
              const earliest = sorted[0]?.startTime;
              const latest = [...dayShifts].sort((a, b) => b.endTime.localeCompare(a.endTime))[0]
                ?.endTime;
              const timeRange = earliest && latest ? `${earliest}-${latest}` : undefined;
              return { shiftCount, timeRange };
            };

            return (
              <div
                key={col}
                className={`min-w-[32px] flex-1 border-r sm:min-w-[40px] ${isDark ? "border-white/5" : "border-zinc-200"} flex flex-col transition-colors ${
                  filterSituation === "Selskap" && col % 5 === 0
                    ? "bg-orange-500/[0.06]"
                    : filterSituation === "Krise" && col % 7 === 0
                      ? "bg-rose-500/[0.06]"
                      : isToday
                        ? "bg-orange-500/[0.04]"
                        : isWeekend
                          ? "bg-indigo-500/[0.02]"
                          : ""
                }`}
              >
                <div
                  onClick={() => {
                    if (!dateId) return;
                    onDateClick?.(dummyDays[col - 1]?.label ?? `Dag ${col}`);
                    // Open shift creation modal when clicking an empty date
                    if (dayShifts.length === 0) {
                      dispatch({ type: "SET_CREATE_SHIFT_CONTEXT", payload: { dateId } });
                    }
                  }}
                  className={`sticky top-16 h-[60px] border-b border-white/5 p-1 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/90"} group relative z-10 flex cursor-pointer flex-col items-center justify-end pb-2 backdrop-blur-xl hover:bg-white/5`}
                >
                  {isToday && (
                    <div className="absolute top-1 right-1/2 h-1.5 w-1.5 translate-x-1/2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                  )}
                  <h2
                    className={`text-xs font-black tracking-tight xl:text-sm ${isToday ? "text-orange-400" : isWeekend ? "text-indigo-400" : isDark ? "text-white" : "text-zinc-900"}`}
                  >
                    {col}
                  </h2>
                  <span
                    className={`mt-0.5 text-[10px] font-bold tracking-widest uppercase ${isWeekend ? "text-indigo-500" : "text-zinc-600"}`}
                  >
                    {isWeekend ? "Heg" : "Hvd"}
                  </span>
                </div>
                {teamCoverageData.length > 0 ? (
                  teamCoverageData.map((_, rowIdx) => {
                    const cellInfo = getCellInfo(rowIdx);
                    return (
                      <HeatmapCell
                        key={rowIdx}
                        colorClass={getHeatmapColor(rowIdx)}
                        shiftCount={cellInfo.shiftCount}
                        timeRange={cellInfo.timeRange}
                        onClick={() =>
                          dateId && onDateClick?.(dummyDays[col - 1]?.label ?? `Dag ${col}`)
                        }
                      />
                    );
                  })
                ) : (
                  <>
                    <HeatmapCell colorClass="bg-zinc-500/5 border-zinc-500/10" />
                    <HeatmapCell colorClass="bg-zinc-500/5 border-zinc-500/10" />
                    <HeatmapCell colorClass="bg-zinc-500/5 border-zinc-500/10" />
                    <HeatmapCell colorClass="bg-zinc-500/5 border-zinc-500/10" />
                  </>
                )}
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
          className={`text-[11px] font-black ${isPerfect ? "text-emerald-400" : isWarning ? "text-rose-400" : "text-orange-400"}`}
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

function HeatmapCell({
  colorClass,
  onClick,
  shiftCount,
  timeRange,
}: {
  colorClass: string;
  onClick?: () => void;
  /** Number of shifts in this cell (team + day combination) */
  shiftCount?: number;
  /** Earliest start to latest end, e.g. "08:00-22:00" */
  timeRange?: string;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className={`h-16 border-b ${isDark ? "border-white/5" : "border-zinc-200"} px-0.5 py-1`}>
      <div
        onClick={onClick}
        className={`flex h-full w-full flex-col items-center justify-center rounded-sm border ${colorClass} cursor-pointer opacity-80 transition-opacity hover:opacity-100`}
        title="Klikk for detaljer"
      >
        {shiftCount !== undefined && shiftCount > 0 && (
          <>
            <span className="text-[10px] leading-none font-black">{shiftCount}</span>
            {timeRange && (
              <span className="mt-0.5 text-[7px] leading-none text-zinc-500">{timeRange}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST VIEW (Printable Weekly)
// ═══════════════════════════════════════════════════════════════════════════
function ListGridContent({ onDateClick }: { onDateClick: (d: string) => void }) {
  const { isDark } = useContext(DashboardContext);
  const { computed } = useSchedule();

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
          const dayShifts = computed
            .getShiftsForDay(day.id)
            .sort((a, b) => a.time.localeCompare(b.time));

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
                    <span className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-xs font-bold tracking-widest text-orange-400 uppercase print:border-gray-300">
                      I Dag
                    </span>
                  )}
                </div>
                <div className="hidden gap-3 text-xs font-bold tracking-widest text-zinc-500 uppercase sm:flex print:hidden">
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
                          <span className="truncate text-xs font-bold tracking-widest text-[#a1a1aa] uppercase print:text-gray-600">
                            {shift.role}
                          </span>
                          <span
                            className={`shrink-0 text-xs font-black tracking-widest ${isDark ? "text-orange-400" : "text-orange-600"} flex items-center gap-1 print:text-black`}
                          >
                            <Clock className="h-3 w-3 text-orange-500/50" />{" "}
                            {shift.time || "Hele Dagen"}
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
