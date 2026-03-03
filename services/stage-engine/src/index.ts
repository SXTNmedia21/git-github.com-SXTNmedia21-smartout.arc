// ============================================
// index.ts
// Entry point for the Stage Engine — Smartout's universal agent gateway.
// Sets up Hono app, registers middleware and routes, starts Node.js server.
// Connected to: src/routes/ (all route handlers)
// Connected to: src/middleware/ (auth, error handling)
// ============================================

import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { config } from "./config.js";
import { loadSecrets } from "./secrets.js";
import { authMiddleware } from "./middleware/auth.js";
import { onError } from "./middleware/error-handler.js";
import { health } from "./routes/health.js";
import { sessions } from "./routes/sessions.js";
import { store } from "./routes/store.js";
import { fetchRoute } from "./routes/fetch.js";
import { advance } from "./routes/advance.js";
import { ultravox } from "./routes/adapters/ultravox.js";
import { agentChat } from "./routes/agent/chat.js";
import { createWsRoute } from "./routes/ws.js";
import { attachGuardianWs } from "./routes/guardian.js";
import { expireStaleSession } from "./core/session-manager.js";
import { cleanExpiredMemories } from "./core/memory-manager.js";
import { evaluateAllActiveSessions } from "./core/guardian-evaluator.js";

// Load external API keys from Vault before starting the server
await loadSecrets();

const app = new Hono();

// WebSocket support via @hono/node-ws
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Global middleware
app.use(logger());
// Skip auth for WebSocket upgrade — WS auth is handled in the route handler itself
app.use("/ws/*", async (_c, next) => next());
app.use("*", authMiddleware);

// Error handler
app.onError(onError);

// Routes — WebSocket route first (registered before auth middleware applies)
app.route("/", createWsRoute(upgradeWebSocket));
app.route("/", health);
app.route("/", sessions);
app.route("/", store);
app.route("/", fetchRoute);
app.route("/", advance);
app.route("/", ultravox);
app.route("/", agentChat);

// Start server
const port = config.PORT;

import type { Server } from "node:http";

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Stage Engine running on port ${info.port}`);
});

// Inject Hono WebSocket handler for /ws/:sessionId
injectWebSocket(server);

// Attach Guardian WebSocket to the same HTTP server
attachGuardianWs(server as Server);

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

// Guardian evaluation loop — checks all active sessions every 30s
setInterval(async () => {
  try {
    await evaluateAllActiveSessions();
  } catch (err) {
    console.error("Guardian evaluation loop error:", err);
  }
}, 30_000);
console.log("[guardian] Evaluation loop running every 30 seconds");

export { app };
