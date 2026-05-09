---
title: Contract Composition as Cascade Derivation
id: ADR-0076
status: accepted
layer: decision
created: 2026-04-08
updated: 2026-04-08
---

# ADR-0076: Contract Composition as Cascade Derivation

## Context and Problem Statement

Dagens kontrakt-modul (`/dashboard/contracts` + drawer) genererer kontrakter
uten å konsultere Cascade K1a (`regulatory_framework`, `framework_rule`,
`tariff_rate_table`). Det betyr at admin kan sende kontrakter under tariff-
minimum eller i strid med arbeidsmiljøloven uten at systemet vet det. Samtidig
finnes hele Cascade-infrastrukturen for lov- og tariff-data, men den er ikke
koblet inn i contract-pipeline.

Spørsmålet er hvor kontrakt-composition hører hjemme i Cascade-modellen: er det
(a) en parallell pipeline som står ved siden av cascade preview/apply, eller
(b) en derivation inne i cascade som produserer et `change_proposal`?

## Decision Drivers

- ADR-0056 forbyr parallelle cascade-engines — det skal finnes én canonical
  cascade preview/apply-sti.
- Compliance må være på plass før kontrakt sendes — lov er hardt gulv, tariff
  er myk gulv med audit-krav.
- Override-data må ha provenance (cascade invariant #8) som del av artefakten
  som overstyres.
- Framework-binding per workspace er allerede håndtert via
  `workspace_framework_binding` (K1a) — bindingen er ikke template-eiendom.
- Council session 2026-04-07 identifiserte at composition implisitt var en
  parallell cascade uten at det var dokumentert.

## Considered Options

1. **Parallel composition pipeline** — egen preview/apply-logikk utenfor
   cascade, konsulterer K1a ved behov. ADR-0056-brudd, teknisk gjeld fra dag 1.
2. **Cascade derivation som produserer `change_proposal`** — composition er en
   pure function over D2 (employee, employment_contract shell) + D3
   (framework_rule, tariff_rate_table) + D4 (position, workspace parameters).
   Output er et `change_proposal` av ny type `contract_draft` med full
   provenance. Admin godkjenner via eksisterende cascade approval path.
   Event Engine er downstream consumer av godkjent proposal og dispatcher til
   DocuSeal.
3. **Separat "contract cascade"** — bygg en ny, mindre cascade spesifikt for
   contracts som abstraksjon over den store. Unødvendig kompleksitet,
   samme ADR-0056-problem skjult ett lag dypere.

## Decision Outcome

Chosen option: **"Cascade derivation som produserer `change_proposal`"**,
because composition er strukturelt identisk med andre cascade-derivations
(dagens deriverer schedules fra employees + rules + events — nå deriverer vi
contracts fra employees + rules + positions). Å gjenbruke cascade preview/apply
gir oss freshness checks, change_proposal audit trail, og approval flow
gratis. Å bygge parallell pipeline ville duplikere alt dette.

### Data model resolution

**Rejected:** `contract_compliance_override` som ny sidekar-tabell.
**Accepted:** `employment_contract.compliance_overrides JSONB` med provenance:

```jsonc
{
  "compliance_overrides": [
    {
      "field": "hourly_rate",
      "framework_rule_id": "uuid-of-rule",
      "tariff_value": 182,        // typed numeric when rule.value_type is numeric
      "actual_value": 175,
      "unit": "NOK/hour",         // inherited from framework_rule.unit
      "justification": "Begrunnelse fra admin",
      "approved_by": "user_identity_id",
      "approved_at": "2026-04-08T12:00:00Z"
    }
  ]
}
```

Override-data er provenance på artefakten som endres (kontrakten), ikke en
uavhengig entitet. Dette matcher cascade invariant #8 (provenance on all
outputs).

**Rejected:** `contract_template.framework_id` som single FK.
**Accepted:** Templates deklarerer `target_role` og `target_employment_type`
som intent. Framework resolveres ved composition-tid via
`workspace_framework_binding`. En template kan gjelde flere frameworks og
versjoner uten endring.

### Composition-pipeline tilstander

Composition er en multi-step derivation med følgende faser:

1. **Collect inputs** — employee (D2), position (D4), workspace framework
   binding (K1a→K1b), relevant framework_rule rows, tariff_rate_table lookup
2. **Derive draft** — pure function produserer kontrakt-forslag med auto-fill
   fra tariff og framework defaults
3. **Validate** — hver regel markeres som ok / warning (tariff) / blocker (law)
4. **Build `change_proposal`** — av type `employment_contract_compose`, lagrer
   draft + validations + admin-acknowledgeable blocks
5. **Admin approval** — per-block acknowledgement (se ADR-0076 companion
   frontend design). Lov-blockere kan ikke overridges. Tariff-blockere krever
   justification som lagres i compliance_overrides.
6. **Apply** — oppretter `employment_contract` + `contract` (DocuSeal signing
   entity) atomisk. Status starter på `pending_data` hvis ansatt-data mangler.
7. **Event Engine dispatch** — `contract_data_intake` engine_process startes
   hvis data mangler; ellers direkte til `contract_signing` engine_process.

### Relation to ADR-0056

Denne ADR-en utvider ADR-0056 ved å eksplisitt kategorisere contract
composition som en cascade derivation. Ingen ny preview/apply-infrastruktur
bygges; `change_proposal` brukes uendret.

## Rules & Consequences

- **Good, because** vi får freshness checks, audit trail, og approval flow
  gratis fra eksisterende cascade-infrastruktur
- **Good, because** override-provenance lever på kontrakt-artefakten, ikke
  som sidekar-tabell — cascade invariant #8 respektert
- **Good, because** framework-binding resolveres ved composition-tid, så
  templates overlever framework-versjon-oppgraderinger uten endring
- **Good, because** compliance-validering kan kjøres som pure function i
  derivation-steget, enkel å teste
- **Bad, because** composition må implementere `change_proposal` av ny type
  (`employment_contract_compose`) som krever at `change_proposal` apply-logikk
  kan håndtere multi-table writes (employment_contract + contract)
- **Bad, because** `employment_contract.compliance_overrides JSONB` kan ikke
  queries med SQL joins like en relational tabell — audit-rapporter må parse
  JSONB
- **Agent Impact:**
  - Botsson sin `createEmployeeContract`-tool må gå gjennom cascade derivation,
    ikke direkte insert til `employment_contract`
  - Alle compliance-checks i API og agent tools må konsultere
    `regulatory_framework` + `framework_rule` + `tariff_rate_table` via en
    delt resolver (`packages/utils/src/contract-compliance.ts`)
  - Override uten justification = agent-authority-violation, må throw
- Blokkerer kode-implementasjon av composition engine inntil denne er akseptert
- Kobler til ADR-0077 (PII handling) — intake-steget må følge PII-ADR før
  implementasjon

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
