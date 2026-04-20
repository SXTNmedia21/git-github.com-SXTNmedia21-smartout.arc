// WebDayControl widget contract types.
// Pure data shapes — no Supabase / React-Query coupling lives here.
// UiPhase inlined to keep packages/ui free of workspace deps other than
// design-tokens (ADR-0156 §8 portability discipline). Source of truth
// remains `packages/utils/src/cascade/derive-phase.ts` — these types are
// structurally compatible.

export type UiPhase = "upcoming" | "active" | "pending_signoff" | "closed" | "missed" | "locked";

export type DeptKey = "kitchen" | "floor" | "bar" | "event" | "storage";

export interface DaySession {
  id: string;
  dateISO: string;
  dayLong: string; // "Mandag"
  dayNum: string; // "19"
  month: string; // "april"
  relativeLabel: string; // "I dag"
  departmentName: string;
  departmentKey: DeptKey;
  location: string;
  plannedOpen: string; // "11:00"
  plannedClose: string; // "23:00"
  openedAt: string | null;
  closedAt: string | null;
  tasksTotal: number;
  tasksCompleted: number;
}

export interface DayShift {
  id: string;
  displayName: string;
  role: string;
  initials: string;
  deptKey: DeptKey;
  start: string;
  end: string;
  status: "upcoming" | "active" | "completed";
  live: boolean;
  breakState: "pause" | null;
  plannedHours: number;
  actualHours: number;
  isMe?: boolean;
}

export interface DayTask {
  id: string;
  title: string;
  owner: string;
  done: boolean;
  active?: boolean;
  overdue?: boolean;
  compliance?: boolean;
  evidence?: string | null;
  note?: string | null;
}

export type HookType = "pre_open" | "open" | "scheduled" | "pre_close" | "close";

export type HookState = "completed" | "in_progress" | "upcoming";

export interface DayHook {
  id: string;
  type: HookType;
  title: string;
  time: string;
  offset: string;
  state: HookState;
  progress: string; // "2/4"
  tasks: DayTask[];
}

export interface DayKpi {
  key: string;
  label: string;
  value: string;
  unit: string;
  planned?: string;
  delta?: string;
  deltaDir?: "up" | "down" | "flat";
  sub?: string;
  /** Source tier — drives footnote: "live", "snapshot", "post-reconciliation". */
  source?: "live" | "snapshot" | "post-reconciliation";
}

export type DeviationSeverity = "critical" | "high" | "medium" | "low";
export type DeviationStatus = "open" | "acknowledged" | "resolved" | "escalated";

export interface DayDeviation {
  id: string;
  severity: DeviationSeverity;
  status: DeviationStatus;
  type: string;
  title: string;
  desc: string;
  reporter: string;
  time: string;
  photos: number;
  assignedTo: string | null;
}

export type BroadcastType = "note" | "alert" | "reminder";

export interface DayBroadcast {
  id: string;
  type: BroadcastType;
  author: string;
  role: string;
  time: string;
  title: string;
  body: string;
}

export interface ReconSnapshot {
  revenue: string | null;
  hours: string | null;
  laborCost: string | null;
  marginVs: string | null;
}
