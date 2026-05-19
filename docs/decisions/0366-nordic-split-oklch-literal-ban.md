---
id: ADR-0366
title: Nordic Split — OKLCH literals forbidden in app code
status: proposed
created: 2026-05-17
updated: 2026-05-17
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
