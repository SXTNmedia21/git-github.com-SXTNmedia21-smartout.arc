/**
 * payroll-period-locked-handler — SMA-347
 *
 * Engine-internal Edge Function. Called by engine_dispatch (or the
 * snapshot-period-costs / export-period BFF route) when a payroll period
 * transitions to 'locked'.
 *
 * Responsibility: INSERT one notification_outbox row per affected profile
 * so the process-notifications cron delivers a push/in-app notification.
 *
 * Auth: verify_jwt = false. Accepts service-role key or WATCHDOG_CRON_SECRET
 * Bearer token via _shared/internal-auth.ts.
 *
 * Payload (JSON body):
 *   workspace_id         string  (UUID)
 *   period_id            string  (UUID of payroll.payroll_period)
 *   period_label         string  (display label, e.g. "mai 2026")
 *   affected_profile_ids string[] (UUIDs of profiles to notify)
 *
 * Response 200: { dispatched: number, skipped: number }
 * Response 400: { error: string }
 * Response 500: { error: string, details?: string }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyInternalAuth } from "../_shared/internal-auth.ts";
import { handlePeriodLocked } from "./handler.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Payload Validation ──────────────────────────────────────────
// Zod is not available in Deno without an explicit import map entry.
// We use a lightweight manual validator to keep the function
// self-contained (no import-map changes needed).

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((e) => typeof e === "string");
}

type ValidatedPayload = {
  workspace_id: string;
  period_id: string;
  period_label: string;
  affected_profile_ids: string[];
};

function validatePayload(
  body: unknown,
): { ok: true; payload: ValidatedPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.workspace_id)) {
    return { ok: false, error: "workspace_id is required (non-empty string)" };
  }
  if (!isNonEmptyString(b.period_id)) {
    return { ok: false, error: "period_id is required (non-empty string)" };
  }
  if (!isNonEmptyString(b.period_label)) {
    return { ok: false, error: "period_label is required (non-empty string)" };
  }
  if (!isStringArray(b.affected_profile_ids)) {
    return {
      ok: false,
      error: "affected_profile_ids must be an array of strings",
    };
  }

  return {
    ok: true,
    payload: {
      workspace_id: b.workspace_id,
      period_id: b.period_id,
      period_label: b.period_label,
      affected_profile_ids: b.affected_profile_ids,
    },
  };
}

// ─── Entry Point ─────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only POST is supported
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Internal auth guard — service-role key or cron secret
  const authCheck = verifyInternalAuth(req);
  if (!authCheck.ok) return authCheck.response;

  // Parse + validate body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validation = validatePayload(rawBody);
  if (!validation.ok) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { workspace_id, period_id, period_label, affected_profile_ids } =
    validation.payload;

  // Service-role Supabase client for notification_outbox INSERT.
  // notification_outbox is workspace-scoped; service role bypasses RLS
  // for platform-authority writes (same pattern as engine-dispatch,
  // obligation-due-soon-cron, contract-lifecycle).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const result = await handlePeriodLocked({
      workspaceId: workspace_id,
      periodId: period_id,
      periodLabel: period_label,
      affectedProfileIds: affected_profile_ids,
      supabase: supabase as unknown as Parameters<typeof handlePeriodLocked>[0]["supabase"],
    });

    if (result.errors.length > 0) {
      console.error(
        "[payroll-period-locked-handler] handler errors:",
        result.errors,
      );
      return new Response(
        JSON.stringify({
          error: "Notification insert failed",
          details: result.errors[0],
          dispatched: result.dispatched,
          skipped: result.skipped,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        dispatched: result.dispatched,
        skipped: result.skipped,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[payroll-period-locked-handler] unexpected error:", message);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
