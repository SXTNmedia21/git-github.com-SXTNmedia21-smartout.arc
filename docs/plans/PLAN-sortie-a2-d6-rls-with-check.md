---
title: "Plan — sortie-a2-d6-rls-with-check"
feature: sortie-a2-d6-rls-with-check
spec: ../superpowers/specs/2026-05-13-sortie-a-d6-rls-hardening-design.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: schedule
tags: [plan, rls, d6, cascade, security]
---

# Plan — sortie-a2-d6-rls-with-check

> Branch: `feat/sortie-a2-d6-rls-with-check` | Worktree: `~/dev/smartout.ai-wt-6` | Module: schedule

**Spec:** [Sortie A — D6 RLS hardening design](../superpowers/specs/2026-05-13-sortie-a-d6-rls-hardening-design.md) (Sortie A.2 is sister-table extension appended to this spec)

## Background

Audit 2026-05-13 (`docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md`) flagged F-DB-09 (CRITICAL) + F-DB-10 (HIGH): four sister D6 tables retain the same pre-ADR-0299 `FOR ALL USING(...)` no-WITH-CHECK shape that Sortie A closed only on `shift_approval`. Forgeable `workspace_id` on INSERT/UPDATE for any user with two workspace memberships. `deviation` additionally has no role gate at all.

## Journeys (the contract)

- [JOURNEY-sortie-a2-d6-rls-with-check-attacker-forges-workspace-id-rejected](../journeys/JOURNEY-sortie-a2-d6-rls-with-check-attacker-forges-workspace-id-rejected.md) — Multi-workspace user forges `workspace_id` on UPDATE → rejected by WITH CHECK on 3 sister tables
- [JOURNEY-sortie-a2-d6-rls-with-check-employee-cannot-mutate-deviation](../journeys/JOURNEY-sortie-a2-d6-rls-with-check-employee-cannot-mutate-deviation.md) — Employee-tier user attempts to INSERT/UPDATE/DELETE a deviation → rejected by new role gate
- [JOURNEY-sortie-a2-d6-rls-with-check-manager-updates-own-deviation](../journeys/JOURNEY-sortie-a2-d6-rls-with-check-manager-updates-own-deviation.md) — Manager updates deviation row in own workspace → succeeds
- [JOURNEY-sortie-a2-d6-rls-with-check-personal-task-rpc-still-works](../journeys/JOURNEY-sortie-a2-d6-rls-with-check-personal-task-rpc-still-works.md) — `fn_list_my_tasks` RPC + task capability mutations still work after per-verb split on `personal_task` (ADR-0300/0301 preserved)

## Goal

Mirror ADR-0299 Sortie A WITH CHECK pattern across `department_session`, `session_hook`, `deviation`, `personal_task`. Close F-DB-09 + F-DB-10. Add role gate on `deviation`.

## Tasks

- [ ] T1 Read shipped Sortie A migration template on `shift_approval` — verify exact policy shape + helper functions
- [ ] T2 Audit current policies on 4 sister tables via `pg_policy` — capture baseline
- [ ] T3 Audit `deviation` schema — confirm `workspace_id NOT NULL` + FK exist (council if missing)
- [ ] T4 Audit app code for employee-tier writes to `deviation` (council if production paths rely on it)
- [ ] T5 Audit `personal_task` consumers (ADR-0300 `fn_list_my_tasks` RPC + ADR-0301 task capability)
- [ ] T6 Write migration `<ts>_sortie_a2_d6_rls_with_check.sql` — DROP+CREATE per-verb policies on 4 tables + role gate on deviation
- [ ] T7 Write pgTAP tests `supabase/tests/rls/sortie_a2_<table>.sql` — 4 tables × 3 cases each
- [ ] T8 Append A.2 section to spec `2026-05-13-sortie-a-d6-rls-hardening-design.md`
- [ ] T9 Draft ADR-0303 — "Sister-table sweep mandatory on D6 governance findings" (or amend ADR-0299)
- [ ] T10 Run migration locally + pgTAP — verify S1-S7
- [ ] T11 Re-apply migration twice — verify idempotent (S6)
- [ ] T12 Grep regression — direct-DB writes to 4 tables now blocked by new policies
- [ ] T13 Run mission e2e if exists (helpdesk_query_lifecycle, mr-botsson) — verify no break
- [ ] T14 Update audit synthesis with F-DB-09 closure note
- [ ] T15 `pnpm turbo typecheck` 0 errors

## Acceptance Criteria (falsifiable)

- [ ] **S1** No `FOR ALL USING(...)` policy on department_session, session_hook, deviation, personal_task
- [ ] **S2** Per-verb policies (SELECT/INSERT/UPDATE/DELETE) with WITH CHECK matching USING on workspace_id on all 4 tables (pgTAP `policies_are()`)
- [ ] **S3** deviation role gate: only manager+ INSERT/UPDATE/DELETE; any member SELECT (pgTAP)
- [ ] **S4** Forge attempt rejected with `42501` on all 4 tables (pgTAP `throws_ok`)
- [ ] **S5** Happy-path UPDATE/INSERT succeeds for own workspace (pgTAP `lives_ok`)
- [ ] **S6** Migration idempotent — `supabase db reset && migration up` then re-apply migration succeeds clean
- [ ] **S7** No regression: `fn_list_my_tasks` + task capability tools + helpdesk_query_lifecycle still functional
- [ ] **S8** ADR-0299 updated with sister-closure section + ADR-0303 (or amendment) registered
- [ ] **S9** `pnpm turbo typecheck` 0 errors
- [ ] **S10** All 4 declared journeys have `status: verified` in frontmatter

## Council escalation triggers

- T3 reports `deviation` schema-level gap (missing `workspace_id NOT NULL` FK) → council on schema-first vs policy-first
- T4 finds employee-tier app code writing `deviation` in production paths → council on role-gate scope (manager+ vs member+ vs separate read/write tiers)
- T5 finds `personal_task` consumer that relies on `FOR ALL` (e.g. service role bypass) → council on per-table-divergence

## Out of scope

- `engine_world_observe_platform` authenticated grant (F-DB-01, separate sortie)
- 6 tables missing api_key_read_* (F-DB-02, separate sortie)
- `salary_type` + `end_date_reason` RLS (F-DB-03, separate sortie)
- ADR-0287 enforcement ship — `mutateWithGate()` + CI gate (F-DB-11, separate sortie)
