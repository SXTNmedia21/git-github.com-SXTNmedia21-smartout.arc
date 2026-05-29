---
title: "PLAN-3 — right-rail build (design-fidelity RED)"
status: in_progress
updated: 2026-05-29
created: 2026-05-29
module: day-session
tags: [design-fidelity, right-rail, nordic-split, adr-0366]
---

# PLAN-3 — right-rail build (the big build)

**Binding contract:** `Manager Timeline.html` `.rail*` CSS + `timeline-app.jsx` RightRail/NowSnapshot/KpiBox + `v6.png`.

**Problem:** `ManagerTimelineShell.tsx:496` is single-column `grid h-[100dvh] grid-rows-[60px_52px_1fr]`. The mockup
is two-column `.main { grid-template-columns: 1fr 380px }` — the right-rail is ENTIRELY MISSING.

**Build:**
1. **Layout:** change the shell so the chart row becomes a two-column grid: chart (1fr) + rail (380px). Match the
   mockup's `.main` / `.main.no-rail` (rail collapsible to 0). Keep topbar (60px) + toolbar (52px) rows.
2. **New component** `apps/web/src/app/dashboard/oppgaver/_components/TimelineRightRail.tsx`:
   - **Tabs** (`.rail-tabs`): Akkurat nå (clock) / Detalj (check-circle, disabled when no selected task) /
     Melding (mic) / Avvik (alert-circle). Active = `border-bottom: 2px var(--brand-orange)`.
   - **Akkurat nå (NowSnapshot):**
     - **STATUS** section — 4 KPI cards in a `1fr 1fr` grid (KpiBox): På vakt (onShift count, "pers"),
       Aktive oppgaver (active count, "nå"), Avvik åpne (open deviations, tone warn/ok), Tasks gjenstår (upcoming count).
       **DERIVE every count from source rows — NEVER increment or store a counter (Pontus law).**
     - **Krever oppmerksomhet** — one rail-card per open deviation (title + time·area + Bekreft/Eskaler chips).
       Wire Bekreft to the existing deviation-resolve action if present; else render the buttons (no-op stub OK for V1,
       note in HANDOFF) — do NOT fabricate a mutation.
     - **Pågående** — rail-card per active task (title + start–end·area + assignee avatar+name).
     - **Neste** — rail-card per upcoming task (sorted by start, slice 4) (title + start·area + assignee/Ledig).
   - **Detalj** — selected task detail (reuse existing TaskEditModal content or a read view). When none: EmptyState.
   - **Melding/Avvik** — V1 may stub with EmptyState if no existing data source; note in HANDOFF. Do NOT fabricate.
3. **Tokens (ADR-0366):** NO OKLCH literals, NO hex. Use Nordic Split CSS vars / shadcn token classes
   (`bg-card`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-brand-orange`). KPI value = `font-mono`
   font-weight 900 (the `.t-kpi` class equiv). Card radius `rounded-[14px]`, accent left-bar via pseudo or a 3px div.
4. **a11y (L-NEW-3):** rail-tab = real `<button>` with `aria-selected`/`role="tab"` + `role="tablist"`; focus-visible
   ring on all interactive els (`focus-visible:ring-2 focus-visible:ring-ring`); animate-* gated by
   `motion-reduce:` where used; no `outline-none` without a ring replacement.
5. **Data source:** derive onShift/active/upcoming/deviations from the Shell's existing `tasks`/`employees` (after
   PLAN-4 lands real employees) + a deviations source. For now wire to `tasks` (status active/upcoming/missed) +
   `employees` (on-shift = employees with a current shift window once PLAN-4 provides `shift`). KPI counts are `.length`.
6. **Telemetry (L-0176):** if the rail emits any view/interaction event, register in `packages/telemetry/registry.ts`
   + emit() in the SAME commit. If purely display (likely V1), no emit needed — do NOT register phantom events.

**fidelity gate (G8 reduced):** self-run the frontend-designer checklist against `Manager Timeline.html` + `v6.png`:
layout grid `1fr 380px`, tab set + active underline, 4 KPI cards in 2×2, the three list sections, card styling
(radius/accent-bar/hover), tokens (0 OKLCH literals), a11y (tablist/focus-rings/motion-reduce). Document verdict in
`reports/FIDELITY-VERDICT.md` with a captured screenshot vs v6.png.

**Acceptance:** rail renders two-column; KPI counts derive (grep: no counter state, no `++`/`+= 1` on KPI); 0 OKLCH
literals (eslint `smartout/no-oklch-literal` clean on the new file); typecheck green; fidelity verdict PASS.

**Commit:** `feat(day-line): build Manager Timeline right-rail per Cloud Design (NowSnapshot + KPI + lists)`.
