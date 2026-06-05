---
title: F7 — Domain Naming Proposal (NO design → EN domain taxonomy)
status: draft
created: 2026-06-02
updated: 2026-06-02
module: design-handoff
tags: [fork, F7, domain-naming, ingest, beslutt]
---

# F7 — Domain Naming Proposal

> **Decision for PO + Pontus.** The design's 12 derived domains are Norwegian; the existing 20
> `docs/domains/` folders + code routes are English. Running `sxtn-design-ingest` as-is creates a
> **parallel Norwegian taxonomy** (12 new ADR-0392-governed folders, ~100+ spine files) colliding
> with the 20 English ones. This proposal maps NO→EN so the design lands inside the existing
> taxonomy, not beside it.

## Mechanism (important)

`sxtn-design-ingest.sh` derives the domain **purely from each design file's first hyphen-segment**
(`vaktplan-print.jsx` → `vaktplan`). It has **no mapping config**. To get English domains we must:

- **(a) Pre-rename the drop files** first-segment → target domain before ingest *(recommended —
  `design-export/` is a transient working copy; the frozen canonical is `wt-2/smartout-re-designe/`,
  so renaming the drop neither mutates the frozen source nor breaks the copy-law)*; or
- (b) accept Norwegian folders, rename `docs/domains/` after; or
- (c) patch the ingest to read a mapping (plugin change — out of scope now).

## Recommended policy

Keep the **English** domain taxonomy (consistent with the 20 existing folders, ADR-0392, and English
code routes). **Norwegian stays in UI strings / i18n only** (matches the locked i18n rule + the F7
route-naming recommendation: English routes, Norwegian UI). Map clean 1:1 where it exists; create
English-named NEW domains for the rest.

## The full mapping (all 12)

| # | Design (NO) | Design contents | → Target domain | Existing? | Conf. | Notes / overlap |
|---|-------------|-----------------|-----------------|-----------|-------|-----------------|
| 1 | `vaktplan` | shift planning · turnus · availability · controller · print · profile | **`scheduling`** | existing | High | core cascade D1–D6; heaviest domain (153 elements, port LAST) |
| 2 | `lonn` | payroll config · overlays · views · shared | **`payroll`** | existing | High | `min-lonn` (employee pay view) folds in here too |
| 3 | `kommunikasjon` | cases · compose · detail · skranke (helpdesk) | **`communication`** | existing | High | `announcements` + `notifications` stay separate existing domains |
| 4 | `rapporter` | report builder · datasources · drilldown · insight · scheduled | **`reports`** | existing | High | clean 1:1 |
| 5 | `hms` | avvik · protocol · tracking · wizard · dashboard | **`hms`** | NEW | Med | compliance domain; overlaps `procedure-engine` (protocols) + deviations — keep distinct |
| 6 | `ansatte` | directory · profile · contracts · ct-builder/hire/onboard/doc · templates | **`people`** (+ split) | NEW + overlap | Med | directory/profile → new `people`; `-contracts`/`-ct-*` → existing **`contracts`**; `-onboard` → existing **`onboarding-wizard`**. Needs sub-file split. |
| 7 | `oversikt` | admin overview home | **`overview`** | NEW | Med | the admin dashboard root surface |
| 8 | `min` | `min-dag` (employee home) + `min-lonn` (employee pay) | **`my-day`** (+ `payroll`) | NEW + split | Low | filename heuristic lumps both into `min`; split needs rename: `min-dag-*`→`myday-*`, `min-lonn-*`→`payroll-*` |
| 9 | `oppgaver` | task list · form | **`tasks`** | NEW | Med | ADR-0298 task ontology; ⚠ form backend gap (`control_list_attempt` missing) — honest stub |
| 10 | `planlegging` | season · budget/demand · panels · views · data | **`planning`** (or `year-wheel`) | NEW / overlap | Low | `-season` → existing **`year-wheel`**; demand/budget → new `planning`; overlaps `scheduling` |
| 11 | `avstemming` | daily reconciliation · forms · more | **`reconciliation`** (or `day-session`) | NEW / overlap | Low | C1 `daily_reconciliation`; overlaps existing **`day-session`** (D6) — PO call |
| 12 | `handbook` | create · editor · views | **`handbook`** | NEW | Med | manual authoring; overlaps `procedure-engine` + `training` — keep distinct |

### Summary
- **Clean 1:1 map → existing (4):** vaktplan→scheduling · lonn→payroll · kommunikasjon→communication · rapporter→reports.
- **New English domains (6):** hms · overview · tasks · planning · reconciliation · handbook.
- **Split / multi-target (2):** ansatte → people + contracts + onboarding-wizard · min → my-day + payroll.

### M:N flags (not clean 1:1 — need PO judgment)
- `ansatte` and `min` each fan out to multiple targets → the design files must be **regrouped/renamed by sub-feature** before ingest, not bulk-renamed by domain.
- `planlegging` ↔ `year-wheel` + `scheduling`, `avstemming` ↔ `day-session` → confirm whether these extend an existing domain or stand alone.
- Existing domains with **no design counterpart** (untouched by ingest): agent-harness, billing, bootstrap, botsson, core-structure, lovsen, procedure-engine, scrapling, shift-clock, training, year-wheel*, announcements*, notifications*, contracts*, onboarding-wizard* (\* = partially fed by a split above).

## What this unblocks
Once PO confirms the target names + the split/overlap calls, the rename-the-drop pass (a) is
mechanical, then ingest produces English domains that land inside the existing ADR-0392 spine — no
parallel taxonomy, F7 closed.
