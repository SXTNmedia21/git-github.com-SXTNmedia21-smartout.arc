/**
 * Zod schema for JourneyIR. Single source of runtime validation.
 *
 * Used by:
 * - Markdown / TS parser in the compile pipeline.
 * - Server-side validators before writing to `journey_version.ir_json`.
 * - Consumer guards in apps/e2e generators, the runtime agent, and the
 *   Playwright protocol-runner (M3.5 retarget).
 *
 * Per ADR-0171, this schema lives in `packages/journey-ir`. Consumers
 * import from `@smartout/journey-ir` — the legacy adjacent-to-capabilities
 * path is forbidden; see ADR-0171 for the full rule.
 *
 * M3.5 (ADR-0178) — schema version 2.0.0:
 *   - Adds optional `actor`, `platform`, `auth_profile`, `preconditions`.
 *   - Adds optional `JourneyStep.actions` (discriminated union mirroring
 *     `apps/e2e/protocols/schema.ts::ActionSchema`).
 *   - Accepts both `"1.0.0"` (legacy) and `"2.0.0"` (current) on
 *     `version`. `CURRENT_IR_VERSION` in `./types` is the write target.
 *   - No fields removed. No fields tightened. v1 IRs parse unchanged.
 */

import { z } from "zod";

/**
 * Accepted schema versions. Keep in lock-step with `JourneyIRSchemaVersion`
 * in `./types`. Additive — never remove a value without a breaking-change ADR.
 *
 * v2.1.0 (ADR-0194): adds optional publish-mission fields (`system_prompt`,
 * `mode`, per-step coaching overrides). All additive at the read layer —
 * publish enforcement lives in `validateV21IrForMission()` (./validate.ts).
 */
export const JourneyIRSchemaVersionSchema = z.union([
  z.literal("1.0.0"),
  z.literal("2.0.0"),
  z.literal("2.1.0"),
]);

// ---------------------------------------------------------------------------
// v2 additive types — optional
// ---------------------------------------------------------------------------

/** Actor role authoring surface (v2). */
export const JourneyActorSchema = z.enum(["owner", "admin", "manager", "employee"]);

/** Target platform for a run (v2). */
export const JourneyPlatformSchema = z.enum(["web", "mobile"]);

/** Auth profile bootstrap identifier (v2). */
export const JourneyAuthProfileSchema = z.enum(["admin", "employee", "godmode"]);

/** Precondition block — DB rows that must match before a run starts (v2). */
export const JourneyPreconditionsSchema = z
  .object({
    db_state: z
      .array(
        z
          .object({
            table: z.string().min(1, "precondition table cannot be empty"),
            where: z.record(z.unknown()),
            expect: z.record(z.unknown()),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

/**
 * Typed step action — discriminated union mirroring
 * `apps/e2e/protocols/schema.ts::ActionSchema` variants (v2).
 * Each variant is `.strict()` so bogus keys surface as parse errors.
 */
export const JourneyActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), url: z.string().min(1) }).strict(),
  z.object({ type: z.literal("fill"), testid: z.string().min(1), value: z.string() }).strict(),
  z.object({ type: z.literal("click"), testid: z.string().min(1) }).strict(),
  z.object({ type: z.literal("click_text"), text: z.string().min(1) }).strict(),
  z.object({ type: z.literal("wait_visible"), testid: z.string().min(1) }).strict(),
  z.object({ type: z.literal("wait_hidden"), testid: z.string().min(1) }).strict(),
  z.object({ type: z.literal("settle"), ms: z.number().int().nonnegative() }).strict(),
]);

/**
 * Typed step gate — discriminated union mirroring
 * `apps/e2e/protocols/schema.ts::GateSchema` variants (v2).
 *
 * Added in M3.5 so the Playwright `protocol-runner` drives verification
 * directly from the IR (no `ProtocolDefinition` fallback required).
 */
export const JourneyGateSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("db_record"),
      table: z.string().min(1),
      where: z.record(z.unknown()),
      expect: z.record(z.unknown()),
      timeout_ms: z.number().int().positive().optional(),
      retry_interval_ms: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("ui_state"),
      testid: z.string().min(1),
      visible: z.boolean().optional(),
      timeout_ms: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("url_match"),
      pattern: z.string().min(1),
      timeout_ms: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("telemetry_event"),
      event_name: z.string().min(1),
      actor_id: z.string().optional(),
      since: z.string().optional(),
      timeout_ms: z.number().int().positive().optional(),
      retry_interval_ms: z.number().int().positive().optional(),
    })
    .strict(),
]);

// ---------------------------------------------------------------------------
// JourneyStep — v1 fields + v2 additions
// ---------------------------------------------------------------------------

/**
 * Single-step schema. Matches `JourneyStep` in `./types`.
 * v2 additions: `actions`, `gate`, `order`, `screenshot`, `description`.
 * v2.1 additions (ADR-0194, all optional, publish-mission-only):
 *   `goal`, `instructions`, `success_criteria`, `creative_freedom`.
 *   `validateV21IrForMission()` enforces presence at the publish boundary;
 *   the read schema accepts absence so v2.0.0 IRs still parse unchanged.
 */
export const JourneyStepSchema = z
  .object({
    key: z.string().min(1, "step key cannot be empty"),
    title: z.string().min(1, "step title cannot be empty"),
    action: z.string().min(1, "step action cannot be empty"),
    assertion: z.string().min(1, "step assertion cannot be empty"),
    timeoutMs: z.number().int().positive().optional(),
    // --- v2 (ADR-0178) ---
    actions: z.array(JourneyActionSchema).optional(),
    gate: JourneyGateSchema.optional(),
    order: z.number().int().nonnegative().optional(),
    screenshot: z.boolean().optional(),
    description: z.string().optional(),
    // --- v2.1 (ADR-0194) — publish-mission coaching overrides ---
    goal: z.string().optional(),
    instructions: z.string().optional(),
    success_criteria: z.string().optional(),
    creative_freedom: z.number().min(0).max(1).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Top-level JourneyIR
// ---------------------------------------------------------------------------

/**
 * Top-level JourneyIR schema. Matches `JourneyIR` in `./types`.
 *
 * `.strict()` enforces no unknown keys — unknown fields are almost always
 * a parser bug or a spec/type drift, and silently dropping them hides
 * compile errors that should surface immediately.
 *
 * v2 additions (all optional): `actor`, `platform`, `auth_profile`,
 * `preconditions`, `entry_url`, `success_gate`.
 */
export const JourneyIRSchema = z
  .object({
    version: JourneyIRSchemaVersionSchema,
    slug: z.string().min(1, "journey slug cannot be empty"),
    title: z.string().min(1, "journey title cannot be empty"),
    module: z.string().min(1, "journey module cannot be empty"),
    steps: z.array(JourneyStepSchema).min(1, "journey must have at least one step"),
    // --- v2 (ADR-0178) ---
    actor: JourneyActorSchema.optional(),
    platform: JourneyPlatformSchema.optional(),
    auth_profile: JourneyAuthProfileSchema.optional(),
    preconditions: JourneyPreconditionsSchema.optional(),
    entry_url: z.string().optional(),
    success_gate: JourneyGateSchema.optional(),
    // --- v2.1 (ADR-0194) — publish-mission root contract ---
    // Optional at the read layer so v2.0.0 IRs still parse. Required at the
    // publish boundary via validateV21IrForMission() (./validate.ts).
    system_prompt: z.string().optional(),
    mode: z.enum(["sequential", "free", "hybrid"]).optional(),
  })
  .strict();

/**
 * Type inferred from the Zod schema. Equivalent to the `JourneyIR` TS
 * interface in `./types` — we export both so consumers can choose whichever
 * import is closer to hand.
 */
export type JourneyIRFromSchema = z.infer<typeof JourneyIRSchema>;
export type JourneyStepFromSchema = z.infer<typeof JourneyStepSchema>;
export type JourneyActionFromSchema = z.infer<typeof JourneyActionSchema>;
export type JourneyGateFromSchema = z.infer<typeof JourneyGateSchema>;
export type JourneyPreconditionsFromSchema = z.infer<typeof JourneyPreconditionsSchema>;
