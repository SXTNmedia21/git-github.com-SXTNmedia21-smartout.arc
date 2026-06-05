---
title: "Handoff — mvp-blockers (sub-sortie of campaign/payroll)"
feature: mvp-blockers
branch: feat/payroll-mvp-blockers
closed: 2026-05-13
module: payroll
tags: [handoff, payroll, sma-345, sma-346, sma-347, adr-0303, adr-0295]
status: done
created: 2026-05-13
updated: 2026-05-13
---

# Handoff — mvp-blockers

> Sub-sortie of `campaign/payroll`. Worktree: `/home/sxtnl/wsl/smartout.ai-payroll-wt-1`.

## Summary

Closes the SMA-347 ship-blocker via the `notify_each_profile` dispatcher action_type architecture (ADR-0319). Parallel to campaign/payroll's main MVP-blocker wave (which closed SMA-343/344/345/346/348 independently). Council-verified Day-3 design that supersedes the original plan-literal direct-EF wiring per ADR-0235 cross-process consumer pattern.

## Sub-sortie scope (this branch)

Sub-sortie's value-add over what campaign/payroll already shipped:

| Track | What | Files |
|------|------|-------|
| SMA-347 Day-3 | `notify_each_profile` dispatcher action_type + subscriber engine_process | `supabase/functions/engine-dispatch/index.ts`, `supabase/migrations/20260528100400_payroll_period_locked_notifier_process.sql` |
| Dual-emit cleanup | F-CT-01 5th occurrence — kill capability tool emit at `tools.ts`, BFF route now canonical | `packages/ai/src/capabilities/payroll/tools.ts`, `apps/web/src/app/api/payroll/lock-period/route.ts` |
| Council verdict | Day-3 architecture verdict (4 reviewers, Steward Phase 3 reversed) | `docs/council/COUNCIL-LOG.md` (entry 2026-05-12) |
| Plan rewrite | Day-3 Task 14 rewritten per council verdict | `docs/plans/PLAN-mvp-blockers.md` |
| ADR-0319 | NEW dispatcher action_type ADR (mirrors ADR-0236 sibling-precedent) | `docs/decisions/0319-notify-each-profile-dispatcher-action-type.md` |
| L-0236 | Council chair branch-verification preflight (6th L-0147 precedent) | `docs/learnings/0236-council-chair-branch-verification-preflight.md` |
| L-0237 | Dual-emit capability tool + BFF route (5th F-CT-01 occurrence) | `docs/learnings/0237-dual-emit-capability-vs-bff-route.md` |
| L-0235 | Hardcoded zeros in capability-tool emit is a tell | `docs/learnings/0235-hardcoded-zeros-in-capability-emit-is-tell.md` |

## Closure dynamics

1. Sub-sortie was 439 commits behind dev when closure started — campaign-merge would conflict on 16 files.
2. Path chosen: hard-reset to `origin/campaign/payroll`, then cherry-pick novel commits only (skip duplicate work that campaign already absorbed).
3. Renumbering required mid-cherry-pick:
   - ADR-0297 → ADR-0303 → ADR-0319 (1st collision workforce-snapshot 2026-05-13; 2nd collision sister-table-sweep-rule on dev 2026-05-14)
   - L-0233 → L-0236 (collision with `voice-realtime-llm-vs-stage-engine-llm-two-contexts`)
   - L-0234 → L-0237 (collision with `voice-view-tools-as-activity-event-mirror-of-browser-uiactions`)
4. SMA-347 commit reconstructed with renumbered refs; one cherry-pick (`65fa32176 conditional CREATE TRIGGER`) skipped as campaign HEAD already has equivalent `to_regclass`-based guard.

## Journeys

| Journey | Status | Verified by |
|---------|--------|-------------|
| mvp-blockers-create-period | verified | CreatePeriodDialog + BFF + `payroll.period_created` (campaign) |
| mvp-blockers-custom-rate-payroll | verified | snapshot-period-costs 4-tier rate resolver, SMA-345 (campaign) |
| mvp-blockers-feriepenger-basis | verified | feriepenger.ts module + 3 BFF routes + ADR-0295, SMA-346 (campaign) |
| mvp-blockers-manual-time-entry | verified | ManualTimeEntryDialog + use-manual-supplements (campaign) |
| mvp-blockers-period-locked-notification | verified | ADR-0319 + subscriber migration + dispatcher, SMA-347 (sub-sortie) |

E2E tests deferred (D2=C now → D2=A at Phase 4 per ADR-0319 council verdict, mirrors `update_context_targeted` precedent).

## Decisions made

| Decision | Reason | Impact |
|----------|--------|--------|
| ADR-0319 — `notify_each_profile` action_type | Council REJECTED plan-literal direct-EF wiring as ADR-0235 violation; subscriber engine_process pattern preferred | NEW dispatcher action_type added to `GATED_MUTATION_TYPES`; mirrors ADR-0236 sibling-precedent |
| Kill dual-emit at capability tool | F-CT-01 5th occurrence — `tools.ts:901-918` emit with zeros + BFF route emit with real data | BFF route is canonical emit-site; capability tool no longer emits payroll.period_locked |
| Test gating D2=C → D2=A at Phase 4 | Matches `update_context_targeted` precedent; Playwright E2E blocking at Phase 4 | Day-3 sortie unblocked; E2E debt explicit in PLAN |
| Cherry-pick onto fresh campaign HEAD over manual merge-resolve | 16 conflicts vs cleanly cherry-pick of 4-5 novel commits; campaign already absorbed parallel SMA-343/344/345/346/348 work | Faster, lower-regression closure |
| Sub-sortie SMA-347 wins over campaign Pattern-B direct-EF | ADR-0319 council-verified; ADR-0235 cross-process pattern; future-proof | Campaign's Pattern-B SMA-347 implementation superseded by ADR-0319 action_type pipeline |

## Learnings

| Learning | Context |
|----------|---------|
| Stale telemetry `dist/` blocks type-resolution | `@smartout/ai` typecheck failed on `EntityType` not including `emma_task`/`personal_task`/`task cancelled` until `pnpm --filter @smartout/telemetry build` regenerated `dist/*.d.ts`. Same class as L-0190 stage-engine subpath imports. |
| ADR + Learning renumbering required when sub-sortie merges parallel dev work | Two ADR collisions + two Learning collisions in one closure. Pre-commit hook catches; renumber via per-file sed-replace (NOT bulk-replace; avoid hitting dev-owned references). Per `reference_adr_renumber_pattern.md` memory. |
| Sub-sortie closure heaviness scales with `behind_dev` count | 439 commits behind = 16-file merge conflict. Path: cherry-pick novel work onto fresh campaign HEAD. |
| Campaign HANDOFF can be ahead of journey files | Campaign claimed SMA-343-348 done in HANDOFF before journey files existed. Sub-sortie's `0e9dec6ee` declares them; closure verifies all 5. |

## Known issues / debt

- **ADR-0319 status**: `proposed`. Awaits Pontus's `accepted` flip after Day-3 implementation review.
- **Phase 4 E2E**: D2=A gate at Phase 4 — Playwright tests for `notify_each_profile` dispatcher + period_locked subscriber pipeline.
- **Campaign's Pattern-B SMA-347**: Direct-EF invoke at `lock-period` BFF coexists with sub-sortie's dispatcher pipeline. Migration plan: remove sync-chain block when ADR-0319 handler lands fully (similar to ADR-0293 Pattern B → Pattern A migration path).
- **Council fanout duplicate audit**: `feat/gate-action-coverage-ci` proposed in L-0237 — CI grep check for dual-emit pattern.

## Next steps

1. Pontus reviews + flips ADR-0319 `proposed` → `accepted`.
2. Phase 4 (Payroll PDF Lønnsgrunnlag) ships Playwright E2E for `notify_each_profile` (D2=A gate).
3. `feat/gate-action-coverage-ci` sortie codifies dual-emit CI lint per L-0237.
4. Campaign/payroll's Pattern-B sync-chain at `lock-period/route.ts` retired when ADR-0319 dispatcher pipeline proves out at Phase 4.
