---
title: Module Coupling Cartography v1
status: review
updated: 2026-04-27
created: 2026-04-27
module: architecture
tags: [cartography, modules, isolation, coupling]
---

# Module Coupling Cartography v1

> Read-only kartlegging av kryss-modul-koblinger i `apps/web/src/app/dashboard/`. Produsert av `scripts/cartography/scan-imports.ts` + `scripts/cartography/aggregate.ts`. Spec: sortie 2026-04-27.

## TL;DR — Headline Findings

1. **Modulene er løst koblet direkte.** 35 symbol-rader fordelt på kun **6 unike kanter** mellom **30 moduler**.
2. **17 moduler er fullstendig isolerte.** Klare for mod-worktree i nåværende form — null cross-module og null shared-leakage.
3. **Den reelle koblingen ligger i shared-laget.** `_components/_hooks/_actions/_data/_lib` traversert av 11 moduler. Refaktor-hotspot ligger her, ikke i avkobling av moduler.
4. **season ↔ year-wheel er den ene reelle klyngen** (26 kabler, én vei). Behandl som én logisk modul i mod-systemet.

---

## a) Sammendrag

- **Moduler funnet:** 30
- **Cross-module symbol-rader:** 35
- **Cross-module unike kanter:** 6
- **Shared-leakage rader:** 36
- **Isolerte moduler (0 in / 0 out / 0 shared):** 17
- **Klynger identifisert (≥ 5 kabler en vei):** 1

### Topp 10 mest "lekkende" moduler (utgående)
| # | Modul | Utgående kabler |
|---|---|---|
| 1 | `season` | 28 |
| 2 | `hms` | 5 |
| 3 | `people` | 2 |


### Topp 10 mest "innleide" moduler (inngående)
| # | Modul | Inngående kabler |
|---|---|---|
| 1 | `year-wheel` | 26 |
| 2 | `my-training` | 3 |
| 3 | `governance` | 2 |
| 4 | `settings` | 2 |
| 5 | `contracts` | 1 |
| 6 | `organization` | 1 |


---

## b) Klynge-analyse

Klynge = sammenhengende komponent der minst én kant har ≥ 5 kabler i en retning.

### Klynge: `season` + `year-wheel`

- **Moduler:** season, year-wheel
- **Aktive kanter i klynge:** 1
- **Total kabel-tetthet:** 26
- **Anbefaling:** `treat-as-single-mod`


---

## c) Isolerte moduler — klare for mod-worktree

> ⚠ **Forbehold:** Disse modulene fremstår som isolerte fra perspektivet `apps/web/src/app/dashboard/`. Imports fra andre app-områder (`(public)`, `(auth)`, route groups) eller fra `packages/*` er **ikke målt**. Før en isolert modul ekstrakteres som mod-pilot, kjør **reverse-scan** for å bekrefte at ingen eksterne konsumenter finnes. Se sortie 2 (reverse-scan).

Disse **17 modulene** har 0 utgående, 0 inngående, og 0 shared-leakage innenfor dashboard. Etter reverse-scan-bekreftelse er de kandidater for mod-worktree-arkitektur i nåværende form uten avkobling først:

- `ai`
- `billing`
- `close`
- `help`
- `komm`
- `my-contract`
- `my-cv`
- `my-profile`
- `my-salary`
- `my-schedule`
- `notifications`
- `onboarding-assistant`
- `operations`
- `schedule`
- `setup`
- `shift-clock`
- `website`


---

## d) Hot edges — kabel-tetthet per kant

Sortert etter antall symbol-kabler (én rad per import-symbol). Topp 20.

| # | From | To | Kabler |
|---|---|---|---|
| 1 | `season` | `year-wheel` | 26 |
| 2 | `hms` | `my-training` | 3 |
| 3 | `hms` | `governance` | 2 |
| 4 | `season` | `settings` | 2 |
| 5 | `people` | `organization` | 1 |
| 6 | `people` | `contracts` | 1 |


---

## e) Symbol-typer per topp-kant

For hver av de mest brukte kantene: hvilken `import_kind` dominerer?

- **`season` → `year-wheel`** (26 kabler): hook=12, constant=8, type=3, value=2, component=1
- **`hms` → `my-training`** (3 kabler): hook=1, type=1, component=1
- **`hms` → `governance`** (2 kabler): component=2
- **`season` → `settings`** (2 kabler): hook=2
- **`people` → `organization`** (1 kabler): component=1
- **`people` → `contracts`** (1 kabler): component=1

Tolkning:
- `hook` = funksjonell kobling (importerer logikk)
- `component` = UI-kobling (importerer JSX)
- `type` = type-only kobling (lett å bryte med dupisering eller flytting til shared types)
- `constant` = data-kobling (bør sannsynligvis flyttes til shared)
- `action` = Server Action-kobling (samme som hook men på server)
- `value` = ren funksjon eller utility

---

## f) Kjente harde DB-koblinger (fra foranalyse)

Cartography skannet kun kode. Disse FK-koblingene må kombineres med kode-data for hele bildet:

| Hard-kobling | Type | Kilde |
|---|---|---|
| `engine_missions.journey_id → journey` | DB FK | Foranalyse |
| `engine_sessions.journey_id → journey` | DB FK | Foranalyse |
| `contract_template_binding.employee_group_id → payroll.employee_group` | DB FK | Foranalyse |
| `supplement_claim_status` enum straddler schedule + payroll | DB enum | Foranalyse |

> **Note:** `payroll` finnes ikke som dashboard-modul (ikke i modules.json). `my-salary` og `reports` er sannsynlige UI-konsumenter, men FK-en treffer DB-skjemaet `payroll`, ikke en kode-modul. Avkobling her må gjøres i schema-laget.

> **Note:** `journey` finnes ikke som dashboard-modul. Engine↔journey-koblingen ligger i `packages/ai` / `services/stage-engine`, ikke i `apps/web/src/app/dashboard`. Cartography dekker kun dashboard.

---

## Shared-leakage — primær refaktor-hotspot

**11 moduler** rører `_components/_hooks/_actions/_data/_lib` direkte. Dette er der det reelle refaktor-arbeidet ligger — IKKE mellom moduler.

| # | Modul | Imports inn i shared | Shared-paths |
|---|---|---|---|
| 1 | `governance` | 8 | _hooks=8 |
| 2 | `reconciliation` | 8 | _actions=8 |
| 3 | `hms` | 4 | _hooks=2, _actions=1, _data=1 |
| 4 | `handbook` | 3 | _components=2, _data=1 |
| 5 | `season` | 3 | _actions=2, _data=1 |
| 6 | `settings` | 3 | _hooks=3 |
| 7 | `year-wheel` | 3 | _actions=2, _data=1 |
| 8 | `cost` | 1 | _data=1 |
| 9 | `organization` | 1 | _hooks=1 |
| 10 | `people` | 1 | _data=1 |
| 11 | `reports` | 1 | _data=1 |

**Anbefaling:** Refaktor-arbeid bør prioritere shared-laget. Flytt høyfrekvent shared kode til ekte `packages/shared/` eller `apps/web/src/shared/` med eksplisitt API før mod-worktree-arbeid på modulene som bruker dem.


---

## Edge list — kompakt utgave (alle kanter)

For lett menneskelesing — sparsom matrise (`module-matrix.csv`) er vanskelig når kun 6 av 870 celler er ikke-null.

| From | To | Kabler |
|---|---|---|
| `season` | `year-wheel` | 26 |
| `hms` | `my-training` | 3 |
| `hms` | `governance` | 2 |
| `season` | `settings` | 2 |
| `people` | `organization` | 1 |
| `people` | `contracts` | 1 |


---

## Metode

- AST-parsing via `ts-morph` (skriptet `scripts/cartography/scan-imports.ts`)
- 684 source files skannet under `apps/web/src/app/dashboard/`
- 3,616 import declarations parset
- Filtrering per spec: `@/components/ui/` (shadcn) + `packages/*` + non-dashboard ekskludert
- Klassifisering: type/value/component/hook/action/constant/unknown per symbol
- Aggregering: union-find på kanter ≥ 5 kabler

## Kilder

- Rådata: [`module-graph.csv`](./module-graph.csv)
- Matrise: [`module-matrix.csv`](./module-matrix.csv)
- Shared-leakage: [`shared-leakage.csv`](./shared-leakage.csv)
- Modul-liste: [`.cartography/modules.json`](./.cartography/modules.json)
