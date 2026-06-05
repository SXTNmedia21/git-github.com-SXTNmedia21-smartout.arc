---
title: Reuse Map — design domains → existing surfaces (PLANLEGG step 1)
status: draft
created: 2026-06-02
updated: 2026-06-02
module: design-handoff
tags: [reuse-map, planlegg, classification, design-handoff, F7-correction]
---

# Reuse Map — design domains → existing surfaces

> **PLANLEGG step 1.** Static read-only reconciliation of the design's 12 derived domains against
> the EXISTING SmartOut app (routes + doc-domains). No Docker / live DB needed. Code-wins: where this
> disagrees with the F7 proposal (drafted before inspecting routes), **this is correct** — F7's
> existence-classification is superseded here.

## Headline finding

**All 12 design domains map to an EXISTING route. There are ~0 brand-new top-level routes.**
The campaign is overwhelmingly **re-skin / rewire of existing surfaces**, not new-build. The route
taxonomy is **already mixed** (NO: `komm`, `oppgaver`; EN: rest) — so F7's "keep pure English" needs
softening to "reconcile to what exists."

## The map

| Design (NO) | Existing route `apps/web/src/app/dashboard/` | Doc-domain `docs/domains/` | First-pass class | Note |
|---|---|---|---|---|
| `vaktplan` | `schedule/` ✓ | `scheduling` ✓ | re-skin/rewire | heaviest (153 elem); RSC-excluded (ADR-0115) — needs exit ADR |
| `lonn` | `payroll/` ✓ | `payroll` ✓ | re-skin/rewire | + `my-salary/` (employee view) |
| `kommunikasjon` | `komm/` ✓ (NO) | `communication` ✓ | re-skin | route already Norwegian; `notifications/` separate |
| `rapporter` | `reports/` ✓ | `reports` ✓ | re-skin | clean |
| `hms` | `hms/` ✓ | — (none) | re-skin | **route EXISTS** (F7 said NEW — wrong); doc-domain to define |
| `ansatte` | `people/` ✓ + `contracts/` ✓ + `my-*` | `contracts` ✓ (no `people`) | re-skin + split | directory/profile→people; contracts/ct-*→contracts; onboard→onboarding-wizard |
| `oversikt` | `page.tsx` (dashboard root) ✓ | — | re-skin | admin home |
| `min` | `my-contract/ my-cv/ my-profile/ my-salary/ my-schedule/ my-training/` ✓ | — | re-skin | employee self-service family already exists |
| `oppgaver` | `oppgaver/` ✓ (NO) | — (none) | re-skin | **route EXISTS** (F7 said NEW — wrong); ⚠ form backend gap (`control_list_attempt`) |
| `planlegging` | `planning/` ✓ (+ `season/` `year-wheel/`) | `year-wheel` ✓ | re-skin | **route EXISTS** (F7 said NEW — wrong); overlaps season/year-wheel |
| `avstemming` | `reconciliation/` ✓ | — | re-skin | **route EXISTS** (F7 said NEW — wrong) |
| `handbook` | `handbook/` ✓ | — | re-skin | **route EXISTS** (F7 said NEW — wrong) |

✓ = confirmed `page.tsx` present (hms/oppgaver/handbook/reconciliation/planning/people all verified).

## Corrections to the F7 proposal

F7 (`F7-domain-naming-proposal.md`) was drafted from the seed's counts + the design view, **without
reading the routes**. Disk truth:
- **6 domains F7 called "NEW" actually EXIST as routes:** hms · oppgaver · handbook · reconciliation · planning · people.
- The taxonomy is **already mixed NO/EN** (`komm`, `oppgaver` are Norwegian routes) — F7's "pure English" goal is not how the app is built.
- ⇒ F7 reduces to a **naming-reconciliation of design files to existing route names**, plus deciding doc-domain folders for the 6 routes that have no `docs/domains/` entry yet (hms, oppgaver, reconciliation, planning*, people, min/oversikt families).

## Implication for F1 (ingest pipeline vs direct-port)

Routes already exist for every domain → the `sxtn-design-ingest` model of *scaffolding new
`docs/domains/<NO-name>/` folders* is a poor fit here: it would create a parallel Norwegian doc
taxonomy beside existing routes (+ duplicate EN doc-domains like scheduling/payroll). **This is
evidence for direct-port** (re-skin existing routes via the reference `people-v2/` 4-file pattern)
over the decompose/ingest-new-domains pipeline. PO decides F1; this is the disk evidence.

## Existing component surfaces (reuse pool)

`apps/web/src/components/`: `dashboard/ · day/ · contract/ · contract-editor/ · contracts/ ·
shift-timeline/ · forms/ · onboarding/ · wizard/ · welcome-wizard/ · journey/ · helpdesk-orb/ ·
voice-assistant · tips/ · billing/ · platform-admin/ · ui/` + shared mutation primitives
(`MutationButton`, `MutationDropdownMenuItem`, `DestructiveConfirmDialog`, `RevealableField`,
`UnsavedChangesGuard`). Per-domain component→design mapping is the next depth (needs reading each route).

## Next (still infra-free)

1. Per-domain depth: for each route, list its page.tsx + component imports + the data hooks/tables it
   reads → the concrete keep/re-skin/rewire classification.
2. Resolve the 7 coverage-fork candidates from the seed (dual calendar, parallel contract trees, etc.).
3. Tables-per-domain (static parse of `database.types.ts`) — no Docker needed.
