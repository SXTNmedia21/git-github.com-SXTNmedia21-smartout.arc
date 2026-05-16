/**
 * note-fanout-scheduler — pg_cron-triggered targeted note fanout handler.
 *
 * Runs every 5 minutes (every-5-min cron: "* /5 * * * *") via pg_cron migration
 * `<TS>_note_fanout_scheduler_cron.sql`.
 *
 * Responsibilities:
 *   1. Verify WATCHDOG_CRON_SECRET bearer token — reject 401 on mismatch.
 *   2. Query up to 100 pending targeted notes (notify_at <= now, delivered_at IS NULL).
 *   3. For each note: resolve audience JSONB → profile_ids[], emit notification_outbox
 *      rows, mark delivered_at idempotently.
 *   4. Emit `comm.scheduled_note.delivered` to activity_trail + logger per note.
 *   5. Return JSON summary: { processed, delivered, dangling_audience_count }.
 *
 * Auth: cron-only, WATCHDOG_CRON_SECRET bearer token — verify_jwt = false in config.toml.
 *
 * CANONICAL REF: ADR-0332 (pg_cron→Edge Function cadence + idempotency contract).
 * MIRROR PATTERN: supabase/functions/session-hook-executor/index.ts.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { resolveAudienceProfileIds } from "./audience-resolver.ts";
import type { NoteAudience } from "./audience-resolver.ts";

// Platform-actor UUID used when writing activity_trail from Edge Functions.
// Mirrors the pattern from session-watchdog-demoter and journey-stuck-detector.
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── 1. Bearer-token auth (cron-only — no JWT) ────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Correlation ID for log correlation across a single tick.
  const correlationId = crypto.randomUUID();

  // ── 2. Supabase service-role client ─────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── 3. Query pending targeted notes (partial index hit) ───────────────
    const { data: notes, error: fetchErr } = await supabase
      .from("session_note")
      .select(
        "id, workspace_id, audience, content, note_type, created_by, notify_at, department_session_id",
      )
      .lte("notify_at", new Date().toISOString())
      .is("delivered_at", null)
      .is("deleted_at", null)
      .eq("note_type", "targeted")
      .order("notify_at", { ascending: true })
      .limit(100);

    if (fetchErr) {
      console.error(
        JSON.stringify({
          level: "error",
          action: "note_fanout_scheduler",
          correlation_id: correlationId,
          error: fetchErr.message,
        }),
      );
      return new Response(
        JSON.stringify({ error: "Failed to fetch pending notes", correlation_id: correlationId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!notes || notes.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No pending notes",
          processed: 0,
          delivered: 0,
          dangling_audience_count: 0,
          correlation_id: correlationId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let delivered = 0;
    let totalDanglingCount = 0;

    // ── 4. Process each note sequentially (5-min cadence, not a hot path) ─
    for (const note of notes) {
      try {
        // ── 4a. Resolve audience JSONB → profile_ids[] ───────────────────
        const audience = (note.audience ?? {}) as NoteAudience;
        const { profileIds, danglingCount } = await resolveAudienceProfileIds(
          audience,
          note.workspace_id,
          supabase,
        );

        if (danglingCount > 0) {
          totalDanglingCount += danglingCount;
          console.warn(
            JSON.stringify({
              level: "warn",
              action: "note_fanout_scheduler",
              correlation_id: correlationId,
              note_id: note.id,
              workspace_id: note.workspace_id,
              dangling_count: danglingCount,
              message: "Some audience members no longer exist in workspace",
            }),
          );
        }

        // ── 4b. Idempotency guard: claim delivered_at before emitting ────
        // ADR-0332: UPDATE ... WHERE delivered_at IS NULL is the sole guard.
        // If 0 rows updated, another tick already processed — skip.
        const { data: claimed, error: claimErr } = await supabase
          .from("session_note")
          .update({ delivered_at: new Date().toISOString() })
          .eq("id", note.id)
          .is("delivered_at", null)
          .select("id");

        if (claimErr) {
          console.error(
            JSON.stringify({
              level: "error",
              action: "note_fanout_scheduler",
              correlation_id: correlationId,
              note_id: note.id,
              workspace_id: note.workspace_id,
              error: claimErr.message,
              step: "claim_delivered_at",
            }),
          );
          continue; // skip this note — next tick will retry
        }

        if (!claimed || claimed.length === 0) {
          // Another concurrent tick won the race — skip notification emit.
          console.warn(
            JSON.stringify({
              level: "info",
              action: "note_fanout_scheduler",
              correlation_id: correlationId,
              note_id: note.id,
              message: "double-fire prevented — delivered_at already set",
            }),
          );
          continue;
        }

        // ── 4c. Emit notification_outbox rows per recipient ───────────────
        // Using direct insert (Deno cannot import @smartout/notifications pkg).
        // Pattern mirrors how obligation-overdue-cron writes notification_outbox.
        const noteTitle = "📌 Notat";
        const noteBody =
          typeof note.content === "string" ? note.content.slice(0, 140) : "Nytt notat";
        const actionUrl = `/dashboard/communication/notes/${note.id}`;

        for (const recipientId of profileIds) {
          const { error: notifErr } = await supabase.from("notification_outbox").insert({
            workspace_id: note.workspace_id,
            recipient_id: recipientId,
            mode: "work",
            priority: 1,
            title: noteTitle,
            body: noteBody,
            action_url: actionUrl,
            allowed_channels: ["push", "in_app"],
            metadata: {
              event_key: "comm.scheduled_note.delivered",
              note_id: note.id,
              session_id: note.department_session_id,
              group_key: `note:${note.id}`,
              icon_type: "info",
            },
          });

          if (notifErr) {
            console.error(
              JSON.stringify({
                level: "error",
                action: "note_fanout_scheduler",
                correlation_id: correlationId,
                note_id: note.id,
                recipient_id: recipientId,
                workspace_id: note.workspace_id,
                error: notifErr.message,
                step: "notification_outbox_insert",
              }),
            );
            // Do not break — emit remaining recipients; partial delivery logged above.
          }
        }

        delivered++;

        // ── 4d. Emit comm.scheduled_note.delivered to activity_trail ──────
        // Telemetry registry destinations: activity_trail + logger (ADR-0332 § Consequences).
        const { error: trailErr } = await supabase.from("activity_trail").insert({
          event: "comm.scheduled_note.delivered",
          action_verb: "delivered",
          category: "communication",
          entity_type: "session_note",
          entity_id: note.id,
          entity_label: `Targeted note delivered to ${profileIds.length} recipient(s)`,
          actor_id: SYSTEM_ACTOR_ID,
          workspace_id: note.workspace_id,
          source: "edge-function",
          data: {
            note_id: note.id,
            workspace_id: note.workspace_id,
            recipient_count: profileIds.length,
            dangling_count: danglingCount,
            correlation_id: correlationId,
            delivered_at: new Date().toISOString(),
            automated: true,
          },
        });

        if (trailErr) {
          console.warn(
            JSON.stringify({
              level: "warn",
              action: "note_fanout_scheduler",
              correlation_id: correlationId,
              note_id: note.id,
              workspace_id: note.workspace_id,
              activity_trail_error: trailErr.message,
            }),
          );
        }

        // ── 4e. Structured logger (registry destination #2) ───────────────
        console.warn(
          JSON.stringify({
            level: "info",
            action: "note_fanout_scheduler",
            event: "comm.scheduled_note.delivered",
            correlation_id: correlationId,
            note_id: note.id,
            workspace_id: note.workspace_id,
            recipient_count: profileIds.length,
            dangling_count: danglingCount,
            activity_trail_ok: trailErr == null,
          }),
        );
      } catch (noteErr) {
        // Per-note error: log and continue so other notes still process.
        console.error(
          JSON.stringify({
            level: "error",
            action: "note_fanout_scheduler",
            correlation_id: correlationId,
            note_id: note.id,
            workspace_id: note.workspace_id,
            error: noteErr instanceof Error ? noteErr.message : String(noteErr),
            step: "per_note_processing",
          }),
        );
      }
    }

    // ── 5. Summary response ──────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        message: "Fanout complete",
        processed: notes.length,
        delivered,
        dangling_audience_count: totalDanglingCount,
        correlation_id: correlationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    // ── 6. Unhandled error ───────────────────────────────────────────────
    console.error(
      JSON.stringify({
        level: "error",
        action: "note_fanout_scheduler",
        correlation_id: correlationId,
        error: err instanceof Error ? err.message : String(err),
        step: "unhandled",
      }),
    );
    return new Response(
      JSON.stringify({ error: "Internal server error", correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
