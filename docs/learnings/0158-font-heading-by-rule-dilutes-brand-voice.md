---
id: L-0158
title: font-heading applied by rule (not judgment) dilutes brand voice
status: accepted
updated: 2026-04-28
created: 2026-04-28
module: design-system
tags: [nordic-split, typography, polish, font-heading]
---

# L-0158 — `font-heading` applied by rule dilutes brand voice

## Context

Route polish wave 1-7 (commit `b6c6680e`) added `font-heading` (Instrument Serif) to 33 sites across 13 page.tsx files. The rule applied was mechanical: "any h1/h2/h3 missing the class gets it". Council R1 (frontend-designer) flagged ~15-20 of these as semantic overuse.

## What we learned

**Instrument Serif is display typography, not heading typography.** The Nordic Split SKILL.md line `"Instrument Serif | Headings | font-heading"` is ambiguous; the styleguide (`docs/design/ren-og-varm-styleguide.html`) and the Year Wheel ADR-0164 precedent are explicit: serif is for **brand moments**, sans is for **functional structure**.

Three semantic classes were conflated by the rule:

| Class | Example | Correct font |
|-------|---------|--------------|
| Display heading (page hero, brand statement) | `Teamet ditt, klar fra dag en` | `font-heading` ✓ |
| Functional section heading (card title, region label) | `Konfigurasjon`, `Revenue vs Cost` | Geist Sans (default) |
| Tabular/data heading | `{n} deviations` | Geist Sans + `font-mono` for digits |

Applying serif to `Konfigurasjon` (5-letter card-title above settings card) reads as "magazine cover", not "settings region". The brand voice gets diluted across 60 routes simultaneously.

## Heuristic for future polish passes

**`font-heading` IFF the heading is a brand statement** — a sentence that markets, welcomes, or names a hero element. Functional structure labels, card titles, and data counts stay Geist Sans.

This rule must be applied **per-heading by judgment**, not by grep-pass. Cross-route mechanical sweeps that touch typography MUST classify each heading before adding the class.

## Pattern signature

- Cross-route polish pass uses grep + checklist
- Reviewer applies rule literally to each missing match
- Result is rule-conformant but semantically wrong on ~20-30% of sites
- Brand voice dilutes faster than the polish ships value

## Action

Future cross-route typography passes:
1. Pre-classify routes/headings by `display | functional | tabular` before applying `font-heading`.
2. Frontend-designer review BEFORE ship, not after, when scope is ≥10 routes.
3. Reference Year Wheel ADR-0164 typography precedent in plan briefing.

## Related

- ADR-0164 (Year Wheel typography reservation)
- L-0143 (pattern claims must be quantified)
- Council 2026-04-28 (route polish wave 1-7 R1 verdict)
- Nordic Split SKILL.md typography section
