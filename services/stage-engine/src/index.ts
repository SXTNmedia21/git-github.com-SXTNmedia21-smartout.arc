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
import * as Sentry from "@sentry/node";
import { config } from "./config.js";
import { loadSecrets } from "./secrets.js";
import { authMiddleware } from "./middleware/auth.js";
import { onError } from "./middleware/error-handler.js";
import { initSentry } from "./lib/sentry.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { baseLogger } from "./lib/logger.js";
import type { AppEnv } from "./types/app-env.js";
import { health } from "./routes/health.js";
import { sessions } from "./routes/sessions.js";
import { store } from "./routes/store.js";
import { fetchRoute } from "./routes/fetch.js";
import { advance } from "./routes/advance.js";
import { ultravox } from "./routes/adapters/ultravox.js";
import { telegram } from "./routes/adapters/telegram.js";
import { agentChat } from "./routes/agent/chat.js";
import { createWsRoute } from "./routes/ws.js";
import { createGuardianRoute } from "./routes/guardian.js";
import { expireStaleSession } from "./core/session-manager.js";
import { cleanExpiredMemories } from "./core/memory-manager.js";
import { evaluateAllActiveSessions } from "./core/guardian-evaluator.js";
import { evaluateCalendarTriggers } from "./core/calendar-guardian.js";
import { relayToTelegram } from "./core/telegram-bridge.js";
import { SessionLane } from "./core/session-lane.js";

// Load external API keys from Vault before starting the server
await loadSecrets();

// Initialize Sentry (fails open if DSN missing) — must be after loadSecrets
initSentry();

// Agent Harness — session serialization
const sessionLane = new SessionLane();

// Module-scoped handles so graceful shutdown can close/clear them.
// pgNotifyClient is typed via dynamic import in setupPgNotifyListener().
let pgNotifyClient: import("pg").Client | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;
let guardianInterval: NodeJS.Timeout | null = null;
let calendarInterval: NodeJS.Timeout | null = null;
let isShuttingDown = false;

const app = new Hono<AppEnv>();

// WebSocket support via @hono/node-ws
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Global middleware
// Request ID must run first so every request (including auth-skipped routes) gets a UUID + x-request-id header
app.use(requestIdMiddleware);
// Skip auth for WebSocket upgrade — WS auth is handled in the route handler itself
app.use("/ws/*", async (_c, next) => next());
// Skip auth for Telegram webhook — Telegram does not send our API keys;
// it sends a shared secret in x-telegram-bot-api-secret-token instead,
// which is verified inside the route handler itself.
app.use("/adapters/telegram/*", async (_c, next) => next());
app.use("*", authMiddleware);

// Inject harness components into Hono context for route handlers
app.use("*", async (c, next) => {
  c.set("sessionLane", sessionLane);
  await next();
});

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
app.route("/", telegram);
app.route("/", agentChat);
app.route("/", createGuardianRoute(upgradeWebSocket));

// Start server
const port = config.PORT;

const server = serve({ fetch: app.fetch, port }, (info) => {
  baseLogger.info({ port: info.port }, "Stage Engine running");
});

// Inject Hono WebSocket handler for /ws/:sessionId
injectWebSocket(server);

// PG NOTIFY listener for Telegram chat bridge relay.
// When a channel_message is inserted, the DB fires NOTIFY telegram_bridge with
// a JSON payload. We parse it and relay the message to the admin's Telegram.
// Using a raw pg client (not Supabase Realtime) for reliability — Realtime
// requires a live websocket subscription which can silently disconnect.
async function setupPgNotifyListener() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      baseLogger.warn("[telegram] DATABASE_URL not set — bridge relay unavailable");
      return;
    }
    const { Client } = await import("pg");
    const client = new Client({ connectionString: dbUrl });
    pgNotifyClient = client;
    await client.connect();
    await client.query("LISTEN telegram_bridge");
    baseLogger.info("[telegram] PG NOTIFY listener active for chat bridge relay");

    client.on("notification", async (msg: { channel: string; payload?: string }) => {
      if (msg.channel !== "telegram_bridge" || !msg.payload) return;
      try {
        const payload = JSON.parse(msg.payload) as {
          channel_id: string;
          sender_id: string;
          origin_type: string;
          system_data: Record<string, unknown> | null;
          content: string;
        };
        // Skip admin relay echo: messages written by relayToSmartout() have
        // origin_type='webhook' and system_data.source='telegram_admin'
        const isAdminRelay =
          payload.origin_type === "webhook" && payload.system_data?.source === "telegram_admin";
        await relayToTelegram(
          payload.channel_id,
          isAdminRelay ? null : payload.sender_id,
          payload.content,
        );
      } catch (err) {
        baseLogger.error({ err }, "[telegram] Bridge relay error");
      }
    });

    // Reconnect automatically if the pg connection drops (unless shutting down)
    client.on("error", (err: Error) => {
      baseLogger.warn({ err }, "pg NOTIFY error");
      pgNotifyClient = null;
      if (!isShuttingDown) {
        setTimeout(() => void setupPgNotifyListener(), 5000);
      }
    });
  } catch (err) {
    baseLogger.warn(
      { err },
      "[telegram] PG NOTIFY listener setup failed (bridge relay unavailable)",
    );
  }
}

setupPgNotifyListener();

// Guardian WebSocket is now registered as a Hono route (via createGuardianRoute)

// Session expiry + memory cleanup — runs on a configurable interval
const cleanupMs = config.CLEANUP_INTERVAL_MINUTES * 60 * 1000;
cleanupInterval = setInterval(async () => {
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
guardianInterval = setInterval(async () => {
  try {
    await evaluateAllActiveSessions();
  } catch (err) {
    console.error("Guardian evaluation loop error:", err);
  }
}, 30_000);
console.log("[guardian] Evaluation loop running every 30 seconds");

// Calendar guardian — checks season-lifecycle sessions against time-based rules every 60s
calendarInterval = setInterval(async () => {
  try {
    await evaluateCalendarTriggers();
  } catch (err) {
    console.error("[calendar-guardian] Evaluation loop error:", err);
  }
}, 60_000);
console.log("[calendar-guardian] Season calendar check running every 60 seconds");

// Graceful shutdown: flush Sentry queue, close HTTP server, close pg NOTIFY client,
// clear intervals. Prevents event loss on Docker/droplet redeploy (SIGTERM) or
// local Ctrl+C (SIGINT). Must call process.exit(0) so Docker doesn't force-kill.
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    baseLogger.info({ signal }, "Shutdown already in progress, ignoring duplicate signal");
    return;
  }
  isShuttingDown = true;

  baseLogger.info({ signal }, "Graceful shutdown started");

  // Order matters: intervals → HTTP server (drain in-flight) → pg client → Sentry.
  // pg resources must outlive HTTP requests that hold pg references.
  if (cleanupInterval) clearInterval(cleanupInterval);
  if (guardianInterval) clearInterval(guardianInterval);
  if (calendarInterval) clearInterval(calendarInterval);

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    baseLogger.info("HTTP server closed");
  } catch (err) {
    baseLogger.warn({ err }, "HTTP server close failed");
  }

  try {
    if (pgNotifyClient) {
      await pgNotifyClient.end();
      baseLogger.info("pg NOTIFY client closed");
    }
  } catch (err) {
    baseLogger.warn({ err }, "pg client close failed");
  }

  try {
    await Sentry.close(2000);
    baseLogger.info("Sentry flushed");
  } catch (err) {
    baseLogger.warn({ err }, "Sentry flush failed");
  }

  baseLogger.info("Graceful shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM").catch((err) => {
    baseLogger.error({ err }, "graceful shutdown failed");
    process.exit(1);
  });
});
process.on("SIGINT", () => {
  gracefulShutdown("SIGINT").catch((err) => {
    baseLogger.error({ err }, "graceful shutdown failed");
    process.exit(1);
  });
});

export { app };
