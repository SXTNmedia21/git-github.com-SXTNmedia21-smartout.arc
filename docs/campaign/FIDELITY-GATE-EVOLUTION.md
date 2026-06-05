---
title: Design Fidelity Gate — evolution (Pontus, 2026-06-03)
status: draft
updated: 2026-06-03
created: 2026-06-03
module: design-handoff
tags: [fidelity-gate, evolution, screening, aggregates, mood, decisions]
---

# Fidelity Gate — evolution (next, beyond the 8 dimensions)

> Captured from Pontus, 2026-06-03. The 8-dimension gate compares *existing* elements. These additions
> make it **screen, aggregate, and decide** — catching what a per-element diff misses.

## 1. Screen ALL elements → group → detect what's MISSING

Don't only compare elements that exist on both sides. **Inventory every element, group them, diff the
GROUPS** design-vs-live → so a *missing* group is caught (not just a mismatched one). "Da hadde vi kjent
at vi mangler noe." A per-element diff can't see an absent element; a group-screen can.

## 2. Page-level aggregate metrics ("the whole-page feel")

Beyond per-element px, measure the **page as a whole** — these are gradable totals:

- **Color count** — how many *distinct* colors on the page (design vs live).
- **Color concentration** — overall distribution/density of color (is it as warm/sparse as the design?).
- **Rounding count** — how many rounded corners / the radius profile across the page.
- **Border lengths** — total/character of borders.

These catch "teksten er litt for stor overalt" / "mangler 16 kanter" / "feel is off" — drift that's
invisible per-element but obvious in aggregate.

## 3. The "life / mood" dimension — 90% of the vibe

Pontus: *"det som skaper 90% av stemningen."* Three things make a page feel alive; the gate must find
**where to measure them**. Candidates (to pin): motion/orbs, color warmth+glow, depth (shadow/layering).
A page can pass all 8 static dimensions and still be **dead** — this dimension catches that. (Hardest to
measure — likely the Playwright visual gate + a "liveness" heuristic.)

## 4. Start-decisions the bot MUST make (before porting)

When a port starts, the bot **decides about every element** — not silently. Specifically, it must ASK
/ flag:

- **Keep or remove?** e.g. the subheader — *"skal den tas bort?"* — a decision surfaced, not assumed.
- **Missing icons** — flagged as a gap, not skipped.
- **Font / size as an explicit design decision** — "teksten er 2px for stor, annen font" is a *choice
  someone must make*, not a silent fidelity-fail. The gate flags it; the human decides the look; everything
  else is measured against that locked choice.

> Rule: appearance is a **decision** (human picks the look once); everything else is **measured** against it.

## Approach

**Baby-step / step-by-step** (Pontus, repeated). Build these one at a time onto the existing gate — color
gate ✓ → dimension extractor → screen+group → aggregates → liveness → Playwright visual. Each adds a
measurable axis; none replaces the human-approval at the end (C4).

## Where it plugs

Same contract: each new check prints `{"percent":N,"confidence":N}` → `run-verify.sh` → gate ≥95 →
AWAITING-HUMAN-APPROVAL. Folds into `DESIGN-FIDELITY-GATE.md` as it's built.
