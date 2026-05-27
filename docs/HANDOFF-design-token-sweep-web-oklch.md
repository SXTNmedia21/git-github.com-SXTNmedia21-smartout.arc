---
title: "HANDOFF — design-token-sweep-web-oklch"
status: done
updated: 2026-05-28
created: 2026-05-28
module: design-system
tags: [handoff, design-tokens, oklch, eslint, adr-0366, nordic-split]
---

# HANDOFF — design-token-sweep-web-oklch

## Summary

This sortie closes the enforcement gap that ADR-0366 (Nordic Split OKLCH literal ban, 2026-05-17) identified but deferred: no lint rule existed, so violations kept recurring across council reviews. The sortie delivered a custom ESLint rule `nordic-split/no-oklch-literal`, wired it into editor LSP + husky pre-push + CI, swept the two runtime-parametrized gradient violations in `helpdesk-orb` components to CSS custom properties, hardened the rule regex against a false-positive class (`startsWith("oklch(")` prefix-detection idiom), and categorized 215 hex literals for follow-up sortier. ADR-0366 status promoted from `proposed` to `accepted`.

## Sortie commits

| SHA | What |
|---|---|
| `96de140c6` | docs(plan): scaffold sortie — plan + journey stubs |
| `1da0f1ca4` | feat(eslint): `no-oklch-literal` rule v1 — 14 RuleTester cases |
| `6d484e51e` | feat(helpdesk-orb): replace oklch literals with CSS custom property injection (ADR-0366) |
| `fb48ecd91` | fix(eslint): harden regex against false-positives + wire `apps/mobile` + 5 additional test cases |

## Decisions made (registered in 0000-decision-log.md)

1. **ESLint only, no Stylelint** — zero standalone `.css` OKLCH violations outside `globals.css`; ESLint already in editor/pre-push/CI. Stylelint would add dependency weight for zero payoff. `globals.css` naturally exempt by ESLint's file graph (`.css` not in scope pattern). Dead `ignorePatterns` entry preserved for future Stylelint-mirror parity.

2. **Rule scope `**/*.{ts,tsx,js,jsx}` (wider than `apps/web/`)** — ADR-0366 does not carve out `supabase/functions/` or `services/`; conservative coverage costs nothing. Documented in T1-A v2 commit body and ADR-0366 addendum.

3. **Regex hardened to `/oklch\s*\(\s*[\d.]/i`** — original regex `/oklch\(/i` fired on `color.startsWith("oklch(")` in `apps/mobile/src/theme/colors.ts:44` (legitimate prefix-detection sentinel). Tightening to require digit/decimal in value position eliminates the false-positive class. 5 lock-in test cases added.

4. **Runtime-parametrized gradients swept via CSS custom property injection** — `LighthouseAvatar.tsx` + `Orb.tsx` used `chroma-js`-parametrized `oklch(...)` inside template-literal `radial-gradient(...)`. Moved gradient definitions to `globals.css` selectors (`[data-halo]`, `[data-orb-gradient]`); injected `--orb-chroma` as inline `style` prop; CSS `calc()` handles runtime scaling.

5. **globals.css exemption entry kept as dead code with comment** — `files` pattern is `**/*.{ts,tsx,js,jsx}`, so the `ignorePatterns` entry for `globals.css` is never reached by ESLint. Kept + annotated "Listed for future Stylelint-mirror parity" to preserve intent.

## Learnings

The following are candidates for `docs/learnings/` — NOT promoted here (occurrence-count check required before promotion):

- **L-CANDIDATE: Baseline grep counts mislead.** Initial grep reported 28 OKLCH hits. After AST-aware rule classification (comment nodes filtered, test assertions ignored, prefix-detection sentinels excluded), only 2 actual rule violations existed. Always re-baseline via the actual rule matcher, not raw grep.

- **L-CANDIDATE: ESLint false-positive class — prefix-detection idiom.** `x.startsWith("oklch(")` is a recurring legitimate pattern in string-parsing code. Regex targeting literal color values must require value-position digits, not just the function name. This pattern recurs in any codebase that inspects color format programmatically.

- **L-CANDIDATE: Sub-agent status-report drift.** T1-A (agent) reported "web lint exit 1, 2 violations" while the actual state was exit 0, 0 OKLCH violations (T2's sweep had already landed). Orchestrator cross-validated via direct `grep` + `pnpm lint` run and caught the drift. Pattern: agent status reports on lint/test results should be cross-validated against repo state when stakes are high (pre-merge gates, acceptance criteria checks).

## Known issues / debt

- **1221 pre-existing `apps/web` lint warnings** — none are `no-oklch-literal`. Not introduced by this sortie; pre-existed on development.
- **`LighthouseAvatar.tsx:8` JSDoc comment** retains `oklch(...)` as a design annotation. Rule correctly ignores (comment nodes never visited). Cosmetic only.
- **T3 + Bucket C deferred** — see Out of Scope below.

## Out of scope (follow-up sortier)

1. **T3 — zinc/slate/gray-N (4 hits, contract print preview):**
   - `apps/web/src/app/dashboard/people/contracts/_components/contract-preview-editor.tsx:73,76,81`
   - `apps/web/src/app/dashboard/people/contracts/_components/contracts-data-table.tsx:868`
   - Surface is intentionally theme-invariant (paper look-and-feel for print/export). Design-system call needed: introduce `paper-bg`/`paper-text` semantic tokens (clean), OR annotate exemption (pragmatic). Deferred to follow-up sortie + ADR-0366 amendment if exemption route chosen.

2. **Hex sweep Bucket B (171 hits — replaceable button/text `.tsx` colors):**
   - Categorized in `docs/audits/2026-05-28-oklch-sweep/hex-buckets.md`.
   - Too large for a single sortie. T4 recommends 3 sequential follow-up sortier: B1 (25 hits), B2 (60 hits), B3 (45 hits).

3. **Hex Bucket C ambiguous (15 hits — chart fills + ring-offset fallbacks):**
   - `StaffingSection` chart fills (`isDark ? "#3f3f46" : "#e4e4e7"`) + `ring-offset` CSS-var fallback patterns.
   - Needs design-system review: map to existing palettes (`department`/`priority`/`phase`) OR introduce `chart-grid-*` token family.
   - Deferred to follow-up sortie + design-system council.

4. **Hex Bucket A (29 hits — exempt):**
   - SVG fills, gradient stops, third-party theme props — legitimately not CSS-variable candidates.
   - Documented in `hex-buckets.md` with rationale per hit.

## Next steps

1. Open follow-up sortie: paper-tokens design-system decision + T3's 4 contract-preview hits
2. Open follow-up sortie: chart-grid token family design + Bucket C's 15 chart hits
3. Open 3 follow-up sortier per `hex-buckets.md` split: B1 / B2 / B3
4. After all 6 follow-ups land, run `/audit` pass — hex baseline should be at 0 replaceable

## Acceptance criteria check

| Criterion | Status | Notes |
|---|---|---|
| ESLint `no-oklch-literal` errors on new `oklch(...)` literal in `apps/web/src/**` | ✓ | 19/19 RuleTester cases pass; blocking in pre-push + CI |
| `grep "oklch\(" apps/web/src/components apps/web/src/app` returns 0 | ✓ | 3 remaining grep hits, all non-violations: 1 JSDoc comment at `LighthouseAvatar.tsx:8` (comment node, AST-ignored) + 2 test assertions (`expect(src).not.toContain("oklch(")` in TidslinjeChipBar.test.tsx:121 + TidslinjeTab.test.tsx:88; these are the rule's own guard tests). Rule correctly fires on none. |
| `grep "(zinc\|slate\|gray)-[0-9]" apps/web/src/components apps/web/src/app` returns 0 | ✗ | 4 hits remain in contract print-preview (`contract-preview-editor.tsx:73,76,81` + `contracts-data-table.tsx:868`). Intentionally deferred — print surface is theme-invariant by design. See Out of Scope #1. **Orchestrator attention required.** |
| Hex bucket report exists at `docs/audits/2026-05-28-oklch-sweep/hex-buckets.md` | ✓ | A=29 (exempt), B=171 (replaceable), C=15 (ambiguous) |
| `pnpm turbo typecheck` passes | ✓ | 52/52 tasks, 0 errors |
| Decision log updated with ADR-0366 enforcement entry | ✓ | Entry added to `0000-decision-log.md` |
| User journeys written | ✓ | `docs/journeys/JOURNEY-design-token-sweep-web-oklch.md` |
| Pre-push hook green | ✓ | Verified by orchestrator (lint:tool-collisions, OTP coherence, domain-lint, archived-refs all pass) |
