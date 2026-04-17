---
title: "Fase 2 Scope Exclusion — Contract Onboarding Extracted to Fase 2.5"
id: ADR-0130
status: accepted
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-17
---

# ADR-0130: Fase 2 Scope Exclusion — Contract Onboarding Extracted to Fase 2.5

## Context and Problem Statement

Billing Fase 2 spec rev 1 inkluderte en "åpen seksjon §7" som beskrev flyten fra kontrakt-signert → pricing_terms-oppretting → onboarding-faktura. Council-syntese avdekket at denne seksjonen: (a) bygde på to feilaktige premisser (`supabase-js` transaksjoner, `company.pricing_terms_id` kolonne som ikke eksisterer), (b) foreslo inline utvidelse av DocuSeal-webhook som bryter separation-of-concerns, og (c) har uavhengig beslutningsvekt (plan-mapping, proration, trial-perioder, discount codes) som ikke passer inn i Fase 2's dispatch-infrastruktur-fokus. Extrahering til separat Fase 2.5-spec ble anbefalt av Supervisor og bekreftet av Steward.

## Decision Drivers

- **Scope-disiplin:** Fase 2 er allerede 6-7 uker og 50+ tasks uten onboarding. Å blande infrastruktur-bygg med feature-beslutninger øker risiko.
- **Arkitekturvekt:** Onboarding-flyten har minst 4 egne designvalg (plan-mapping, proration-regler, trial-periode-semantikk, discount-code-integrasjon) som fortjener egen discovery-sesjon.
- **Webhook-gjeld:** DocuSeal-webhook mangler `company_id` + `metadata` i select; utvidelse må skje atomisk med provisjonerings-logikk eller via separat event-engine-process.
- **Transaction reality:** `supabase-js` har ikke transaksjoner — "i samme transaksjon" fra rev 1 var faktisk falsk. Enten SQL RPC-wrapper eller eksplisitt best-effort semantikk trengs. Denne beslutningen fortjener egen vurdering.

## Considered Options

1. **Behold §7 som del av Fase 2** — skriv v1 inline i webhook, aksepter best-effort semantikk. *(Avvist — blander scope, bygger på uløste premisser.)*
2. **Ekstraher til Fase 2.5 mini-spec** — egen spec, egen implementasjonsrunde etter Fase 2-merge. Fase 2 har ikke onboarding-automatikk; platform-admin tildeler pricing_terms manuelt. *(Valgt.)*
3. **Ekstraher til Fase 3** — vent til Stripe Connect + EHF er på plass. *(Avvist — unødvendig utsettelse; onboarding kan leveres før Stripe.)*

## Decision Outcome

Chosen option: **"Ekstraher til Fase 2.5 mini-spec"**, fordi det skiller infrastruktur-leveransen fra feature-beslutningen uten å parkere onboarding til Fase 3.

**Konkret konsekvens for Fase 2:**

1. **Onboarding-faktura genereres IKKE automatisk** når SaaS-kontrakt signeres i Fase 2. Platform-admin bruker `/platform-admin/billing/invoices/new` (Fase 2 Spor C) for å lage onboarding-faktura manuelt med `invoice_type = 'onboarding'` (eksisterende enum).
2. **`pricing_terms` opprettes manuelt** av platform-admin på `/platform-admin/billing/pricing-terms` (eksisterende UI fra Fase 1). Kontraktens `metadata`-felt kan leses for referanse, men ikke automatisk applisert.
3. **DocuSeal-webhook forblir uendret** i Fase 2 — ingen billing-provisjonering innlagt. Webhooken emitter `contract signed` som i dag, og Fase 2.5's `engine_process` vil senere konsumere denne event-en.
4. **Ingen nye ADR-ramifikasjoner for Fase 2** — onboarding-flyten får sine egne ADRs når Fase 2.5-spec skrives.

**Fase 2.5 spec-omfang (skrives når B1-B5 er merget):**

- DocuSeal-webhook select-extension: `company_id, metadata` legges til
- Ny `engine_process`: `onboarding_billing_provisioning` trigget av `contract signed`
- Steg 1: resolve `pricing_terms` fra `contract.metadata.pricing_terms` eller velg eksisterende aktiv
- Steg 2: opprette onboarding-faktura hvis `metadata.onboarding_fee > 0`
- Steg 3: dispatch via Fase 2 Spor A
- Idempotens-garanti: `contract_id` som unik nøkkel i `engine_state` per-kontrakt
- Åpne spørsmål å løse i Fase 2.5-spec: proration ved midt-i-måned-signering, discount codes, trial-periode-representasjon

**Timeline:** Fase 2.5 spec skrives når Fase 2 B5 merges (estimert +6 uker fra nå). Ingen blokker for Fase 2 shipping.

## Rules & Consequences

- **Good, because** Fase 2 leverer infrastruktur uten å vente på feature-beslutninger som krever egen discovery
- **Good, because** onboarding-beslutningene (proration, trials, discounts) får dedikert vurdering i stedet for å bli dratt inn sidekontrakt-bygging
- **Good, because** Fase 2.5 kan utnytte Fase 2's `engine_process`-kobling + Spor A dispatch fra dag én — rent fundament
- **Bad, because** kunder som signerer kontrakt i Fase 2-perioden får manuell onboarding — platform-admin må huske å provisjonere
- **Bad, because** "Fase 2.5" er en ny konseptuell enhet som må vedlikeholdes i planer + dokumentasjon
- **Agent Impact:** Ingen Fase 2 batch skal røre DocuSeal-webhook (`apps/web/src/app/api/webhooks/docuseal/route.ts`). Platform-admin onboarding skjer via eksisterende UI i Fase 2. Fase 2.5-spec skrives før noen `onboarding_billing_provisioning` engine_process implementeres.

---

> Register in `docs/decisions/0000-decision-log.md` and update CLAUDE.md's ADR table.
