---
title: Journey — POS Lightspeed Mock V1 Connection
feature: world-best-wfm-pos-lightspeed-mvp
status: verified
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [journey, pos, lightspeed, admin, wfm]
---

# Journey — POS Lightspeed Mock V1 Connection

## Summary

Admins connect a Lightspeed POS account through the dashboard so that the system can ingest sale events on a scheduled cron cycle. A mock adapter (V1) generates deterministic sale events, enabling end-to-end validation before the real Lightspeed K-Series REST API is integrated. All write operations are web-only (ADR-0133 Compose verb) and chat-channel-only (ADR-0288), with identity derived server-side (ADR-0151) and a single mutateWithGate call per write (ADR-0287).

---

## Journey 1: Admin connects Lightspeed POS account

**Precondition:**
- User holds `admin` role in the workspace (ADR-0099 gate)
- Workspace is active with a valid `workspace_id`
- No existing `pos_account` row for vendor `lightspeed_kseries` in this workspace, OR existing row with `status='inactive'`
- Surface is web dashboard (voice channel rejected per ADR-0288; ADR-0133 web-only for Compose verbs)

**Steps:**

1. Admin navigates to `/dashboard/admin/pos-accounts`
   → Server component fetches `pos_account` rows for workspace via `list_pos_accounts` capability tool
   → Page renders: table of existing accounts (vendor + status badge + `last_synced_at`) + "Connect Lightspeed" button (Lucide `Plug` icon)

2. Admin clicks "Connect Lightspeed"
   → Modal opens with two fields: `external_account_id` (string) and `oauth_code` (string, V1 mock — real OAuth2 deferred to ADR-0310)

3. Admin fills in credentials and submits
   → Client fires TanStack mutation → BFF route `/api/botsson/pos/connect` (POST)
   → BFF resolves `workspace_id` and `profile_id` from JWT (server-derived, ADR-0151) — body-supplied values ignored
   → BFF calls stage-engine capability `connect_lightspeed` with `{external_account_id, oauth_code}`

4. Capability `connect_lightspeed` executes:
   → `assertChatChannel(ctx.channel ?? "chat")` — rejects if channel is `voice` (ADR-0288)
   → `assertAdminRole(ctx)` — rejects if caller is not admin+ (ADR-0099)
   → Single `mutateWithGate` call (ADR-0287):
     - Calls `fn_pos_credentials_upsert(workspace_id, vendor, external_account_id, oauth_code)` — stores credential in Vault column
     - `INSERT INTO pos_account (workspace_id, vendor, external_account_id, status) VALUES (..., 'lightspeed_kseries', ..., 'active') ON CONFLICT (workspace_id, vendor) DO UPDATE SET status='active', external_account_id=EXCLUDED.external_account_id`
   → Emits `pos.account.connected` event (ADR-0134 — once per logical action, never per row)

5. Mutation `onSuccess` callback fires on client
   → TanStack Query cache invalidated for `pos_account` list
   → Modal closes; table row for Lightspeed appears with status badge `active`

**Postcondition:**
- `pos_account` row exists with `status='active'`, `vendor='lightspeed_kseries'`, correct `workspace_id`
- Credential stored in Vault via `fn_pos_credentials_upsert`
- `pos.account.connected` event present in `activity_trail`
- `last_synced_at` is NULL (first sync has not yet run)

**Error paths:**
- Voice channel: `assertChatChannel` throws → 400 "This action is only available via chat" (ADR-0288)
- Non-admin caller: `assertAdminRole` throws → 403 "Insufficient permissions" (ADR-0099)
- `fn_pos_credentials_upsert` throws (e.g. Vault write failure): `mutateWithGate` rolls back the `pos_account` INSERT/UPDATE; client receives 500; toast shows "Tilkobling feilet — prøv igjen"
- Duplicate vendor already active: `ON CONFLICT DO UPDATE` updates credentials silently; client sees success

---

## Journey 2: Cron `pos-sync` ingests sale events

**Precondition:**
- At least one `pos_account` row with `status='active'` exists in any workspace
- `pos-sync` Edge Function deployed with `verify_jwt=false` and `WATCHDOG_CRON_SECRET` env set (per `supabase/config.toml [functions.pos-sync]`)
- Cron timer fires (external scheduler or manual curl trigger for testing)

**Steps:**

1. Cron caller sends `POST /functions/v1/pos-sync` with `Authorization: Bearer <WATCHDOG_CRON_SECRET>`
   → Edge Function validates bearer token against `WATCHDOG_CRON_SECRET` (no JWT validation — `verify_jwt=false` per `daily-session-replenish` precedent)
   → Rejects with 401 if token missing or mismatched

2. EF queries all `pos_account` rows where `status='active'`
   → For each account (loop per workspace):

3. EF calls `fn_pos_credentials_resolve(workspace_id, vendor)` to retrieve stored credential
   → If credentials missing or null: logs warning, skips account, continues loop (no throw)

4. EF calls `adapter.pull(account, since)` where `since = account.last_synced_at ?? epoch`
   → Mock adapter (`packages/ai/src/adapters/pos/lightspeed.ts`) generates 5–15 deterministic sale events using `hash(workspace_id + sync_run_id)`
   → Each event: `vendor='lightspeed_kseries'`, `external_event_id='lk-<ws>-<ts>'`, `occurred_at` (distributed between `since` and `now`), `gross_amount_minor` 10000–50000, `net_amount_minor` 80% of gross, `currency='NOK'`, `item_count` 1–5, `raw_payload={mock:true}`

5. EF bulk-inserts events:
   → `INSERT INTO pos_sale_event (...) VALUES (...) ON CONFLICT (workspace_id, vendor, external_event_id) DO NOTHING`
   → Idempotent: re-running the same cron window produces 0 new rows (conflict suppressed)

6. EF updates `pos_account.last_synced_at = now()` for the account

7. EF emits `pos.sale_event.ingested` ONCE per account (NOT per row) with payload `{workspace_id, account_id, row_count, vendor}`
   → ADR-0134: one logical event per sync run regardless of how many rows were inserted

8. After all accounts processed: EF returns `200 OK` with summary `{accounts_processed, total_rows_inserted}`

**Postcondition:**
- `pos_sale_event` rows present for each active account
- `pos_account.last_synced_at` updated to sync timestamp
- `pos.sale_event.ingested` event in `activity_trail` (one entry per account per run)
- `public.v_pos_sales_hour` view aggregates the new rows (hourly buckets for WFM demand signal)

**Error paths:**
- Missing `WATCHDOG_CRON_SECRET` or mismatched bearer: 401, sync aborted entirely
- `fn_pos_credentials_resolve` returns null for an account: log `WARN pos-sync: no credentials for account <id>`, skip account, continue to next
- `adapter.pull` throws: log error, skip account, continue — partial success is acceptable; retry at next cron cycle
- DB insert fails (constraint other than conflict): log error, skip account, do NOT emit `pos.sale_event.ingested` for that account

---

## Journey 3: Admin disconnects POS account

**Precondition:**
- `pos_account` row exists with `status='active'` for the workspace
- Admin is authenticated on web dashboard (chat channel; web surface)

**Steps:**

1. Admin navigates to `/dashboard/admin/pos-accounts`
   → Table shows account row with `status='active'` badge and a "Disconnect" action

2. Admin clicks "Disconnect" → confirmation dialog
   → On confirm: TanStack mutation → BFF → capability `disconnect_pos_account`

3. Capability `disconnect_pos_account` executes:
   → `assertChatChannel(ctx.channel ?? "chat")` — rejects voice (ADR-0288)
   → `assertAdminRole(ctx)` — rejects non-admin (ADR-0099)
   → `mutateWithGate` (ADR-0287):
     - `UPDATE pos_account SET status='inactive' WHERE workspace_id=? AND vendor=?`
     - Historical `pos_sale_event` rows are preserved (append-only; no DELETE)
   → Emits `pos.account.disconnected`

4. Mutation `onSuccess`: cache invalidated → table refreshes → row shows `status='inactive'` badge

**Postcondition:**
- `pos_account.status = 'inactive'`
- All historical `pos_sale_event` rows intact (no data loss)
- `pos.account.disconnected` in `activity_trail`
- Next cron run skips this account (active-only filter)

**Error paths:**
- Voice channel or non-admin: same guard pattern as Journey 1
- Account already inactive: `UPDATE` is a no-op; capability returns success (idempotent)
