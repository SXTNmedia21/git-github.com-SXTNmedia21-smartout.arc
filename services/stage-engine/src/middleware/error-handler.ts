// services/stage-engine/src/middleware/error-handler.ts
// ============================================
// error-handler.ts — Global error handler for stage-engine.
// Per ADR-0113: structured logging with requestId, typed-error
// HTTP mapping, Sentry forwarding for 5xx.
// ============================================

import type { Context } from "hono";
import type { ErrorResponse } from "../types/api.js";
import type { AppEnv } from "../types/app-env.js";
import { StageEngineError } from "../lib/errors.js";
import { childLogger } from "../lib/logger.js";
import { captureWithContext } from "../lib/sentry.js";

type StatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503 | 504;

export function onError(err: Error, c: Context<AppEnv>): Response {
  const requestId = c.get("requestId") ?? "unknown";
  const log = childLogger({ requestId });

  if (err instanceof StageEngineError) {
    const status = err.httpStatus as StatusCode;
    log.warn(
      {
        code: err.code,
        httpStatus: status,
        ctx: err.context,
        method: c.req.method,
        path: c.req.path,
      },
      err.message,
    );
    if (status >= 500) {
      captureWithContext(err, {
        code: err.code,
        requestId,
        path: c.req.path,
        method: c.req.method,
      });
    }
    return c.json<ErrorResponse>({ error: err.code, message: err.message, status }, status);
  }

  log.error(
    {
      err: { name: err.name, message: err.message, stack: err.stack },
      method: c.req.method,
      path: c.req.path,
    },
    "unhandled error",
  );
  captureWithContext(err, { requestId, path: c.req.path, method: c.req.method });
  return c.json<ErrorResponse>(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred", status: 500 },
    500,
  );
}
