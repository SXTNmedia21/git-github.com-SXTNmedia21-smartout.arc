/**
 * guardian-actions — Admin REST API for signal management.
 *
 * JWT-authenticated. Validates user is admin/owner in signal's workspace.
 * Actions: acknowledge, resolve, dismiss.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// Inline Zod-like validation (Edge Functions don't always have Zod available)
// We use manual validation to stay dependency-light.

type ActionType = "acknowledge" | "resolve" | "dismiss";

const VALID_ACTIONS = new Set<string>(["acknowledge", "resolve", "dismiss"]);

interface ActionRequest {
  action: ActionType;
  signalId: string;
  resolution?: string;
  reason?: string;
  note?: string;
}

function validateRequest(
  body: unknown,
): { ok: true; data: ActionRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.action !== "string" || !VALID_ACTIONS.has(b.action)) {
    return { ok: false, error: `action must be one of: ${[...VALID_ACTIONS].join(", ")}` };
  }

  if (typeof b.signalId !== "string" || b.signalId.length < 10) {
    return { ok: false, error: "signalId must be a valid UUID string" };
  }

  if (b.resolution !== undefined && typeof b.resolution !== "string") {
    return { ok: false, error: "resolution must be a string" };
  }

  if (b.reason !== undefined && typeof b.reason !== "string") {
    return { ok: false, error: "reason must be a string" };
  }

  if (b.note !== undefined && typeof b.note !== "string") {
    return { ok: false, error: "note must be a string" };
  }

  return {
    ok: true,
    data: {
      action: b.action as ActionType,
      signalId: b.signalId as string,
      resolution: b.resolution as string | undefined,
      reason: b.reason as string | undefined,
      note: b.note as string | undefined,
    },
  };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 1. Authenticate via JWT
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // User client for auth
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const validation = validateRequest(body);
  if (!validation.ok) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { action, signalId, resolution, reason, note } = validation.data;

  // Service role client for data operations
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // 3. Fetch the signal
  const { data: signal, error: fetchErr } = await serviceClient
    .from("guardian_signal")
    .select("*")
    .eq("id", signalId)
    .single();

  if (fetchErr || !signal) {
    return new Response(JSON.stringify({ error: "Signal not found" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 4. Verify user is admin/owner in the signal's workspace
  const { data: profile, error: profileErr } = await serviceClient
    .from("profile")
    .select("profile_id, role")
    .eq("user_id", user.id)
    .eq("workspace_id", signal.workspace_id)
    .in("role", ["admin", "owner"])
    .eq("status", "active")
    .maybeSingle();

  if (profileErr || !profile) {
    return new Response(JSON.stringify({ error: "Forbidden: not an admin in this workspace" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 5. Apply the action
  const now = new Date().toISOString();
  let updateData: Record<string, unknown>;
  let logEventType: string;
  let logSummary: string;

  switch (action) {
    case "acknowledge":
      updateData = {
        status: "acknowledged",
        acknowledged_by: profile.profile_id,
        acknowledged_at: now,
        data: {
          ...((signal.data as Record<string, unknown>) ?? {}),
          acknowledged_note: note ?? null,
        },
      };
      logEventType = "guardian.signal_acknowledged";
      logSummary = `Signal "${signal.title}" acknowledged by ${profile.profile_id.slice(0, 8)}`;
      break;

    case "resolve":
      updateData = {
        status: "resolved",
        resolved_at: now,
        data: {
          ...((signal.data as Record<string, unknown>) ?? {}),
          resolution: resolution ?? null,
          resolved_by: profile.profile_id,
        },
      };
      logEventType = "guardian.signal_resolved";
      logSummary = `Signal "${signal.title}" resolved: ${resolution ?? "no details"}`;
      break;

    case "dismiss":
      updateData = {
        status: "dismissed",
        data: {
          ...((signal.data as Record<string, unknown>) ?? {}),
          dismiss_reason: reason ?? null,
          dismissed_by: profile.profile_id,
          dismissed_at: now,
        },
      };
      logEventType = "guardian.signal_dismissed";
      logSummary = `Signal "${signal.title}" dismissed: ${reason ?? "no reason given"}`;
      break;
  }

  // 6. Update signal
  const { data: updated, error: updateErr } = await serviceClient
    .from("guardian_signal")
    .update(updateData)
    .eq("id", signalId)
    .select()
    .single();

  if (updateErr) {
    return new Response(
      JSON.stringify({ error: `Failed to update signal: ${updateErr.message}` }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // 7. Create guardian_log entry
  await serviceClient.from("guardian_log").insert({
    workspace_id: signal.workspace_id,
    session_id: signal.entity_id ?? "00000000-0000-0000-0000-000000000000",
    event_type: logEventType,
    actor: "admin",
    summary: logSummary,
    data: {
      signal_id: signalId,
      action,
      profile_id: profile.profile_id,
      resolution,
      reason,
      note,
    },
  });

  return new Response(JSON.stringify({ status: "ok", signal: updated }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
