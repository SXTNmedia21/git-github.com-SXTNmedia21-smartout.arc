---
title: "Year Wheel — E2E Coverage"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: year-wheel
tags: [domain, year-wheel, season, e2e, playwright, testing]
---

# Year Wheel — E2E Coverage

> Test = proof of built. Honest delta. Grep-able file paths.

## Spec files

| File | Status | Tests |
|---|---|---|
| `apps/e2e/tests/year-wheel-redesign.spec.ts` | ✅ Active | 6 tests |
| `apps/e2e/tests/season-planning.spec.ts` | 🟡 Partial | 2 active + 2 skipped |
| `apps/e2e/tests/season-activation.spec.ts` | 🟡 Partial | Exists — scope TBD |

## Test inventory

### `year-wheel-redesign.spec.ts`

`test.describe("Year Wheel Redesign — New Flows")`

| Test | Status | What it covers |
|---|---|---|
| `Alt+N opens the quick-create sheet with today + 7 day defaults` | ✅ | Quick-create keybinding + default dates |
| `quick-create sheet can be abandoned with Avbryt without creating a season` | ✅ | Cancel flow — no mutation |
| `sidebar filter pills change aria-selected state` | ✅ | Filter pill UI (ARIA correctness) |
| `invalid seasonId in /dashboard/season/[id] triggers notFound` | ✅ | 404 path |
| `season submenu tab clicks preserve back-button history (router.push)` | 🟡 | Skip guard: only runs if seasons are seeded |
| `AiSuggestionCard renders as empty-state with no action buttons` | ✅ | Companion rail empty state |
| `year-nav chevrons update ?year= URL param and page re-renders` | ✅ | Year navigation URL behaviour |

### `season-planning.spec.ts`

`test.describe("Season Planning — Critical Flows")`

| Test | Status | What it covers |
|---|---|---|
| `should render the new year-wheel shell` | ✅ | Page renders, shell visible |
| `should expose the season sidebar regardless of season data` | ✅ | Sidebar renders without data |
| `should switch to goals tab and show create button` | ⏭ SKIPPED | Goals tab deferred (in `_deferred/`) |
| `should switch to procedures tab and show policy list or empty state` | ⏭ SKIPPED | Procedures tab deferred |

### `season-activation.spec.ts`

Exists. Full test inventory not pulled in this `pre` run — verify with `grep -n "test\|describe" apps/e2e/tests/season-activation.spec.ts`.

---

## Coverage gaps

| Flow | E2E coverage | Priority |
|---|---|---|
| Draw-to-create season (canvas drag) | 🔴 None | High — core interaction, hard to E2E but critical |
| Season budget setup (BudgetSetupTab) | 🔴 None | High |
| Season day/hour factor configuration | 🔴 None | Medium |
| Season activation (full RPC path) | 🟡 Partial (`season-activation.spec.ts`) | High |
| D1 fanout verification (operating hours seeded) | 🔴 None | High — cross-domain side effect |
| Archive season | 🔴 None | Medium |
| Botsson year-wheel tools (chat flow) | 🔴 None | Medium |
| Botsson season detail tools | 🔴 None | Medium |
| Season goals management (G1 — deferred) | 🔴 None | Low (deferred until tab ships) |
| Season procedures binding (G2 — deferred) | 🔴 None | Low (deferred until tab ships) |
| Duplicate season flow | 🔴 None | Low |
| Year navigation (URL param + render) | ✅ | — |

## Notes

- Playwright tests run in `serial` mode (`test.describe.configure({ mode: "serial" })`) with 60s timeout per test — avoids Turbopack dev-server first-compile thrash.
- Tests that require seeded season data use skip guards (e.g., `test.skip(!hasSeasonRow, "No seasons seeded...")`) rather than failing on empty workspace.
- E2E is locally OOM-blocked on WSL2 when swap = 0 (memory constraint, not code issue — see ADR-0367 Day 2 memory).
- The draw-to-create interaction (canvas pointer events + drag threshold) is the highest-value missing test — covers the primary user hypothesis of the PRD.
