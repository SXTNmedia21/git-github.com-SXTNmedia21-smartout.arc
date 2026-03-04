// ============================================
// index.ts
// Entry point for the Shift MCP Server.
// Combines Hono (HTTP framework) with MCP protocol transport.
// Routes:
//   GET  /health → public health check (no auth)
//   POST /mcp    → MCP protocol handler (auth required)
// Each /mcp request creates a stateless transport and a new
// McpServer scoped to the authenticated workspace.
// Connected to: src/server.ts (McpServer with tool registrations)
// Connected to: src/middleware/auth.ts (dual-auth for /mcp)
// ============================================

import { serve } from "@hono/node-server";
import type { HttpBindings } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "./config.js";
import { createMcpServer } from "./server.js";
import { authMiddleware } from "./middleware/auth.js";
import { onError } from "./middleware/error-handler.js";
import type { AuthContext } from "./types/auth.js";

/** Hono app with typed env bindings and context variables */
type AppEnv = {
  Bindings: HttpBindings;
  Variables: {
    auth: AuthContext;
  };
};

const app = new Hono<AppEnv>();

// Global middleware
app.use(logger());
app.use("*", authMiddleware);

// Error handler
app.onError(onError);

// ── Health check (public, no auth) ──────────────────────────
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "shift-mcp",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

// ── MCP protocol endpoint (auth required) ───────────────────
app.post("/mcp", async (c) => {
  const auth = c.get("auth");

  // Create a fresh MCP server scoped to this workspace
  const server = createMcpServer(auth.workspaceId);

  // Stateless transport — no session tracking, one transport per request
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  // Get the raw Node.js objects from @hono/node-server
  const nodeReq = c.env.incoming;
  const nodeRes = c.env.outgoing;

  // Parse body and pass to transport to avoid re-reading the stream
  const body = await c.req.json();
  await transport.handleRequest(nodeReq, nodeRes, body);

  // Transport writes directly to nodeRes — return empty to prevent
  // Hono from writing additional data to the response
  return undefined as unknown as Response;
});

// ── Start server ────────────────────────────────────────────
const port = config.PORT;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Shift MCP Server running on port ${info.port}`);
});
