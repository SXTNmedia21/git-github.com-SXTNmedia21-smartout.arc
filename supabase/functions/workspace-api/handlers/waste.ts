import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";

interface WasteLogRow {
  waste_log_id: string;
  department_id: string | null;
  session_id: string | null;
  category: string;
  item_description: string;
  quantity: number;
  unit: string;
  estimated_cost: number | null;
  reason: string | null;
  recorded_by: string | null;
  recorded_at: string;
  created_at: string;
}

export async function handleGetWasteLogs(
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
      "waste:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: waste:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  let query = `
    SELECT waste_log_id, department_id, session_id, category, item_description,
           quantity, unit, estimated_cost, reason, recorded_by, recorded_at, created_at
    FROM waste_log
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  const category = url.searchParams.get("category");
  if (category) {
    query += ` AND category = $${paramIdx}`;
    params.push(category);
    paramIdx++;
  }

  const departmentId = url.searchParams.get("department_id");
  if (departmentId) {
    query += ` AND department_id = $${paramIdx}`;
    params.push(departmentId);
    paramIdx++;
  }

  const dateFrom = url.searchParams.get("date_from");
  if (dateFrom) {
    query += ` AND recorded_at >= $${paramIdx}`;
    params.push(dateFrom);
    paramIdx++;
  }

  const dateTo = url.searchParams.get("date_to");
  if (dateTo) {
    query += ` AND recorded_at <= $${paramIdx}`;
    params.push(dateTo);
    paramIdx++;
  }

  query += ` ORDER BY recorded_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext<WasteLogRow>(auth.workspaceId, query, params);

  return jsonOk({ waste_logs: rows, limit, offset });
}
