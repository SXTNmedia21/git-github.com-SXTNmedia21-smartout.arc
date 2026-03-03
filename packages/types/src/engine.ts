import { z } from "zod";

// ── Enums ──────────────────────────────────────────────────

export const EngineStateStatus = z.enum([
  "pending",
  "active",
  "waiting",
  "complete",
  "failed",
  "escalated",
]);
export type EngineStateStatus = z.infer<typeof EngineStateStatus>;

export const EngineActionType = z.enum([
  "assign_task",
  "send_notification",
  "wait_for_event",
  "schedule_control",
  "start_process",
  "update_entity",
  "create_deviation",
  "validate_settlement",
  "lock_checkout",
]);
export type EngineActionType = z.infer<typeof EngineActionType>;

export const TimeoutAction = z.enum(["fail", "escalate", "skip", "retry"]);
export type TimeoutAction = z.infer<typeof TimeoutAction>;

// ── Condition Language (Blueprint §1.9) ────────────────────

export const ConditionMatch = z.object({
  match: z.record(z.unknown()),
});

export const ConditionStepStatus = z.object({
  step_status: z.object({
    step: z.number(),
    is: z.string(),
  }),
});

export const ConditionAll = z.object({
  all: z.array(z.lazy(() => EngineCondition)),
});

export const ConditionAny = z.object({
  any: z.array(z.lazy(() => EngineCondition)),
});

export const EngineCondition: z.ZodType<unknown> = z.union([
  ConditionMatch,
  ConditionStepStatus,
  ConditionAll,
  ConditionAny,
]);

// ── Core Schemas ───────────────────────────────────────────

export const EngineProcessSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullish(),
  workspace_id: z.string().uuid().nullish(),
  is_active: z.boolean().default(true),
  max_steps: z.number().int().default(50),
});
export type EngineProcess = z.infer<typeof EngineProcessSchema>;

export const EngineStepSchema = z.object({
  id: z.string().uuid(),
  process_id: z.string().min(1),
  step_order: z.number().int(),
  step_group: z.number().int().nullish(),
  action_type: EngineActionType,
  action_payload: z.record(z.unknown()).default({}),
  condition: EngineCondition.nullish(),
  assignee_rule: z.string().nullish(),
});
export type EngineStep = z.infer<typeof EngineStepSchema>;

export const EngineEventSchema = z.object({
  id: z.string().uuid(),
  event_type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  workspace_id: z.string().uuid(),
  idempotency_key: z.string().nullish(),
  fired_at: z.string(),
});
export type EngineEvent = z.infer<typeof EngineEventSchema>;

export const EngineStateSchema = z.object({
  id: z.string().uuid(),
  trigger_id: z.string().uuid().nullish(),
  process_id: z.string().min(1),
  workspace_id: z.string().uuid(),
  current_step: z.number().int().default(0),
  status: EngineStateStatus.default("pending"),
  entity_type: z.string().nullish(),
  entity_id: z.string().uuid().nullish(),
  assignee_id: z.string().uuid().nullish(),
  context: z.record(z.unknown()).default({}),
  steps_snapshot: z.array(EngineStepSchema).nullish(),
  result: z.record(z.unknown()).nullish(),
  depth: z.number().int().default(0),
  retry_count: z.number().int().default(0),
  last_error: z.string().nullish(),
});
export type EngineState = z.infer<typeof EngineStateSchema>;

// ── Department Session ─────────────────────────────────────

export const DepartmentSessionStatus = z.enum([
  "upcoming",
  "active",
  "pending_signoff",
  "closed",
  "missed",
]);
export type DepartmentSessionStatus = z.infer<typeof DepartmentSessionStatus>;

// ── Reconciliation ─────────────────────────────────────────

export const ReconciliationStatus = z.enum([
  "open",
  "submitted",
  "awaiting_approval",
  "approved",
  "locked",
  "unreconciled",
]);
export type ReconciliationStatus = z.infer<typeof ReconciliationStatus>;

export const RevenueSource = z.enum(["ocr", "manual"]);
export type RevenueSource = z.infer<typeof RevenueSource>;

export const SettlementSourceType = z.enum(["pos", "terminal", "z_report", "cash_count", "other"]);
export type SettlementSourceType = z.infer<typeof SettlementSourceType>;

export const DeviationDomain = z.enum(["safety", "customer", "procedure", "system", "material"]);
export type DeviationDomain = z.infer<typeof DeviationDomain>;

export const DeviationSeverity = z.enum(["low", "medium", "high", "critical"]);
export type DeviationSeverity = z.infer<typeof DeviationSeverity>;

export const DeviationStatus = z.enum(["open", "acknowledged", "resolved", "escalated"]);
export type DeviationStatus = z.infer<typeof DeviationStatus>;

export const ShiftApprovalStatus = z.enum(["pending", "approved", "edited", "disputed"]);
export type ShiftApprovalStatus = z.infer<typeof ShiftApprovalStatus>;
