/**
 * publish-birthday-celebrations — hourly pg_cron-triggered birthday auto-publish.
 *
 * Runs every hour UTC (cron: '0 * * * *') via pg_cron migration
 * `20260620141500_publish_birthday_celebrations_cron.sql`.
 *
 * Responsibilities:
 *   1. Verify WATCHDOG_CRON_SECRET bearer token — reject 401 on mismatch.
 *   2. Query workspaces where local time is [06:00, 07:00) AND auto_celebrate_birthdays=true
 *      AND target_channel_id IS NOT NULL.
 *   3. For each workspace: call fn_birthday_cohort_for_workspace(workspace_id, today).
 *   4. For each cohort member: call publish_announcement_atomic with kind='celebration',
 *      tier='social', actor = workspace's Botsson system profile.
 *   5. Emit dual telemetry: channel.message.sent (extended) + celebration.auto_published.
 *   6. Return JSON summary: { processed_workspaces, published_count, skipped_count, errors }.
 *
 * Auth: cron-only, WATCHDOG_CRON_SECRET bearer token — verify_jwt = false in config.toml.
 * Idempotency: publish_announcement_atomic celebration branch inserts into
 *   celebration_publication ON CONFLICT DO NOTHING — safe under retry.
 *
 * CANONICAL REF: ADR-0372 (bursdag auto-publish pipe).
 * MIRROR PATTERN: supabase/functions/note-fanout-scheduler/index.ts.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// Platform system actor — fallback when workspace has no Botsson profile.
// Mirrors the pattern from session-watchdog-demoter and journey-stuck-detector.
const PLATFORM_SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CohortRow = {
  profile_id: string;
  display_name: string;
};

type WorkspaceRow = {
  workspace_id: string;
  timezone: string;
  default_language: string;
  target_channel_id: string;
  botsson_system_profile_id: string | null;
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

  const correlationId = crypto.randomUUID();

  // ── 2. Supabase service-role client ─────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const nowUtc = new Date();

    // ── 3. Find workspaces in the 06:00–07:00 local window ───────────────
    // Query workspaces with:
    //   - auto_celebrate_birthdays = true
    //   - target_channel_id IS NOT NULL (L-0177: skip if no channel configured)
    //   - local time (now() AT TIME ZONE workspace.timezone) is in [06:00, 07:00)
    // Join workspace table for timezone + default_language.
    // Join profile to get the Botsson system actor for each workspace.
    const { data: eligibleWorkspaces, error: wsErr } = await supabase.rpc(
      "fn_birthday_eligible_workspaces",
      { p_now_utc: nowUtc.toISOString() },
    );

    // Fallback: if the helper RPC doesn't exist yet, use inline query.
    let workspaces: WorkspaceRow[] = [];

    if (wsErr) {
      // Inline fallback query (avoids RPC dependency — RPC can be added later).
      const { data: rows, error: queryErr } = await supabase
        .from("workspace_celebration_config")
        .select(
          `
          workspace_id,
          target_channel_id,
          workspace:workspace_id (
            timezone,
            default_language
          )
        `,
        )
        .eq("auto_celebrate_birthdays", true)
        .not("target_channel_id", "is", null);

      if (queryErr) {
        console.error(
          JSON.stringify({
            level: "error",
            action: "publish_birthday_celebrations",
            correlation_id: correlationId,
            error: queryErr.message,
            step: "fetch_eligible_workspaces",
          }),
        );
        return new Response(
          JSON.stringify({
            error: "Failed to fetch eligible workspaces",
            correlation_id: correlationId,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Filter to workspaces in the 06:00–07:00 local window.
      workspaces = (rows ?? [])
        .filter((row) => {
          const wsData = row.workspace as { timezone: string; default_language: string } | null;
          if (!wsData?.timezone) return false;
          try {
            const localHour = new Intl.DateTimeFormat("en", {
              timeZone: wsData.timezone,
              hour: "numeric",
              hour12: false,
            }).format(nowUtc);
            const h = parseInt(localHour, 10);
            return h === 6; // [06:00, 07:00)
          } catch {
            return false;
          }
        })
        .map((row) => {
          const wsData = row.workspace as { timezone: string; default_language: string } | null;
          return {
            workspace_id: row.workspace_id,
            timezone: wsData?.timezone ?? "Europe/Oslo",
            default_language: wsData?.default_language ?? "no",
            target_channel_id: row.target_channel_id!,
            botsson_system_profile_id: null, // resolved below per workspace
          };
        });
    } else {
      workspaces = eligibleWorkspaces ?? [];
    }

    if (workspaces.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No workspaces in birthday window",
          processed_workspaces: 0,
          published_count: 0,
          skipped_count: 0,
          correlation_id: correlationId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let totalPublished = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    // ── 4. Process each workspace ────────────────────────────────────────
    for (const ws of workspaces) {
      try {
        // Resolve Botsson system actor profile for this workspace.
        // Per ADR-0372 A1: dedicated system profile per workspace (role='system').
        const { data: sysProfile } = await supabase
          .from("profile")
          .select("profile_id")
          .eq("workspace_id", ws.workspace_id)
          .eq("role", "system")
          .limit(1)
          .maybeSingle();

        const actorProfileId = sysProfile?.profile_id ?? PLATFORM_SYSTEM_ACTOR_ID;

        // Compute today's date in the workspace's timezone.
        const todayLocal = new Intl.DateTimeFormat("sv-SE", {
          // sv-SE gives YYYY-MM-DD
          timeZone: ws.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(nowUtc);

        // ── 4a. Call GDPR-safe cohort resolver ──────────────────────────
        const { data: cohort, error: cohortErr } = await supabase.rpc(
          "fn_birthday_cohort_for_workspace",
          {
            p_workspace_id: ws.workspace_id,
            p_today: todayLocal,
          },
        );

        if (cohortErr) {
          errors.push(`workspace ${ws.workspace_id}: cohort error — ${cohortErr.message}`);
          console.error(
            JSON.stringify({
              level: "error",
              action: "publish_birthday_celebrations",
              correlation_id: correlationId,
              workspace_id: ws.workspace_id,
              error: cohortErr.message,
              step: "fn_birthday_cohort_for_workspace",
            }),
          );
          continue;
        }

        if (!cohort || cohort.length === 0) {
          // No birthdays today in this workspace — normal, no action needed.
          console.warn(
            JSON.stringify({
              level: "info",
              action: "publish_birthday_celebrations",
              correlation_id: correlationId,
              workspace_id: ws.workspace_id,
              message: "No birthdays today",
              today: todayLocal,
            }),
          );
          continue;
        }

        // ── 4b. Publish celebration for each cohort member ───────────────
        for (const member of cohort as CohortRow[]) {
          try {
            const { title, body } = buildBirthdayMessage(
              member.display_name,
              ws.default_language,
            );

            const content = `${title}\n${body}`;

            // Call publish_announcement_atomic celebration branch.
            // service-role client bypasses manager gate per v_is_service_role branch.
            const { data: messageId, error: publishErr } = await supabase.rpc(
              "publish_announcement_atomic",
              {
                p_workspace_id: ws.workspace_id,
                p_actor_profile_id: actorProfileId,
                p_channel_id: ws.target_channel_id,
                p_content: content,
                p_visibility_scope: "all_members",
                p_target_profile_ids: null,
                p_system_data: {
                  celebration_subtype: "birthday",
                  celebrated_profile_id: member.profile_id,
                },
                p_kind: "celebration",
                p_tier: "social",
                p_tags: ["birthday", "celebration"],
                p_linked_entity_type: "profile",
                p_linked_entity_id: member.profile_id,
                p_tier_overridden: false,
                p_client_message_id: crypto.randomUUID(),
                p_celebration_kind: "birthday",
                p_celebration_date: todayLocal,
              },
            );

            if (publishErr) {
              errors.push(
                `workspace ${ws.workspace_id} / profile ${member.profile_id}: publish error — ${publishErr.message}`,
              );
              console.error(
                JSON.stringify({
                  level: "error",
                  action: "publish_birthday_celebrations",
                  correlation_id: correlationId,
                  workspace_id: ws.workspace_id,
                  profile_id: member.profile_id,
                  error: publishErr.message,
                  step: "publish_announcement_atomic",
                }),
              );
              continue;
            }

            if (messageId === null) {
              // RPC returned NULL = skipped (already published or workspace disabled).
              totalSkipped++;
              console.warn(
                JSON.stringify({
                  level: "info",
                  action: "publish_birthday_celebrations",
                  correlation_id: correlationId,
                  workspace_id: ws.workspace_id,
                  profile_id: member.profile_id,
                  message: "Skipped (already published or workspace disabled)",
                }),
              );
              continue;
            }

            totalPublished++;

            // ── 4c. Emit dual telemetry ────────────────────────────────
            // 1. channel.message.sent (extended with celebration_subtype)
            await emitActivityTrail(supabase, {
              event: "channel.message.sent",
              action_verb: "sent",
              category: "communication",
              entity_type: "channel_message",
              entity_id: messageId,
              entity_label: title,
              actor_id: actorProfileId,
              workspace_id: ws.workspace_id,
              source: "edge-function",
              data: {
                channel_id: ws.target_channel_id,
                origin_type: "scheduler",
                message_type: "announcement",
                announcement_kind: "celebration",
                announcement_tier: "social",
                celebration_subtype: "birthday",
                profile_id: member.profile_id,
                correlation_id: correlationId,
              },
            });

            // 2. celebration.auto_published (analytics event)
            await emitActivityTrail(supabase, {
              event: "celebration.auto_published",
              action_verb: "published",
              category: "communication",
              entity_type: "channel_message",
              entity_id: messageId,
              entity_label: `Birthday celebration for ${member.display_name}`,
              actor_id: actorProfileId,
              workspace_id: ws.workspace_id,
              source: "edge-function",
              data: {
                workspace_id: ws.workspace_id,
                profile_id: member.profile_id,
                channel_id: ws.target_channel_id,
                message_id: messageId,
                celebration_subtype: "birthday",
                correlation_id: correlationId,
                published_at: nowUtc.toISOString(),
              },
            });

            console.warn(
              JSON.stringify({
                level: "info",
                action: "publish_birthday_celebrations",
                event: "celebration.auto_published",
                correlation_id: correlationId,
                workspace_id: ws.workspace_id,
                profile_id: member.profile_id,
                message_id: messageId,
                celebration_subtype: "birthday",
              }),
            );
          } catch (memberErr) {
            const msg = memberErr instanceof Error ? memberErr.message : String(memberErr);
            errors.push(
              `workspace ${ws.workspace_id} / profile ${member.profile_id}: ${msg}`,
            );
            console.error(
              JSON.stringify({
                level: "error",
                action: "publish_birthday_celebrations",
                correlation_id: correlationId,
                workspace_id: ws.workspace_id,
                profile_id: member.profile_id,
                error: msg,
                step: "per_member_processing",
              }),
            );
          }
        }
      } catch (wsErr) {
        const msg = wsErr instanceof Error ? wsErr.message : String(wsErr);
        errors.push(`workspace ${ws.workspace_id}: ${msg}`);
        console.error(
          JSON.stringify({
            level: "error",
            action: "publish_birthday_celebrations",
            correlation_id: correlationId,
            workspace_id: ws.workspace_id,
            error: msg,
            step: "per_workspace_processing",
          }),
        );
      }
    }

    // ── 5. Summary response ──────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        message: "Birthday celebrations processed",
        processed_workspaces: workspaces.length,
        published_count: totalPublished,
        skipped_count: totalSkipped,
        error_count: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        correlation_id: correlationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    // ── 6. Unhandled error ───────────────────────────────────────────────
    console.error(
      JSON.stringify({
        level: "error",
        action: "publish_birthday_celebrations",
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build localized birthday message title + body.
 * ADR-0372 Q7: i18n keys komm.celebration.birthday.{title,body}.
 * DOB never appears; age never derived; year-of-birth never exposed.
 */
function buildBirthdayMessage(
  displayName: string,
  language: string,
): { title: string; body: string } {
  // NOTE: Edge Functions cannot import @smartout/i18n package (Deno runtime).
  // Strings are inlined here mirroring the i18n keys registered in
  // packages/i18n/locales/{nb,en}/komm.json. Update both locations together.
  switch (language) {
    case "no":
    case "nb":
    case "nn":
      return {
        title: `Gratulerer med dagen, ${displayName}!`,
        body: `I dag har ${displayName} bursdag. Ta deg tid til å hilse.`,
      };
    default:
      // English fallback for sv, en, da, fi.
      return {
        title: `Happy birthday, ${displayName}!`,
        body: `Today is ${displayName}'s birthday. Take a moment to wish them well.`,
      };
  }
}

type ActivityTrailRow = {
  event: string;
  action_verb: string;
  category: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  actor_id: string;
  workspace_id: string;
  source: string;
  data: Record<string, unknown>;
};

/**
 * Write a row to activity_trail. Non-throwing: logs error but does not surface to caller.
 * ADR-0372 Q8 (telemetry) + ADR-0134 (every mutation emits).
 */
async function emitActivityTrail(
  // SupabaseClient from jsr:@supabase/supabase-js@2 — typed via import above.
  // The `from().insert()` call is duck-typed here since the full generic chain
  // diverges from what ESLint sees; we widen to unknown and narrow inline.
  supabase: ReturnType<typeof createClient>,
  row: ActivityTrailRow,
): Promise<void> {
  const { error } = await (supabase as unknown as { from(t: string): { insert(r: unknown): Promise<{ error: { message: string } | null }> } }).from("activity_trail").insert(row);
  if (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        action: "publish_birthday_celebrations",
        activity_trail_error: error.message,
        event: row.event,
        workspace_id: row.workspace_id,
      }),
    );
  }
}
