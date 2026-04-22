// packages/ai/src/lib/recording-hook.ts
//
// Boundary shim so capability tools in packages/ai can feed turn events to a
// recorder that physically lives in services/stage-engine. Packages/ai cannot
// import from stage-engine (circular), so we mirror the singleton pattern
// used there.
//
// Usage:
//   - Stage-engine bootstrap calls `setRecordingHook((input) => recorder.recordTurn(input))`
//     once at startup.
//   - Capability tools (e.g. save_memory) call `recordTurn(input)` — a no-op
//     if no hook has been registered.
//
// Contract:
//   - recordTurn() NEVER throws. A hook that throws is swallowed.
//   - A missing hook is the default state (tests, ad-hoc scripts, anyone
//     using packages/ai outside the stage-engine process) — not an error.
//
// Connected to:
//   - services/stage-engine/src/index.ts (bootstrap registers the hook)
//   - packages/ai/src/capabilities/memory/tools.ts (save_memory records writes)
//
// ADR-0184 — Session Recorder.

export type RecordedTurnKind =
  | "user_input"
  | "agent_response"
  | "tool_call"
  | "tool_result"
  | "guardian_verdict"
  | "memory_read"
  | "memory_write"
  | "whisper";

export type RecordedTurnPhase =
  | "classifier_input"
  | "classifier_output"
  | "authority_load"
  | "context_collect"
  | "prompt_built"
  | "llm_request"
  | "llm_response"
  | "tool_exec"
  | "guardian_eval"
  | "post_turn";

export type RecordedTurn = {
  sessionId: string;
  workspaceId: string;
  profileId?: string;
  engineStateId?: string;
  turnIndex?: number;
  turnKind: RecordedTurnKind;
  phase: RecordedTurnPhase;
  content: unknown;
  meta?: Record<string, unknown>;
};

export type RecordingHook = (input: RecordedTurn) => void;

let _hook: RecordingHook | null = null;

/**
 * Register a recording hook. Typically called exactly once from the
 * stage-engine bootstrap. Passing `null` disables recording (useful in tests).
 */
export function setRecordingHook(hook: RecordingHook | null): void {
  _hook = hook;
}

/**
 * Record a turn via the registered hook. No-op when no hook is registered.
 * Swallows hook exceptions so a recorder failure never blocks the tool.
 */
export function recordTurn(input: RecordedTurn): void {
  if (!_hook) return;
  try {
    _hook(input);
  } catch {
    // Hook must never throw into the primary path.
  }
}
