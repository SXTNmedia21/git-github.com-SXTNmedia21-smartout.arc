---
title: "Handoff — audit-fdb12-staff-event-rls"
feature: audit-fdb12-staff-event-rls
status: complete
created: 2026-05-13
updated: 2026-05-13
module: schedule
tags: [handoff, sortie-a3, audit-2026-05-13, f-db-12, rls, adr-0303]
---

# Handoff — audit-fdb12-staff-event-rls

> Branch: `feat/audit-fdb12-staff-event-rls` | Worktree: `~/dev/smartout.ai-wt-6` | Module: schedule
> Plan: [PLAN-audit-fdb12-staff-event-rls.md](plans/PLAN-audit-fdb12-staff-event-rls.md)
> Verification: [2026-05-13-sortie-a3-verification.md](audits/2026-05-13-sortie-a3-verification.md) — 11 / 11 PASS

## Summary

Closes audit finding **F-DB-12 (HIGH)** from `docs/audits/2026-05-13-adr-contract-validation-02/07-db-rls-telemetry-smoke.md`. `staff_event` + `staff_event_attendee` shipped 2026-05-13 (via ADR-0285 staff_event work in migration `20260604000001_staff_event.sql`) with the same `FOR ALL USING(...)` no-WITH-CHECK shape Sortie A.2 had closed across 4 D6 sister tables earlier the same day. The pattern violated ADR-0303 (sister-table sweep rule) within hours of the rule being proposed.

Three deliverables:

1. **Close F-DB-12** by mirroring the A.2 pattern on `staff_event` + `staff_event_attendee` — per-verb policies with symmetric `USING + WITH CHECK` and an admin/owner/manager role gate.
2. **Escalate ADR-0303** from `proposed` to `accepted` on the same day the finding surfaced — the rule justified itself immediately.
3. **Ship CI lint enforcement** (`scripts/check-rls-with-check.ts` + `.github/workflows/check-rls.yml`) so the same fault shape cannot regress silently between audit cycles.

## Deliverables

| Task | Commit | Artifact |
|---|---|---|
| Init | `9dc19d048` | Plan + 3 journey stubs declared (Sortie A.3 contract) |
| T1 | `f72439545` | Migration `supabase/migrations/20260609120000_audit_fdb12_staff_event_rls_with_check.sql` — drops legacy `jwt_write_staff_event*` FOR ALL, creates 6 per-verb policies with role gate + WITH CHECK |
| T2 | `64e54cb37` | pgTAP `supabase/tests/rls/audit_fdb12_staff_event.sql` + `audit_fdb12_staff_event_attendee.sql` — 6 assertions (4 + 2) covering shape, role gate, happy path, forge rejection |
| T3 | `2c6da2874` | ADR-0303 frontmatter `status: accepted` + acceptance section; audit synthesis `07-db-rls-telemetry-smoke.md` + `00-SUMMARY.md` annotate F-DB-12 → CLOSED |
| T3 | `f16f118b9` | `scripts/check-rls-with-check.ts` (287 lines) + `.github/workflows/check-rls.yml` (23 lines) — CI lint enforces ADR-0303 on every PR touching `supabase/migrations/**` |
| T5 | `bf2d3a73a` | `docs/audits/2026-05-13-sortie-a3-verification.md` (T5 report, 11 / 11 PASS); 3 journey files flipped `status: verified` with `verified_at: 2026-05-13` |

All 6 commits ahead of `development`. Pre-push typecheck green on every commit. No `--no-verify` used.

## Decisions

- **Role gate model: admin / owner / manager.** Matches Sortie A.2 deviation pattern. Confirmed two ways: (1) ADR-0285 §41 documents `staff_event` as a manager-tier authoring surface; (2) the single writer audit at `apps/web/src/app/dashboard/(actions)/staff-event-actions.ts:109-111` already calls `is_admin_in_workspace()` family — the DB gate now matches the application gate, eliminating the "DB permits what app rejects" drift. Employee tier is rejected at INSERT before WITH CHECK is reached (pgTAP S2.ok 2).
- **ADR-0303 promoted proposed → accepted same day finding surfaced.** Normal cadence is propose → council → accept across days. F-DB-12 made the rule load-bearing within hours of being written — deferring acceptance would have left a gap-class fault unmonitored. Acceptance section in the ADR explicitly cites F-DB-12 as the validating event, preserving the audit trail.
- **CI lint over runtime check.** Considered a pg-policy introspection runtime check as part of `engine-dispatch` boot. Rejected: catches regression too late (after deploy). A CI lint script scanning migration SQL at PR time blocks the bad migration from ever reaching production. Trade-off: depends on regex heuristic over migration text rather than DB ground truth — accepted because the fault shape is a textual property of `CREATE POLICY` statements and the lint script's own self-test (pre-fix baseline at `9a40fad44~1`) caught all 4 known violations including F-DB-12 lines 88 + 125.

## Learnings

- **L: Sister-sweep rule (ADR-0303) validated itself within hours of being proposed.** F-DB-12 surfaced on the same audit run as the rule's authoring sortie. The rule is load-bearing, not theoretical. Future class-pattern ADRs should ship with enforcement in the same sortie that proposes the rule, not in a follow-up — the gap between propose-and-enforce is exactly the window where the rule's first violation lands.
- **L: CI lint heuristic = regex on `CREATE POLICY ... FOR ALL` + workspace-scoped table list + WITH CHECK keyword presence.** No full SQL AST required. The fault shape is a textual property of the policy declaration; treating migration files as line-oriented text and scanning for `FOR ALL` / `FOR INSERT` / `FOR UPDATE` on listed tables without `WITH CHECK` catches every known violation with zero false positives in the existing migration corpus. Statement boundary detected by accumulating lines until the first `;` — adequate for the canonical `CREATE POLICY ... USING (...) WITH CHECK (...);` shape used across `supabase/migrations/`.
- **L: Override mechanism via `-- @rls-exempt: ADR-NNNN reason` comment annotation.** Some workspace-scoped policies are legitimately `FOR ALL` without WITH CHECK (service-role-only writers, internal-only tables, deferred sweeps tracked in a follow-up sortie). Hard-failing the lint without an escape hatch would force exemptions into the allow-list code itself, which conflates "this table is workspace-scoped" with "this table has a known exempt policy". Annotation-on-the-line preserves the workspace-scoped invariant while permitting documented exceptions — the ADR-NNNN reference forces a traceable justification rather than a silent bypass.
- **L: `staff_event_attendee` tenant scoping is parent-derived via `event_id → staff_event.workspace_id`, not direct `workspace_id` column.** Different forge surface than `staff_event` (event_id flip vs workspace_id flip). The WITH CHECK clause on the attendee table joins through to the parent's workspace to enforce membership — pgTAP covers the parent-join forge explicitly (S2.ok 2 on attendee). Future sister-sweeps on child tables must check whether tenant scoping is direct or parent-derived before writing the WITH CHECK expression.
- **L: T2 + T3 commit-ownership trap.** During parallel agent work on T2 (pgTAP) and T3 (ADR + CI script + audit annotations), lint-staged silently swept T3's in-progress .md edits into T2's staged commit. Recovered via `git reset --soft HEAD~1` + `git restore --staged docs/` + recommit split, but the trap is non-obvious: `git add <specific-paths>` followed by plain `git commit` still picks up lint-staged-formatted files outside the explicit add list. Future multi-agent sorties on the same worktree: use `git commit -- <paths>` defensive form (which restricts the commit to listed paths) over `git add <paths>` + plain commit. Cost was 10 minutes recovery; would have been hours if the merge of T2 and T3 had landed undetected.

## Known issues / debt

- **CI lint workspace-scoped table list is explicit, not introspected.** `WORKSPACE_SCOPED_TABLES` in `scripts/check-rls-with-check.ts` lists ~20 tables hand-extracted from grep across migrations. As new workspace-scoped tables ship, contributors must extend the list. Acceptable for v1 — the list is small, audited, and grows on a predictable schedule. Future improvement: auto-derive the list from `pg_attribute` introspection (any table with a `workspace_id` column is workspace-scoped) — defers DB connectivity into the lint script, which is currently pure file-system. Tracked as follow-up; not blocking.
- **5 Sortie A.2 deviation client-side write paths still need Server Action migration.** Documented in Sortie A.2 HANDOFF; out of scope for A.3 (which closed only the DB-side fault on `staff_event` + `staff_event_attendee`). The client-side migration belongs to Sortie A.2.1 — separate backlog item, not blocked by this closure.
- **`personal_task` migration has 2 ADR-0303-relevant findings at lines 46 + 56** (surfaced by CI lint pre-fix baseline run at S7). Out of scope for A.3 (different table, different sortie ownership) — in scope for adjacent sweep against the personal-task sortie's own closure. CI lint now blocks any further such introductions going forward; the existing two are pre-existing migration history that should be closed by the personal-task owner.

## Verification evidence

T5 verification report: [`docs/audits/2026-05-13-sortie-a3-verification.md`](audits/2026-05-13-sortie-a3-verification.md) — **11 / 11 acceptance criteria PASS**.

Highlights:

- **pgTAP: 6 / 6 assertions PASS** — shape, role gate (employee rejected, manager accepted), happy path lives_ok, direct workspace_id forge rejected on `staff_event`, parent-join event_id forge rejected on `staff_event_attendee`. ROLLBACK at end of each test — no side effects.
- **Migration idempotent** — second apply exit 0; DROP IF EXISTS handles already-removed legacy policies cleanly.
- **CI lint self-test:** exit 0 on clean dev (`f16f118b9`); exit 1 on pre-fix baseline (`GIT_BASE_REF=9a40fad44~1`) catching F-DB-12 at lines 88 + 125 of `20260604000001_staff_event.sql` exactly as expected. Two adjacent personal_task findings surfaced as out-of-scope co-detections (validates the heuristic catches the broader class, not just F-DB-12).
- **typecheck: 52 / 52 turbo tasks PASS** (cache hit; semantics preserved — A.3 changed only SQL migration + pgTAP + new TS lint script in `scripts/`, no app TS source modified).
- **Journeys: 3 / 3 flipped `status: verified` with `verified_at: 2026-05-13`** — attacker-forges-workspace-id-rejected, recurring-rule-violation-caught-by-ci, staff-event-happy-path-still-works.
- **Audit synthesis annotated** — `07-db-rls-telemetry-smoke.md` + `00-SUMMARY.md` both mark F-DB-12 as CLOSED 2026-05-13 by `feat/audit-fdb12-staff-event-rls`.

No council escalate triggers fired.

## Next steps

Pontus runs `~/.claude/scripts/close-feature.sh 6` to merge `feat/audit-fdb12-staff-event-rls` into `development`. All required deliverables present (plan, journeys verified, decision log entries via ADR-0303 acceptance, handoff, typecheck green).
