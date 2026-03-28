import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-middleware.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { executeWithWorkspaceContext, logUsage } from "../_shared/api-key-auth.ts";
import { requireScope } from "../_shared/scope-middleware.ts";

import { handleGetProfiles } from "./handlers/profiles.ts";
import {
  handleGetDepartments,
  handleGetTeams,
  handleGetLocations,
} from "./handlers/organization.ts";
import { handleGetContracts } from "./handlers/contracts.ts";
import { handleGetProtocols, handleGetAssignments } from "./handlers/training.ts";
import { handleGetShifts, handleGetAbsences } from "./handlers/schedules.ts";
import {
  handleGetShiftLockPolicy,
  handleSetShiftLockPolicy,
} from "./handlers/shift-lock-policy.ts";
import { handleGetSessions, handleGetDeviations } from "./handlers/operations.ts";
import {
  handleGetReconciliations,
  handleGetShiftApprovals,
  handleGetKpiTargets,
  handleGetBudgets,
} from "./handlers/reports.ts";
import { handleGetSignals, handleGetGuardianLog } from "./handlers/guardian.ts";
import { handleGetEvents } from "./handlers/events.ts";
import { handleGetSuppliers, handleGetSupplierOrders } from "./handlers/suppliers.ts";
import { handleGetWasteLogs } from "./handlers/waste.ts";
import {
  handleGetAssets,
  handleGetAssetMaintenance,
  handleGetAssetDowntime,
} from "./handlers/equipment.ts";

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
routes["GET /v1/contracts"] = handleGetContracts;
routes["GET /v1/protocols"] = handleGetProtocols;
routes["GET /v1/assignments"] = handleGetAssignments;
routes["GET /v1/shifts"] = handleGetShifts;
routes["GET /v1/absences"] = handleGetAbsences;
routes["GET /v1/shift-lock-policy"] = handleGetShiftLockPolicy;
routes["PUT /v1/shift-lock-policy"] = handleSetShiftLockPolicy;
routes["GET /v1/sessions"] = handleGetSessions;
routes["GET /v1/deviations"] = handleGetDeviations;
routes["GET /v1/reconciliations"] = handleGetReconciliations;
routes["GET /v1/shift-approvals"] = handleGetShiftApprovals;
routes["GET /v1/kpi-targets"] = handleGetKpiTargets;
routes["GET /v1/budgets"] = handleGetBudgets;
routes["GET /v1/signals"] = handleGetSignals;
routes["GET /v1/guardian-log"] = handleGetGuardianLog;
routes["GET /v1/events"] = handleGetEvents;
routes["GET /v1/suppliers"] = handleGetSuppliers;
routes["GET /v1/supplier-orders"] = handleGetSupplierOrders;
routes["GET /v1/waste-logs"] = handleGetWasteLogs;
routes["GET /v1/assets"] = handleGetAssets;
routes["GET /v1/asset-maintenance"] = handleGetAssetMaintenance;
routes["GET /v1/asset-downtime"] = handleGetAssetDowntime;

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

    // 3b. Environment check: test keys cannot access workspace-api in production
    const isProduction = Deno.env.get("ENVIRONMENT") === "production";
    if (auth.method === "api_key" && auth.environment === "test" && isProduction) {
      return jsonError(403, "Test keys cannot access production data. Use a live key.");
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
    const response = await handler({ workspaceId: auth.workspaceId, scopes: auth.scopes }, url);

    // 6. Fire-and-forget usage logging (only for API key auth, not JWT)
    if (auth.method === "api_key" && auth.keyId) {
      logUsage(auth.keyId, fnPath, response.status).catch(() => {});
    }

    return response;
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
