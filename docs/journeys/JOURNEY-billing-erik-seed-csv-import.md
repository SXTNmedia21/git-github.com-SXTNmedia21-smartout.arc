---
title: "Journey — Pontus seeder CSV-historikk + Erik super-admin"
feature: billing-erik-seed
journey: csv-import
status: draft
verified_at: null
e2e_test: null
created: 2026-05-04
updated: 2026-05-04
module: MODULE_BILLING
tags: [journey, billing, seed, csv, super-admin]
---

# Journey: Pontus seeder CSV-historikk + Erik super-admin

**Role:** Pontus (godmode-admin) — engangs-operator

**Precondition:**
- CSV finnes på `/mnt/c/Users/sxtnl/smartout/Copilot-finance/SmartOut-Ordregrunnlag-Jan-Mai-2026.csv`
- Supabase Local kjører (`npx supabase status` viser running)
- 1Password CLI authenticated (`op whoami`)
- Council-verdict godtatt → ADR for super-admin-pattern accepted
- Eksisterende billing-migrasjoner kjørt (`20260417*`-serien + `20260521*`-serien for accountant_company_grant)

## Happy Path

1. **Pontus** kjører `op run --env-file=.env.template -- pnpm tsx scripts/seed-from-csv-ordregrunnlag.ts --target=local`
2. **Script** leser CSV → parser 11 selskap, 6 kontaktpersoner, 33+ fakturaer
3. **Script** INSERT'er via service-role-klient:
   - `public.user_identity` for Erik (email=erik@smartout.no) hvis ikke finnes
   - `public.user_identity` + `public.profile` for hver kontaktperson (6 stk)
   - `public.company` for 11 selskap (6 aktive + 5 kansellerte) med `stripe_customer_id` lagret per council-verdict
   - `public.workspace` for hver company (1:1, navn = selskapsnavn)
   - `public.company_member` for hver kontaktperson (`role='owner'`)
   - `public.invoice` + `public.invoice_line_item` for 33+ fakturaer fra CSV §Seksjon 2
   - `billing.accountant_company_grant` for Erik via CROSS JOIN (én rad per company)
4. **Script** logger antall rows inserted per tabell + bekreftelse "Erik har grants for N selskap"
5. **Pontus** kjører `npx supabase db diff` → ingen diff (idempotent)
6. **Pontus** verifiserer i `psql`:
   - `SELECT count(*) FROM public.company;` → 11
   - `SELECT count(*) FROM public.invoice;` → 33+
   - `SELECT count(*) FROM billing.accountant_company_grant WHERE user_id = (SELECT user_id FROM public.user_identity WHERE email = 'erik@smartout.no') AND revoked_at IS NULL;` → 11
7. **Pontus** re-kjører scriptet → `Idempotent: 0 inserts, 0 updates`

**Postcondition:**
- 11 selskap + 33+ fakturaer + 6 kontaktpersoner i public.* (Local)
- Erik har 11 aktive grants i `billing.accountant_company_grant`
- Script kan re-kjøres uten side-effekter

## Error Paths

- **CSV ikke funnet** → script feiler med tydelig melding, ingen DB-skriv. Exit code 1.
- **Erik allerede har grants** → ON CONFLICT DO NOTHING, ingen feil
- **Stripe customer_id duplikat** → ON CONFLICT DO NOTHING (med UNIQUE constraint på `company.stripe_customer_id`)
- **CSV malformed (manglende kolonne)** → script feiler ved parse, ingen DB-skriv
- **Manglende billing-migrasjoner** → script feiler ved første billing.* INSERT, transaksjon rolles back
- **Cloud-target uten eksplisitt --confirm-cloud-write** → script avbryter

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes — TBD per council (kan være integration-test mot Supabase Local)
- [ ] Manuelt verifisert på Supabase Local av Pontus

**Mark `status: verified` in frontmatter when all three boxes are checked.**
