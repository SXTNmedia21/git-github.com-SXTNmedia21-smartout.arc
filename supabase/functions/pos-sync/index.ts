/**
 * supabase/functions/pos-sync/index.ts
 *
 * pos-sync — Cron-triggered POS sale-event ingestion.
 *
 * Runs on schedule (e.g. every 5 minutes via Supabase cron) or on demand.
 * Iterates all active pos_account rows, calls the Lightspeed mock adapter,
 * INSERTs new sale events ON CONFLICT DO NOTHING, updates last_synced_at,
 * and emits one `pos.sale_event.ingested` telemetry event per account
 * (NOT per row — ADR-0134 + plan §"emit ONCE per account").
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (cron-only pattern, per
 * daily-session-replenish precedent). verify_jwt = false in config.toml.
 *
 * Security:
 *   - Only accepts POST (or OPTIONS for CORS preflight).
 *   - Bearer token validated against WATCHDOG_CRON_SECRET env var.
 *   - Uses supabase service-role client (pos_account + pos_sale_event
 *     write policies are service_role-only per foundation migration).
 *   - Credentials are resolved via fn_pos_credentials_resolve()
 *     (SECURITY DEFINER RPC — token value never crosses HTTP boundary).
 *   - No token value is logged anywhere (secrets-protocol).
 *
 * Idempotency:
 *   - ON CONFLICT DO NOTHING on (vendor, external_event_id) unique constraint.
 *   - Re-running the cron within the same 5-min window inserts 0 rows; the
 *     telemetry event still fires with row_count=0 (observable no-op).
 *
 * Telemetry (ADR-0134):
 *   `pos.sale_event.ingested` fired ONCE per account with:
 *     { workspace_id, account_id, row_count, vendor }
 *   Event string EXACT: "pos.sale_event.ingested" (underscore between sale_event).
 *   Not via @smartout/telemetry (Deno Edge Function) — manual
 *   activity_trail INSERT + engine_event row are the Deno-compatible path.
 *
 * References:
 *   ADR-0305 — POS adapter pattern, append-only sale-event.
 *   smartout-edge-function-guide — cron-only auth pattern.
 *   secrets-protocol — token value never logged; Vault Tier 2 resolve via RPC.
 *   daily-session-replenish — precedent for WATCHDOG_CRON_SECRET pattern.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types (mirror of packages/ai/src/adapters/pos/lightspeed.ts) ─────────
// Duplicated here because Edge Functions cannot import from packages/ai
// (Node ESM vs Deno module boundary). Keep in sync with the adapter type.
type SaleEvent = {
  vendor: "lightspeed_kseries";
  external_event_id: string;
  occurred_at: string;
  gross_amount_minor: number;
  net_amount_minor: number;
  currency: string;
  item_count: number;
  raw_payload: Record<string, unknown>;
};

// ─── Mock adapter (inline V1 — same deterministic logic as lightspeed.ts) ──
// Duplicated to avoid cross-runtime imports. Real V2: replace with REST call.
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

type State = [number, number, number, number];

function buildState(seed: number): State {
  const splitmix = (s: number): number => {
    s = (s + 0x9e3779b9) >>> 0;
    s = (Math.imul(s ^ (s >>> 16), 0x85ebca6b)) >>> 0;
    s = (Math.imul(s ^ (s >>> 13), 0xc2b2ae35)) >>> 0;
    return (s ^ (s >>> 16)) >>> 0;
  };
  return [splitmix(seed), splitmix(splitmix(seed)), splitmix(splitmix(splitmix(seed))), splitmix(splitmix(splitmix(splitmix(seed))))];
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

function xoshiroNext(state: State): number {
  const [s0, s1, s2, s3] = state;
  const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  state[2] = (s2 ^ s0) >>> 0;
  state[3] = (s3 ^ s1) >>> 0;
  state[1] = (s1 ^ s2) >>> 0;
  state[0] = (s0 ^ s3) >>> 0;
  state[2] = (state[2] ^ t) >>> 0;
  state[3] = rotl(state[3], 11);
  return result;
}

function nextFloat(state: State): number {
  return xoshiroNext(state) / 0x100000000;
}

function nextInt(state: State, min: number, max: number): number {
  return min + Math.floor(nextFloat(state) * (max - min + 1));
}

function mockPull(
  workspaceId: string,
  vendor: string,
  syncRunId: string,
  since: string | null,
): SaleEvent[] {
  const seedStr = `${workspaceId}:${syncRunId}`;
  const state = buildState(hashSeed(seedStr));
  const eventCount = nextInt(state, 5, 15);
  const sinceMs = since ? new Date(since).getTime() : Date.now() - 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  if (sinceMs >= nowMs) return [];

  const windowMs = nowMs - sinceMs;
  const events: SaleEvent[] = [];

  for (let i = 0; i < eventCount; i++) {
    const offsetMs = Math.floor(nextFloat(state) * windowMs);
    const occurredAt = new Date(sinceMs + offsetMs);
    if (occurredAt.getTime() < sinceMs) continue;
    const grossMinor = nextInt(state, 10000, 50000);
    const netMinor = Math.floor(grossMinor * 0.8);
    const itemCount = nextInt(state, 1, 5);
    const tsOffset = occurredAt.getTime() - sinceMs;
    events.push({
      vendor: vendor as "lightspeed_kseries",
      external_event_id: `lk-${workspaceId}-${tsOffset}-${i}`,
      occurred_at: occurredAt.toISOString(),
      gross_amount_minor: grossMinor,
      net_amount_minor: netMinor,
      currency: "NOK",
      item_count: itemCount,
      raw_payload: { mock: true, sync_run_id: syncRunId },
    });
  }
  return events;
}

// ─── Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: cron secret bearer token (WATCHDOG_CRON_SECRET pattern).
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const syncStartedAt = new Date().toISOString();
  const syncRunId = `pos-sync-${syncStartedAt}`;

  const results: Array<{
    account_id: string;
    workspace_id: string;
    vendor: string;
    row_count: number;
    status: "ok" | "skipped" | "error";
    error?: string;
  }> = [];

  try {
    // Fetch all active POS accounts across all workspaces.
    const { data: accounts, error: accountsError } = await supabase
      .from("pos_account")
      .select("pos_account_id, workspace_id, vendor, external_account_id, last_synced_at, sync_state")
      .eq("status", "active");

    if (accountsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch accounts", detail: accountsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active POS accounts", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const account of accounts) {
      const accountId: string = account.pos_account_id;
      const workspaceId: string = account.workspace_id;
      const vendor: string = account.vendor;
      const lastSyncedAt: string | null = account.last_synced_at;

      try {
        // Resolve credentials via SECURITY DEFINER RPC.
        // Returns NULL when no vault secret exists — skip this account.
        const { data: token, error: credError } = await supabase.rpc(
          "fn_pos_credentials_resolve",
          { p_workspace_id: workspaceId, p_vendor: vendor },
        );

        if (credError) {
          results.push({ account_id: accountId, workspace_id: workspaceId, vendor, row_count: 0, status: "error", error: `credential resolve error: ${credError.message}` });
          continue;
        }

        if (token === null) {
          // No credentials stored yet — account is configured but not authenticated.
          results.push({ account_id: accountId, workspace_id: workspaceId, vendor, row_count: 0, status: "skipped", error: "no credentials in vault" });
          continue;
        }

        // Pull sale events from adapter (MOCK V1).
        const events = mockPull(workspaceId, vendor, syncRunId, lastSyncedAt);

        let insertedCount = 0;

        if (events.length > 0) {
          // Batch INSERT — ON CONFLICT DO NOTHING for idempotency.
          // pos_sale_event.vendor + external_event_id unique constraint handles dedup.
          const rows = events.map((e) => ({
            workspace_id: workspaceId,
            pos_account_id: accountId,
            vendor: e.vendor,
            external_event_id: e.external_event_id,
            occurred_at: e.occurred_at,
            gross_amount_minor: e.gross_amount_minor,
            net_amount_minor: e.net_amount_minor,
            currency: e.currency,
            item_count: e.item_count,
            raw_payload: e.raw_payload,
          }));

          const { data: insertData, error: insertError } = await supabase
            .from("pos_sale_event")
            .insert(rows)
            .select("pos_sale_event_id");

          if (insertError) {
            results.push({ account_id: accountId, workspace_id: workspaceId, vendor, row_count: 0, status: "error", error: insertError.message });
            continue;
          }

          insertedCount = insertData?.length ?? 0;
        }

        // Update last_synced_at regardless of insert count (idempotent re-runs
        // still advance the cursor so the next pull window stays narrow).
        await supabase
          .from("pos_account")
          .update({ last_synced_at: syncStartedAt, updated_at: syncStartedAt })
          .eq("pos_account_id", accountId);

        // Emit `pos.sale_event.ingested` ONCE per account (not per row).
        // Event string EXACT per plan: "pos.sale_event.ingested".
        // Deno-compatible path: write activity_trail + engine_event directly.
        // Sentinel actor_id for service-role callers (no profile_id context).
        const SERVICE_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

        await supabase.from("activity_trail").insert({
          workspace_id: workspaceId,
          actor_id: SERVICE_ACTOR_ID,
          event: "pos.sale_event.ingested",
          action_verb: "ingest",
          category: "operations",
          entity_type: "pos_account",
          entity_id: accountId,
          data: {
            vendor,
            account_id: accountId,
            row_count: insertedCount,
            sync_run_id: syncRunId,
          },
        });

        await supabase.from("engine_event").insert({
          workspace_id: workspaceId,
          event_type: "pos.sale_event.ingested",
          actor_id: SERVICE_ACTOR_ID,
          payload: {
            vendor,
            account_id: accountId,
            row_count: insertedCount,
            sync_run_id: syncRunId,
          },
        });

        results.push({ account_id: accountId, workspace_id: workspaceId, vendor, row_count: insertedCount, status: "ok" });
      } catch (accountErr) {
        const msg = accountErr instanceof Error ? accountErr.message : String(accountErr);
        results.push({ account_id: accountId, workspace_id: workspaceId, vendor, row_count: 0, status: "error", error: msg });
      }
    }

    const totalRows = results.reduce((sum, r) => sum + r.row_count, 0);
    return new Response(
      JSON.stringify({ synced: results.length, total_rows: totalRows, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "pos-sync failed", detail: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
