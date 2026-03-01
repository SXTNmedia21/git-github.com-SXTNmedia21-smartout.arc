// ============================================
// index.ts
// Entry point for the Stage Engine — Smartout's universal agent gateway.
// Sets up Hono app, registers middleware and routes, starts Node.js server.
// Connected to: src/routes/ (all route handlers)
// Connected to: src/middleware/ (auth, error handling)
// ============================================

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { config } from "./config.js";
import { authMiddleware } from "./middleware/auth.js";
import { onError } from "./middleware/error-handler.js";
import { health } from "./routes/health.js";
import { sessions } from "./routes/sessions.js";
import { store } from "./routes/store.js";
import { fetchRoute } from "./routes/fetch.js";
import { advance } from "./routes/advance.js";
import { expireStaleSession } from "./core/session-manager.js";

const app = new Hono();

// Global middleware
app.use(logger());
app.use("*", authMiddleware);

// Error handler
app.onError(onError);

// Routes
app.route("/", health);
app.route("/", sessions);
app.route("/", store);
app.route("/", fetchRoute);
app.route("/", advance);

// Start server
const port = config.PORT;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Stage Engine running on port ${info.port}`);
});

// Session expiry cleanup — runs on a configurable interval
const cleanupMs = config.CLEANUP_INTERVAL_MINUTES * 60 * 1000;
setInterval(async () => {
  const count = await expireStaleSession();
  if (count > 0) {
    console.log(`[cleanup] Expired ${count} stale session(s)`);
  }
}, cleanupMs);

console.log(`[cleanup] Session cleanup running every ${config.CLEANUP_INTERVAL_MINUTES} minutes`);

export { app };
