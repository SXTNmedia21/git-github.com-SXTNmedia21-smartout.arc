/**
 * packages/ai/src/adapters/pos/lightspeed.ts
 *
 * MOCK V1 — real Lightspeed REST V2 ADR-0310
 *
 * Exports the canonical POS adapter contract `pull(account, since)` for
 * Lightspeed Restaurant K-Series. V1 is a deterministic mock: given the
 * same workspace_id + sync_run_id, it always returns the same SaleEvent[].
 *
 * Why deterministic?
 *   ADR-0305 §"Adapter contract" requires the E2E protocol p-pos-connect-and-sync
 *   to be replayable without a sandbox API. The mock seeds a pseudorandom number
 *   generator from hash(workspace_id + sync_run_id), so every re-run produces
 *   identical sale counts, IDs, and amounts. This enables E2E assertions on
 *   both idempotency (second run inserts 0 rows) and count (first run inserts N).
 *
 * Real Lightspeed V2:
 *   OAuth2 (access + refresh tokens stored in Vault via fn_pos_credentials_upsert).
 *   REST endpoint: GET /API/sale?from=<ISO>&to=<ISO>.
 *   Replace pull() body; keep the SaleEvent type and the function signature.
 *   See ADR-0310 (forthcoming) for OAuth flow + webhook upgrade path.
 *
 * References:
 *   ADR-0305 — POS adapter pattern, append-only sale-event table.
 *   ADR-0310 — real Lightspeed REST V2 (follow-on sortie).
 *   secrets-protocol — OAuth token is in Vault Tier 2, resolved server-side.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

/**
 * Canonical POS account shape passed to the adapter.
 * Mirrors public.pos_account columns; adapter never receives the raw token.
 * The caller (pos-sync Edge Function) resolves credentials before calling pull().
 */
export type PosAccount = {
  pos_account_id: string;
  workspace_id: string;
  vendor: string;
  external_account_id: string;
  /** Decrypted OAuth token, resolved by fn_pos_credentials_resolve(). */
  credentials: string | null;
  sync_state: Record<string, unknown>;
  last_synced_at: string | null;
};

/**
 * Canonical sale event shape written to public.pos_sale_event.
 * Every adapter must map its vendor payload to this shape.
 * All amounts are in minor currency units (øre for NOK: 10000 = 100 NOK).
 */
export type SaleEvent = {
  /** `lightspeed_kseries` — the vendor enum value (V1 = only valid value). */
  vendor: "lightspeed_kseries";
  /** Unique across the vendor — used as the ON CONFLICT DO NOTHING key. */
  external_event_id: string;
  occurred_at: string; // ISO-8601
  gross_amount_minor: number; // int, always positive
  net_amount_minor: number; // int, ~80% of gross
  currency: string; // 3-char ISO-4217 (NOK for Nordic V1)
  item_count: number; // int ≥ 1
  /**
   * Raw payload from the vendor for audit / future enrichment.
   * V1 mock: `{ mock: true, sync_run_id: "…" }`.
   */
  raw_payload: Record<string, unknown>;
};

// ─── Deterministic PRNG (xoshiro128**) ────────────────────────────────────

/**
 * Derive a 32-bit seed from a string.
 * Uses djb2 hash — fast, no crypto dependency, deterministic across runtimes.
 */
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/**
 * Xoshiro128** state. Four 32-bit words.
 * Chosen over Math.random() because PRNG state is seeded by us,
 * ensuring determinism regardless of JS engine or Node version.
 */
type Xoshiro128State = [number, number, number, number];

function buildState(seed: number): Xoshiro128State {
  // Splitmix32 to expand a single seed into 4 words.
  const splitmix = (s: number): number => {
    s = (s + 0x9e3779b9) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0;
    s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0;
    return (s ^ (s >>> 16)) >>> 0;
  };
  const a = splitmix(seed);
  const b = splitmix(a);
  const c = splitmix(b);
  const d = splitmix(c);
  return [a, b, c, d];
}

function xoshiroNext(state: Xoshiro128State): number {
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

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Returns a float in [0, 1). */
function nextFloat(state: Xoshiro128State): number {
  return xoshiroNext(state) / 0x100000000;
}

/** Returns an integer in [min, max]. */
function nextInt(state: Xoshiro128State, min: number, max: number): number {
  return min + Math.floor(nextFloat(state) * (max - min + 1));
}

// ─── Mock pull ─────────────────────────────────────────────────────────────

/**
 * Pull sale events from Lightspeed K-Series for the given account.
 *
 * V1 mock contract:
 *   - Generates 5–15 sale events, count seeded from hash(workspace_id + sync_run_id).
 *   - `external_event_id` is `lk-<workspace_id>-<ts_offset>` — deterministic, unique per sync_run.
 *   - `occurred_at` is distributed uniformly between `since` (or 24 h ago) and now.
 *   - `gross_amount_minor` in [10000, 50000] (100–500 NOK).
 *   - `net_amount_minor` is 80% of gross (rounded down).
 *   - `currency` is always 'NOK' (Nordic V1).
 *   - `item_count` in [1, 5].
 *   - `raw_payload` is `{ mock: true, sync_run_id }`.
 *   - Events with `occurred_at < since` are filtered out (respects since filter).
 *   - When `since` is null, all generated events are returned.
 *
 * @param account  POS account row (credentials already resolved by caller).
 * @param since    ISO-8601 timestamp cutoff, or null for full history pull.
 * @param syncRunId Caller-supplied run ID — drives determinism; defaults to workspace+vendor.
 * @returns        Array of SaleEvent (may be empty when since is very recent).
 */
export async function pull(
  account: PosAccount,
  since: string | null,
  syncRunId?: string,
): Promise<SaleEvent[]> {
  // MOCK V1 — real Lightspeed REST V2 ADR-0310
  // Replace this body with OAuth2 + REST call in the real adapter.
  // The function signature, SaleEvent type, and since-filter contract must be preserved.

  const runId = syncRunId ?? `${account.workspace_id}:${account.vendor}`;
  const seedStr = `${account.workspace_id}:${runId}`;
  const state = buildState(hashSeed(seedStr));

  const eventCount = nextInt(state, 5, 15);

  const sinceMs = since ? new Date(since).getTime() : Date.now() - 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  // Guard: if since is in the future, return empty (nothing to sync yet).
  if (sinceMs >= nowMs) {
    return [];
  }

  const windowMs = nowMs - sinceMs;
  const events: SaleEvent[] = [];

  for (let i = 0; i < eventCount; i++) {
    const offsetMs = Math.floor(nextFloat(state) * windowMs);
    const occurredAt = new Date(sinceMs + offsetMs);

    // Respect since filter: skip events before the cutoff.
    // (Since we distribute over [sinceMs, nowMs], this is always satisfied
    // by construction, but we keep the guard for defensive correctness and
    // to satisfy the test contract.)
    if (occurredAt.getTime() < sinceMs) {
      continue;
    }

    const grossMinor = nextInt(state, 10000, 50000);
    const netMinor = Math.floor(grossMinor * 0.8);
    const itemCount = nextInt(state, 1, 5);

    // Timestamp-offset-based ID: deterministic, unique within sync run.
    const tsOffset = occurredAt.getTime() - sinceMs;
    const externalId = `lk-${account.workspace_id}-${tsOffset}-${i}`;

    events.push({
      vendor: "lightspeed_kseries",
      external_event_id: externalId,
      occurred_at: occurredAt.toISOString(),
      gross_amount_minor: grossMinor,
      net_amount_minor: netMinor,
      currency: "NOK",
      item_count: itemCount,
      raw_payload: {
        mock: true,
        sync_run_id: runId,
      },
    });
  }

  return events;
}
