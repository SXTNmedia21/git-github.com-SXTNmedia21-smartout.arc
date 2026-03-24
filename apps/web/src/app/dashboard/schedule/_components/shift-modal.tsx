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
    <div className="flex items-start justify-between gap-1 px-6 py-3">
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
                  className={`h-px w-3 ${isPast ? "bg-emerald-400/50" : "border-border border-t border-dashed"}`}
                />
              )}
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  isCurrent
                    ? "bg-emerald-500 text-white"
                    : isPast
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isPast ? (
                  step.key === "confirmed" ? (
                    <ThumbsUp className="h-2.5 w-2.5" />
                  ) : (
                    <Check className="h-2.5 w-2.5" />
                  )
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
            </div>
            <span
              className={`text-center text-[9px] leading-tight font-medium ${
                isCurrent ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
            {dateStr && (
              <span className="text-muted-foreground text-[9px] leading-none">
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
      <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
        <History className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">Ingen historikk tilgjengelig</p>
        <p className="mt-1 max-w-xs text-xs">
          Denne vakten ble opprettet for audit-logging var aktivert.
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
              <div className="bg-border mt-1.5 h-2 w-2 rounded-full" />
              <div className="bg-border w-px flex-1" />
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-baseline gap-2">
                <span className="text-foreground text-sm font-medium">
                  {describeAuditEntry(entry, employees)}
                </span>
              </div>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[11px]">
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

  const availableRoles = useMemo(
    () => [...new Set(employees.map((e) => e.jobTitle || e.role).filter((v): v is string => !!v))],
    [employees],
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
      // Treat the magic "none" string as clearing the employee selection (open shift)
      const targetId = employeeId === "none" ? "" : employeeId;
      const employee = employees.find((e) => e.id === targetId);
      setForm((prev) => ({
        ...prev,
        employeeId: targetId,
        role: (employee?.jobTitle || employee?.role) ?? prev.role,
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
        createShiftMutation.mutate({
          id: crypto.randomUUID(),
          employeeId: form.employeeId || null,
          dateId,
          role: form.role,
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
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        {/* Sticky Header */}
        <div className="border-border relative shrink-0 overflow-hidden rounded-t-lg border-b px-6 pt-5 pb-4">
          {isEditMode && existingShift && (
            <div
              className={`absolute top-0 left-0 h-1 w-full ${
                existingShift.status === "published"
                  ? "bg-emerald-500"
                  : existingShift.status === "active"
                    ? "bg-blue-500"
                    : existingShift.status === "completed"
                      ? "bg-zinc-500"
                      : "bg-orange-500"
              }`}
            />
          )}
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isEditMode
                    ? "bg-orange-500/10 text-orange-500"
                    : "bg-emerald-500/10 text-emerald-500"
                }`}
              >
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-base">
                  {isEditMode ? "Rediger skift" : "Nytt skift"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {isEditMode && existingShift
                    ? `${dateId} · ${getStatusLabel(existingShift.status)}`
                    : dateId
                      ? `Opprett skift for ${dateId}`
                      : "Opprett et nytt skift"}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {isEditMode && existingShift && (
                  <Badge variant={getStatusBadgeVariant(existingShift.status)}>
                    {getStatusLabel(existingShift.status)}
                  </Badge>
                )}
                {isEditMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {}}>
                        <Send className="mr-2 h-4 w-4" />
                        Send melding
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Slett vakt
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Status Timeline (edit mode only) */}
        {isEditMode && existingShift && (
          <div className="border-border border-b">
            <ShiftStatusTimeline shift={existingShift} auditEntries={auditEntries} />
          </div>
        )}

        {/* Content with Tabs */}
        <Tabs defaultValue="vakt" className="flex flex-1 flex-col overflow-hidden">
          <div className="border-border border-b px-6 pt-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="vakt" className="text-xs">
                Vakt
              </TabsTrigger>
              <TabsTrigger value="oppgaver" className="text-xs">
                Oppgaver
              </TabsTrigger>
              <TabsTrigger value="handlinger" className="text-xs">
                Handlinger
              </TabsTrigger>
              <TabsTrigger value="historikk" className="text-xs">
                Historikk
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <TabsContent value="vakt" className="mt-0 space-y-6 outline-none">
              {/* Time & Duration Section (Moved to TOP) */}
              <div className="bg-muted/30 border-border space-y-4 rounded-xl border p-4 shadow-sm">
                {!isEditMode && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                      Hurtigvalg
                    </Label>
                    <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {SHIFT_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="bg-background hover:bg-muted h-7 text-[11px]"
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

                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-5 space-y-1.5">
                    <Label htmlFor="startTime" className="text-xs">
                      Starttid
                    </Label>
                    <div className="relative flex items-center">
                      <Input
                        id="startTime"
                        type="time"
                        value={form.startTime}
                        className="bg-background pr-8 [color-scheme:light] dark:[color-scheme:dark]"
                        onChange={(e) => handleStartTimeChange(e.target.value)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground absolute right-0 h-full w-8"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem
                            onClick={() => handleStartTimeChange(adjustTime(form.startTime, -30))}
                          >
                            -30 min
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStartTimeChange(adjustTime(form.startTime, -15))}
                          >
                            -15 min
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStartTimeChange(adjustTime(form.startTime, 15))}
                          >
                            +15 min
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStartTimeChange(adjustTime(form.startTime, 30))}
                          >
                            +30 min
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="col-span-5 space-y-1.5">
                    <Label htmlFor="endTime" className="text-xs">
                      Sluttid
                    </Label>
                    <div className="relative flex items-center">
                      <Input
                        id="endTime"
                        type="time"
                        value={form.endTime}
                        className="bg-background pr-8 [color-scheme:light] dark:[color-scheme:dark]"
                        onChange={(e) => updateField("endTime", e.target.value)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground absolute right-0 h-full w-8"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem
                            onClick={() => updateField("endTime", adjustTime(form.endTime, -30))}
                          >
                            -30 min
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateField("endTime", adjustTime(form.endTime, -15))}
                          >
                            -15 min
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateField("endTime", adjustTime(form.endTime, 15))}
                          >
                            +15 min
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateField("endTime", adjustTime(form.endTime, 30))}
                          >
                            +30 min
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="breaks" className="text-xs" title="Pause i minutter">
                      Pause
                    </Label>
                    <Input
                      id="breaks"
                      type="number"
                      min={0}
                      step={5}
                      value={form.breaks}
                      className="bg-background px-2"
                      onChange={(e) =>
                        updateField("breaks", Math.max(0, parseInt(e.target.value) || 0))
                      }
                    />
                  </div>
                </div>
                <div className="text-muted-foreground text-xs font-medium">
                  Totalt {workHours.toFixed(1)}t lønnet arbeid
                </div>
              </div>

              {/* Employee Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employee">Ansatt</Label>
                  <Select value={form.employeeId || "none"} onValueChange={handleEmployeeChange}>
                    <SelectTrigger id="employee">
                      <SelectValue placeholder="Åpen vakt (ingen valgt)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Åpen vakt (ingen valgt)</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} — {emp.jobTitle || emp.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Rolle</Label>
                    <Select value={form.role} onValueChange={(v) => updateField("role", v)}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Velg rolle" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team">Team</Label>
                    <Select value={form.team} onValueChange={(v) => updateField("team", v)}>
                      <SelectTrigger id="team">
                        <SelectValue placeholder="Velg team" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTeams.map((t) => (
                          <SelectItem key={t} value={t}>
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
                  className="text-muted-foreground hover:border-foreground/30 hover:text-foreground w-full border-dashed text-xs transition-colors"
                  onClick={() => setShowAdvanced(true)}
                >
                  Vis flere valg (sone, notater, m.m.)
                </Button>
              ) : (
                <div className="animate-in fade-in slide-in-from-top-2 space-y-6 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dayCategory">Dagkategori</Label>
                      <Select
                        value={form.dayCategory}
                        onValueChange={(v) => updateField("dayCategory", v as DayCategory)}
                      >
                        <SelectTrigger id="dayCategory">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_CATEGORY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zone">Sone</Label>
                      <Select value={form.zone} onValueChange={(v) => updateField("zone", v)}>
                        <SelectTrigger id="zone">
                          <SelectValue placeholder="Velg sone" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_ZONES.map((z) => (
                            <SelectItem key={z} value={z}>
                              {z}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="specialConditions">Notater for vakten</Label>
                    <Textarea
                      id="specialConditions"
                      value={form.specialConditions}
                      onChange={(e) => updateField("specialConditions", e.target.value)}
                      placeholder="Eventuelle merknader eller spesialkrav (valgfritt)"
                      rows={2}
                      className="resize-none"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground w-full text-xs"
                    onClick={() => setShowAdvanced(false)}
                  >
                    Skjul flere valg
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="oppgaver" className="mt-0 outline-none">
              <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
                <ListChecks className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">Oppgaver og prosedyrer</p>
                <p className="mt-1 max-w-xs text-xs">
                  Knytt faste rutiner eller engangsoppgaver til dette skiftet (modul kommer).
                </p>
                <Button variant="outline" size="sm" className="pointer-events-none mt-4 opacity-50">
                  Legg til oppgave
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="handlinger" className="mt-0 space-y-6 outline-none">
              <div className="border-border bg-card space-y-3 rounded-xl border p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <Label
                      htmlFor="publish-toggle"
                      className="cursor-pointer text-sm font-semibold"
                    >
                      Publiser skift
                    </Label>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Gjør vakten synlig for den ansatte
                    </p>
                  </div>
                  <Switch
                    id="publish-toggle"
                    checked={form.isPublished}
                    onCheckedChange={(checked) => updateField("isPublished", checked)}
                  />
                </div>

                {form.isPublished && (
                  <div className="border-border border-t pt-3">
                    <Label className="text-muted-foreground mb-2 block text-xs font-semibold tracking-wider uppercase">
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
                            className="h-8 gap-1.5 text-xs"
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

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Flere handlinger
                </Label>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 transition-all active:scale-[0.98]"
                    onClick={() => {}}
                  >
                    <Send className="text-muted-foreground h-4 w-4" />
                    Send melding til ansatt
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 transition-all active:scale-[0.98]"
                    onClick={() => {}}
                  >
                    <User className="text-muted-foreground h-4 w-4" />
                    Se ansattprofil
                  </Button>
                  {isEditMode && (
                    <Button
                      variant="destructive"
                      className="w-full justify-start gap-2 transition-all active:scale-[0.98]"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                      Slett vakt
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="historikk" className="mt-0 outline-none">
              <ShiftHistoryTimeline entries={auditEntries} employees={employees} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Sticky Footer */}
        <div className="bg-muted/30 border-border shrink-0 border-t px-6 py-4">
          <DialogFooter className="flex w-full items-center justify-between gap-3 sm:gap-0">
            <div className="flex flex-1 items-center gap-2">
              {ruleCheck.result && ruleCheck.result.outcome !== "allowed" && (
                <div
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ${
                    ruleCheck.result.outcome === "blocked"
                      ? "bg-red-500/10 text-red-500"
                      : ruleCheck.result.outcome === "review_required"
                        ? "bg-orange-500/10 text-orange-500"
                        : "bg-yellow-500/10 text-yellow-500"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden max-w-[120px] truncate sm:inline">
                    {ruleCheck.result.worstHit?.reason ?? "Regelbrudd"}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="transition-all active:scale-[0.98]"
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
                  className="bg-orange-600 text-white transition-all hover:bg-orange-700 active:scale-[0.98]"
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
                    className="transition-all active:scale-[0.98]"
                  >
                    Lagre utkast
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSave(true)}
                    className="bg-emerald-600 text-white transition-all hover:bg-emerald-700 active:scale-[0.98]"
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
