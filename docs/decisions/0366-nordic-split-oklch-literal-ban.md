---
id: ADR-0366
title: Nordic Split — OKLCH literals forbidden in app code
status: accepted
created: 2026-05-17
updated: 2026-05-28
deciders: [pontus, council-r1-tidslinjen]
related: [ADR-0028, ADR-0335]
tags: [design-system, nordic-split, a11y, lint, css-variables]
---

# ADR-0366 — Nordic Split: OKLCH literals forbidden in app code

> Renumbered 0349 → 0361 → 0366 per outsider-renumber convention. 0361 collided with `0361-ci-migration-coherence-check.md` (development, accepted 2026-05-17) during sync. ui-shell side weaker (proposed) → renumbered to next free slot 0366.

## Status

**proposed** — drafted 2026-05-17 from Council R1 Tidslinjen post-implementation verdict. Awaits ratification + migration sortie. (Original slot: 0349; renumbered to 0361 per outsider-renumber convention — payroll kept 0347-0356 after merging to development first.)

## Context

Nordic Split design system declares all warm/cool color tones via OKLCH in the canonical token files:
- `packages/design-tokens/src/tokens.ts` (TypeScript exports)
- `packages/design-tokens/src/tokens.css` (CSS variables)
- `apps/web/src/app/globals.css` `@theme inline` block

App code consumes these via Tailwind `var(--token)` arbitrary values (e.g. `bg-[var(--warn-soft)]`) or theme-derived utilities (e.g. `bg-warn-soft` when registered in tailwind config).

Council R1 design+a11y reviewer (2026-05-17) discovered the canonical pattern is **violated systemically** in `apps/web/src/components/day/`:

| File | Line(s) | Pattern |
|---|---|---|
| `tabs/TimelineTab.tsx` | 242 | `border-[oklch(0.82_0.08_65)] bg-[oklch(0.96_0.03_65)] text-[oklch(0.35_0.10_55)]` |
| `SlotPicker.tsx` | ~multiple | inline `oklch(...)` literals |
| `ApplyTemplateDialog.tsx` | ~multiple | inline `oklch(...)` literals |
| `SavedTimelinesDropdown.tsx` | ~multiple | inline `oklch(...)` literals |
| `SaveTemplateDialog.tsx` | ~multiple | inline `oklch(...)` literals |

Steward provenance check (`git blame d0deaa6a9a`) confirmed these literals predate the Tidslinjen redesign sortie. The pattern is inherited debt from earlier ui-shell sub-sorties.

Equivalent semantic tokens already exist and have correct light + dark variants:

| Inline OKLCH (approx) | Semantic token | Location |
|---|---|---|
| `oklch(0.96 0.03 65)` (warm amber bg) | `var(--warn-soft)` | `packages/design-tokens/src/tokens.css:66, :201` |
| `oklch(0.35 0.10 55)` (warm amber text) | `var(--warn-soft-foreground)` | `packages/design-tokens/src/tokens.css:67, :202` |
| `oklch(0.82 0.08 65)` (warm amber border) | `var(--warn-soft-foreground)` @ 40% or `--border` | derived |

## Decision

**Forbid inline `oklch(...)` literals in `apps/web/**`, `apps/mobile/**`, and `apps/landing/**`.**

1. **Source of truth:** All OKLCH values live in `packages/design-tokens/src/tokens.{ts,css}` and `apps/web/src/app/globals.css` `@theme` block — nowhere else.
2. **Consumption:** Apps consume colors only via:
   - Tailwind theme tokens (`bg-background`, `text-foreground`, `bg-warn-soft`, etc.)
   - `var(--token-name)` arbitrary values (`bg-[var(--warn-soft)]`)
   - `@smartout/design-tokens` TypeScript exports (`tokens.color.warnSoft`)
3. **Enforcement:** ESLint rule `nordic-split/no-oklch-literal` (new) scans `apps/**` for `oklch(` inside JSX class strings, inline `style={}` objects, and CSS-in-JS template literals. Exception: `@smartout/design-tokens` package itself + `globals.css`.
4. **Migration:** A dedicated sortie maps each existing literal to its semantic token. Where no token exists, add the token to `tokens.css` first, then migrate consumers.

## Consequences

**Positive:**
- Dark mode parity: every color automatically picks up its dark variant via the CSS variable layer. Inline OKLCH skips this.
- Future theme tuning is a single-file change in tokens, not a codebase-wide grep.
- Future a11y contrast audits run against the token registry, not scattered class strings.
- Council R1 design+a11y axis stops re-finding the same class of defect in subsequent reviews.

**Negative:**
- Migration sortie touches 6+ files in `components/day/` alone; likely more across `components/` and `app/` if grep widens scope.
- One-off "warm amber" inline values that have no exact token match will require adding new tokens (e.g. `--data-estimate-soft`) before migrating consumers.

**Neutral:**
- Lint rule must allow `oklch(` substrings inside string-literal contexts that document tokens (e.g. ADR markdown, code comments). Rule scope: AST positions inside `className`, `class`, and CSS template literals only.

## Alternatives Considered

1. **Status quo + per-finding fixes.** Rejected — the same literals keep showing up in Council reviews; addressing one at a time costs more in cumulative review time than a single migration sortie.
2. **Allow literals but require a token-equivalent comment.** Rejected — adds maintenance burden without solving the dark-mode parity problem.
3. **Generate tokens from inline literals retroactively.** Rejected — produces a sprawling token registry with no semantic naming; defeats the purpose of design tokens.

## Implementation Notes

- The Tidslinjen Council R1 follow-up sub-sortie (this branch, `feat/ui-shell-ui-shell-tidslinjen-a11y-polish`) explicitly defers `TimelineTab.tsx:242` migration to this ADR. Sub-sortie scope is sortie-introduced a11y regressions only.
- Lint rule should be authored in `packages/eslint-config/` next to existing custom rules.
- Migration sortie acceptance: zero `oklch(` matches in `grep -r 'oklch(' apps/ | grep -v test | grep -v stories`.

## References

- Council R1 verdict, 2026-05-17 — `docs/council/COUNCIL-LOG.md`
- `learning_phase3_coverage_gap_design_axis.md` — why design axis was missed in Phase 3
- ADR-0028 (Nordic Split design system, OKLCH adoption)
- ADR-0335 (Timeline Templates testids — adjacent design surface)
- Sibling ADR-0363 (`getPhaseBoundaries` presentation-layer ontology — same R1 council)

---

## Addendum — Enforcement (2026-05-28)

> Added by sortie `feat/design-token-sweep-web-oklch` (commits `1da0f1ca4` → `fb48ecd91`). ADR-0366 remains the source of truth; this addendum captures the enforcement mechanism.

**Status promoted: proposed → accepted** (enforcement now live in pre-push + CI).

### Rule

**Path:** `packages/eslint-config/plugins/smartout/rules/no-oklch-literal.mjs`

Implemented as a custom ESLint rule using AST analysis. Visits `Literal` nodes and `TemplateElement` quasis; errors on any string containing `oklch(` followed immediately by a digit or decimal point. Rule ID: `nordic-split/no-oklch-literal`.

### Wiring

| Surface | Config file | Severity |
|---|---|---|
| `apps/web/` + `apps/landing/` | `packages/eslint-config/next.mjs` | `error` |
| `apps/mobile/` | `apps/mobile/eslint.config.mjs` | `error` |

### Scope decision (Decision #2)

Rule `files` pattern is `**/*.{ts,tsx,js,jsx}` — wider than `apps/web/` alone. Rationale: ADR-0366 does not carve out `supabase/functions/` or `services/`; conservative coverage costs nothing. `.css` files are excluded from ESLint's file graph, so `globals.css` (the canonical token definition file) is naturally exempt with no explicit override needed.

### ESLint-only, no Stylelint (Decision #1)

Stylelint was NOT introduced. Rationale: zero standalone `.css` OKLCH violations exist outside `globals.css` (which is exempt by scope). ESLint is already wired into editor LSP, husky pre-push, and CI; adding Stylelint would expand the dependency tree for zero payoff. If Stylelint is introduced in the future, the `globals.css` exemption intent is preserved in a dead `ignorePatterns` entry with a source comment: "Listed for future Stylelint-mirror parity".

### Regex hardening (Decision #3)

**Final regex:** `/oklch\s*\(\s*[\d.]/i`

Original regex `/oklch\(/i` fired false-positives on the prefix-detection idiom:

```ts
// apps/mobile/src/theme/colors.ts:44
if (color.startsWith("oklch(")) { … }
```

This is a legitimate string-parsing context where the value `"oklch("` is a sentinel, not a color literal. Tightening to require a digit or decimal point in value position eliminates the false-positive class while still catching all actual color literals (`oklch(0.96 0.03 65)`, `oklch(0.82 0.08 65)`, etc.).

### Sweep approach for runtime-parametrized gradients (Decision #4)

Two components in `apps/web/src/components/helpdesk-orb/` (commit `6d484e51e`) used `oklch(...)` inside template-literal `radial-gradient(...)` strings with runtime `chroma` parametrization via the `chroma-js` library. These could not be replaced by a static CSS variable.

Approach: gradient definitions moved to `globals.css` as CSS selectors (`[data-halo]`, `[data-orb-gradient]`) with `--orb-chroma` declared as a CSS custom property. Inline `style={{ "--orb-chroma": value }}` injects the runtime-computed value; CSS `calc()` scales chroma inside the gradient expression. The `oklch(...)` literal lives in `globals.css` (exempt by scope), satisfying ADR-0366 while preserving the dynamic behaviour.

### Test coverage

**19 RuleTester cases:** 12 valid (should not trigger) + 7 invalid (must trigger).

Notable valid cases:
- Code comment containing `oklch(0.96 0.03 65)` — comment nodes never visited
- `color.startsWith("oklch(")` prefix-test × 2 — no digit after `(`
- Regex literal `/oklch\(/` — regex node, not string literal

Notable invalid cases:
- Tailwind arbitrary class `className="bg-[oklch(0.96_0.03_65)]"`
- Template literal `` style={{ background: `oklch(0.5 0.1 200)` }} ``
- Uppercase `OKLCH(0.5 0.1 200)` (case-insensitive flag)

### Enforcement layers

1. **Editor (LSP):** LSP picks up the rule via the shared ESLint config on save — developers see red underlines immediately.
2. **Pre-push (husky):** `pnpm lint` runs `eslint` including this rule; push is blocked on violation.
3. **CI:** `pnpm lint` runs in the `lint` job at `.github/workflows/ci.yml:32`; PR merge is blocked on failure.

### Post-sortie verification (2026-05-28)

| Check | Result |
|---|---|
| `pnpm turbo typecheck` (52 tasks) | 0 errors |
| `pnpm --filter web lint` | 0 errors, 1221 pre-existing warnings (none `no-oklch-literal`) |
| `pnpm --filter @smartout/mobile lint` | 0 errors, 0 OKLCH violations |
| `pnpm --filter @smartout/eslint-config test` | 19/19 RuleTester cases pass |
| `grep "oklch\(" apps/web/src/components apps/web/src/app` (excl. globals.css + tests) | 1 hit: JSDoc comment `LighthouseAvatar.tsx:8` — correctly ignored by rule (comment node) |

### Remaining known literal

`apps/web/src/components/helpdesk-orb/LighthouseAvatar.tsx:8` — JSDoc comment retaining `oklch(...)` as a design annotation. The rule correctly ignores this (comment nodes are never visited by AST literal checks). Cosmetic; no functional or enforcement impact.

### Out of scope (deferred to follow-up sortier)

1. **T3 zinc/slate/gray-N (4 hits):** `contract-preview-editor.tsx:73,76,81` + `contracts-data-table.tsx:868` use `bg-white text-zinc-900` for intentionally theme-invariant print/legal-document surface. Design-system decision needed: `paper-bg`/`paper-text` semantic tokens vs annotated exemption.
2. **Hex sweep Bucket B (171 hits):** categorized in `docs/audits/2026-05-28-oklch-sweep/hex-buckets.md`. Split into 3 follow-up sortier (B1/B2/B3).
3. **Hex Bucket C ambiguous (15 hits):** chart fills + ring-offset fallbacks. Needs design-system review (`chart-grid-*` token family or palette mapping).
