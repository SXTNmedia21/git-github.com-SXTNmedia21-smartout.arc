export type TaskUrgency = "critical" | "should" | "can_wait";

export type TaskGroup =
  | "departments"
  | "staff"
  | "framework"
  | "budget"
  | "governance"
  | "schedule"
  | "contracts"
  | "messages";

export type CascadeDimension = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "C1" | "C2" | "C3" | "C4";

export type CascadeTask = {
  id: string;
  group: TaskGroup;
  dimension: CascadeDimension;
  title_key: string;
  title_params?: Record<string, string>;
  description_key: string;
  description_params?: Record<string, string>;
  urgency: TaskUrgency;
  href: string;
  entity_type?: string;
  entity_id?: string;
};

export type TaskGroupSummary = {
  group: TaskGroup;
  dimension: CascadeDimension;
  label_key: string;
  icon: string;
  done: number;
  total: number;
  tasks: CascadeTask[];
};

export type CascadeTasksResult = {
  groups: TaskGroupSummary[];
  total_tasks: number;
  critical_count: number;
  should_count: number;
};
