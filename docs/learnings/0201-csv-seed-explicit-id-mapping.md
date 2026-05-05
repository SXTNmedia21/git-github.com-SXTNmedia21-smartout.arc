---
title: "CSV-derived seeds must use explicit ID mapping, not name-match"
id: LEARNING_0201
status: canonical
layer: learning
created: 2026-05-04
updated: 2026-05-04
tags: [csv, seed, idempotency, attribution, supabase, billing]
---

# Learning-0201: CSV-derived seeds must use explicit ID mapping, not name-match

## Context

Council Round Castle 2026-05-04 (billing-erik-seed sortie). CSV-fil `SmartOut-Ordregrunnlag-Jan-Mai-2026.csv` ble manuelt avstemt mot Stripe 2026-04-06 og inneholder 11 selskap. Org-numre er **NULL i CSV** (ikke registrert i tracker), men selskapsnavn er kjent. To av selskapene presenterer ambiguity: **Yogurt Heaven AS har TO Stripe customer-IDer** (`cus_TrwaXgWifyUcZm` gammel + `cus_TxTgxCXbwLZThb` ny — ny-profil opprettet etter kortbetaling feilet). En naiv UPSERT-strategi som "match by company.name" ville behandlet dem som samme rad, men også risikert at fremtidige selskap med lignende navn (f.eks. `Yogurt Heaven Bjørvika AS`) ble feilaggregert.

System-Agent-Coordinator (code-tracer) flagget dette eksplisitt: name-match → cross-company attribution risk når CSV mangler unik identifier.

## Discovery

**Når kildedata har NULL i naturlig nøkkel (org_number) og navne-likhet ikke er garantert unik, MÅ seed-script bruke eksplisitt ID-mapping levert som script-input.**

Konkret pattern for billing-erik-seed:

```typescript
// BAD — name-match UPSERT:
await supabase.from("company").upsert({ name: row.kunde, ... }, { onConflict: "name" });
// Risk: "Yogurt Heaven AS" og "Yogurt Heaven Bjørvika AS" kolliderer eller separeres feilaktig

// GOOD — explicit ID mapping fra script-input:
const stripeIdToCompanyName: Record<string, string> = {
  "cus_TxTawMXE6kfqfO": "Blackbird AS",
  "cus_TrwaXgWifyUcZm": "Yogurt Heaven AS",  // gammel cus, samme company
  "cus_TxTgxCXbwLZThb": "Yogurt Heaven AS",  // ny cus, samme company
  // ...
};

// UPSERT på stripe_customer_id (M1 partial UNIQUE), med explicit-mapping for sekundære
for (const [stripeId, companyName] of Object.entries(stripeIdToCompanyName)) {
  await supabase.from("company")
    .upsert({ stripe_customer_id: stripeId, name: companyName, ... }, 
            { onConflict: "stripe_customer_id" });
}
```

For Yogurt-pattern (1 company, 2 stripe IDs) er valg per ADR-0269: **primær cus_* lagres på company.stripe_customer_id; sekundær logges i HANDOFF for future "multi-customer linkage" ADR**.

## Impact

**Pattern for fremtidig CSV-import:**

1. Aldri UPSERT på navn alene
2. Hvis kildedata mangler unik DB-nøkkel, krev eksplisitt mapping i script-input (TypeScript-konstant eller separat YAML)
3. Hvis kildedata har sekundære identifiers (f.eks. flere Stripe customer-IDer per selskap), defer multi-record-pattern til future ADR — IKKE lag silent splitting eller silent merging
4. Logg explicit-mapping i HANDOFF slik at re-import kan reproduseres

**Skill-update:** `smartout-database-guide` skill kan flagges å ha en "CSV-seed checklist" — kildedata-NULL-håndtering, eksplisitt ID-mapping, multi-record-deferral.

**Bredere klasse:** Sibling til L-0035 (UNIQUE-constraint grep gate) — der var faren "1 synthetic parent for N children", her er faren "1 wrong parent for N children" pga ambiguous name. Begge løses via eksplisitt nøkkel.

## References

- ADR-0269 — Accountant Portal Data Foundation (Yogurt secondary deferral)
- `/mnt/c/Users/sxtnl/smartout/Copilot-finance/SmartOut-Ordregrunnlag-Jan-Mai-2026.csv` (kildedata)
- L-0035 — UNIQUE-constraint grep gate
- L-0042 — Migration timestamp dependencies
- `services/strike-mcp/scripts/emit_migration_sql.ts` (precedent for explicit-mapping seed-pattern)
