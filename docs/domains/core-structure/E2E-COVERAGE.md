---
title: "Core Structure — E2E Coverage"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: core-structure
tags: [domain, core-structure, e2e, testing, coverage]
---

# Core Structure — E2E Coverage

> Test matrix = proof of what is actually built and tested. **Code wins.**

## Coverage matrix

| Flow | Test file | Coverage | Notes |
|---|---|---|---|
| Department CRUD (create/edit/archive) | — | 🔴 no test | No dedicated E2E |
| Department operating hours (DepartmentHoursTab read/write) | `apps/e2e/tests/sortie-1-mobile-hours-confirm.spec.ts` | 🟡 partial | Covers mobile-side hours confirm; not dept-hours admin write |
| Season activation D1 fanout (creates dept_operating_hours) | `apps/e2e/tests/season-activation.spec.ts` | 🟡 partial | Covers season activation trigger; indirect dept_operating_hours coverage |
| Location CRUD | — | 🔴 no test | |
| Zone CRUD (add/edit zone under location) | — | 🔴 no test | Zone surfaced but untested |
| Asset CRUD (add/edit asset under location) | — | 🔴 no test | Asset surfaced but untested |
| Department ↔ area pairing (department_location) | — | 🔴 no test | No UI yet |
| Planning cycle creation | — | 🔴 no test | Year-wheel UI exists |
| Hours override (department_hours_override) | — | 🔴 no test | Hook exists |
| Position management | — | 🔴 no test | |
| I1 bootstrap seed integrity | `apps/e2e/tests/onboarding-harness-e2e.spec.ts` | 🟡 partial | Covers onboarding flow; seed verification indirect |

## DB-level tests (pgTAP)

| Test file | Covers |
|---|---|
| `supabase/tests/season-activation-d1-fanout.sql` | `department_operating_hours` correctness post season-activation. Strongest D1 test. |
| `supabase/migration-coherence-baseline.sql` | Migration coherence checks — indirect D1 coverage |

## Gaps requiring test coverage

| Priority | Gap | Suggested test |
|---|---|---|
| HIGH | `department` CRUD + RLS (admin-only writes) | `apps/e2e/tests/org-structure-departments.spec.ts` |
| HIGH | `department_operating_hours` write from DepartmentHoursTab | Add to org-structure E2E |
| HIGH | `location` CRUD + RLS | `apps/e2e/tests/org-structure-locations.spec.ts` |
| MEDIUM | Zone + asset create under location | Extend org-structure-locations spec |
| MEDIUM | `department_location` read (post-I1-seed) | DB pgTAP test: verify at least 1 pairing per workspace |
| MEDIUM | `planning_cycle` no-overlap constraint | pgTAP test: `EXCLUDE USING gist` fires on overlap insert |
| LOW | `department_hours_override` create/resolve | pgTAP or Vitest |
