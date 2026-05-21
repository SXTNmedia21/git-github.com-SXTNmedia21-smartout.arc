---
title: Slice 11 — Performance & Design Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, performance-design, adr-0019, adr-0366, oklch, motion]
---

# Slice 11 — Performance & Design Audit

**Surface:** `apps/web/next.config.ts` · `packages/design-tokens/` · `apps/web/src/app/globals.css`
**ADRs in scope:** ADR-0019 (performance governance), ADR-0366 (OKLCH literal ban)
**Baseline:** `docs/audits/2026-05-18-adr-contract-validation-02/11-performance-design.md`
**Date:** 2026-05-20

---

## Summary

1. **MEDIUM** — ADR-0366 OKLCH sweep (H2 sortie) resolved 280+ component hits. Three residual component violations remain: `Orb.tsx:43` (runtime-computed gradient) + `LighthouseAvatar.tsx:53` (runtime halo gradient). Token does exist for the static fallback (`--avatar-fallback-gradient`) but the *dynamic* chroma-multiplied gradient has no token backing.
2. **MEDIUM** — ADR-0366 ESLint enforcement rule (`nordic-split/no-oklch-literal`) mandated by ADR-0366 §Implementation has **not been shipped**. Plugin dir lists 3 rules (`no-direct-supabase-write`, `no-empty-string-identifier-fallback`, `no-gated-write-in-capabilities`) — no OKLCH rule. Without automated enforcement, violations will re-accumulate.
3. **MEDIUM** — `apps/landing/src` has 6 `oklch(` occurrences: 4 in `globals.css` `@layer utilities` / inline CSS (outside `@theme`), 2 in `free-forever/page.tsx` className Tailwind arbitrary values. ADR-0366 scope explicitly covers `apps/landing/**`.
4. **LOW** — ADR-0019 perf-budgets coverage frozen at 4 routes (`web`) + 4 routes (`landing`). Dashboard added ~20 routes since 2026-02-28 (hms, komm/*, year-wheel, season/*, payroll, shift-clock, etc.) with no perf-budget entries. No git changes to `apps/web/perf-budgets.json` since creation.
5. **LOW** — Inline spring magic numbers persist in 5+ files. Non-canonical values (login page `stiffness:300/damping:15`, `QuickBroadcast stiffness:40/damping:22`) are not motionToken aliases and will drift silently from Nordic Split spec.

---

## Findings Table

| ID | Severity | File:Line | ADR | Evidence |
|----|----------|-----------|-----|----------|
| PD-01 | MEDIUM | `apps/web/src/components/helpdesk-orb/Orb.tsx:43` | ADR-0366 | `oklch(0.82 ${chroma} 50)` in runtime-computed `style={}` gradient — no chroma-parameterised token exists |
| PD-02 | MEDIUM | `apps/web/src/components/helpdesk-orb/LighthouseAvatar.tsx:53` | ADR-0366 | `oklch(0.80 ${chroma} 50 / 0.55)` halo gradient dynamically computed from `chroma` arg — no token backing |
| PD-03 | MEDIUM | `packages/eslint-config/plugins/smartout/rules/` | ADR-0366 | ESLint rule `nordic-split/no-oklch-literal` (mandated in §Enforcement) absent; only 3 rules exist |
| PD-04 | MEDIUM | `apps/landing/src/app/globals.css:134-135,159,172` | ADR-0366 | 4 `oklch(` literals in `@layer utilities` (not `@theme`) — outside allowed zone |
| PD-05 | MEDIUM | `apps/landing/src/app/free-forever/page.tsx:181,185` | ADR-0366 | 2 Tailwind arbitrary `bg-[radial-gradient(…oklch(…)…)]` — component-scope OKLCH in landing |
| PD-06 | LOW | `apps/web/perf-budgets.json` | ADR-0019 | 4 routes covered; ~20 high-complexity dashboard routes added since 2026-02-28 with no budget entries |
| PD-07 | LOW | `apps/landing/perf-budgets.json` | ADR-0019 | 4 routes covered; `free-forever`, `join/*`, `docs/*` not budgeted |
| PD-08 | LOW | `apps/web/src/app/login/page.tsx:862-863` | ADR-0019§perf | `stiffness:300, damping:15` — non-canonical spring, far outside Nordic Split spec values; no token alias |
| PD-09 | LOW | `apps/web/src/components/dashboard/interactive/QuickBroadcast.tsx:19-20` | ADR-0019§perf | `stiffness:40, damping:22` — not a motionToken alias; stiffness 40 is between `spring` (35) and `springSnappy` (45) |
| PD-10 | LOW | `apps/web/src/app/globals.css:348,351,508,511` | ADR-0366§heritage | `rgba(255,107,53,…)` in `glow-pulse` keyframes + `rgba(245,158,11,…)` in `autofill-shimmer` — should use `--brand-orange`/`--warning` CSS vars |
| PD-11 | LOW | `apps/web/src/components/dashboard/GlobalCallAlert.tsx:166,182-184` | ADR-0366§heritage | `rgba(24,24,27,…)` + `rgba(34,197,94,…)` in framer-motion inline styles |
| PD-12 | LOW | `apps/web/src/components/dashboard/DashboardShell.tsx:1544,1551,1558,1565` | ADR-0366§heritage | `rgba(249,115,22,0.3)` in Tailwind shadow arbitrary values |
| PD-13 | INFO | `apps/web/src/components/helpdesk-orb/LighthouseAvatar.tsx:8` | ADR-0366 | Comment-level `oklch(0.72 0.08 50)` — code comment only, not evaluated. Not a violation per ADR-0366 §Neutral. |

---

## Baseline Delta (2026-05-18 → 2026-05-20)

| Item | Baseline | Current | Delta |
|------|----------|---------|-------|
| Component OKLCH literals | 283 hits / ~50 files | **3 hits / 2 files** | -280 hits resolved by H2 sortie |
| globals.css OKLCH outside @theme | ~18 violations | **0** (doc-* moved to tokens.css; .dark block compliant) | RESOLVED |
| Landing app OKLCH | not audited | 6 hits (4 css + 2 tsx) | NEW scope gap |
| ESLint OKLCH rule | absent | absent | UNCHANGED |
| Perf-budgets coverage | 4/~12 routes | 4/~24 routes | WORSE (new routes added, budgets not updated) |
| Motion inline magic numbers | ~19 files | ~5+ files (partial improvement) | PARTIAL |

---

## Per-ADR Rollup

| ADR | Compliant | Partial | Violation |
|-----|-----------|---------|-----------|
| ADR-0019 (perf governance) | next.config.ts optimizePackageImports ✅, serverExternalPackages ✅, ts.ignoreBuildErrors:false ✅ | perf-budgets undercoverage ⚠️ | — |
| ADR-0366 (OKLCH ban) | globals.css @theme block ✅, tokens.css canonical ✅, ~48 files cleaned ✅ | helpdesk-orb dynamic gradients ⚠️ | landing app component scope 🔴, ESLint rule absent 🔴 |

---

## Verified Intentional

- **globals.css `.dark` block (lines 118-125):** `oklch(…)` inside `.dark {}` override for `--color-phase-*` and `--color-pin` CSS custom properties. This is a CSS custom property *definition* inside the `@theme`-equivalent scoping context, not a component-scope literal. Compliant per ADR-0366 §Decision "Source of truth" — values define tokens, not consume them inline.
- **tokens.css `--avatar-fallback-gradient` (line 239):** OKLCH literal inside `packages/design-tokens/src/tokens.css` — explicitly exempt per ADR-0366 §Enforcement ("Exception: `@smartout/design-tokens` package itself + `globals.css`"). `LighthouseAvatar.tsx:54` correctly uses `var(--avatar-fallback-gradient)` for the static fallback.
- **LighthouseAvatar.tsx:53 comment (line 8):** OKLCH in code comment is non-evaluated string — explicitly permitted per ADR-0366 §Neutral clause. Logged as PD-13 INFO only.
- **login/page.tsx Google SVG `fill` attributes (lines 33-45):** Brand-mandated hex values for Google icon colours. Not Nordic Split tokens — must match Google brand spec. Not a violation.

---

## In-Progress (Mid-Campaign)

No active-campaign files flagged in this slice. The H2 OKLCH sweep merged to `campaign/ui-shell` (as of 2026-05-18 audit) and its fixes are now on `development`. The helpdesk-orb components (`Orb.tsx`, `LighthouseAvatar.tsx`) are on `development`, not inside any active campaign worktree — their violations are counted as real findings, not in-progress.

---

## Recommended Actions (Priority Order)

1. **PD-03 (MEDIUM):** Ship `nordic-split/no-oklch-literal` ESLint rule per ADR-0366 §Enforcement before the next H2-style sweep — without enforcement, violations re-accumulate. ~½ day work in `packages/eslint-config/plugins/smartout/rules/`.
2. **PD-01/PD-02 (MEDIUM):** Add parameterised orb-gradient CSS custom properties to `tokens.css` (e.g. `--orb-chroma-waiting`, `--orb-hue`) so `Orb.tsx` and `LighthouseAvatar.tsx` can reference them via `var()` with JS interpolation. The dynamic `${chroma}` multiply pattern needs a design-token–backed solution.
3. **PD-04/PD-05 (MEDIUM):** Migrate `apps/landing/src/app/globals.css` OKLCH literals into `@theme` block + add `--section-divider-fill` token. Migrate `free-forever/page.tsx` Tailwind arbitrary values to `var(--token)` form.
4. **PD-06/PD-07 (LOW):** Expand `perf-budgets.json` to cover high-complexity routes: `hms`, `year-wheel`, `season`, `payroll`, `shift-clock`, `komm`, `schedule/[id]`. Assign ownership per ADR-0019 §Consequences.
