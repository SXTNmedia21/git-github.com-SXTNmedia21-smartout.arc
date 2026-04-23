---
title: "Handoff — M1 Cascade Gap Closure (Season Activation → D1)"
status: complete
updated: 2026-04-23
created: 2026-04-23
module: year-wheel
feature: campaign/year-wheel M1 — cascade-gap-closure
tags: [handoff, cascade, season, activation, d1, m1]
---

# Handoff — M1 Cascade Gap Closure

> **Campaign:** campaign/year-wheel · **Milestone:** M1
> **ADR:** [ADR-0200](../decisions/0200-atomic-season-activation-rpc-d1-cascade.md)
> **Journey:** [JOURNEY-cascade-gap-closure.md](../journeys/JOURNEY-cascade-gap-closure.md)
> **Commits on `campaign/year-wheel`:** 420ffa5d → 05654d40 → 9cf03aa0 → d9bfab6a → f613aa3b → 23934772 → 0b061d86 → 71412806 → be1ecbb7 → 77dfa050 → 69cf280e (11 commits, ~2300 LOC)

## Summary

Closed the P0 cascade gap identified by the 2026-04-20 Year Wheel council: season activation now generates `department_operating_hours` rows atomically alongside the season status change. Before this work, activating a season was a D4-only operation (budget/factors) — the schedule engine never saw the change because no D1 rows existed for the new season. The three-layer architecture from ADR-0200 — trigger extension + thin RPC + Server Action with gate_action — fixes this inside a single Postgres transaction with proper authority gating, idempotency, and telemetry.

## What was built

### Three-layer architecture (ADR-0200)

**Layer 1 — Trigger extension (D1 atomicity):** The existing `emit_season_activated_event()` trigger function — previously only emitting an `engine_event` on season activation — now also performs an idempotent D1 copy block. When a season's status flips to `active`, the trigger:
1. Inserts the existing `engine_event` row (unchanged, continues routing to D6 `department_session_lifecycle`).
2. Guards on `NOT EXISTS (SELECT 1 FROM department_operating_hours WHERE workspace_id=NEW.workspace_id AND season_id=NEW.season_id)`.
3. If no rows exist: `INSERT INTO department_operating_hours SELECT ... FROM default rows (season_id IS NULL) JOIN department ON is_active=TRUE` — stamping `is_derived=TRUE`, `provenance='auto_copy_on_activate_trigger'`.

This runs inside the same Postgres transaction as the triggering UPDATE. Trigger failure = entire activation rolls back (correct default per council verdict).

**Layer 2 — `activate_season` RPC (archive+activate atomicity):** New SECURITY DEFINER plpgsql function wrapping the two UPDATEs (archive current active → activate target) in a single transaction, closing ADR-0085's documented partial-success window. Actor derivation via `auth.uid()` inside the RPC — caller cannot assert an actor identity (L-0058 defense). Returns JSONB with `departments_affected` + `rows_generated` read AFTER the trigger runs. Already-active guard returns `{ok: true, skipped: true}` without side effects.

**Layer 3 — Server Action + gateAction + modal:** `activate-season-action.ts` is the sole application-layer call path to the RPC. Flow: resolveCurrentProfile → gateAction(capability='season.activate', channel='chat') → server-side validation (budget/day_factors/hour_factors) → RPC → conditional enriched telemetry emits. Server-side emit eliminates the old client-side dual-emit window. `SeasonActivationProposalModal` (shadcn Dialog, Nordic Split strict-canonical springs 35/22/2.2, 6-state matrix, full i18n, useReducedMotion-respected) replaces the bypassable `window.confirm()`. CTA wired into `SeasonOverviewTab` with enablement rule based on `season.status`.

### Bootstrap-cascade preserved

Bootstrap-cascade step 3 (`supabase/functions/bootstrap-cascade/index.ts:328-398`) was NOT retired. It writes DEFAULT rows (`season_id IS NULL`) at workspace-finalize time; the trigger writes SEASON rows (`season_id = X`) on activation. These tuple spaces are disjoint by definition — no dual-write, no cutover needed. L-0114's dual-write concern dissolves structurally.

## Decisions

### ADRs (written this milestone)

- **[ADR-0200](../decisions/0200-atomic-season-activation-rpc-d1-cascade.md)** — Atomic Season Activation — Trigger-Extension D1 Cascade + RPC Race Guard. Status: **accepted** (council 2026-04-23, 4 reviewers APPROVE-WITH-CHANGES, 12 text fixes applied before acceptance). Supersedes ADR-0085 §Consequences known-risk.

### Decisions applied from council

12 text fixes applied to ADR-0200 before acceptance:
1. Invariant 1 grep tightened to avoid false-positive matches on `.upsert` calls.
2. Invariant 3 strengthened with emit-count + code-trace gate.
3. Invariant 8 softened to allow reasonable refactoring (auth.uid before any data access).
4. Invariant 11 added (ADR-0196 phantom capability coverage).
5. Invariant 12 added (no automated backfill — document existing active seasons case-by-case).
6. Invariant 13 added (activate-button wiring in scope).
7. Cutover section added for `use-seasons.ts` L-0098 flip.
8. Activate-button wiring moved from out-of-scope to in-scope (overriding architect's claim).
9. Modal file relocated to `apps/web/src/app/dashboard/year-wheel/_components/` (colocation convention).
10. Authority seed SQL fixed to 5-col VALUES / 5-col SELECT (column-default trick removed).
11. `channel: 'system'` changed to `channel: 'chat'` matching existing Server Action convention.
12. Telemetry registry note added documenting the two-section coupling (interface + EVENT_ROUTING).

### Architect decisions made under "reasonable assumptions"

- Gate denial folds into `reason: 'rpc_error'` for `season activation_failed` emit — registry enum has no `insufficient_authority` variant; `rpc_error` conveys "control-plane rejection." Success event NEVER emitted on failure (Invariant 3).
- `had_existing_hours` = true for idempotent skip AND for `rows_generated=0 && departments_affected>0` (trigger guard fired because rows already existed).
- Budget validation filters by `workspace_id` in addition to `season_id` (tenant guard beyond single-lookup).
- Hook refactor chose Option A (delete `activateSeason` mutation entirely) because zero consumers remained post-M1.8. Cross-package boundary (year-wheel package importing from apps/web) was not attempted.
- CTA placed in SeasonOverviewTab (preferred per ADR) above the no-budget guard so draft seasons without budget still see the button — routes through modal's typed-error rendering, keeping Invariant 11 (no phantom capability) honest.
- SQL integration test at `supabase/tests/season-activation-d1-fanout.sql` is the canonical L-0125 artefact assertion going forward. Playwright spec scaffolded but skipped pending `seedActivatableSeason()` helper infra.

## Learnings

Captured during this milestone (candidates for formal log entries):

- **L-0114 dual-write concern dissolves structurally when writers target disjoint tuple spaces.** Bootstrap writes `season_id IS NULL`; trigger writes `season_id = X`. No cutover plan required. Pattern: before planning a dual-write → flip → delete, check whether the two writers actually collide on the same key space. If not, they're additive, not competing.
- **Architect open questions that depend on the CAMPAIGN doc scope should be validated against the doc directly, not inferred.** The architect's claim "season-detail page wiring is out-of-scope" was wrong per CAMPAIGN-year-wheel.md lines 22–23. The council (both steward and supervisor) caught it in parallel. Orchestrator should pre-read the campaign scope before briefing architects and insert the relevant lines into the brief.
- **Existing infrastructure discovery saved a day of work.** The `trg_season_activated` trigger already existed (from migration `20260428100001`) covering D6. Extending the existing function with a D1 block was cleaner than writing a pure RPC that does everything. The first exploration agent missed this file; the second schema-verification pass caught it. **Always grep migrations for relevant table/function names before assuming greenfield.**
- **SQL integration test > Playwright for artefact assertion on DB state.** `docker exec psql` integration tests run in <1s with BEGIN/ROLLBACK isolation, no auth fixture, and directly SELECT the artefact. Playwright adds UI + auth + seed overhead for questionable marginal value when the goal is "did the DB write happen." Use Playwright for UX coverage, SQL for artefact coverage.
- **Tool errors don't always mean agent failure.** Three of four Wave 1 agents reported "Tool result missing due to internal error" but all three had actually completed their work (commits on branch, files in tree). Always check git state + filesystem before re-dispatching.

## Known issues / debt

### Shipped in scope, debt noted

- **Playwright E2E is skipped.** `apps/e2e/tests/season-activation.spec.ts` is `.skip`-ed pending a `seedActivatableSeason()` helper. The SQL integration test (`supabase/tests/season-activation-d1-fanout.sql`) is the canonical L-0125 artefact assertion — faster, more isolated, actually runs in CI. Playwright becomes valuable when the UX flow needs coverage; not blocking.
- **Three pre-existing authority-seed-parity failures** (`contract`, `memory`, `x` fixture) — not introduced by M1. The `season.activate` pair (literal + seed) is clean. These exist on `development` already.
- **`already_active` idempotent skip** emits `season activated` with `had_existing_hours: true` — a minor telemetry "semantic noise" where a no-op fires a success event. Alternative (don't emit) creates a reporting gap ("did the manager re-click? was it already active?"). Current choice is defensible; could be revisited if volume proves it noisy.

### Out of M1 scope, tracked for follow-ups

- **`TimelineBlock.tsx:51` spring violation** (stiffness=400, damping=30, mass=0.8 — 13× stiffer than Nordic Split canonical) — assigned to M2 design-debt sweep.
- **Hardcoded Norwegian strings in `SeasonQuickCreateSheet.tsx` + `SeasonSidebar.tsx`** (~5–8 strings bypassing i18n) — assigned to M2.
- **5 orphan season tools** in `packages/ai/src/tools/season/` — not registered in any capability. Leaving them orphaned is safe in M1 (scope boundary: no agent capability exposure in M1). Assigned to M3.
- **Currently-active seasons** that pre-date this work retain zero `department_operating_hours` rows with their `season_id`. They continue falling back to `default_weekly` in the resolver. Per Invariant 12, no automated backfill. Operators can archive + re-activate each affected season to generate rows. Document the remediation path in workspace onboarding runbook.

## Next steps

### M2 — Design-debt sweep (re-scoped DOWN)

Exploration found much less debt than the handoff claimed. 2-hour sprint:
- Fix `TimelineBlock.tsx:51` spring to canonical 35/22/2.2.
- Wire `useReducedMotion()` on existing motion surfaces in year-wheel.
- Migrate ~5-8 hardcoded Norwegian strings to i18n (`yearWheel.*` namespace).

### M3 — Agent surface parity with Schedule

- Register 5 orphan tools in `packages/ai/src/tools/season/` behind new `season` capability.
- Add `season` to intent classifier enum.
- Create `season-voice-tools-bridge.tsx` mirroring `schedule-voice-tools-bridge.tsx`.
- Write a new ADR for `season.*` agent capability authority seed pattern (parallel to ADR-0176 journey).

### M4 — P1 deferrals (L-0074)

- Move `SeasonGoalsTab` + `SeasonProceduresTab` out of `_deferred/`.
- Add activation checklist gate before CTA enables.
- Add Archive/Duplicate actions on Season page.
- Add Seeded pill state.

## Verification state at handoff

| Gate | Result |
|------|--------|
| `pnpm turbo typecheck` (web, year-wheel, telemetry, i18n) | ✅ 11/11 tasks successful |
| `pnpm tsx scripts/authority-seed-parity.ts` for `season.activate` | ✅ Literal in code, seed in migration — parity clean |
| Unit tests (Server Action) | ✅ 5/5 pass |
| SQL integration test (L-0125 artefact assertion) | ✅ 3/3 pass — `COUNT(*) = 14` for 7 days × 2 departments |
| Playwright E2E | ⚠️ Skipped pending seed helper (non-blocking) |
| Invariants 1–13 | ✅ All falsifiable; grep-verified where applicable |
| Council gate (ADR-0200) | ✅ Accepted 2026-04-23 with 12 fixes |
| ADR registered in decision log | ✅ 2026-04-23 |

## Credits

Council 2026-04-23 reviewers: system-steward (chair), supervisor, system-agent-coordinator, frontend-designer. Architect agent on two rounds (initial + revised post-trigger-discovery). 7 build agents (4 parallel Wave 1 + 2 parallel Wave 2 + 2 parallel Wave 3 + 1 test). Orchestrator: Pontus + Claude Opus 4.7.
