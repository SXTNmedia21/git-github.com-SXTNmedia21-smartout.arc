---
title: "B1 Main Council Verdict — Billing Engine Fase 1 Phase 1"
status: halt-for-review
created: 2026-04-17
updated: 2026-04-17
module: billing
tags: [billing, council, verdict, phase-1, halt, test-run]
---

# B1 Main Council Verdict — APPROVE_WITH_CHANGES (mixed)

**Commits:** `087c9510..f99b1b21` (15 commits)
**Branch:** `feat/billing-engine-fase-1`
**Worktree:** `smartout.ai-wt-4`

## Council Results

| Reviewer | Verdict | Key finding |
|---|---|---|
| system-steward | APPROVE_WITH_CHANGES | Decision log inline summary for ADR-0118 still reads "dunning via activity_trail"; plan frontmatter still `status: draft`; `docs/modules/MODULE_BILLING.md` missing (required by ADR-0118) |
| supervisor | APPROVE | No blockers. Merge-ready to `development`. Green on both merge readiness and B2 dispatch readiness. |
| feature-dev:code-reviewer | APPROVE_WITH_CHANGES | **Critical #2:** `v_current_plan_preview` view has no explicit RLS filter — leak risk if any authenticated client queries it. **Important #3:** concurrent draft→issued race can double-assign invoice_number (UPDATE trigger WHEN clause lacks `NEW.invoice_number IS NULL`). **Important #4:** `sent + reminder_sent` illegal per current CHECK — will block dunning flow in Fase 2. **Important #5:** `pricing_terms` not snapshotted at invoice issue — latent drift. |
| system-agent-coordinator | n/a | Skipped — no agent/tool/capability work in B1 |
| frontend-designer | n/a | Skipped — no UI work in B1 |

**Trust Gate:** N/A (no new capability/tool/emit in B1 — Phase 2 territory)

**Aggregate verdict:** APPROVE_WITH_CHANGES (two of three reviewers requested changes).

## Findings — Consolidated + Triaged

### Blockers for `development` merge (must fix)

None of the three reviewers named a true blocker for merge. The code-reviewer's Critical #2 (view RLS) is mitigated by the fact that the view is only queried from platform-admin Server Actions using the service role (which bypasses RLS). HOWEVER, if any future authenticated read-path is added without revoking the `authenticated` GRANT, the view will leak. Treating as must-fix-before-B2 rather than must-fix-before-merge because no caller exercises the gap today.

### Must-fix before B2 dispatches

1. **`v_current_plan_preview` RLS hardening** (code-reviewer critical #2). Either:
   - Add `WHERE public.is_admin_in_company(auth.uid(), c.company_id)` inside the view body, OR
   - Revoke `SELECT` from `authenticated` and grant only to `service_role`
   - Document the intended access model in the COMMENT.

2. **`assign_invoice_number` UPDATE trigger race** (code-reviewer important #3). Add `AND NEW.invoice_number IS NULL` to the UPDATE trigger's WHEN clause (mirror the INSERT trigger). Currently concurrent transactions both reading a draft row could both assign sequence numbers and waste one.

3. **`invoice_status_dunning_legal` CHECK too tight** (code-reviewer important #4). Review with ADR-0120 intent: is the lifecycle `sent → overdue → reminder_sent → escalated` with `overdue` mandatory as a gate? Or should `sent → reminder_sent` be legal? If the latter, the CHECK must relax. If the former, add the rationale as a COMMENT on the constraint.

4. **`pricing_terms_id` not snapshotted on invoice** (code-reviewer important #5). `get_invoice_basis` date-range-searches pricing_terms at read time. Add `pricing_terms_id uuid REFERENCES pricing_terms(pricing_terms_id)` to `invoice` and populate at generation (Phase 4). Until then, `get_invoice_basis` returns "effective today's terms" for drafts, not "terms at draft creation".

5. **Decision log inline summary for ADR-0118** (steward gap #1). Update `docs/decisions/0000-decision-log.md` line 33 to replace "dunning via activity_trail" with "dunning via billing_activity_log (superseded by ADR-0125)". The ADR file body is already correct; only the index summary is stale.

6. **Plan frontmatter `status: draft`** (steward gap #2). Bump to `status: in_progress` or similar so future subagents don't treat Phase 0/1 as pending.

7. **`docs/modules/MODULE_BILLING.md`** (steward gap #3). ADR-0118 mandates it. Should document: C3 placement, company_id exception bounds, `billing_activity_log` actor-model, expected Phase 2 emit contract.

### Should-fix before B2 dispatches (non-blocking)

- **Test gap #1–#6** (code-reviewer). pgTAP has 18 assertions. Missing coverage for: drift trigger fires, `assign_invoice_number` idempotency on already-numbered row, `overdue` dunning boundaries, `get_invoice_basis` return shape, `v_current_plan_preview` structure, `engine_step` event-payload shape. Any or all can be added as a single follow-up commit to `supabase/tests/migrations/`.
- **`detect_billing_basis_drift` DELETE return path** (code-reviewer critical #1). Cosmetic — AFTER triggers ignore return value — but `RETURN OLD` would be more correct than `RETURN NEW` on a DELETE branch.
- **`usage_snapshot` UNIQUE constraint is inline-unnamed** (supervisor nit). Add a name in a follow-up migration if conflict handlers ever need to reference it.

### B2+ advisory (carry forward)

- **Phase 2 prerequisites** (steward advisory). Before any billing Server Action ships, Phase 2 Task 2.1.5 MUST land `packages/telemetry/src/providers/billing-activity-log.ts` and the `EventDestination` union update. The plan covers this; the B2 supervisor must order it as the first three commits of Phase 2.
- **Drift trigger performance** (code-reviewer + supervisor). `detect_billing_basis_drift` fires on every `schedule_shift` UPDATE/DELETE. Safe today (sparse `usage_snapshot`, trigger early-exits); revisit under load when bulk-publish/bulk-settle flows land.
- **Step 2 `"events"` (plural) vs Step 1 `"event"` (singular) in `engine_step` seed** (code-reviewer nit). Verify `supabase/functions/engine-dispatch/index.ts` handles both shapes before Phase 4 cron emits real `invoice.issued` / `invoice marked_paid` events.

## Quality Gates — All Green

| Gate | Status | Detail |
|---|---|---|
| `npx supabase db reset` | ✓ | Applied cleanly; 12 migrations added |
| `npx supabase test db` (billing suite) | ✓ | 18/18 assertions pass (`billing_rls.spec.sql` 13, `billing_constraints.spec.sql` 5) |
| `pnpm turbo typecheck` | ✓ | 9 packages / 0 errors (@smartout/supabase, @smartout/telemetry, web, landing, @smartout/mobile + deps) |
| `pnpm turbo lint` | ✓ | 0 errors on billing-touched packages |

Note: the non-billing legacy tests (`api-key-lifecycle.sql`, `derivation.sql`, etc.) fail under `supabase db test` with "No plan found in TAP output" — this is pre-existing (they use `DO $$...$$` format not parsed by the TAP runner). Not caused by B1.

## Deviations from Plan

1. **Schema drift resolution** (Path C). Mid-preflight discovery caught 3 column-name drifts vs actual DB schema. ADR-0125 written, plan amended, Task 1.7.5 inserted. See `2026-04-17-billing-engine-fase-1-B1-HALT.md` for the full log.
2. **Task 1.10 rewritten** to use the actual `engine_process` + `engine_step` two-table seed pattern (matching `20260304300000_seed_daily_close_process.sql`). Original plan's single-row `definition jsonb` shape didn't match schema reality.
3. **Task 1.11 pgTAP location** placed in `supabase/tests/migrations/` with `SELECT plan()` format (per Supervisor recommendation at mid-B1) rather than the plan's original `supabase/tests/billing_*.sql` path, to match the governance-training precedent and get the tests into `npx supabase db test`'s scope.
4. **Mid-B1 hardening migration** (`3abe305a`) added to bring `assign_invoice_number` and `prevent_nested_credit_notes` into the same SECURITY DEFINER + search_path posture as the other three billing functions. Supervisor-requested at mid-B1.
5. **`chore` commit** `f99b1b21` stripped `supabase gen types` stderr leakage from `database.types.ts` (discovered during typecheck gate).

## Test-Run Protocol Feedback (B1 only, per user instruction)

- **Protocol clarity:** High. The mid-B1 checkpoint is genuinely load-bearing — it caught the SECURITY DEFINER gap and the dot-notation event names before Task 1.11 shipped. Keep this phase-boundary check for B2-B6.
- **Council response quality:** Three agents returned substantive, non-overlapping findings. No empty responses. Supervisor found nothing the steward or code-reviewer missed — suggests the supervisor's scope (commit hygiene + merge-readiness) is largely orthogonal to the other two. For future batches with UI work, reinstate `frontend-designer`.
- **Time budget:** Roughly 120 min of active work from start of B1 (`69b6b245`) to main council submission, across 15 commits, two council rounds, and four DB resets. Well under the 3h estimate.
- **Schema-drift discovery time:** The preflight check before Task 1.1 caught three column-name drifts that would have caused migration failures at Tasks 1.7/1.8/1.10. That pre-commit audit is probably the single highest-value step of this run. **Recommend adding to B2-B6 preflight explicitly:** before each batch, grep the plan's SQL for any table/column name and verify it against `packages/supabase/src/database.types.ts`.
- **Council-on-CHANGES loop:** Per-batch protocol says "apply the fixes, commit them, re-run council ONCE". At mid-B1 this worked cleanly (APPROVE_WITH_CHANGES → fix commit → APPROVE on re-run). For the main B1 council, the user's instruction was to halt regardless — so the re-run was skipped. For B2+ the loop returns.
- **Recommended protocol changes for B2-B6:**
  1. Add "schema-drift preflight" as an explicit preflight step. Grep every `public.*` and `NEW.*`/`OLD.*` reference in the batch's plan SQL against `database.types.ts`. 5 minutes; catches migration failures.
  2. For batches with TypeScript code (B2+), add `pnpm install` to the preflight if `node_modules` is absent. A fresh worktree has no deps and the typecheck gate fails loudly.
  3. Split the supervisor and steward councils at mid-checkpoint the way B1 did — both returning in parallel with different scopes made the fixes cheap. Keep this pattern.
  4. `npx supabase gen types typescript --local` should always redirect stderr (`2>/dev/null`). The warnings leak into the file and break typecheck. Consider a wrapper script or note in the protocol.
  5. For the main batch council, if the user wants full APPROVE-on-second-run (not just halt-for-test-run), consider budgeting a third council round for the code-reviewer's important-tier fixes — they're the ones that accumulate if deferred.

## Halt State

Per user instruction ("test run — B1 only, then halt regardless"): halting here. No fixes applied. Awaiting user's decision on whether to:

(a) accept the APPROVE_WITH_CHANGES outcome and merge B1 to `development` as-is, deferring all 7 must-fix-before-B2 items to a Phase 1.5 cleanup batch
(b) apply the 7 must-fix-before-B2 items now as a follow-up commit (or small series), re-run the council once, then merge
(c) apply only the view RLS fix (code-reviewer critical #2) and the decision-log summary fix (steward gap #1) as the minimum to unblock, merge, defer the rest
(d) request a different split

My recommendation: (c) — the two fastest wins are the highest-signal fixes. View RLS is the only correctness item; decision-log summary is the only item a B2 agent will definitely read. The other 5 can batch into a "Phase 1.5 housekeeping" follow-up.

## Commit Hash

This verdict doc lives at:
- `docs/superpowers/plans/2026-04-17-billing-engine-fase-1-B1-COUNCIL-VERDICT.md`

Commit: [to be filled after this file is committed]
