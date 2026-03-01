// ============================================
// error-handler.ts
// Global error handler for the Shift MCP Server.
// Catches unhandled errors and returns a consistent JSON response.
// Connected to: src/index.ts (registered via app.onError)
// ============================================

import type { Context } from "hono";

/**
 * Global error handler that logs the error and returns a
 * consistent 500 JSON response. Never leaks stack traces
 * or internal details to the client.
 */
export function onError(err: Error, c: Context): Response {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);
  return c.json(
    { error: "INTERNAL_ERROR", message: "An unexpected error occurred", status: 500 },
    500,
  );
}
