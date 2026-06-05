---
title: "Handoff — sortie-a2-d6-rls-with-check"
feature: sortie-a2-d6-rls-with-check
status: complete
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [handoff, sortie-a2, rls, d6, audit-2026-05-13]
---

# Handoff — Sortie A.2: D6 RLS WITH CHECK sister-table sweep

## Summary

Sortie A.2 closes audit-2026-05-13 findings **F-DB-09 (CRITICAL)** and **F-DB-10 (HIGH)** by mirroring the ADR-0299 Sortie A `shift_approval` WITH CHECK pattern across four sister D6 tables: `department_session`, `session_hook`, `deviation`, and `personal_task`.

**Why now:** The 2026-05-13 audit surfaced that ADR-0299 had framed `FOR ALL USING(...)` no-WITH-CHECK as a class-pattern fault but scoped the fix to only one table. Three days later, four sister D6 tables still carried the exact same shape — forgeable `workspace_id` on INSERT/UPDATE for any user with two workspace memberships. `deviation` additionally had no role gate at all (any workspace member could mutate any deviation row). Sortie A.2 closes the gap class and ships ADR-0303 to mandate sister-sweep as part of D6 governance closure protocol going forward.

**Pattern applied (per table):**

- DROP existing `FOR ALL USING(...)` policy (`jwt_manage_*`).
- CREATE per-verb policies (SELECT / INSERT / UPDATE / DELETE) with `WITH CHECK` matching `USING` on `workspace_id`.
- `deviation` only: add role gate restricting INSERT/UPDATE/DELETE to `admin | owner | manager`. SELECT remains workspace-member.

## Deliverables

Five commits on `feat/sortie-a2-d6-rls-with-check` (base: `development`):

| SHA | Message |
|---|---|
| `5b53d4a0f` | `docs(sortie-a2-d6-rls-with-check): declare plan + journeys` — plan + 4 journey stubs |
| `5f3c434f2` | `docs(sortie-a2): amend ADR-0299 + draft ADR-0303 sister-sweep rule` — ADR-0299 amended (Sister-Table Closure section) + ADR-0303 new (proposed) + decision-log row + spec A.2 appendix |
| `53083847c` | `feat(sortie-a2): add WITH CHECK + role gate on 4 D6 sister tables` — migration `20260608120000_sortie_a2_d6_rls_with_check.sql` |
| `05a08f653` | `test(sortie-a2): pgTAP RLS coverage for 4 sister tables` — 4 test files / 15 assertions under `supabase/tests/rls/sortie_a2_*.sql` |
| `4f245ce2e` | `docs(sortie-a2): mark journeys verified + add t4 verification report` — 4 journey frontmatters flipped to `verified` + T4 report at `docs/audits/2026-05-13-sortie-a2-verification.md` |

## Decisions

1. **ADR-0299 amended** — appended "Sister-Table Closure" section recording that the WITH CHECK pattern applies to all four sister D6 tables identified by F-DB-09 / F-DB-10. The original ADR text remains authoritative; the amendment documents that Sortie A.2 ships the sister-closure as ADR-0299's class-pattern intent always required.

2. **ADR-0303 drafted (status: proposed)** — `docs/decisions/0303-sister-table-sweep-rule.md`. Mandates a sister-table sweep as part of every D6 governance / RLS finding closure. Defines: definition of "sister table", who runs the sweep (sortie author), how auditor confirms (`adr-contract-audit` slice 07), canonical sweep SQL shape (`pg_policy` scan for `polcmd='*' AND polwithcheck IS NULL` over the 10 D6 tables per ADR-0298). Scope intentionally limited to D6 governance to keep cost proportional. Council vote pending.

3. **Inline EXISTS predicates over helper functions** — Each new policy expresses workspace-membership inline via `EXISTS (SELECT 1 FROM public.profile WHERE user_id = auth.uid() AND workspace_id = <table>.workspace_id)` rather than introducing an `is_member_of_workspace()` helper. Matches the Sortie A baseline template on `shift_approval` and avoids policy-evaluation indirection.

4. **`deviation` role gate set to `admin | owner | manager` (not `admin+` only)** — T1 audit of the 5 client paths writing `deviation` (DeviationDialog, EventDetailPanel, use-update-deviation, DeviationDetailTab, useReconciliation) confirmed manager-tier is the operational write boundary on this surface. Employee/trainee blocked; manager and above permitted. Aligns with HMS deviation UX convention.

5. **`personal_task` SECURITY DEFINER read path preserved** — `fn_list_my_tasks` (ADR-0300) is `SECURITY DEFINER` and bypasses RLS by design. Per-verb split on the underlying table does not affect it. ADR-0301 task capability mutations continue to run via service-role (admin client) inside capability handlers, unaffected by the new JWT policies.

## Learnings

- **Sister-table sweep must be part of closure protocol.** ADR-0303 captures the rule. Single-table fix on ADR-0299 left 4 sisters open for 14 days. Pattern occurred 3× on this campaign (Sortie 1 `session_task` → Sortie A `shift_approval` → Sortie A.2 sweep) — promotion to ADR scope is the right level per L-0202 promotion convention.
- **Inline EXISTS over helper indirection** — Sortie A's policy template used inline `EXISTS` against `public.profile` for workspace membership. We mirrored exactly. Avoid introducing helper functions (`is_member_of_workspace()`) mid-sweep — would have diverged template and slowed audit re-verification.
- **`deviation` write tier is manager-inclusive.** Pre-A.2 it was no-role-gate (any member could mutate). Post-A.2 it's `admin | owner | manager`. T1's audit of 5 client paths confirmed manager is the operational write tier on this surface, not admin+.
- **`personal_task` `fn_list_my_tasks` is `SECURITY DEFINER`** — bypasses RLS by design and is unaffected by per-verb policy splits. Always verify SECURITY DEFINER status before assuming per-verb splits will affect a read path.
- **Commitlint `scope-case` rejects digit-after-letter in scope segments.** Scope `sortie-a2` failed lint with `scope must be in kebab-case`. The full feature name `sortie-a2-d6-rls-with-check` passes (longer kebab segments after the digit make it parse cleanly). Future sorties: use the full feature name as scope, or pick a numeric-free scope (e.g. `schedule`, `rls`).

## Known issues / debt

### Five client-side `deviation` mutation paths now manager+ only (follow-up Sortie A.2.1)

Post-A.2, these client paths return `42501` toast errors for employee/trainee profiles. This is **by-design per journey** `employee-cannot-mutate-deviation` — pre-A.2 they were silently violating ADR-0114 by allowing employee mutations. Production impact is low because the affected UI surfaces are admin/manager-tier by UX convention, but no programmatic gate existed until now.

Migrate to Server Actions (mirror `report-deviation-action.ts` pattern: admin client + `gate_action()` ADR-0099 + awaited `emit()`):

1. `apps/web/src/app/dashboard/operations/_components/DeviationDialog.tsx` (INSERT) → reuse `reportDeviationAction`
2. `apps/web/src/components/day/EventDetailPanel.tsx` deviation UPDATE → new Server Action `resolveDeviationAction`
3. `apps/web/src/app/dashboard/hms/_hooks/use-update-deviation.ts` → wrap with Server Action
4. `apps/web/src/components/dashboard/entity-drawer/tabs/deviation/DeviationDetailTab.tsx` UPDATE → wrap with Server Action
5. `apps/web/src/app/dashboard/reconciliation/_hooks/useReconciliation.ts` UPDATE → wrap with Server Action (likely already manager-tier UX, lower priority)

### ADR-0303 still `proposed`

Council vote needed before the next audit cycle. If accepted, the close-feature gate enhancement (`check-sister-sweep-recorded.sh` scanning HANDOFF for "Sister-sweep: 0 rows") is a follow-up task tracked in the ADR's Agent Impact section.

## Verification evidence

T4 verifier report: `docs/audits/2026-05-13-sortie-a2-verification.md`.

| Criterion | Result |
|---|---|
| S1 — No `FOR ALL` `jwt_manage_*` remains on 4 tables | PASS |
| S2 — pgTAP `policies_are` PASS on 4 tables | PASS |
| S3 — `deviation` role gate (employee throws, manager lives) | PASS |
| S4 — Forge `throws_ok` PASS on all 4 tables | PASS |
| S5 — Happy-path `lives_ok` PASS on all 4 tables (+ personal_task RPC) | PASS |
| S6 — Migration idempotent (re-apply clean, no drift) | PASS |
| S7 — App-tier regression sweep | PASS (5 client paths documented as follow-up) |
| S8 — ADR docs landed (0299 amendment + 0303 new + decision-log) | PASS |
| S9 — `pnpm turbo typecheck` 0 errors (11/11 tasks, 4m32s) | PASS |
| S10 — All 4 journey frontmatters flipped to `verified` | PASS |

**Totals:** 10/10 acceptance criteria PASS. pgTAP 15/15 assertions PASS. Migration idempotent on re-apply. Typecheck 11/11.

## Next steps

Pontus runs `~/.claude/scripts/close-feature.sh 6` to merge `feat/sortie-a2-d6-rls-with-check` to `development`. Follow-up Sortie A.2.1 (Server Action migration of 5 `deviation` client paths) recommended but not blocking.
