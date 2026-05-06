---
title: "Phantom ADR detection — migrations citing unregistered ADRs"
id: LEARNING_0199
status: canonical
layer: learning
created: 2026-05-04
updated: 2026-05-04
tags: [adr, decision-log, audit, migration, governance]
---

# Learning-0199: Phantom ADR detection — migrations citing unregistered ADRs

## Context

Council Round Castle 2026-05-04 (billing-erik-seed sortie). 5 migrasjoner i `20260521*`-serien (alle accepted, applied på dev) siterer "ADR-A 2026-05-02" som decision-grunnlag. Søk i `docs/decisions/0000-decision-log.md` returnerte INGEN treff — ADR-A er aldri registrert. Hele accountant-rollen (`billing.accountant_company_grant`-tabellen + RLS + helpers) lever i koden uten formell decision-log-oppføring.

## Discovery

**"ADR-A" er en draft-label — en arbeidsversjon av et ADR som aldri ble nummerert og registrert.** Migrasjoner-forfatteren brukte etiketten i kommentar-headers under utvikling, men det formelle ADR-løpet ble glemt før close-feature. Detection-pattern:

```bash
grep -rE "ADR-[A-Z]\b|ADR-[0-9]{1,3}\b" supabase/migrations/ docs/journeys/ docs/plans/ \
  | grep -vE "ADR-[0-9]{4}\b"
```

Alle ADR-referanser i kode/migrasjon må matche `ADR-NNNN` (4-sifret) og resolveres mot `0000-decision-log.md`.

## Impact

**Resolusjon i ADR-0269 (Accountant Portal Data Foundation):** ADR-0269 absorberer pattern fra ADR-A-draft + utvider til 5 sub-beslutninger. M4-migrasjon i samme sortie oppdaterer kommentar-referanser i alle 5 phantom-citerende migrasjoner (komment-only, ikke schema).

**Forebyggings-pattern:**

1. **adr-contract-audit skill** bør utvides med "phantom ADR-detect": grep migrasjons-kommentarer for ADR-prefiks som ikke matcher `NNNN`-format → flag.
2. **Pre-commit hook**: `git diff --staged --name-only -- supabase/migrations/ | xargs grep -E "ADR-[A-Z]"` → reject hvis treff.
3. **Sortie-protokoll**: når ADR-utkast brukes i kode-kommentar med draft-label (ADR-A, ADR-X, etc.), tas det med i close-feature gate som "ADR må registreres før merge".

**Drift-kost:** 5 migrasjoner × draft-label = ~20 minutters detective-arbeid for å spore opprinnelse + 1 ny ADR (0269) for å resolvere. Multipliseres hvis pattern gjentar seg.

## References

- ADR-0269 — Accountant Portal Data Foundation (resolverer phantom)
- `supabase/migrations/20260521000000_billing_schema_create.sql` (line 5, citing ADR-A)
- `supabase/migrations/20260521000100_billing_accountant_grant.sql` (line 13, citing ADR-A)
- `supabase/migrations/20260521000200_billing_accountant_rls_policies.sql` (citing ADR-A)
- `supabase/migrations/20260521000300_billing_workspace_kartotek_view.sql` (citing ADR-A)
- `supabase/migrations/20260521000400_billing_seed_accountant_placeholder.sql` (citing ADR-A)
- L-0094 (council brief precision drift — related to undocumented decisions)
