import { z } from "zod";
import {
  PolicyTypeEnum,
  PolicyScopeEnum,
  EnforcementStatusEnum,
  ProtocolStatusEnum,
  ProcedureTypeEnum,
  TriggerTypeEnum,
  RoutineAssignedToTypeEnum,
  ControlListAssignedToTypeEnum,
  ControlFrequencyEnum,
  ProtocolAssignmentStatusEnum,
} from "./enums";

export const PolicySchema = z.object({
  policy_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  season_id: z.string().uuid().nullish(),
  policy_type: PolicyTypeEnum,
  policy_scope: PolicyScopeEnum,
  scope_ref_id: z.string().uuid().nullish(),
  name: z.string().min(1),
  description: z.string().nullish(),
  statement: z.string().min(1),
  enforcement_status: EnforcementStatusEnum.default("aspirational"),
  rules_json: z.record(z.any()).nullish(),
  valid_from: z.string().nullish(), // date string
  valid_to: z.string().nullish(), // date string
  priority: z.number().int().default(0),
  is_active: z.boolean().default(true),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Policy = z.infer<typeof PolicySchema>;

export const ProtocolSchema = z.object({
  protocol_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  version: z.string().default("1.0"),
  status: ProtocolStatusEnum.default("draft"),
  owner_profile_id: z.string().uuid(),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Protocol = z.infer<typeof ProtocolSchema>;

export const ProcedureSchema = z.object({
  procedure_id: z.string().uuid(),
  protocol_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  procedure_type: ProcedureTypeEnum.default("standard"),
  skill_requirements: z.record(z.any()).nullish(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Procedure = z.infer<typeof ProcedureSchema>;

export const ProcedureStepSchema = z.object({
  step_id: z.string().uuid(),
  procedure_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  step_order: z.number().int().default(0),
  is_required: z.boolean().default(true),
  estimated_minutes: z.number().int().nullish(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type ProcedureStep = z.infer<typeof ProcedureStepSchema>;

export const ControlListSchema = z.object({
  control_list_id: z.string().uuid(),
  protocol_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  assigned_to_type: ControlListAssignedToTypeEnum,
  assigned_to_ref: z.string().uuid().nullish(),
  items: z.record(z.any()), // array of json objects
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type ControlList = z.infer<typeof ControlListSchema>;

export const RoutineSchema = z.object({
  routine_id: z.string().uuid(),
  protocol_id: z.string().uuid(),
  procedure_id: z.string().uuid(),
  name: z.string().min(1),
  trigger_type: TriggerTypeEnum,
  trigger_config: z.record(z.any()),
  assigned_to_type: RoutineAssignedToTypeEnum,
  assigned_to_ref: z.string().uuid(),
  control_list_id: z.string().uuid().nullish(),
  control_frequency: ControlFrequencyEnum.default("never"),
  control_nth: z.number().int().nullish(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Routine = z.infer<typeof RoutineSchema>;

export const RunbookSchema = z.object({
  runbook_id: z.string().uuid(),
  protocol_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  trigger_event: z.string().min(1),
  trigger_conditions: z.record(z.any()),
  escalation_chain: z.record(z.any()),
  control_list_id: z.string().uuid(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Runbook = z.infer<typeof RunbookSchema>;

export const RunbookStepSchema = z.object({
  step_id: z.string().uuid(),
  runbook_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  step_order: z.number().int().default(0),
  is_required: z.boolean().default(true),
  estimated_minutes: z.number().int().nullish(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type RunbookStep = z.infer<typeof RunbookStepSchema>;

export const KnowledgeTestSchema = z.object({
  knowledge_test_id: z.string().uuid(),
  protocol_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  questions: z.record(z.any()),
  pass_threshold: z.number().int().default(80),
  max_attempts: z.number().int().nullish(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type KnowledgeTest = z.infer<typeof KnowledgeTestSchema>;

export const ConfirmationSchema = z.object({
  confirmation_id: z.string().uuid(),
  protocol_id: z.string().uuid(),
  name: z.string().min(1),
  confirmation_text: z.string().min(1),
  requires_signature: z.boolean().default(false),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type Confirmation = z.infer<typeof ConfirmationSchema>;

export const ProtocolAssignmentSchema = z.object({
  assignment_id: z.string().uuid(),
  protocol_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  status: ProtocolAssignmentStatusEnum.default("pending"),
  assigned_at: z.string().datetime(),
  completed_at: z.string().datetime().nullish(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullish(),
});
export type ProtocolAssignment = z.infer<typeof ProtocolAssignmentSchema>;
