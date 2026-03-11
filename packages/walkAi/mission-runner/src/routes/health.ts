// ============================================
// health.ts
// Health check endpoint for the Stage Engine.
// Returns service status, version, and timestamp.
// Used by Docker healthchecks, Caddy, and monitoring.
// ============================================

import { Hono } from "hono";

const health = new Hono();

/**
 * GET /health
 * Returns service health status.
 * No auth required — public endpoint per Security Protocol §15.5.
 */
health.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "stage-engine",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

export { health };
