---
title: "Plan — audit-fdb12-staff-event-rls"
feature: audit-fdb12-staff-event-rls
spec: ../audits/2026-05-13-adr-contract-validation-02/07-db-rls-telemetry-smoke.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: schedule
tags: [plan, audit, rls, d6, staff-event, adr-0303-enforcement, f-db-12]
---

# Plan — audit-fdb12-staff-event-rls

> Branch: `feat/audit-fdb12-staff-event-rls` | Worktree: `~/dev/smartout.ai-wt-6` | Module: schedule

**Spec:** [Slice 07 smoke audit](../audits/2026-05-13-adr-contract-validation-02/07-db-rls-telemetry-smoke.md) — F-DB-12 detected ADR-0303 sister-sweep rule violation same day rule was proposed.

## Background

Audit 2026-05-13 smoke re-run F-DB-12 (HIGH): migration `20260604000001_staff_event.sql` (shipped 2026-05-13 via ADR-0285 staff_event work) creates `jwt_write_staff_event` + `jwt_write_staff_event_attendee` as `FOR ALL USING(...)` with NO WITH CHECK on workspace-scoped tables. Same gap class Sortie A.2 closed across 4 D6 sister tables. ADR-0303 (proposed today) codifies the sister-sweep rule but has zero enforcement.

This sortie:
1. Closes F-DB-12 by mirroring A.2 pattern on staff_event tables
2. Escalates ADR-0303 from `proposed` to `accepted`
3. Ships CI lint check enforcing the rule

## Journeys (the contract)

- [JOURNEY-audit-fdb12-staff-event-rls-attacker-forges-workspace-id-rejected](../journeys/JOURNEY-audit-fdb12-staff-event-rls-attacker-forges-workspace-id-rejected.md)
- [JOURNEY-audit-fdb12-staff-event-rls-recurring-rule-violation-caught-by-ci](../journeys/JOURNEY-audit-fdb12-staff-event-rls-recurring-rule-violation-caught-by-ci.md)
- [JOURNEY-audit-fdb12-staff-event-rls-staff-event-happy-path-still-works](../journeys/JOURNEY-audit-fdb12-staff-event-rls-staff-event-happy-path-still-works.md)

## Goal

Mirror ADR-0299 Sortie A pattern on `staff_event` + `staff_event_attendee`. Add per-verb WITH CHECK + role gate. Ship CI lint enforcing ADR-0303. Promote ADR-0303 to accepted.

## Tasks

- [ ] T1 Audit `staff_event` + `staff_event_attendee` schema + current policies + callers. Determine role gate (likely manager+). Write migration `<ts>_audit_fdb12_staff_event_rls_with_check.sql`. Council if role-gate ambiguous.
- [ ] T2 pgTAP tests `supabase/tests/rls/audit_fdb12_staff_event*.sql` (2 files, 6 assertions).
- [ ] T3 Flip ADR-0303 status `proposed` → `accepted`. Reference enforcement. Write CI lint `scripts/check-rls-with-check.ts` (TypeScript node script) + workflow `.github/workflows/check-rls.yml`. Update audit synthesis F-DB-12 → CLOSED.
- [ ] T5 Verify: migration applies, pgTAP green, CI lint detects regression on intentional bad-policy SQL fixture.

## Acceptance Criteria (falsifiable)

- [ ] **S1** No `FOR ALL USING(...)` on staff_event + staff_event_attendee
- [ ] **S2** Per-verb policies (SELECT/INSERT/UPDATE/DELETE) with WITH CHECK = USING on workspace_id (pgTAP `policies_are`)
- [ ] **S3** Role gate present per staff_event semantics (admin/owner/manager confirmed by T1 audit)
- [ ] **S4** Forge attempt → 42501 on both tables (pgTAP `throws_ok`)
- [ ] **S5** Happy-path own-workspace UPDATE → succeeds (pgTAP `lives_ok`)
- [ ] **S6** Migration idempotent (re-apply 0 errors)
- [ ] **S7** `scripts/check-rls-with-check.ts` ships + workflow gate fires on PR (local dry-run on a fixture migration that violates)
- [ ] **S8** ADR-0303 frontmatter `status: accepted` with enforcement reference
- [ ] **S9** Audit synthesis 2026-05-13-02 F-DB-12 → CLOSED
- [ ] **S10** `pnpm turbo typecheck` 0 errors
- [ ] **S11** All 3 journeys `status: verified`

## Council escalation triggers

- T1 reports staff_event has cross-workspace SELECT requirement (e.g. platform-admin) — role gate model differs
- T1 finds staff_event consumers writing from employee-tier (would break)
- CI lint script needs broader heuristic than "FOR ALL no WITH CHECK on workspace_id column" — false positives risk

## Out of scope

- Migrating staff_event production data
- Other ADR-0303 sister-sweep violations beyond staff_event (separate sweeps)
- Refactor of `_shared/internal-auth.ts` or other auth helpers
