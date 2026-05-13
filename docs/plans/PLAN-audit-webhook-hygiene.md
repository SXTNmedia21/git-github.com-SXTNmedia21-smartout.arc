---
title: "Plan — audit-webhook-hygiene"
feature: audit-webhook-hygiene
spec: ../audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: cross-cutting
tags: [plan, audit, webhook, idempotency, f-wh-01, f-wh-02, f-wh-03, f-wh-04]
---

# Plan — audit-webhook-hygiene

> Branch: `feat/audit-webhook-hygiene` | Worktree: `~/dev/smartout.ai-wt-9` | Module: cross-cutting

**Spec:** F-WH-01/02/03/04 from synthesis. Webhook hygiene sweep — 4 findings, single sortie.

## Background

Slice 13 webhook integration audit flagged 4 issues:
- **F-WH-01** (MEDIUM): docuseal webhook leaks raw `updateError.message` in 500 response body
- **F-WH-02**: livekit-webhook missing null guard on env (LIVEKIT_API_KEY/SECRET)
- **F-WH-03** (MEDIUM): sendgrid open/click counter not idempotent — `+1` RPC inside per-event loop double-counts on retry, events without `sg_message_id` bypass partial-unique index
- **F-WH-04** (HIGH, PROMOTION-BLOCKER class): `call_log` no UNIQUE on `call_session_id` — LiveKit `room_finished` retry duplicates immutable audit rows + over-counts `channel.call.ended`

## Journeys

- [JOURNEY-audit-webhook-hygiene-call-log-replay-safe](../journeys/JOURNEY-audit-webhook-hygiene-call-log-replay-safe.md)
- [JOURNEY-audit-webhook-hygiene-sendgrid-idempotent](../journeys/JOURNEY-audit-webhook-hygiene-sendgrid-idempotent.md)
- [JOURNEY-audit-webhook-hygiene-error-leak-fixed](../journeys/JOURNEY-audit-webhook-hygiene-error-leak-fixed.md)

## Goal

Close F-WH-01 + F-WH-02 + F-WH-03 + F-WH-04. Webhook hygiene baseline restored.

## Tasks

- [ ] T1 F-WH-04: Migration `<ts>_call_log_unique_session.sql` — `ALTER TABLE call_log ADD CONSTRAINT call_log_call_session_id_key UNIQUE (call_session_id);` Pre-migration: dedupe existing duplicates (defensive). Update livekit-webhook handler to use `INSERT ... ON CONFLICT (call_session_id) DO NOTHING` (or DO UPDATE for late status).
- [ ] T2 F-WH-03: sendgrid-webhook idempotency. Replace per-event RPC `+1` with upsert pattern. Events missing `sg_message_id`: log + skip OR use `event-id + timestamp` as dedup key. Migration if schema change needed (partial unique index extension).
- [ ] T3 F-WH-02: livekit-webhook null-guard. Verify `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` present at handler start. Fail-closed 500 with `"missing config"` (server logs only, no leak to caller).
- [ ] T4 F-WH-01: docuseal-webhook. Replace `updateError.message` in 500 body with `"internal"`. Log full error server-side via `console.error`.
- [ ] T5 Tests where applicable (idempotency replay test, null-env-guard test).
- [ ] T6 Update synthesis F-WH-01/02/03/04 → CLOSED.
- [ ] T7 Flip 3 journeys.

## Acceptance Criteria

- [ ] **S1** Migration applied: `call_log.call_session_id` UNIQUE constraint present
- [ ] **S2** livekit-webhook upsert ON CONFLICT — replay second `room_finished` → 0 new rows + 0 dup `channel.call.ended` emits
- [ ] **S3** sendgrid-webhook handler idempotent — replay same payload → counters unchanged
- [ ] **S4** sendgrid handler skips events without `sg_message_id` (or uses fallback dedup)
- [ ] **S5** livekit-webhook fails-closed on missing env
- [ ] **S6** docuseal 500 body no longer contains raw DB error
- [ ] **S7** `pnpm turbo typecheck` 0 errors
- [ ] **S8** Audit synthesis F-WH-01/02/03/04 → CLOSED
- [ ] **S9** 3 journeys verified

## Council triggers

- F-WH-03 sendgrid schema change beyond UNIQUE constraint (partial index refactor) → council on scope
- Existing call_log dupes (data cleanup before constraint) → council on dedup strategy (keep first vs keep last)

## Out of scope

- F-WH-03 transport refactor to queue (separate sortie)
- Sentry instrumentation
- Stripe webhook (already reference implementation, untouched)
