import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";

export async function handleGetReconciliations(
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
      "reports:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: reports:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const departmentId = url.searchParams.get("department_id");
  const status = url.searchParams.get("status");
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");

  let query = `
    SELECT reconciliation_id, department_id, session_id, reconciliation_date,
           status, settled_at, approved_at, revenue_total, revenue_card,
           revenue_cash, revenue_vat, revenue_transactions, revenue_source,
           total_planned_hours, total_actual_hours, total_labor_cost,
           revenue_per_worked_hour, labor_percentage, created_at, updated_at
    FROM daily_reconciliation
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  if (departmentId) {
    query += ` AND department_id = $${paramIdx}`;
    params.push(departmentId);
    paramIdx++;
  }

  if (status) {
    query += ` AND status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  if (dateFrom) {
    query += ` AND reconciliation_date >= $${paramIdx}`;
    params.push(dateFrom);
    paramIdx++;
  }

  if (dateTo) {
    query += ` AND reconciliation_date <= $${paramIdx}`;
    params.push(dateTo);
    paramIdx++;
  }

  query += ` ORDER BY reconciliation_date DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);

  return jsonOk({ reconciliations: rows, limit, offset });
}

export async function handleGetShiftApprovals(
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
      "reports:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: reports:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const reconciliationId = url.searchParams.get("reconciliation_id");
  const status = url.searchParams.get("status");

  let query = `
    SELECT approval_id, reconciliation_id, shift_id, punch_in, punch_out,
           planned_hours, calculated_hours, approved_hours, status,
           edit_justification, approved_by, approved_at, created_at, updated_at
    FROM shift_approval
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  if (reconciliationId) {
    query += ` AND reconciliation_id = $${paramIdx}`;
    params.push(reconciliationId);
    paramIdx++;
  }

  if (status) {
    query += ` AND status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);

  return jsonOk({ shift_approvals: rows, limit, offset });
}

export async function handleGetKpiTargets(
  auth: { workspaceId: string; scopes: string[] },
  _url: URL,
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
      "reports:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: reports:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const query = `
    SELECT id, metric, target_value, benchmark_value, created_at, updated_at
    FROM workspace_kpi_target
    WHERE workspace_id = $1
  `;

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, [auth.workspaceId]);

  return jsonOk({ kpi_targets: rows });
}

export async function handleGetBudgets(
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
      "reports:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: reports:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");

  let query = `
    SELECT id, location_id, department_id, period_type, period_date,
           hour_slot, revenue_target, labor_cost_target, labor_hours_target,
           currency, notes, created_at, updated_at
    FROM workspace_budget
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  if (dateFrom) {
    query += ` AND period_date >= $${paramIdx}`;
    params.push(dateFrom);
    paramIdx++;
  }

  if (dateTo) {
    query += ` AND period_date <= $${paramIdx}`;
    params.push(dateTo);
    paramIdx++;
  }

  query += ` ORDER BY period_date DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);

  return jsonOk({ budgets: rows, limit, offset });
}
