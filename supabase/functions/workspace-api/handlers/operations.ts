import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";

interface SessionRow {
  department_session_id: string;
  department_id: string;
  season_id: string | null;
  session_date: string;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  planned_shifts: number;
  actual_shifts: number;
  tasks_total: number;
  tasks_completed: number;
  signoff_notes: string | null;
  handoff_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DeviationRow {
  deviation_id: string;
  department_id: string;
  session_id: string | null;
  domain: string;
  subcategory: string | null;
  severity: string;
  title: string;
  description: string | null;
  cost_impact: number | null;
  linked_shift_id: string | null;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  blocks_day_approval: boolean;
  requires_action: boolean;
  payroll_impact: boolean;
  created_at: string;
  updated_at: string;
}

export async function handleGetSessions(
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
      "operations:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: operations:read" }), {
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
    SELECT department_session_id, department_id, season_id, session_date,
           status, opened_at, closed_at, planned_shifts, actual_shifts,
           tasks_total, tasks_completed, signoff_notes, handoff_notes,
           created_at, updated_at
    FROM department_session
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
    query += ` AND session_date >= $${paramIdx}`;
    params.push(dateFrom);
    paramIdx++;
  }

  if (dateTo) {
    query += ` AND session_date <= $${paramIdx}`;
    params.push(dateTo);
    paramIdx++;
  }

  query += ` ORDER BY session_date DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext<SessionRow>(auth.workspaceId, query, params);

  return jsonOk({ sessions: rows, limit, offset });
}

export async function handleGetDeviations(
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
      "operations:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: operations:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const domain = url.searchParams.get("domain");
  const severity = url.searchParams.get("severity");
  const status = url.searchParams.get("status");

  let query = `
    SELECT deviation_id, department_id, session_id, domain, subcategory,
           severity, title, description, cost_impact, linked_shift_id,
           status, resolution_notes, resolved_at, blocks_day_approval,
           requires_action, payroll_impact, created_at, updated_at
    FROM deviation
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  if (domain) {
    query += ` AND domain = $${paramIdx}`;
    params.push(domain);
    paramIdx++;
  }

  if (severity) {
    query += ` AND severity = $${paramIdx}`;
    params.push(severity);
    paramIdx++;
  }

  if (status) {
    query += ` AND status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext<DeviationRow>(auth.workspaceId, query, params);

  return jsonOk({ deviations: rows, limit, offset });
}
