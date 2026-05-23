---
title: "Reports — E2E Coverage"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: reports
tags: [domain, reports, e2e, testing]
---

# Reports — E2E Coverage

> Test = proof of built. A flow without a test is aspirational until proven.

## Verification

Searched `apps/e2e/tests/` for `report*` patterns:

```bash
find apps/e2e/tests -name "report*" -o -name "*report*"
# → no results

grep -rn "dashboard/reports" apps/e2e/tests/
# → no results

grep -rn "sidebar-item-reports" apps/e2e/tests/
# → apps/e2e/tests/sidebar-11-flat.spec.ts:12
#   { testId: "sidebar-item-reports", label: "Rapporter" }
```

**Result: zero dedicated E2E specs for `/dashboard/reports`.**

The only test coverage referencing the reports page is a sidebar smoke test that verifies the "Rapporter" nav item renders.

## Coverage matrix

| # | Flow | Web E2E | Mobile E2E | Capability unit | Manual |
|---|---|---|---|---|---|
| F1 | View Overview tab | MISSING | n/a | MISSING | MISSING |
| F2 | View People tab | MISSING | n/a | MISSING | MISSING |
| F3 | View Staffing tab | MISSING | n/a | MISSING | MISSING |
| F4 | View Training tab | MISSING | n/a | MISSING | MISSING |
| F5 | Build custom report (AI wizard) | MISSING | n/a | MISSING | MISSING |
| F6 | View saved report ("Mine rapporter") | MISSING | n/a | MISSING | MISSING |
| F7 | Delete saved report | MISSING | n/a | MISSING | MISSING |
| F8 | Botsson navigates to reports tab | MISSING | n/a | MISSING | MISSING |
| — | Sidebar nav item renders | `apps/e2e/tests/sidebar-11-flat.spec.ts:12` | n/a | — | — |

## Partial coverage — sidebar smoke only

`apps/e2e/tests/sidebar-11-flat.spec.ts` verifies the sidebar renders "Rapporter" as a nav item with `testId: "sidebar-item-reports"`. This does NOT test:
- Route navigation to `/dashboard/reports`
- Tab rendering
- Data loading
- AI wizard flow
- custom_report table read/write

## Gaps

All 8 flows (F1–F8) have zero automated E2E coverage. Priority order for implementation:

1. **F5** (build custom report) — highest value; tests the AI wizard + BFF + `custom_report` INSERT end-to-end
2. **F6** (view saved report) — tests `SavedReportsGrid` + `custom_report` SELECT
3. **F1** (view Overview tab) — tests data hook + chart rendering smoke
4. **F7** (delete report) — tests `gatedMutation` delete path
5. **F2–F4** (People/Staffing/Training tabs) — chart rendering smoke tests
6. **F8** (Botsson nav) — tests tool bridge + tab switching

## Related test infrastructure

No `apps/e2e/fixtures/reports*.ts` fixture files exist. Creating F5 will require:
- Seed: at least one workspace with profile data + protocol_assignment data
- Auth: manager/admin user with workspace membership
- Mock or live: `OPENROUTER_API_KEY` (or test stub for the AI builder flow)

The `OPENROUTER_API_KEY` dependency in `packages/ai/src/agents/reports.ts:76` means full E2E testing of the AI wizard requires either a live API key or a BFF stub. Consider adding a `?mock=true` query param handled by the route for CI environments.
