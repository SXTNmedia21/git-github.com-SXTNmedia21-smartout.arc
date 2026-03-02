// ============================================
// shift-modal.tsx
// 6-tab shift detail/create modal for the schedule module.
// Opens when a shift is selected (edit mode) or when creating
// a new shift (create mode). Tabs: Detaljer, Funksjoner,
// Historie, Lønnsgrunnlag, Oppgaver, Innstillinger.
// Connected to: schedule-context.tsx (state + dispatch)
// Connected to: schedule-types.ts (Shift, ShiftHistoryEntry)
// Connected to: schedule-data.ts (dummyEmployees)
// ============================================
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  History,
  ListChecks,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  Smartphone,
  Trash2,
  Wallet,
  X,
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

import type { Shift } from "./schedule-types";
import { useScheduleUI } from "./schedule-ui-context";
import { useShifts, useCreateShift, useUpdateShift, useDeleteShift } from "../_hooks/use-shifts";
import { useWeekRange } from "../_hooks/use-week-range";
import { useEmployees, type ScheduleEmployee } from "../_hooks/use-employees";
import { AVAILABLE_ZONES } from "./schedule-data";
import type { DayCategory, ShiftStatus } from "./schedule-types";

// ── Constants ───────────────────────────────────────────────

/** Base hourly rate in NOK for pay calculation */
const BASE_HOURLY_RATE = 250;
/** Evening/night supplement multiplier (40% extra) */
const EVENING_SUPPLEMENT = 0.4;
/** Weekend supplement multiplier (100% extra) */
const WEEKEND_SUPPLEMENT = 1.0;

/** Day category options for the override select */
const DAY_CATEGORY_OPTIONS: { value: DayCategory; label: string }[] = [
  { value: "morning", label: "Morgen" },
  { value: "midday", label: "Midt på dagen" },
  { value: "afternoon", label: "Ettermiddag" },
  { value: "evening", label: "Kveld" },
  { value: "night", label: "Natt" },
  { value: "weekend", label: "Helg" },
];

/** Common shift time presets for quick-fill buttons */
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

/** Notification channel options */
const NOTIFICATION_CHANNELS = [
  { id: "push", label: "Push", icon: Smartphone },
  { id: "email", label: "E-post", icon: Mail },
  { id: "sms", label: "SMS", icon: MessageSquare },
] as const;

// ── Local task type for the Oppgaver tab ────────────────────

type ShiftTask = {
  id: string;
  label: string;
  status: "pending" | "completed";
};

// ── Helper: infer day category from start time ──────────────

/**
 * Determines day category from a start time string.
 * Used for auto-calculation when user changes start time.
 *
 * @param startTime - "HH:MM" format
 * @returns The inferred DayCategory
 */
function inferDayCategory(startTime: string): DayCategory {
  const hour = parseInt(startTime.split(":")[0] ?? "0", 10);
  if (hour < 6) return "night";
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

/**
 * Calculates work hours between two time strings, subtracting break minutes.
 * Handles overnight shifts where end time is before start time.
 *
 * @param startTime - "HH:MM" format
 * @param endTime - "HH:MM" format
 * @param breakMinutes - Break duration in minutes
 * @returns Work hours as a decimal number
 */
function calculateWorkHours(startTime: string, endTime: string, breakMinutes: number): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const startTotal = (startH ?? 0) * 60 + (startM ?? 0);
  let endTotal = (endH ?? 0) * 60 + (endM ?? 0);

  // Handle overnight shifts
  if (endTotal <= startTotal) {
    endTotal += 24 * 60;
  }

  const totalMinutes = endTotal - startTotal - breakMinutes;
  return Math.max(0, totalMinutes / 60);
}

// ── Status badge color mapping ──────────────────────────────

/**
 * Returns a CSS class string for the shift status badge.
 */
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

/**
 * Returns a Norwegian display label for the shift status.
 */
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

// ── Form state type ─────────────────────────────────────────

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

/**
 * Shift detail/create modal with 6 tabs.
 * Opens in edit mode when selectedShiftId is set,
 * or in create mode when createShiftContext is set.
 *
 * Tabs:
 * 1. Detaljer — Employee, role, time, status, publish controls
 * 2. Funksjoner — Placeholder for workspace-specific features
 * 3. Historie — Audit trail from computed.getHistoryForShift
 * 4. Lønnsgrunnlag — Pay breakdown with supplements
 * 5. Oppgaver — Local task checklist within the shift
 * 6. Innstillinger — Break duration, special conditions
 */
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

  /** Unique job titles / roles and teams derived from real employee data */
  const availableRoles = useMemo(
    () => [...new Set(employees.map((e) => e.jobTitle || e.role).filter((v): v is string => !!v))],
    [employees],
  );
  const availableTeams = useMemo(
    () => [...new Set(employees.map((e) => e.team).filter((v): v is string => !!v))],
    [employees],
  );

  // Determine mode: edit (existing shift) or create (new shift)
  const isOpen = selectedShiftId !== null || createShiftContext !== null;
  const isEditMode = selectedShiftId !== null;
  const existingShift = isEditMode ? shifts.find((s: Shift) => s.id === selectedShiftId) : null;

  // ── Form state ──────────────────────────────────────────

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

  // Local tasks for the Oppgaver tab (not persisted to day-level state)
  const [shiftTasks, setShiftTasks] = useState<ShiftTask[]>([]);
  const [newTaskLabel, setNewTaskLabel] = useState("");

  // ── Initialize form when modal opens ────────────────────

  useEffect(() => {
    if (existingShift) {
      // Edit mode: pre-fill from existing shift
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
        breaks: existingShift.breaks,
        specialConditions: existingShift.notes ?? "",
      });
    } else if (createShiftContext) {
      // Create mode: pre-fill from context, rest is empty
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
    setShiftTasks((prev) => (prev.length === 0 ? prev : []));
    setNewTaskLabel("");
  }, [existingShift, createShiftContext, employees]);

  // ── Computed values ─────────────────────────────────────

  const workHours = useMemo(
    () => calculateWorkHours(form.startTime, form.endTime, form.breaks),
    [form.startTime, form.endTime, form.breaks],
  );

  const dateId = isEditMode ? existingShift?.dateId : createShiftContext?.dateId;

  // ── Handlers ────────────────────────────────────────────

  /** Closes the modal and resets both selectedShiftId and createShiftContext */
  const handleClose = useCallback(() => {
    setSelectedShift(null);
    setCreateShiftContext(null);
  }, [setSelectedShift, setCreateShiftContext]);

  /** Updates a single form field */
  const updateField = useCallback(
    <K extends keyof ShiftFormState>(field: K, value: ShiftFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /** Auto-fill role and team when employee changes */
  const handleEmployeeChange = useCallback(
    (employeeId: string) => {
      const employee = employees.find((e) => e.id === employeeId);
      setForm((prev) => ({
        ...prev,
        employeeId,
        role: (employee?.jobTitle || employee?.role) ?? prev.role,
        team: employee?.team ?? prev.team,
      }));
    },
    [employees],
  );

  /** Auto-calculate day category when start time changes */
  const handleStartTimeChange = useCallback((startTime: string) => {
    setForm((prev) => ({
      ...prev,
      startTime,
      dayCategory: inferDayCategory(startTime),
    }));
  }, []);

  /** Toggle a notification channel */
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

  /** Save shift (create or update) */
  const handleSave = useCallback(() => {
    const hours = calculateWorkHours(form.startTime, form.endTime, form.breaks);
    const status: ShiftStatus =
      form.employeeId && form.isPublished ? "published" : form.employeeId ? "assigned" : "created";

    if (isEditMode && existingShift) {
      // Update existing shift
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
          isPublished: form.isPublished,
          breaks: form.breaks,
          notes: form.specialConditions || undefined,
        },
      });
    } else if (dateId) {
      // Create new shift
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
        isPublished: form.isPublished,
        breaks: form.breaks,
        notes: form.specialConditions || undefined,
      });
    }

    handleClose();
  }, [
    form,
    isEditMode,
    existingShift,
    dateId,
    createShiftMutation,
    updateShiftMutation,
    handleClose,
  ]);

  /** Delete shift with confirmation */
  const handleDelete = useCallback(() => {
    if (!existingShift) return;
    const confirmed = window.confirm("Er du sikker på at du vil slette dette skiftet?");
    if (confirmed) {
      deleteShiftMutation.mutate(existingShift.id);
      handleClose();
    }
  }, [existingShift, deleteShiftMutation, handleClose]);

  /** Add a local task to the shift */
  const handleAddTask = useCallback(() => {
    if (!newTaskLabel.trim()) return;
    setShiftTasks((prev) => [
      ...prev,
      {
        id: `stask_${Date.now()}`,
        label: newTaskLabel.trim(),
        status: "pending",
      },
    ]);
    setNewTaskLabel("");
  }, [newTaskLabel]);

  /** Toggle a local task's status */
  const handleToggleTask = useCallback((taskId: string) => {
    setShiftTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: t.status === "completed" ? "pending" : "completed",
            }
          : t,
      ),
    );
  }, []);

  /** Delete a local task */
  const handleDeleteTask = useCallback((taskId: string) => {
    setShiftTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  // ── Pay calculation for Lønnsgrunnlag tab ───────────────

  const payBreakdown = useMemo(() => {
    const base = workHours * BASE_HOURLY_RATE;
    const isEveningOrNight = form.dayCategory === "evening" || form.dayCategory === "night";
    const isWeekend = form.dayCategory === "weekend";

    const eveningSupplement = isEveningOrNight ? base * EVENING_SUPPLEMENT : 0;
    const weekendSupplement = isWeekend ? base * WEEKEND_SUPPLEMENT : 0;
    const total = base + eveningSupplement + weekendSupplement;

    return { base, eveningSupplement, weekendSupplement, total };
  }, [workHours, form.dayCategory]);

  // ── History entries for Historie tab ────────────────────

  const historyEntries = useMemo(() => {
    // History is now handled by the database audit log.
    // Placeholder: return empty array. The audit log hook
    // can be wired in when the shift is persisted.
    return [] as {
      id: string;
      eventType: string;
      field?: string;
      oldValue?: string;
      newValue?: string;
      actor: string;
      timestamp: string;
    }[];
  }, [existingShift]);

  // ── Render ──────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Rediger skift" : "Nytt skift"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Endre detaljer for dette skiftet"
              : "Opprett et nytt skift for denne dagen"}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="detaljer" className="mt-2">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="detaljer" className="text-xs">
              <Clock className="mr-1 h-3 w-3" />
              Detaljer
            </TabsTrigger>
            <TabsTrigger value="funksjoner" className="text-xs">
              <Settings className="mr-1 h-3 w-3" />
              Funksjoner
            </TabsTrigger>
            <TabsTrigger value="historie" className="text-xs">
              <History className="mr-1 h-3 w-3" />
              Historie
            </TabsTrigger>
            <TabsTrigger value="lonn" className="text-xs">
              <Wallet className="mr-1 h-3 w-3" />
              Lønn
            </TabsTrigger>
            <TabsTrigger value="oppgaver" className="text-xs">
              <ListChecks className="mr-1 h-3 w-3" />
              Oppgaver
            </TabsTrigger>
            <TabsTrigger value="innstillinger" className="text-xs">
              <Settings className="mr-1 h-3 w-3" />
              Innstillinger
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Detaljer ─────────────────────────────── */}
          <TabsContent value="detaljer" className="mt-4 space-y-3">
            {/* Employee select */}
            <div className="space-y-2">
              <Label htmlFor="employee">Ansatt</Label>
              <Select value={form.employeeId} onValueChange={handleEmployeeChange}>
                <SelectTrigger id="employee">
                  <SelectValue placeholder="Velg ansatt (valgfritt)" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} — {emp.jobTitle || emp.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role + Team row */}
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

            {/* Date display (read-only) */}
            {dateId && (
              <div className="space-y-2">
                <Label>Dato</Label>
                <div className="border-border bg-muted text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  {dateId}
                </div>
              </div>
            )}

            {/* Shift time presets for quick-fill */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Hurtigvalg</Label>
              <div className="flex flex-wrap gap-1.5">
                {SHIFT_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
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

            {/* Start + End time row with inline work hours */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="startTime" className="text-xs">
                  Starttid
                </Label>
                <Input
                  id="startTime"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endTime" className="text-xs">
                  Sluttid
                </Label>
                <Input
                  id="endTime"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateField("endTime", e.target.value)}
                />
              </div>
            </div>
            <div className="text-muted-foreground -mt-1 text-xs">
              {workHours.toFixed(1)}t arbeid (inkl. {form.breaks} min pause)
            </div>

            {/* Day category + Zone row */}
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

            {/* Status badge (read-only in edit mode) */}
            {isEditMode && existingShift && (
              <div className="space-y-2">
                <Label>Status</Label>
                <div>
                  <Badge variant={getStatusBadgeVariant(existingShift.status)}>
                    {getStatusLabel(existingShift.status)}
                  </Badge>
                </div>
              </div>
            )}

            {/* Publish toggle + notification channels */}
            <div className="border-border space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="publish-toggle" className="cursor-pointer">
                  Publiser skift
                </Label>
                <Switch
                  id="publish-toggle"
                  checked={form.isPublished}
                  onCheckedChange={(checked) => updateField("isPublished", checked)}
                />
              </div>

              {form.isPublished && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Varslingskanaler</Label>
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
                          className="gap-1.5"
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
          </TabsContent>

          {/* ── Tab 2: Funksjoner ───────────────────────────── */}
          <TabsContent value="funksjoner" className="mt-4">
            <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
              <Settings className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">Tilleggsfunksjoner konfigureres per workspace</p>
            </div>
          </TabsContent>

          {/* ── Tab 3: Historie ──────────────────────────────── */}
          <TabsContent value="historie" className="mt-4">
            {historyEntries.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
                <History className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm">Ingen historikk ennå</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="border-border flex items-start gap-3 rounded-md border p-3 text-sm"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <History className="text-muted-foreground h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {entry.eventType}
                        </Badge>
                        {entry.field && (
                          <span className="text-muted-foreground">{entry.field}</span>
                        )}
                      </div>
                      {(entry.oldValue || entry.newValue) && (
                        <div className="text-muted-foreground mt-1 text-xs">
                          {entry.oldValue && <span className="line-through">{entry.oldValue}</span>}
                          {entry.oldValue && entry.newValue && " → "}
                          {entry.newValue && (
                            <span className="text-foreground font-medium">{entry.newValue}</span>
                          )}
                        </div>
                      )}
                      <div className="text-muted-foreground mt-1 text-xs">
                        {entry.actor} — {new Date(entry.timestamp).toLocaleString("nb-NO")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Tab 4: Lønnsgrunnlag ────────────────────────── */}
          <TabsContent value="lonn" className="mt-4">
            <div className="space-y-4">
              <div className="border-border rounded-md border">
                <div className="border-border border-b px-4 py-3">
                  <h4 className="text-sm font-medium">Beregnet lønn</h4>
                </div>
                <div className="space-y-3 p-4">
                  {/* Base pay */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Grunnlønn ({workHours.toFixed(1)}t x {BASE_HOURLY_RATE} NOK)
                    </span>
                    <span>{payBreakdown.base.toFixed(0)} NOK</span>
                  </div>

                  {/* Evening supplement */}
                  {payBreakdown.eveningSupplement > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Kveld/natt-tillegg (+{EVENING_SUPPLEMENT * 100}%)
                      </span>
                      <span>{payBreakdown.eveningSupplement.toFixed(0)} NOK</span>
                    </div>
                  )}

                  {/* Weekend supplement */}
                  {payBreakdown.weekendSupplement > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Helgetillegg (+{WEEKEND_SUPPLEMENT * 100}%)
                      </span>
                      <span>{payBreakdown.weekendSupplement.toFixed(0)} NOK</span>
                    </div>
                  )}

                  {/* Separator */}
                  <div className="border-border border-t" />

                  {/* Total */}
                  <div className="flex items-center justify-between font-medium">
                    <span>Totalt</span>
                    <span>{payBreakdown.total.toFixed(0)} NOK</span>
                  </div>
                </div>
              </div>

              <p className="text-muted-foreground text-xs">
                Estimat basert på standardsatser. Faktisk lønn beregnes av lønnssystem.
              </p>
            </div>
          </TabsContent>

          {/* ── Tab 5: Oppgaver ──────────────────────────────── */}
          <TabsContent value="oppgaver" className="mt-4">
            <div className="space-y-4">
              {/* Add task input */}
              <div className="flex gap-2">
                <Input
                  value={newTaskLabel}
                  onChange={(e) => setNewTaskLabel(e.target.value)}
                  placeholder="Legg til oppgave..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTask();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddTask}
                  disabled={!newTaskLabel.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Task list */}
              {shiftTasks.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center">
                  <ListChecks className="mb-3 h-10 w-10 opacity-30" />
                  <p className="text-sm">Ingen oppgaver lagt til</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shiftTasks.map((task) => (
                    <div
                      key={task.id}
                      className="border-border flex items-center gap-3 rounded-md border p-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id)}
                        className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      >
                        <CheckCircle2
                          className={`h-5 w-5 ${
                            task.status === "completed" ? "text-emerald-500" : ""
                          }`}
                        />
                      </button>
                      <span
                        className={`flex-1 text-sm ${
                          task.status === "completed" ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {task.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Tab 6: Innstillinger ────────────────────────── */}
          <TabsContent value="innstillinger" className="mt-4 space-y-4">
            {/* Break duration */}
            <div className="space-y-2">
              <Label htmlFor="breaks">Pausevarighet (minutter)</Label>
              <Input
                id="breaks"
                type="number"
                min={0}
                max={120}
                value={form.breaks}
                onChange={(e) => updateField("breaks", Math.max(0, parseInt(e.target.value) || 0))}
              />
              <p className="text-muted-foreground text-xs">
                Arbeidstimer justeres automatisk ({workHours.toFixed(1)}t etter pause)
              </p>
            </div>

            {/* Special conditions */}
            <div className="space-y-2">
              <Label htmlFor="specialConditions">Spesielle betingelser</Label>
              <Textarea
                id="specialConditions"
                value={form.specialConditions}
                onChange={(e) => updateField("specialConditions", e.target.value)}
                placeholder="Eventuelle merknader, spesialkrav, etc."
                rows={4}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          {isEditMode && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className="mr-auto gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Slett
            </Button>
          )}
          <Button type="button" variant="outline" onClick={handleClose}>
            Avbryt
          </Button>
          <Button type="button" onClick={handleSave}>
            {isEditMode ? "Lagre endringer" : "Opprett skift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
