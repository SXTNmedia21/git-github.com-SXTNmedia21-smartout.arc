---
title: "Accountant Portal Data Foundation"
id: ADR_0269
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
---

# ADR-0269: Accountant Portal Data Foundation — Super-admin Grants, Stripe Customer Linkage, RLS Coverage, and Historical-Data Seed Pattern

## Context and Problem Statement

Smartout deployer apps/admin (admin.smartout.ai) som regnskapsfører-portal. Erik (regnskapsfører, `erik@smartout.no`) trenger super-admin tilgang til alle Smartouts kundeselskap + komplett faktura-historikk Jan-Mai 2026 før T2 MVA-frist 10.06.2026. CSV-fil (`SmartOut-Ordregrunnlag-Jan-Mai-2026.csv`) er manuelt avstemt mot Stripe 2026-04-06 og inneholder 11 selskap (6 aktive + 5 kansellerte), 6 kontaktpersoner, 33+ fakturaer.

Eksisterende infra: 5 migrasjoner i `20260521*`-serien etablerte `billing.accountant_company_grant`-tabellen (sibling-table N:M mellom `user_identity` og `company`), RLS self-select-policy, SECURITY DEFINER helpers (`is_accountant_for_company` + `get_accountant_company_ids`), og placeholder-seed med `email='erik@<TBD>'`.

**Problem:** Alle 5 migrasjoner siterer "ADR-A 2026-05-02" som grunnlag — men ingen ADR registrert i `docs/decisions/0000-decision-log.md` matcher denne referansen. Hele accountant-rollen er udokumentert i decision log. Council Round Castle 2026-05-04 identifiserte ytterligere 4 sammenkoblede arkitektur-spørsmål (Stripe customer-ID storage, super-admin pattern uten boolean flag, workspace-uten-I1-bootstrap, RLS-coverage-gap, idempotent seed-pattern) som alle løses optimalt i én konsolidert beslutning.

## Decision Drivers

- **MVA-frist 10.06.2026 (T2)** — Erik må logge inn og se faktura-historikk før denne datoen
- **ADR-A phantom (5 migrasjoner)** — udokumentert decision-grunnlag bryter ADR-audit-job + skaper drift
- **L-0177 forgeable-ID class** — boolean super-admin-flag som bypasser RLS-predikat har samme risk-shape som JWT-default-fallback
- **ADR-0118** invoice = company-scoped (ikke workspace-scoped) — accountant tilgang er per-company, ikke per-workspace
- **ADR-0131** Smartout = merchant-of-record for Stripe — alle customer records er smartout-eide
- **ADR-0263** defense-in-depth ownership-recheck på apps/admin — grant-rader ER ownership-data Erik leser
- **Cloud-kompatibilitet** — `is_godmode = true` brukes ikke på Cloud (ingen seed-bruker har det); enhver `granted_by`-kjede via godmode hard-failer på Cloud
- **Idempotency** — seed må kunne re-kjøres trygt; eksisterende infra mangler UNIQUE på `invoice.external_reference`
- **CSV-data-egenskaper** — org_number er NULL i CSV; name-match-UPSERT skaper cross-company attribution risk (Yogurt-pattern: ett selskap, to Stripe customer-IDer)
- **RLS coverage** — `user_identity` + `profile` har INGEN accountant SELECT-policy; UI som viser kontaktperson-navn ville returnere 0 rader

## Considered Options

### Sub-decision 1: ADR-shape

1. **Option A — Tre separate ADRs** (super-admin + storage + seed-pattern)
2. **Option B — ÉN konsolidert "Accountant Portal Data Foundation"** ← **CHOSEN**
3. **Option C — Amend eksisterende ADR-0118**

### Sub-decision 2: Super-admin grant pattern

1. **Option A — CROSS JOIN seed kun ved migration** (én rad per company nå, ingen auto for nye) ← **CHOSEN**
2. **Option B — `is_super_admin boolean` på user_identity** som bypasser company_id-filter i RLS-helpers — **REJECTED** (L-0177 forgeable-class, 13+ RLS-policy-edits, fjerner row-level access proof)
3. **Option C — Hybrid** (CROSS JOIN nå + AFTER INSERT trigger på `public.company`) — **DEFERRED** til future ADR (auto-grant-trigger-extension)

### Sub-decision 3: Stripe customer-ID storage

1. **Option A — Ny kolonne `company.stripe_customer_id text` UNIQUE-where-not-null** ← **CHOSEN**
2. **Option B — Eksisterende `invoice.external_reference`** som per-customer-ID — **REJECTED** (`external_reference` er per-invoice `in_xxx`, ikke customer `cus_xxx`; forskjellige Stripe-primitiver)
3. **Option C — Ny sibling-tabell `billing.company_payment_provider_link`** — **REJECTED** (over-engineering for 1:1-attributt uten lifecycle-uavhengighet; Yogurt secondary-customer deferreres til future ADR)

### Sub-decision 4: Workspace-creation for historisk billing-data

1. **Option A — Bypass I1 industry bootstrap** med dokumentert exception
2. **Option B — Auto-stub minimal hospitality** (industry='hospitality', niche=null)
3. **Option C — Skip workspace-tabellen helt** ← **CHOSEN** (ADR-0118 etablerte allerede invoice = company-scoped; Erik trenger ikke workspace-rader)

### Sub-decision 5: RLS coverage på `user_identity` + `profile` for accountant scope

1. **Option A — Conditional M3-migrasjon** med to nye policies, kun hvis UI demonstrerbart trenger det ← **CHOSEN**
2. **Option B — Alltid legge til policies** (over-grant)
3. **Option C — Aldri legge til policies** (UI tvinges til kun `company_member`-data)

### Sub-decision 6: Historical-data seed-pattern

1. **Option A — Name-match UPSERT** — **REJECTED** (CSV org_number=NULL skaper cross-company attribution)
2. **Option B — Eksplisitt ID-mapping i script-input + UPSERT på Stripe-IDer** ← **CHOSEN**
3. **Option C — INSERT-only** (ikke idempotent) — **REJECTED**

## Decision Outcome

**Chosen: Option B — ÉN konsolidert ADR**, med sub-decisions per ovenfor:

- **Accountant rolle + cross-company access** = `billing.accountant_company_grant` sibling-table-pattern (formaliserer ADR-A draft-label)
- **Super-admin pattern** = CROSS JOIN seed + self-grant (`granted_by = profile_id` for Erik selv) + manuell prosedyre for nye selskap dokumentert i HANDOFF
- **Stripe customer-ID** = `company.stripe_customer_id text` med partial UNIQUE WHERE NOT NULL; per-invoice ID forblir i `invoice.external_reference`
- **Workspace** = ikke opprettes for historisk billing-seed (Erik trenger ikke; ADR-0118 dekker)
- **RLS coverage** = M3 conditional på UI-scope-verifisering; default INKLUDERT for trygghet
- **Seed-pattern** = idempotent UPSERT på Stripe-IDer (ikke navn), eksplisitt customer-ID-mapping for ambiguous cases (Yogurt), CSV-path som CLI-arg, service-role-bypass dokumentert i HANDOFF

### Migrasjons-rekkefølge

| # | Filnavn (≥ 20260525) | Hva | Idempotency-key |
|---|----------------------|-----|------|
| M1 | `2026052500_company_stripe_customer_id_column.sql` | ADD COLUMN + partial UNIQUE WHERE NOT NULL | n/a (DDL) |
| M2 | `2026052501_invoice_external_reference_unique.sql` | Partial UNIQUE index for idempotent seed | n/a (DDL) |
| M3 | `2026052502_billing_accountant_user_identity_profile_rls.sql` | 2 nye RLS-policies på user_identity + profile (full_kartotek scope) | DROP IF EXISTS / CREATE POLICY |
| M4 | `2026052503_billing_super_admin_erik.sql` | Erik bootstrap + CROSS JOIN grant + UPDATE phantom-ADR-A komment-referanser til ADR-0269 | ON CONFLICT (user_id, company_id) DO NOTHING |

### Seed-script: `scripts/seed-from-csv-ordregrunnlag.ts`

- Tar CSV-path som CLI-arg, ikke hardkodet WSL-mount
- UPSERT på `company.stripe_customer_id` (M1 partial UNIQUE)
- UPSERT på `invoice.external_reference` (M2 partial UNIQUE)
- Eksplisitt Yogurt-mapping: `cus_TrwaXgWifyUcZm` + `cus_TxTgxCXbwLZThb` → samme `Yogurt Heaven AS` company-rad (primær: nyeste; sekundær: logget i HANDOFF for future multi-customer ADR)
- Voided invoices: `status='void'` + `void_reason='stripe_paid_then_card_failed'` for `paid (feilaktig)` rader, `voided_at='2026-04-06'`
- Engangs-fakturaer: `invoice_type='one_off'` (Spåtind 19.375)
- Ingen `auth.users`-rader for de 5 ikke-Erik-kontaktene (de har bare `profile`-data tilknyttet sin company, ikke login-tilgang)
- Erik får `auth.users` + `user_identity` + `profile` + 11 grant-rader (én per company)

### Phantom-ADR-A-resolusjon

Alle 5 migrasjoner i `20260521*`-serien som siterer "ADR-A 2026-05-02" oppdateres som del av M4 til å sitere ADR-0269. Update-pattern: SQL-kommentar-redigering, ikke schema-endring (migrasjoner allerede applied på dev — kommentar-only fix).

### Yogurt secondary-customer-defer

Yogurt Heaven AS har to Stripe customer-IDer pga kort-betaling som feilet og ny profil ble opprettet. ADR-0269 håndterer det som **én company-rad** med primær `stripe_customer_id`. Sekundær customer-ID logges i HANDOFF + reserveres som scope for **future ADR: "Multi-Stripe-customer-per-company linkage"** (når neste case dukker opp eller Yogurt re-aktiveres).

## Rules & Consequences

- **Good, because** decision-log fanger rolle som lever i 5 migrasjoner men aldri ble registrert (phantom-ADR-A resolved)
- **Good, because** future accountant-features (multi-account, Brønnøysund backfill, Stripe webhook ongoing sync, Tripletex export, accountant self-onboarding) har ÉN parent ADR å bygge på
- **Good, because** `is_super_admin` boolean blokkeres permanent — alle accountant-tilganger må gå via `accountant_company_grant`-rader, bevarer audit-trail
- **Good, because** `granted_by = self` mønster gjør Cloud-deployment trivielt (ingen avhengighet av godmode-bruker)
- **Good, because** `company.stripe_customer_id` partial UNIQUE muliggjør idempotent seed uten å forhindre 1:N i fremtid (kolonne kan dropps og erstattes med sibling-tabell senere uten å bryte invariants)
- **Good, because** Yogurt secondary-customer er eksplisitt deferral, ikke skjult debt — fanges i HANDOFF og future ADR-slot
- **Bad, because** ADR er ~3-4 sider og dekker 6 sub-beslutninger; supersede individuelt krever ammend-pattern, ikke replace
- **Bad, because** auto-grant-trigger på nye selskap er deferred — manuell INSERT kreves for hver ny kunde (men dokumentert i HANDOFF som operatør-prosedyre, og kan trigger-ifiseres via future ADR)
- **Bad, because** RLS-policies på user_identity/profile (M3) overgranter — accountant ser e-post + display_name for alle medlemmer av selskap de har grant til (akseptabel for regnskapsformål, men dokumentert)

### Agent Impact

- **Build agents:** når noen oppretter ny accountant-rolle (eller utvider eksisterende), må de bygge på ADR-0269 — ikke duplisere super-admin-pattern. Sjekkliste: (a) bruker `accountant_company_grant`-tabellen, (b) ingen `is_super_admin` boolean, (c) `granted_by = self` for bootstrap, (d) UPSERT-keyed på Stripe-IDer ikke navn for seed-data
- **System-steward audit:** ADR-269 må refereres i decision-log, ADR-A komment-fix verifiseres i M4
- **Future ADR-skribenter:** seks ekspansjons-slots åpne — multi-customer-per-company, auto-grant-trigger, Brønnøysund-backfill, Stripe-webhook-sync, Tripletex-export, accountant-self-onboarding
- **Apps/admin developers:** ADR-0263 ownership-recheck-pattern fortsatt mandatory (defense-in-depth); accountant_company_grant-rader ER ownership-data
- **Cloud-deployment:** seed-script må kjøres med eksplisitt godkjenning fra Pontus (T8 i plan); aldri automatisk

### Bygger på (referanser)

- ADR-0027 (Pricing Terms) — workspace commercial model
- ADR-0118 (Invoice Engine = C3 Consumer) — invoice = company-scoped foundation
- ADR-0120 (Invoice Immutability + Credit Note) — void + credit_note pattern for Yogurt
- ADR-0129 (Integration Adapter Pattern) — separat concern (sync-operasjon ≠ identity); ikke amendert
- ADR-0131 (Stripe Connect Platform Model) — parent for customer-linkage (Smartout = merchant-of-record)
- ADR-0192 (Authority Seed Bootstrap-Trigger Pattern) — generic AFTER-INSERT trigger-pattern (referert for future auto-grant)
- ADR-0262 (Admin File Downloads via 302-Redirect) — apps/admin canonical pattern
- ADR-0263 (Defense-in-Depth Ownership Re-Check) — accountant_company_grant-rader er ownership-data
- ADR-0264 (Cross-Company Audit Destination, proposed) — telemetry-destinasjon for cross-company emit-er
- L-0177 (Forgeable-ID class) — falsifying-evidence for `is_super_admin` REJECT

### Future ADRs (extension slots)

- **ADR-XXXX: Multi-Stripe-customer-per-company linkage** — når Yogurt re-aktiveres eller andre selskap får sekundær customer
- **ADR-XXXX: Auto-grant-trigger på `public.company` INSERT** — fjerner manuell prosedyre for nye selskap
- **ADR-XXXX: Brønnøysund backfill for `company.org_number` + adresse** — egen sortie
- **ADR-XXXX: Stripe webhook ongoing sync** — drop CSV som primær kilde
- **ADR-XXXX: Tripletex ledger export fra apps/admin** — Erik produserer regnskap direkte
- **ADR-XXXX: Accountant self-onboarding flow** — andre regnskapsfører-firma onboardes uten Pontus

---

> Registered in `docs/decisions/0000-decision-log.md` 2026-05-04. Council Round Castle 2026-05-04 verdict: APPROVE WITH CHANGES → consolidated to single ADR per Pontus decision (option B).
