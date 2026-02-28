import Fastify from "fastify";
import { config } from "./config.js";
import { templateRoutes } from "./routes/templates.js";
import { syncRoutes } from "./routes/sync.js";
import { contractRoutes } from "./routes/contracts.js";
import { webhookRoutes } from "./routes/webhooks.js";

const app = Fastify({ logger: true });

// Service key auth hook
app.addHook("onRequest", async (request, reply) => {
  // Skip auth for health check and webhooks
  if (request.url === "/health" || request.url.startsWith("/webhooks/")) return;

  const serviceKey = request.headers["x-service-key"];
  if (serviceKey !== config.SERVICE_KEY) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
});

// Health check
app.get("/health", async () => ({
  status: "ok",
  service: "contract-service",
  timestamp: new Date().toISOString(),
}));

// Register routes
app.register(templateRoutes);
app.register(syncRoutes);
app.register(contractRoutes);
app.register(webhookRoutes);

// Start server
const start = async () => {
  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    app.log.info(`Contract service running on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { app };
