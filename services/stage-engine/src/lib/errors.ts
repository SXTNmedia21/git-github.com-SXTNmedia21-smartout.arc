// services/stage-engine/src/lib/errors.ts
// ============================================
// errors.ts — Typed error hierarchy for stage-engine.
// Per ADR-0113 (Runtime Telemetry Standard).
// Phase 1 ships the base class + one generic subclass.
// Phase 2 Task 2.1 expands to: AuthorityDenied, ToolFailure,
// ClassifierTimeout, SchemaCacheStale, GateActionFailed.
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

/**
 * Generic wrapper for known-error conditions that don't warrant a dedicated subclass yet.
 * Prefer bespoke subclasses in Phase 2 for common cases (AuthorityDenied, ToolFailure, …).
 */
export class StageEngineKnownError extends StageEngineError {
  constructor(
    code: string,
    httpStatus: number,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(code, httpStatus, message, context);
  }
}
