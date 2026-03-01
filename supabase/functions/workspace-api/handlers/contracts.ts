import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";

interface ContractRow {
  contract_id: string;
  profile_id: string;
  status: string;
  position_title: string;
  employment_category: string;
  employment_percentage: number;
  start_date: string;
  end_date: string | null;
  signed_at: string | null;
  created_at: string;
}

export async function handleGetContracts(
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
      "contracts:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: contracts:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const profileId = url.searchParams.get("profile_id");
  const status = url.searchParams.get("status");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  let query = `
    SELECT contract_id, profile_id, status, position_title,
           employment_category, employment_percentage,
           start_date, end_date, signed_at, created_at
    FROM employment_contract
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let idx = 2;

  if (profileId) {
    query += ` AND profile_id = $${idx}`;
    params.push(profileId);
    idx++;
  }
  if (status) {
    query += ` AND status = $${idx}`;
    params.push(status);
    idx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  // Intentionally excludes document_url and signature_id (sensitive fields)
  const rows = await executeWithWorkspaceContext<ContractRow>(auth.workspaceId, query, params);

  return jsonOk({ contracts: rows, limit, offset });
}
