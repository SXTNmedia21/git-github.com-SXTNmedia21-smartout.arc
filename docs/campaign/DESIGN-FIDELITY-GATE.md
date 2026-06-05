---
title: Design Fidelity Gate — the "can't-lie" verification for UI-design ports
status: in_progress
created: 2026-06-03
updated: 2026-06-03
module: design-handoff
tags: [fidelity-gate, verification, design-port, enforcement, human-approval, color, padding, font]
---

# Design Fidelity Gate

> **What this is.** The mechanical verification that a ported page actually MATCHES the delivered design
> — measured per dimension, design-source vs live — so "done" is a measurement, not my word. Born from a
> real failure: the shell re-skin shipped the WRONG orange (`orange-500` ≠ brand `--orange`) and a green
> typecheck called it "done". Pontus saw it in the browser; I had only checked that it compiles. **Never
> again: a page is 100% only when the gate measures it, and even then a human approves before advancing.**

## Why it exists
- I verify **compilation**, not **pixels** — I cannot see the browser. So "matches the design" from me is
  an unverified claim. The gate replaces the claim with a measurement.
- The previous gate (`.husky` hook #10) only caught `zinc/gray/slate` — it MISSED `orange/emerald/amber/
  indigo`, which is exactly how the wrong colour shipped. The fidelity gate closes that hole and goes
  further: padding, font, position, radius, shadow — the things a human sees as "messy".

## The dimensions + variables (what it measures)

Each dimension is measured **design-source vs live**, and must match.

| # | Dimension | Variables measured | Design source | Live source |
|---|-----------|--------------------|---------------|-------------|
| 1 | **Colour** | token value · palette range (highest/lowest tone) · 0 raw palette/hex/oklch | `shell.css`/page CSS `var(--*)` | Tailwind class → token |
| 2 | **Font** | family · size (px) · weight · line-height · letter-spacing | CSS `font-*` | `font-*` / `text-[..]` classes |
| 3 | **Padding** | px per side (top/right/bottom/left) | CSS `padding:` | `p*-[..]` / `p-N` → px |
| 4 | **Distance / spacing** | gap · margin between elements | CSS `gap`/`margin` | `gap-[..]`/`m-N` → px |
| 5 | **Border-radius** | px per corner | CSS `border-radius:` | `rounded-[..]`/`rounded-*` → px |
| 6 | **Shadow** | x · y · blur · spread · colour | CSS `box-shadow:` | `shadow-[..]` |
| 7 | **Layout / position** | flex/grid · order · alignment — "where the button sits" | CSS structure | component JSX structure |
| 8 | **Text** | content · length (truncation, letter count) | `*-data.js` mock | rendered copy |

## The two tiers (honest about the ceiling)

1. **Static gate (available now, no browser):**
   - `scripts/check-design-color-tokens.mjs` — the **colour gate** (dimension #1). Fails on ANY raw
     palette class / hex / oklch in app `.tsx/.css`. PROVEN: caught 14 violations hook #10 missed.
   - *(next)* a **dimension extractor** — pulls the exact px values from the design CSS (`shell.css` has
     `width:244px; padding:8px 10px 12px; border-radius:9px`) and the live Tailwind arbitrary values
     (`w-[244px]`, `rounded-[10px]`, `text-[13.5px]`), diffs #3-6. Catches padding/radius/spacing mechanically.
2. **Visual gate (the REAL 100%, needs a browser):**
   - **Playwright screenshot-diff** — renders the live page, screenshots it, diffs against the reference
     `design-export/.../uploads/*.png`, fails on >threshold pixel difference. This is the only check that
     truly catches **font + position + colour-placement** (#2, #7) — what a human sees as "messy".
   - Requires the local app running (browser/Chromium). Playwright is already in the repo (`apps/e2e`).
     Blocked until the smartout local Supabase + web are up. **Static gate is the proxy until then;
     I say so — never claim pixel-perfect from code alone.**

## Scope — where it runs, and where it MUST NOT (training-mode safety)

- **Runs ONLY on:** explicit file args, `--staged` (staged `apps/web/src/**/*.{tsx,css}` only), or
  `--page <dir>` (one design-port surface). Never a blanket repo scan.
- **NEVER:** runs against `node_modules`, `globals.css` (the token-definition file is exempt), `archive/`
  design references, production, or any path outside `apps/web/src`. No writes, no mutations — read-only
  measurement. No network. No DB.
- **Activation, not ad-hoc:** the gate is **activated on a main task** (a worklist item / pre-commit hook),
  not run by me on a whim. One canonical invocation per surface; results are evidence on disk.

## The human-approval rule (C4 — ready ≠ authorized)

**When the gate says a page is "ready/100%", that is NOT permission to advance.** The gate output is
`AWAITING-HUMAN-APPROVAL`. Pontus reviews (eyes on the browser) and approves. Only then does the page
close + the next page open. The gate measures; the human authorises. I never self-certify a page done.

```
port page → fidelity gate (static + visual) → PASS? → "AWAITING-HUMAN-APPROVAL" → Pontus approves → advance
                                             → FAIL? → fix, never advance (page-100-before-advance rule)
```

## Usage
```bash
node scripts/check-design-color-tokens.mjs --staged          # colour gate on staged dashboard files
node scripts/check-design-color-tokens.mjs --page apps/web/src/app/dashboard/<surface>   # one surface
# (planned) node scripts/check-design-fidelity.mjs --page <dir> --design <design-css>     # dimension diff
# (planned, app up) pnpm e2e:visual --page <route> --ref <reference.png>                  # Playwright screenshot-diff
```

## Status
- ✅ colour gate built + proven (`scripts/check-design-color-tokens.mjs`).
- ⏳ dimension extractor — next (static padding/radius/spacing diff).
- 🔴 Playwright visual gate — blocked on app/browser up (the real 100%).
- Rule pinned: `page-100-before-advance` + `visual-fidelity-must-be-measured` (agent-memory) + human-approval here.
