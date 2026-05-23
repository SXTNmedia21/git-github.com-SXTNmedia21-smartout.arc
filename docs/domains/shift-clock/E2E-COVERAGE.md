---
title: "Shift Clock — E2E Coverage"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: shift-clock
tags: [shift-clock, e2e, playwright, testing]
mirror: verified
last_verified: 2026-05-23
---

# Shift Clock — E2E Coverage

## Playwright Specs

| Spec file | Path | Scope |
|---|---|---|
| `journey-shift-clock.spec.ts` | `apps/e2e/tests/journey-shift-clock.spec.ts` | Full lifecycle: admin creates shift → employee punches in → breaks → punches out. Verifies `timesheet.time_entry` DB state via `timesheetClient` (service-role). |
| `daily-operation-m2-clockout-wizard.spec.ts` | `apps/e2e/tests/daily-operation-m2-clockout-wizard.spec.ts` | BFF route `POST /api/reconciliation/wizard-override`. Tests HTTP status + body structure. Skips DB-level assertions gracefully when local Supabase unavailable. |

## Coverage by Journey

| Journey | Spec | Coverage |
|---|---|---|
| Employee punch-in (planned shift) | `journey-shift-clock.spec.ts` | ✅ Covered |
| Employee break start/end | `journey-shift-clock.spec.ts` | ✅ Covered |
| Employee punch-out + summary | `journey-shift-clock.spec.ts` | ✅ Covered |
| Manager clockout override (BFF) | `daily-operation-m2-clockout-wizard.spec.ts` | ✅ BFF route covered |
| Employee punch-in (ad-hoc) | — | 🔴 Not covered |
| GPS blocking at punch-in | — | 🔴 Not covered |
| Supplement claim + review | — | 🔴 Not covered |
| Shift notes | — | 🔴 Not covered |
| Leader overview (manual punch) | — | 🔴 Not covered |
| Compliance (11h rest, weekly hours) | — | 🔴 Not covered (EF only) |
| Mobile punch flows | — | 🔴 Not covered (no Expo E2E) |

## Gap Delta

Covered: 4 of 11 identified journeys (36%).

Missing high-priority specs:
1. Ad-hoc shift punch flow — functional path exists, no test.
2. GPS block at punch-in — EF validation path, critical compliance test.
3. Supplement claim + approval loop — cross-domain (payroll reads result).
4. Leader manual punch-in — manager action with authority gate.

## Notes

- `journey-shift-clock.spec.ts` uses a service-role `timesheetClient` to verify `timesheet` schema state — the only E2E spec in the project that accesses a non-public schema directly.
- `daily-operation-m2-clockout-wizard.spec.ts` uses Bearer token simulation (mobile path via ADR-0132) rather than cookie-based auth. Tests gracefully skip when local Supabase is unavailable.
- Mobile E2E testing: not applicable with current toolchain (Expo E2E not configured in `apps/e2e/`).
