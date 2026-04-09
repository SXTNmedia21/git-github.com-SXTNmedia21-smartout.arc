"use client";

import React, {
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Users,
  Briefcase,
  Network,
  Plus,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
} from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import {
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  useDndContext,
  useDroppable,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { MalGrid } from "./_components/week-grid";
import { PlannerCommandBar } from "./_components/planner-command-bar";
import { StatusStrip } from "./_components/status-strip";
import { GridSurface } from "./_components/grid-surface";
import { GridContent } from "./_components/daily-grid";
import { ShiftCard, OpenShiftCard, TemplateCard, AbsenceCard } from "./_components/grid-cards";
import type { Shift, OpenShift, ShiftTemplate } from "./_components/schedule-types";

type TemplateShift = ShiftTemplate["shifts"][number];
import { ScheduleDragOverlay } from "./_components/schedule-drag-overlay";
import { DayControlSheet, DayControlPanel } from "./_components/day-control";
import { OpenShiftDialog } from "./_components/open-shift-dialog";
import { CreateTemplateDialog } from "./_components/create-template-dialog";
import { EditTemplateDialog } from "./_components/edit-template-dialog";
import { ShiftModal } from "./_components/shift-modal";
import { BatchActionBar } from "./_components/batch-action-bar";
import { AbsencePopover } from "./_components/absence-popover";
import { EmployeeDrawer } from "./_components/employee-drawer";
import { PublishOverviewDialog } from "./_components/publish-overview-dialog";
import { SendMessageDialog } from "./_components/send-message-dialog";
import { MonthlyView } from "./_components/monthly-view";
import { SCHEDULE_LAYERS } from "./_components/schedule-layers";

import type { DayColumn } from "./_components/schedule-data";

// ── Employee data from Supabase ──────────────────────────────
import { useEmployees, type ScheduleEmployee } from "./_hooks/use-employees";

// ── New TanStack Query hooks ────────────────────────────────
import { ScheduleUIProvider, useScheduleUI } from "./_components/schedule-ui-context";
import { AgentProposalsProvider, useAgentProposals } from "./_components/agent-proposals-context";
import { ProposalBanner } from "./_components/proposal-banner";
import { ScheduleVoiceToolsBridge } from "./_components/schedule-voice-tools-bridge";
import {
  useShifts,
  useCreateShift,
  useUpdateShift,
  useMoveShift,
  useDeleteShift,
  usePublishShifts,
} from "./_hooks/use-shifts";
import { useAbsences } from "./_hooks/use-absences";
import { useTemplates, useLoadTemplate } from "./_hooks/use-templates";
import { useOpenShifts, useCreateOpenShift, useAssignOpenShift } from "./_hooks/use-open-shifts";
import {
  useDayMessages,
  useCreateDayMessage,
  useDayTasks,
  useDayBookings,
} from "./_hooks/use-day-content";
import { useScheduleRealtime } from "./_hooks/use-schedule-realtime";
import { useShiftConflicts } from "./_hooks/useShiftConflicts";
import { useScheduleComputed, type ScheduleComputed } from "./_hooks/use-schedule-computed";
import { useDayInfo } from "./_hooks/use-day-info";
import { useShiftReadinessCheck } from "./_hooks/use-shift-readiness-check";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Week range helper — supports week offset for navigation
// ---------------------------------------------------------------------------
function getWeekRange(weekOffset = 0): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // Use local date parts to avoid UTC timezone shift (Norway is UTC+1/+2)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}

// ---------------------------------------------------------------------------
// Generate day columns — supports variable day count (7 or 14)
// ---------------------------------------------------------------------------
const DAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function formatSmsPrefill(dateId: string): string {
  const date = new Date(`${dateId}T00:00:00`);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  return `Regarding shift on ${weekday}`;
}

function generateDayColumns(weekStart: string, dayCount = 7): DayColumn[] {
  const start = new Date(weekStart + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Use local date parts to avoid UTC timezone shift
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dateStr = fmt(date);
    const dayNum = date.getDate();
    const month = date.getMonth() + 1;
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...
    const label = DAY_LABELS[(dayOfWeek + 6) % 7] ?? "";

    return {
      id: dateStr,
      label: `${label} ${dayNum}/${month}`,
      staff: 0,
      shifts: 0,
      cost: "0",
      isToday: date.getTime() === today.getTime(),
      isHoliday: dayOfWeek === 0 || dayOfWeek === 6,
      situation: "Normal",
    };
  });
}

// ---------------------------------------------------------------------------
// Collision detection: pointer-first, rect fallback
// ---------------------------------------------------------------------------
const scheduleCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

// ---------------------------------------------------------------------------
// SchedulePage — thin composition layer with providers
// ---------------------------------------------------------------------------
export default function SchedulePage() {
  return (
    <ScheduleUIProvider>
      <SchedulePageContent />
    </ScheduleUIProvider>
  );
}

// ---------------------------------------------------------------------------
// GridContentWithProposals — wraps GridContent with proposal context
// Must be rendered inside AgentProposalsProvider
// ---------------------------------------------------------------------------
function GridContentWithProposals(
  props: Omit<
    Parameters<typeof GridContent>[0],
    "proposals" | "onApproveProposal" | "onRejectProposal"
  >,
) {
  const { proposals, approveProposal, rejectProposal } = useAgentProposals();
  return (
    <GridContent
      {...props}
      proposals={proposals}
      onApproveProposal={approveProposal}
      onRejectProposal={rejectProposal}
    />
  );
}

// ---------------------------------------------------------------------------
// SchedulePageContent — query hooks + rendering
// ---------------------------------------------------------------------------
function SchedulePageContent() {
  const schedulePerfStartRef = useRef<number | null>(null);
  const firstInteractionCapturedRef = useRef(false);
  const {
    isDark,
    scheduleLayout,
    setScheduleLayout,
    scheduleDateOffset,
    setScheduleDateOffset,
    setOnPublishAll,
    setScheduleDraftCount,
    scheduleCompactMode,
    setScheduleView,
    setWeeklyPeriodCount,
  } = useContext(DashboardContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterSituation, setFilterSituation] = useState("Alle");
  const [sidebarMode, setSidebarMode] = useState<"open" | "templates">("open");
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  const [weekSpan, setWeekSpan] = useState<1 | 2>(1);
  const [publishOverviewOpen, setPublishOverviewOpen] = useState(false);
  const [highlightedDayId, setHighlightedDayId] = useState<string | null>(null);
  const [loadSecondaryData, setLoadSecondaryData] = useState(false);
  const [sendMessageDialog, setSendMessageDialog] = useState<{
    open: boolean;
    dateId: string;
    dateLabel: string;
    initialMessage: string;
  }>({ open: false, dateId: "", dateLabel: "", initialMessage: "" });
  const scheduleUI = useScheduleUI();
  const { selectedDayId, setSelectedDay } = scheduleUI;
  const activeSelectedDate = selectedDayId ?? selectedDate;
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Scrolls to a schedule day header, briefly highlights it, and optionally
   * opens the day planner sheet for that date.
   */
  const focusDayInUI = useCallback(
    (dateId: string, openPlanner: boolean) => {
      if (!dateId) return;

      if (scheduleLayout !== "daily") {
        setScheduleLayout("daily");
      }

      // Wait one frame for layout updates, then center the day header.
      requestAnimationFrame(() => {
        const dayHeader = document.querySelector(
          `[data-schedule-day-id="${dateId}"]`,
        ) as HTMLElement | null;
        dayHeader?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      });

      setHighlightedDayId(dateId);
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = setTimeout(() => setHighlightedDayId(null), 3500);

      if (openPlanner) {
        setSelectedDate(dateId);
        if (selectedDayId) setSelectedDay(null);
      }
    },
    [scheduleLayout, setScheduleLayout, selectedDayId, setSelectedDay],
  );

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  // Temporary frontend regression instrumentation for schedule boot.
  useEffect(() => {
    schedulePerfStartRef.current = performance.now();
    performance.mark("schedule:route-enter");
  }, []);

  // Let the primary schedule grid render first, then load secondary datasets when idle.
  useEffect(() => {
    const globalWindow = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof globalWindow.requestIdleCallback === "function") {
      const idleId = globalWindow.requestIdleCallback(
        () => {
          setLoadSecondaryData(true);
        },
        { timeout: 1200 },
      );
      return () => {
        globalWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timeoutId = window.setTimeout(() => setLoadSecondaryData(true), 300);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 1 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Week range and day columns (reactive to offset + span) ─
  const { weekStart, weekEnd } = useMemo(() => {
    const range = getWeekRange(scheduleDateOffset);
    if (weekSpan === 2) {
      // Extend end by 7 days for 2-week view
      const end = new Date(range.weekStart + "T00:00:00");
      end.setDate(end.getDate() + 13);
      return { weekStart: range.weekStart, weekEnd: end.toISOString().split("T")[0] ?? "" };
    }
    return range;
  }, [scheduleDateOffset, weekSpan]);
  const dayCount = weekSpan === 2 ? 14 : 7;
  const days = useMemo(() => generateDayColumns(weekStart, dayCount), [weekStart, dayCount]);

  // ── Workspace context ───────────────────────────────────────
  const ctx = useWorkspaceOptional();
  const workspace = ctx?.workspace;

  const shouldLoadSidebarData = loadSecondaryData || isSidebarOpen || sidebarMode === "templates";
  const shouldLoadDayContent =
    loadSecondaryData || activeSelectedDate !== null || sendMessageDialog.open;

  // ── TanStack Query hooks ────────────────────────────────────
  const employeesQuery = useEmployees();
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const shiftsQuery = useShifts(weekStart, weekEnd);
  const absencesQuery = useAbsences(weekStart, weekEnd);
  const templatesQuery = useTemplates({ enabled: shouldLoadSidebarData });
  const openShiftsQuery = useOpenShifts({ enabled: shouldLoadSidebarData });
  const dayMessagesQuery = useDayMessages(weekStart, weekEnd, { enabled: shouldLoadDayContent });
  const dayTasksQuery = useDayTasks(weekStart, weekEnd, { enabled: shouldLoadDayContent });
  const dayBookingsQuery = useDayBookings(weekStart, weekEnd, { enabled: shouldLoadDayContent });
  const { dayInfoByDate } = useDayInfo(weekStart, weekEnd, { enabled: shouldLoadDayContent });
  const { readinessMap } = useShiftReadinessCheck();

  // ── Enrich day columns with day info + real shift/staff/message/task counts ─
  const shouldComputeEnrichedDays =
    scheduleLayout === "daily" || activeSelectedDate !== null || sendMessageDialog.open;

  const enrichedDays = useMemo(() => {
    if (!shouldComputeEnrichedDays) return days;

    const allShifts = shiftsQuery.data ?? [];
    const allMessages = dayMessagesQuery.data ?? [];
    const allTasks = dayTasksQuery.data ?? [];

    // Build per-day indexes once to avoid repeated O(days * list) scans during render.
    const shiftsByDate = new Map<string, Shift[]>();
    for (const shift of allShifts) {
      const list = shiftsByDate.get(shift.dateId) ?? [];
      list.push(shift);
      shiftsByDate.set(shift.dateId, list);
    }

    const messageCountByDate = new Map<string, number>();
    for (const message of allMessages) {
      messageCountByDate.set(message.dateId, (messageCountByDate.get(message.dateId) ?? 0) + 1);
    }

    const taskSummaryByDate = new Map<string, { total: number; done: number }>();
    for (const task of allTasks) {
      const summary = taskSummaryByDate.get(task.dateId) ?? { total: 0, done: 0 };
      summary.total += 1;
      if (task.status === "completed") summary.done += 1;
      taskSummaryByDate.set(task.dateId, summary);
    }

    return days.map((day) => {
      const infos = dayInfoByDate.get(day.id) ?? [];
      const events = infos
        .filter((d) => d.category === "event")
        .map((e) => ({ id: e.id, title: e.title }));
      const notes = infos
        .filter((d) => d.category !== "event")
        .map((n) => ({ id: n.id, title: n.title, scope: n.scopeType }));

      const dayShifts = shiftsByDate.get(day.id) ?? [];
      const uniqueEmployees = new Set(dayShifts.map((s) => s.employeeId).filter(Boolean));
      const dayMsgCount = messageCountByDate.get(day.id) ?? 0;
      const dayTaskSummary = taskSummaryByDate.get(day.id);

      return {
        ...day,
        staff: uniqueEmployees.size,
        shifts: dayShifts.length,
        messages: dayMsgCount > 0 ? dayMsgCount : undefined,
        tasks: dayTaskSummary
          ? { done: dayTaskSummary.done, total: dayTaskSummary.total }
          : undefined,
        events: events.length > 0 ? events : undefined,
        dayInfo: notes.length > 0 ? notes : undefined,
      };
    });
  }, [
    shouldComputeEnrichedDays,
    days,
    dayInfoByDate,
    shiftsQuery.data,
    dayMessagesQuery.data,
    dayTasksQuery.data,
  ]);

  useEffect(() => {
    const handleSmsCompose = (event: Event) => {
      const customEvent = event as CustomEvent<{
        dateId?: string;
        employeeName?: string;
        shiftTime?: string;
        customMessage?: string;
        includeDaginfo?: boolean;
      }>;
      const targetDateId = customEvent.detail?.dateId ?? new Date().toISOString().slice(0, 10);
      const dayLabel = enrichedDays.find((day) => day.id === targetDateId)?.label ?? targetDateId;
      const employeeName = customEvent.detail?.employeeName;
      const shiftTime = customEvent.detail?.shiftTime;
      const contextualLine =
        employeeName && shiftTime ? `\n\nEmployee: ${employeeName}\nShift: ${shiftTime}` : "";
      const customMessage = customEvent.detail?.customMessage?.trim();
      const includeDaginfo = customEvent.detail?.includeDaginfo === true;
      const initialMessage =
        customMessage && customMessage.length > 0
          ? includeDaginfo
            ? `${customMessage}\n\n${formatSmsPrefill(targetDateId)}${contextualLine}`
            : `${customMessage}${contextualLine}`
          : `${formatSmsPrefill(targetDateId)}${contextualLine}`;

      setSendMessageDialog({
        open: true,
        dateId: targetDateId,
        dateLabel: dayLabel,
        initialMessage,
      });
    };

    window.addEventListener("smartout:schedule-sms-compose", handleSmsCompose);
    return () => {
      window.removeEventListener("smartout:schedule-sms-compose", handleSmsCompose);
    };
  }, [enrichedDays]);

  // ── Realtime subscription ───────────────────────────────────
  useScheduleRealtime(weekStart, {
    includeDayContent: shouldLoadDayContent,
    includeOpenShifts: shouldLoadSidebarData,
  });

  // ── Computed values ─────────────────────────────────────────
  const computed = useScheduleComputed(
    shiftsQuery.data ?? [],
    absencesQuery.data ?? [],
    (openShiftsQuery.data ?? []).length,
    templatesQuery.data ?? [],
    dayMessagesQuery.data ?? [],
    dayTasksQuery.data ?? [],
    dayBookingsQuery.data ?? [],
  );

  // ── Mutation hooks ──────────────────────────────────────────
  const createShift = useCreateShift(weekStart);
  const updateShift = useUpdateShift(weekStart);
  const moveShift = useMoveShift(weekStart);
  const deleteShift = useDeleteShift(weekStart);
  const publishShifts = usePublishShifts(weekStart);
  const loadTemplate = useLoadTemplate(weekStart);
  const createOpenShift = useCreateOpenShift();
  const assignOpenShift = useAssignOpenShift(weekStart);
  const createDayMessage = useCreateDayMessage(weekStart);

  /** Handles Shift+drag resize updates from grid cards without extra hook subscriptions in grid rows. */
  const handleGridShiftTimeChange = useCallback(
    (shiftId: string, newStart: string, newEnd: string) => {
      const startMins =
        parseInt(newStart.split(":")[0] ?? "0", 10) * 60 +
        parseInt(newStart.split(":")[1] ?? "0", 10);
      let endMins =
        parseInt(newEnd.split(":")[0] ?? "0", 10) * 60 + parseInt(newEnd.split(":")[1] ?? "0", 10);
      if (endMins <= startMins) endMins += 24 * 60;
      const workHours = Math.max(0, (endMins - startMins) / 60);

      updateShift.mutate({
        id: shiftId,
        patch: { startTime: newStart, endTime: newEnd, workHours },
      });
    },
    [updateShift],
  );

  const handleSetSelectedDate = useCallback(
    (date: string | null) => {
      setSelectedDate(date);
      if (date === null && selectedDayId) {
        setSelectedDay(null);
      }
      if (date !== null && selectedDayId) {
        setSelectedDay(null);
      }
    },
    [selectedDayId, setSelectedDay],
  );

  // ── Derived values ──────────────────────────────────────────
  const shifts = useMemo(() => shiftsQuery.data ?? [], [shiftsQuery.data]);

  // Shift conflict detection — flags overlapping shifts for the same employee
  const conflictSlots = useMemo(
    () =>
      shifts.map((s) => ({
        shiftId: s.id,
        employeeId: s.employeeId,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    [shifts],
  );
  const conflicts = useShiftConflicts(conflictSlots);
  const conflictedShiftIds = useMemo(
    () => new Set(conflicts.flatMap((c) => [c.shiftIdA, c.shiftIdB])),
    [conflicts],
  );

  const templates = templatesQuery.data ?? [];
  const openShifts = openShiftsQuery.data ?? [];
  const statusSummary = computed.getStatusSummary();

  // ── Employee custom order + compact sort ──────────────────
  const [employeeOrder, setEmployeeOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("schedule-employee-order");
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });

  // Persist custom order to localStorage
  const saveEmployeeOrder = useCallback((order: string[]) => {
    setEmployeeOrder(order);
    try {
      localStorage.setItem("schedule-employee-order", JSON.stringify(order));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  // Build a set of employee IDs with shifts this week for compact sort
  const employeesWithShifts = useMemo(() => {
    const set = new Set<string>();
    for (const s of shifts) {
      if (s.employeeId) set.add(s.employeeId);
    }
    return set;
  }, [shifts]);

  // Sorted employees: apply custom order first, then compact auto-sort
  const sortedEmployees = useMemo(() => {
    const sorted = [...employees];

    // Apply custom order if any
    if (employeeOrder.length > 0) {
      const orderIndex = new Map(employeeOrder.map((id, i) => [id, i]));
      sorted.sort((a, b) => {
        const ai = orderIndex.get(a.id) ?? Infinity;
        const bi = orderIndex.get(b.id) ?? Infinity;
        return ai - bi;
      });
    }

    // When compact, employees with shifts float to top
    if (scheduleCompactMode) {
      sorted.sort((a, b) => {
        const aHas = employeesWithShifts.has(a.id) ? 0 : 1;
        const bHas = employeesWithShifts.has(b.id) ? 0 : 1;
        return aHas - bHas;
      });
    }

    return sorted;
  }, [employees, employeeOrder, scheduleCompactMode, employeesWithShifts]);

  // ── Department-based employee filtering ──────────────────
  const { activeDepartment, setActiveDepartment } = useContext(DashboardContext);

  const departmentFilteredEmployees = useMemo(() => {
    if (!activeDepartment || activeDepartment === "Alle avdelinger") return sortedEmployees;
    return sortedEmployees.filter((emp) => emp.departmentName === activeDepartment);
  }, [sortedEmployees, activeDepartment]);

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    for (const emp of employees) {
      if (emp.departmentName) names.add(emp.departmentName);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "nb"));
  }, [employees]);

  useEffect(() => {
    if (activeDepartment === "Alle avdelinger") return;
    if (departmentOptions.includes(activeDepartment)) return;
    setActiveDepartment("Alle avdelinger");
  }, [activeDepartment, departmentOptions, setActiveDepartment]);

  const visibleEmployeeIds = useMemo(
    () => new Set(departmentFilteredEmployees.map((employee) => employee.id)),
    [departmentFilteredEmployees],
  );

  const filteredShifts = useMemo(() => {
    const baseShifts = shifts.filter((shift) =>
      shift.employeeId ? visibleEmployeeIds.has(shift.employeeId) : true,
    );
    if (!activeStatusFilter) return baseShifts;

    switch (activeStatusFilter) {
      case "draft":
        return baseShifts.filter(
          (shift) => shift.status === "created" || shift.status === "assigned",
        );
      case "published":
        return baseShifts.filter((shift) => shift.status === "published");
      case "active":
        return baseShifts.filter((shift) => shift.status === "active");
      case "completed":
        return baseShifts.filter((shift) => shift.status === "completed");
      case "absence":
        // Show shifts only for employees who have absences in the period
        return baseShifts;
      default:
        return baseShifts;
    }
  }, [shifts, visibleEmployeeIds, activeStatusFilter]);

  const filteredAbsences = useMemo(() => {
    const baseAbsences = (absencesQuery.data ?? []).filter((absence) =>
      visibleEmployeeIds.has(absence.employeeId),
    );
    if (activeStatusFilter === "absence") return baseAbsences;
    if (!activeStatusFilter) return baseAbsences;
    return baseAbsences;
  }, [absencesQuery.data, visibleEmployeeIds, activeStatusFilter]);

  // ── Situation-filtered day columns ────────────────────────
  const situationFilteredDays = useMemo(() => {
    if (filterSituation === "Alle") return enrichedDays;
    return enrichedDays.map((day) => {
      const hasEvents = (day.events?.length ?? 0) > 0;
      const hasAlerts = day.coverageAlert != null;
      let dimmed = false;

      if (filterSituation === "Selskap") {
        // Dim days without events/bookings
        dimmed = !hasEvents;
      } else if (filterSituation === "Krise") {
        // Dim days without coverage alerts
        dimmed = !hasAlerts;
      } else if (filterSituation === "Normal") {
        // Dim days that have events or alerts (show only "normal" days)
        dimmed = hasEvents || hasAlerts;
      }

      return { ...day, situation: dimmed ? "__dimmed__" : day.situation };
    });
  }, [enrichedDays, filterSituation]);

  // Register the publish-all callback and draft count with the DashboardShell header.
  // Both setOnPublishAll and setScheduleDraftCount write to refs (no context re-render),
  // so they are safe to call during render without causing infinite loops.
  const draftIds = useMemo(
    () =>
      shifts
        .filter((s: Shift) => s.status === "created" || s.status === "assigned")
        .map((s: Shift) => s.id),
    [shifts],
  );
  const draftCount = draftIds.length;

  const publishMutateRef = useRef(publishShifts.mutate);
  const draftIdsRef = useRef(draftIds);

  // ── Ctrl+drag copy mode ─────────────────────────────────────
  /** Tracks whether Ctrl/Meta is currently held (updated via keyboard listeners). */
  const isCtrlHeldRef = useRef(false);
  /** True when the current drag started with Ctrl held (copy-drag). */
  const isCopyDragRef = useRef(false);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const nativeEvent = event.activatorEvent as MouseEvent | TouchEvent | KeyboardEvent;
    const ctrlHeld = "ctrlKey" in nativeEvent && (nativeEvent.ctrlKey || nativeEvent.metaKey);
    isCopyDragRef.current = ctrlHeld;
  }, []);

  // Track Ctrl/Meta key state globally so we know at drop time
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") isCtrlHeldRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") isCtrlHeldRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Sync refs + draft count and publish callback to DashboardShell
  // Opens the publish overview dialog instead of publishing directly
  useEffect(() => {
    publishMutateRef.current = publishShifts.mutate;
    draftIdsRef.current = draftIds;
    setScheduleDraftCount(draftCount);
    setOnPublishAll(draftCount > 0 ? () => setPublishOverviewOpen(true) : null);
    return () => {
      setScheduleDraftCount(0);
      setOnPublishAll(null);
    };
  }, [draftCount, draftIds, publishShifts.mutate, setScheduleDraftCount, setOnPublishAll]);

  /** Warn if an employee has incomplete training when assigned a shift. */
  const warnIfNotReady = (employeeId: string) => {
    const entry = readinessMap.get(employeeId);
    if (!entry || entry.readinessPercent >= 100) return;
    const emp = employees.find((e: ScheduleEmployee) => e.id === employeeId);
    const name = emp?.name ?? "Ansatt";
    toast.warning(`${name} — ${entry.readinessPercent}% klar`, {
      description: `Mangler: ${entry.pendingProtocols.slice(0, 3).join(", ")}${entry.pendingProtocols.length > 3 ? "…" : ""}`,
    });
  };

  /**
   * Handles DnD drop events.
   * Parses droppable ID format: "cell::employeeId::dateId" or "day-header::dateId"
   * and calls the appropriate mutation based on drag source type.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const sourceType = active.data.current?.type as string | undefined;

    // ── Employee row reorder ───────────────────────────────────
    if (sourceType === "employee-sort") {
      if (active.id !== over.id) {
        const currentIds = sortedEmployees.map((e) => e.id);
        const oldIndex = currentIds.indexOf(String(active.id));
        const newIndex = currentIds.indexOf(String(over.id));
        if (oldIndex !== -1 && newIndex !== -1) {
          saveEmployeeOrder(arrayMove(currentIds, oldIndex, newIndex));
        }
      }
      return;
    }

    const droppableId = String(over.id);

    // Parse droppable ID
    const cellMatch = droppableId.match(/^cell::(.+)::(.+)$/);
    const dayHeaderMatch = droppableId.match(/^day-header::(.+)$/);

    // Shift dropped on open shift zone → convert to open shift
    if (droppableId === "open-shift-zone" && sourceType === "shift") {
      const shiftId = active.data.current?.shiftId as string | undefined;
      if (shiftId) {
        const sourceShift = shifts.find((s: Shift) => s.id === shiftId);
        if (sourceShift) {
          createOpenShift.mutate({
            id: crypto.randomUUID(),
            title: sourceShift.role,
            startTime: sourceShift.startTime,
            endTime: sourceShift.endTime,
            role: sourceShift.role,
            dayCategory: sourceShift.dayCategory,
          });
          // Remove the original assigned shift
          deleteShift.mutate(shiftId);
        }
      }
    } else if (cellMatch && sourceType === "shift") {
      const [, toEmployeeId, toDateId] = cellMatch;
      const shiftId = active.data.current?.shiftId as string | undefined;
      if (shiftId && toEmployeeId && toDateId) {
        if (isCopyDragRef.current && isCtrlHeldRef.current) {
          // Ctrl+drag → duplicate shift to target cell
          const sourceShift = shifts.find((s: Shift) => s.id === shiftId);
          if (sourceShift) {
            createShift.mutate({
              id: crypto.randomUUID(),
              employeeId: toEmployeeId,
              dateId: toDateId,
              role: sourceShift.role,
              positionId: sourceShift.positionId,
              teamId: sourceShift.teamId,
              startTime: sourceShift.startTime,
              endTime: sourceShift.endTime,
              workHours: sourceShift.workHours,
              status: sourceShift.status === "published" ? "created" : sourceShift.status,
              dayCategory: sourceShift.dayCategory,
              zone: sourceShift.zone,
              indicator: sourceShift.indicator,
              isPublished: false,
              breaks: sourceShift.breaks,
              notes: sourceShift.notes,
            });
            warnIfNotReady(toEmployeeId);
          }
        } else {
          // Normal drag → move shift
          moveShift.mutate({ id: shiftId, employeeId: toEmployeeId, dateId: toDateId });
          warnIfNotReady(toEmployeeId);
        }
      }
    } else if (cellMatch && sourceType === "open-shift") {
      // Open shift dropped on employee cell -> assign
      const [, employeeId, dateId] = cellMatch;
      if (employeeId && dateId) {
        const openShift = openShifts.find((os: OpenShift) => os.id === String(active.id));
        if (openShift) {
          assignOpenShift.mutate({
            openShiftId: String(active.id),
            shift: {
              id: crypto.randomUUID(),
              employeeId,
              dateId,
              role: openShift.role ?? "",
              startTime: openShift.startTime,
              endTime: openShift.endTime,
              workHours: 0,
              status: "assigned",
              dayCategory: openShift.dayCategory ?? "morning",
              indicator: "orange",
              isPublished: false,
              breaks: 0,
            },
          });
          warnIfNotReady(employeeId);
        }
      }
    } else if (cellMatch && sourceType === "shift-template") {
      // Template dropped on employee cell -> create shifts from template
      const templateId = active.data.current?.templateId as string | undefined;
      const [, , dateId] = cellMatch;
      if (templateId && dateId) {
        const template = templates.find((t: ShiftTemplate) => t.id === templateId);
        if (template) {
          const shiftsToCreate = template.shifts.map((s: TemplateShift) => ({
            id: crypto.randomUUID(),
            employeeId: s.employeeId,
            dateId,
            role: s.role,
            startTime: s.startTime,
            endTime: s.endTime,
            workHours: s.workHours,
            status: s.status,
            dayCategory: s.dayCategory,
            indicator: s.indicator,
            isPublished: false,
            breaks: s.breaks,
            positionId: s.positionId,
            teamId: s.teamId,
            zone: s.zone,
            notes: s.notes,
          }));
          loadTemplate.mutate({ template, shifts: shiftsToCreate });
        }
      }
    } else if (dayHeaderMatch && sourceType === "shift-template") {
      // Template dropped on day header -> apply whole template to day
      const templateId = active.data.current?.templateId as string | undefined;
      const [, dateId] = dayHeaderMatch;
      if (templateId && dateId) {
        const template = templates.find((t: ShiftTemplate) => t.id === templateId);
        if (template) {
          const shiftsToCreate = template.shifts.map((s: TemplateShift) => ({
            id: crypto.randomUUID(),
            employeeId: s.employeeId,
            dateId,
            role: s.role,
            startTime: s.startTime,
            endTime: s.endTime,
            workHours: s.workHours,
            status: s.status,
            dayCategory: s.dayCategory,
            indicator: s.indicator,
            isPublished: false,
            breaks: s.breaks,
            positionId: s.positionId,
            teamId: s.teamId,
            zone: s.zone,
            notes: s.notes,
          }));
          loadTemplate.mutate({ template, shifts: shiftsToCreate });
        }
      }
    }

    // Always reset copy-drag state after drop
    isCopyDragRef.current = false;
  };

  const handleDragCancel = useCallback(() => {
    isCopyDragRef.current = false;
  }, []);

  const isLoading = shiftsQuery.isLoading;

  useEffect(() => {
    if (isLoading) return;
    const start = schedulePerfStartRef.current;
    if (start === null) return;

    requestAnimationFrame(() => {
      const renderMs = Math.round(performance.now() - start);
      performance.mark("schedule:first-render");
      performance.measure(
        "schedule:first-render-duration",
        "schedule:route-enter",
        "schedule:first-render",
      );
      // eslint-disable-next-line no-console -- perf tracing
      console.info("[schedule-perf] first-render-ms", renderMs);
    });
  }, [isLoading]);

  useEffect(() => {
    if (firstInteractionCapturedRef.current) return;

    const handlePointerDown = () => {
      if (firstInteractionCapturedRef.current) return;
      firstInteractionCapturedRef.current = true;
      const start = schedulePerfStartRef.current;
      if (start === null) return;
      // eslint-disable-next-line no-console -- perf tracing
      console.info("[schedule-perf] first-interaction-ms", Math.round(performance.now() - start));
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <AgentProposalsProvider
      createShift={(input) =>
        createShift.mutateAsync(input as Parameters<typeof createShift.mutateAsync>[0])
      }
      updateShift={(input) => updateShift.mutateAsync(input)}
      deleteShift={(id) => deleteShift.mutateAsync(id)}
    >
      <ScheduleVoiceToolsBridge
        weekStart={weekStart}
        weekEnd={weekEnd}
        workspaceId={workspace?.workspace_id ?? ""}
        enrichedDays={enrichedDays}
        shifts={shiftsQuery.data ?? []}
        absences={absencesQuery.data ?? []}
        employees={employees}
        computed={computed}
        focusDayInUI={focusDayInUI}
        setSelectedDate={handleSetSelectedDate}
        switchScheduleView={(view) =>
          setScheduleView(view as "ansatt" | "jobb" | "team" | "lokasjon")
        }
        setTimePeriod={(weeks) => setWeeklyPeriodCount(weeks)}
        setFilterSituation={setFilterSituation}
        navigateToDate={(weekOffset) => {
          // Relative (neste/forrige): small offset added to current position
          // Absolute (uke 17, date): full offset from now
          if (Math.abs(weekOffset) <= 2 && weekOffset !== 0) {
            setScheduleDateOffset(scheduleDateOffset + weekOffset);
          } else {
            setScheduleDateOffset(weekOffset);
          }
        }}
        switchLayout={(layout) =>
          setScheduleLayout(layout as "daily" | "weekly" | "monthly" | "list" | "grid")
        }
      />
      <div
        className={`bg-background border-border text-foreground relative isolate flex h-full flex-1 flex-col overflow-hidden rounded-2xl border font-sans shadow-2xl print:block print:h-auto print:overflow-visible print:border-none print:bg-white print:shadow-none`}
      >
        {isLoading ? (
          <ScheduleLoadingSkeleton isDark={isDark} />
        ) : (
          <>
            {/* AMBIENT BACKGROUND */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl opacity-10">
              <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-orange-600/20 mix-blend-screen blur-[120px]" />
            </div>

            {/* Agent proposal banner — shows when Emma has pending shift proposals */}
            <ProposalBanner />

            {/* VAKTGRID — single grid, columns grouped by department horizontally */}
            {scheduleLayout === "grid" && (
              <Suspense fallback={<div className="bg-muted/20 flex-1 animate-pulse" />}>
                <MalGrid
                  departmentName={activeDepartment}
                  weekStart={weekStart}
                  departmentOptions={departmentOptions}
                />
              </Suspense>
            )}

            {/* MAIN CONTENT AREA — sidebar spans full height alongside command bar, status strip, and grid */}
            {scheduleLayout !== "grid" && (
              <DndContext
                sensors={sensors}
                collisionDetection={scheduleCollisionDetection}
                autoScroll={false}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <div className="flex flex-1 overflow-hidden">
                  {/* Sidebar — full height from top of schedule container to bottom */}
                  <ScheduleSidebar
                    isDark={isDark}
                    isSidebarOpen={isSidebarOpen}
                    sidebarMode={sidebarMode}
                    setSidebarMode={setSidebarMode}
                    templates={templates}
                    openShifts={openShifts}
                  />

                  {/* Main content column — command bar, status strip, then grid */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <PlannerCommandBar
                      isDark={isDark}
                      filterSituation={filterSituation}
                      setFilterSituation={setFilterSituation}
                      weekSpan={weekSpan}
                      setWeekSpan={setWeekSpan}
                      scheduleLayout={scheduleLayout}
                      departmentOptions={departmentOptions}
                    />

                    <GridSurface
                      centerContent={
                        <>
                          {scheduleLayout === "daily" && (
                            <GridContentWithProposals
                              isSidebarOpen={isSidebarOpen}
                              setIsSidebarOpen={setIsSidebarOpen}
                              onDateClick={handleSetSelectedDate}
                              filterSituation={filterSituation}
                              activeStatusFilter={activeStatusFilter}
                              visibleDays={situationFilteredDays}
                              employees={departmentFilteredEmployees}
                              shifts={filteredShifts}
                              absences={filteredAbsences}
                              highlightedDayId={highlightedDayId}
                              weekStart={weekStart}
                              onTimeChange={handleGridShiftTimeChange}
                              conflictedShiftIds={conflictedShiftIds}
                              readinessMap={readinessMap}
                            />
                          )}
                          {scheduleLayout === "weekly" && (
                            <WeeklyGridContent
                              isSidebarOpen={isSidebarOpen}
                              setIsSidebarOpen={setIsSidebarOpen}
                              onDateClick={handleSetSelectedDate}
                              filterSituation={filterSituation}
                              computed={computed}
                              scheduleUI={scheduleUI}
                              employees={departmentFilteredEmployees}
                              shifts={filteredShifts}
                              days={days}
                              weekStart={weekStart}
                            />
                          )}
                          {scheduleLayout === "monthly" && (
                            <MonthlyView
                              onDateClick={handleSetSelectedDate}
                              shifts={filteredShifts}
                              computed={computed}
                              employees={departmentFilteredEmployees}
                            />
                          )}
                          {scheduleLayout === "list" && (
                            <ListGridContent
                              onDateClick={handleSetSelectedDate}
                              computed={computed}
                              days={days}
                              employees={departmentFilteredEmployees}
                              weekStart={weekStart}
                            />
                          )}
                        </>
                      }
                    />

                    <StatusStrip
                      statusSummary={statusSummary}
                      activeFilter={activeStatusFilter}
                      onFilterClick={setActiveStatusFilter}
                    />
                  </div>
                </div>

                <ScheduleDragOverlay isDark={isDark} />
              </DndContext>
            )}

            {/* Day control sheet — rendered at page level so it escapes GridSurface stacking context */}
            <DayControlSheet
              selectedDate={activeSelectedDate}
              onClose={() => handleSetSelectedDate(null)}
            >
              <DayControlPanel
                date={activeSelectedDate}
                onClose={() => handleSetSelectedDate(null)}
              />
            </DayControlSheet>

            {/* Global modals and overlays rendered at the page level */}
            <ShiftModal />
            <BatchActionBar />
            <AbsencePopover />
            <EmployeeDrawer
              open={!!scheduleUI.selectedEmployeeId}
              onOpenChange={(open) => {
                if (!open) scheduleUI.setSelectedEmployee(null);
              }}
              employee={
                employees.find((e: ScheduleEmployee) => e.id === scheduleUI.selectedEmployeeId) ??
                null
              }
            />
            <PublishOverviewDialog
              open={publishOverviewOpen}
              onOpenChange={setPublishOverviewOpen}
              shifts={shifts}
              employees={employees}
              onPublish={(ids) => publishShifts.mutate(ids)}
              isPublishing={publishShifts.isPending}
              onEditShift={(id) => {
                setPublishOverviewOpen(false);
                scheduleUI.setSelectedShift(id);
              }}
            />
            <SendMessageDialog
              open={sendMessageDialog.open}
              onOpenChange={(open) => setSendMessageDialog((prev) => ({ ...prev, open }))}
              workspaceId={workspace?.workspace_id ?? ""}
              dateId={sendMessageDialog.dateId}
              dateLabel={sendMessageDialog.dateLabel}
              initialMessage={sendMessageDialog.initialMessage}
              shifts={shifts}
              employees={employees}
              onSent={(content, audience, recipients) => {
                if (!sendMessageDialog.dateId) return;
                createDayMessage.mutate({
                  id: crypto.randomUUID(),
                  dateId: sendMessageDialog.dateId,
                  title: `Utsendt melding (${audience})`,
                  content,
                  audience,
                  visibility: "all_day",
                  author: "Schedule",
                  isAlert: false,
                });
                // eslint-disable-next-line no-console -- operational log
                console.info("[schedule] message sent", { recipients });
              }}
            />
          </>
        )}
      </div>
    </AgentProposalsProvider>
  );
}

/**
 * Shows a structure-matching skeleton while the schedule data bootstraps.
 * Why: gives instant visual feedback and avoids a blank waiting screen.
 */
function ScheduleLoadingSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex h-full flex-1 overflow-hidden">
      <aside
        className={`hidden w-64 shrink-0 border-r p-4 lg:flex lg:flex-col ${
          isDark ? "border-white/[0.06] bg-[#0a0a0c]/40" : "border-zinc-200 bg-white/70"
        }`}
      >
        <div
          className={`mb-4 h-8 animate-pulse rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
        />
        <div
          className={`mb-2 h-16 animate-pulse rounded-xl ${isDark ? "bg-zinc-900" : "bg-zinc-200"}`}
        />
        <div
          className={`mb-2 h-16 animate-pulse rounded-xl ${isDark ? "bg-zinc-900" : "bg-zinc-200"}`}
        />
        <div
          className={`h-16 animate-pulse rounded-xl ${isDark ? "bg-zinc-900" : "bg-zinc-200"}`}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className={`h-16 border-b p-3 ${isDark ? "border-white/[0.06]" : "border-zinc-200"}`}>
          <div
            className={`h-10 animate-pulse rounded-xl ${isDark ? "bg-zinc-900" : "bg-zinc-200"}`}
          />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col">
            <div
              className={`h-16 border-b p-2 ${isDark ? "border-white/[0.06]" : "border-zinc-200"}`}
            >
              <div className="grid h-full grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div
                    key={`schedule-header-skeleton-${index + 1}`}
                    className={`h-full animate-pulse rounded-lg ${isDark ? "bg-zinc-900" : "bg-zinc-200"}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-hidden p-2">
              <div className="space-y-2">
                {Array.from({ length: 7 }).map((_, rowIndex) => (
                  <div
                    key={`schedule-row-skeleton-${rowIndex + 1}`}
                    className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] gap-2"
                  >
                    <div
                      className={`h-14 animate-pulse rounded-lg ${isDark ? "bg-zinc-900" : "bg-zinc-200"}`}
                    />
                    {Array.from({ length: 7 }).map((__, colIndex) => (
                      <div
                        key={`schedule-cell-skeleton-${rowIndex + 1}-${colIndex + 1}`}
                        className={`h-14 animate-pulse rounded-lg ${isDark ? "bg-zinc-950" : "bg-zinc-100"}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OpenShiftDropZone — droppable area for converting shifts to open shifts
// ---------------------------------------------------------------------------
function OpenShiftDropZone({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  const { active } = useDndContext();
  const enableDroppable = active !== null;
  const { setNodeRef, isOver } = useDroppable({
    id: "open-shift-zone",
    disabled: !enableDroppable,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[60px] rounded-xl border-2 border-dashed p-2 transition-all ${
        isOver ? "border-amber-500/50 bg-amber-500/10" : `border-transparent ${isDark ? "" : ""}`
      }`}
    >
      {children}
      {isOver && (
        <p className="mt-2 text-center text-[10px] font-bold tracking-wider text-amber-400 uppercase">
          Slipp for å gjøre åpen
        </p>
      )}
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
  templates,
  openShifts,
}: {
  isDark: boolean;
  isSidebarOpen: boolean;
  sidebarMode: "open" | "templates";
  setSidebarMode: (m: "open" | "templates") => void;
  templates: ShiftTemplate[];
  openShifts: { id: string; title: string; time: string }[];
}) {
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
      className={`border-r border-white/[0.04] ${isDark ? "bg-[#0a0a0c]/40" : "bg-white/60"} hidden shrink-0 flex-col backdrop-blur-md transition-all duration-300 ease-in-out lg:flex ${isSidebarOpen ? "w-64 opacity-100 xl:w-72" : "w-0 overflow-hidden border-none opacity-0"} print:hidden`}
      style={{ zIndex: SCHEDULE_LAYERS.stickyHeaders }}
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
            <OpenShiftDropZone isDark={isDark}>
              <div className="space-y-3">
                {openShifts.map((shift) => (
                  <OpenShiftCard
                    key={shift.id}
                    id={shift.id}
                    title={shift.title}
                    time={shift.time}
                  />
                ))}
                {openShifts.length === 0 && (
                  <p className="text-center text-xs text-zinc-500">Ingen åpne vakter</p>
                )}
              </div>
            </OpenShiftDropZone>
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
  filterSituation: _filterSituation,
  computed,
  scheduleUI,
  employees,
  shifts,
  days,
  weekStart,
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick?: (d: string) => void;
  filterSituation: string;
  computed: ScheduleComputed;
  scheduleUI: ReturnType<typeof useScheduleUI>;
  employees: ScheduleEmployee[];
  shifts: Shift[];
  days: DayColumn[];
  weekStart: string;
}) {
  const { isDark, scheduleView, weeklyPeriodCount } = useContext(DashboardContext);
  const { active } = useDndContext();
  const enableDroppable = active !== null;

  /** Build week column metadata from real days data */
  const weekColumns = React.useMemo(() => {
    const ws = new Date(weekStart + "T00:00:00");
    return Array.from({ length: weeklyPeriodCount }, (_, i) => {
      const colStart = new Date(ws);
      colStart.setDate(ws.getDate() + i * 7);
      const colEnd = new Date(colStart);
      colEnd.setDate(colStart.getDate() + 6);
      const weekNum = getISOWeekNumber(colStart);
      const startDay = colStart.getDate();
      const endDay = colEnd.getDate();
      const startMonth = colStart.toLocaleDateString("nb-NO", { month: "short" });
      return {
        index: i,
        weekNum,
        label: `${startDay}-${endDay} ${startMonth}`,
        /** dateIds belonging to this column (for filtering shifts) */
        dateIds: new Set(
          days
            .filter((d) => {
              const dDate = new Date(d.id + "T00:00:00");
              return dDate >= colStart && dDate <= colEnd;
            })
            .map((d) => d.id),
        ),
        /** Whether any day in this column is today */
        isCurrentWeek: days.some(
          (d) =>
            d.isToday &&
            new Date(d.id + "T00:00:00") >= colStart &&
            new Date(d.id + "T00:00:00") <= colEnd,
        ),
      };
    });
  }, [weekStart, weeklyPeriodCount, days]);

  /** Index shifts by employee for quick lookup */
  const shiftsByEmployee = React.useMemo(() => {
    const index = new Map<string, Shift[]>();
    for (const shift of shifts) {
      if (!shift.employeeId) continue;
      const existing = index.get(shift.employeeId) ?? [];
      existing.push(shift);
      index.set(shift.employeeId, existing);
    }
    return index;
  }, [shifts]);

  const groupedEmployees = React.useMemo(() => {
    if (scheduleView === "team") {
      const map = new Map<string, ScheduleEmployee[]>();
      for (const emp of employees) {
        const key = emp.team || "Uten team";
        const list = map.get(key) ?? [];
        list.push(emp);
        map.set(key, list);
      }
      return Array.from(map.entries());
    }
    if (scheduleView === "jobb") {
      const map = new Map<string, ScheduleEmployee[]>();
      for (const emp of employees) {
        const key = emp.jobTitle || emp.role || "Ukjent";
        const list = map.get(key) ?? [];
        list.push(emp);
        map.set(key, list);
      }
      return Array.from(map.entries());
    }
    if (scheduleView === "lokasjon") {
      const map = new Map<string, ScheduleEmployee[]>();
      for (const emp of employees) {
        const key = emp.locationName || "Uten lokasjon";
        const list = map.get(key) ?? [];
        list.push(emp);
        map.set(key, list);
      }
      return Array.from(map.entries());
    }
    return [["Alle ansatte", employees] as [string, ScheduleEmployee[]]];
  }, [scheduleView, employees]);

  return (
    <div className="flex h-full w-full overflow-y-auto">
      {/* Employee sidebar */}
      <div
        className={`w-[200px] shrink-0 border-r border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]/60" : "bg-white/80"} sticky left-0 flex flex-col shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md`}
        style={{ zIndex: SCHEDULE_LAYERS.stickyHeaders }}
      >
        <div
          className={`sticky top-0 h-24 border-b xl:h-28 ${isDark ? "border-white/5 bg-[#0a0a0c]" : "border-zinc-200 bg-white"} relative flex flex-col justify-between p-4`}
          style={{ zIndex: SCHEDULE_LAYERS.stickyHeaders }}
        >
          <div className="flex w-full items-center justify-between">
            <div className="text-foreground/60 flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase xl:text-xs">
              <Network className="h-3.5 w-3.5 text-orange-500" />
              Rullerende
            </div>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-foreground/50 hover:text-foreground hover:bg-muted rounded-md p-1 transition-colors"
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
            <span className="text-foreground/50 text-xs font-bold tracking-widest uppercase">
              Visning:{" "}
              {scheduleView === "ansatt"
                ? "Ansatt"
                : scheduleView === "jobb"
                  ? "Rolle"
                  : scheduleView === "lokasjon"
                    ? "Lokasjon"
                    : "Team"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groupedEmployees.map(([groupName, groupEmps]) => (
            <TeamGroup key={groupName} title={groupName} count={groupEmps.length}>
              {groupEmps.map((emp) => {
                const stats = computed.getEmployeeStats(emp.id);
                return (
                  <EntityRow
                    key={emp.id}
                    name={emp.name}
                    subtitle={
                      scheduleView === "jobb"
                        ? emp.team
                        : scheduleView === "lokasjon"
                          ? emp.departmentName
                          : emp.jobTitle || emp.role
                    }
                    hours={stats.totalHours.toFixed(1)}
                    shifts={String(stats.shiftCount)}
                    avatarColor={emp.avatarColor}
                    initials={emp.initials}
                    onClick={() => scheduleUI.setSelectedEmployee(emp.id)}
                  />
                );
              })}
            </TeamGroup>
          ))}
        </div>
      </div>

      {/* Week columns with real shift data */}
      {weekColumns.map((week) => {
        const firstDateId = days.find((d) => week.dateIds.has(d.id))?.id;

        return (
          <div
            key={week.index}
            className={`min-w-0 flex-1 border-r ${isDark ? "border-white/5" : "border-zinc-200"} flex flex-col transition-colors hover:bg-white/[0.02] ${week.isCurrentWeek ? "bg-orange-500/[0.03]" : ""}`}
          >
            <div
              onClick={() => firstDateId && onDateClick?.(firstDateId)}
              className={`sticky top-0 h-24 border-b border-white/5 p-3 xl:h-28 xl:p-4 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/90"} relative flex cursor-pointer flex-col items-center justify-center backdrop-blur-xl hover:bg-white/5`}
              style={{ zIndex: SCHEDULE_LAYERS.stickyContent }}
            >
              {week.isCurrentWeek && (
                <div className="absolute top-2 right-2 rounded border border-orange-500/30 bg-orange-500/20 px-1.5 py-0.5 text-[11px] font-black text-orange-400 uppercase">
                  Aktiv
                </div>
              )}
              <h2
                className={`font-black tracking-tighter ${weeklyPeriodCount > 5 ? "text-lg xl:text-xl" : "text-xl xl:text-3xl"} ${week.isCurrentWeek ? "text-orange-400" : isDark ? "text-white" : "text-zinc-900"}`}
              >
                {week.weekNum}
              </h2>
              <span className="text-foreground/50 mt-1 text-[11px] font-bold tracking-widest uppercase xl:text-xs">
                Uke {week.weekNum} &bull; {week.label}
              </span>
            </div>

            {/* Shift summary cells per employee */}
            {groupedEmployees.flatMap(([, groupEmps]) =>
              groupEmps.map((emp) => {
                const empShifts = shiftsByEmployee.get(emp.id) ?? [];
                const weekShifts = empShifts.filter((s) => week.dateIds.has(s.dateId));
                const shiftCount = weekShifts.length;
                const totalHours = weekShifts.reduce((sum, s) => sum + s.workHours, 0);
                const dominantStatus =
                  weekShifts.length > 0
                    ? (weekShifts.sort((a, b) => {
                        const order = {
                          active: 0,
                          published: 1,
                          assigned: 2,
                          created: 3,
                          completed: 4,
                        };
                        return (
                          (order[a.status as keyof typeof order] ?? 5) -
                          (order[b.status as keyof typeof order] ?? 5)
                        );
                      })[0]?.status ?? "created")
                    : null;

                const empIndicator = emp.avatarColor.includes("orange")
                  ? "orange"
                  : emp.avatarColor.includes("purple")
                    ? "purple"
                    : emp.avatarColor.includes("blue")
                      ? "blue"
                      : "emerald";

                return (
                  <WeeklyGridCell key={emp.id} enableDroppable={enableDroppable}>
                    {shiftCount > 0 ? (
                      <div className="flex w-full flex-col gap-[2px]">
                        {weekShifts.map((shift, idx) =>
                          idx === 0 ? (
                            <ShiftCard
                              key={shift.id}
                              role={emp.jobTitle || emp.role}
                              time={shift.time}
                              status={
                                shift.status as "published" | "draft" | "active" | "completed"
                              }
                              indicator={empIndicator}
                            />
                          ) : (
                            <div
                              key={shift.id}
                              className="group/mini border-border/40 bg-muted/30 hover:bg-muted relative flex items-center rounded-md border px-1.5 py-[2px] text-[9px] tabular-nums transition-all"
                              title={`${shift.time} · ${emp.jobTitle || emp.role}`}
                            >
                              <span className="text-muted-foreground font-medium">
                                {shift.startTime}
                              </span>
                              <span className="text-muted-foreground/0 group-hover/mini:text-muted-foreground ml-1 transition-colors">
                                – {shift.endTime} · {shift.workHours.toFixed(1)}t
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <WeeklyEmptyCell
                        onClick={() =>
                          scheduleUI.setCreateShiftContext({
                            dateId: firstDateId ?? `week::${week.weekNum}`,
                          })
                        }
                      />
                    )}
                  </WeeklyGridCell>
                );
              }),
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Returns ISO week number for a date */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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
  onClick,
}: {
  name: string;
  subtitle?: string;
  hours: string;
  shifts: string;
  avatarColor: string;
  initials: string;
  contractedHours?: number;
  onClick?: () => void;
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
      onClick={onClick}
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

function WeeklyGridCell({
  children,
  id,
  enableDroppable,
}: {
  children?: React.ReactNode;
  id?: string;
  enableDroppable?: boolean;
}) {
  const defaultId = React.useId();
  const droppableId = id || defaultId;
  if (!enableDroppable) {
    return <WeeklyGridCellBase isOver={false}>{children}</WeeklyGridCellBase>;
  }

  return <WeeklyGridCellDroppable droppableId={droppableId}>{children}</WeeklyGridCellDroppable>;
}

function WeeklyGridCellDroppable({
  droppableId,
  children,
}: {
  droppableId: string;
  children?: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });
  return (
    <WeeklyGridCellBase containerRef={setNodeRef} isOver={isOver}>
      {children}
    </WeeklyGridCellBase>
  );
}

function WeeklyGridCellBase({
  children,
  isOver,
  containerRef,
}: {
  children?: React.ReactNode;
  isOver: boolean;
  containerRef?: (node: HTMLDivElement | null) => void;
}) {
  const { isDark } = useContext(DashboardContext);

  return (
    <div
      ref={containerRef}
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
// LIST VIEW (Printable Weekly)
// ═══════════════════════════════════════════════════════════════════════════
function ListGridContent({
  onDateClick,
  computed,
  days,
  employees,
  weekStart,
}: {
  onDateClick: (d: string) => void;
  computed: ScheduleComputed;
  days: DayColumn[];
  employees: ScheduleEmployee[];
  weekStart: string;
}) {
  const { isDark } = useContext(DashboardContext);
  const ctx = useWorkspaceOptional();
  const workspace = ctx?.workspace;
  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  /** Derive week number and year from weekStart */
  const weekLabel = useMemo(() => {
    const d = new Date(weekStart + "T00:00:00");
    const weekNum = getISOWeekNumber(d);
    const year = d.getFullYear();
    return `Uke ${weekNum}, ${year}`;
  }, [weekStart]);

  const workspaceName = workspace?.name ?? "Smartout";

  return (
    <div
      className={`mx-auto flex h-full w-full max-w-5xl flex-col p-4 md:p-8 xl:p-12 print:block print:h-auto print:bg-white print:p-0 print:text-black`}
    >
      <div className="mb-8 flex items-center justify-between print:hidden">
        <div>
          <h2 className={`text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
            {weekLabel}
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
        <h2 className="text-2xl font-black text-black">{workspaceName}</h2>
        <p className="text-sm font-bold text-gray-500">Vaktliste &bull; {weekLabel}</p>
      </div>

      <div className="space-y-8 print:space-y-4">
        {days.map((day) => {
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
                  onClick={() => onDateClick(day.id)}
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
                  if (!shift.employeeId) return null;
                  const emp = employeeById.get(shift.employeeId);
                  if (!emp) return null;
                  return (
                    <div
                      key={shift.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 ${isDark ? "border-white/5 bg-[#0a0a0c] hover:border-white/10" : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"} transition-colors print:border-gray-200 print:bg-white`}
                    >
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-800 print:border-black">
                        {emp.role === "manager" || emp.role === "admin" || emp.role === "owner" ? (
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
