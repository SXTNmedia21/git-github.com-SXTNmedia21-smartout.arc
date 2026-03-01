// ============================================
// journey.ts
// Zod schemas and TypeScript types for the journey tracking system.
// Maps 1:1 to the journey, journey_step, journey_event, and
// journey_test_run database tables. Used by the Journey Portal
// in platform-admin and shared across the monorepo.
// Connected to: supabase/migrations/20260301140000_journey_system.sql
// Connected to: packages/types/src/enums.ts (journey enums)
// ============================================

import { z } from "zod";
import {
  JourneyStatusEnum,
  JourneyActorEnum,
  JourneyPlatformEnum,
  JourneyPriorityEnum,
  JourneyModuleEnum,
  JourneyEventTypeEnum,
  JourneyTestResultEnum,
  JourneyPhaseEnum,
} from "./enums";
import type { JourneyStatus, JourneyModule } from "./enums";

// ─── Journey ──────────────────────────────────────────────
export const JourneySchema = z.object({
  journey_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  slug: z.string(),
  module: JourneyModuleEnum,
  actor: JourneyActorEnum,
  platform: JourneyPlatformEnum,
  priority: JourneyPriorityEnum,
  status: JourneyStatusEnum,
  tags: z.array(z.string()),
  trigger_description: z.string().nullable(),
  preconditions: z.array(z.string()),
  test_assertion: z.string().nullable(),
  doc_title: z.string().nullable(),
  outcomes_success: z.string().nullable(),
  outcomes_empty: z.string().nullable(),
  outcomes_error: z.string().nullable(),
  related_journeys: z.array(z.string().uuid()),
  blocked_by: z.array(z.string().uuid()),
  assignee_id: z.string().uuid().nullable(),
  linear_issue_id: z.string().nullable(),
  last_test_result: JourneyTestResultEnum.nullable(),
  last_test_run_at: z.string().nullable(),
  version: z.number().int(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Journey = z.infer<typeof JourneySchema>;

// ─── Journey Step ──────────────────────────────────────────
export const JourneyStepSchema = z.object({
  journey_step_id: z.string().uuid(),
  journey_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  step_order: z.number().int(),
  title: z.string(),
  action: z.string(),
  expects: z.string().nullable(),
  screen: z.string().nullable(),
  component: z.string().nullable(),
  data_reads: z.array(z.string()),
  data_writes: z.array(z.string()),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type JourneyStep = z.infer<typeof JourneyStepSchema>;

// ─── Journey Event ─────────────────────────────────────────
export const JourneyEventSchema = z.object({
  journey_event_id: z.string().uuid(),
  journey_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  event_type: JourneyEventTypeEnum,
  from_status: JourneyStatusEnum.nullable(),
  to_status: JourneyStatusEnum.nullable(),
  actor_id: z.string().uuid().nullable(),
  metadata: z.unknown(),
  created_at: z.string(),
});
export type JourneyEvent = z.infer<typeof JourneyEventSchema>;

// ─── Journey Test Run ──────────────────────────────────────
export const JourneyTestRunSchema = z.object({
  journey_test_run_id: z.string().uuid(),
  journey_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  result: JourneyTestResultEnum,
  duration_ms: z.number().int().nullable(),
  error_message: z.string().nullable(),
  test_output: z.record(z.unknown()).nullable(),
  triggered_by: z.string().uuid().nullable(),
  created_at: z.string(),
});
export type JourneyTestRun = z.infer<typeof JourneyTestRunSchema>;

// ─── Status Machine ────────────────────────────────────────
export type StatusTransition = {
  from: JourneyStatus;
  to: JourneyStatus[];
};

// ─── Module Metadata ───────────────────────────────────────
export type ModuleMeta = {
  code: JourneyModule;
  name: string;
  icon: string;
  color: string;
};

// ─── Pipeline Stats ────────────────────────────────────────
export type PipelineStats = Record<JourneyStatus, number>;

// ─── Journey with Steps (joined query) ─────────────────────
export type JourneyWithSteps = Journey & {
  steps: JourneyStep[];
};

// ─── Journey with Events (joined query) ────────────────────
export type JourneyWithEvents = Journey & {
  events: JourneyEvent[];
};

// Re-export enum types used in this module for convenience
export type { JourneyStatus, JourneyModule } from "./enums";
