import Fastify from "fastify";
import { config } from "./config.js";
import { loadSecrets } from "./secrets.js";
import { templateRoutes } from "./routes/templates.js";
import { syncRoutes } from "./routes/sync.js";
import { contractRoutes } from "./routes/contracts.js";
import { webhookRoutes } from "./routes/webhooks.js";

const app = Fastify({ logger: true });

// Decorate request with workspace context from API key validation
app.decorateRequest("workspaceId", undefined as string | undefined);

declare module "fastify" {
  interface FastifyRequest {
    workspaceId?: string;
  }
}

// Service key auth hook
app.addHook("onRequest", async (request, reply) => {
  // Skip auth for health check and webhooks
  if (request.url === "/health" || request.url.startsWith("/webhooks/")) return;

  const serviceKey = request.headers["x-service-key"] as string | undefined;
  if (!serviceKey) {
    return reply.status(401).send({ error: "Unauthorized: missing X-Service-Key" });
  }

  // Validate against Supabase platform_api_key table
  try {
    const res = await fetch(`${config.SUPABASE_URL}/functions/v1/validate-api-key`, {
      method: "POST",
      headers: {
        "x-api-key": serviceKey,
        "Content-Type": "application/json",
      },
    });

    // If Edge Function itself errored (5xx), fall back to env var check
    if (!res.ok && res.status >= 500) {
      if (serviceKey !== config.SERVICE_KEY) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      return;
    }

    const body = (await res.json()) as { valid: boolean; workspace_id?: string };
    if (!body.valid) {
      return reply.status(401).send({ error: "Unauthorized: invalid service key" });
    }
    // Attach workspace context for downstream use
    request.workspaceId = body.workspace_id;
  } catch {
    // Fallback: if validate-api-key is unreachable, check legacy env var
    if (serviceKey !== config.SERVICE_KEY) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
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
    // Load external API keys from Vault before starting the server
    await loadSecrets();
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    app.log.info(`Contract service running on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { app };
