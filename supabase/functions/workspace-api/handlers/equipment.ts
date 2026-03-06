import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";

interface AssetRow {
  asset_id: string;
  location_id: string | null;
  department_id: string | null;
  name: string;
  description: string | null;
  asset_type: string;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  warranty_expires: string | null;
  requires_training: boolean;
  requires_routine: boolean;
  is_active: boolean;
  created_at: string;
}

interface AssetMaintenanceRow {
  maintenance_id: string;
  asset_id: string;
  maintenance_type: string;
  description: string | null;
  cost: number | null;
  performed_by: string | null;
  performed_at: string;
  next_scheduled: string | null;
  notes: string | null;
  created_at: string;
}

interface AssetDowntimeRow {
  downtime_id: string;
  asset_id: string;
  started_at: string;
  ended_at: string | null;
  reason: string | null;
  impact_description: string | null;
  estimated_revenue_impact: number | null;
  created_at: string;
}

export async function handleGetAssets(
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
      "equipment:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: equipment:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const query = `
    SELECT asset_id, location_id, department_id, name, description, asset_type,
           serial_number, manufacturer, model, purchase_date, purchase_cost,
           warranty_expires, requires_training, requires_routine, is_active, created_at
    FROM asset
    WHERE workspace_id = $1
    ORDER BY name ASC
    LIMIT $2 OFFSET $3
  `;

  const rows = await executeWithWorkspaceContext<AssetRow>(auth.workspaceId, query, [
    auth.workspaceId,
    limit,
    offset,
  ]);

  return jsonOk({ assets: rows, limit, offset });
}

export async function handleGetAssetMaintenance(
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
      "equipment:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: equipment:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  let query = `
    SELECT maintenance_id, asset_id, maintenance_type, description, cost,
           performed_by, performed_at, next_scheduled, notes, created_at
    FROM asset_maintenance
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  const assetId = url.searchParams.get("asset_id");
  if (assetId) {
    query += ` AND asset_id = $${paramIdx}`;
    params.push(assetId);
    paramIdx++;
  }

  query += ` ORDER BY performed_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext<AssetMaintenanceRow>(
    auth.workspaceId,
    query,
    params,
  );

  return jsonOk({ maintenance: rows, limit, offset });
}

export async function handleGetAssetDowntime(
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
      "equipment:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: equipment:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  let query = `
    SELECT downtime_id, asset_id, started_at, ended_at, reason,
           impact_description, estimated_revenue_impact, created_at
    FROM asset_downtime
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  const assetId = url.searchParams.get("asset_id");
  if (assetId) {
    query += ` AND asset_id = $${paramIdx}`;
    params.push(assetId);
    paramIdx++;
  }

  const activeOnly = url.searchParams.get("active_only");
  if (activeOnly === "true") {
    query += ` AND ended_at IS NULL`;
  }

  query += ` ORDER BY started_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext<AssetDowntimeRow>(auth.workspaceId, query, params);

  return jsonOk({ downtime: rows, limit, offset });
}
