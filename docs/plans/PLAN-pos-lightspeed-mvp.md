---
title: "Plan — pos-lightspeed-mvp (C1)"
status: draft
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [plan, pos, lightspeed, adapter, edge-function, capability, adr-0305]
---

# Plan — pos-lightspeed-mvp (C1)

> Branch: `feat/world-best-wfm-pos-lightspeed-mvp` | Worktree: /home/sxtnl/dev/smartout.ai-world-best-wfm-wt-1 | Base: `campaign/world-best-wfm` | Module: scheduler | Started: 2026-05-14

## Goal

Ship POS integration capability per ADR-0305. Mock Lightspeed adapter V1 (sandbox unavailable). Builds on PHASE 1 foundation: `pos_account` + `pos_sale_event` tables + `fn_pos_credentials_*` vault helpers + `public.v_pos_sales_hour` view + `pos_account_management` authority seed + 3 POS telemetry events all in foundation.

## Hard Constraints

- Migration timestamp floor: `> 20260615200100` (campaign sync tip). Probably no migrations needed V1 — schema in foundation.
- ADR-0287 single-call mutateWithGate; ADR-0151 server-derived identity; ADR-0099 one gate per write; ADR-0134 one emit per logical event.
- `pos.sale_event.ingested` emitted ONCE per sync run (not per row); event string EXACT `"pos.sale_event.ingested"`.
- ADR-0288 chat-only voice on connect/disconnect.
- ADR-0133 admin connect = Compose verb → web-only V1.
- Standalone Edge Function (cron) — WATCHDOG_CRON_SECRET bearer auth, verify_jwt=false per `daily-session-replenish` precedent.
- Mock adapter deterministic (same input = same output) for E2E replay.

## Tasks

### Task 0 — Pre-flight (per L-0190 family)

- [ ] `pnpm install` + `pnpm --filter @smartout/types build && pnpm --filter @smartout/telemetry build` (sibling pkg dist refresh).
- [ ] `pnpm turbo typecheck --filter=@smartout/ai` clean before edits.

### Task 1 — Mock Lightspeed adapter

- [ ] `packages/ai/src/adapters/pos/lightspeed.ts` (new `pos/` subdir under adapters)
- [ ] Export `pull(account, since): Promise<SaleEvent[]>` contract
- [ ] V1 mock: generates 5-15 deterministic sale events between `since` and `now` via `hash(workspace_id + sync_run_id)`. Fields: `vendor='lightspeed_kseries'`, `external_event_id=lk-${ws}-${ts}`, `occurred_at` random distribution, `gross_amount_minor` 10000-50000, `net_amount_minor` 80% of gross, `currency='NOK'`, `item_count` 1-5, `raw_payload {mock:true}`.
- [ ] `// MOCK V1 — real Lightspeed REST V2 ADR-0310` header
- [ ] Vitest 4 tests: deterministic, returns array, respects since filter, handles null since.

### Task 2 — `pos-sync` Edge Function

- [ ] `supabase/functions/pos-sync/index.ts` standalone
- [ ] Auth: WATCHDOG_CRON_SECRET bearer
- [ ] Add `[functions.pos-sync] verify_jwt = false` to `supabase/config.toml`
- [ ] Flow per account: resolve credentials → call adapter → INSERT pos_sale_event ON CONFLICT DO NOTHING → UPDATE pos_account.last_synced_at → emit `pos.sale_event.ingested` ONCE per account (NOT per row) with `{workspace_id, account_id, row_count, vendor}`.
- [ ] Vitest handler: 3 tests (happy, auth-fail, idempotent re-run).

### Task 3 — `pos_account_management` capability

- [ ] `packages/ai/src/capabilities/pos_account_management/` directory + register in registry + CapabilityName union.
- [ ] 3 tools (ADR-0287 single-call mutateWithGate):
  - `connect_lightspeed` (admin+, chat-only voice): Zod `{external_account_id, oauth_code}` (V1 mock). mutateWithGate → fn_pos_credentials_upsert → INSERT/UPDATE pos_account.status='active'. Emit `pos.account.connected`.
  - `disconnect` (admin+, chat-only): UPDATE pos_account.status='inactive'. Emit `pos.account.disconnected`.
  - `list_accounts` (admin+, read-only both channels, no mutateWithGate).
- [ ] Voice channel assertion: chat-only on write tools (copy `payroll/tools.ts:54-62` pattern).
- [ ] Vitest: 6 tests (happy + auth-fail per write tool + 2 list).

### Task 4 — Admin web UI `/dashboard/admin/pos-accounts`

- [ ] Read `smartout-nordic-split` skill before any UI.
- [ ] Server component `apps/web/src/app/dashboard/admin/pos-accounts/page.tsx` + client `_components/PosAccountsList.tsx`.
- [ ] UI: `font-heading` heading "POS Integrations" + table-style list (vendor + status badge + last_synced_at) + Connect Lightspeed modal (Lucide `Plug` icon) + glassmorphism empty state.
- [ ] Status badge via semantic CSS vars (`--color-success` active, `--color-muted` inactive).
- [ ] Motion: `motionTokens.spring` list enter, `motionTokens.springSnappy` button feedback.
- [ ] Server action / TanStack mutation calls capability tools via stage-engine path.

### Task 5 — E2E protocol P-pos-connect-and-sync

- [ ] `apps/e2e/protocols/p-pos-connect-and-sync.ts`
- [ ] Steps: connect via admin UI → assert pos_account row created → curl pos-sync with WATCHDOG_CRON_SECRET → assert pos_sale_event rows > 0 + `pos.sale_event.ingested` in activity_trail.
- [ ] Closes S8.

### Task 6 — Type regen + verification

- [ ] `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts` (no op run wrap per L-0op-run-corrupts; `2>/dev/null` per stderr trap).
- [ ] `pnpm turbo typecheck` 52/52 clean.
- [ ] `pnpm --filter @smartout/ai test`.
- [ ] Write `docs/HANDOFF-pos-lightspeed-mvp.md` + update decision log.

## Acceptance Criteria

- [ ] Tasks 0-6 atomic commits per task
- [ ] Typecheck 52/52
- [ ] Adapter + capability + EF tests green
- [ ] S8 E2E passes
- [ ] HANDOFF documents mock V1 + real Lightspeed V2 path

## Out of Scope (deferred V2)

- Real Lightspeed K-Series OAuth2 + REST integration
- Multi-vendor (Square / Toast / Onslip)
- POS data write-back
- Tip-pool (separate ADR)
- Mobile admin UI (ADR-0133 web-only)
