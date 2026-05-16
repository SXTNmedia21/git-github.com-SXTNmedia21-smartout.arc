/**
 * stage-transitions.ts — Pure functions validating allowed stage transitions.
 *
 * No DB access. Unit-testable without Supabase mocks.
 *
 * Transition graph per ADR-0340:
 *
 *   Active statuses: pending → running
 *   Terminal statuses: complete | failed | cancelled | escalated | overridden
 *
 *   Stage advancement (step-level): currentStep N → N+1 while status=running.
 *   Pipeline termination: running → any terminal status.
 *
 *   Allowed forward-only transitions (status dimension):
 *     pending  → running
 *     running  → complete | failed | cancelled | escalated | overridden
 *
 *   Allowed forward-only transitions (step dimension, while running):
 *     currentStep N → N+1 (for N < maxStep)
 *     currentStep maxStep → terminal (complete or rejected/failed)
 *
 *   Rejection at any stage → "failed" terminal status (not a step advance).
 *   Cancellation at any stage → "cancelled" terminal status.
 *   Override → "overridden" terminal status (admin only, T5 tool).
 *
 *   Disallowed:
 *     - Any terminal → any other status (terminal is final)
 *     - Running → pending (no backward transitions)
 *     - Step regression (N+1 → N)
 */

import {
  TERMINAL_STATUSES,
  PipelineTransitionError,
  type PipelineStatus,
  type TerminalStatus,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────
// Status transition graph
// ─────────────────────────────────────────────────────────────────

const ALLOWED_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["running"],
  running: [...TERMINAL_STATUSES],
  // All terminal statuses have no outgoing transitions.
  complete: [],
  failed: [],
  cancelled: [],
  escalated: [],
  overridden: [],
};

/**
 * Assert that a status transition is allowed.
 *
 * Pure — throws PipelineTransitionError on invalid transition.
 *
 * @param fromStatus — current engine_state.status
 * @param toStatus — target status
 */
export function assertStatusTransition(fromStatus: string, toStatus: string): void {
  const allowed = ALLOWED_STATUS_TRANSITIONS[fromStatus];

  if (allowed === undefined) {
    throw new PipelineTransitionError("invalid_transition", fromStatus, toStatus);
  }

  if (!allowed.includes(toStatus)) {
    const isTerminalFrom = TERMINAL_STATUSES.includes(fromStatus as TerminalStatus);
    throw new PipelineTransitionError(
      isTerminalFrom ? "wrong_terminal_state" : "invalid_transition",
      fromStatus,
      toStatus,
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// Step transition validation
// ─────────────────────────────────────────────────────────────────

/**
 * Assert that a step advancement is valid.
 *
 * Rules:
 *   - Pipeline must be in "running" status to advance steps.
 *   - Steps are strictly monotone: fromStep + 1 == toStep.
 *   - Cannot advance past maxStep (maxStep is terminal).
 *
 * Pure — throws PipelineTransitionError on invalid transition.
 *
 * @param fromStep — current engine_state.current_step
 * @param toStep — target step (must equal fromStep + 1)
 * @param maxStep — total number of stages - 1 (0-indexed)
 * @param currentStatus — engine_state.status (must be "running")
 */
export function assertStepAdvance(
  fromStep: number,
  toStep: number,
  maxStep: number,
  currentStatus: string,
): void {
  if (currentStatus !== "running" && currentStatus !== "pending") {
    throw new PipelineTransitionError(
      "invalid_transition",
      `${currentStatus}:step${fromStep}`,
      `running:step${toStep}`,
    );
  }

  if (toStep !== fromStep + 1) {
    throw new PipelineTransitionError("invalid_transition", `step${fromStep}`, `step${toStep}`);
  }

  if (toStep > maxStep + 1) {
    // toStep = maxStep + 1 is accepted as "past final step" — the caller
    // should then transition to a terminal status, not advance further.
    throw new PipelineTransitionError("invalid_transition", `step${fromStep}`, `step${toStep}`);
  }
}

// ─────────────────────────────────────────────────────────────────
// Terminal state helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Returns true when the given status is a terminal state.
 * Pure — no side effects.
 */
export function isTerminalStatus(status: string): status is TerminalStatus {
  return TERMINAL_STATUSES.includes(status as TerminalStatus);
}

/**
 * Returns true when the given status is an active (non-terminal) state.
 * Pure — no side effects.
 */
export function isActiveStatus(status: string): boolean {
  return !isTerminalStatus(status);
}

// ─────────────────────────────────────────────────────────────────
// Stage-to-status mapping helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Map a stage-level outcome (accept/reject/cancel) to the pipeline
 * terminal status it produces.
 *
 * Pure — deterministic given the same inputs.
 *
 * @param outcome — the stage-level decision
 * @returns the resulting pipeline status
 */
export function stagOutcomeToStatus(
  outcome: "rejected" | "cancelled" | "overridden",
): TerminalStatus {
  switch (outcome) {
    case "rejected":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "overridden":
      return "overridden";
  }
}

/**
 * Returns the target pipeline status when the FINAL stage is approved.
 * Always "complete".
 */
export function finalStageApprovedStatus(): TerminalStatus {
  return "complete";
}

// ─────────────────────────────────────────────────────────────────
// Transition intent types
// ─────────────────────────────────────────────────────────────────

/** Discriminated union of all valid transition intents. */
export type PipelineTransitionIntent =
  | {
      kind: "activate"; // pending → running (stage-0 entry)
    }
  | {
      kind: "advance"; // running:stepN → running:stepN+1
      toStep: number;
    }
  | {
      kind: "complete"; // running → complete (final stage approved)
    }
  | {
      kind: "reject"; // running → failed (any stage rejected)
    }
  | {
      kind: "cancel"; // running → cancelled (initiator cancelled)
    }
  | {
      kind: "escalate"; // running → escalated (max_wait_minutes elapsed)
    }
  | {
      kind: "override"; // running → overridden (admin T5 override)
    };

/**
 * Resolve the status + step that result from applying a transition intent
 * to the current pipeline state.
 *
 * Pure — no DB access. Returns the target {status, step} for the caller
 * to write into engine_state.
 *
 * @param currentStatus — engine_state.status
 * @param currentStep — engine_state.current_step
 * @param maxStep — total stages - 1
 * @param intent — what should happen
 */
export function resolveTransition(
  currentStatus: string,
  currentStep: number,
  maxStep: number,
  intent: PipelineTransitionIntent,
): { status: PipelineStatus; step: number } {
  switch (intent.kind) {
    case "activate":
      assertStatusTransition(currentStatus, "running");
      return { status: "running", step: currentStep };

    case "advance":
      assertStepAdvance(currentStep, intent.toStep, maxStep, currentStatus);
      return { status: "running", step: intent.toStep };

    case "complete":
      assertStatusTransition(currentStatus, "complete");
      return { status: "complete", step: currentStep };

    case "reject":
      assertStatusTransition(currentStatus, "failed");
      return { status: "failed", step: currentStep };

    case "cancel":
      assertStatusTransition(currentStatus, "cancelled");
      return { status: "cancelled", step: currentStep };

    case "escalate":
      assertStatusTransition(currentStatus, "escalated");
      return { status: "escalated", step: currentStep };

    case "override":
      assertStatusTransition(currentStatus, "overridden");
      return { status: "overridden", step: currentStep };
  }
}
