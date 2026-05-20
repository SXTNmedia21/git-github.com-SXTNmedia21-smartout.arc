---
title: Restaurant Role Capability Baseline
id: ENGINE_ROLE_CAPABILITY_RESTAURANT
version: "0.2"
status: in_progress
layer: capability
created: 2026-03-06
updated: 2026-05-21
owner: platform
module: hospitality-intelligence
tags:
  - capability
  - restaurant
  - roles
  - i1
  - slug-matrix
  - adr-0379a
---

# Restaurant Role Capability Baseline

> **Authoring source for `hospitalityPackage.roleCapabilityProfiles[]`** (ADR-0379a, A2).
> Every `mandatoryProtocolSlugs[]` entry MUST resolve to a real `protocol.name` row
> inserted by one of the restaurant governance templates.
> Every `positionSlugs[]` entry MUST match a `name` field in `POSITION_REGISTRY`
> (`packages/ai/src/industry/defaults.ts:57–119`).
>
> Do NOT invent slugs. If a training concept has no matching protocol, mark UNRESOLVED.

---

## 1. Prose Summary (preserved from v0.1)

The foundation set covers five operational roles found in every Norwegian restaurant.
Add specialist variants (catering / event / sommelier) only after the foundation is
stable and council-reviewed.

| Role | Core focus |
|---|---|
| Skiftleder | Shift ownership, escalation, close signoff |
| Servitør | Guest flow, allergen communication, handoff to kitchen |
| Kokk | Food safety, temperature, hygiene |
| Bartender | Age control, alcohol serving compliance |
| Renhold | Sanitation standards, zone checklists |

---

## 2. Slug Matrix

### 2.1 Protocol slug inventory (ALL real protocols across the three templates)

> Source of truth: exact `name` strings from `INSERT INTO public.protocol` blocks.

| # | Protocol name (exact) | Source file | Line |
|---|---|---|---|
| P01 | `Temperaturkontroll-protokoll` | `governance.sql` | 323 |
| P02 | `Allergenhandtering-protokoll` | `governance.sql` | 324 |
| P03 | `Apningsrutiner-protokoll` | `governance.sql` | 325 |
| P04 | `Stengerutiner-protokoll` | `governance.sql` | 326 |
| P05 | `Handhygiene-protokoll` | `governance.sql` | 327 |
| P06 | `Brannvern og evakuering-protokoll` | `governance.sql` | 328 |
| P07 | `Kassaoppgjor-protokoll` | `governance.sql` | 329 |
| P08 | `Varemottak og lagring-protokoll` | `governance.sql` | 330 |
| P09 | `Arbeidsmiljo og HMS-protokoll` | `governance.sql` | 331 |
| P10 | `Skjenkekontroll-protokoll` | `governance.sql` | 332 |
| P11 | `Skjenkekontroll-protokoll` | `alcohol-labor.sql` | 167 |
| P12 | `Nattarbeid-protokoll` | `alcohol-labor.sql` | 168 |
| P13 | `Overtid-protokoll` | `alcohol-labor.sql` | 169 |
| P14 | `Temperaturovervaking-protokoll` | `mattilsynet.sql` | 289 |
| P15 | `Hygiene og renhold-protokoll` | `mattilsynet.sql` | 293 |
| P16 | `Allergenhandtering-protokoll` | `mattilsynet.sql` | 297 |
| P17 | `Sporbarhet og avvik-protokoll` | `mattilsynet.sql` | 301 |

**Deduplication note:** `Skjenkekontroll-protokoll` appears in both `governance.sql` (P10)
and `alcohol-labor.sql` (P11). Both templates are independently callable — depending on
which templates a workspace runs, only one or both may be seeded. The A2 seed step
(`hospitalityPackage`) MUST reference by name only; the bootstrap deduplicates by
`(workspace_id, name)` uniqueness. Use the canonical name `Skjenkekontroll-protokoll`
for all role mappings — it resolves to whichever row was seeded.

Same applies to `Allergenhandtering-protokoll` (P02 / P16): the mattilsynet variant is
a strict superset (EU 1169/2011 compliance). Map roles to the canonical name string;
resolution at bootstrap is idempotent.

**Canonical deduplicated set (14 unique names):**

| Canonical slug | Canonical source (most authoritative) |
|---|---|
| `Temperaturkontroll-protokoll` | governance.sql:323 |
| `Allergenhandtering-protokoll` | governance.sql:324 (mattilsynet.sql:297 is superset) |
| `Apningsrutiner-protokoll` | governance.sql:325 |
| `Stengerutiner-protokoll` | governance.sql:326 |
| `Handhygiene-protokoll` | governance.sql:327 |
| `Brannvern og evakuering-protokoll` | governance.sql:328 |
| `Kassaoppgjor-protokoll` | governance.sql:329 |
| `Varemottak og lagring-protokoll` | governance.sql:330 |
| `Arbeidsmiljo og HMS-protokoll` | governance.sql:331 |
| `Skjenkekontroll-protokoll` | governance.sql:332 (alcohol-labor.sql:167 is superset) |
| `Nattarbeid-protokoll` | alcohol-labor.sql:168 |
| `Overtid-protokoll` | alcohol-labor.sql:169 |
| `Temperaturovervaking-protokoll` | mattilsynet.sql:289 |
| `Hygiene og renhold-protokoll` | mattilsynet.sql:293 |
| `Sporbarhet og avvik-protokoll` | mattilsynet.sql:301 |

---

### 2.2 Role profiles — structured slug matrix

#### Role 1 — Skiftleder

| Field | Value |
|---|---|
| `roleSlug` | `skiftleder` |
| `positionSlugs` | `["Skiftleder"]` |
| `mandatoryProtocolSlugs` | see below |
| `readySignal` | Can run one full shift cycle without policy-critical misses |

**Mandatory protocols:**

| Protocol slug | Rationale |
|---|---|
| `Apningsrutiner-protokoll` | Shift leader owns opening pipeline |
| `Stengerutiner-protokoll` | Shift leader owns closing pipeline |
| `Brannvern og evakuering-protokoll` | Fire safety / emergency escalation |
| `Arbeidsmiljo og HMS-protokoll` | Incident/deviation handling + HMS reporting |
| `Handhygiene-protokoll` | Universal hygiene floor (all roles) |

**TypeScript shape (paste into `hospitalityPackage.roleCapabilityProfiles`):**

```ts
{
  roleSlug: "skiftleder",
  positionSlugs: ["Skiftleder"],
  mandatoryProtocolSlugs: [
    "Apningsrutiner-protokoll",       // governance.sql:325
    "Stengerutiner-protokoll",        // governance.sql:326
    "Brannvern og evakuering-protokoll", // governance.sql:328
    "Arbeidsmiljo og HMS-protokoll",  // governance.sql:331
    "Handhygiene-protokoll",          // governance.sql:327
  ],
  readySignal: "Can run one full shift cycle without policy-critical misses",
},
```

---

#### Role 2 — Servitør

| Field | Value |
|---|---|
| `roleSlug` | `servitor` |
| `positionSlugs` | `["Servitør", "Runner", "Vertinne"]` |
| `mandatoryProtocolSlugs` | see below |
| `readySignal` | Completes full service sequence with correct allergen handling |

**Mandatory protocols:**

| Protocol slug | Rationale |
|---|---|
| `Allergenhandtering-protokoll` | Legal allergen communication duty per EU 1169/2011 |
| `Handhygiene-protokoll` | Universal hygiene floor |
| `Brannvern og evakuering-protokoll` | Emergency response / evacuation |

**TypeScript shape:**

```ts
{
  roleSlug: "servitor",
  positionSlugs: ["Servitør", "Runner", "Vertinne"],
  mandatoryProtocolSlugs: [
    "Allergenhandtering-protokoll",      // governance.sql:324
    "Handhygiene-protokoll",             // governance.sql:327
    "Brannvern og evakuering-protokoll", // governance.sql:328
  ],
  readySignal: "Completes full service sequence with correct allergen handling",
},
```

---

#### Role 3 — Kokk

| Field | Value |
|---|---|
| `roleSlug` | `kokk` |
| `positionSlugs` | `["Kokk", "Sous Chef", "Kjøkkenassistent", "Kjøkkensjef", "Gardemanger", "Patissier", "Oppvaskhjelp"]` |
| `mandatoryProtocolSlugs` | see below |
| `readySignal` | Executes prep + service tasks with compliant temperature and hygiene behavior |

**Mandatory protocols:**

| Protocol slug | Rationale |
|---|---|
| `Temperaturkontroll-protokoll` | HACCP temperature logging (daily obligation) |
| `Allergenhandtering-protokoll` | Cross-contamination prevention — kitchen has final ownership |
| `Handhygiene-protokoll` | Universal hygiene floor |
| `Varemottak og lagring-protokoll` | FIFO + temperature at intake |
| `Temperaturovervaking-protokoll` | Mattilsynet cold-chain (stricter superset of P01 where mattilsynet template installed) |
| `Hygiene og renhold-protokoll` | Smilefjesordningen renhold baseline |
| `Sporbarhet og avvik-protokoll` | IK-mat internkontroll traceability |

**TypeScript shape:**

```ts
{
  roleSlug: "kokk",
  positionSlugs: [
    "Kokk",
    "Sous Chef",
    "Kjøkkenassistent",
    "Kjøkkensjef",
    "Gardemanger",
    "Patissier",
    "Oppvaskhjelp",
  ],
  mandatoryProtocolSlugs: [
    "Temperaturkontroll-protokoll",      // governance.sql:323
    "Allergenhandtering-protokoll",      // governance.sql:324
    "Handhygiene-protokoll",             // governance.sql:327
    "Varemottak og lagring-protokoll",   // governance.sql:330
    "Temperaturovervaking-protokoll",    // mattilsynet.sql:289
    "Hygiene og renhold-protokoll",      // mattilsynet.sql:293
    "Sporbarhet og avvik-protokoll",     // mattilsynet.sql:301
  ],
  readySignal: "Executes prep + service tasks with compliant temperature and hygiene behavior",
},
```

---

#### Role 4 — Bartender

| Field | Value |
|---|---|
| `roleSlug` | `bartender` |
| `positionSlugs` | `["Bartender", "Barback", "Barsjef"]` |
| `mandatoryProtocolSlugs` | see below |
| `readySignal` | Handles bar service and age checks without compliance breaches |

**Mandatory protocols:**

| Protocol slug | Rationale |
|---|---|
| `Skjenkekontroll-protokoll` | Age verification + sobriety assessment (Alkoholloven §8-11) |
| `Handhygiene-protokoll` | Universal hygiene floor |
| `Brannvern og evakuering-protokoll` | Emergency response |

**TypeScript shape:**

```ts
{
  roleSlug: "bartender",
  positionSlugs: ["Bartender", "Barback", "Barsjef"],
  mandatoryProtocolSlugs: [
    "Skjenkekontroll-protokoll",         // governance.sql:332
    "Handhygiene-protokoll",             // governance.sql:327
    "Brannvern og evakuering-protokoll", // governance.sql:328
  ],
  readySignal: "Handles bar service and age checks without compliance breaches",
},
```

---

#### Role 5 — Renhold

| Field | Value |
|---|---|
| `roleSlug` | `renhold` |
| `positionSlugs` | `["Renholder", "Renholdsansvarlig"]` |
| `mandatoryProtocolSlugs` | see below |
| `readySignal` | Completes hygiene controls with verifiable checklist quality |

**Mandatory protocols:**

| Protocol slug | Rationale |
|---|---|
| `Handhygiene-protokoll` | Universal hygiene floor |
| `Hygiene og renhold-protokoll` | Sanitation standards + zone priorities |
| `Arbeidsmiljo og HMS-protokoll` | Contamination / chemical incident reporting |

**TypeScript shape:**

```ts
{
  roleSlug: "renhold",
  positionSlugs: ["Renholder", "Renholdsansvarlig"],
  mandatoryProtocolSlugs: [
    "Handhygiene-protokoll",             // governance.sql:327
    "Hygiene og renhold-protokoll",      // mattilsynet.sql:293
    "Arbeidsmiljo og HMS-protokoll",     // governance.sql:331
  ],
  readySignal: "Completes hygiene controls with verifiable checklist quality",
},
```

---

## 3. Slug-Resolution Table

> Proves every protocol slug used in the role matrix resolves to a real `protocol.name`
> in the template SQL. MUST be 100% YES before A2 TypeScript authoring (RA2b/A3).

| roleSlug | protocolSlug | Source file:line | EXISTS? |
|---|---|---|---|
| `skiftleder` | `Apningsrutiner-protokoll` | governance.sql:325 | YES |
| `skiftleder` | `Stengerutiner-protokoll` | governance.sql:326 | YES |
| `skiftleder` | `Brannvern og evakuering-protokoll` | governance.sql:328 | YES |
| `skiftleder` | `Arbeidsmiljo og HMS-protokoll` | governance.sql:331 | YES |
| `skiftleder` | `Handhygiene-protokoll` | governance.sql:327 | YES |
| `servitor` | `Allergenhandtering-protokoll` | governance.sql:324 | YES |
| `servitor` | `Handhygiene-protokoll` | governance.sql:327 | YES |
| `servitor` | `Brannvern og evakuering-protokoll` | governance.sql:328 | YES |
| `kokk` | `Temperaturkontroll-protokoll` | governance.sql:323 | YES |
| `kokk` | `Allergenhandtering-protokoll` | governance.sql:324 | YES |
| `kokk` | `Handhygiene-protokoll` | governance.sql:327 | YES |
| `kokk` | `Varemottak og lagring-protokoll` | governance.sql:330 | YES |
| `kokk` | `Temperaturovervaking-protokoll` | mattilsynet.sql:289 | YES |
| `kokk` | `Hygiene og renhold-protokoll` | mattilsynet.sql:293 | YES |
| `kokk` | `Sporbarhet og avvik-protokoll` | mattilsynet.sql:301 | YES |
| `bartender` | `Skjenkekontroll-protokoll` | governance.sql:332 | YES |
| `bartender` | `Handhygiene-protokoll` | governance.sql:327 | YES |
| `bartender` | `Brannvern og evakuering-protokoll` | governance.sql:328 | YES |
| `renhold` | `Handhygiene-protokoll` | governance.sql:327 | YES |
| `renhold` | `Hygiene og renhold-protokoll` | mattilsynet.sql:293 | YES |
| `renhold` | `Arbeidsmiljo og HMS-protokoll` | governance.sql:331 | YES |

**Resolution summary:** 21 of 21 mappings — all YES. Zero UNRESOLVED.

---

## 4. Position-Slug Resolution Table

> Proves every `positionSlugs[]` entry matches a `name` field in `POSITION_REGISTRY`
> (`packages/ai/src/industry/defaults.ts:57–119`).

| roleSlug | positionSlug | POSITION_REGISTRY department | Line | EXISTS? |
|---|---|---|---|---|
| `skiftleder` | `Skiftleder` | Ledelse | 80 | YES |
| `servitor` | `Servitør` | Sal | 68 | YES |
| `servitor` | `Runner` | Sal | 69 | YES |
| `servitor` | `Vertinne` | Sal | 70 | YES |
| `kokk` | `Kokk` | Kjøkken | 59 | YES |
| `kokk` | `Sous Chef` | Kjøkken | 60 | YES |
| `kokk` | `Kjøkkenassistent` | Kjøkken | 61 | YES |
| `kokk` | `Kjøkkensjef` | Kjøkken | 58 | YES |
| `kokk` | `Gardemanger` | Kjøkken | 62 | YES |
| `kokk` | `Patissier` | Kjøkken | 63 | YES |
| `kokk` | `Oppvaskhjelp` | Kjøkken | 64 | YES |
| `bartender` | `Bartender` | Bar | 74 | YES |
| `bartender` | `Barback` | Bar | 75 | YES |
| `bartender` | `Barsjef` | Bar | 76 | YES |
| `renhold` | `Renholder` | Housekeeping | 87 | YES |
| `renhold` | `Renholdsansvarlig` | Housekeeping | 88 | YES |

**Resolution summary:** 16 of 16 mappings — all YES. Zero UNRESOLVED.

---

## 5. UNRESOLVED mappings from prose baseline

The prose baseline (v0.1) listed training concepts that have NO direct protocol match
in any current template. These are tracked here — each needs either (a) a new template
protocol, or (b) a decision that the existing protocol is sufficient coverage.

| Prose training concept | Role | Closest existing protocol | Verdict |
|---|---|---|---|
| "service safety, communication protocol" (Waiter) | `servitor` | None (customer service procedure is not a protocol) | UNRESOLVED — flag for lead. A procedure under `Apningsrutiner-protokoll` covers some; may not need a stand-alone protocol. |
| "HACCP basics" (Cook) | `kokk` | `Temperaturkontroll-protokoll` + `Temperaturovervaking-protokoll` combined cover HACCP practice | MAPPED (partial) — `Temperaturovervaking-protokoll` is the Mattilsynet HACCP reference |
| "de-escalation basics" (Bartender) | `bartender` | None (de-escalation is a procedure inside `Skjenkekontroll-protokoll` — step `Beruselsesvurdering`) | MAPPED (embedded) — covered by `Skjenkekontroll-protokoll`; no stand-alone protocol exists |
| "daily/weekly cleaning routines" (Cleaner) | `renhold` | `Hygiene og renhold-protokoll` (Smilefjesordningen) | MAPPED |
| "opening/closing pipeline" (Shift Leader) | `skiftleder` | `Apningsrutiner-protokoll` + `Stengerutiner-protokoll` | MAPPED |

**Flagged for lead/council:**
- `servitor` "communication protocol" / "service safety" — no protocol in any template. If this is regulatory, a new `Servicestandard-protokoll` should be added to governance.sql before A2 seed. Currently UNDER-MAPPED for `servitor` (3 protocols instead of 5 the prose implies).

---

## 6. Notes

- **Template applicability:** `governance.sql` is the base (P01–P10, always applied).
  `alcohol-labor.sql` adds P11–P13 (bars/alcohol license). `mattilsynet.sql` adds P14–P17
  (HACCP-intensive kitchens with Mattilsynet audit scope). The role matrix is designed so:
  - `skiftleder`, `servitor`, `renhold` map only to `governance.sql` protocols (always present).
  - `kokk` maps to `governance.sql` + `mattilsynet.sql` (safe assumption: any professional kitchen runs mattilsynet template).
  - `bartender` maps to `governance.sql` only (`Skjenkekontroll-protokoll` from governance.sql is sufficient; alcohol-labor.sql variant adds depth but same protocol name).
- **`Kassaoppgjor-protokoll`** and **`Varemottak og lagring-protokoll`** are not role-mandatory
  for any of the 5 foundation roles individually — they are team/procedure-level. `Varemottak`
  is included for `kokk` because kitchen owns physical goods intake (HACCP traceability).
- **`Nattarbeid-protokoll`** and **`Overtid-protokoll`** (alcohol-labor.sql) are labor-law
  compliance protocols — HR/manager scope, not per-employee mandatory training.
  Excluded from all 5 role profiles. Revisit when Skiftleder profile is deepened.
- **Sommelier** (Sal department, `specialist` tier) not in this baseline — deferred per §Notes in v0.1.
- Next step after A2 code authoring (RA2b): add a starter-routine catalogue
  (`starterRoutines[]`) per the `StarterRoutineCatalogue` type in ADR-0379a D1.
