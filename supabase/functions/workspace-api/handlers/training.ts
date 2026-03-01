import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { type AuthContext } from "../../_shared/auth-middleware.ts";

function scopeGuard(scopes: string[], workspaceId: string, required: string): Response | null {
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

export async function handleGetProtocols(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "training:read");
  if (denied) return denied;

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const rows = await executeWithWorkspaceContext(
    auth.workspaceId,
    `SELECT protocol_id, policy_id, name, description, type,
            is_active, created_at
     FROM protocol
     WHERE workspace_id = $1
     ORDER BY name
     LIMIT $2 OFFSET $3`,
    [auth.workspaceId, limit, offset],
  );
  return jsonOk({ protocols: rows, limit, offset });
}

export async function handleGetAssignments(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  const denied = scopeGuard(auth.scopes, auth.workspaceId, "training:read");
  if (denied) return denied;

  const profileId = url.searchParams.get("profile_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  let query = `
    SELECT pa.assignment_id, pa.protocol_id, pa.profile_id,
           pa.status, pa.assigned_at, pa.completed_at,
           p.name AS protocol_name
    FROM protocol_assignment pa
    JOIN protocol p ON pa.protocol_id = p.protocol_id
    WHERE p.workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (profileId) {
    query += ` AND pa.profile_id = $${idx}`;
    params.push(profileId);
    idx++;
  }

  query += ` ORDER BY pa.assigned_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);
  return jsonOk({ assignments: rows, limit, offset });
}
