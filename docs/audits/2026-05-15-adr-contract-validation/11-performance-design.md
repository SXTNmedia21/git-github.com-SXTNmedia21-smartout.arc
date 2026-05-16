---
title: "Audit Slice 11 — Performance & Design"
status: done
created: 2026-05-15
updated: 2026-05-15
module: audit
tags: [audit, performance, design, adr]
---

# Slice 11 — Performance & Design

**Date:** 2026-05-15  
**Branch:** development HEAD  
**Auditor:** Sonnet 4.6 (subagent)  
**ADR scope:** ADR-0019  
**Anchor:** docs/architecture/cross-cutting/performance-governance.md

---

## Summary

- 2 HIGH findings (carry-forward from 2026-05-13 baseline, partially addressed)
- 1 MEDIUM finding (new)
- 1 LOW finding (new)
- 2 CLOSED since 2026-05-13 (F-01 web fixed, F-02 web fixed)
- Design token adoption is strong; hardcoded brand-color usage is widespread but categorized as LOW given the tokens.ts source of truth is correct

---

## Findings Table

| ID | Severity | File | Line(s) | Description | ADR |
|----|----------|------|---------|-------------|-----|
| F-01 | HIGH (carry) | `apps/landing/next.config.ts` | 32 | `optimizePackageImports` missing `@smartout/ui`, `date-fns`, `sonner`, `@tiptap/*`, `@dnd-kit/*` vs web list | ADR-0019 |
| F-02 | HIGH (carry) | `apps/landing/next.config.ts` | 89–93 | Sentry `withSentryConfig` applied unconditionally — no `VERCEL_ENV === "production"` gate; uploads source maps on every build including local/preview | ADR-0019 |
| F-03 | MEDIUM (new) | `apps/landing/next.config.ts` | 23, 51–85 | `turbopack: {}` declared (enables Turbopack) but webpack aliases still present with no `turbopack.resolveAlias` mirror; landing is missing the 3 journey-ops aliases (`@smartout/ai/journey-ops/runbook`, `/agents/journey-ops`, `/tools/journey-ops`) that web carries | ADR-0019 |
| F-04 | LOW (new) | `apps/web/src/**` | multiple | 483 uses of `bg-orange-*`/`text-orange-*`/`border-orange-*`, 136 `bg-rose-*`/`text-rose-*`, 43 `bg-indigo-*`/`text-indigo-*`, plus inline `rgba(249,115,22,...)` and `#FF6B35` in DashboardShell, NotificationBell, ReconciliationView — should use `--brand-orange` / `--destructive` / CSS variable utilities | Nordic Split |
| F-05 | LOW (carry) | `apps/web/src/app/dashboard/contracts/` | 73, 76, 81, 855 | `bg-white text-zinc-900 border-zinc-200` hardcoded in contract preview/data-table — contract canvas intentionally mimics print-white surface; partially justified but not documented | Nordic Split |

---

## Per-ADR Rollup

### ADR-0019 — Performance and Build Governance

Requirements:
1. `optimizePackageImports` must include heavy icon/animation/component packages for both web and landing
2. Sentry source-map upload must be gated on `VERCEL_ENV === "production"` (30–60s build cost savings on non-prod)
3. Route budget files must exist and be maintained
4. Build health: `typescript.ignoreBuildErrors: false`

**Status:**

| Requirement | web | landing |
|-------------|-----|---------|
| optimizePackageImports complete | PASS (13 packages) | FAIL — 3 packages only |
| Sentry gate | PASS (`shouldUploadSourceMaps` var) | FAIL — unconditional |
| Turbopack resolveAlias | PASS (11 subpaths) | PARTIAL — empty `{}`, no aliases, 3 missing vs web |
| perf-budgets.json exists | PASS | PASS |
| ignoreBuildErrors: false | PASS (re-enabled SMA-353) | not set (defaults false) |

---

## Verified Intentional

- **`apps/web/next.config.ts:67-82` Turbopack + `apps/web/next.config.ts:95-157` webpack dual config** — Both must coexist because Turbopack cannot read `config.resolve.alias` from the webpack callback. The aliases are intentionally duplicated. Comment at line 108 confirms this pattern. NOT a violation; is the accepted migration path.
- **`apps/web/next.config.ts:188-194` `ignoreBuildErrors: false`** — Re-enabled per SMA-353 / ADR-0019; comment confirms rationale. PASS.
- **`apps/landing/next.config.ts:23` `turbopack: {}`** — Empty object enables Turbopack for landing dev. Landing has no Turbopack alias table; landing's AI imports via webpack aliases only (line 51–85). No evidence landing uses journey-ops subpaths in its own pages, so gap is low-urgency but incomplete parity.
- **`packages/design-tokens/src/tokens.ts`** — All colors are OKLCH with hue in 40–60 range for brand surfaces. Fully compliant. tokens.css is auto-derived correctly.
- **`apps/web/src/app/globals.css`** — Tailwind v4 CSS-config pattern (`@import "tailwindcss"` + `@theme inline`). No `tailwind.config.ts` in apps/web or apps/landing. PASS.
- **`apps/web/src/app/globals.css:340,343` `rgba(255,107,53,...)` in glow-pulse** — Used as CSS custom property fallback `var(--glow-brand, rgba(...))`. Acceptable — the fallback is only reached if `--glow-brand` is unset; primary value is token-backed.
- **Contract canvas `bg-white text-zinc-900` (F-05)** — Contract preview must render a white print-like surface regardless of theme. Contextually justified but undocumented. Warn only.

---

## In-Progress / Known

- **F-01 and F-02** were flagged as HIGH on 2026-05-13 baseline for landing. Wave 1 (2026-04-29) shipped web fixes only. Landing remains unfixed.
- **F-04 hardcoded brand colors** — 656 total instances of hardcoded Tailwind color classes in `apps/web/src`. This is a diffuse technical debt item consistent with a codebase that grew before Nordic Split tokens were fully mapped to Tailwind utilities (`--color-brand-orange` → `text-brand-orange`). Not an ADR violation but contradicts CLAUDE.md "never use hardcoded colors" rule. Recommend a single cleanup sortie targeting `DashboardShell.tsx` first (highest concentration).

---

## Delta vs 2026-05-13

| Finding | 2026-05-13 | 2026-05-15 | Change |
|---------|------------|------------|--------|
| F-01 optimizePackageImports drift | HIGH (both web+landing) | HIGH (landing only) | PARTIAL FIX — web resolved |
| F-02 Sentry unconditional | HIGH (both) | HIGH (landing only) | PARTIAL FIX — web resolved |
| Turbopack alias gap (landing) | blocker noted (web focus) | MEDIUM (new scoped) | NEW |
| Hardcoded color volume | not measured | LOW | NEW |
| web webpack alias count | 12 noted | 12 (unchanged) | STABLE |
| tailwind.config.ts | absent (correct) | absent (correct) | STABLE |
| tokens.ts OKLCH compliance | not checked | PASS | VERIFIED |
| ignoreBuildErrors web | was true (risky) | false (fixed SMA-353) | CLOSED |
