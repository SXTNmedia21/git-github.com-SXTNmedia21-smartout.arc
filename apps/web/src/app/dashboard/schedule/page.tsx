"use client";

import React, { useContext, useState, useRef } from "react";
import {
  MoreVertical,
  Users,
  Briefcase,
  Network,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Circle,
  PlayCircle,
  Ban,
  PanelLeftClose,
  PanelLeftOpen,
  MapPin,
  ChevronDown,
  ListTodo,
  MessageSquare,
  Megaphone,
  X,
  CheckSquare,
  Mail,
  MessageCircle,
  FileText,
  Info,
  CalendarCheck,
  Eye,
  Printer,
} from "lucide-react";
import { DashboardContext } from "../layout";
import type { DragStartEvent } from "@dnd-kit/core";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlannerCommandBar } from "./_components/planner-command-bar";
import { StatusStrip } from "./_components/status-strip";
import { GridSurface } from "./_components/grid-surface";
import { DayInspector } from "./_components/day-inspector";

// DUMMY DATA FOR DYNAMIC ROSTER
const dummyEmployees = [
  {
    id: "e1",
    name: "Lars Erik Johansen",
    role: "Sous Chef",
    team: "Kjøkken",
    hours: "38.5",
    shifts: "5",
    avatarColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    initials: "LJ",
  },
  {
    id: "e2",
    name: "Ahmad Reza",
    role: "Kokk",
    team: "Kjøkken",
    hours: "30",
    shifts: "4",
    avatarColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    initials: "AR",
  },
  {
    id: "e3",
    name: "Ingrid Haugen",
    role: "Manager",
    team: "Sal & Service",
    hours: "40",
    shifts: "5",
    avatarColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    initials: "IH",
  },
  {
    id: "e4",
    name: "Fatima Abdi",
    role: "Housekeeping",
    team: "Drift",
    hours: "24",
    shifts: "4",
    avatarColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    initials: "FA",
  },
  {
    id: "e5",
    name: "Karoline Smith",
    role: "Servitør",
    team: "Sal & Service",
    hours: "20",
    shifts: "3",
    avatarColor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
    initials: "KS",
  },
  {
    id: "e6",
    name: "Bjørn Isaksen",
    role: "Oppvask",
    team: "Kjøkken",
    hours: "15",
    shifts: "3",
    avatarColor: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    initials: "BI",
  },
];

const openShiftItems = [
  { id: "open-1", title: "Ekstra Servitør", time: "17:00-23:00" },
  { id: "open-2", title: "Vaskevakt", time: "22:00-02:00" },
];

export default function SchedulePage() {
  const { isDark, scheduleLayout } = useContext(DashboardContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Daily Briefing State
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // New UI States
  const [filterSituation, setFilterSituation] = useState("Alle");
  const [showGuide, setShowGuide] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"open" | "templates">("open");

  // DnD State & Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeDragItem, setActiveDragItem] = useState<Record<string, string> | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current as Record<string, string> | null);
  };
  const handleDragEnd = () => {
    setActiveDragItem(null);
  };

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
      className={`flex flex-1 flex-col ${isDark ? "bg-[#050505]" : "bg-zinc-50"} relative h-full overflow-hidden rounded-2xl border border-white/5 font-sans text-zinc-100 shadow-2xl print:block print:h-auto print:overflow-visible print:border-none print:bg-white print:shadow-none`}
    >
      {/* AMBIENT BACKGROUND */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl opacity-20">
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
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <GridSurface
          isDark={isDark}
          leftSidebar={
            <aside
              className={`border-r border-white/5 ${isDark ? "bg-[#0a0a0c]/40" : "bg-white/60"} z-20 hidden shrink-0 flex-col backdrop-blur-md transition-all duration-300 ease-in-out lg:flex ${isSidebarOpen ? "w-64 opacity-100 xl:w-72" : "w-0 overflow-hidden border-none opacity-0"} print:hidden`}
            >
              <div className="custom-scrollbar flex w-64 flex-1 flex-col overflow-y-auto p-4 xl:w-72 xl:p-5">
                <div
                  className={`mb-4 flex gap-1 rounded-xl p-1 ${isDark ? "bg-white/5" : "bg-zinc-200/50"}`}
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
                        <OpenShiftCard
                          key={shift.id}
                          id={shift.id}
                          title={shift.title}
                          time={shift.time}
                        />
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

        <DragOverlay zIndex={1000}>
          {activeDragItem ? (
            <div
              className={`p-2 md:p-3 ${isDark ? "bg-[#0a0a0c]" : "bg-white"} flex w-48 scale-105 rotate-2 cursor-grabbing flex-col gap-1 rounded-xl border border-orange-500/50 opacity-90 shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-transform`}
            >
              <h4
                className={`text-[12px] font-bold ${isDark ? "text-white" : "text-zinc-900"} leading-tight`}
              >
                {String(activeDragItem.title || activeDragItem.role || "Vakt")}
              </h4>
              <div className="text-[10px] font-medium text-orange-400">
                <Clock className="mr-1 inline h-3 w-3" />
                {String(activeDragItem.time || "Tid")}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function OpenShiftCard({ id, title, time }: { id: string; title: string; time: string }) {
  const { isDark } = useContext(DashboardContext);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { title, time, type: "open-shift" },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: 50,
        position: "relative" as React.CSSProperties["position"],
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 ${isDark ? "bg-[#0a0a0c]" : "bg-white"} group cursor-grab rounded-xl border border-white/5 shadow-sm transition-all hover:border-white/10 hover:bg-white/5 active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      <h4
        className={`text-[13px] font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-1 transition-colors group-hover:text-orange-400`}
      >
        {title}
      </h4>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
        <Clock className="h-3 w-3" />
        {time}
      </div>
    </div>
  );
}

// DUMMY DAYS & SHIFTS FOR ALIGNMENT
const dummyDays = [
  {
    id: "d1",
    label: "Man 22/12",
    staff: 4,
    shifts: 4,
    cost: "5,264",
    messages: 2,
    tasks: { done: 3, total: 5 },
    situation: "Normal",
  },
  {
    id: "d2",
    label: "Tir 23/12",
    staff: 3,
    shifts: 4,
    cost: "4,100",
    isToday: true,
    coverageAlert: "⚠️ Mangler Housekeeping",
    messages: 5,
    tasks: { done: 1, total: 6 },
    situation: "Krise",
  },
  {
    id: "d3",
    label: "Ons 24/12",
    staff: 5,
    shifts: 5,
    cost: "9,681",
    isHoliday: true,
    messages: 0,
    tasks: { done: 0, total: 2 },
    situation: "Normal",
  },
  {
    id: "d4",
    label: "Tor 25/12",
    staff: 0,
    shifts: 0,
    cost: "0",
    isHoliday: true,
    messages: 0,
    tasks: { done: 0, total: 0 },
    situation: "Normal",
  },
  {
    id: "d5",
    label: "Fre 26/12",
    staff: 4,
    shifts: 4,
    cost: "6,200",
    messages: 1,
    tasks: { done: 4, total: 8 },
    situation: "Normal",
  },
  {
    id: "d6",
    label: "Lør 27/12",
    staff: 6,
    shifts: 8,
    cost: "12,400",
    messages: 8,
    tasks: { done: 2, total: 10 },
    situation: "Selskap",
  },
  {
    id: "d7",
    label: "Søn 28/12",
    staff: 4,
    shifts: 4,
    cost: "7,100",
    messages: 1,
    tasks: { done: 0, total: 4 },
    situation: "Normal",
  },
];

const dailyShifts = [
  // MONDAY
  {
    id: "s1",
    employeeId: "e1",
    dateId: "d1",
    role: "Sous Chef",
    time: "15:00-23:00",
    status: "completed",
    indicator: "blue",
    zone: "Hovedkjøkken",
  },
  {
    id: "s2",
    employeeId: "e3",
    dateId: "d1",
    role: "Manager",
    time: "08:00-16:00",
    status: "completed",
    indicator: "purple",
    zone: "Kontor / Floor",
  },
  {
    id: "s3",
    employeeId: "e2",
    dateId: "d1",
    type: "absence",
    absenceType: "Sykdom",
    reason: "Sluttet 12:00",
  },
  {
    id: "s4",
    employeeId: "e4",
    dateId: "d1",
    role: "Housekeeping",
    time: "22:00-02:00",
    status: "published",
    indicator: "emerald",
  },

  // TUESDAY
  {
    id: "s5",
    employeeId: "e1",
    dateId: "d2",
    role: "Sous Chef",
    time: "10:00-14:00",
    status: "published",
    indicator: "blue",
    zone: "Prep",
  },
  {
    id: "s6",
    employeeId: "e1",
    dateId: "d2",
    role: "Sous Chef",
    time: "18:00-22:00",
    status: "draft",
    indicator: "blue",
    zone: "Varmmat",
  },
  {
    id: "s7",
    employeeId: "e3",
    dateId: "d2",
    role: "Manager",
    time: "10:00-18:00",
    status: "active",
    indicator: "purple",
    zone: "Floor",
  },
  {
    id: "s8",
    employeeId: "e2",
    dateId: "d2",
    role: "Kokk",
    time: "16:00-23:00",
    status: "published",
    indicator: "orange",
    zone: "Kaldmat",
  },

  // WEDNESDAY
  {
    id: "s9",
    employeeId: "e1",
    dateId: "d3",
    role: "Sous Chef",
    time: "08:00-16:00",
    status: "published",
    indicator: "blue",
    zone: "Hovedkjøkken",
  },
  {
    id: "s10",
    employeeId: "e3",
    dateId: "d3",
    type: "absence",
    absenceType: "Ferie",
    reason: "Julaften",
  },
  {
    id: "s11",
    employeeId: "e2",
    dateId: "d3",
    role: "Kokk",
    time: "08:00-16:00",
    status: "published",
    indicator: "orange",
  },
  {
    id: "s12",
    employeeId: "e4",
    dateId: "d3",
    role: "Housekeeping",
    time: "06:00-12:00",
    status: "draft",
    indicator: "emerald",
  },
];

function GridContent({
  isSidebarOpen,
  setIsSidebarOpen,
  onDateClick,
  filterSituation = "Alle",
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick: (d: string) => void;
  filterSituation?: string;
}) {
  const { isDark, scheduleView } = useContext(DashboardContext);
  const visibleDays = React.useMemo(
    () =>
      dummyDays.filter((day) => filterSituation === "Alle" || day.situation === filterSituation),
    [filterSituation],
  );
  const shiftsByEmployeeDay = React.useMemo(() => {
    const index = new Map<string, typeof dailyShifts>();
    for (const shift of dailyShifts) {
      const key = `${shift.employeeId}::${shift.dateId}`;
      const existing = index.get(key);
      if (existing) {
        existing.push(shift);
      } else {
        index.set(key, [shift]);
      }
    }
    return index;
  }, []);

  const renderHeaders = () => (
    <div className="sticky top-0 z-40 flex w-fit min-w-full">
      <div
        className={`w-[200px] shrink-0 border-r border-b border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]/95" : "bg-white/95"} sticky left-0 z-50 flex h-24 flex-col justify-between p-4 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl xl:h-28`}
      >
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-zinc-500 uppercase xl:text-[10px]">
            <Users className={`h-3.5 w-3.5 ${isDark ? "text-zinc-400" : "text-zinc-600"}`} />
            Grupper
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

      {visibleDays.map((day: (typeof dummyDays)[0]) => (
        <div
          key={day.id}
          className={`w-[280px] shrink-0 border-r border-b border-white/5 sm:w-[320px] lg:w-[400px] ${isDark ? "bg-[#0a0a0c]/90" : "bg-white/95"} group/day flex h-24 cursor-pointer flex-col justify-between p-2 backdrop-blur-xl transition-colors hover:bg-white/5 xl:h-28 ${day.isToday ? "bg-orange-500/[0.02]" : ""}`}
          onClick={() => onDateClick(day.label)}
        >
          {day.coverageAlert ? (
            <div className="absolute top-0 left-0 h-1 w-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          ) : (
            <div className="absolute top-0 left-0 h-1 w-full bg-green-500/20" />
          )}

          <div className="flex items-start justify-between">
            <h2
              className={`flex items-center gap-1.5 truncate text-[11px] font-black tracking-tight sm:text-xs ${day.isToday ? "text-orange-400" : day.isHoliday ? "text-rose-400" : isDark ? "text-zinc-300" : "text-zinc-700"}`}
            >
              {day.label}
              {day.isToday && (
                <span className="h-1 w-1 shrink-0 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]"></span>
              )}
            </h2>
            <button
              className={`shrink-0 p-1 text-zinc-500 hover:text-white ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-md transition-colors`}
            >
              <MoreVertical className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-auto flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] leading-none font-bold tracking-widest text-zinc-500 uppercase xl:gap-2 xl:text-[11px]">
              <span className="flex items-center gap-0.5" title="Ansatte">
                <Users className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {day.staff}
              </span>
              <span className="flex items-center gap-0.5" title="Vakter">
                <Briefcase className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {day.shifts}
              </span>
              {day.messages !== undefined && (
                <span
                  className={`flex items-center gap-0.5 ${day.messages > 0 ? "text-blue-400" : ""}`}
                  title="Meldinger for dagen"
                >
                  <MessageSquare className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {day.messages}
                </span>
              )}
              {day.tasks && (
                <span
                  className={`flex items-center gap-0.5 ${day.tasks.done < day.tasks.total ? "text-orange-400" : "text-emerald-400"}`}
                  title="Oppmøte / Gjøremål"
                >
                  <ListTodo className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {day.tasks.done}/
                  {day.tasks.total}
                </span>
              )}
            </div>
            {day.coverageAlert ? (
              <div className="flex w-fit max-w-full items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-1 py-0.5 text-[10px] font-bold text-red-500">
                <AlertCircle className="h-2.5 w-2.5 shrink-0" />{" "}
                <span className="truncate">{day.coverageAlert}</span>
              </div>
            ) : (
              <div className="flex w-fit max-w-full items-center gap-1 rounded px-1 py-0.5 text-[10px] font-bold text-zinc-500">
                <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-green-500/50" />{" "}
                <span className="truncate">Optimal dekning</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex w-full min-w-fit flex-col">
      {renderHeaders()}

      <div className="w-fit min-w-full flex-1 pb-20">
        {scheduleView === "ansatt" && (
          <div className="flex flex-col">
            {dummyEmployees.map((emp) => (
              <EmployeeRow
                key={emp.id}
                employee={emp}
                days={visibleDays}
                shiftsByEmployeeDay={shiftsByEmployeeDay}
              />
            ))}
          </div>
        )}

        {scheduleView === "jobb" && (
          <div className="flex flex-col">
            {Array.from(new Set(dummyEmployees.map((e) => e.role))).map((role) => {
              const employeesInRole = dummyEmployees.filter((e) => e.role === role);
              return (
                <React.Fragment key={role}>
                  <GroupHeader title={role} count={employeesInRole.length} days={visibleDays} />
                  {employeesInRole.map((emp) => (
                    <EmployeeRow
                      key={emp.id}
                      employee={emp}
                      days={visibleDays}
                      shiftsByEmployeeDay={shiftsByEmployeeDay}
                      subtitle={emp.team}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {scheduleView === "team" && (
          <div className="flex flex-col">
            {Array.from(new Set(dummyEmployees.map((e) => e.team))).map((team) => {
              const employeesInTeam = dummyEmployees.filter((e) => e.team === team);
              return (
                <React.Fragment key={team}>
                  <GroupHeader title={team} count={employeesInTeam.length} days={visibleDays} />
                  {employeesInTeam.map((emp) => (
                    <EmployeeRow
                      key={emp.id}
                      employee={emp}
                      days={visibleDays}
                      shiftsByEmployeeDay={shiftsByEmployeeDay}
                      subtitle={emp.role}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// WEEKLY GRID COMPONENT (1-10)
function WeeklyGridContent({
  isSidebarOpen,
  setIsSidebarOpen,
  onDateClick,
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick?: (d: string) => void;
}) {
  const { isDark, scheduleView } = useContext(DashboardContext);
  // Generate 10 columns for the weekly sequence
  const columns = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className="flex w-fit min-w-full">
      <div
        className={`w-[200px] shrink-0 border-r border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]/60" : "bg-white/80"} sticky left-0 z-30 flex flex-col shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md`}
      >
        {/* Corner header with toggle & group select */}
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

        {/* Entity Rows (Sticky Left) Grouped */}
        <div className="custom-scrollbar flex-1 overflow-y-auto">
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

      {/* Week Columns 1 to 10 */}
      {columns.map((col) => (
        <div
          key={col}
          className={`w-40 shrink-0 border-r xl:w-48 ${isDark ? "border-white/5" : "border-zinc-200"} flex flex-col transition-colors hover:bg-white/[0.02] ${col === 3 ? "bg-orange-500/[0.02]" : ""}`}
        >
          {/* Header */}
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
              className={`text-xl font-black tracking-tighter xl:text-3xl ${col === 3 ? "text-orange-400" : isDark ? "text-white" : "text-zinc-900"}`}
            >
              {col}
            </h2>
            <span className="mt-1 text-[9px] font-bold tracking-widest text-zinc-500 uppercase xl:text-[10px]">
              Uke / Periode
            </span>
          </div>

          {/* Placeholders for shift assignment patterns */}
          <GridCell>
            {col % 2 !== 0 ? (
              <ShiftCard role="Sous Chef" time="5 vakter" status="published" indicator="blue" />
            ) : (
              <EmptyCell />
            )}
          </GridCell>
          <GridCell>
            <ShiftCard
              role="Manager"
              time="5 vakter"
              status={col === 3 ? "active" : "published"}
              indicator="purple"
            />
          </GridCell>
          <GridCell>
            {col % 4 === 0 ? (
              <AbsenceCard type="Avspasering" reason="Rotasjon" />
            ) : (
              <ShiftCard role="Kokk" time="4 vakter" status="draft" indicator="orange" />
            )}
          </GridCell>
          <GridCell>
            <ShiftCard role="Housekeeping" time="4 vakter" status="published" indicator="emerald" />
          </GridCell>
        </div>
      ))}
    </div>
  );
}

function GroupHeader({
  title,
  count,
  days,
}: {
  title: string;
  count: number;
  days: typeof dummyDays;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className="group/header flex w-fit min-w-full">
      <div
        className={`w-[200px] shrink-0 border-r border-b border-white/5 xl:w-[250px] ${isDark ? "bg-white/5" : "bg-zinc-100"} relative sticky left-0 z-30 flex h-8 items-center justify-between px-3 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]`}
      >
        <span
          className={`text-[10px] font-bold xl:text-xs ${isDark ? "text-white" : "text-zinc-900"} tracking-wider uppercase`}
        >
          {title}
        </span>
        <span
          className={`text-[9px] font-medium text-zinc-400 ${isDark ? "bg-white/10" : "bg-zinc-200"} rounded px-1.5 py-0.5`}
        >
          {count}
        </span>
      </div>
      {days.map((day: (typeof dummyDays)[0]) => (
        <div
          key={day.id}
          className={`w-[280px] shrink-0 border-r border-b sm:w-[320px] lg:w-[400px] ${isDark ? "border-white/5" : "border-zinc-200"} h-8 bg-white/[0.02]`}
        />
      ))}
    </div>
  );
}

function EmployeeRow({
  employee,
  subtitle,
  days,
  shiftsByEmployeeDay,
}: {
  employee: (typeof dummyEmployees)[0];
  subtitle?: string;
  days: typeof dummyDays;
  shiftsByEmployeeDay: Map<string, typeof dailyShifts>;
}) {
  const { isDark } = useContext(DashboardContext);
  const scheduledHours = parseFloat(employee.hours) || 0;
  const contractedHours = 37.5;
  const percentage = Math.min((scheduledHours / contractedHours) * 100, 100);
  const isOvertime = scheduledHours > contractedHours;

  let barColor = "bg-zinc-500";
  if (isOvertime) barColor = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
  else if (percentage >= 95) barColor = "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]";
  else if (percentage >= 70) barColor = "bg-orange-500";

  return (
    <div className="group/row flex w-fit min-w-full">
      <div
        className={`w-[200px] shrink-0 border-r border-b border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]" : "bg-white"} sticky left-0 z-30 flex h-28 items-center gap-2 p-2 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] transition-colors group-hover/row:bg-white/[0.02]`}
      >
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[9px] font-black ${employee.avatarColor}`}
        >
          {employee.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`text-[11px] font-bold xl:text-[12px] ${isDark ? "text-white" : "text-zinc-900"} truncate leading-tight transition-colors group-hover/row:text-orange-400`}
          >
            {employee.name}
          </h3>
          <p className="mb-1 truncate text-[10px] leading-tight text-zinc-500 xl:text-[11px]">
            {subtitle || employee.role}
          </p>
          <div className="mt-1 space-y-1 pr-2">
            <div className="flex items-center justify-between text-[9px] font-bold tracking-widest uppercase">
              <span className="text-zinc-500">{employee.shifts} vakter</span>
              <span
                className={
                  isOvertime
                    ? "text-red-400"
                    : percentage >= 95
                      ? "text-green-400"
                      : "text-zinc-400"
                }
              >
                {employee.hours} <span className="text-zinc-600">/{contractedHours}</span>
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

      {days.map((day: (typeof dummyDays)[0]) => {
        const dayShifts = shiftsByEmployeeDay.get(`${employee.id}::${day.id}`) ?? [];

        return (
          <MatrixCell key={day.id} isToday={day.isToday}>
            {dayShifts.length > 0 ? (
              <div className="flex h-full w-full flex-col gap-1 pb-1">
                {dayShifts.map((shift: (typeof dailyShifts)[0]) =>
                  shift.type === "absence" ? (
                    <AbsenceCard
                      key={shift.id}
                      type={shift.absenceType as "Sykdom" | "Ferie" | "Avspasering"}
                      reason={shift.reason}
                    />
                  ) : (
                    <ShiftCard
                      key={shift.id}
                      role={shift.role!}
                      time={shift.time!}
                      status={shift.status!}
                      indicator={shift.indicator!}
                      zone={shift.zone}
                      id={shift.id}
                    />
                  ),
                )}
              </div>
            ) : null}
          </MatrixCell>
        );
      })}
    </div>
  );
}

function MatrixCell({
  children,
  isToday,
  id,
}: {
  children?: React.ReactNode;
  isToday?: boolean;
  id?: string;
}) {
  const { isDark } = useContext(DashboardContext);
  const defaultId = React.useId();
  const droppableId = id || defaultId;
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      className={`w-[280px] shrink-0 border-r border-b border-white/5 sm:w-[320px] lg:w-[400px] ${isDark ? "bg-[#050505]" : "bg-zinc-50"}/40 relative flex h-28 flex-col gap-1 overflow-hidden p-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-colors ${isOver ? "z-10 scale-[1.02] rounded-lg border border-dashed border-orange-500/50 bg-orange-500/20" : "group-hover/row:bg-white/[0.02] hover:bg-white/[0.04]"} ${isToday ? "bg-orange-500/[0.02]" : ""}`}
    >
      {children ? (
        children
      ) : (
        <button
          className={`absolute inset-x-1.5 inset-y-1.5 rounded-md border border-dashed ${isDark ? "border-white/10" : "border-zinc-300"} flex cursor-pointer items-center justify-center bg-white/[0.01] text-orange-500/0 opacity-0 transition-all hover:border-orange-500/30 hover:bg-white/[0.03] hover:text-orange-500/50 hover:opacity-100`}
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
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

// SHIFT CARD COMPONENT
function ShiftCard({
  role,
  time,
  status,
  indicator,
  zone,
  id,
}: {
  role: string;
  time: string;
  status: string;
  indicator: string;
  zone?: string;
  id?: string;
}) {
  const { isDark } = useContext(DashboardContext);
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    hoverTimer.current = setTimeout(() => setShowTooltip(true), 350);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  const statusStyles: Record<string, string> = {
    draft: "border-orange-500/30 bg-orange-500/5",
    published: "border-white/10 bg-[#0a0a0c]",
    active: "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    completed: "border-white/5 bg-[#050505] opacity-60",
  };

  // Status mapping logic...
  const statusIcons: Record<string, React.ReactNode> = {
    draft: <AlertCircle className="h-3 w-3 text-orange-400" />,
    published: <Circle className={`h-3 w-3 ${isDark ? "text-zinc-400" : "text-zinc-600"}`} />,
    active: <PlayCircle className="h-3 w-3 text-emerald-400" />,
    completed: <CheckCircle2 className="h-3 w-3 text-zinc-600" />,
  };

  const indicatorColors: Record<string, string> = {
    blue: "bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]",
    emerald: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]",
    purple: "bg-purple-400 shadow-[0_0_10px_rgba(167,139,250,0.5)]",
    orange: "bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]",
  };

  const defaultId = React.useId();
  const draggableId = id || defaultId;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { role, time, status, indicator, type: "shift" },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: 50,
        position: "relative" as React.CSSProperties["position"],
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group relative flex cursor-grab flex-col gap-2 rounded-lg border p-2 transition-all hover:border-white/30 active:cursor-grabbing xl:p-2.5 ${isDark ? "hover:bg-white/5" : "hover:bg-zinc-100"} select-none ${statusStyles[status]} overflow-visible ${isDragging ? "opacity-30" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Indicator Line */}
      <div
        className={`absolute top-2 bottom-2 left-0 w-0.5 rounded-r-full ${indicatorColors[indicator]}`}
      />

      <div className="relative z-10 flex w-full items-start justify-between">
        <div className="min-w-0 pr-2">
          <span
            className={`text-[10px] font-bold xl:text-xs ${isDark ? "text-white" : "text-zinc-900"} line-clamp-1 block truncate leading-tight transition-colors group-hover:text-amber-400`}
          >
            {role}
          </span>
          {zone && (
            <div
              className={`text-[9px] ${isDark ? "text-zinc-400" : "text-zinc-600"} mt-0.5 flex items-center gap-1 whitespace-nowrap`}
            >
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{zone}</span>
            </div>
          )}
        </div>

        {/* Progress Ring / Status Icon Anchor */}
        <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          {!showTooltip ? (
            <svg className="absolute top-0 left-0 h-4 w-4 -rotate-90" viewBox="0 0 24 24">
              <circle
                className={`${isDark ? "text-white" : "text-zinc-900"}/5`}
                strokeWidth="3"
                stroke="currentColor"
                fill="transparent"
                r="10"
                cx="12"
                cy="12"
              />
              <circle
                className="text-orange-500 transition-all ease-linear"
                strokeWidth="3"
                strokeDasharray="63"
                strokeDashoffset="0"
                stroke="currentColor"
                fill="transparent"
                r="10"
                cx="12"
                cy="12"
                style={{
                  animation: "circleFill 0.35s linear forwards",
                }}
              />
              <style>{`
                @keyframes circleFill {
                  0% { stroke-dashoffset: 63; }
                  100% { stroke-dashoffset: 0; }
                }
              `}</style>
            </svg>
          ) : (
            statusIcons[status]
          )}
        </div>
      </div>

      <div
        className={`flex items-center gap-1.5 text-[9px] xl:text-[10px] ${isDark ? "text-zinc-400" : "text-zinc-600"} relative z-10 mt-auto font-medium`}
      >
        <Clock
          className={`h-3 w-3 text-zinc-500 group-hover:${isDark ? "text-zinc-400" : "text-zinc-600"}`}
        />
        {time}

        {showTooltip && <ShiftHoverCard role={role} time={time} zone={zone} />}
      </div>
    </div>
  );
}

function ShiftHoverCard({ role, time, zone }: { role: string; time: string; zone?: string }) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div
      className={`absolute top-1/2 -left-2 w-64 -translate-x-full -translate-y-1/2 ${isDark ? "bg-[#0a0a0c]/95" : "bg-white/95"} animate-in fade-in zoom-in-95 pointer-events-none z-[9999] flex flex-col gap-3 rounded-xl border border-white/10 p-4 shadow-[0_0_50px_rgba(0,0,0,1)] backdrop-blur-3xl duration-100`}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <h4 className={`text-sm font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
            {role}
          </h4>
          <div className="text-xs font-bold text-orange-400">{time}</div>
        </div>
      </div>

      <div className={`h-px w-full ${isDark ? "bg-white/10" : "bg-zinc-200"}`} />

      <div className="space-y-2">
        <div
          className={`flex items-center gap-2 text-[10px] ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span className="truncate">{zone || "Ingen sone valgt"}</span>
        </div>
        <div
          className={`flex items-center gap-2 text-[10px] ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
        >
          <Users className="h-3.5 w-3.5 shrink-0 text-zinc-500" /> Lars Erik Johansen
        </div>
        <div
          className={`flex items-center gap-2 text-[10px] ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500" /> 1 aktiv oppgave (Lukke)
        </div>
        <div
          className={`flex items-center gap-2 text-[10px] ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
        >
          <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-500" /> 0.5 timer Pause (Ubetalt)
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
        <span>Est. Lønn</span>
        <span className={`${isDark ? "text-white" : "text-zinc-900"}`}>1,624 kr</span>
      </div>
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

  let barColor = "bg-zinc-500"; // Default Neutral
  if (isOvertime) barColor = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
  else if (percentage >= 95) barColor = "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]";
  else if (percentage >= 70) barColor = "bg-orange-500";

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
          className={`text-[10px] font-bold xl:text-[11px] ${isDark ? "text-white" : "text-zinc-900"} truncate leading-tight transition-colors group-hover:text-orange-400`}
        >
          {name}
        </h3>
        <p className="mb-1 truncate text-[8px] leading-tight text-zinc-500 xl:text-[9px]">
          {subtitle}
        </p>

        {/* Capacity Progress Bar */}
        <div className="mt-1 space-y-1">
          <div className="flex items-center justify-between text-[7px] font-bold tracking-widest uppercase">
            <span className="text-zinc-500">{shifts} vakter</span>
            <span
              className={
                isOvertime ? "text-red-400" : percentage >= 95 ? "text-green-400" : "text-zinc-400"
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
function DayColumn({
  date,
  staff,
  shifts,
  isHoliday,
  isToday,
  coverageAlert,
  onClick,
  children,
}: any) {
  const { isDark, scheduleLayout } = useContext(DashboardContext);
  const minWidthClass =
    scheduleLayout === "daily"
      ? "min-w-[280px] sm:min-w-[320px] lg:min-w-[400px]"
      : "min-w-[110px] sm:min-w-[130px] lg:min-w-[140px] xl:min-w-[160px] max-w-[200px]";

  return (
    <div
      className={`flex-1 shrink-0 border-r ${isDark ? "border-white/5" : "border-zinc-200"} flex flex-col ${minWidthClass} ${isToday ? "bg-orange-500/[0.02]" : ""}`}
    >
      {/* Header Sticky block */}
      <div
        onClick={onClick}
        className={`sticky top-0 h-24 border-b border-white/5 p-2 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/90"} group/day z-20 flex cursor-pointer flex-col justify-between backdrop-blur-xl transition-colors hover:bg-white/5`}
      >
        {/* Coverage Warning Banner */}
        {coverageAlert ? (
          <div className="absolute top-0 left-0 h-1 w-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
        ) : (
          <div className="absolute top-0 left-0 h-1 w-full bg-green-500/20" />
        )}

        <div className="flex items-start justify-between">
          <div className="min-w-0 truncate pr-1">
            <h2
              className={`flex items-center gap-1.5 truncate text-[11px] font-black tracking-tight sm:text-xs ${isToday ? "text-orange-400" : isHoliday ? "text-rose-400" : isDark ? "text-zinc-300" : "text-zinc-700"}`}
            >
              <span className="truncate">{date}</span>
              {isToday && (
                <span className="h-1 w-1 shrink-0 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]"></span>
              )}
            </h2>
          </div>
          <button
            className={`shrink-0 p-1 text-zinc-500 hover:text-white ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-md transition-colors`}
          >
            <MoreVertical className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex gap-1 text-[8px] font-bold tracking-widest text-zinc-500 uppercase xl:gap-2 xl:text-[9px]">
            <span className="flex items-center gap-0.5" title="Ansatte">
              <Users className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {staff}
            </span>
            <span className="flex items-center gap-0.5" title="Vakter">
              <Briefcase className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {shifts}
            </span>
          </div>

          {coverageAlert ? (
            <div className="flex w-fit max-w-full items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-1 py-0.5 text-[8px] font-bold text-red-500">
              <AlertCircle className="h-2.5 w-2.5 shrink-0" />{" "}
              <span className="truncate">{coverageAlert}</span>
            </div>
          ) : (
            <div className="flex w-fit max-w-full items-center gap-1 rounded px-1 py-0.5 text-[8px] font-bold text-zinc-500">
              <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-green-500/50" />{" "}
              <span className="truncate">Optimal dekning</span>
            </div>
          )}
        </div>
      </div>

      {/* Cells for this day */}
      {children}
    </div>
  );
}

function GridCell({ children, id }: { children?: React.ReactNode; id?: string }) {
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

function EmptyCell() {
  const { isDark } = useContext(DashboardContext);
  return (
    <button
      className={`absolute inset-x-1 inset-y-1 rounded-md border border-dashed ${isDark ? "border-white/10" : "border-zinc-300"} flex cursor-pointer items-center justify-center bg-white/[0.01] text-orange-500/0 opacity-0 transition-all hover:border-orange-500/30 hover:bg-white/[0.03] hover:text-orange-500/50 hover:opacity-100`}
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

// Duplicate ShiftCard removed

function AbsenceCard({
  type,
  reason,
}: {
  type: "Sykdom" | "Ferie" | "Avspasering";
  reason?: string;
}) {
  const isSick = type === "Sykdom";

  return (
    <div
      className={`relative flex h-[38px] w-full shrink-0 items-center rounded-md border px-1.5 py-1 transition-all xl:h-[42px] ${
        isSick
          ? 'border-rose-500/30 bg-rose-500/10 bg-[url("/diagonal-stripes-rose.svg")] bg-repeat'
          : 'border-blue-500/30 bg-blue-500/10 bg-[url("/diagonal-stripes-blue.svg")] bg-repeat'
      }`}
    >
      {isSick ? (
        <AlertCircle className="mr-1.5 h-3.5 w-3.5 shrink-0 text-rose-400 xl:h-4 xl:w-4" />
      ) : (
        <Ban className="mr-1.5 h-3.5 w-3.5 shrink-0 text-blue-400 xl:h-4 xl:w-4" />
      )}

      <div className="flex min-w-0 flex-col truncate pr-1">
        <h4
          className={`truncate text-[10px] leading-none font-black tracking-tight xl:text-[11px] ${isSick ? "text-rose-400" : "text-blue-400"}`}
        >
          {type}
        </h4>
        {reason && (
          <p
            className={`mt-0.5 truncate text-[7px] leading-none font-bold tracking-widest uppercase xl:text-[8px] ${isSick ? "text-rose-500/80" : "text-blue-500/80"}`}
          >
            {reason}
          </p>
        )}
      </div>

      {/* Absolute overlay blocker for interactions */}
      <div className="absolute inset-0 z-10 hidden cursor-not-allowed sm:block"></div>
    </div>
  );
}

// MONTHLY HEATMAP COMPONENT (Strategic View)
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
function MonthlyGridContent({ isSidebarOpen, setIsSidebarOpen }: any) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isDark, scheduleView, setScheduleView } = useContext(DashboardContext);
  const columns = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div
      className={`flex h-full w-full min-w-[800px] flex-col ${isDark ? "bg-[#050505]" : "bg-zinc-50"}`}
    >
      {/* Header Row for strategic metrics */}
      <div
        className={`h-16 shrink-0 border-b border-white/5 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/90"} sticky top-0 z-30 flex items-center gap-6 px-6`}
      >
        <div className="flex w-[200px] items-center gap-1.5 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
          <Clock className="h-3.5 w-3.5 text-orange-500" />
          Måned: Dekning & Kostnad
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
        {/* Left Sticky Label Column */}
        <div
          className={`w-[200px] shrink-0 border-r border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]/60" : "bg-white/80"} sticky left-0 z-20 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]`}
        >
          {/* Calendar Header alignment block */}
          <div
            className={`h-[60px] border-b ${isDark ? "border-white/5" : "border-zinc-200"} bg-transparent`}
          />

          {/* Team Aggregates */}
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            <TeamCoverageRow title="Kjøkken" target={8} current={7} />
            <TeamCoverageRow title="Sal & Service" target={12} current={12} isPerfect />
            <TeamCoverageRow title="Bar" target={4} current={3} isWarning />
            <TeamCoverageRow title="Drift / Renhold" target={3} current={3} isPerfect />
          </div>
        </div>

        {/* Days Columns */}
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {columns.map((col) => {
            const isWeekend = col % 7 === 6 || col % 7 === 0;
            const isToday = col === 15;

            // Randomize some heatmap colors for demonstration
            const getHeatmapColor = (rowIdx: number) => {
              if (isWeekend && rowIdx === 2) return "bg-rose-500/20 border-rose-500/50"; // Bar struggles on weekends
              if (rowIdx === 0 && col % 5 === 0) return "bg-orange-500/20 border-orange-500/50"; // Kitchen warning
              return "bg-emerald-500/10 border-emerald-500/20"; // Good coverage
            };

            return (
              <div
                key={col}
                className={`min-w-[32px] flex-1 border-r sm:min-w-[40px] ${isDark ? "border-white/5" : "border-zinc-200"} flex flex-col transition-colors ${isToday ? "bg-orange-500/[0.04]" : isWeekend ? "bg-indigo-500/[0.02]" : ""}`}
              >
                {/* Day Header */}
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

                {/* Heatmap Blocks */}
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

// ------------------------------------------------------------------------------------------------
// LIST VIEW (PRINTABLE WEEKLY)
// ------------------------------------------------------------------------------------------------
function ListGridContent({ onDateClick }: { onDateClick: (d: string) => void }) {
  const { isDark } = useContext(DashboardContext);

  const printSchedule = () => {
    window.print();
  };

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
          onClick={printSchedule}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all ${isDark ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"} shadow-sm`}
        >
          <Printer className="h-4 w-4" /> Skriv ut
        </button>
      </div>

      <div className="hidden print:mb-8 print:block">
        <h2 className={`text-2xl font-black text-black`}>Bårdshaug Vegkro</h2>
        <p className="text-sm font-bold text-gray-500">Vaktliste • Uke 52, 2026</p>
      </div>

      <div className="space-y-8 print:space-y-4">
        {dummyDays.map((day) => {
          const dayShifts = dailyShifts
            .filter((s) => s.dateId === day.id)
            .sort((a, b) => (a.time || "").localeCompare(b.time || "")); // Sort by time

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
                          <span
                            className={`truncate text-[10px] font-bold tracking-widest text-[#a1a1aa] uppercase print:text-gray-600`}
                          >
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

// DAILY BRIEFING PANEL COMPONENT
function DailyBriefingPanel({ date, onClose }: { date: string | null; onClose: () => void }) {
  const { isDark } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<"oversikt" | "meldinger" | "bookings" | "oppgaver">(
    "oversikt",
  );

  if (!date) return null;

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Header */}
      <div
        className={`shrink-0 border-b ${isDark ? "border-white/10" : "border-zinc-300"} bg-gradient-to-r from-[#0a0a0c]/40 to-orange-500/[0.02]`}
      >
        <div className="p-5 pb-3">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex flex-col">
              <span className="mb-0.5 text-[10px] font-bold tracking-widest text-orange-400 uppercase">
                Kontrollsenter for dag
              </span>
              <h2
                className={`text-xl font-black ${isDark ? "text-white" : "text-zinc-900"} tracking-tight`}
              >
                {date}
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`p-2 text-zinc-400 hover:text-white ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-xl transition-all`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Dynamic Tab Menu */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:gap-4">
            <TabButton
              active={activeTab === "oversikt"}
              onClick={() => setActiveTab("oversikt")}
              icon={<Info className="h-3.5 w-3.5" />}
              label="Oversikt"
            />
            <TabButton
              active={activeTab === "meldinger"}
              onClick={() => setActiveTab("meldinger")}
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label="Dagsinfo"
            />
            <TabButton
              active={activeTab === "bookings"}
              onClick={() => setActiveTab("bookings")}
              icon={<CalendarCheck className="h-3.5 w-3.5" />}
              label="Selskap / Booking"
            />
            <TabButton
              active={activeTab === "oppgaver"}
              onClick={() => setActiveTab("oppgaver")}
              icon={<ListTodo className="h-3.5 w-3.5" />}
              label="Oppgaver"
            />
          </div>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
        {activeTab === "oversikt" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-purple-500/30 bg-purple-500/20 text-purple-400">
                  <Briefcase className="h-3.5 w-3.5" />
                </div>
                <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
                  Vaktansvarlig
                </h3>
              </div>
              <div
                className={`p-4 ${isDark ? "bg-white/5" : "bg-zinc-100"} group flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 transition-colors hover:border-white/20`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/20 text-xs font-black text-purple-400">
                    IH
                  </div>
                  <div className="flex flex-col">
                    <span
                      className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"} transition-colors group-hover:text-purple-400`}
                    >
                      Ingrid Haugen
                    </span>
                    <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                      Manager • 08:00 - 16:00
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-zinc-600 group-hover:${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                />
              </div>
            </section>

            {/* Quick Metrics */}
            <section>
              <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-3`}>
                Dagens nøkkeltall
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`rounded-xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-zinc-50"}`}
                >
                  <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                    Est. Kostnad
                  </span>
                  <div
                    className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"} mt-1`}
                  >
                    14,350 kr
                  </div>
                </div>
                <div
                  className={`rounded-xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-zinc-50"}`}
                >
                  <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                    Totale Timer
                  </span>
                  <div
                    className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"} mt-1`}
                  >
                    56t 30m
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === "meldinger" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
            <div
              className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-white shadow-sm"}`}
            >
              <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-2`}>
                Nytt oppslag
              </h4>
              <textarea
                placeholder="Skriv beskjed til ansatte her..."
                className={`h-24 w-full border bg-transparent ${isDark ? "border-white/10" : "border-zinc-300"} mb-3 block resize-none rounded-xl p-3 text-xs focus:border-blue-500/50 focus:outline-none`}
              />

              <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-white/20">
                    <Eye className="h-3.5 w-3.5 text-zinc-400" />
                    <select className="cursor-pointer bg-transparent text-[11px] font-bold text-zinc-300 outline-none">
                      <option>Alle På Vakt</option>
                      <option>Kun Ledere</option>
                      <option>Servering (Team)</option>
                    </select>
                  </div>
                  <div className="hidden h-4 w-px bg-white/10 md:block" />
                  <div className="flex items-center gap-1.5 rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-white/20">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    <select className="cursor-pointer bg-transparent text-[11px] font-bold text-zinc-300 outline-none">
                      <option>Hele dagen</option>
                      <option>Frem til 16:00</option>
                      <option>Permanent oppslag</option>
                    </select>
                  </div>
                </div>
                <button className="rounded-lg border border-blue-500/30 bg-blue-500/20 px-3 py-1.5 text-[10px] font-bold text-blue-400 transition-all hover:bg-blue-500/30">
                  Publiser
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h4
                className={`text-xs font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"} tracking-widest uppercase`}
              >
                Aktive Oppslag (2)
              </h4>
              <MessageCard
                title="Inngangsdøra trøbler"
                audience="Alle"
                author="Ingridhaugen"
                time="Hele dagen"
                content="Låsen på bakdøra henger litt. Dra den til deg før du vrir om for å unngå alarmen."
                alert
              />
              <MessageCard
                title="VIP Selskap kl 18:00"
                audience="Kun Ledere"
                author="System"
                time="18:00 - 22:00"
                content="Sørg for at velkomstdrinker er på plass. Jens fra styret er med og har med seg investornettverk."
              />
            </div>
          </div>
        )}

        {activeTab === "bookings" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5">
            <div className="flex items-center justify-between">
              <h4
                className={`text-xs font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"} tracking-widest uppercase`}
              >
                Reservasjoner og Selskap (2)
              </h4>
              <button className="flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300">
                <Plus className="h-3.5 w-3.5" /> Legg til manuelt
              </button>
            </div>

            <div className="space-y-3">
              <div
                className={`p-4 ${isDark ? "border border-white/10 bg-white/5 hover:border-white/20" : "border bg-white text-zinc-900 shadow-sm hover:border-zinc-300"} rounded-xl transition-colors`}
              >
                <div className="mb-2 flex justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <Users className="h-4 w-4 text-orange-400" /> Julebord Entreprenør AS
                  </span>
                  <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    Bekreftet • VIP
                  </span>
                </div>
                <p className="mb-3 text-xs font-medium text-zinc-500">
                  35 Personer • Julemeny 3-retter • Utvidet Drikkepakke (Se notat i booking)
                </p>
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div className="flex gap-4 text-[10px] font-bold text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-zinc-500" /> 18:00 - 23:00
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-zinc-500" /> Chambre Séparée
                    </span>
                  </div>
                  <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300">
                    Se detaljer
                  </button>
                </div>
              </div>

              <div
                className={`p-4 ${isDark ? "border border-white/10 bg-white/5 hover:border-white/20" : "border bg-white text-zinc-900 shadow-sm hover:border-zinc-300"} rounded-xl transition-colors`}
              >
                <div className="mb-2 flex justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <Users className="h-4 w-4 text-orange-400" /> Bursdagsfeiring: Thomas 30 år
                  </span>
                  <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                    Avventer depositum
                  </span>
                </div>
                <p className="mb-3 text-xs font-medium text-zinc-500">
                  12 Personer • À la carte • Mulig kake (må bekrefte allergener)
                </p>
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div className="flex gap-4 text-[10px] font-bold text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-zinc-500" /> 19:30 - 22:30
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-zinc-500" /> Hovedsal Bord 4-5
                    </span>
                  </div>
                  <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300">
                    Se detaljer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "oppgaver" && (
          <section className="animate-in fade-in slide-in-from-bottom-2">
            <div className="mb-4 flex items-center justify-between">
              <h3
                className={`text-xs font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"} tracking-widest uppercase`}
              >
                Gjøremål & Rutiner
              </h3>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                2 / 5 Utført
              </span>
            </div>
            <div className="space-y-2">
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Planlegg nytt gjøremål for dagen..."
                  className={`flex-1 ${isDark ? "border-white/10 bg-white/5 text-white placeholder:text-zinc-600" : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"} rounded-xl border p-3 text-xs shadow-inner focus:border-orange-500/50 focus:outline-none`}
                />
                <button className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 text-xs font-bold text-emerald-500 transition-all hover:bg-emerald-500/30 md:px-4">
                  <Plus className="h-3.5 w-3.5" /> Legg til
                </button>
              </div>
              {/* Filter tags for tasks */}
              <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto pb-1">
                <span
                  className={`shrink-0 cursor-pointer rounded-lg px-2 py-1.5 text-[9px] font-bold ${isDark ? "bg-zinc-800 text-white" : "bg-zinc-200 text-zinc-900"} transition-colors hover:bg-orange-500/20 hover:text-orange-400`}
                >
                  Alle oppgaver
                </span>
                <span
                  className={`shrink-0 cursor-pointer rounded-lg border bg-transparent px-2 py-1.5 text-[9px] font-bold text-zinc-500 ${isDark ? "border-white/10" : "border-zinc-300"} transition-colors hover:border-orange-500/50`}
                >
                  Faste Rutiner (3)
                </span>
                <span
                  className={`shrink-0 cursor-pointer rounded-lg border bg-transparent px-2 py-1.5 text-[9px] font-bold text-zinc-500 ${isDark ? "border-white/10" : "border-zinc-300"} transition-colors hover:border-orange-500/50`}
                >
                  Delegert (1)
                </span>
              </div>
              <div
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${isDark ? "border-white/5 bg-white/5 opacity-60" : "border-zinc-200 bg-zinc-100 opacity-60"}`}
              >
                <button
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-emerald-500 bg-emerald-500 text-[#050505] transition-colors`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                </button>
                <span className="truncate text-xs font-medium text-zinc-500 line-through">
                  Varetelling - Drikkevarer
                </span>
              </div>
              <div
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${isDark ? "border-white/5 bg-white/5 opacity-60" : "border-zinc-200 bg-zinc-100 opacity-60"}`}
              >
                <button
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-emerald-500 bg-emerald-500 text-[#050505] transition-colors`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                </button>
                <span className="truncate text-xs font-medium text-zinc-500 line-through">
                  Sjekk temperatur i fryser (Rutine: Stengevakt)
                </span>
              </div>
              <div
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${isDark ? "border-white/5 bg-[#0a0a0c]" : "border-zinc-200 bg-white"}`}
              >
                <button
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-600 text-transparent transition-colors hover:border-orange-500`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                </button>
                <span className="truncate text-xs font-medium text-zinc-200">
                  Motta bestilling Bama
                </span>
              </div>
              <div
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${isDark ? "border-orange-500/20 bg-orange-500/5" : "border-orange-200 bg-orange-50"}`}
              >
                <button
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-600 text-transparent transition-colors hover:border-orange-500`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                </button>
                <span className="truncate text-xs font-medium text-zinc-200">
                  Oppdater meny i kasse
                </span>
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
              </div>
              <div
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${isDark ? "border-white/5 bg-[#0a0a0c]" : "border-zinc-200 bg-white"}`}
              >
                <button
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-600 text-transparent transition-colors hover:border-orange-500`}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                </button>
                <span className="truncate text-xs font-medium text-zinc-200">
                  Kaste papp (Rutine: Kjøkken)
                </span>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Footer Broadcast Action */}
      <div className={`border-t border-white/10 p-5 ${isDark ? "bg-[#0a0a0c]" : "bg-white"}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
            <Megaphone className="h-3.5 w-3.5" /> Kringkast til alle på vakt
          </h3>
          <span className="text-[10px] font-medium text-zinc-600">8 ansatte</span>
        </div>
        <div className="flex gap-2">
          <button
            className={`flex flex-1 items-center justify-center gap-2 bg-white/5 ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white transition-all hover:border-white/20`}
          >
            <MessageCircle className="h-4 w-4 text-blue-400" /> Push Vakt
          </button>
          <button
            className={`flex flex-1 items-center justify-center gap-2 bg-white/5 ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white transition-all hover:border-white/20`}
          >
            <Mail className="h-4 w-4 text-orange-400" /> SMS
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-2 text-[11px] font-bold whitespace-nowrap transition-all ${active ? (isDark ? "border-orange-500 text-orange-400" : "border-orange-500 text-orange-500") : "border-transparent text-zinc-500 hover:text-zinc-400"} px-2`}
    >
      {icon} {label}
    </button>
  );
}

function MessageCard({
  title,
  audience,
  author,
  time,
  content,
  alert,
}: {
  title: string;
  audience: string;
  author: string;
  time: string;
  content: string;
  alert?: boolean;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div
      className={`rounded-xl border p-4 ${alert ? (isDark ? "border-rose-500/30 bg-rose-500/10" : "border-rose-200 bg-rose-50") : isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-white"} transition-all`}
    >
      <div className="mb-2 flex items-start justify-between">
        <h5
          className={`flex items-center gap-1.5 text-xs font-black ${alert ? "text-rose-400" : isDark ? "text-white" : "text-zinc-900"}`}
        >
          {alert && <AlertCircle className="h-3.5 w-3.5" />} {title}
        </h5>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase ${isDark ? "bg-black/40 text-zinc-400" : "bg-zinc-100 text-zinc-500"}`}
        >
          {time}
        </span>
      </div>
      <p className={`text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"} mb-3`}>
        {content}
      </p>
      <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500">
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" /> Synlig for: {audience}
        </span>
        <span className="italic">Av: {author}</span>
      </div>
    </div>
  );
}

function TemplateCard({
  id,
  title,
  hours,
  routines,
}: {
  id: string;
  title: string;
  team: string;
  hours: string;
  routines: number;
}) {
  const { isDark } = useContext(DashboardContext);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: {
      role: title,
      time: hours,
      status: "draft",
      indicator: "yellow",
      type: "shift-template",
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: 50,
        position: "relative" as React.CSSProperties["position"],
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 ${isDark ? "bg-[#151518]" : "bg-white"} border ${isDark ? "border-dashed border-zinc-700" : "border-dashed border-zinc-300"} group cursor-grab rounded-xl shadow-sm transition-all hover:border-orange-500/50 hover:bg-orange-500/5 active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      <div className="mb-1.5 flex items-start justify-between">
        <h4
          className={`text-xs font-bold ${isDark ? "text-white" : "text-zinc-900"} transition-colors group-hover:text-orange-400`}
        >
          {title}
        </h4>
        <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[8px] leading-none font-black tracking-widest text-orange-400 uppercase">
          Mal
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] font-medium text-zinc-500">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {hours}
        </div>
        <div
          className="flex items-center gap-1"
          title={`${routines} faste rutiner knyttet til vakt`}
        >
          <ListTodo className="h-3 w-3 text-emerald-500/70" /> {routines} rutiner
        </div>
      </div>
    </div>
  );
}
