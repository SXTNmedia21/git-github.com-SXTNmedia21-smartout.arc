---
title: "Billing — Erik super-admin + CSV-historikk seed"
status: draft
created: 2026-05-04
updated: 2026-05-04
module: MODULE_BILLING
tags: [billing, accountant, seed, csv, super-admin, admin-portal]
---

# Billing — Erik super-admin + CSV-historikk seed

> Stub. Fylles ut etter council-verdict (Round Castle 2026-05-04).

## Problem

Apps/admin (admin.smartout.ai) er klar til deploy, men:
1. `billing.accountant_company_grant` har ingen rader → Erik får 404 ved login
2. `public.company` + `public.invoice` har ingen historikk → Erik kan ikke gjøre MVA-T2 (frist 10.06.2026)
3. CSV i `/mnt/c/Users/sxtnl/smartout/Copilot-finance/SmartOut-Ordregrunnlag-Jan-Mai-2026.csv` er manuelt avstemt mot Stripe 2026-04-06 — eneste ground-truth pre-deploy

## Mål

Erik kan logge inn på admin.smartout.ai og se all faktura-historikk Jan-Apr 2026 + mai-projeksjoner — uten Pontus i loop.

## Scope

### In scope
- Erik super-admin grant (CROSS JOIN seed + INSERT trigger på `public.company`)
- CSV-import: 11 selskap + 6 kontaktpersoner (user_identity + profile + company_member) + 33+ fakturaer + invoice_line_items
- Idempotent (re-run trygt)
- Engangs-script — ikke gjenbrukbart Brønnøysund-flow

### Out of scope (egen sortie)
- Brønnøysund backfill (org.nr + adresse)
- CRUD-UI for selskap/kontakt/faktura i apps/admin
- Stripe webhook ongoing sync (egen `services/stripe-webhook` arbeid)
- Auto-grant trigger på `public.company` INSERT (forkastet i journey-spørsmål — manuell pr nå)

## Arkitektur (åpne spørsmål — council avklarer)

1. **Stripe customer_id storage** — `public.company` har ingen kolonne. Legge til `stripe_customer_id text` vs bruke `payment_reference` på invoice-nivå?
2. **Workspace creation uten I1 industry bootstrap** — CLAUDE.md sier "never workspace without I1". Må vi bypass for seed eller lage minimal hospitality-bootstrap?
3. **Invoice status mapping** — CSV har `paid (feilaktig)` for 3 Yogurt-rader. Map til `void` med `void_reason='stripe_paid_but_card_failed'`?
4. **Yogurt to-profil pattern** — gammel `cus_TrwaXgWifyUcZm` + ny `cus_TxTgxCXbwLZThb` for samme `Yogurt Heaven AS`. Én company eller to?
5. **Super-admin pattern** — CROSS JOIN seed + trigger vs `is_super_admin boolean` flag. ADR-A 2026-05-02 valgte sibling-table — bekrefte at super-admin er sibling-table-kompatibelt.

## Tasks

- [ ] Council Round Castle (2026-05-04) — avklare 5 åpne arkitektur-spørsmål
- [ ] Skrive ADR for super-admin pattern (eller bekrefte ADR-A dekker)
- [ ] Migrasjon: `2026MMDDhh_billing_super_admin_erik.sql`
- [ ] Migrasjon: `2026MMDDhh_company_stripe_customer_id_column.sql` (hvis council velger ny kolonne)
- [ ] Script: `scripts/seed-from-csv-ordregrunnlag.ts`
- [ ] HANDOFF: rollback-plan + run-instruksjon

## Acceptance

- Erik logger inn på admin.smartout.ai dev/preview (eller Local) med magic-link → ser 11 selskap + 33+ fakturaer
- `pnpm turbo typecheck` grønn
- Decision log oppdatert med ADR
- Script idempotent (re-run = no diff)
