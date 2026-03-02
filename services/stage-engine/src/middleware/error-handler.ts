// ============================================
// error-handler.ts
// Global error handler for the Stage Engine.
// Catches unhandled errors and returns a consistent JSON error response.
// Connected to: src/types/api.ts (ErrorResponse type)
// ============================================

import type { Context } from "hono";
import type { ErrorResponse } from "../types/api.js";

/**
 * Global error handler.
 * Catches any unhandled error and returns a consistent JSON response.
 * Logs the full error for debugging but only returns safe info to the client.
 */
export function onError(err: Error, c: Context): Response {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);
  console.error(err.stack);

  const response: ErrorResponse = {
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    status: 500,
  };

  return c.json(response, 500);
}
