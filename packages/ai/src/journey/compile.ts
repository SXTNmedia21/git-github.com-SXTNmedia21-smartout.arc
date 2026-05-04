/**
 * Journey Compiler — converts journey PM definitions into engine runtime structs.
 *
 * Pure function. No DB access. Called by server action or CLI.
 *
 * Input: journey + steps + metadata
 * Output: engine_process + engine_steps + engine_trigger (ready for INSERT)
 */

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
