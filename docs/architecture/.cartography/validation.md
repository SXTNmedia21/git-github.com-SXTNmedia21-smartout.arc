---
title: Module Cartography v1 — Validation Report
status: done
updated: 2026-04-27
created: 2026-04-27
module: architecture
tags: [cartography, validation]
---

# Cartography v1 — Validation Report

Phase 4 of the cartography sortie. Verifies the data in `module-graph.csv`, `module-matrix.csv`, `module-graph.md`, and `shared-leakage.csv` before delivery.

## Summary

| Check | Result |
|---|---|
| 5 random spot-checks against source files | PASS |
| All 17 "isolated" modules zero in both CSVs | PASS |
| `season → year-wheel = 26` reproducible via grep | PASS |
| All 30 modules from `modules.json` present as matrix rows | PASS |
| Matrix column count = 30 | PASS |

All checks pass. Outputs are safe to commit.

---

## Check 1 — Random spot-checks

Five random rows from `module-graph.csv` were verified against the source file at the reported line number.

### Row 1
- **CSV:** `season,...HourFactorsTab.tsx,year-wheel,@/app/dashboard/year-wheel/_definitions/season-planning,HourFactorTemplateId,type,7`
- **Source line 7:** `import {` … `BUDGET_SETUP_LIMITS, getHourFactorTemplate, type HourFactorTemplateId,` from `@/app/dashboard/year-wheel/_definitions/season-planning`
- **Verdict:** PASS — type-only marker correctly classified

### Row 2
- **CSV:** `season,...DayFactorsTab.tsx,year-wheel,@/app/dashboard/year-wheel/_definitions/season-planning,getDayFactorTemplate,value,10`
- **Source line 10:** import from `@/app/dashboard/year-wheel/_definitions/season-planning` containing `getDayFactorTemplate`
- **Verdict:** PASS

### Row 3
- **CSV:** `season,...DayFactorsTab.tsx,year-wheel,@/app/dashboard/year-wheel/_definitions/season-planning,BUDGET_SETUP_LIMITS,constant,10`
- **Source line 10:** same block, `BUDGET_SETUP_LIMITS`
- **Verdict:** PASS — constant correctly classified (UPPER_SNAKE_CASE)

### Row 4
- **CSV:** `season,...season-page-client.tsx,year-wheel,@/app/dashboard/year-wheel/_hooks,useSeasons,hook,16`
- **Source line 16:** `import { useSeasonBudget, useSeasons } from "@/app/dashboard/year-wheel/_hooks";`
- **Verdict:** PASS

### Row 5
- **CSV:** `people,...people/[id]/page.tsx,organization,../../organization/_components/EntityDetailLayout,EntityDetailLayout,component,30`
- **Source line 30:** `import { EntityDetailLayout } from "../../organization/_components/EntityDetailLayout";`
- **Verdict:** PASS — relative path resolved correctly across modules

---

## Check 2 — Isolated module integrity

The report lists 17 modules as "fully isolated" (0 cross-module out, 0 cross-module in, 0 shared-leakage). Each was checked individually against both CSVs.

| Module | graph.from | graph.to | shared.from |
|---|---:|---:|---:|
| `ai` | 0 | 0 | 0 |
| `billing` | 0 | 0 | 0 |
| `close` | 0 | 0 | 0 |
| `help` | 0 | 0 | 0 |
| `komm` | 0 | 0 | 0 |
| `my-contract` | 0 | 0 | 0 |
| `my-cv` | 0 | 0 | 0 |
| `my-profile` | 0 | 0 | 0 |
| `my-salary` | 0 | 0 | 0 |
| `my-schedule` | 0 | 0 | 0 |
| `notifications` | 0 | 0 | 0 |
| `onboarding-assistant` | 0 | 0 | 0 |
| `operations` | 0 | 0 | 0 |
| `schedule` | 0 | 0 | 0 |
| `setup` | 0 | 0 | 0 |
| `shift-clock` | 0 | 0 | 0 |
| `website` | 0 | 0 | 0 |

**Verdict:** PASS. All 17 modules verifiably isolated in scanned data.

> Caveat: cartography only inspects imports under `apps/web/src/app/dashboard/`. If an "isolated" module is consumed externally (e.g. via re-export through `_components/`, or imported by a route group outside dashboard), that coupling would not appear here. Mod-worktree pilot should add a one-shot reverse check before extraction.

---

## Check 3 — `season → year-wheel = 26` reproducibility

This is the headline number for the cluster recommendation. Verified via three independent methods:

| Method | Result |
|---|---|
| Cartography (AST, per-symbol) | **26 symbol-rows** |
| Cartography (AST, per-import-decl, deduped by file+line) | **14 import-declarations** |
| `grep -rE "@/app/dashboard/year-wheel\|\\.\\./.*year-wheel" apps/web/src/app/dashboard/season/` | **14 import-declarations** |
| Symbol-level breakdown (from CSV) | hook=12, constant=8, type=3, value=2, component=1 = **26** |

**Symbols (cartography, sorted):** BUDGET_SETUP_LIMITS×3, DEFAULT_DAY_FACTORS×1, DEFAULT_HOUR_FACTORS×1, DayFactorTemplateId×1, HourFactorTemplateId×1, SEASON_BUDGET_STATUS_OPTIONS×1, SeasonActivationProposalModal×1, SeasonBudgetStatus×1, WEEKDAY_LABELS×2, getDayFactorTemplate×1, getHourFactorTemplate×1, useDayFactors×2, useHourFactors×2, useSeasonBudget×3, useSeasonGoals×1, useSeasonOperatingHours×2, useSeasonPolicyBindings×1, useSeasons×1.

**Verdict:** PASS. AST and grep agree on declaration count (14). Symbol expansion (26) matches sum of named-import counts.

### Foranalysis discrepancy ("19 hits")
The original sortie spec referenced "19 hits from year-wheel" from foranalysis. This number does not match either AST or grep. Likely cause: foranalysis used a different counting method (possibly raw symbol-name occurrence including comments, or included intra-module references). The 14/26 numbers are reproducible and consistent — they supersede the foranalysis estimate per spec instruction.

---

## Check 4 — Matrix coverage

- Matrix file: 31 lines (1 header + 30 rows). PASS.
- Matrix header has 30 column names + 1 corner cell. PASS.
- Set diff between `modules.json` and matrix rows: empty. PASS.

All 30 modules from Phase 1 are represented as both rows and columns. Modules with no edges show as empty rows (correct sparse representation).

---

## Friction points encountered

1. **`pnpm tsx` resolved tsx from nearest `package.json`** — when run from a subdirectory, picked up `apps/web` workspace and failed to resolve. Workaround: always run from repo root, or use `pnpm -w tsx`. Documented in script header.
2. **`ts-morph` was declared in `package.json` but missing from `node_modules`** — required `pnpm install --frozen-lockfile` before first scan. Lockfile was already in sync; node_modules had drifted. No new dependency added.
3. **Private-folder files (`_hooks/`, `_components/` etc.) were initially scanned as "from"** producing rows like `_hooks → operations`. Fixed by adding `privateFromSkipped` filter — these are shared infrastructure, not modules.
4. **One symbol-row per named import is denser than expected** — many imports use grouped named imports like `import { a, b, c } from "..."`. Cartography correctly expands each symbol to its own row, which is why `season → year-wheel` shows 26 rows for 14 declarations.

## Notes for future iterations

- Add reverse check: scan `apps/web/src/app/**` (NOT just `dashboard/`) and `packages/**` for imports that target dashboard modules. Catches "isolated" modules consumed externally.
- Add JSON output alongside CSV for easier programmatic consumption.
- Consider tracking per-file fan-out — a single file with 20 cross-module imports is more concerning than 20 files with 1 each.
