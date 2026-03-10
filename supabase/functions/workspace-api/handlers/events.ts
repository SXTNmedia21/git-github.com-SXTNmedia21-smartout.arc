import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";

interface EventRow {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key: string | null;
  fired_at: string;
}

export async function handleGetEvents(
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
      "events:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: events:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const eventType = url.searchParams.get("event_type");
  const since = url.searchParams.get("since");

  let query = `
    SELECT id, event_type, payload, idempotency_key, fired_at
    FROM engine_event
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
    query += ` AND fired_at >= $${paramIdx}`;
    params.push(since);
    paramIdx++;
  }

  query += ` ORDER BY fired_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext<EventRow>(auth.workspaceId, query, params);

  return jsonOk({ events: rows, limit, offset });
}
