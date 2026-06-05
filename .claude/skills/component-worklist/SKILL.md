---
name: component-worklist
description: >
  Build the STENHÅRD LISTA — the rock-hard component worklist for a feature. Given a feature/area,
  map its domains (SQL/schema side) + read its components (JSX side), extract every interactive
  element, and classify which ones actually DO something. Output = one row per component:
  component_id + telemetry_event_id + backend_binding + state (wired/partial/ghost). This is the
  bridge design→telemetry→gate, and the worklist the fan-out ports + wires from. Read-only analysis.
  Load when asked to "map a feature", "build the component list", "stenhård lista", "component index",
  "which components are wired/ghost", before planning any design-port fan-out.
  Triggers (EN): component worklist, component index, stenhård lista, map feature, classify components,
  wired vs ghost, design-port plan. Triggers (NO/SV): kartlegg feature, komponentliste, stenhård lista.
---

# Component Worklist — the stenhård lista (Phase 1+2 of the design-port pipeline)

Turn a feature into a **mechanical worklist** instead of guessed page-by-page porting. Every
interactive component on the feature's surface gets ONE row: what it is, what event it fires, what
backend it touches, and whether it actually works. The list drives the plan + the fan-out — and the
gates verify against it. Proven on the **dashboard** feature (56 components, 6 domains, 2026-06-03).

> **The state machine (the whole point):**
> - `wired` — real backend hook/RPC + a registered telemetry event. Done.
> - `partial` — visual ok, but the event is MISSING or the hook is MISSING (one cheap fix away).
> - `ghost` — hardcoded data, no source. Needs honest-empty NOW + a new hook later (DB-wall gated).

## Inputs
- The **feature** (one area: dashboard, vaktplan, ansatte, hms, lønn, kommunikasjon, …).
- **SQL side** — `docs/domains/<name>/` spines (DATA-MODEL, OVERVIEW, `_DASHBOARD.md` overlap table)
  + `packages/supabase/src/database.types.ts`. (Load `smartout-database-guide`.)
- **JSX side** — the feature's route(s) + components under `apps/web/src/app/dashboard/**` +
  `apps/web/src/components/**`. (Load `smartout-nordic-split` for token/component law.)
- **Telemetry** — `packages/telemetry/src/registry.ts` (does the event exist?).
- **The schema for the output** — `design-export/components/project/uploads/component-index.schema.json`
  (or any frozen copy): `component_id` pattern `element.feature.action`, `telemetry_event_id`, tier, module.

## The method (5 steps — SQL meets JSX)
1. **Map domains.** Which `docs/domains/<name>/` does the feature touch? Grep the feature's components
   for table names / hook imports → trace each to the domain that owns it (use the `_DASHBOARD.md`
   overlap table). List the domains with one-line justification each. (domain-steward motion.)
2. **Read the JSX — extract every interactive element.** Walk the feature's components. Every
   `<button>`, tile, panel, nav-link, dialog, drawer, form, toggle = one candidate row. Name it
   `element.feature.action` (e.g. `button.oversikt.gap_fill`, `tile.strategic.kpi_card`).
3. **Trace each element to backend.** For each: what does `onClick`/`useEffect`/the render call →
   which hook / RPC / Supabase query / `.from(table)` → which domain owns that table. Cite the
   `path:line`. If it's `router.push`/local-state-only/`Math.random()`/hardcoded → no backend.
4. **Classify state + telemetry.** Grep `registry.ts` for the event it fires (or should). Set:
   - `state=wired` if real backend + registered event present.
   - `state=partial` if backend real but `telemetry_event_id=MISSING` OR a hook is missing.
   - `state=ghost` if the data is hardcoded / `Math.random()` / empty-stub with no source.
5. **Emit the row.** `component_id | feature | tier | module(=domain) | telemetry_event_id | backend_binding(path) | state`.

## Classification nuances (refactor from the 5-feature run — don't rediscover these)
- **BFF-delegated telemetry is NOT a gap.** If the mutation `emit()`s inside its BFF/API route or its
  capability-tool body (ADR-0134 / ADR-0415), the client `onSuccess` has NO `emit()` by design.
  Classify `wired` (note "BFF-delegated"), NOT `partial/MISSING`, and do NOT propose re-registering it
  client-side — that would double-count. Verify by grepping the route/tool, not just the hook.
- **`button clicked` / `page viewed` generic events ≠ a domain event.** A component that only fires the
  generic PostHog `button clicked` is `partial` — it needs its specific `domain.feature.action` event.
- **ADR-0114 client-write = a finding, not just a binding.** A raw `supabase.from(...).insert/update/
  delete()` in a CLIENT component (not a server action / `gatedMutation` / RPC) = gate-bypass. Record
  the binding AND flag it in Key Findings (it must become a server action before its event can land L3).
- **Fake-data-on-a-real-event = `partial`, not `wired`.** An event that fires but carries a hardcoded
  `0`/placeholder in its `data` (e.g. `readiness=0`) is not done — the row is `partial` (no-ghost rule).
- **Phantom-done = `ghost`.** A flow that reaches a "done"/"complete" UI state writing NO row + emitting
  nothing (e.g. a local `setStage("done")`) is `ghost` — flag it; it never lands L3.

## Output (the deliverable)
1. **Domain list** (+ one-line justification each).
2. **Per-domain table** of component rows (the stenhård lista).
3. **Rollup** per domain + grand total: `total · wired · partial · ghost · events MISSING · hooks MISSING`.
4. **Backend-ready ranking** — lightest-friction domain (fewest ghost/missing) first → heaviest last.
   This IS the wave order: telemetry-sweep the partials (cheapest) → port backend-ready lightest-first
   → gap-track the ghosts (DB-wall gated).

## Rails
- **Read-only.** This skill MAPS; it does not edit code. (The fan-out builders port/wire afterward.)
- **Ground every row in code** — cite `path:line`. Unsure → mark the cell `?` + note it. Never guess.
- **No-ghost honesty.** A `ghost` row is a finding, not a license to fabricate — it becomes an
  honest-empty + a backend-gap task, never faked data.
- **One feature per run.** Parallel-safe: dispatch one agent per feature; they never write, so no collision.

## Feeds
The plan (`STENHÅRD-LISTA-<feature>.md`) + the 3-wave fan-out: telemetry-sweep → backend-ready ports →
gap-track. Each row → a concrete port/wire/gate task. The gates (noop_gate + telemetry-coverage)
verify against this list — a component not on the list, or a `ghost` claiming `wired`, fails.
