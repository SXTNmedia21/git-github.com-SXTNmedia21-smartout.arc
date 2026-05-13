---
title: "Plan — wfm-foundation"
status: draft
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [plan, foundation, pos, marketplace, scheduler, eligibility, vault]
---

# Plan — wfm-foundation

> Branch: `feat/wfm-foundation` | Worktree: /home/sxtnl/dev/smartout.ai-wt-10 | Base: `development` | Module: scheduler | Started: 2026-05-14

## Goal

Ship shared foundation for three V1 capabilities (ADR-0305 POS, ADR-0306 marketplace, ADR-0307+0309 scheduler) — migrations, telemetry, eligibility helper, authority seeds, vault helper — so subsequent C1/C2/C3 sub-sorties can build capability surfaces against a stable base.

## Council Provenance

- G1 council 2026-05-14 (chair self-reversal Phase 5, L-0147 7th precedent) → Option C synthesis on ADR-0309. 5 merge blockers locked. See `docs/council/COUNCIL-LOG.md` 2026-05-14 row.
- ADRs frozen: 0305 / 0306 / 0307 (amended) / 0309 (new).
- Companion learnings: L-0247 (runtime helper constraints) + L-0248 (provenance in JSONB not enum).

## Hard Constraints

- Migration timestamp floor: **must be greater than `20260611100100`** (current development tip — verified 2026-05-14).
- ADR-0287 mandatory `mutateWithGate` on every capability mutation (single-call shape only — never loop helper).
- ADR-0151 server-derived identity (workspace_id + profile_id from JWT, never body).
- ADR-0099 one gate eval per atomic write unit.
- ADR-0134 one emit per logical event (no fan-out emit loops).
- ADR-0288 voice channel split (chat-only on irreversible C4 acts).
- ADR-0133 mobile boundary (Approve verbs mobile-allowed, Compose verbs web-only).
- L-0042 migration timestamp must be strictly greater than ALL referenced creation timestamps (run grep before writing).
- Per-workspace OAuth tokens (Lightspeed) → Supabase Vault Tier 2, NOT op:// per workspace.
- View placement: `public.v_pos_sales_hour` (NOT new `cascade.` schema — fails 5+ table threshold per database-guide).

## Tasks

### Task 1 — Schema migrations (single migration file, atomic)

- [ ] Verify migration tip: `ls supabase/migrations/ | grep -v rollback | sort | tail -1` returns `20260611100000_call_log_unique_session.sql`. Pick timestamp `20260611120000_wfm_foundation.sql` (well clear of tip).
- [ ] `pos_account` table — `pos_account_id UUID PK`, `workspace_id UUID NOT NULL FK`, `vendor TEXT NOT NULL` (CHECK in `('lightspeed_kseries')` V1), `external_account_id TEXT NOT NULL`, `credentials_vault_id UUID NULL` (FK to `vault.secrets.id`), `sync_state JSONB NOT NULL DEFAULT '{}'::jsonb`, `last_synced_at TIMESTAMPTZ NULL`, `status TEXT NOT NULL DEFAULT 'inactive'`, `created_at`/`updated_at` TIMESTAMPTZ. Unique `(workspace_id, vendor)`. RLS: JWT read + API-key read + service-role write.
- [ ] `pos_sale_event` table — append-only. `pos_sale_event_id UUID PK`, `workspace_id UUID NOT NULL FK`, `pos_account_id UUID NOT NULL FK`, `location_id UUID NULL FK to department`, `vendor TEXT NOT NULL`, `external_event_id TEXT NOT NULL`, `occurred_at TIMESTAMPTZ NOT NULL`, `gross_amount_minor BIGINT NOT NULL`, `net_amount_minor BIGINT NOT NULL`, `currency TEXT NOT NULL` (CHECK 3-char ISO), `item_count INT NOT NULL DEFAULT 0`, `raw_payload JSONB NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Unique `(vendor, external_event_id)`. Index `(workspace_id, occurred_at DESC)`. RLS: JWT read + API-key read; INSERT only via service-role (Edge Function).
- [ ] `schedule_shift_offer_status` enum — `('open','claimed','approved','expired','cancelled')`.
- [ ] `schedule_shift_offer` table — sidecar to `schedule_shift`. `schedule_shift_offer_id UUID PK`, `workspace_id UUID NOT NULL FK`, `shift_id UUID NOT NULL FK schedule_shift`, `posted_by_profile_id UUID NOT NULL FK profile`, `posted_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `expires_at TIMESTAMPTZ NULL`, `status schedule_shift_offer_status NOT NULL DEFAULT 'open'`, `claimed_by_profile_id UUID NULL FK profile`, `claimed_at TIMESTAMPTZ NULL`, `approved_by_profile_id UUID NULL FK profile`, `approved_at TIMESTAMPTZ NULL`, `cancel_reason TEXT NULL`, `created_at`/`updated_at` TIMESTAMPTZ. Unique partial `(shift_id) WHERE status IN ('open','claimed')` (one active offer per shift). Index `(workspace_id, status, expires_at)`. RLS: workspace member read; poster + assigned-shift owner write.
- [ ] `change_proposal.kind` taxonomy COMMENT update — add `'scheduler_bundle'` to documented enum-values list inside the `change_proposal` migration COMMENT block (no DDL, just COMMENT update); document JSONB shape per ADR-0309.
- [ ] View `public.v_pos_sales_hour` — aggregates `pos_sale_event` to `(workspace_id, location_id, hour_bucket, gross_minor, net_minor, txn_count)`. Hour-bucket = `date_trunc('hour', occurred_at)`. Used by future scheduler D4 demand-input.

### Task 2 — Vault helper for per-workspace OAuth tokens

- [ ] Verify `vault.create_secret(secret text, name text, description text)` available (pgsodium extension already enabled per `smartout-edge-function-guide` Tier 2 reference).
- [ ] Migration adds wrapper `public.fn_pos_credentials_upsert(p_workspace_id uuid, p_vendor text, p_token text)` SECURITY DEFINER returning `vault.secrets.id` UUID — creates or replaces vault secret named `pos:<workspace_id>:<vendor>`, updates `pos_account.credentials_vault_id`. Activity_trail INSERT via SECURITY DEFINER (per L-0activity-trail-platform-actor pattern).
- [ ] Migration adds `public.fn_pos_credentials_resolve(p_workspace_id uuid, p_vendor text)` SECURITY DEFINER returning text (decrypted token) — caller must be platform service-role only (CHECK auth.role() = 'service_role'). Used exclusively by `pos-sync` Edge Function.
- [ ] Document pattern in `docs/protocols/SECURITY.md` follow-up section "Per-workspace external API credentials (Vault Tier 2)". First-of-kind precedent — must be written for next vendor.

### Task 3 — Telemetry registry adds

- [ ] Open `packages/telemetry/src/registry.ts`. Add 11 new events:
  - **POS sync (3):** `pos.account.connected`, `pos.account.disconnected`, `pos.sale_event.ingested` (one event per sync run, NOT per row — aggregated)
  - **Shift marketplace (5):** `shift_offer.posted`, `shift_offer.claimed`, `shift_offer.approved`, `shift_offer.expired`, `shift_offer.cancelled`
  - **Scheduler bundle (3):** `scheduler.proposal.proposed`, `scheduler.proposal.accepted`, `scheduler.proposal.rejected` — one emit per logical bundle event per ADR-0134 + ADR-0309
- [ ] Each event: route to `posthog` + `logger` + `activity_trail` + `engine_event` per existing pattern (telemetry registry single source of truth).
- [ ] Verify `pnpm --filter @smartout/telemetry build` produces clean dist (per L-0190 stale-dist trap).

### Task 4 — Eligibility helper (greenfield, per A5 verification)

- [ ] Create `packages/ai/src/scheduler/eligibility.ts` (new directory + file).
- [ ] Export `type EligibilityResult = { eligible: boolean; blockers: BlockerCode[] }`.
- [ ] Export `type BlockerCode` enum: `not_competent_for_role`, `aml_hour_floor_exceeded`, `aml_weekly_cap_exceeded`, `tariff_rest_period_violation`, `absence_overlap`, `existing_shift_overlap`, `no_active_contract`.
- [ ] Export `eligibilityFor(profile, shift, context): EligibilityResult` — pure function, deterministic for same input.
- [ ] Tie-break ordering throughout helper internals: `ORDER BY utilized_hours ASC, profile_id ASC` (per L-0determinism-precedent + `apps/web/src/app/api/payroll/_shared.ts:93` reference).
- [ ] Vitest suite `packages/ai/src/scheduler/__tests__/eligibility.test.ts` — 7 hard-constraint tests (one per BlockerCode) + 2 happy-path tests.
- [ ] Backport opportunity (NOT V1 scope): `supabase/migrations/20260413123343_shift_swap_engine.sql` placeholder `eligible: true` empty stub — flag for future cleanup sortie. Don't touch in this sortie.

### Task 5 — Authority seeds via ADR-0192 two-part pattern

- [ ] Migration `20260611120100_wfm_capability_authority_seed.sql`. Two parts per ADR-0192:
  - **Part A — capability_default_registry rows:** add 3 entries: `('scheduler', 'admin', 'confirm')`, `('shift_marketplace', 'manager', 'autonomous')`, `('pos_account_management', 'admin', 'confirm')`. Per-tool overrides: scheduler `propose_plan` = `read_only` (no mutation), `accept_proposal` = `confirm`, `reject_proposal` = `confirm`. shift_marketplace `claim` = `autonomous` only when `auto_approve_claim` config flag set, else `confirm`. pos_account_management `connect_lightspeed` = `confirm`.
  - **Part B — backfill `engine_authority_config`:** CROSS JOIN VALUES against existing workspaces (per L-0129 capability literals inside VALUES tuples mandatory for `scripts/authority-seed-parity.ts` CI scanner).
- [ ] Add `'scheduler'` + `'shift_marketplace'` + `'pos_account_management'` to canonical capability list COMMENT in seed-pattern reference migration `20260604000008` (per A3 finding).
- [ ] CI parity check: run `pnpm tsx scripts/authority-seed-parity.ts` and confirm green.

### Task 6 — Verification: trigger early-exit

- [ ] No code change needed — verification only. Confirm `fn_payroll_proposal_applied` body at `supabase/migrations/20260604000003_payroll_phase2_recalc_triggers.sql:194` early-exits on `NEW.kind IS DISTINCT FROM 'wage_line_override'`. Document confirmation in HANDOFF (closes Supervisor C-1 Phase 3 concern).

### Task 7 — Type regeneration + handoff

- [ ] After all migrations apply locally: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`.
- [ ] Run WITHOUT `op run` wrap (per L-0op-run-corrupts-supabase-gen-types — 1Password substitutes substring matches).
- [ ] `pnpm turbo typecheck` clean across all packages.
- [ ] Write `docs/HANDOFF-wfm-foundation.md` per CLAUDE.md feature closure protocol — decisions, learnings, next steps for C1/C2/C3 sub-sorties.

## Out of Scope (deferred to capability sub-sorties)

- Lightspeed adapter implementation (`packages/ai/src/adapters/pos/lightspeed.ts`) — C1 sortie
- `pos-sync` Edge Function — C1 sortie
- 3 scheduler capability tools (`propose_plan` / `accept_proposal` / `reject_proposal`) — C3 sortie
- 4 marketplace capability tools (`post_open` / `claim` / `approve_claim` / `cancel_offer`) — C2 sortie
- Mobile UI (BundleCard / BundleActionBar / ReadOnlyShiftList for scheduler; claim-list for marketplace) — D1 within C2/C3
- Web UI (`/dashboard/schedule/proposed-plan`, `/dashboard/schedule/marketplace`, `/dashboard/admin/pos-accounts`) — D2 within C2/C3
- `shift-offer-notify` Edge Function (push fanout cap=20) — C2 sortie
- Backport of shift-swap migration placeholder eligibility — separate cleanup sortie

## Acceptance Criteria

- [ ] All 7 tasks above completed
- [ ] Migration applies clean from empty Supabase Local (`npx supabase db reset`)
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Telemetry dist rebuilt clean (no stale `.d.ts` per L-0190)
- [ ] Eligibility helper vitest suite green (9/9 tests)
- [ ] Authority seed parity CI check green
- [ ] `fn_payroll_proposal_applied` early-exit verified + documented in HANDOFF
- [ ] Decision log updated with foundation completion note
- [ ] HANDOFF written
- [ ] User journeys committed (3 stubs at sortie start; populated as tasks complete)

## Estimated Duration

5-7 days. Critical path: Task 1 (migrations) → Task 2 (vault) → Task 3 (telemetry) → Task 4 (eligibility) → Task 5 (authority) → Task 7 (typegen + handoff). Task 6 is verification-only, parallelizable.

## Sub-Sortie Dependencies (post-foundation)

After this sortie merges to development:

| Sub-sortie | Depends on (from foundation) |
|---|---|
| `feat/wfm-pos-lightspeed-mvp` (C1) | pos_account + pos_sale_event tables, vault helper, view, telemetry events, pos_account_management authority |
| `feat/wfm-shift-marketplace` (C2) | schedule_shift_offer table + enum, eligibility helper, telemetry events, shift_marketplace authority |
| `feat/wfm-scheduler-greedy` (C3) | change_proposal.kind taxonomy, eligibility helper, telemetry events, scheduler authority, view (for demand input — fallback to day_factor if POS not yet connected) |

C2 and C3 can run in parallel after foundation merges. C1 unblocks C3's real demand-input but C3 can ship with `day_factor` fallback per ADR-0307.
