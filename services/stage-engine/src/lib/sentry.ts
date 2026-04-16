// ============================================
// sentry.ts — Sentry error-reporting init + context helper
// Per ADR-0113 (Runtime Telemetry Standard).
// Errors with httpStatus >= 500 are forwarded here by error-handler.ts.
// ============================================

import * as Sentry from "@sentry/node";
import { baseLogger } from "./logger.js";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN_STAGE_ENGINE;
  if (!dsn) {
    baseLogger.warn("SENTRY_DSN_STAGE_ENGINE not set — Sentry disabled");
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    release: process.env.STAGE_ENGINE_RELEASE,
  });
  initialized = true;
  baseLogger.info({ environment: process.env.NODE_ENV ?? "development" }, "Sentry initialized");
}

export function captureWithContext(err: unknown, ctx: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(ctx)) {
      scope.setTag(k, typeof v === "string" ? v : JSON.stringify(v));
    }
    Sentry.captureException(err);
  });
}

export function isSentryInitialized(): boolean {
  return initialized;
}
