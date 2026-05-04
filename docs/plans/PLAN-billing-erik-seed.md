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

## Tasks (rescoped post-council 2026-05-04)

- [x] **T1: Council Round Castle 2026-05-04** — APPROVE WITH CHANGES, ADR-0269 + 6 learnings
- [x] **T2: ADR-0269** — Accountant Portal Data Foundation (consolidated, status: proposed)
- [ ] **T3: M1 migrasjon** — `2026052500_company_stripe_customer_id_column.sql` — ADD COLUMN + partial UNIQUE WHERE NOT NULL
- [ ] **T4: M2 migrasjon** — `2026052501_invoice_external_reference_unique.sql` — partial UNIQUE for idempotent seed
- [ ] **T5: M3 migrasjon (conditional)** — `2026052502_billing_accountant_user_identity_profile_rls.sql` — kun hvis apps/admin UI viser kontaktperson-navn (build-agent verifiserer scope først)
- [ ] **T6: M4 migrasjon** — `2026052503_billing_super_admin_erik.sql` — Erik bootstrap (auth.users + user_identity + profile) + CROSS JOIN grant til alle eksisterende selskap + UPDATE phantom-ADR-A komment-referanser i 5 migrasjoner til ADR-0269. Self-grant pattern (`granted_by = profile_id`).
- [ ] **T7: Seed script** — `scripts/seed-from-csv-ordregrunnlag.ts` — CSV-path som CLI-arg, UPSERT på `stripe_customer_id` + `external_reference`, eksplisitt Yogurt-mapping (én company-rad, primær cus_*), `paid (feilaktig)` → void med void_reason
- [ ] **T8: Local test** — kjøre på Supabase Local, verifisere: 11 selskap inserted, 33+ fakturaer inserted, Erik magic-link login, 11 grants, idempotent re-run (no diff)
- [ ] **T9: ADR-0269 promoted to accepted** — etter Local-test passerer
- [ ] **T10: Cloud kjøring** — eksplisitt godkjent av Pontus før Cloud INSERT. Verify ADR-0263 ownership-recheck er live i apps/admin (dependent gate).
- [ ] **T11: HANDOFF** — `HANDOFF-billing-erik-seed.md` med rollback-plan + run-instruksjon + Yogurt secondary-cus_* deferral + 6 learnings + manuell prosedyre for nye selskap (auto-grant deferred)
- [ ] **T12: Journeys verifisert** — flip status: draft → verified i begge JOURNEY-filer

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

## Council-verdict (Round Castle 2026-05-04 — RESOLVED)

| Q | Verdict | Detalj |
|---|---------|--------|
| Q1 Stripe storage | **ADD COLUMN** `company.stripe_customer_id text` partial UNIQUE WHERE NOT NULL | Chair P3 self-reversed (sibling-table over-engineering); ADD COLUMN per code-trace |
| Q2 Workspace | **SKIP** — ADR-0118 covers invoice = company-scoped | Konsensus alle 3 reviewers |
| Q3 Status mapping | `void` + `void_reason='stripe_paid_then_card_failed'` + `voided_at='2026-04-06'`; pair med credit_note hvis Stripe utstedte | Konsensus, schema komplett |
| Q4 Yogurt | **1 company** keyed by explicit Stripe-customer-ID list (NOT name-match); secondary cus_* logged for future ADR | Coordinator name-match risk resolved via sequencing not splitting |
| Q5 Super-admin | **CROSS JOIN seed** (option a) + self-grant pattern; REJECT `is_super_admin boolean` | L-0177 forgeable-class + 13+ RLS-edits — REJECT |

### Ekstra funn fra council

- ADR-A phantom (5 migrasjoner siterer unregistered ADR) → resolved by ADR-0269 + M4 komment-fix
- `granted_by = is_godmode LIMIT 1` Cloud-incompatible → self-grant pattern (Erik granter seg selv)
- RLS coverage gap på `user_identity` + `profile` → conditional M3 RLS-migrasjon
- Idempotency gap på `invoice.external_reference` → M2 partial UNIQUE

### Dokumentasjon produsert

- **ADR-0269** — Accountant Portal Data Foundation (consolidated, proposed)
- **L-0199** — Phantom ADR detection pattern
- **L-0200** — is_godmode Cloud-incompatibility
- **L-0201** — CSV explicit-ID-mapping pattern
- **L-0202** — Chair Phase 3 sibling-table over-engineering reversal (5th, promoted to SKILL.md)
- **L-0203** — RLS coverage gap accountant scope
- **L-0204** — invoice.external_reference UNIQUE for idempotent seed
- **COUNCIL-LOG.md** — 2026-05-04 session row appended
