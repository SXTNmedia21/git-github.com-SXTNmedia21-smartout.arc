// services/stage-engine/src/lib/errors.ts
// ============================================
// errors.ts — Typed error hierarchy for stage-engine.
// Per ADR-0116 (Runtime Telemetry Standard).
// Error-handler maps `code` → `httpStatus`, forwards >= 500 to Sentry.
// ============================================

export class StageEngineError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly context?: Record<string, unknown>;

  constructor(
    code: string,
    httpStatus: number,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.context = context;
  }
}

/** Capability or channel blocked by C4 authority (403). */
export class AuthorityDenied extends StageEngineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super("AUTHORITY_DENIED", 403, message, context);
  }
}

/** Capability tool threw or returned error status (500). */
export class ToolFailure extends StageEngineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super("TOOL_FAILURE", 500, message, context);
  }
}

/** Intent classifier exceeded time budget or failed to parse (504). */
export class ClassifierTimeout extends StageEngineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super("CLASSIFIER_TIMEOUT", 504, message, context);
  }
}

/** PostgREST PGRST002 — schema cache stale. Retryable after backoff (503). */
export class SchemaCacheStale extends StageEngineError {
  readonly retryable = true;
  constructor(message: string, context?: Record<string, unknown>) {
    super("SCHEMA_CACHE_STALE", 503, message, context);
  }
}

/** gate_action RPC failed unexpectedly (502 — upstream dependency error). */
export class GateActionFailed extends StageEngineError {
  constructor(message: string, context?: Record<string, unknown>) {
    super("GATE_ACTION_FAILED", 502, message, context);
  }
}
