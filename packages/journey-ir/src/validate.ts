/**
 * validate.ts — JourneyIR v2.1 validators used at the publish boundary.
 *
 * ADR-0194 hybrid mapping requires `system_prompt` + `mode` on the IR root
 * and per-step `title`/`action`/`assertion`. `publish_mission` calls
 * `validateV21IrForMission()` BEFORE any database write and returns a
 * structured `{ok:false, error:"validation_failed", missing_fields}` when
 * the IR cannot be published faithfully.
 *
 * Why a separate helper (not `JourneyIRSchema.safeParse`):
 *   - The top-level `JourneyIRSchema` in `./schema.ts` is additive-only
 *     per ADR-0171 / ADR-0178. v2.0.0 IRs are still valid reads; v2.1.0
 *     fields (`system_prompt`, `mode`) are optional at the TypeScript
 *     layer so older rows do not fail Zod parse.
 *   - Publish flows have stricter requirements than read flows: the
 *     engine_missions row cannot be built without `system_prompt` + `mode`
 *     + per-step coaching fields. This validator surfaces exactly those
 *     gaps as a list of `missing_fields` paths that the Server Action can
 *     render to the author.
 *   - Never throws — returns discriminated union so capability bodies
 *     can translate to the `JSON.stringify` return contract from
 *     `defineTool` without try/catch.
 *
 * Binding:
 *   - ADR-0194 (JourneyIR v2.1 → engine_missions mapping) — normative
 *     source for the required-fields list.
 *   - ADR-0196 Invariant 11 — a phantom emit forbidden on the rejection
 *     path; the capability body must return `validation_failed` and NOT
 *     emit `journey.run_started` when this validator returns `ok:false`.
 */

/** Allowed modes per engine_missions CHECK constraint (ADR-0194 rule 1). */
export const JOURNEY_IR_V21_MODES = ["sequential", "free", "hybrid"] as const;
export type JourneyIrV21Mode = (typeof JOURNEY_IR_V21_MODES)[number];

/**
 * JourneyIR v2.1 — publish-ready shape. Additive superset of v2.0.0:
 *   - `system_prompt` required (non-empty trimmed string)
 *   - `mode` required, from the three-value enum
 *   - `steps[i].title|action|assertion` required (already v1/v2 base)
 *
 * Optional v2.1 per-step coaching overrides (`goal`, `instructions`,
 * `success_criteria`, `creative_freedom`) are NOT enforced here — they
 * have deterministic fallbacks per ADR-0194 rule 2. The validator only
 * flags fields whose absence blocks publication entirely.
 */
export interface JourneyIRv21 {
  readonly version: string;
  readonly slug: string;
  readonly title: string;
  readonly module: string;
  readonly system_prompt: string;
  readonly mode: JourneyIrV21Mode;
  readonly steps: ReadonlyArray<{
    readonly key: string;
    readonly title: string;
    readonly action: string;
    readonly assertion: string;
    readonly goal?: string;
    readonly instructions?: string;
    readonly success_criteria?: string;
    readonly creative_freedom?: number;
  }>;
}

export type ValidateV21Result =
  | { readonly ok: true; readonly ir: JourneyIRv21 }
  | {
      readonly ok: false;
      readonly error: "validation_failed";
      readonly missing_fields: readonly string[];
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate a JSONB `ir_json` blob against the publish-mission contract.
 *
 * Returns structured paths (`"system_prompt"`, `"mode"`, `"steps[0].action"`)
 * so the caller can render "fill in these fields to publish" to authors.
 * The first scan walks the whole tree — we do not bail on the first miss,
 * because surfacing three gaps at once saves an authoring round-trip.
 */
export function validateV21IrForMission(ir: unknown): ValidateV21Result {
  const missing: string[] = [];

  if (!isRecord(ir)) {
    return {
      ok: false,
      error: "validation_failed",
      missing_fields: ["<root>: ir_json must be a JSON object"],
    };
  }

  // Root: system_prompt.
  if (!isNonEmptyString(ir.system_prompt)) {
    missing.push("system_prompt");
  }

  // Root: mode (must be in the enum).
  const mode = ir.mode;
  const modeIsValid =
    typeof mode === "string" && (JOURNEY_IR_V21_MODES as readonly string[]).includes(mode);
  if (!modeIsValid) {
    missing.push("mode");
  }

  // Steps: must be non-empty array.
  const steps = ir.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    missing.push("steps");
  } else {
    steps.forEach((step, idx) => {
      if (!isRecord(step)) {
        missing.push(`steps[${idx}]`);
        return;
      }
      if (!isNonEmptyString(step.title)) missing.push(`steps[${idx}].title`);
      if (!isNonEmptyString(step.action)) missing.push(`steps[${idx}].action`);
      if (!isNonEmptyString(step.assertion)) missing.push(`steps[${idx}].assertion`);
    });
  }

  if (missing.length > 0) {
    return { ok: false, error: "validation_failed", missing_fields: missing };
  }

  // Narrow-cast — the checks above exhaust the JourneyIRv21 required surface.
  return { ok: true, ir: ir as unknown as JourneyIRv21 };
}

// ── Guide publish validator ───────────────────────────────────────────────────

/**
 * JourneyIR shape required for guide publication (ADR-0217).
 *
 * Stricter than the raw JourneyIRSchema (additive-only, permissive). A guide
 * must have:
 *   - At least one step with a non-empty `title` (used as MDX heading).
 *   - At least one step — empty steps array produces an empty MDX file.
 *
 * Unlike `validateV21IrForMission`, guide publication does NOT require
 * `system_prompt` or `mode` — those are runtime-mission fields. The guide
 * generator only reads `title`, `description`, `steps[i].title`,
 * `steps[i].action` (fallback for description), and `steps[i].assertion`
 * (success criteria). All are v1 base fields: always present on any IR that
 * reached `ready_publish` status.
 */
export interface JourneyIRForGuide {
  readonly version: string;
  readonly slug: string;
  readonly title: string;
  readonly module: string;
  readonly steps: ReadonlyArray<{
    readonly key: string;
    readonly title: string;
    readonly action: string;
    readonly assertion: string;
    readonly description?: string;
    readonly goal?: string;
    readonly instructions?: string;
    readonly success_criteria?: string;
  }>;
  // v2.1 fields are optional — not required for guide generation.
  readonly system_prompt?: string;
  readonly mode?: string;
  readonly description?: string;
}

export type ValidateIRForGuideResult =
  | { readonly ok: true; readonly ir: JourneyIRForGuide }
  | {
      readonly ok: false;
      readonly error: "validation_failed";
      readonly missing_fields: readonly string[];
    };

/**
 * Validate an `ir_json` blob against the guide-publish contract.
 *
 * Minimal gate: IR is a valid object, has a non-empty title, and has at
 * least one step with a non-empty title. The MDX generator falls back
 * gracefully for steps without `description` — this validator only blocks
 * when the IR is structurally broken.
 *
 * Never throws — returns discriminated union per the defineTool contract.
 */
export function validateIRForGuide(ir: unknown): ValidateIRForGuideResult {
  const missing: string[] = [];

  if (!isRecord(ir)) {
    return {
      ok: false,
      error: "validation_failed",
      missing_fields: ["<root>: ir_json must be a JSON object"],
    };
  }

  // Root: title is required — it becomes the MDX H1 heading.
  if (!isNonEmptyString(ir.title)) {
    missing.push("title");
  }

  // Steps: must be non-empty array; each step must have a non-empty title.
  const steps = ir.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    missing.push("steps");
  } else {
    steps.forEach((step, idx) => {
      if (!isRecord(step)) {
        missing.push(`steps[${idx}]`);
        return;
      }
      if (!isNonEmptyString(step.title)) missing.push(`steps[${idx}].title`);
    });
  }

  if (missing.length > 0) {
    return { ok: false, error: "validation_failed", missing_fields: missing };
  }

  return { ok: true, ir: ir as unknown as JourneyIRForGuide };
}
