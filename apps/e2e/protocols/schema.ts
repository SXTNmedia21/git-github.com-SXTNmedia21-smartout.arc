/**
 * Protocol Definition Schemas
 *
 * Zod schemas that define the structure of protocol test definitions.
 * A protocol is a sequence of user journey steps, each with actions and
 * a verification gate that must pass before proceeding.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Gates — verification checkpoints that confirm system state after each step
// ---------------------------------------------------------------------------

/** Verifies a database record matches expected values */
const DbRecordGateSchema = z.object({
  type: z.literal("db_record"),
  table: z.string(),
  where: z.record(z.unknown()),
  expect: z.record(z.unknown()),
  timeout_ms: z.number().default(10_000),
  retry_interval_ms: z.number().default(500),
});

/** Verifies a UI element is visible (or hidden) via data-testid */
const UiStateGateSchema = z.object({
  type: z.literal("ui_state"),
  testid: z.string(),
  visible: z.boolean().default(true),
  timeout_ms: z.number().default(5_000),
});

/** Verifies the browser URL matches a pattern */
const UrlMatchGateSchema = z.object({
  type: z.literal("url_match"),
  pattern: z.string(),
  timeout_ms: z.number().default(10_000),
});

/** Discriminated union of all gate types */
export const GateSchema = z.discriminatedUnion("type", [
  DbRecordGateSchema,
  UiStateGateSchema,
  UrlMatchGateSchema,
]);

// ---------------------------------------------------------------------------
// Actions — browser interactions executed within a step
// ---------------------------------------------------------------------------

/** Navigate the browser to a URL */
const NavigateActionSchema = z.object({
  type: z.literal("navigate"),
  url: z.string(),
});

/** Fill a form field identified by data-testid */
const FillActionSchema = z.object({
  type: z.literal("fill"),
  testid: z.string(),
  value: z.string(),
});

/** Click an element identified by data-testid */
const ClickActionSchema = z.object({
  type: z.literal("click"),
  testid: z.string(),
});

/** Click an element identified by its visible text content */
const ClickTextActionSchema = z.object({
  type: z.literal("click_text"),
  text: z.string(),
});

/** Wait until an element with data-testid becomes visible */
const WaitVisibleActionSchema = z.object({
  type: z.literal("wait_visible"),
  testid: z.string(),
});

/** Wait until an element with data-testid becomes hidden */
const WaitHiddenActionSchema = z.object({
  type: z.literal("wait_hidden"),
  testid: z.string(),
});

/** Pause execution to let the UI settle (animations, transitions, etc.) */
const SettleActionSchema = z.object({
  type: z.literal("settle"),
  ms: z.number().default(1_500),
});

/** Discriminated union of all action types */
export const ActionSchema = z.discriminatedUnion("type", [
  NavigateActionSchema,
  FillActionSchema,
  ClickActionSchema,
  ClickTextActionSchema,
  WaitVisibleActionSchema,
  WaitHiddenActionSchema,
  SettleActionSchema,
]);

// ---------------------------------------------------------------------------
// Steps — ordered sequence of actions followed by a verification gate
// ---------------------------------------------------------------------------

/** A single protocol step: execute actions, then verify via gate */
export const StepSchema = z.object({
  id: z.string(),
  order: z.number(),
  title: z.string(),
  description: z.string(),
  journey_step_slug: z.string().optional(),
  actions: z.array(ActionSchema),
  gate: GateSchema,
  screenshot: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Protocol Definition — the complete test protocol
// ---------------------------------------------------------------------------

/** Actor roles that can execute a protocol */
const ActorEnum = z.enum(["owner", "admin", "manager", "employee"]);

/** Target platform for the protocol */
const PlatformEnum = z.enum(["web", "mobile"]);

/** Auth profile used to authenticate before running the protocol */
const AuthProfileEnum = z.enum(["admin", "employee", "godmode"]);

/**
 * Complete protocol definition — describes a full user journey test
 * including preconditions, ordered steps with gates, and a final success gate.
 */
export const ProtocolDefinitionSchema = z.object({
  id: z.string(),
  package_id: z.string(),
  name: z.string(),
  actor: ActorEnum,
  platform: PlatformEnum,
  auth_profile: AuthProfileEnum,
  entry_url: z.string(),
  preconditions: z.object({
    db_state: z
      .array(
        z.object({
          table: z.string(),
          where: z.record(z.unknown()),
          expect: z.record(z.unknown()),
        }),
      )
      .default([]),
  }),
  steps: z.array(StepSchema),
  success_gate: GateSchema,
});

// ---------------------------------------------------------------------------
// Inferred types — use these instead of re-declaring shapes manually
// ---------------------------------------------------------------------------

export type Gate = z.infer<typeof GateSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Step = z.infer<typeof StepSchema>;
export type ProtocolDefinition = z.infer<typeof ProtocolDefinitionSchema>;
