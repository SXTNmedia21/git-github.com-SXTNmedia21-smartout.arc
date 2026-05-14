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

- [x] Verify migration tip: actual tip `20260610100000_seed_day_control_action_authority.sql` (plan expected different tip — still well clear). Timestamp `20260611120000_wfm_foundation.sql` used.
- [x] `pos_account` table — all columns, constraints, RLS, trigger. Commit `36d227b4f`.
- [x] `pos_sale_event` table — append-only, unique, index, RLS, trigger. Commit `36d227b4f`.
- [x] `schedule_shift_offer_status` enum. Commit `36d227b4f`.
- [x] `schedule_shift_offer` table — sidecar, unique partial, indexes, RLS. Commit `36d227b4f`.
- [x] `change_proposal.kind` COMMENT updated with `scheduler_bundle` + JSONB shape. Commit `36d227b4f`.
- [x] View `public.v_pos_sales_hour`. Commit `36d227b4f`.

### Task 2 — Vault helper for per-workspace OAuth tokens

- [x] `vault.create_secret` verified available.
- [x] `fn_pos_credentials_upsert` SECURITY DEFINER, service-role only. Commit `c2a44dec6`.
- [x] `fn_pos_credentials_resolve` SECURITY DEFINER, service-role only. Commit `c2a44dec6`.
- [ ] Document pattern in `docs/protocols/SECURITY.md` — DEFERRED. First-of-kind precedent documented in HANDOFF; SECURITY.md update is a separate docs task.

### Task 3 — Telemetry registry adds

- [x] 11 new events added (3 POS + 5 marketplace + 3 scheduler). Commit `dc7aa5c9f`.
- [x] Routing: POS connected/disconnected 4 dests; ingested 3; offer posted/claimed/approved 4; expired/cancelled 3; scheduler proposed/accepted 4; rejected 3. Commit `dc7aa5c9f`.
- [x] `pnpm --filter @smartout/telemetry build` clean. 350 tests pass. Commit `dc7aa5c9f`.

### Task 4 — Eligibility helper (greenfield, per A5 verification)

- [x] `packages/ai/src/scheduler/eligibility.ts` created. Commit `2fcc6bae0`.
- [x] `EligibilityResult` exported. Commit `2fcc6bae0`.
- [x] `BlockerCode` type exported (7 codes). Commit `2fcc6bae0`.
- [x] `eligibilityFor()` pure function exported. Commit `2fcc6bae0`.
- [x] Tie-break documented in JSDoc (caller responsibility). Commit `2fcc6bae0`.
- [x] Vitest suite: 13 tests (9 core + 4 extras), all pass. Commit `2fcc6bae0`.
- [x] Backport opportunity flagged in HANDOFF — not touched.

### Task 5 — Authority seeds via ADR-0192 two-part pattern

- [x] Migration `20260611120100_wfm_capability_authority_seed.sql`. Commit `97dc438f2`.
- [x] Part A: 3 rows in capability_default_registry. Commit `97dc438f2`.
- [x] Part B: 18 rows backfilled (6 workspaces × 3 caps). Commit `97dc438f2`.
- [x] COMMENT updated on capability_default_registry table. Commit `97dc438f2`.
- [ ] CI parity check: FAILS due to pre-existing missing seeds (contract, payroll, task, etc.) — NOT caused by this sortie. WFM capabilities have no call sites yet (correct). See HANDOFF §Known Issues.

### Task 6 — Verification: trigger early-exit

- [x] Verified: `20260604000003_payroll_phase2_recalc_triggers.sql:194` has `OR NEW.kind IS DISTINCT FROM 'wage_line_override' THEN RETURN NEW`. Scheduler_bundle proposals correctly bypass payroll recalc trigger. Documented in HANDOFF.

### Task 7 — Type regeneration + handoff

- [x] `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts` (2>/dev/null required — stderr WARN contamination trap).
- [x] `pnpm turbo typecheck` — 52/52 tasks successful.
- [x] `docs/HANDOFF-wfm-foundation.md` written.

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

- [x] All 7 tasks above completed
- [ ] Migration applies clean from empty Supabase Local (`npx supabase db reset`) — not run (destructive to seeded local data; verified via individual apply commands)
- [x] Typecheck passes: `pnpm turbo typecheck` — 52/52 tasks
- [x] Telemetry dist rebuilt clean (no stale `.d.ts` per L-0190)
- [x] Eligibility helper vitest suite green (13/13 tests — 9 core + 4 extras)
- [ ] Authority seed parity CI check green — FAILS due to pre-existing development-branch gaps (contract/payroll/task etc.), NOT WFM gaps. See HANDOFF.
- [x] `fn_payroll_proposal_applied` early-exit verified + documented in HANDOFF
- [ ] Decision log updated with foundation completion note — requires manual Pontus step
- [x] HANDOFF written
- [x] User journeys committed (3 data-flow journeys at sortie start; populated as tasks complete)

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
