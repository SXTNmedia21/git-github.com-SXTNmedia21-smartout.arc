---
title: "RLS coverage gap — every new tenant role needs full table-coverage audit"
id: LEARNING_0203
status: canonical
layer: learning
created: 2026-05-04
updated: 2026-05-04
tags: [rls, supabase, security, accountant, multi-tenant, audit]
---

# Learning-0203: RLS coverage gap — every new tenant role needs full table-coverage audit

## Context

Council Round Castle 2026-05-04 (billing-erik-seed). System-Agent-Coordinator (code-tracer) gjennomførte fullstendig RLS-policy-audit for accountant-rolle på alle 7 tabeller seed-script kommer til å skrive til. Funn:

| Tabell | Accountant SELECT-policy? | Status |
|--------|---------------------------|--------|
| `public.invoice` | YES | OK |
| `public.invoice_line_item` | YES (joined via invoice) | OK |
| `public.payment` | YES | OK |
| `public.company` | YES | OK |
| `public.workspace` | YES | OK |
| `public.company_member` | YES (full_kartotek scope only) | OK |
| **`public.user_identity`** | **NO accountant policy** | **GAP** |
| **`public.profile`** | **NO accountant policy** | **GAP** |

Original 5 migrasjoner i `20260521*`-serien dekket "obvious" tabeller (invoice, payment, company, workspace, company_member) men glemte `user_identity` + `profile`. Hvis apps/admin UI prøver vise kontaktperson-navn (CSV captures kontaktperson e-post → maps til `user_identity.email` + `profile.display_name`), Erik returnerer 0 rader fra disse tabellene. UI feiler silent eller viser blanks.

## Discovery

**Når en ny tenant-rolle (accountant, partner, auditor, etc.) introduseres, må RLS-policy-audit gjøres på ALLE tabeller UI-en kommer til å lese — ikke bare "the obvious ones".**

Audit-pattern:

```bash
# 1. Liste alle tabeller UI-en queryer
grep -rE "\.from\(.[a-z_]+.\)" apps/admin/src/ | sort -u

# 2. Per tabell: sjekk om rolle-spesifikk SELECT-policy finnes
for table in invoice invoice_line_item payment company workspace company_member user_identity profile; do
  policy_count=$(grep -l "FOR SELECT" supabase/migrations/*.sql | xargs grep -l "$table" | xargs grep -c "is_accountant_for_company\|accountant" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
  echo "$table: $policy_count accountant policies"
done

# 3. Hvis 0 policies på en lest tabell → coverage gap
```

**Default-fail-mode:** RLS uten matchende policy returnerer 0 rader for ny rolle. Ingen feilmelding — bare tomt UI.

## Impact

**Pattern: ny rolle = full RLS-coverage-audit, ikke bare "wire de viktigste".**

ADR-0269 håndterer dette via **conditional M3-migrasjon**: 2 nye RLS-policies på `user_identity` + `profile` (full_kartotek scope), kun shippet hvis UI demonstrerbart trenger det. Default INKLUDERT for trygghet.

**Forebyggings-pattern for fremtidige rolle-introduksjoner:**

1. **Council-fase:** ny-rolle-ADR må inkludere RLS-coverage-tabell (alle UI-tabeller × policy-status)
2. **Build-agent:** når nye `apps/<rolle>/`-paths legges til, kjør grep-audit ovenfor før close-feature
3. **adr-contract-audit skill:** utvid med "RLS-coverage-per-rolle"-sjekk basert på `apps/<rolle>/` queries

**Bredere klasse:** RLS er deny-by-default = silent-fail. Sibling til L-0066 (default-allow CVE-class i `gate_action`) — opposite vinkel av samme problem: silent permission-failures er vanskeligere å oppdage enn explicit-throws.

## References

- ADR-0269 — Accountant Portal Data Foundation (M3 conditional RLS-migrasjon)
- ADR-0263 — Defense-in-depth ownership re-check (related: belt-and-suspenders for RLS)
- L-0066 — Default-allow CVE-class (sibling: silent permission)
- L-0177 — Forgeable-ID class (sibling: silent fallback)
- `supabase/migrations/20260521000200_billing_accountant_rls_policies.sql` (current 7 policies, missing user_identity + profile)
- `supabase/migrations/00004_rls_policies.sql` (user_identity own-data policy)
