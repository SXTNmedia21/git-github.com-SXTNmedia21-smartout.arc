---
title: Handoff — Nordic Split Design Token Sync
status: done
updated: 2026-03-26
created: 2026-03-26
module: design-system
tags: [design-tokens, nordic-split, dark-mode, handoff]
---

# Handoff: Nordic Split Design Token Sync

## What Was Built

Corrected and synchronized the three design token files to fully align with the "Nordic Split" design system (formerly "Ren og Varm"):

- **`packages/design-tokens/src/tokens.ts`** — Added section comments to light/dark objects. Verified all warm OKLCH surface values (hue 50-60) are present and correct.
- **`packages/design-tokens/src/tokens.css`** — Fixed 4 dark mode values (`secondary-foreground`, `accent-foreground`) that were using cold zinc values. Dark mode block now mirrors `tokens.ts` exactly.
- **`packages/design-tokens/src/native.ts`** — Full rewrite with warm hex values and OKLCH inline comments for mobile parity.
- **`CLAUDE.md`** + landing page title — Renamed "Ren og Varm" → "Nordic Split".

## Decisions Made

- Retained `ren-og-varm-styleguide.html` filename — it's a historical artifact and the file is loaded by path in many places. Renaming would break references.
- Norwegian-language references in older docs/specs are historical snapshots — left in place per plan.

## Learnings

- Tokens.css dark mode and tokens.ts were out of sync. The pattern to avoid this: always update both files in the same commit when changing token values.
- native.ts was the most stale — it had cold gray/zinc values throughout. Mobile tokens need to be part of every design system update pass.

## Known Issues / Debt

- ~140 files still use hardcoded `zinc-*`/`gray-*` classes instead of CSS variable classes. This is tracked as backlog (logged in memory). Not in scope for this feature.
- `ren-og-varm-styleguide.html` filename is a minor inconsistency — acceptable for now.

## Next Steps

- Future: sweep hardcoded zinc/gray classes in a dedicated cleanup pass.
- Future: add a lint rule to catch hardcoded color values at CI time.
