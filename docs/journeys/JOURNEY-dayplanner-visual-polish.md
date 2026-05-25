---
title: "Journey: Manager åpner Oppgaver-siden og ser pixel-parity mot prototypen"
status: draft
feature: dayplanner-visual-parity
created: 2026-05-25
updated: 2026-05-25
module: day-session
tags: [journey, dayplanner, oppgaver, visual-polish, manager]
---

# Journey: Manager åpner Oppgaver-siden og ser pixel-parity mot prototypen

**Rolle:** Manager (admin/owner)
**Surface:** Web `/dashboard/oppgaver`
**Cascade fit:** D5 Concept (presentation)

## Precondition

- Innlogget admin/owner på workspace med `day_line`-data, session_tasks, location_id-verdier (eks. `kjokken`, `sal`, `bar`)
- Oppgaver-siden åpen, default area-mode

## Happy Path

1. Manager scanner timeline → ser fargede AreaBands (kjøkken=orange, sal=teal, bar=lilla) — selv om DB bruker norske location_id-verdier, `resolveDeptToken()` mapper til riktige CSS-vars
2. Manager klikker chip "Kjøkken" → ikke-Kjøkken AreaBands blir dimmet til 30% opacity (ikke 50%) + får `data-dimmed="true"` attribute
3. Manager hover over task-blokk → ser smooth `transition-colors` på FilterChip + SegmentGroup interaksjoner (per Nordic Split §10.4)
4. Manager drar task til UnassignedLane → drop-target highlight bruker `var(--brand-orange)` reference (ikke `orange-500`), Nordic Split-konsistent
5. Band-name "Kjøkken" / "Sal" / "Bar" rendrer med Instrument Serif (font-heading) — match prototypen visual hierarchy

## Postcondition

- Ingen state-endring — pure visuell
- E2E `journey-1-area-filter.spec.ts` validerer `data-dimmed` attr i stedet for class-introspection
- ADR-0361 (no hardcoded colors) compliance restored
- visual-parity-dayplanner.md status:done

## Error Paths

- **Unmappet location_id** → faller tilbake til `var(--border)` (gray); console.warn én gang per ukjent id
- **font-heading ikke applisert** (CSS-var ikke lastet) → fall-back til Geist Sans (no visual break)

## Test Hooks

- E2E: `apps/e2e/specs/dayplanner/journey-1-area-filter.spec.ts` (oppdatert til `data-dimmed`)
- Component: `dept-token-resolver.test.ts` — mapping table coverage
- Visual: `docs/visual-parity-dayplanner.md` re-runs som dokumentert audit (status: done)
