---
title: "JOURNEY — Manager switches view-mode (Område / Rolle / Person)"
status: verified
created: 2026-05-24
updated: 2026-05-24
feature: p11-oppgaver-page
module: day-session
tags: [journey, oppgaver, view-mode]
---

# Manager switches view-mode

**Precondition:** Manager on `/dashboard/oppgaver`. View-mode default = "area".

## Happy path

1. Manager clicks **Rolle** segment in `SegmentGroup` → `aria-checked="true"` on Rolle radio, `false` on Område + Person (WCAG 4.1.2 compliant) → `setViewMode("role")` updates state.
2. Telemetry emits `oppgaver.view_mode_changed { from: "area", to: "role", triggered_by: "ui" }`.
3. `AreaBand` renders in role-mode via `SingleLaneBand` semantics → all area tasks stack via `layoutOverlap` algorithm → no person columns.
4. Manager clicks **Person** segment → repeats step 1-3 with `to: "person"` → SingleLaneBand renders per-band single column.
5. Manager clicks **Område** → back to default per-area-per-person grid.

**Postcondition:** 3 `view_mode_changed` events landed. UI state preserved across switches (date, filters, zoom).

## Error paths

- **Reduced-motion preference:** Segment transition skips any animation (per L-0339 spatial-budget axis); aria-checked still flips instantly.
- **Tool-driven switch (Botsson chat says "vis rolle-modus"):** Same `setViewMode` callback runs; emit includes `triggered_by: "tool"`.
