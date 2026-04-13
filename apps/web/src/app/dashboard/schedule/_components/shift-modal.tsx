// ============================================
// shift-modal.tsx
// Operational modal for shift creation/editing.
// Redesigned for simplicity and speed.
// ============================================
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Mail,
  MessageSquare,
  Smartphone,
  Trash2,
  MoreHorizontal,
  Send,
  ListChecks,
  Settings,
  User,
  ChevronDown,
  History,
  ThumbsUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { useScheduleUI } from "./schedule-ui-context";
import { useShifts, useCreateShift, useUpdateShift, useDeleteShift } from "../_hooks/use-shifts";
import { useWeekRange } from "../_hooks/use-week-range";
import { useEmployees, type ScheduleEmployee } from "../_hooks/use-employees";
import { useShiftRuleCheck } from "../_hooks/use-shift-rule-check";
import { useShiftTypeConfigs } from "../_hooks/use-shift-type-configs";
import { useAuditLog, type AuditLogEntry } from "../_hooks/use-audit-log";
import { AVAILABLE_ZONES } from "./schedule-data";
import type { DayCategory, ShiftStatus, Shift } from "./schedule-types";

// ── Constants ───────────────────────────────────────────────

const DAY_CATEGORY_OPTIONS: { value: DayCategory; label: string }[] = [
  { value: "morning", label: "Morgen" },
  { value: "midday", label: "Midt på dagen" },
  { value: "afternoon", label: "Ettermiddag" },
  { value: "evening", label: "Kveld" },
  { value: "night", label: "Natt" },
  { value: "weekend", label: "Helg" },
];

const SHIFT_PRESETS: {
  label: string;
  startTime: string;
  endTime: string;
  dayCategory: DayCategory;
}[] = [
  { label: "Morgenvakt", startTime: "06:00", endTime: "14:00", dayCategory: "morning" },
  { label: "Dagvakt", startTime: "08:00", endTime: "16:00", dayCategory: "morning" },
  { label: "Kveldsvakt", startTime: "15:00", endTime: "23:00", dayCategory: "evening" },
  { label: "Nattvakt", startTime: "22:00", endTime: "06:00", dayCategory: "night" },
  { label: "Delt vakt", startTime: "10:00", endTime: "14:00", dayCategory: "midday" },
];

const NOTIFICATION_CHANNELS = [
  { id: "push", label: "Push", icon: Smartphone },
  { id: "email", label: "E-post", icon: Mail },
  { id: "sms", label: "SMS", icon: MessageSquare },
] as const;

const TIME_OPTIONS = Array.from({ length: 24 * 4 }).map((_, i) => {
  const h = Math.floor(i / 4)
    .toString()
    .padStart(2, "0");
  const m = ((i % 4) * 15).toString().padStart(2, "0");
  return `${h}:${m}`;
});

// ── Helpers ─────────────────────────────────────────────────

function adjustTime(current: string, minutesDelta: number): string {
  if (!current) return current;
  const [h, m] = current.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutesDelta;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const newH = Math.floor(wrapped / 60);
  const newM = wrapped % 60;
  return `${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`;
}

function inferDayCategory(startTime: string): DayCategory {
  const hour = parseInt(startTime.split(":")[0] ?? "0", 10);
  if (hour < 6) return "night";
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

function calculateWorkHours(startTime: string, endTime: string, breakMinutes: number): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const startTotal = (startH ?? 0) * 60 + (startM ?? 0);
  let endTotal = (endH ?? 0) * 60 + (endM ?? 0);

  if (endTotal <= startTotal) {
    endTotal += 24 * 60;
  }

  const totalMinutes = endTotal - startTotal - breakMinutes;
  return Math.max(0, totalMinutes / 60);
}

function getStatusBadgeVariant(
  status: ShiftStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "published":
    case "active":
      return "default";
    case "completed":
      return "secondary";
    case "unpublished":
      return "destructive";
    case "created":
    case "assigned":
    default:
      return "outline";
  }
}

function getStatusLabel(status: ShiftStatus): string {
  switch (status) {
    case "created":
      return "Opprettet";
    case "assigned":
      return "Tildelt";
    case "published":
      return "Publisert";
    case "active":
      return "Aktiv";
    case "completed":
      return "Fullført";
    case "unpublished":
      return "Avpublisert";
    default:
      return status;
  }
}

// ── Status Timeline ─────────────────────────────────────────

const STATUS_STEPS = [
  { key: "created", label: "Opprettet" },
  { key: "assigned", label: "Tildelt" },
  { key: "published", label: "Publisert" },
  { key: "confirmed", label: "Bekreftet" },
  { key: "active", label: "Aktiv" },
  { key: "completed", label: "Fullført" },
] as const;

/** Ordinal index for each status in the lifecycle */
const STATUS_ORDER: Record<string, number> = {
  created: 0,
  assigned: 1,
  published: 2,
  confirmed: 3,
  active: 4,
  completed: 5,
};

function ShiftStatusTimeline({
  shift,
  auditEntries,
}: {
  shift: Shift;
  auditEntries: AuditLogEntry[];
}) {
  const currentIndex = STATUS_ORDER[shift.status] ?? 0;
  const isConfirmed = Boolean(shift.confirmedAt);

  /** Try to find the timestamp when a status was reached via audit log */
  function getStepDate(stepKey: string): string | undefined {
    if (stepKey === "created") return shift.createdAt;
    if (stepKey === "confirmed") return shift.confirmedAt;

    // Find earliest audit entry where status changed to this value
    const entry = [...auditEntries]
      .reverse()
      .find(
        (e) =>
          e.operation === "UPDATE" &&
          e.changedFields?.includes("status") &&
          (e.newData as Record<string, unknown> | null)?.status === stepKey,
      );
    return entry?.createdAt;
  }

  function formatStepDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex w-full items-start justify-between gap-1 px-4 py-2">
      {STATUS_STEPS.map((step, i) => {
        const stepIndex = STATUS_ORDER[step.key] ?? i;
        const isPast = step.key === "confirmed" ? isConfirmed : stepIndex <= currentIndex;
        const isCurrent =
          step.key === "confirmed"
            ? isConfirmed && shift.status === "published"
            : stepIndex === currentIndex;
        const dateStr = isPast ? getStepDate(step.key) : undefined;

        return (
          <div key={step.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex items-center gap-0.5">
              {i > 0 && (
                <div
                  className={`h-px w-6 transition-colors sm:w-8 ${isPast ? "bg-emerald-500/30" : "border-border/40 border-t border-dashed"}`}
                />
              )}
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-all ${
                  isCurrent
                    ? "scale-110 border-emerald-400 bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                    : isPast
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                      : "bg-muted/50 border-border/60 text-muted-foreground/50"
                }`}
              >
                {isPast ? (
                  step.key === "confirmed" ? (
                    <ThumbsUp className="h-3 w-3" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )
                ) : (
                  <span className="text-[10px] font-bold">{i + 1}</span>
                )}
              </div>
            </div>
            <span
              className={`mt-1 text-center text-[9px] leading-tight tracking-wide uppercase ${
                isCurrent ? "text-foreground font-black" : "text-muted-foreground/50 font-bold"
              }`}
            >
              {step.label}
            </span>
            {dateStr && (
              <span className="text-muted-foreground/70 text-[8px] leading-none font-semibold">
                {formatStepDate(dateStr)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── History Timeline ────────────────────────────────────────

function describeAuditEntry(entry: AuditLogEntry, employees: ScheduleEmployee[]): string {
  const newData = entry.newData as Record<string, unknown> | null;
  const oldData = entry.oldData as Record<string, unknown> | null;
  const fields = entry.changedFields ?? [];

  if (entry.operation === "INSERT") return "Opprettet";
  if (entry.operation === "DELETE") return "Slettet";

  // Status change is most significant
  if (fields.includes("status") && newData?.status) {
    return getStatusLabel(newData.status as ShiftStatus);
  }

  // Employee assignment
  if (fields.includes("employee_id")) {
    if (newData?.employee_id) {
      const emp = employees.find((e) => e.id === newData.employee_id);
      return `Tildelt til ${emp?.name ?? "ukjent"}`;
    }
    return "Fjernet tildeling";
  }

  // Confirmation
  if (fields.includes("confirmed_at") && newData?.confirmed_at) {
    const emp = newData.confirmed_by ? employees.find((e) => e.id === newData.confirmed_by) : null;
    return `Bekreftet${emp ? ` av ${emp.name}` : ""}`;
  }

  // Time change
  if (fields.includes("start_time") || fields.includes("end_time")) {
    const oldStart = (oldData?.start_time as string)?.slice(0, 5) ?? "?";
    const oldEnd = (oldData?.end_time as string)?.slice(0, 5) ?? "?";
    const newStart = (newData?.start_time as string)?.slice(0, 5) ?? "?";
    const newEnd = (newData?.end_time as string)?.slice(0, 5) ?? "?";
    return `Tid endret: ${oldStart}-${oldEnd} \u2192 ${newStart}-${newEnd}`;
  }

  // Role change
  if (fields.includes("role")) {
    return `Rolle endret: ${oldData?.role ?? "?"} \u2192 ${newData?.role ?? "?"}`;
  }

  // Notes
  if (fields.includes("notes")) return "Notat oppdatert";

  // Fallback: list changed fields
  return `Oppdatert: ${fields.join(", ")}`;
}

function ShiftHistoryTimeline({
  entries,
  employees,
}: {
  entries: AuditLogEntry[];
  employees: ScheduleEmployee[];
}) {
  if (entries.length === 0) {
    return (
      <div className="bg-card/20 border-border/40 text-muted-foreground relative flex flex-col items-center justify-center overflow-hidden rounded-[20px] border border-dashed py-16 text-center backdrop-blur-sm">
        <div className="bg-muted/30 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm">
          <History className="text-muted-foreground/50 h-8 w-8" />
        </div>
        <h4 className="text-foreground text-sm font-bold tracking-tight">
          Ingen historikk tilgjengelig
        </h4>
        <p className="mt-2 max-w-[250px] text-xs leading-relaxed">
          Denne vakten ble opprettet før utvidet logging var aktivert i systemet.
        </p>
      </div>
    );
  }

  let lastDateStr = "";

  return (
    <div className="space-y-0">
      {entries.map((entry) => {
        const date = new Date(entry.createdAt);
        const dateStr = date.toLocaleDateString("nb-NO", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const timeStr = date.toLocaleTimeString("nb-NO", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const showDate = dateStr !== lastDateStr;
        lastDateStr = dateStr;

        const actor = entry.userId ? employees.find((e) => e.id === entry.userId) : null;

        return (
          <div key={entry.id} className="relative flex gap-3 pb-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="border-border/60 bg-muted/50 mt-1 h-2.5 w-2.5 rounded-full border shadow-sm" />
              <div className="bg-border/30 my-0.5 w-px flex-1" />
            </div>

            <div className="min-w-0 flex-1 pb-2">
              <div className="flex items-baseline gap-2">
                <span className="text-foreground text-xs font-bold tracking-tight">
                  {describeAuditEntry(entry, employees)}
                </span>
              </div>
              <div className="text-muted-foreground/80 mt-1 flex items-center gap-2 text-[10px] font-semibold">
                <span>{timeStr}</span>
                {showDate && (
                  <>
                    <span>&middot;</span>
                    <span>{dateStr}</span>
                  </>
                )}
                {actor && (
                  <>
                    <span>&middot;</span>
                    <span>{actor.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Form State ──────────────────────────────────────────────

type ShiftFormState = {
  employeeId: string;
  role: string;
  shiftTypeId: string;
  team: string;
  startTime: string;
  endTime: string;
  dayCategory: DayCategory;
  zone: string;
  isPublished: boolean;
  notificationChannels: Set<string>;
  breaks: number;
  specialConditions: string;
};

// ── Component ───────────────────────────────────────────────

export function ShiftModal() {
  const { selectedShiftId, createShiftContext, setSelectedShift, setCreateShiftContext } =
    useScheduleUI();
  const { weekStart, weekEnd } = useWeekRange();
  const shiftsQuery = useShifts(weekStart, weekEnd);
  const shifts = useMemo(() => (shiftsQuery.data ?? []) as Shift[], [shiftsQuery.data]);
  const employeesQuery = useEmployees();
  const employees = useMemo<ScheduleEmployee[]>(
    () => employeesQuery.data ?? [],
    [employeesQuery.data],
  );
  const createShiftMutation = useCreateShift(weekStart);
  const updateShiftMutation = useUpdateShift(weekStart);
  const deleteShiftMutation = useDeleteShift(weekStart);

  const auditLogQuery = useAuditLog("schedule_shift", selectedShiftId ?? "");
  const auditEntries = useMemo(
    () => (auditLogQuery.data ?? []) as AuditLogEntry[],
    [auditLogQuery.data],
  );

  const shiftTypeConfigsQuery = useShiftTypeConfigs();
  const shiftTypeConfigs = useMemo(
    () => shiftTypeConfigsQuery.data ?? [],
    [shiftTypeConfigsQuery.data],
  );

  const availableTeams = useMemo(
    () => [...new Set(employees.map((e) => e.team).filter((v): v is string => !!v))],
    [employees],
  );

  const isOpen = selectedShiftId !== null || createShiftContext !== null;
  const isEditMode = selectedShiftId !== null;
  const existingShift = isEditMode ? shifts.find((s: Shift) => s.id === selectedShiftId) : null;

  const [form, setForm] = useState<ShiftFormState>({
    employeeId: "",
    role: "",
    shiftTypeId: "",
    team: "",
    startTime: "08:00",
    endTime: "16:00",
    dayCategory: "morning",
    zone: "",
    isPublished: false,
    notificationChannels: new Set(["push"]),
    breaks: 30,
    specialConditions: "",
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (existingShift) {
      const emp = employees.find((e) => e.id === existingShift.employeeId);
      setForm({
        employeeId: existingShift.employeeId ?? "",
        role: existingShift.role,
        shiftTypeId: existingShift.shiftTypeId ?? "",
        team: emp?.team ?? "",
        startTime: existingShift.startTime,
        endTime: existingShift.endTime,
        dayCategory: existingShift.dayCategory,
        zone: existingShift.zone ?? "",
        isPublished: existingShift.isPublished,
        notificationChannels: new Set(["push"]),
        breaks: existingShift.breaks ?? 30,
        specialConditions: existingShift.notes ?? "",
      });
    } else if (createShiftContext) {
      const employee = createShiftContext.employeeId
        ? employees.find((e) => e.id === createShiftContext?.employeeId)
        : null;

      setForm({
        employeeId: createShiftContext.employeeId ?? "",
        role: (employee?.jobTitle || employee?.role) ?? "",
        shiftTypeId: "",
        team: employee?.team ?? "",
        startTime: "08:00",
        endTime: "16:00",
        dayCategory: "morning",
        zone: "",
        isPublished: false,
        notificationChannels: new Set(["push"]),
        breaks: 30,
        specialConditions: "",
      });
    }
  }, [existingShift, createShiftContext, employees]);

  const workHours = useMemo(
    () => calculateWorkHours(form.startTime, form.endTime, form.breaks),
    [form.startTime, form.endTime, form.breaks],
  );

  const dateId = isEditMode ? existingShift?.dateId : createShiftContext?.dateId;

  const employeeShiftsForWeek = useMemo(
    () =>
      shifts
        .filter((s: Shift) => s.employeeId === form.employeeId && s.id !== selectedShiftId)
        .map((s: Shift) => ({ startTime: s.startTime, endTime: s.endTime, date: s.dateId })),
    [shifts, form.employeeId, selectedShiftId],
  );

  const ruleCheck = useShiftRuleCheck(
    {
      employeeId: form.employeeId || undefined,
      date: dateId ?? "",
      startTime: form.startTime,
      endTime: form.endTime,
    },
    employeeShiftsForWeek,
  );

  const handleClose = useCallback(() => {
    setSelectedShift(null);
    setCreateShiftContext(null);
  }, [setSelectedShift, setCreateShiftContext]);

  const updateField = useCallback(
    <K extends keyof ShiftFormState>(field: K, value: ShiftFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleEmployeeChange = useCallback(
    (employeeId: string) => {
      const targetId = employeeId === "none" ? "" : employeeId;
      const employee = employees.find((e) => e.id === targetId);
      setForm((prev) => ({
        ...prev,
        employeeId: targetId,
        // Only override role from employee if no shift type is selected
        role: prev.shiftTypeId ? prev.role : ((employee?.jobTitle || employee?.role) ?? prev.role),
        team: employee?.team ?? prev.team,
      }));
    },
    [employees],
  );

  const handleStartTimeChange = useCallback((startTime: string) => {
    setForm((prev) => ({
      ...prev,
      startTime,
      dayCategory: inferDayCategory(startTime),
    }));
  }, []);

  const toggleChannel = useCallback((channelId: string) => {
    setForm((prev) => {
      const next = new Set(prev.notificationChannels);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return { ...prev, notificationChannels: next };
    });
  }, []);

  const handleSave = useCallback(
    (forcePublish: boolean = false) => {
      const hours = calculateWorkHours(form.startTime, form.endTime, form.breaks);
      const isPublishedFinal = form.isPublished || forcePublish;
      const status: ShiftStatus =
        form.employeeId && isPublishedFinal
          ? "published"
          : form.employeeId
            ? "assigned"
            : "created";

      if (isEditMode && existingShift) {
        updateShiftMutation.mutate({
          id: existingShift.id,
          patch: {
            employeeId: form.employeeId || null,
            role: form.role,
            shiftTypeId: form.shiftTypeId || undefined,
            startTime: form.startTime,
            endTime: form.endTime,
            workHours: hours,
            dayCategory: form.dayCategory,
            zone: form.zone || undefined,
            status,
            isPublished: isPublishedFinal,
            breaks: form.breaks,
            notes: form.specialConditions || undefined,
          },
        });
      } else if (dateId) {
        const selectedConfig = shiftTypeConfigs.find((c) => c.shiftTypeId === form.shiftTypeId);
        createShiftMutation.mutate({
          id: crypto.randomUUID(),
          employeeId: form.employeeId || null,
          dateId,
          role: form.role,
          shiftTypeId: form.shiftTypeId || undefined,
          departmentId: selectedConfig?.departmentId ?? undefined,
          startTime: form.startTime,
          endTime: form.endTime,
          workHours: hours,
          status,
          dayCategory: form.dayCategory,
          zone: form.zone || undefined,
          indicator: "blue",
          isPublished: isPublishedFinal,
          breaks: form.breaks,
          notes: form.specialConditions || undefined,
        });
      }
      handleClose();
    },
    [
      form,
      isEditMode,
      existingShift,
      dateId,
      shiftTypeConfigs,
      createShiftMutation,
      updateShiftMutation,
      handleClose,
    ],
  );

  const handleDelete = useCallback(() => {
    if (!existingShift) return;
    const confirmed = window.confirm("Er du sikker på at du vil slette dette skiftet?");
    if (confirmed) {
      deleteShiftMutation.mutate(existingShift.id);
      handleClose();
    }
  }, [existingShift, deleteShiftMutation, handleClose]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="border-border/60 flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 shadow-2xl sm:rounded-[24px]">
        {/* Sticky Header */}
        <div className="border-border/40 bg-background/80 relative shrink-0 overflow-hidden border-b px-6 pt-6 pb-5 backdrop-blur-xl">
          {/* Ambient Glow */}
          {isEditMode && existingShift && (
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              <div
                className={`absolute -top-12 -left-12 h-40 w-40 rounded-full opacity-20 blur-[50px] ${
                  existingShift.status === "published"
                    ? "bg-emerald-500"
                    : existingShift.status === "active"
                      ? "bg-blue-500"
                      : existingShift.status === "completed"
                        ? "bg-zinc-500"
                        : "bg-orange-500"
                }`}
              />
            </div>
          )}
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border shadow-sm backdrop-blur-md ${
                  isEditMode && existingShift
                    ? existingShift.status === "published"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                      : existingShift.status === "active"
                        ? "border-blue-500/20 bg-blue-500/10 text-blue-500"
                        : existingShift.status === "completed"
                          ? "border-zinc-500/20 bg-zinc-500/10 text-zinc-500"
                          : "border-orange-500/20 bg-orange-500/10 text-orange-500"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                }`}
              >
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight">
                  {isEditMode ? "Rediger skift" : "Nytt skift"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs font-medium">
                  {isEditMode && existingShift ? (
                    <span className="flex items-center gap-2">
                      {dateId}
                      <span className="text-muted-foreground/30">•</span>
                      <span
                        className={`flex items-center gap-1.5 ${
                          existingShift.status === "published"
                            ? "text-emerald-500"
                            : existingShift.status === "active"
                              ? "text-blue-500"
                              : existingShift.status === "completed"
                                ? "text-zinc-500"
                                : existingShift.status === "assigned"
                                  ? "text-orange-500"
                                  : existingShift.status === "unpublished"
                                    ? "text-red-500"
                                    : "text-muted-foreground"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {getStatusLabel(existingShift.status)}
                      </span>
                    </span>
                  ) : dateId ? (
                    `Opprett skift for ${dateId}`
                  ) : (
                    "Opprett et nytt skift"
                  )}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {isEditMode && existingShift && (
                  <Badge variant={getStatusBadgeVariant(existingShift.status)} className="hidden">
                    {getStatusLabel(existingShift.status)}
                  </Badge>
                )}
                {isEditMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:border-border/40 hover:bg-muted/50 h-9 w-9 rounded-xl border border-transparent transition-all"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="border-border/60 w-48 rounded-xl shadow-xl"
                    >
                      <DropdownMenuItem
                        onClick={() => {}}
                        className="rounded-lg text-xs font-semibold"
                      >
                        <Send className="mr-2 h-3.5 w-3.5" />
                        Send melding
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border/40" />
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className="rounded-lg text-xs font-bold text-red-600 focus:bg-red-500/10 focus:text-red-700"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Slett vakt
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content with Tabs */}
        <Tabs defaultValue="vakt" className="flex flex-1 flex-col overflow-hidden">
          <div className="border-border/40 bg-muted/10 border-b px-6 pt-3 pb-1">
            <TabsList className="bg-muted/50 grid h-9 w-full grid-cols-4 rounded-xl p-1">
              <TabsTrigger
                value="vakt"
                className="rounded-lg text-[11px] font-semibold data-[state=active]:shadow-sm"
              >
                Vakt
              </TabsTrigger>
              <TabsTrigger
                value="oppgaver"
                className="rounded-lg text-[11px] font-semibold data-[state=active]:shadow-sm"
              >
                Oppgaver
              </TabsTrigger>
              <TabsTrigger
                value="handlinger"
                className="rounded-lg text-[11px] font-semibold data-[state=active]:shadow-sm"
              >
                Handlinger
              </TabsTrigger>
              <TabsTrigger
                value="historikk"
                className="rounded-lg text-[11px] font-semibold data-[state=active]:shadow-sm"
              >
                Historikk
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <TabsContent value="vakt" className="mt-0 space-y-6 pt-2 outline-none">
              {/* Time & Duration Section (Moved to TOP) */}
              <div className="bg-card/40 border-border/60 relative space-y-5 overflow-hidden rounded-[20px] border p-5 shadow-sm backdrop-blur-md">
                {/* Subtle shine effect */}
                <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />

                <div className="relative z-10 space-y-5">
                  {!isEditMode && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                        Hurtigvalg
                      </Label>
                      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {SHIFT_PRESETS.map((preset) => (
                          <Button
                            key={preset.label}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="bg-background hover:bg-muted border-border/60 h-8 rounded-xl text-[11px] font-medium transition-all"
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                startTime: preset.startTime,
                                endTime: preset.endTime,
                                dayCategory: preset.dayCategory,
                              }));
                            }}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-12 gap-5">
                    <div className="col-span-5 space-y-2">
                      <Label
                        htmlFor="startTime"
                        className="text-muted-foreground text-[11px] font-semibold"
                      >
                        Starttid
                      </Label>
                      <div className="relative flex items-center">
                        <Input
                          id="startTime"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-2][0-9]:[0-5][0-9]"
                          placeholder="HH:MM"
                          value={form.startTime}
                          className="bg-background/80 border-border/60 h-10 rounded-xl pr-8 font-medium tabular-nums shadow-sm transition-all focus:ring-2 focus:ring-emerald-500/20"
                          onChange={(e) => handleStartTimeChange(e.target.value)}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground absolute right-1 h-8 w-8 rounded-lg"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32 rounded-xl">
                            <DropdownMenuItem
                              onClick={() => handleStartTimeChange(adjustTime(form.startTime, -30))}
                              className="rounded-lg text-xs"
                            >
                              -30 min
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStartTimeChange(adjustTime(form.startTime, -15))}
                              className="rounded-lg text-xs"
                            >
                              -15 min
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStartTimeChange(adjustTime(form.startTime, 15))}
                              className="rounded-lg text-xs"
                            >
                              +15 min
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStartTimeChange(adjustTime(form.startTime, 30))}
                              className="rounded-lg text-xs"
                            >
                              +30 min
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="col-span-5 space-y-2">
                      <Label
                        htmlFor="endTime"
                        className="text-muted-foreground text-[11px] font-semibold"
                      >
                        Sluttid
                      </Label>
                      <div className="relative flex items-center">
                        <Input
                          id="endTime"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-2][0-9]:[0-5][0-9]"
                          placeholder="HH:MM"
                          value={form.endTime}
                          className="bg-background/80 border-border/60 h-10 rounded-xl pr-8 font-medium tabular-nums shadow-sm transition-all focus:ring-2 focus:ring-emerald-500/20"
                          onChange={(e) => updateField("endTime", e.target.value)}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-foreground absolute right-1 h-8 w-8 rounded-lg"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32 rounded-xl">
                            <DropdownMenuItem
                              onClick={() => updateField("endTime", adjustTime(form.endTime, -30))}
                              className="rounded-lg text-xs"
                            >
                              -30 min
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateField("endTime", adjustTime(form.endTime, -15))}
                              className="rounded-lg text-xs"
                            >
                              -15 min
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateField("endTime", adjustTime(form.endTime, 15))}
                              className="rounded-lg text-xs"
                            >
                              +15 min
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateField("endTime", adjustTime(form.endTime, 30))}
                              className="rounded-lg text-xs"
                            >
                              +30 min
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label
                        htmlFor="breaks"
                        className="text-muted-foreground text-[11px] font-semibold"
                        title="Pause i minutter"
                      >
                        Pause
                      </Label>
                      <Input
                        id="breaks"
                        type="number"
                        min={0}
                        step={5}
                        value={form.breaks}
                        className="bg-background/80 border-border/60 h-10 rounded-xl px-2 text-center font-medium shadow-sm transition-all focus:ring-2 focus:ring-emerald-500/20"
                        onChange={(e) =>
                          updateField("breaks", Math.max(0, parseInt(e.target.value) || 0))
                        }
                      />
                    </div>
                  </div>
                  <div className="text-muted-foreground bg-background/50 border-border/30 rounded-lg border px-3 py-2 text-center text-xs font-semibold backdrop-blur-sm">
                    Totalt <span className="text-foreground">{workHours.toFixed(1)}t</span> lønnet
                    arbeid
                  </div>
                </div>
              </div>

              {/* Employee Section */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="employee"
                    className="text-muted-foreground text-[11px] font-semibold"
                  >
                    Ansatt
                  </Label>
                  <Select value={form.employeeId || "none"} onValueChange={handleEmployeeChange}>
                    <SelectTrigger
                      id="employee"
                      className="bg-card/40 border-border/60 h-10 rounded-xl font-medium shadow-sm backdrop-blur-sm transition-all focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <SelectValue placeholder="Åpen vakt (ingen valgt)" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none" className="rounded-lg text-sm">
                        Åpen vakt (ingen valgt)
                      </SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="rounded-lg text-sm">
                          {emp.name}{" "}
                          <span className="text-muted-foreground ml-1 text-xs font-normal">
                            — {emp.jobTitle || emp.role}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="shiftType"
                      className="text-muted-foreground text-[11px] font-semibold"
                    >
                      Vakttype
                    </Label>
                    <Select
                      value={form.shiftTypeId || "none"}
                      onValueChange={(v) => {
                        const typeId = v === "none" ? "" : v;
                        const config = shiftTypeConfigs.find((c) => c.shiftTypeId === typeId);
                        if (config) {
                          setForm((prev) => ({
                            ...prev,
                            shiftTypeId: typeId,
                            role: config.shiftTypeName,
                            startTime: config.startTime,
                            endTime: config.endTime,
                            breaks: config.breakMinutes,
                            dayCategory: inferDayCategory(config.startTime),
                          }));
                        } else {
                          updateField("shiftTypeId", typeId);
                        }
                      }}
                    >
                      <SelectTrigger
                        id="shiftType"
                        className="bg-card/40 border-border/60 h-10 rounded-xl font-medium shadow-sm backdrop-blur-sm transition-all focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <SelectValue placeholder="Velg vakttype" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="none" className="rounded-lg text-sm">
                          Ingen (manuell)
                        </SelectItem>
                        {shiftTypeConfigs.map((config) => (
                          <SelectItem
                            key={config.configId}
                            value={config.shiftTypeId}
                            className="rounded-lg text-sm"
                          >
                            <span className="flex items-center gap-2">
                              {config.shiftTypeColor && (
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: config.shiftTypeColor }}
                                />
                              )}
                              {config.label}
                              <span className="text-muted-foreground text-xs">
                                {config.startTime}–{config.endTime}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="team"
                      className="text-muted-foreground text-[11px] font-semibold"
                    >
                      Team
                    </Label>
                    <Select value={form.team} onValueChange={(v) => updateField("team", v)}>
                      <SelectTrigger
                        id="team"
                        className="bg-card/40 border-border/60 h-10 rounded-xl font-medium shadow-sm backdrop-blur-sm transition-all focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <SelectValue placeholder="Velg team" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {availableTeams.map((t) => (
                          <SelectItem key={t} value={t} className="rounded-lg text-sm">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {!showAdvanced ? (
                <Button
                  type="button"
                  variant="outline"
                  className="bg-card/20 text-muted-foreground border-border/40 hover:bg-card/40 hover:text-foreground w-full rounded-xl border-dashed py-6 text-[11px] font-semibold tracking-wider transition-all"
                  onClick={() => setShowAdvanced(true)}
                >
                  Vis flere valg (sone, notater, m.m.)
                </Button>
              ) : (
                <div className="animate-in fade-in slide-in-from-top-2 border-border/40 bg-card/20 space-y-5 rounded-[20px] border p-5 backdrop-blur-sm duration-300">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label
                        htmlFor="dayCategory"
                        className="text-muted-foreground text-[11px] font-semibold"
                      >
                        Dagkategori
                      </Label>
                      <Select
                        value={form.dayCategory}
                        onValueChange={(v) => updateField("dayCategory", v as DayCategory)}
                      >
                        <SelectTrigger
                          id="dayCategory"
                          className="bg-background/60 border-border/60 h-10 rounded-xl font-medium shadow-sm backdrop-blur-sm focus:ring-2 focus:ring-emerald-500/20"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {DAY_CATEGORY_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              className="rounded-lg text-sm"
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="zone"
                        className="text-muted-foreground text-[11px] font-semibold"
                      >
                        Sone
                      </Label>
                      <Select value={form.zone} onValueChange={(v) => updateField("zone", v)}>
                        <SelectTrigger
                          id="zone"
                          className="bg-background/60 border-border/60 h-10 rounded-xl font-medium shadow-sm backdrop-blur-sm focus:ring-2 focus:ring-emerald-500/20"
                        >
                          <SelectValue placeholder="Velg sone" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {AVAILABLE_ZONES.map((z) => (
                            <SelectItem key={z} value={z} className="rounded-lg text-sm">
                              {z}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="specialConditions"
                      className="text-muted-foreground text-[11px] font-semibold"
                    >
                      Notater for vakten
                    </Label>
                    <Textarea
                      id="specialConditions"
                      value={form.specialConditions}
                      onChange={(e) => updateField("specialConditions", e.target.value)}
                      placeholder="Eventuelle merknader eller spesialkrav (valgfritt)"
                      rows={3}
                      className="bg-background/60 border-border/60 resize-none rounded-xl text-sm font-medium shadow-sm backdrop-blur-sm focus-visible:ring-emerald-500/20"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:bg-background/50 hover:text-foreground w-full rounded-xl text-xs font-semibold"
                    onClick={() => setShowAdvanced(false)}
                  >
                    Skjul flere valg
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="oppgaver" className="mt-0 pt-4 outline-none">
              <div className="bg-card/20 border-border/40 text-muted-foreground relative flex flex-col items-center justify-center overflow-hidden rounded-[20px] border border-dashed py-16 text-center backdrop-blur-sm">
                <div className="bg-muted/30 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm">
                  <ListChecks className="text-muted-foreground/50 h-8 w-8" />
                </div>
                <h4 className="text-foreground text-sm font-bold tracking-tight">
                  Oppgaver og prosedyrer
                </h4>
                <p className="mt-2 max-w-[250px] text-xs leading-relaxed">
                  Knytt faste rutiner eller engangsoppgaver til dette skiftet. Denne funksjonen er
                  under utvikling.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/50 pointer-events-none mt-6 h-9 rounded-xl px-4 text-xs font-semibold opacity-50 shadow-sm backdrop-blur-sm"
                >
                  Legg til oppgave
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="handlinger" className="mt-0 space-y-6 pt-2 outline-none">
              <div className="bg-card/40 border-border/60 relative space-y-4 overflow-hidden rounded-[20px] border p-5 shadow-sm backdrop-blur-md">
                <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />

                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <Label htmlFor="publish-toggle" className="cursor-pointer text-sm font-bold">
                      Publiser skift
                    </Label>
                    <p className="text-muted-foreground mt-0.5 text-xs font-medium">
                      Gjør vakten synlig for den ansatte
                    </p>
                  </div>
                  <Switch
                    id="publish-toggle"
                    checked={form.isPublished}
                    onCheckedChange={(checked) => updateField("isPublished", checked)}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>

                {form.isPublished && (
                  <div className="border-border/60 animate-in fade-in slide-in-from-top-2 relative z-10 border-t pt-4 duration-300">
                    <Label className="text-muted-foreground mb-3 block text-[10px] font-bold tracking-widest uppercase">
                      Varsle ansatt via
                    </Label>
                    <div className="flex gap-2">
                      {NOTIFICATION_CHANNELS.map((ch) => {
                        const Icon = ch.icon;
                        const isActive = form.notificationChannels.has(ch.id);
                        return (
                          <Button
                            key={ch.id}
                            type="button"
                            variant={isActive ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleChannel(ch.id)}
                            className={`h-9 gap-2 rounded-xl text-xs font-semibold transition-all ${
                              isActive
                                ? "bg-emerald-500 shadow-[0_2px_10px_rgba(16,185,129,0.2)] hover:bg-emerald-600"
                                : "bg-background/50 border-border/60 hover:bg-muted"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {ch.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                  Flere handlinger
                </Label>
                <div className="flex flex-col gap-2.5">
                  <Button
                    variant="outline"
                    className="bg-card/40 border-border/60 hover:bg-muted h-11 w-full justify-start gap-3 rounded-xl font-semibold backdrop-blur-sm transition-all active:scale-[0.98]"
                    onClick={() => {}}
                  >
                    <Send className="h-4 w-4 text-emerald-500" />
                    Send melding til ansatt
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-card/40 border-border/60 hover:bg-muted h-11 w-full justify-start gap-3 rounded-xl font-semibold backdrop-blur-sm transition-all active:scale-[0.98]"
                    onClick={() => {}}
                  >
                    <User className="h-4 w-4 text-blue-500" />
                    Se ansattprofil
                  </Button>
                  {isEditMode && (
                    <Button
                      variant="outline"
                      className="h-11 w-full justify-start gap-3 rounded-xl border-red-500/20 bg-red-500/5 font-bold text-red-600 backdrop-blur-sm transition-all hover:bg-red-500/10 hover:text-red-700 active:scale-[0.98]"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                      Slett vakt
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="historikk" className="mt-0 space-y-8 pt-2 outline-none">
              {isEditMode && existingShift && (
                <div className="border-border/60 bg-card/20 relative overflow-hidden rounded-[20px] border px-2 pt-3 pb-5 shadow-sm backdrop-blur-sm">
                  <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />
                  <div className="relative z-10">
                    <ShiftStatusTimeline shift={existingShift} auditEntries={auditEntries} />
                  </div>
                </div>
              )}
              <div className="px-4">
                <ShiftHistoryTimeline entries={auditEntries} employees={employees} />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Sticky Footer */}
        <div className="bg-background/80 border-border/40 shrink-0 border-t px-6 py-5 backdrop-blur-xl">
          <DialogFooter className="flex w-full items-center justify-between gap-3 sm:gap-0">
            <div className="flex flex-1 items-center gap-2">
              {ruleCheck.result && ruleCheck.result.outcome !== "allowed" && (
                <div
                  className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-bold shadow-sm ${
                    ruleCheck.result.outcome === "blocked"
                      ? "border border-red-500/20 bg-red-500/10 text-red-500"
                      : ruleCheck.result.outcome === "review_required"
                        ? "border border-orange-500/20 bg-orange-500/10 text-orange-500"
                        : "border border-yellow-500/20 bg-yellow-500/10 text-yellow-500"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="hidden max-w-[140px] truncate sm:inline">
                    {ruleCheck.result.worstHit?.reason ?? "Regelbrudd"}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground h-10 rounded-xl px-4 text-xs font-bold transition-all active:scale-[0.98]"
              >
                Avbryt
              </Button>
              {isEditMode &&
              existingShift?.status !== "created" &&
              existingShift?.status !== "assigned" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSave(false)}
                  className="h-10 rounded-xl bg-orange-500 px-5 text-xs font-bold text-white shadow-[0_2px_12px_rgba(249,115,22,0.25)] transition-all hover:bg-orange-600 hover:shadow-[0_4px_16px_rgba(249,115,22,0.3)] active:scale-[0.98]"
                >
                  Lagre endringer
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSave(false)}
                    className="bg-background/50 border-border/60 hover:bg-muted h-10 rounded-xl px-4 text-xs font-bold backdrop-blur-sm transition-all active:scale-[0.98]"
                  >
                    Lagre utkast
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSave(true)}
                    className="h-10 rounded-xl bg-emerald-500 px-5 text-xs font-bold text-white shadow-[0_2px_12px_rgba(16,185,129,0.25)] transition-all hover:bg-emerald-600 hover:shadow-[0_4px_16px_rgba(16,185,129,0.3)] active:scale-[0.98]"
                  >
                    Lagre og publiser
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
