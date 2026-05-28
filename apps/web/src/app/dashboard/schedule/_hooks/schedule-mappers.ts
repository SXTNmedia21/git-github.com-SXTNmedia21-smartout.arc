/**
 * Mappers between database snake_case rows and frontend camelCase types.
 * DB types come from the auto-generated database.types.ts (via @smartout/supabase).
 * Frontend types are defined in ../_components/schedule-types.ts.
 *
 * Conventions:
 * - fromDb*:       DB Row → frontend type
 * - toDb*Insert:   frontend type → DB Insert (for new rows)
 * - toDb*Update:   Partial frontend type → DB Update (for patches)
 * - TIME columns:  DB returns "HH:MM:SS", frontend uses "HH:MM" — slice(0, 5)
 * - PKs:           DB uses {table_name}_id, frontend uses id
 * - shift_date:    DB date column → frontend dateId
 * - null → undefined for optional frontend fields
 */

import type { Database, Json } from "@smartout/supabase";
import type {
  AbsenceType,
  DayCategory,
  RequestType,
  ShiftStatus,
  TaskStatus,
} from "@smartout/types";

import type {
  Absence,
  DayBooking,
  DayMessage,
  DayTask,
  OpenShift,
  Shift,
  ShiftTemplate,
} from "../_components/schedule-types";

// ── DB row / insert / update type aliases ────────────────────

type ShiftRow = Database["public"]["Tables"]["schedule_shift"]["Row"];
type ShiftInsert = Database["public"]["Tables"]["schedule_shift"]["Insert"];
type ShiftUpdate = Database["public"]["Tables"]["schedule_shift"]["Update"];

type AbsenceRow = Database["public"]["Tables"]["schedule_absence"]["Row"];
type AbsenceInsert = Database["public"]["Tables"]["schedule_absence"]["Insert"];
type AbsenceUpdate = Database["public"]["Tables"]["schedule_absence"]["Update"];

type TemplateRow = Database["public"]["Tables"]["schedule_template"]["Row"];
type TemplateInsert = Database["public"]["Tables"]["schedule_template"]["Insert"];

type TemplateShiftRow = Database["public"]["Tables"]["schedule_template_shift"]["Row"];
type TemplateShiftInsert = Database["public"]["Tables"]["schedule_template_shift"]["Insert"];

type OpenShiftRow = Database["public"]["Tables"]["schedule_open_shift"]["Row"];
type OpenShiftInsert = Database["public"]["Tables"]["schedule_open_shift"]["Insert"];
type OpenShiftUpdate = Database["public"]["Tables"]["schedule_open_shift"]["Update"];

type DayMessageRow = Database["public"]["Tables"]["schedule_day_message"]["Row"];
type DayMessageInsert = Database["public"]["Tables"]["schedule_day_message"]["Insert"];
type DayMessageUpdate = Database["public"]["Tables"]["schedule_day_message"]["Update"];

type DayTaskRow = Database["public"]["Tables"]["schedule_day_task"]["Row"];
type DayTaskInsert = Database["public"]["Tables"]["schedule_day_task"]["Insert"];
type DayTaskUpdate = Database["public"]["Tables"]["schedule_day_task"]["Update"];

type DayBookingRow = Database["public"]["Tables"]["schedule_day_booking"]["Row"];
type DayBookingInsert = Database["public"]["Tables"]["schedule_day_booking"]["Insert"];
type DayBookingUpdate = Database["public"]["Tables"]["schedule_day_booking"]["Update"];

type AuditLogRow = Database["public"]["Tables"]["schedule_audit_log"]["Row"];

// ── Audit log entry (no frontend counterpart in schedule-types) ──

export type AuditLogEntry = {
  id: string;
  tableName: string;
  rowId: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  oldData: Json | null;
  newData: Json | null;
  changedFields: string[] | null;
  userId: string | null;
  createdAt: string;
};

// ── Helper: slice TIME "HH:MM:SS" → "HH:MM" ────────────────

function timeToHHMM(time: string): string {
  return time.slice(0, 5);
}

// ── ADR-0430 Rule 3 — resolve zones[] from shift_session join ──
// Two-hop join: schedule_shift → shift_session → shift_session_day_line
//               → shift_zone → zone(name, location_id)
// Returns empty array (never null) when no zones are assigned or when the
// query did not embed shift_session (e.g. simple select("*") queries).
// Deduplicates by zone.name — a shift spanning multiple day-lines may resolve
// the same zone more than once.

type ShiftRawWithSession = {
  shift_session?: Array<{
    shift_session_day_line?: Array<{
      shift_zone?: Array<{
        location_id: string;
        zone?: { name: string; location_id: string } | null;
      }>;
    }>;
  }> | null;
};

export function resolveZones(
  row: ShiftRawWithSession,
): Array<{ name: string; location_id: string }> {
  const seen = new Set<string>();
  const zones: Array<{ name: string; location_id: string }> = [];
  for (const session of row.shift_session ?? []) {
    for (const ssdl of session.shift_session_day_line ?? []) {
      for (const sz of ssdl.shift_zone ?? []) {
        const name = sz.zone?.name;
        const location_id = sz.location_id;
        if (name && !seen.has(name)) {
          seen.add(name);
          zones.push({ name, location_id });
        }
      }
    }
  }
  return zones;
}

// ══════════════════════════════════════════════════════════════
// Shift
// ══════════════════════════════════════════════════════════════

export function fromDbShift(row: ShiftRow): Shift {
  const startTime = timeToHHMM(row.start_time);
  const endTime = timeToHHMM(row.end_time);

  return {
    id: row.schedule_shift_id,
    employeeId: row.employee_id,
    dateId: row.shift_date,
    role: row.role,
    shiftTypeId: row.shift_type_id ?? undefined,
    departmentId: row.department_id ?? undefined,
    locationId: row.location_id ?? undefined,
    positionId: row.position_id ?? undefined,
    teamId: row.team_id ?? undefined,
    time: `${startTime} - ${endTime}`,
    startTime,
    endTime,
    workHours: row.work_hours,
    status: row.status as ShiftStatus,
    dayCategory: row.day_category as DayCategory,
    zone: row.zone ?? undefined,
    // ADR-0430 Rule 3: zones[] resolved from shift_session embed (two-hop join).
    // Empty array until PLAN-4b query updates embed shift_session into select("*").
    zones: resolveZones(row as ShiftRawWithSession),
    indicator: row.indicator,
    isPublished: row.is_published,
    breaks: row.breaks,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at ?? undefined,
    confirmedBy: row.confirmed_by ?? undefined,
  };
}

export function toDbShiftInsert(
  shift: Omit<Shift, "time" | "createdAt" | "updatedAt">,
  workspaceId: string,
): ShiftInsert {
  return {
    schedule_shift_id: shift.id,
    employee_id: shift.employeeId,
    shift_date: shift.dateId,
    role: shift.role,
    shift_type_id: shift.shiftTypeId ?? null,
    // ADR-0430 M1: department_id is NOT NULL. Shifts without a departmentId
    // should not reach insert; upstream callers must resolve department scope.
    // The non-null assertion here surfaces the bug at insertion time rather than
    // silently passing null to the DB (which would now be rejected anyway).
    department_id: shift.departmentId!,
    location_id: shift.locationId ?? null,
    position_id: shift.positionId ?? null,
    team_id: shift.teamId ?? null,
    start_time: shift.startTime,
    end_time: shift.endTime,
    work_hours: shift.workHours,
    status: shift.status,
    day_category: shift.dayCategory,
    zone: shift.zone ?? null,
    indicator: shift.indicator,
    is_published: shift.isPublished,
    breaks: shift.breaks,
    notes: shift.notes ?? null,
    workspace_id: workspaceId,
  };
}

export function toDbShiftUpdate(
  patch: Partial<Omit<Shift, "id" | "time" | "createdAt" | "updatedAt">>,
): ShiftUpdate {
  const update: ShiftUpdate = {};

  if (patch.employeeId !== undefined) update.employee_id = patch.employeeId;
  if (patch.dateId !== undefined) update.shift_date = patch.dateId;
  if (patch.role !== undefined) update.role = patch.role;
  if (patch.shiftTypeId !== undefined) update.shift_type_id = patch.shiftTypeId ?? null;
  if (patch.departmentId !== undefined) update.department_id = patch.departmentId ?? null;
  if (patch.locationId !== undefined) update.location_id = patch.locationId ?? null;
  if (patch.positionId !== undefined) update.position_id = patch.positionId ?? null;
  if (patch.teamId !== undefined) update.team_id = patch.teamId ?? null;
  if (patch.startTime !== undefined) update.start_time = patch.startTime;
  if (patch.endTime !== undefined) update.end_time = patch.endTime;
  if (patch.workHours !== undefined) update.work_hours = patch.workHours;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.dayCategory !== undefined) update.day_category = patch.dayCategory;
  if (patch.zone !== undefined) update.zone = patch.zone ?? null;
  if (patch.indicator !== undefined) update.indicator = patch.indicator;
  if (patch.isPublished !== undefined) update.is_published = patch.isPublished;
  if (patch.breaks !== undefined) update.breaks = patch.breaks;
  if (patch.notes !== undefined) update.notes = patch.notes ?? null;

  return update;
}

// ══════════════════════════════════════════════════════════════
// Absence
// ══════════════════════════════════════════════════════════════

export function fromDbAbsence(row: AbsenceRow): Absence {
  return {
    id: row.schedule_absence_id,
    employeeId: row.employee_id,
    dateId: row.shift_date,
    type: row.absence_type as AbsenceType,
    requestType: (row.request_type as RequestType) ?? undefined,
    reason: row.reason ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    isFullDay: row.is_full_day,
    status: row.status,
  };
}

export function toDbAbsenceInsert(
  absence: Omit<Absence, "status"> & { status?: Absence["status"] },
  workspaceId: string,
): AbsenceInsert {
  return {
    schedule_absence_id: absence.id,
    employee_id: absence.employeeId,
    shift_date: absence.dateId,
    absence_type: absence.type,
    request_type: absence.requestType ?? null,
    reason: absence.reason ?? null,
    start_date: absence.startDate,
    end_date: absence.endDate,
    is_full_day: absence.isFullDay,
    status: absence.status ?? "pending",
    workspace_id: workspaceId,
  };
}

export function toDbAbsenceUpdate(patch: Partial<Omit<Absence, "id">>): AbsenceUpdate {
  const update: AbsenceUpdate = {};

  if (patch.employeeId !== undefined) update.employee_id = patch.employeeId;
  if (patch.dateId !== undefined) update.shift_date = patch.dateId;
  if (patch.type !== undefined) update.absence_type = patch.type;
  if (patch.requestType !== undefined) update.request_type = patch.requestType ?? null;
  if (patch.reason !== undefined) update.reason = patch.reason ?? null;
  if (patch.startDate !== undefined) update.start_date = patch.startDate;
  if (patch.endDate !== undefined) update.end_date = patch.endDate;
  if (patch.isFullDay !== undefined) update.is_full_day = patch.isFullDay;
  if (patch.status !== undefined) update.status = patch.status;

  return update;
}

// ══════════════════════════════════════════════════════════════
// Template (header + shifts)
// ══════════════════════════════════════════════════════════════

export function fromDbTemplate(row: TemplateRow, shiftRows: TemplateShiftRow[]): ShiftTemplate {
  return {
    id: row.schedule_template_id,
    name: row.name,
    department: row.department,
    departmentId: row.department_id ?? null,
    includeAssignments: row.include_assignments,
    createdBy: row.created_by,
    createdAt: row.created_at,
    shifts: shiftRows.map((s) => {
      const startTime = timeToHHMM(s.start_time);
      const endTime = timeToHHMM(s.end_time);

      return {
        employeeId: s.employee_id,
        role: s.role,
        time: `${startTime} - ${endTime}`,
        startTime,
        endTime,
        workHours: s.work_hours,
        status: "created" as ShiftStatus,
        dayCategory: s.day_category as DayCategory,
        zone: s.zone ?? undefined,
        // Template shifts have no shift_session join — zone M:N not applicable.
        // ADR-0430 Rule 3: stub empty until template M:N support is added.
        zones: [],
        indicator: s.indicator,
        breaks: s.breaks,
        notes: s.notes ?? undefined,
      };
    }),
  };
}

export function toDbTemplateInsert(
  template: Omit<ShiftTemplate, "shifts" | "createdAt">,
  workspaceId: string,
): TemplateInsert {
  return {
    schedule_template_id: template.id,
    name: template.name,
    department: template.department,
    department_id: template.departmentId ?? null,
    include_assignments: template.includeAssignments,
    created_by: template.createdBy,
    workspace_id: workspaceId,
  };
}

export function toDbTemplateShiftInsert(
  shift: ShiftTemplate["shifts"][number],
  templateId: string,
): TemplateShiftInsert {
  return {
    template_id: templateId,
    employee_id: shift.employeeId,
    role: shift.role,
    start_time: shift.startTime,
    end_time: shift.endTime,
    work_hours: shift.workHours,
    day_category: shift.dayCategory as DayCategory,
    zone: shift.zone ?? null,
    indicator: shift.indicator,
    breaks: shift.breaks,
    notes: shift.notes ?? null,
  };
}

// ══════════════════════════════════════════════════════════════
// Open Shift
// ══════════════════════════════════════════════════════════════

export function fromDbOpenShift(row: OpenShiftRow): OpenShift {
  const startTime = timeToHHMM(row.start_time);
  const endTime = timeToHHMM(row.end_time);

  return {
    id: row.schedule_open_shift_id,
    title: row.title,
    time: `${startTime} - ${endTime}`,
    startTime,
    endTime,
    department: row.department ?? undefined,
    role: row.role ?? undefined,
    dayCategory: (row.day_category as DayCategory) ?? undefined,
  };
}

export function toDbOpenShiftInsert(
  openShift: Omit<OpenShift, "time">,
  workspaceId: string,
): OpenShiftInsert {
  return {
    schedule_open_shift_id: openShift.id,
    title: openShift.title,
    start_time: openShift.startTime,
    end_time: openShift.endTime,
    department: openShift.department ?? null,
    role: openShift.role ?? null,
    day_category: (openShift.dayCategory as DayCategory) ?? null,
    workspace_id: workspaceId,
  };
}

export function toDbOpenShiftUpdate(
  patch: Partial<Omit<OpenShift, "id" | "time">>,
): OpenShiftUpdate {
  const update: OpenShiftUpdate = {};

  if (patch.title !== undefined) update.title = patch.title;
  if (patch.startTime !== undefined) update.start_time = patch.startTime;
  if (patch.endTime !== undefined) update.end_time = patch.endTime;
  if (patch.department !== undefined) update.department = patch.department ?? null;
  if (patch.role !== undefined) update.role = patch.role ?? null;
  if (patch.dayCategory !== undefined)
    update.day_category = (patch.dayCategory as DayCategory) ?? null;

  return update;
}

// ══════════════════════════════════════════════════════════════
// Day Message
// ══════════════════════════════════════════════════════════════

export function fromDbDayMessage(row: DayMessageRow): DayMessage {
  return {
    id: row.schedule_day_message_id,
    dateId: row.shift_date,
    title: row.title,
    content: row.content,
    audience: row.audience as DayMessage["audience"],
    visibility: row.visibility,
    author: row.author_id,
    isAlert: row.is_alert,
    createdAt: row.created_at,
  };
}

export function toDbDayMessageInsert(
  msg: Omit<DayMessage, "createdAt">,
  workspaceId: string,
): DayMessageInsert {
  return {
    schedule_day_message_id: msg.id,
    shift_date: msg.dateId,
    title: msg.title,
    content: msg.content,
    audience: msg.audience,
    visibility: msg.visibility,
    author_id: msg.author,
    is_alert: msg.isAlert,
    workspace_id: workspaceId,
  };
}

export function toDbDayMessageUpdate(
  patch: Partial<Omit<DayMessage, "id" | "createdAt">>,
): DayMessageUpdate {
  const update: DayMessageUpdate = {};

  if (patch.dateId !== undefined) update.shift_date = patch.dateId;
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.audience !== undefined) update.audience = patch.audience;
  if (patch.visibility !== undefined) update.visibility = patch.visibility;
  if (patch.author !== undefined) update.author_id = patch.author;
  if (patch.isAlert !== undefined) update.is_alert = patch.isAlert;

  return update;
}

// ══════════════════════════════════════════════════════════════
// Day Task
// ══════════════════════════════════════════════════════════════

export function fromDbDayTask(row: DayTaskRow): DayTask {
  return {
    id: row.schedule_day_task_id,
    dateId: row.shift_date,
    label: row.label,
    status: row.task_status as TaskStatus,
    category: row.category as DayTask["category"],
    assignedTo: row.assigned_to ?? undefined,
    completedAt: row.completed_at ?? undefined,
    highlight: row.highlight,
  };
}

export function toDbDayTaskInsert(task: DayTask, workspaceId: string): DayTaskInsert {
  return {
    schedule_day_task_id: task.id,
    shift_date: task.dateId,
    label: task.label,
    task_status: task.status,
    category: task.category,
    assigned_to: task.assignedTo ?? null,
    completed_at: task.completedAt ?? null,
    highlight: task.highlight,
    workspace_id: workspaceId,
  };
}

export type DayTaskUpdatePatch = Partial<Omit<DayTask, "id" | "assignedTo" | "completedAt">> & {
  assignedTo?: string | null;
  completedAt?: string | null;
};

export function toDbDayTaskUpdate(patch: DayTaskUpdatePatch): DayTaskUpdate {
  const update: DayTaskUpdate = {};

  if (patch.dateId !== undefined) update.shift_date = patch.dateId;
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.status !== undefined) update.task_status = patch.status;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.assignedTo !== undefined) update.assigned_to = patch.assignedTo ?? null;
  if (patch.completedAt !== undefined) update.completed_at = patch.completedAt ?? null;
  if (patch.highlight !== undefined) update.highlight = patch.highlight;

  return update;
}

// ══════════════════════════════════════════════════════════════
// Day Booking
// ══════════════════════════════════════════════════════════════

export function fromDbDayBooking(row: DayBookingRow): DayBooking {
  return {
    id: row.schedule_day_booking_id,
    dateId: row.shift_date,
    title: row.title,
    guestCount: row.guest_count,
    menu: row.menu ?? "",
    time: timeToHHMM(row.booking_time),
    location: row.location ?? "",
    status: row.status,
    isVip: row.is_vip,
    notes: row.notes ?? undefined,
    contactPerson: row.contact_person ?? undefined,
  };
}

export function toDbDayBookingInsert(booking: DayBooking, workspaceId: string): DayBookingInsert {
  return {
    schedule_day_booking_id: booking.id,
    shift_date: booking.dateId,
    title: booking.title,
    guest_count: booking.guestCount,
    menu: booking.menu || null,
    booking_time: booking.time,
    location: booking.location || null,
    status: booking.status,
    is_vip: booking.isVip,
    notes: booking.notes ?? null,
    contact_person: booking.contactPerson ?? null,
    workspace_id: workspaceId,
  };
}

export function toDbDayBookingUpdate(patch: Partial<Omit<DayBooking, "id">>): DayBookingUpdate {
  const update: DayBookingUpdate = {};

  if (patch.dateId !== undefined) update.shift_date = patch.dateId;
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.guestCount !== undefined) update.guest_count = patch.guestCount;
  if (patch.menu !== undefined) update.menu = patch.menu || null;
  if (patch.time !== undefined) update.booking_time = patch.time;
  if (patch.location !== undefined) update.location = patch.location || null;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.isVip !== undefined) update.is_vip = patch.isVip;
  if (patch.notes !== undefined) update.notes = patch.notes ?? null;
  if (patch.contactPerson !== undefined) update.contact_person = patch.contactPerson ?? null;

  return update;
}

// ══════════════════════════════════════════════════════════════
// Audit Log
// ══════════════════════════════════════════════════════════════

export function fromDbAuditLog(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.audit_log_id,
    tableName: row.table_name,
    rowId: row.row_id,
    operation: row.operation,
    oldData: row.old_data,
    newData: row.new_data,
    changedFields: row.changed_fields,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}
