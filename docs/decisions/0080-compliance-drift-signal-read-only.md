---
title: Compliance Drift Signal — Read-Only View, Not a Cascade Derivation
id: ADR-0080
status: accepted
layer: decision
created: 2026-04-08
updated: 2026-04-08
---

# ADR-0080: Compliance Drift Signal — Read-Only View, Not a Cascade Derivation

## Context and Problem Statement

Etter at en `employment_contract` er signert, kan underliggende regelverk endre
seg: Riksavtalen oppdateres, arbeidsmiljøloven endres, tariff-satser justeres.
Spørsmålet er hvordan systemet skal reagere på slike endringer.

Council session 2026-04-07 (runde 2) vurderte tre alternativer:

1. **Auto `change_proposal`** — systemet genererer automatisk forslag om ny
   kontrakt for hver ansatt som er berørt
2. **Ingenting** — signert kontrakt er bindende, admin må selv oppdage drift
3. **Varsel uten forslag** — system oppdager drift, viser det til admin, men
   tar ingen derivation-aktig handling

Alle tre reviewers (Steward, Supervisor, Agent Coordinator) avviste alternativ
1 uavhengig med samme begrunnelse: **signerte kontrakter er execution-layer-
artefakter, ikke derivations**. Å re-propose en signert kontrakt via cascade
bryter grensen mellom derivation (cascade input→output) og execution (en
immutable, legally executed state).

## Decision Drivers

- Cascade invariant: derivation må være reproducible fra persisted inputs
- Signed contract er IKKE en cascade-derivation lenger, det er en juridisk
  bindende handling med ekstern motpart (ansatt)
- `change_proposal` er designet for å endre workspace state (shifts, staffing),
  ikke eksterne juridiske dokumenter
- Admin må ha synlighet på drift uten at systemet automatisk bestemmer handling
- Cross-cutting ADR-0076 (composition as cascade derivation) låser at
  composition er innside cascade — etter signing er vi utenfor

## Considered Options

1. **Auto change_proposal fan-out** (rejected) — reactive DB trigger på
   `framework_rule` UPDATE som lager proposals for alle aktive kontrakter.
   Bryter cascade/execution-boundary. Scope creep til labor law territory
   (hvem er counterparty på proposal?).
2. **Stored drift-state-tabell** — lagrer "drift detected" events i egen
   tabell når framework endres. Nytt source-of-truth for drift, potensielt
   ute av sync med nåværende state.
3. **Read-only computed view** (accepted) — `compliance_drift` er en view som
   sammenligner `employment_contract.framework_snapshot` (immutable snapshot
   lagret ved signing) med nåværende `framework_rule` state. Ingen stored
   state. Ingen events. Bare "hvilke kontrakter har drift akkurat nå".

## Decision Outcome

Chosen option: **"Read-only computed view"**, because det respekterer cascade-
boundaryen (ingen re-derivation av signed artifacts), krever ingen ny
infrastructure, og gir admin synlighet uten automatisk handling.

### Implementation

**Materialized view:**

```sql
CREATE MATERIALIZED VIEW compliance_drift AS
SELECT
  ec.contract_id,
  ec.workspace_id,
  ec.profile_id,
  ec.status,
  ec.framework_snapshot,
  (
    SELECT jsonb_agg(fr.*)
    FROM framework_rule fr
    WHERE fr.framework_id = (ec.framework_snapshot->>'framework_id')::uuid
      AND fr.rule_id IN (
        SELECT (jsonb_array_elements(ec.framework_snapshot->'rule_ids'))::uuid
      )
  ) AS current_rules,
  ec.framework_snapshot->'rules' AS snapshot_rules,
  -- Compute diff
  public.compute_compliance_diff(
    ec.framework_snapshot->'rules',
    (SELECT jsonb_agg(fr.*) FROM framework_rule fr WHERE ...)
  ) AS drift
FROM employment_contract ec
WHERE ec.status = 'signed';

CREATE INDEX idx_compliance_drift_workspace
  ON compliance_drift(workspace_id);
```

**Refresh trigger:**

```sql
CREATE OR REPLACE FUNCTION refresh_compliance_drift()
RETURNS trigger AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY compliance_drift;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER framework_rule_refresh_drift
  AFTER INSERT OR UPDATE OR DELETE ON framework_rule
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_compliance_drift();
```

**Admin UI surface:**

- Dashboard contract list viser en warning-badge på kontrakter med drift
- Badge er klikkbar → åpner reasoning drawer med diff
- Admin kan trigge "Regenerer fra nåværende framework"-knapp som starter en
  ny composition-wizard med forhåndsvalgte verdier fra current state
- Ny versjon opprettes via 4.4c-flyten (ny `employment_contract`-rad +
  `parent_contract_id` FK til forrige)

### What this is NOT

- **Ikke** en stored drift-state — alt er computed fra `framework_snapshot`
  vs current `framework_rule`
- **Ikke** en trigger for auto-composition — admin må alltid initiere
  regeneration manuelt
- **Ikke** en `change_proposal` — view genererer ingen proposals, lagrer
  ingen approval flow state
- **Ikke** en telemetry-source — ingen events emit'es fra view-refresh.
  (Audit-hendelsen oppstår når admin faktisk velger å regenerere, ikke når
  drift oppdages)

## Rules & Consequences

- **Good, because** cascade/execution boundary respekteres — signed contracts
  er utenfor cascade derivation path
- **Good, because** ingen ny infrastructure kreves (materialized view +
  trigger er eksisterende Postgres-primitiver)
- **Good, because** admin beholder full kontroll — ingen automatisk handling
- **Good, because** drift er alltid up-to-date siden view refresh'es på
  framework_rule endringer
- **Bad, because** materialized view refresh kan være dyr ved stor skala
  (tusenvis av aktive kontrakter + hyppige framework-oppdateringer)
- **Bad, because** drift vises bare i admin-UI — ansatte ser ikke at deres
  kontrakt er under-tariff før admin velger å regenerere
- **Agent Impact:**
  - Botsson får en read-only tool `get_compliance_drift_for_contract(id)` som
    returnerer diff-data for admin-dialog ("Anna sin kontrakt er nå 3% under
    Riksavtalen — vil du regenerere?")
  - Botsson kan ALDRI trigge regeneration selv — kun admin kan
  - Tool hører hjemme i `contract` capability (read-only), ikke i
    `contract_intake` (write)
- **Forbidden:** reactive auto-regeneration, auto `change_proposal` på
  framework_rule endringer, stored drift-state tabeller
- **Performance mitigation:** hvis materialized view refresh blir dyr,
  vurder async refresh via fire-delayed-triggers i stedet for direct trigger

## References

- Council session 2026-04-07 runde 2
- ADR-0076 (Contract Composition as Cascade Derivation) — etablerte
  composition-boundaryen som dette utvider
- ADR-0056 (Cascade Core Foundation Schema) — cascade invariants
- Steward's Phase 5 synthesis runde 2: "cascade/execution boundary is load-
  bearing"

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
