// services/stage-engine/src/core/session-recorder.ts
// ADR-0184 — Session Recorder helper.
//
// Fire-and-forget ring buffer + async flush. NEVER blocks Emma on DB error
// (a recorder failure must never degrade the primary assistant path — see
// L-0105 "recorder before writer dead-letter trap").
//
// The recorder owns a setInterval that periodically flushes the buffer to
// agent_session_recording. Overflow drops the oldest entry (bounded memory).
// Every payload passes through redactPII() before insert so raw PII never
// touches the content_redacted column.

import type { SupabaseClient } from "@supabase/supabase-js";
import { redactPII } from "@smartout/ai/lib/pii-redact";

type TurnKind =
  | "user_input"
  | "agent_response"
  | "tool_call"
  | "tool_result"
  | "guardian_verdict"
  | "memory_read"
  | "memory_write"
  | "whisper";

type TurnPhase =
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

export type RecordTurnInput = {
  sessionId: string;
  workspaceId: string;
  profileId?: string;
  engineStateId?: string;
  turnIndex?: number;
  turnKind: TurnKind;
  phase: TurnPhase;
  content: unknown;
  meta?: Record<string, unknown>;
};

export type Recorder = {
  recordTurn(input: RecordTurnInput): void;
  getBufferSize(): number;
  getDropCount(): number;
  getErrorCount(): number;
  stop(): void;
};

export type RecorderOptions = {
  supabase: SupabaseClient;
  flushIntervalMs?: number;
  maxBuffer?: number;
};

type BufferedRow = {
  session_id: string;
  workspace_id: string;
  profile_id?: string;
  engine_state_id?: string;
  turn_index: number;
  turn_kind: TurnKind;
  phase: TurnPhase;
  content_redacted: unknown;
  meta: Record<string, unknown>;
};

/**
 * Module-scoped singleton for the stage-engine process.
 *
 * Hooks in prompt-builder / agent-router / authority / guardian-evaluator /
 * memory-manager call `getRecorder()` (returns `null` when no singleton has
 * been set) so every code path stays opt-in and non-blocking. Bootstrap in
 * `src/index.ts` calls `setRecorder(createRecorder(...))` once at startup;
 * tests can inject a stub via the same setter.
 *
 * Never throws — if the singleton was never set, callers simply skip recording.
 */
let _recorderSingleton: Recorder | null = null;

export function setRecorder(recorder: Recorder | null): void {
  _recorderSingleton = recorder;
}

export function getRecorder(): Recorder | null {
  return _recorderSingleton;
}

export function createRecorder(opts: RecorderOptions): Recorder {
  const flushMs = opts.flushIntervalMs ?? 500;
  const maxBuffer = opts.maxBuffer ?? 1000;
  const buffer: BufferedRow[] = [];
  let drops = 0;
  let errors = 0;
  // Per-session turn counter (kept in memory; stage-engine restarts reset it —
  // Phase 1b will move this to DB-derived next_turn_index on session resume).
  const turnCounter = new Map<string, number>();

  const nextTurn = (sid: string) => {
    const n = (turnCounter.get(sid) ?? -1) + 1;
    turnCounter.set(sid, n);
    return n;
  };

  const flush = async () => {
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);
    try {
      const { error } = await opts.supabase.from("agent_session_recording").insert(batch);
      if (error) errors++;
    } catch {
      errors++;
    }
  };

  const timer = setInterval(() => {
    void flush();
  }, flushMs);
  // Do not keep the process alive just for the recorder; tests rely on this.
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as { unref: () => void }).unref();
  }

  return {
    recordTurn(input) {
      const content = input.content;
      const redactInput =
        typeof content === "string" ? content : (content as Record<string, unknown>);
      const r = redactPII(redactInput);
      const row: BufferedRow = {
        session_id: input.sessionId,
        workspace_id: input.workspaceId,
        profile_id: input.profileId,
        engine_state_id: input.engineStateId,
        turn_index: input.turnIndex ?? nextTurn(input.sessionId),
        turn_kind: input.turnKind,
        phase: input.phase,
        content_redacted: r.redactedObj ?? r.redacted,
        meta: {
          ...(input.meta ?? {}),
          _envelope_count: r.envelopes.length,
        },
      };
      if (buffer.length >= maxBuffer) {
        buffer.shift();
        drops++;
      }
      buffer.push(row);
    },
    getBufferSize: () => buffer.length,
    getDropCount: () => drops,
    getErrorCount: () => errors,
    stop: () => clearInterval(timer),
  };
}
