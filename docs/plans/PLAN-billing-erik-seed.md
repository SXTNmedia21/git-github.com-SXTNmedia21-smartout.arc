---
title: "Plan — billing-erik-seed"
feature: billing-erik-seed
spec: ../superpowers/specs/2026-05-04-billing-erik-seed.md
status: draft
updated: 2026-05-04
created: 2026-05-04
module: MODULE_BILLING
tags: [plan, billing, accountant, seed, super-admin, csv]
---

# Plan — billing-erik-seed

> Branch: `feat/billing-erik-seed` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-5` | Module: MODULE_BILLING

**Spec:** [Billing — Erik super-admin + CSV-historikk seed](../superpowers/specs/2026-05-04-billing-erik-seed.md)

## Journeys (the contract)

- [JOURNEY-billing-erik-seed-csv-import.md](../journeys/JOURNEY-billing-erik-seed-csv-import.md) — Pontus kjører script, CSV-historikk inn i public.* + Erik super-admin grants
- [JOURNEY-billing-erik-seed-erik-login.md](../journeys/JOURNEY-billing-erik-seed-erik-login.md) — Erik logger inn på admin.smartout.ai med magic-link og ser all historikk

## Goal

Erik logger inn på admin.smartout.ai og ser komplett faktura-historikk Jan-Mai 2026 — for MVA-T2-frist 10.06.2026.

## Tasks

- [ ] **T1: Council Round Castle** — /run-council på 5 åpne arkitektur-spørsmål (se spec §Arkitektur)
- [ ] **T2: ADR** — skrive eller bekrefte super-admin pattern
- [ ] **T3: Schema-migrasjon** — legge til `company.stripe_customer_id` (hvis council velger ny kolonne) + alt annet council foreskriver
- [ ] **T4: Erik bootstrap migrasjon** — `2026MMDDhh_billing_super_admin_erik.sql` — user_identity + CROSS JOIN grant
- [ ] **T5: Seed script** — `scripts/seed-from-csv-ordregrunnlag.ts` — TypeScript leser CSV, INSERT'er via Supabase service role
- [ ] **T6: Idempotency** — script + migrasjoner re-run-trygge (ON CONFLICT DO NOTHING)
- [ ] **T7: Local test** — kjøre på Supabase Local, verifisere Erik kan logge inn og se data
- [ ] **T8: Cloud kjøring** — eksplisitt godkjent av Pontus før cloud-INSERT
- [ ] **T9: HANDOFF** — `HANDOFF-billing-erik-seed.md` med rollback-plan + run-instruksjon
- [ ] **T10: Journeys verifisert** — flip status: draft → verified i begge JOURNEY-filer

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated for super-admin pattern
- [ ] Migrasjoner kjørt og verifisert på Supabase Local
- [ ] Script idempotent (re-run = no diff)
- [ ] HANDOFF dekker rollback-plan
- [ ] Council Round Castle verdict registrert i COUNCIL-LOG.md

## Hard constraints

- Aldri commit raw secrets — bruk op:// + service role kun for cloud-kjøring
- Aldri opprette workspace uten I1 industry bootstrap (CLAUDE.md WHAT NOT TO DO) — council avklarer hvordan stub'es
- Aldri bypasse RLS for convenience — kun `service_role` for seed, dokumentert i HANDOFF
- Aldri kjøre direkte på Cloud uten eksplisitt godkjenning fra Pontus

## Council-spørsmål (Round Castle 2026-05-04)

1. Stripe customer_id storage — ny kolonne på `company` vs invoice-felt vs separat tabell?
2. Workspace creation uten I1 — bypass eller minimal hospitality-bootstrap?
3. Invoice status mapping — `paid (feilaktig)` → `void` med `void_reason`?
4. Yogurt to-profil pattern — én company eller to?
5. Super-admin pattern — CROSS JOIN seed + trigger vs `is_super_admin` flag?
