/**
 * Priority engine for the Smart Home Hub.
 * Pure function: given current state, returns sorted action list.
 * No side effects, no async, no DB calls — just business logic.
 */

export type ShiftPhase = "before_shift" | "during_shift" | "after_shift" | "no_shift";

export type HubAction = {
  id: string;
  type: "punch" | "task" | "alert" | "shift_upcoming" | "message" | "info";
  priority: number;
  title: string;
  subtitle?: string;
  route?: string;
  urgency: "immediate" | "soon" | "info";
};

export type Shift = {
  id: string;
  start_time: string;
  end_time: string;
  position?: string;
  department_name?: string;
};

export type Task = {
  id: string;
  title: string;
  due_at?: string;
  task_type?: string;
};

export type Signal = {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  department_name?: string;
};

export type TimeEntry = {
  id: string;
  clock_in: string;
  clock_out?: string;
  break_start?: string;
};

export function prioritizeActions(
  shiftPhase: ShiftPhase,
  activeShift: Shift | null,
  nextShift: Shift | null,
  tasks: Task[],
  guardianSignals: Signal[],
  unreadCount: number,
  activeTimeEntry: TimeEntry | null,
): HubAction[] {
  const actions: HubAction[] = [];

  // Priority 1: During shift but no punch in
  if (shiftPhase === "during_shift" && activeShift && !activeTimeEntry) {
    actions.push({
      id: `punch-${activeShift.id}`,
      type: "punch",
      priority: 1,
      title: "Punch inn nå",
      subtitle: activeShift.department_name,
      route: "/(app)/(shifts)/punch",
      urgency: "immediate",
    });
  }

  // Priority 2: On break for too long (> 30 min)
  if (activeTimeEntry?.break_start) {
    const breakMinutes = Math.floor(
      (Date.now() - new Date(activeTimeEntry.break_start).getTime()) / 60000,
    );
    if (breakMinutes > 30) {
      actions.push({
        id: `break-${activeTimeEntry.id}`,
        type: "alert",
        priority: 2,
        title: `Pausen har vart i ${breakMinutes} min`,
        route: "/(app)/(shifts)/punch",
        urgency: "immediate",
      });
    }
  }

  // Priority 3: Overdue tasks
  const now = new Date();
  const overdueTasks = tasks.filter((t) => t.due_at && new Date(t.due_at) < now);
  for (const task of overdueTasks) {
    actions.push({
      id: `task-overdue-${task.id}`,
      type: "task",
      priority: 3,
      title: `${task.title} er forfalt`,
      route: "/(app)/(home)",
      urgency: "immediate",
    });
  }

  // Priority 4: Guardian signals
  for (const signal of guardianSignals) {
    actions.push({
      id: `signal-${signal.id}`,
      type: "alert",
      priority: 4,
      title: signal.title,
      subtitle: signal.department_name,
      route: "/(app)/(home)",
      urgency: signal.severity === "critical" ? "immediate" : "soon",
    });
  }

  // Priority 5: Shift starting within 60 min
  if (nextShift && shiftPhase !== "during_shift") {
    const minutesUntil = Math.floor(
      (new Date(nextShift.start_time).getTime() - Date.now()) / 60000,
    );
    if (minutesUntil > 0 && minutesUntil <= 60) {
      actions.push({
        id: `upcoming-${nextShift.id}`,
        type: "shift_upcoming",
        priority: 5,
        title: `Ditt skift starter om ${minutesUntil} min`,
        subtitle: `${nextShift.position ?? ""} · ${nextShift.department_name ?? ""}`.trim(),
        route: `/(app)/(shifts)/${nextShift.id}`,
        urgency: minutesUntil <= 15 ? "immediate" : "soon",
      });
    }
  }

  // Priority 6: Unconfirmed hours from yesterday (after_shift phase)
  if (shiftPhase === "after_shift") {
    actions.push({
      id: "confirm-hours",
      type: "task",
      priority: 6,
      title: "Bekreft timer fra i går",
      route: "/(app)/(shifts)",
      urgency: "soon",
    });
  }

  // Priority 7: Unread messages
  if (unreadCount > 0) {
    actions.push({
      id: "unread-messages",
      type: "message",
      priority: 7,
      title: `${unreadCount} uleste meldinger`,
      route: "/(app)/(chat)",
      urgency: "soon",
    });
  }

  // Priority 8: No shift today info
  if (shiftPhase === "no_shift" && !nextShift) {
    actions.push({
      id: "no-shift",
      type: "info",
      priority: 8,
      title: "Ingen skift i dag",
      urgency: "info",
    });
  } else if (shiftPhase === "no_shift" && nextShift) {
    const nextDate = new Date(nextShift.start_time);
    const dayName = nextDate.toLocaleDateString("nb-NO", { weekday: "long" });
    const time = nextDate.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
    actions.push({
      id: "next-shift-info",
      type: "info",
      priority: 8,
      title: `Ingen skift i dag. Neste: ${dayName} ${time}`,
      route: `/(app)/(shifts)/${nextShift.id}`,
      urgency: "info",
    });
  }

  // Sort by priority (lower number = higher priority)
  return actions.sort((a, b) => a.priority - b.priority);
}
