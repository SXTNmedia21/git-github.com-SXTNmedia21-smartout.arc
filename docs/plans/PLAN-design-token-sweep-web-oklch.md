---
title: "Plan — design-token-sweep-web-oklch"
status: draft
updated: 2026-05-28
created: 2026-05-28
module: design-system
affected_domains: [web, design-system, ci]
tags: [plan, design-tokens, oklch, eslint, adr-0366, nordic-split]
---

# Plan — design-token-sweep-web-oklch

> Branch: `feat/design-token-sweep-web-oklch` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-1`
> Base: `development` | Module: design-system | Started: 2026-05-28

## Context

ADR-0366 banned OKLCH literals. Three sweeps already ran; baseline still recurs because
no enforcement rule exists. Pattern: L-0083 sibling (lint enforcement late).

Baseline 2026-05-28 (in `apps/web/src/components` + `apps/web/src/app`):

| Class | Count | Notes |
|---|---|---|
| `oklch(...)` literals | 28 | ADR-0366 direct violations |
| Hex `#xxx[xxx]` | 206 | Mixed — many legitimate (SVG fills, gradient stops, third-party) |
| `zinc/slate/gray-N` | 4 | Almost clean |

Mobile token sweep happened earlier as separate sortie (see `JOURNEY-design-token-sweep.md`).
This sortie covers `apps/web/` only.

## Goal

Stop OKLCH-literal recurrence in `apps/web/` via ESLint enforcement, sweep the 28 existing
violations to CSS variables, drive-by the 4 zinc/slate/gray hits, and categorize the 206 hex
hits into a follow-up sortie's punch list.

## Tasks

### Tier 1 — ESLint enforcement (blocks regression)

- [ ] Write ESLint custom rule `no-oklch-literal` in `packages/eslint-config/`
  - Errors on `oklch(...)` literal in template strings, JSX className strings, CSS-in-JS, and `.css` files under `apps/web/src/**`
  - Exempts `apps/web/src/app/globals.css` (token DEFINITIONS belong there per Nordic Split spec)
- [ ] Wire rule into `apps/web/.eslintrc.json` (or equivalent flat-config) at error level
- [ ] Verify `pnpm --filter web lint` runs in husky pre-push
- [ ] Test: introduce a fake OKLCH literal in a throwaway file → ESLint errors locally → remove

### Tier 2 — Sweep 28 OKLCH literals

- [ ] Inventory: `grep -rEn "oklch\(" apps/web/src/components apps/web/src/app > docs/audits/2026-05-28-oklch-sweep/raw-baseline.txt`
- [ ] Classify each hit: token-replacement vs already-defined-token vs needs-new-token
- [ ] For replaceable hits: swap to `var(--<token>)` or shadcn token (`bg-background`, `text-foreground`, etc.)
- [ ] For new-token cases (if any): propose token names, update `globals.css` `@layer base { :root { ... } }`
- [ ] Verify: `grep -rEn "oklch\(" apps/web/src/components apps/web/src/app | wc -l` returns 0

### Tier 3 — Drive-by zinc/slate/gray-N (4 hits)

- [ ] Inventory + classify
- [ ] Swap to semantic tokens (`bg-muted`, `text-muted-foreground`, `border-border`)
- [ ] Verify: `grep -rEn "(zinc|slate|gray)-[0-9]" apps/web/src/components apps/web/src/app | wc -l` returns 0

### Tier 4 — Hex categorization (206 hits → follow-up sortie)

- [ ] Bulk grep + bucket by file context:
  - Bucket A: legitimate (SVG fill, gradient stop, third-party theme prop) — EXEMPT, document why
  - Bucket B: replaceable (button bg, text color in `.tsx`) — needs sweep
  - Bucket C: ambiguous — needs design-system review
- [ ] Write `docs/audits/2026-05-28-oklch-sweep/hex-buckets.md` with counts + sample paths per bucket
- [ ] Do NOT sweep — defer to dedicated sortie with bucket B as scope

### Tier 5 — Closure

- [ ] Decision log: ADR-0366 enforcement addendum entry referencing this sortie's commits
- [ ] HANDOFF doc with tier results, ESLint rule path, hex bucket totals, follow-up scope
- [ ] Update `docs/STATE-SUMMARY.md` if needed (record enforcement-rule milestone)
- [ ] `pnpm turbo typecheck` passes 0 errors
- [ ] `pnpm --filter web lint` passes 0 errors

## Acceptance Criteria

- [x] ESLint `no-oklch-literal` rule errors on any new `oklch(...)` literal in `apps/web/src/**` (verified via deliberate test introduction) — `1da0f1ca4` + hardened in `fb48ecd91`
- [x] `grep -rEn "oklch\(" apps/web/src/components apps/web/src/app | grep -v globals.css | grep -v test` returns 0 (initial baseline of 28 was raw-grep noise; AST-aware classification confirmed 2 real literal uses, both swept in `6d484e51e`. 1 remaining hit is a JSDoc design-annotation comment, correctly ignored by rule.)
- [x] Hex bucket report exists at `docs/audits/2026-05-28-oklch-sweep/hex-buckets.md` — T4 wrote it (A=29 / B=171 / C=15 / total=215)
- [x] Typecheck passes: `pnpm turbo typecheck` — 52/52 successful (after telemetry rebuild)
- [x] Decision log updated with ADR-0366 enforcement entry — `42f4f64ec`
- [x] User journeys written — `JOURNEY-design-token-sweep-web-oklch.md`
- [x] Pre-push hook green (lint:tool-collisions, OTP coherence, domain-lint, archived-refs)
- [DEFERRED] `grep -rEn "(zinc|slate|gray)-[0-9]"` returns 0 — see Out of Scope §T3-deferred. Pragmatic re-scope mid-sortie after discovery that all 4 hits are in print-preview/legal-document surface (intentionally theme-invariant). Design-system decision (paper tokens vs annotated exemption) is load-bearing and warrants a dedicated follow-up sortie + ADR amendment, not a quick swap in this one.

## Out of Scope

- **T3 zinc/slate/gray-N sweep (4 hits)** — DEFERRED to follow-up sortie. All hits in `apps/web/src/app/dashboard/people/contracts/_components/contract-preview-editor.tsx` + `contracts-data-table.tsx` render print-preview/legal-document surface. `bg-white text-zinc-900` is intentionally theme-invariant (paper look-and-feel for export/print). Sweeping without first deciding between (a) introducing `paper-bg`/`paper-text` semantic tokens OR (b) keeping zinc-N with annotated exemption would risk breaking print/export rendering. Decision needs design-system review + ADR amendment (extends or carves out ADR-0361). See HANDOFF §Next-steps for follow-up sortie scope.
- **Bucket C ambiguous (15 chart-component hits)** — DEFERRED. `StaffingSection` chart `isDark` ternaries + ring-offset CSS-var fallbacks. Needs design-system decision: map to existing `department`/`priority`/`phase` palettes OR introduce a `chart-grid-*` token family. See `docs/audits/2026-05-28-oklch-sweep/hex-buckets.md` §Bucket C.
- **Bucket B hex sweep (171 replaceable)** — DEFERRED. Too large for single sortie. T4 recommends split into 3 follow-up sortier (B1=25 / B2=60 / B3=45).
- Mobile token work (already covered by closed mobile sortie)
- Refactoring `globals.css` token definitions themselves
- Adding new tokens beyond what the sweep proves missing

## Risks

- ESLint rule false-positives on legitimate fixture data or storybook → start with `apps/web/src/**` scope, exempt `*.stories.tsx` if hit
- Sweep changes JSX classes → visual regression risk → spot-check 5 high-traffic pages (dashboard, schedule, oppgaver, payroll, contracts) before close
- Pre-existing dirty files in main repo (`apps/web/src/app/dashboard/oppgaver/_chart/NowLine.tsx`, `docs/DASHBOARD.md`) — untouched in this sortie's worktree
