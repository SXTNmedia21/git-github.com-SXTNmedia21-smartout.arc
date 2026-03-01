import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";

interface ProfileRow {
  profile_id: string;
  profile_code: string;
  display_name: string;
  role: string;
  status: string;
  is_active: boolean;
  job_title: string | null;
  employee_number: string | null;
  department_id: string | null;
  location_id: string | null;
  joined_at: string;
}

export async function handleGetProfiles(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  if (
    !requireScope(
      {
        method: "api_key",
        scopes: auth.scopes,
        userId: null,
        workspaceId: auth.workspaceId,
        keyId: null,
        rateLimitKey: "",
        rateLimitPerMinute: 0,
      },
      "profiles:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: profiles:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const status = url.searchParams.get("status");
  const isActive = url.searchParams.get("is_active");

  let query = `
    SELECT profile_id, profile_code, display_name, role, status,
           is_active, job_title, employee_number, department_id,
           location_id, joined_at
    FROM profile
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  if (status) {
    query += ` AND status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  if (isActive !== null && isActive !== undefined) {
    query += ` AND is_active = $${paramIdx}`;
    params.push(isActive === "true");
    paramIdx++;
  }

  query += ` ORDER BY display_name ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext<ProfileRow>(auth.workspaceId, query, params);

  return jsonOk({ profiles: rows, limit, offset });
}
