import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-middleware.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { executeWithWorkspaceContext } from "../_shared/api-key-auth.ts";
import { requireScope } from "../_shared/scope-middleware.ts";

import { handleGetProfiles } from "./handlers/profiles.ts";
import {
import { handleGetContracts } from "./handlers/contracts.ts";
  handleGetDepartments,
  handleGetTeams,
  handleGetLocations,
} from "./handlers/organization.ts";

// ── Route handlers ──

type RouteHandler = (
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
) => Promise<Response>;

const routes: Record<string, RouteHandler> = {};

routes["GET /v1/profiles"] = handleGetProfiles;
routes["GET /v1/departments"] = handleGetDepartments;
routes["GET /v1/teams"] = handleGetTeams;
routes["GET /v1/locations"] = handleGetLocations;

// ── Main router ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate
    const auth = await resolveAuth(req);
    if (!auth) {
      return jsonError(401, "Invalid or missing API key");
    }

    // 2. Rate limit
    const rl = await checkRateLimit(auth.rateLimitKey, auth.rateLimitPerMinute);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rl.remaining),
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      });
    }

    // 3. Require workspace context (service keys without workspace_id cannot use data APIs)
    if (!auth.workspaceId) {
      return jsonError(
        400,
        "Workspace context required. Use a workspace API key, not a service key.",
      );
    }

    // 4. Route
    const url = new URL(req.url);
    // Extract path after /workspace-api (e.g., "/v1/profiles")
    const fnPath = url.pathname.replace(/^\/workspace-api/, "").replace(/\/$/, "") || "/";
    const routeKey = `${req.method} ${fnPath}`;

    const handler = routes[routeKey];
    if (!handler) {
      return jsonError(404, `Unknown endpoint: ${req.method} ${fnPath}`);
    }

    // 5. Execute handler
    return await handler({ workspaceId: auth.workspaceId, scopes: auth.scopes }, url);
  } catch (error: unknown) {
    console.error("[workspace-api]", error);
    return jsonError(500, "Internal server error");
  }
});

// ── Helpers ──

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export { routes, requireScope, executeWithWorkspaceContext };
