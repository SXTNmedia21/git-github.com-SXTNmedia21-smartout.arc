import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { corsHeaders } from "../../_shared/cors.ts";
import { jsonOk } from "../index.ts";

const ALLOWED_LOCK_MODES = new Set(["enforce", "shadow", "off"]);

/**
 * Returns the current temporal shift lock mode for the workspace.
 * If no explicit row exists, the DB default behavior is "enforce".
 */
export async function handleGetShiftLockPolicy(auth: {
  workspaceId: string;
  scopes: string[];
}): Promise<Response> {
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = await executeWithWorkspaceContext<{
    workspace_id: string;
    lock_mode: string;
    updated_at: string;
  }>(
    auth.workspaceId,
    `
      SELECT workspace_id, lock_mode, updated_at
      FROM schedule_shift_lock_policy
      WHERE workspace_id = $1
      LIMIT 1
    `,
    [auth.workspaceId],
  );

  if (rows.length === 0) {
    return jsonOk({
      shift_lock_policy: {
        workspace_id: auth.workspaceId,
        lock_mode: "enforce",
        source: "implicit_default",
      },
    });
  }

  return jsonOk({
    shift_lock_policy: {
      workspace_id: rows[0].workspace_id,
      lock_mode: rows[0].lock_mode,
      updated_at: rows[0].updated_at,
      source: "explicit_policy",
    },
  });
}

/**
 * Sets temporal shift lock mode for workspace.
 * Input contract: query param lock_mode=enforce|shadow|off.
 */
export async function handleSetShiftLockPolicy(
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
      "schedules:write",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: schedules:write" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const lockMode = (url.searchParams.get("lock_mode") ?? "").trim().toLowerCase();
  if (!ALLOWED_LOCK_MODES.has(lockMode)) {
    return new Response(
      JSON.stringify({
        error: "Invalid lock_mode. Allowed values: enforce, shadow, off",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const rows = await executeWithWorkspaceContext<{
    workspace_id: string;
    lock_mode: string;
    updated_at: string;
  }>(
    auth.workspaceId,
    `
      INSERT INTO schedule_shift_lock_policy (workspace_id, lock_mode)
      VALUES ($1, $2)
      ON CONFLICT (workspace_id)
      DO UPDATE
      SET lock_mode = EXCLUDED.lock_mode,
          updated_at = now()
      RETURNING workspace_id, lock_mode, updated_at
    `,
    [auth.workspaceId, lockMode],
  );

  return jsonOk({
    shift_lock_policy: {
      workspace_id: rows[0].workspace_id,
      lock_mode: rows[0].lock_mode,
      updated_at: rows[0].updated_at,
      source: "explicit_policy",
    },
  });
}
