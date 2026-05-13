---
title: "Handoff — audit-webhook-hygiene"
feature: audit-webhook-hygiene
status: done
created: 2026-05-13
updated: 2026-05-14
module: cross-cutting
tags: [handoff, webhook, security, idempotency, f-wh-01, f-wh-02, f-wh-03, f-wh-04]
---

# Handoff — audit-webhook-hygiene

Branch: `feat/audit-webhook-hygiene` | Worktree: `~/dev/smartout.ai-wt-9`

## What Was Built

Webhook hygiene sweep — 4 security/reliability findings from the 2026-05-13 full audit (slice 13, `13-webhook-integration.md`) are now closed.

## Findings Closed

### F-WH-01 — docuseal 500 body no longer leaks raw DB error
- **File:** `apps/web/src/app/api/webhooks/docuseal/route.ts:217`
- **Fix:** `if (updateError)` block now logs via `console.error` server-side and responds with `{ "error": "internal" }` instead of `{ "error": updateError.message }`.
- **Test:** 4 Vitest cases in `apps/web/src/app/api/webhooks/docuseal/__tests__/route.test.ts` — (a) 500 body is `{ error: "internal" }`, (b) raw PG message absent from body, (c) happy path 200, (d) missing signature 401. All pass.

### F-WH-02 — livekit-webhook fails-closed on missing env vars
- **File:** `supabase/functions/livekit-webhook/index.ts`
- **Fix:** Explicit null-check on `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` at handler entry. Returns 500 with `{ "error": "missing config" }`. Env var names only in `console.error`, never in response body. `WebhookReceiver` constructed from named vars (no `!` assertion fallback).
- **Test:** Deno source-parse test in `supabase/functions/livekit-webhook/hygiene_test.ts` — 4 assertions: guard before receiver construction, no env names in response body vicinity, call_log uses `.upsert()`, no bare `.insert()` in room_finished section.

### F-WH-03 — sendgrid open/click counter is now idempotent
- **File:** `supabase/functions/sendgrid-webhook/index.ts`
- **Fix:** For `open`/`click` events:
  - Events without `sg_message_id`: `console.warn` + `continue` — event still logged to `platform_webhook_event` for audit, but counter RPC skipped.
  - Events WITH `sg_message_id`: upsert the webhook event row first with `count: "exact"`. If `count === 0` (duplicate delivery), `continue` without running `increment_communication_counter`. Counter only fires for new-event deliveries.
- **No schema change needed**: the partial UNIQUE index `platform_webhook_event_provider_sg_msg_id_key` was already in place from migration `20260520150000`.
- **Test:** Deno source-parse test in `supabase/functions/sendgrid-webhook/hygiene_test.ts` — 4 assertions: `isCounterEvent` guard present, missing-sg_message_id path has `continue`, `isNewEvent` gates counter, `count: "exact"` present in upsert.

### F-WH-04 — call_log is replay-safe via UNIQUE constraint
- **Migration:** `supabase/migrations/20260611100000_call_log_unique_session.sql`
  - Defensive dedup of any pre-existing duplicates (keeps first row by `created_at`)
  - `ALTER TABLE call_log ADD CONSTRAINT call_log_call_session_id_key UNIQUE (call_session_id)`
- **Handler:** `supabase/functions/livekit-webhook/index.ts` — `room_finished` case uses `.upsert({...}, { onConflict: "call_session_id", ignoreDuplicates: true })` instead of bare `.insert()`.
- **Test:** Covered by livekit hygiene_test.ts cases (F-WH-04 section).

## Decisions Made

None requiring new ADR — fixes are mechanical (opaque error, env guard, dedup gate, UNIQUE constraint). No new idempotency contract patterns beyond what already exists in the codebase. No council escalation triggered.

## Learnings

- **F-WH-03 trap:** The partial UNIQUE index on `platform_webhook_event` was already present, but it only dedupes the audit log row at the END of the handler. Counter mutations ran FIRST in the per-event loop. The fix inverts the order: upsert-first to establish whether the event is new, then conditionally run the counter.
- **Deno test pattern:** Edge Functions cannot be imported into Vitest (Deno.serve fires on import). Source-parse tests (same pattern as `engine-dispatch/entity_pk_test.ts`) are the right pattern for structural regression guards on Edge Functions.
- **Docuseal is a Next.js Route Handler, not a Supabase Edge Function.** Grep for the webhook in `apps/web/src/app/api/webhooks/docuseal/route.ts`, not `supabase/functions/`.

## Known Issues / Debt

- F-WH-05 (docuseal silent signature failure — no audit log) remains open (LOW, out of scope for this sortie).
- F-WH-06 (stripe-webhook missing INTERNAL_EMIT_URL silent continue) remains open (LOW, out of scope).
- sendgrid events without `sg_message_id` are now logged to `platform_webhook_event` with `sg_message_id = null`. These rows are NOT deduped by the partial UNIQUE index (by design — NULL excluded from partial index). If SendGrid retries such events, they produce duplicate rows in `platform_webhook_event` but NO counter double-increment. This is a known acceptable trade-off until full event-ID tracking is added.

## Next Steps

- Run `close-feature.sh wt-9` to merge to development.
- Verify migration applies clean on Supabase Local: `npx supabase db reset` or `npx supabase migration up`.
- Monitor sendgrid-webhook logs post-deploy for `Duplicate open/click` log lines to confirm dedup is firing in production.
