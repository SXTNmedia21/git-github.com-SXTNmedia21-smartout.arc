---
title: "invoice.external_reference UNIQUE required for idempotent CSV-seed"
id: LEARNING_0204
status: canonical
layer: learning
created: 2026-05-04
updated: 2026-05-04
tags: [invoice, idempotency, seed, unique-constraint, supabase, billing]
---

# Learning-0204: invoice.external_reference UNIQUE required for idempotent CSV-seed

## Context

Council Round Castle 2026-05-04 (billing-erik-seed). System-Agent-Coordinator (code-tracer) verifiserte idempotency-claim i spec mot eksisterende schema. Funn: `public.invoice` har UNIQUE-constraint kun på `invoice_number` (line 18 av `20260417121720_invoice_table.sql`), som er NULL inntil status flippes til 'issued'. **Ingen UNIQUE på `external_reference`** eller andre Stripe-derived columns.

Konsekvens: re-kjøring av seed-script ville produsert duplikat-fakturaer hver gang. Spec line 24 påsto "re-run trygt" men schema støttet ikke claimet.

## Discovery

**Idempotency-claim uten UNIQUE-constraint på dedup-key er vakuuøst.** Pattern:

```sql
-- BAD — ON CONFLICT DO NOTHING uten UNIQUE-constraint:
INSERT INTO invoice (..., external_reference)
VALUES (..., 'in_xxx')
ON CONFLICT (external_reference) DO NOTHING;
-- Postgres-feil: "there is no unique or exclusion constraint matching the ON CONFLICT specification"

-- ELLER, om man dropper ON CONFLICT:
INSERT INTO invoice (..., external_reference)
VALUES (..., 'in_xxx');
-- Re-run = duplikat-rad
```

**Resolusjon i ADR-0269 (M2-migrasjon):**

```sql
CREATE UNIQUE INDEX invoice_external_reference_unique 
  ON public.invoice(external_reference) 
  WHERE external_reference IS NOT NULL;
```

Partial UNIQUE WHERE NOT NULL tillater eksisterende NULL-rader (legacy invoices uten Stripe-ID) men forhindrer duplikater for nye seed-rader med `in_xxx`.

## Impact

**Pattern for fremtidig seed-arbeid:**

1. **Pre-flight check:** før seed-script skrives, grep target-tabeller for UNIQUE-constraints. Dedup-key må matche en UNIQUE.
2. **Hvis ingen UNIQUE eksisterer:** ship M-migrasjon FØR seed-script. Aldri co-mingle DDL + DML i samme commit/PR.
3. **Partial UNIQUE WHERE NOT NULL** er foretrukket pattern når kolonne brukes mixed (legacy NULL + new non-NULL).

**Council-protocol sjerpelse:** Phase 2.5 fact-check må eksplisitt verifisere UNIQUE-constraints for ON CONFLICT-claims i emitted SQL. Spec-claim "idempotent" → fact-check må grep target-migrasjons UNIQUE-coverage.

**Klasse-relasjon:**
- L-0035 — UNIQUE-constraint grep gate (sibling: synthetic-parent-N-children pattern; her er det dedup-key-mismatch)
- L-0037 — Idempotency claim verification (parent: claim "idempotent" må verifiseres i emitted SQL)
- L-0042 — Migration timestamp dependencies (sibling: ordering må være DDL-før-DML)

## References

- ADR-0269 — Accountant Portal Data Foundation (M2 partial UNIQUE migration)
- L-0035 — UNIQUE-constraint grep gate
- L-0037 — Idempotency claim verification
- L-0042 — Migration timestamp dependencies
- `supabase/migrations/20260417121720_invoice_table.sql:18` (UNIQUE only on invoice_number)
- `supabase/migrations/20260511200005_invoice_line_item_immutability_trigger.sql` (precedent: trigger-based invariant)
