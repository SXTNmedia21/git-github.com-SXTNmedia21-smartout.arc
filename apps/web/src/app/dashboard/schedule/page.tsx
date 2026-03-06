"use client";

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { useWorkspace } from "@/lib/workspace-context";
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
  useDroppable,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
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
import { AgentProposalsProvider } from "./_components/agent-proposals-context";
import { ScheduleVoiceToolsBridge } from "./_components/schedule-voice-tools-bridge";
import {
  useShifts,
  useCreateShift,
  useUpdateShift,
  useMoveShift,
  useDeleteShift,
  usePublishShifts,
  useUnpublishShifts,
} from "./_hooks/use-shifts";
import { useAbsences, useCreateAbsence, useDeleteAbsence } from "./_hooks/use-absences";
import {
  useTemplates,
  useSaveTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useLoadTemplate,
} from "./_hooks/use-templates";
import {
  useOpenShifts,
  useCreateOpenShift,
  useDeleteOpenShift,
  useAssignOpenShift,
} from "./_hooks/use-open-shifts";
import {
  useDayMessages,
  useCreateDayMessage,
  useDeleteDayMessage,
  useDayTasks,
  useCreateDayTask,
  useUpdateDayTaskStatus,
  useDeleteDayTask,
  useDayBookings,
  useCreateDayBooking,
} from "./_hooks/use-day-content";
import { useScheduleRealtime } from "./_hooks/use-schedule-realtime";
import { useScheduleComputed } from "./_hooks/use-schedule-computed";
import { useDayInfo } from "./_hooks/use-day-info";

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
// SchedulePageContent — query hooks + rendering
// ---------------------------------------------------------------------------
function SchedulePageContent() {
  const {
    isDark,
    scheduleLayout,
    setScheduleLayout,
    scheduleDateOffset,
    setOnPublishAll,
    setScheduleDraftCount,
    scheduleCompactMode,
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
  }>({ open: false, dateId: "", dateLabel: "" });
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
      }
    },
    [scheduleLayout, setScheduleLayout],
  );

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
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
  const { workspace } = useWorkspace();

  const shouldLoadSidebarData = loadSecondaryData || isSidebarOpen || sidebarMode === "templates";
  const shouldLoadDayContent = loadSecondaryData || selectedDate !== null || sendMessageDialog.open;

  // ── TanStack Query hooks ────────────────────────────────────
  const employeesQuery = useEmployees();
  const employees = employeesQuery.data ?? [];
  const shiftsQuery = useShifts(weekStart, weekEnd);
  const absencesQuery = useAbsences(weekStart, weekEnd);
  const templatesQuery = useTemplates({ enabled: shouldLoadSidebarData });
  const openShiftsQuery = useOpenShifts({ enabled: shouldLoadSidebarData });
  const dayMessagesQuery = useDayMessages(weekStart, weekEnd, { enabled: shouldLoadDayContent });
  const dayTasksQuery = useDayTasks(weekStart, weekEnd, { enabled: shouldLoadDayContent });
  const dayBookingsQuery = useDayBookings(weekStart, weekEnd, { enabled: shouldLoadDayContent });
  const { dayInfoByDate } = useDayInfo(weekStart, weekEnd, { enabled: shouldLoadDayContent });

  // ── Enrich day columns with day info + real shift/staff/message/task counts ─
  const enrichedDays = useMemo(() => {
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
  }, [days, dayInfoByDate, shiftsQuery.data, dayMessagesQuery.data, dayTasksQuery.data]);

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
  const unpublishShifts = useUnpublishShifts(weekStart);
  const createAbsence = useCreateAbsence(weekStart);
  const deleteAbsence = useDeleteAbsence(weekStart);
  const saveTemplate = useSaveTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const loadTemplate = useLoadTemplate(weekStart);
  const createOpenShift = useCreateOpenShift();
  const deleteOpenShift = useDeleteOpenShift();
  const assignOpenShift = useAssignOpenShift(weekStart);
  const createDayMessage = useCreateDayMessage(weekStart);
  const deleteDayMessage = useDeleteDayMessage(weekStart);
  const createDayTask = useCreateDayTask(weekStart);
  const updateDayTaskStatus = useUpdateDayTaskStatus(weekStart);
  const deleteDayTask = useDeleteDayTask(weekStart);
  const createDayBooking = useCreateDayBooking(weekStart);

  // ── UI-only context ─────────────────────────────────────────
  const scheduleUI = useScheduleUI();

  // Bridge: "Se dagsliste" sets selectedDayId in UI context → open DayControlSheet
  useEffect(() => {
    if (scheduleUI.selectedDayId) {
      setSelectedDate(scheduleUI.selectedDayId);
      scheduleUI.setSelectedDay(null);
    }
  }, [scheduleUI.selectedDayId, scheduleUI.setSelectedDay]);

  // ── Derived values ──────────────────────────────────────────
  const shifts = useMemo(() => shiftsQuery.data ?? [], [shiftsQuery.data]);
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

  // ── Location-based employee filtering ─────────────────────
  const { activeLocation } = useContext(DashboardContext);

  const locationFilteredEmployees = useMemo(() => {
    if (!activeLocation || activeLocation === "Alle Lokasjoner") return sortedEmployees;
    const loc = activeLocation.toLowerCase();
    return sortedEmployees.filter((emp) => {
      const dept = (emp.jobTitle || "").toLowerCase();
      const team = (emp.team || "").toLowerCase();
      const role = (emp.role || "").toLowerCase();
      // Match location to employee attributes
      return (
        dept.includes(loc) ||
        team.includes(loc) ||
        role.includes(loc) ||
        loc.includes(dept) ||
        loc.includes(team)
      );
    });
  }, [sortedEmployees, activeLocation]);

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
          }
        } else {
          // Normal drag → move shift
          moveShift.mutate({ id: shiftId, employeeId: toEmployeeId, dateId: toDateId });
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

  return (
    <AgentProposalsProvider
      createShift={(input) =>
        createShift.mutateAsync(input as Parameters<typeof createShift.mutateAsync>[0])
      }
      updateShift={(input) => updateShift.mutateAsync(input)}
    >
      <ScheduleVoiceToolsBridge
        weekStart={weekStart}
        weekEnd={weekEnd}
        enrichedDays={enrichedDays}
        shifts={shiftsQuery.data ?? []}
        absences={absencesQuery.data ?? []}
        employees={employees}
        computed={computed}
        focusDayInUI={focusDayInUI}
        setSelectedDate={setSelectedDate}
        createShift={createShift}
        updateShift={updateShift}
        deleteShift={deleteShift}
        publishShifts={publishShifts}
      />
      <div
        className={`flex flex-1 flex-col ${isDark ? "bg-[#050505]" : "bg-zinc-50"} relative isolate h-full overflow-hidden rounded-2xl border border-white/[0.04] font-sans text-zinc-100 shadow-2xl print:block print:h-auto print:overflow-visible print:border-none print:bg-white print:shadow-none`}
      >
        {isLoading ? (
          <div className="flex h-full flex-1 items-center justify-center">
            <p className="text-sm text-zinc-500">Laster vaktplan...</p>
          </div>
        ) : (
          <>
            {/* AMBIENT BACKGROUND */}
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl opacity-10">
              <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-orange-600/20 mix-blend-screen blur-[120px]" />
            </div>

            {/* MAIN CONTENT AREA — sidebar spans full height alongside command bar, status strip, and grid */}
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
                            activeStatusFilter={activeStatusFilter}
                            visibleDays={situationFilteredDays}
                            employees={locationFilteredEmployees}
                            highlightedDayId={highlightedDayId}
                          />
                        )}
                        {scheduleLayout === "weekly" && (
                          <WeeklyGridContent
                            isSidebarOpen={isSidebarOpen}
                            setIsSidebarOpen={setIsSidebarOpen}
                            onDateClick={setSelectedDate}
                            filterSituation={filterSituation}
                            shifts={shifts}
                            computed={computed}
                            scheduleUI={scheduleUI}
                            employees={employees}
                          />
                        )}
                        {scheduleLayout === "monthly" && (
                          <MonthlyView
                            onDateClick={setSelectedDate}
                            shifts={shifts}
                            computed={computed}
                            employees={employees}
                          />
                        )}
                        {scheduleLayout === "list" && (
                          <ListGridContent
                            onDateClick={setSelectedDate}
                            shifts={shifts}
                            computed={computed}
                            days={days}
                            employees={employees}
                          />
                        )}
                      </>
                    }
                    dayInspector={
                      <DayControlSheet
                        selectedDate={selectedDate}
                        onClose={() => setSelectedDate(null)}
                      >
                        <DayControlPanel
                          date={selectedDate}
                          onClose={() => setSelectedDate(null)}
                        />
                      </DayControlSheet>
                    }
                  />

                  <StatusStrip
                    isDark={isDark}
                    statusSummary={statusSummary}
                    activeFilter={activeStatusFilter}
                    onFilterClick={setActiveStatusFilter}
                  />
                </div>
              </div>

              <ScheduleDragOverlay isDark={isDark} />
            </DndContext>

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
            />
            <SendMessageDialog
              open={sendMessageDialog.open}
              onOpenChange={(open) => setSendMessageDialog((prev) => ({ ...prev, open }))}
              dateId={sendMessageDialog.dateId}
              dateLabel={sendMessageDialog.dateLabel}
              shifts={shifts}
              employees={employees}
            />
          </>
        )}
      </div>
    </AgentProposalsProvider>
  );
}

// ---------------------------------------------------------------------------
// OpenShiftDropZone — droppable area for converting shifts to open shifts
// ---------------------------------------------------------------------------
function OpenShiftDropZone({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "open-shift-zone" });

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
  filterSituation,
  shifts,
  computed,
  scheduleUI,
  employees,
}: {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  onDateClick?: (d: string) => void;
  filterSituation: string;
  shifts: import("./_components/schedule-types").Shift[];
  computed: import("./_hooks/use-schedule-computed").ScheduleComputed;
  scheduleUI: ReturnType<typeof useScheduleUI>;
  employees: ScheduleEmployee[];
}) {
  const { isDark, scheduleView, weeklyPeriodCount } = useContext(DashboardContext);
  const columns = Array.from({ length: weeklyPeriodCount }, (_, i) => i + 1);

  /**
   * Groups employees dynamically based on the current scheduleView.
   * - "team": grouped by team name
   * - "jobb": grouped by job title / role
   * - "ansatt": flat list with no grouping headers
   */
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
    // "ansatt" — flat list, single group
    return [["Alle ansatte", employees] as [string, ScheduleEmployee[]]];
  }, [scheduleView, employees]);

  return (
    <div className="flex h-full w-full overflow-y-auto">
      <div
        className={`w-[200px] shrink-0 border-r border-white/5 xl:w-[250px] ${isDark ? "bg-[#0a0a0c]/60" : "bg-white/80"} sticky left-0 flex flex-col shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md`}
        style={{ zIndex: SCHEDULE_LAYERS.stickyHeaders }}
      >
        <div
          className={`sticky top-0 h-24 border-b xl:h-28 ${isDark ? "border-white/5 bg-[#0a0a0c]" : "border-zinc-200 bg-white"} relative flex flex-col justify-between p-4`}
          style={{ zIndex: SCHEDULE_LAYERS.stickyHeaders }}
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
          {groupedEmployees.map(([groupName, groupEmps]) => (
            <TeamGroup key={groupName} title={groupName} count={groupEmps.length}>
              {groupEmps.map((emp) => {
                const stats = computed.getEmployeeStats(emp.id);
                return (
                  <EntityRow
                    key={emp.id}
                    name={emp.name}
                    subtitle={scheduleView === "jobb" ? emp.team : emp.jobTitle || emp.role}
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
              className={`sticky top-0 h-24 border-b border-white/5 p-3 xl:h-28 xl:p-4 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/90"} relative flex cursor-pointer flex-col items-center justify-center backdrop-blur-xl hover:bg-white/5`}
              style={{ zIndex: SCHEDULE_LAYERS.stickyContent }}
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
                  onClick={() => scheduleUI.setCreateShiftContext({ dateId: `week::${col}` })}
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
// LIST VIEW (Printable Weekly)
// ═══════════════════════════════════════════════════════════════════════════
function ListGridContent({
  onDateClick,
  shifts,
  computed,
  days,
  employees,
}: {
  onDateClick: (d: string) => void;
  shifts: import("./_components/schedule-types").Shift[];
  computed: import("./_hooks/use-schedule-computed").ScheduleComputed;
  days: DayColumn[];
  employees: ScheduleEmployee[];
}) {
  const { isDark } = useContext(DashboardContext);
  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

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
