import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";

interface SignalRow {
  id: string;
  signal_type: string;
  domain: string;
  severity: string;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  title: string;
  description: string | null;
  data: Record<string, unknown> | null;
  status: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface GuardianLogRow {
  id: string;
  session_id: string | null;
  event_type: string;
  actor: string;
  summary: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export async function handleGetSignals(
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
      "guardian:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: guardian:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const status = url.searchParams.get("status") ?? "active";
  const domain = url.searchParams.get("domain");
  const severity = url.searchParams.get("severity");

  let query = `
    SELECT id, signal_type, domain, severity, entity_type, entity_id,
           entity_label, title, description, data, status,
           acknowledged_at, resolved_at, expires_at, created_at, updated_at
    FROM guardian_signal
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  if (status !== "all") {
    query += ` AND status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }

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

  query += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext<SignalRow>(auth.workspaceId, query, params);

  return jsonOk({ signals: rows, limit, offset });
}

export async function handleGetGuardianLog(
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
      "guardian:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: guardian:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const eventType = url.searchParams.get("event_type");
  const since = url.searchParams.get("since");

  let query = `
    SELECT id, session_id, event_type, actor, summary, data, created_at
    FROM guardian_log
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  if (eventType) {
    query += ` AND event_type = $${paramIdx}`;
    params.push(eventType);
    paramIdx++;
  }

  if (since) {
    query += ` AND created_at >= $${paramIdx}`;
    params.push(since);
    paramIdx++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext<GuardianLogRow>(auth.workspaceId, query, params);

  return jsonOk({ guardian_log: rows, limit, offset });
}
