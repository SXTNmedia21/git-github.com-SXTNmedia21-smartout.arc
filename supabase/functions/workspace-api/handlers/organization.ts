import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { type AuthContext } from "../../_shared/auth-middleware.ts";

function scopeGuard(
  scopes: string[],
  workspaceId: string,
  required: string,
  cors: Record<string, string>,
): Response | null {
  const ctx: AuthContext = {
    method: "api_key",
    scopes,
    userId: null,
    workspaceId,
    keyId: null,
    rateLimitKey: "",
    rateLimitPerMinute: 0,
  };
  if (!requireScope(ctx, required)) {
    return new Response(JSON.stringify({ error: `Missing scope: ${required}` }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetDepartments(
  auth: { workspaceId: string; scopes: string[] },
  _url: URL,
  cors: Record<string, string>,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "profiles:read", cors);
  if (denied) return denied;

  const rows = await executeWithWorkspaceContext(
    auth.workspaceId,
    `SELECT department_id, name, description, is_active, created_at
     FROM department WHERE workspace_id = $1 ORDER BY name`,
    [auth.workspaceId],
  );
  return jsonOk({ departments: rows }, cors);
}

export async function handleGetTeams(
  auth: { workspaceId: string; scopes: string[] },
  _url: URL,
  cors: Record<string, string>,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "profiles:read", cors);
  if (denied) return denied;

  const rows = await executeWithWorkspaceContext(
    auth.workspaceId,
    `SELECT team_id, name, description, department_id,
            leader_profile_id, is_active, created_at
     FROM team WHERE workspace_id = $1 ORDER BY name`,
    [auth.workspaceId],
  );
  return jsonOk({ teams: rows }, cors);
}

export async function handleGetLocations(
  auth: { workspaceId: string; scopes: string[] },
  _url: URL,
  cors: Record<string, string>,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "profiles:read", cors);
  if (denied) return denied;

  const rows = await executeWithWorkspaceContext(
    auth.workspaceId,
    `SELECT location_id, name, address, city, postal_code,
            country, is_active, created_at
     FROM location WHERE workspace_id = $1 ORDER BY name`,
    [auth.workspaceId],
  );
  return jsonOk({ locations: rows }, cors);
}
