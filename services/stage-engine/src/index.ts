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
import { ultravox } from "./routes/adapters/ultravox.js";
import { agentChat } from "./routes/agent/chat.js";
import { expireStaleSession } from "./core/session-manager.js";
import { cleanExpiredMemories } from "./core/memory-manager.js";

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
app.route("/", ultravox);
app.route("/", agentChat);

// Start server
const port = config.PORT;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Stage Engine running on port ${info.port}`);
});

// Session expiry + memory cleanup — runs on a configurable interval
const cleanupMs = config.CLEANUP_INTERVAL_MINUTES * 60 * 1000;
setInterval(async () => {
  const sessionCount = await expireStaleSession();
  if (sessionCount > 0) {
    console.log(`[cleanup] Expired ${sessionCount} stale session(s)`);
  }

  const memoryCount = await cleanExpiredMemories();
  if (memoryCount > 0) {
    console.log(`[cleanup] Cleaned ${memoryCount} expired memory(ies)`);
  }
}, cleanupMs);

console.log(
  `[cleanup] Session + memory cleanup running every ${config.CLEANUP_INTERVAL_MINUTES} minutes`,
);

export { app };
