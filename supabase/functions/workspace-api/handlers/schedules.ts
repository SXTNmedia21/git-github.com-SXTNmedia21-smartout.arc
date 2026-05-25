import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";

export async function handleGetShifts(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
  cors: Record<string, string>,
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
      "schedules:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: schedules:read" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");
  const employeeId = url.searchParams.get("employee_id");
  const status = url.searchParams.get("status");

  let query = `
    SELECT schedule_shift_id, employee_id, position_id, team_id,
           shift_date, role, start_time, end_time, work_hours, breaks,
           day_category, status, is_published, zone, notes,
           created_at, updated_at
    FROM schedule_shift
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  if (dateFrom) {
    query += ` AND shift_date >= $${paramIdx}`;
    params.push(dateFrom);
    paramIdx++;
  }

  if (dateTo) {
    query += ` AND shift_date <= $${paramIdx}`;
    params.push(dateTo);
    paramIdx++;
  }

  if (employeeId) {
    query += ` AND employee_id = $${paramIdx}`;
    params.push(employeeId);
    paramIdx++;
  }

  if (status) {
    query += ` AND status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  query += ` ORDER BY shift_date DESC, start_time ASC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);

  return jsonOk({ shifts: rows, limit, offset }, cors);
}

export async function handleGetAbsences(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
  cors: Record<string, string>,
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
      "schedules:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: schedules:read" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const employeeId = url.searchParams.get("employee_id");
  const status = url.searchParams.get("status");

  let query = `
    SELECT schedule_absence_id, employee_id, shift_date, absence_type,
           request_type, reason, start_date, end_date, is_full_day,
           status, created_at, updated_at
    FROM schedule_absence
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  if (employeeId) {
    query += ` AND employee_id = $${paramIdx}`;
    params.push(employeeId);
    paramIdx++;
  }

  if (status) {
    query += ` AND status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

  query += ` ORDER BY start_date DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext(auth.workspaceId, query, params);

  return jsonOk({ absences: rows, limit, offset }, cors);
}
