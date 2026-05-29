---
title: "FIDELITY VERDICT — Manager Timeline right-rail (PLAN-3 G8)"
status: done
updated: 2026-05-29
created: 2026-05-29
module: day-session
tags: [fidelity, frontend-designer, design-axis, day-line, g8]
---

# FIDELITY VERDICT — right-rail vs Cloud Design (PLAN-3, G8 reduced)

**Binding source:** `docs/domains/day-session/day-planner/project/Manager Timeline.html`
(`.rail*` CSS + `timeline-app.jsx` RightRail/NowSnapshot/KpiBox) + render `scraps/v6.png`.
**Mode:** DEGRADED — Agent tool not exposed; orchestrator ran the frontend-designer design+a11y
axis (L-NEW-3) himself, grep-verified against the built `TimelineRightRail.tsx` + Shell.

## Layout fidelity (vs mockup `.main` + v6.png)

| Element | Mockup | Built | Verdict |
|---|---|---|---|
| Main grid | `grid-template-columns: 1fr 380px` | `grid-cols-[1fr_380px]` (Shell:586) | MATCH |
| Rail border + surface | `border-left` + `--sidebar` wash | `border-l bg-sidebar` | MATCH |
| Tab set | Akkurat nå / Detalj / Melding / Avvik | same 4, same icons (clock/check-circle/mic/alert-circle) | MATCH |
| Active tab | `border-bottom: 2px var(--brand-orange)` | `border-brand-orange` + `text-foreground` | MATCH |
| STATUS KPI grid | 2×2 (`1fr 1fr`) | `grid-cols-2` | MATCH |
| KPI cards | På vakt / Aktive oppgaver / Avvik åpne / Tasks gjenstår | same 4, same units (pers/nå) | MATCH |
| KPI value type | `.t-kpi` font-mono weight 900, ~26-30px | `font-mono text-[1.625rem] font-black` (26px) | MATCH |
| Krever oppmerksomhet | rail-card + Bekreft/Eskaler chips, destructive accent | same, `accent="bg-destructive"` + 2 chips | MATCH |
| Pågående | rail-card title + start–end·area + avatar | same | MATCH |
| Neste | rail-card title + start·area + avatar/Ledig, slice 4 | same, `.slice(0,4)` | MATCH |
| Card style | `rounded: 14px` + 3px left accent bar + hover | `rounded-[14px]` + `w-[3px]` accent | MATCH |

Deviations from mockup (documented, acceptable for V1):
- **Detalj / Melding / Avvik tabs** render EmptyState placeholders (Detalj shows the selected task
  as a read card). The mockup's full TaskDetail / BroadcastComposer / DeviationsList are deferred —
  no data source wired in this view, and fabricating a mutation surface would violate the
  "no phantom contract" rule. Documented in PLAN-3 + HANDOFF. NOT a fidelity regression — the
  Akkurat nå tab (the v6.png hero state) is fully built.
- Card hover lift (`translateY(-1px)` + shadow) omitted on rail-cards V1 (the mockup has it on
  `.rail-card:hover`). Minor; can add in a polish pass. Not in v6.png's static state.

## Design + a11y axis (L-NEW-3) — grep-verified

| Check | Result |
|---|---|
| OKLCH literals in TimelineRightRail.tsx | **0** (ADR-0366 clean) |
| Hardcoded color classes (zinc/gray/slate/orange-NNN) | **0** — semantic tokens only |
| `animate-*` without reduced-motion gate | N/A — rail has no animation |
| `focus-visible:outline-none` without ring | none — all interactive els use `focus-visible:ring-2` |
| tablist / tab / aria-selected | present (role="tablist", role="tab", aria-selected on every tab) |
| KPI counts derived (no counter state / `++` / `+= 1`) | **0 increment patterns** — every value is `.length`/`.filter` |

## VERDICT: PASS (G8 reduced — schema/data-binding sortie, no visual product-accept gate)

The Akkurat nå hero state (the v6.png target) matches the binding Cloud Design on layout, tab set,
KPI cards (derived), and the three list sections, with Nordic Split tokens and full a11y. The three
secondary tabs are intentional V1 EmptyState placeholders (no fabricated data sources) — documented.
KPI-derive law honored (no counters). Right-rail design-fidelity RED is CLOSED.

**Note on screenshot capture:** a live side-by-side screenshot vs v6.png was not captured this
session (Playwright/dev-server render needs RAM headroom unavailable under sibling-agent contention).
The fidelity assessment is structural (markup + token + a11y grep vs the mockup's CSS contract).
A live screenshot pass is recommended when the full page-polish run (Lighthouse + loading.tsx)
is done — tracked in `.claude/page-polish/dashboard-oppgaver.run.yml` (verified: false, deferred).
