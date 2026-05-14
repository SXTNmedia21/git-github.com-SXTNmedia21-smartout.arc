---
title: "Journeys — wfm-foundation"
status: draft
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [journey, foundation, infrastructure, data-flow]
---

# Journeys — wfm-foundation

> Foundation sortie enables three downstream capabilities (POS / marketplace / scheduler). Foundation itself ships infrastructure, not user-facing surfaces. Journeys here describe DATA-FLOW journeys (the foundation's outputs as consumed by future capability sortie code), not user-facing journeys. User-facing journeys ship in C1/C2/C3 sub-sorties.

## Journey 1: POS data lands in cascade demand view

**Actor:** `pos-sync` Edge Function (future C1 sortie consumer)
**Precondition:** workspace has connected Lightspeed POS account (vault credentials + active pos_account row).

**Steps:**

1. Cron triggers `pos-sync` Edge Function (every 5 min).
2. Edge Function calls `fn_pos_credentials_resolve(workspace_id, vendor)` SECURITY DEFINER → returns decrypted Lightspeed OAuth token.
3. Edge Function calls Lightspeed REST API `/v1/sales` since `pos_account.last_synced_at`.
4. Per sale event from Lightspeed → INSERT `pos_sale_event` row with `vendor='lightspeed_kseries'`, `external_event_id` (idempotency key), `occurred_at`, amounts, `raw_payload`.
5. UNIQUE `(vendor, external_event_id)` deduplicates re-runs.
6. Edge Function updates `pos_account.last_synced_at` + `pos_account.sync_state` (cursor token if any).
7. Edge Function emits `pos.sale_event.ingested` (one event per sync run with row-count, not per row).
8. Cascade D4 consumer queries `public.v_pos_sales_hour` → returns `(workspace_id, location_id, hour_bucket, gross_minor, txn_count)` — feeds future scheduler `hour_factor` resolution.

**Postcondition:** `pos_sale_event` carries 5-min-fresh sales rows; `v_pos_sales_hour` aggregates ready for D4 demand resolution.

**Error paths:**

- Lightspeed API 401 → adapter logs auth failure, marks `pos_account.status='auth_failed'`, alerts via activity_trail. Operator must reconnect.
- Lightspeed API rate-limited → adapter respects 429 retry-after; sync resumes next cron tick.
- Vault secret missing → `fn_pos_credentials_resolve` returns NULL; Edge Function early-exits without writing rows.
- Duplicate `external_event_id` (re-run) → ON CONFLICT DO NOTHING; no error, no duplicate.

**Foundation deliverable for this journey:** `pos_account` + `pos_sale_event` tables + `fn_pos_credentials_*` helpers + `public.v_pos_sales_hour` view + `pos.sale_event.ingested` telemetry event.

---

## Journey 2: Eligibility helper resolves shared constraints (shift_marketplace + scheduler)

**Actor:** capability tool — `shift_marketplace.claim` (C2 sortie consumer) OR `scheduler.propose_plan` (C3 sortie consumer)
**Precondition:** caller has `profile`, `shift` candidate, and cascade context (absences, contracts, framework_rules, existing_shifts) loaded.

**Steps:**

1. Capability tool calls `eligibilityFor(profile, shift, context)` from `packages/ai/src/scheduler/eligibility.ts`.
2. Helper runs 7-check pipeline (deterministic ordering):
   1. `not_competent_for_role` — profile competence flags vs shift role requirement
   2. `aml_hour_floor_exceeded` — Aml §10 daily/weekly hour cap accumulated from existing shifts in same period
   3. `aml_weekly_cap_exceeded` — sum of week's existing shifts + candidate
   4. `tariff_rest_period_violation` — Riksavtalen rest gap from neighboring shifts
   5. `absence_overlap` — `schedule_absence` overlapping candidate window
   6. `existing_shift_overlap` — same profile already booked in candidate window
   7. `no_active_contract` — `employment_contract.status='active'` covering candidate date
3. Helper returns `{ eligible: true, blockers: [] }` if all 7 pass; `{ eligible: false, blockers: ['<code>', ...] }` otherwise.
4. Same input twice = same output (deterministic, replay-safe).

**Postcondition:** caller has actionable blocker list to render to manager (for `claim` rejection reason) or to skip in solver loop (for `propose_plan` gap-flagging).

**Error paths:**

- Missing context fields (e.g., `framework_rules` empty) → helper throws explicit error; caller must fail fast (per L-0177 fail-fast pattern, no silent fallback).
- Profile not in workspace → helper rejects synchronously with `not_competent_for_role` (defensive — RLS should already prevent).
- Candidate shift in past → helper rejects with `existing_shift_overlap` (degenerate case).

**Foundation deliverable for this journey:** `packages/ai/src/scheduler/eligibility.ts` module + `BlockerCode` enum + 9-test vitest suite.

---

## Journey 3: New workspace bootstraps capability authority (3 capabilities at once)

**Actor:** workspace-creation flow (existing trigger pattern from ADR-0192)
**Precondition:** `capability_default_registry` rows seeded for `scheduler` + `shift_marketplace` + `pos_account_management` (Part A of authority seed migration).

**Steps:**

1. Admin/onboarding flow INSERTs new `workspace` row.
2. Existing `BEFORE INSERT ON workspace` trigger from ADR-0192 fires (no change to trigger code in this sortie).
3. Trigger reads `capability_default_registry` → finds 3 new rows for our capabilities.
4. Trigger INSERTs `engine_authority_config` rows for new workspace × 3 new capabilities (with per-tool action_type overrides).
5. Workspace creation completes.
6. Workspace is immediately equipped with default authority for: scheduler (admin+ at confirm level), shift_marketplace (manager+ at autonomous-or-confirm), pos_account_management (admin+ at confirm).

**Postcondition:** Manager logging in to fresh workspace can immediately invoke `shift_marketplace.post_open` (admin-installed defaults present); admin can connect Lightspeed; admin can run scheduler.

**Backfill path (existing workspaces):** Part B of seed migration CROSS JOIN VALUES backfills `engine_authority_config` for all currently-existing workspaces (per L-0129 CI scanner mandate — capability literals inside VALUES tuples).

**Error paths:**

- Trigger already exists from ADR-0192 — no risk of double-fire (idempotent).
- `capability_default_registry` row already present (re-apply migration) → ON CONFLICT DO NOTHING.
- Backfill duplicate row → UNIQUE constraint on `(workspace_id, capability)` prevents.

**Foundation deliverable for this journey:** `20260611120100_wfm_capability_authority_seed.sql` (two-part migration) + canonical capability list COMMENT update.

---

## Out-of-scope journeys (ship in C1/C2/C3 sub-sorties)

- **Manager posts open shift → employee claims on mobile → manager approves** (C2 marketplace journey)
- **Manager triggers solver propose_plan → reviews bundle on web → atomic accept** (C3 scheduler journey)
- **Admin connects Lightspeed POS via OAuth flow** (C1 POS connect journey)
- **Mobile manager approves bundle proposal at bundle-granularity** (D1 within C3)

These journeys depend on foundation deliverables but are not implemented here.
