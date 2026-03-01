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

const app = new Hono();

// Global middleware
app.use(logger());
app.use("*", authMiddleware);

// Error handler
app.onError(onError);

// Routes
app.route("/", health);

// Start server
const port = config.PORT;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Stage Engine running on port ${info.port}`);
});

export { app };
