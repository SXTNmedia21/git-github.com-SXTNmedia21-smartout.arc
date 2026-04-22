/**
 * Journey Compiler — converts journey PM definitions into engine runtime structs.
 *
 * Pure function. No DB access. Called by server action or CLI.
 *
 * Input: journey + steps + metadata
 * Output: engine_process + engine_steps + engine_trigger (ready for INSERT)
 *
 * Per ADR-0171, this file is the canonical home for the journey compile
 * logic. The legacy adjacent-to-capabilities path is forbidden. Consumers
 * import from `@smartout/journey-ir`.
 *
 * NOTE: The `CompileInput` / `CompileStepInput` / `CompileOutput` shapes below
 * describe the DB → engine runtime compile contract and are intentionally
 * distinct from the authoring-surface `JourneyIR` / `JourneyStep` types in
 * `./types`. The two coexist — `JourneyIR` is the authoring/runtime IR; the
 * compile structs below are the engine-runtime materialization (engine_process
 * + engine_steps).
 *
 * M3.5 (ADR-0178) — additionally exports `assertCurrentIrVersion()` + the
 * `UnsupportedIrVersionError` class. Any write surface that persists
 * `JourneyIR` to `journey_version.ir_json` MUST call this guard first to
 * reject legacy-version writes.
 */

import type { JourneyIR } from "./types";
import { CURRENT_IR_VERSION } from "./types";

// ---------------------------------------------------------------------------
// Version guard — IR writes only accept CURRENT_IR_VERSION (ADR-0178)
// ---------------------------------------------------------------------------

/**
 * Thrown when a `JourneyIR` write is attempted with a version other than
 * `CURRENT_IR_VERSION`. Older versions still parse on read (additive
 * compatibility) but new writes must be current.
 */
export class UnsupportedIrVersionError extends Error {
  constructor(
    public readonly receivedVersion: string,
    public readonly requiredVersion: string = CURRENT_IR_VERSION,
  ) {
    super(
      `[journey-ir] Refusing write of IR with version="${receivedVersion}"; ` +
        `current write target is "${requiredVersion}". Upgrade the IR before persisting.`,
    );
    this.name = "UnsupportedIrVersionError";
  }
}

/**
 * Guard every JourneyIR write with this call. Reject writes that do not
 * carry `CURRENT_IR_VERSION`. Reads are unaffected — readers accept both
 * `"1.0.0"` and `"2.0.0"` per the `JourneyIRSchema`.
 *
 * Call sites (to be wired as write surfaces land):
 *   - server actions that write `journey_version.ir_json`
 *   - CLI / migration scripts that rehydrate + re-persist an IR
 *   - adapter-free authoring paths introduced in M4
 *
 * The guard is intentionally TS-level — DB-level enforcement (a CHECK
 * constraint on `ir_json->>'version'`) is additive and lives outside this
 * package when introduced.
 *
 * @throws UnsupportedIrVersionError when `ir.version !== CURRENT_IR_VERSION`.
 */
export function assertCurrentIrVersion(ir: Pick<JourneyIR, "version">): void {
  if (ir.version !== CURRENT_IR_VERSION) {
    throw new UnsupportedIrVersionError(ir.version, CURRENT_IR_VERSION);
  }
}

export interface CompileInput {
  /** Journey slug — becomes engine_process.id */
  journeySlug: string;
  /** Human-readable name */
  journeyName: string;
  /** Description */
  journeyDescription: string | null;
  /** Steps from journey_step table, ordered by step_order */
  steps: CompileStepInput[];
  /** Event that starts this journey */
  triggerEvent: string;
  /** Default event type for wait_for_event steps (e.g. "onboarding.step_completed") */
  stepEventType: string;
  /** Entity type for engine_state (e.g. "user_identity", "workspace") */
  entityType: string;
  /** Workspace-scoped or global (null) */
  workspaceId: string | null;
}

export interface CompileStepInput {
  /** Step slug from journey_step.slug — read directly, never generated from title.
   *  Must match what emit() sends as step_id in event payload. */
  slug: string;
  /** Display order */
  stepOrder: number;
  /** Override action_type (null = default wait_for_event) */
  actionTypeOverride: string | null;
  /** Override action_payload (null = generated from stepEventType + slug) */
  actionPayloadOverride: Record<string, unknown> | null;
}

export interface CompileOutput {
  process: {
    id: string;
    name: string;
    description: string | null;
    workspace_id: string | null;
    is_active: boolean;
    max_steps: number;
  };
  steps: Array<{
    process_id: string;
    step_order: number;
    action_type: string;
    action_payload: Record<string, unknown>;
    condition: Record<string, unknown> | null;
    assignee_rule: string | null;
  }>;
  trigger: {
    event_type: string;
    process_id: string;
    condition: Record<string, unknown> | null;
    delay_seconds: number;
    is_active: boolean;
    workspace_id: string | null;
  };
}

export function compileJourney(input: CompileInput): CompileOutput {
  const processId = input.journeySlug;

  const steps = input.steps.map((step) => {
    if (step.actionTypeOverride) {
      // Override: use provided action_type + payload, no auto-condition
      return {
        process_id: processId,
        step_order: step.stepOrder,
        action_type: step.actionTypeOverride,
        action_payload: step.actionPayloadOverride ?? {},
        condition: null,
        assignee_rule: null,
      };
    }

    // Default: wait_for_event with condition match on step slug
    return {
      process_id: processId,
      step_order: step.stepOrder,
      action_type: "wait_for_event",
      action_payload: { event: input.stepEventType },
      condition: { match: { step_id: step.slug } },
      assignee_rule: null,
    };
  });

  return {
    process: {
      id: processId,
      name: input.journeyName,
      description: input.journeyDescription,
      workspace_id: input.workspaceId,
      is_active: true,
      max_steps: Math.max(50, input.steps.length + 10),
    },
    steps,
    trigger: {
      event_type: input.triggerEvent,
      process_id: processId,
      condition: null,
      delay_seconds: 0,
      is_active: true,
      workspace_id: input.workspaceId,
    },
  };
}
