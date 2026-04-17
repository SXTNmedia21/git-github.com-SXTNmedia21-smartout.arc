---
title: "Billing Engine Fase 3 — Payments + EHF + Automated Dunning (Spec)"
status: draft
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [billing, invoice, faktura, stripe, stripe-connect, ehf, peppol, dunning, n8n, fiken, tripletex, platform-admin, cascade-c3]
depends_on:
  - docs/superpowers/specs/2026-04-17-billing-engine-fase-2-design.md
related:
  - docs/superpowers/specs/2026-XX-XX-billing-contract-onboarding-design.md
---

# Billing Engine Fase 3 — Payments + EHF + Automated Dunning

> **Status:** Draft spec, to be council-reviewed.
> **Authors:** Pontus Lindroth + Claude Opus 4.7.
> **Bygger på:** Fase 2 (dispatch + integration framework, merget til development 2026-04-XX commit `ceef4a9e`+).

---

## 1. Kjerneprinsipp

Fase 1 bygde fakturamotoren. Fase 2 bygde utsendelsen (dispatch) + rammeverket (integration framework). Fase 3 bygger **betaling + offentlig sektor + automatisering + opprydding**.

Konkret:
- **Stripe Connect** — kort/bankbetaling via Stripe Checkout. Fullfører "Stream 2" fra Fase 2-handoff. Inkluderer nytt `payment` + `payment_attempt` skjema som Fase 2 advarte om at kunne trenges (§17).
- **EHF/Peppol XML** — implementasjon av `PeppolEhfAdapter`-klassen (Fase 2 reserverte enum + interface). Inkluderer Digdir-sertifiseringsløp.
- **Automatisert dunning** — n8n-workflow som leser `invoice.dunning_status` og oppretter `invoice_dispatch` på email-kanal med dunning-template. Eskaleringsregler.
- **Bidirectional integration sync** — les inn kundebetalinger fra Fiken/Tripletex via eksisterende integration adapter-pattern. Auto mark-paid.
- **Workspace integration config** — self-serve "Koble til Min Fiken" for workspace-admin.
- **`invoice.delivery_*` DROP COLUMN** — hard drop per ADR-0128 (dato: 2026-07-01 eller Fase 3-close).

**Ikke i Fase 3:** Multi-currency invoicing (behold NOK/EUR som Fase 1), forhåndsbetaling/deposits, reversering av credit notes.

**Arkitektonisk plassering:** C3 Commercial utvidelser. Påvirker ikke cascade-dimensjoner. Gjenbruker Fase 2's engine_process-orkestrering og dispatch-adapter-pattern.

---

## 2. Fase-scope

### In scope (Fase 3)

**Spor A — Stripe Connect payments:**
1. `payment` + `payment_attempt` skjema (nye tabeller)
2. Stripe Connect onboarding for platform (Smartout) + workspace (hvis workspace vil motta betalinger direkte — likely Smartout mottar + fordeler internt, avgjøres i council)
3. `StripeDispatchAdapter` — ny dispatch-adapter som sender faktura til Stripe Invoice API og returnerer Checkout URL
4. `stripe-webhook` Edge Function — mottar `payment_intent.succeeded`, `charge.refunded` etc. → auto mark-paid
5. Kunde-e-post inneholder "Betal nå"-lenke → Stripe Checkout → webhook → status flip
6. Platform-admin payment-dashboard — list payments, se status, manuelt refunder
7. `mark_paid` Server Action utvides: `stripe_payment_intent_id` branch auto-verifiserer payment før status flip

**Spor B — EHF/Peppol XML:**
1. `PeppolEhfAdapter`-klasseimplementasjon (erstatter Fase 2's skjelett)
2. XML-generering: EHF Billing 3.0 format (UBL 2.1 subset) via bibliotek eller in-house (`packages/billing/src/dispatch/adapters/peppol-ehf/`)
3. Sertifisering mot Digdir Peppol test-access point
4. `billing_dispatch_rule` for `peppol_ehf`-kanal — target = `{peppol_participant_id}` (0192:<orgnr>)
5. Validation — `Peppol BIS Billing 3.0` schematron-kjøring før dispatch
6. `billing_integration` av type `peppol_ap` — valgfri, for kunder som vil motta EHF bunnet til eget access point

**Spor C — Automatisert dunning:**
1. n8n-workflow (ekstern) — leser fra Supabase via API-nøkkel, ser `invoice WHERE dunning_status IS NOT NULL AND days_overdue >= threshold`
2. Oppretter `invoice_dispatch` på `email_customer`-kanal med `dunning-template` (dunning_stage_1 / stage_2 / stage_3 templates)
3. Eskalering: +7 dager → stage_1 (påminnelse), +14 → stage_2 (varsel om inkasso), +30 → stage_3 (sendt til inkasso, `invoice.dunning_status = 'collection'`)
4. Platform-admin kan overstyre/utsette per faktura
5. Workspace-admin kan deaktivere auto-dunning for egen workspace (workspace-level dispatch rule `action='suppress'` på dunning-events)

**Spor D — Bidirectional integration sync:**
1. Fiken-adapter + Tripletex-adapter — ekte implementasjoner av `IntegrationAdapter` (erstatter Fase 2's Placeholder)
2. Utgående sync (allerede i Fase 2 framework): customer/invoice/product ut
3. **Nytt i Fase 3: inngående sync** — en ny `engine_process` `integration_poll_payments` som poller Fiken/Tripletex for nye betalinger på Smartout-fakturaer og auto mark-paid
4. Credential management via 1Password + per-integrasjon `config.auth_ref = op://...`
5. Error handling: hvis Fiken svarer at kunde ikke finnes, opprett kunde automatisk

**Spor E — Workspace integration config:**
1. `/dashboard/billing/settings/integrations` — ny fane for workspace-admin
2. "Koble til Fiken"-flyt: OAuth redirect → lagrer refresh_token som 1Password-ref eller kryptert jsonb
3. RLS på `billing_integration` utvides: workspace_admin kan CRUD egne rader (workspace_id = any_user_workspace)
4. Platform-admin kan fortsatt se alle

**Spor F — `invoice.delivery_*` drop:**
1. Migration drop `invoice.delivery_channel`, `invoice.delivery_status`, `invoice.external_reference`
2. Dual-write-koden (B2) fjernes
3. `billing_query` AI-tool oppdateres hvis noen tools fortsatt leser kolonnene (verifisert i Fase 2 — ingen, men re-verifiser)
4. Drop skal skje FØR 2026-07-01 eller ved Fase 3-close (ADR-0128 bindende)

### Out of scope (Fase 4+)

| Element | Hvorfor utsatt |
|---------|---------------|
| Multi-currency per invoice (beyond NOK+EUR) | Lav prioritet; markedet er nordisk |
| Deposits / prepayments | Ikke etterspurt; kommer ved behov |
| Reversering av credit note (re-open faktura) | Bokføringsrisiko — må utredes separat |
| Stripe Tax calculation | Bruker Smartouts egen MVA-logikk for nå |
| Apple Pay / Google Pay explicitly | Stripe Checkout støtter dem automatisk |
| Direct debit (AvtaleGiro) | Norsk spesifikk; separat fase hvis kunder ber |
| Split payments / marketplace model | Ikke i vårt bruksområde |

---

## 3. Spor A — Stripe Connect Payments

### 3.1 Problem

Fase 2 leverer faktura via email med PDF + link. Kunden må manuelt overføre til bank. Vi ønsker **"Betal nå"-knapp** som tar dem rett til Stripe Checkout, og når de betaler skal fakturaen auto-merkes betalt uten manuell intervensjon.

### 3.2 Datamodell

**Ny tabell: `payment`**

| Felt | Type | Note |
|------|------|------|
| `payment_id` | uuid PK | |
| `invoice_id` | uuid FK NOT NULL | |
| `company_id` | uuid FK NOT NULL | snapshot ved oppretting |
| `payment_method` | `payment_method_type` enum | `stripe_card`, `stripe_bank`, `bank_transfer`, `manual_adjustment` |
| `amount` | decimal(12,2) | |
| `currency` | `currency` enum | |
| `status` | `payment_status` enum | `pending`, `processing`, `succeeded`, `failed`, `refunded`, `partially_refunded` |
| `external_id` | text | Stripe payment_intent_id, etc. |
| `paid_at` | timestamptz NULL | |
| `refunded_amount` | decimal(12,2) NULL | |
| `created_at`, `updated_at` | timestamptz | |

**Ny tabell: `payment_attempt`**

Logg over hver forsøk (for debugging + audit):

| Felt | Type | Note |
|------|------|------|
| `payment_attempt_id` | uuid PK | |
| `payment_id` | uuid FK | |
| `attempt_number` | int | |
| `status` | text | Stripe event navn e.g. `payment_intent.created`, `payment_intent.succeeded` |
| `raw_event` | jsonb | Full Stripe webhook payload (redacted for PCI) |
| `error_code` | text NULL | |
| `error_message` | text NULL | |
| `created_at` | timestamptz | |

**`invoice`-utvidelse:** ingen nye kolonner. `invoice.status = 'paid'` + `payment` rad er kilde-av-sannhet. `payment_reference` kan holde `payment.payment_id` for referanse.

### 3.3 StripeDispatchAdapter

Ny adapter i `packages/billing/src/dispatch/adapters/stripe.ts`:

```ts
export const StripeDispatchAdapter: DispatchAdapter = {
  channel: 'stripe_invoice',  // ny enum-verdi i billing_dispatch_channel
  async send({ invoice, target, template }) {
    // 1. Opprett Stripe Invoice (eller PaymentIntent hvis vi går forbi Invoice API)
    // 2. Returner Checkout URL som external_reference
    // 3. Email adapter får så injisert Checkout URL i email-template
  },
};
```

**Beslutningspunkt (council):** bruker vi Stripe Invoice API (Stripe lager sin egen faktura-side) eller Stripe PaymentIntent (vi holder egen faktura-UI)? Anbefaling: PaymentIntent + Checkout Session — Smartout er source-of-truth, Stripe er bare betalingskanal.

### 3.4 Webhook Edge Function

`supabase/functions/stripe-webhook/index.ts`:
- Verifiserer Stripe webhook signature
- Events å håndtere: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `payout.paid`
- På `payment_intent.succeeded` → opprett `payment_attempt` → oppdater `payment.status = 'succeeded'` → trigger Fase 2 engine_process `invoice_dispatch_delivery` til `email_customer` med receipt-template → set `invoice.status = 'paid'` + `invoice.paid_at` (hvis dette er full amount)
- Partial payments: `invoice` kan ha flere `payment` rows; flipper til `paid` når sum(payment.amount) >= invoice.amount_incl_vat

### 3.5 UI

**Platform-admin:**
- `/platform-admin/billing/payments` — ny liste over alle payments + status filter
- Per payment: refund-knapp med confirm dialog
- Per invoice på eksisterende detail-side: payment-historikk-seksjon

**Workspace-admin:**
- `/dashboard/billing/[invoice_id]` viser "Betal nå"-knapp hvis `invoice.status = 'issued'` og Stripe Connect er aktiv
- Klikk → navigerer til Stripe Checkout → return til Smartout etter betaling → status oppdatert

---

## 4. Spor B — EHF/Peppol XML

### 4.1 Problem

Norske B2B-kunder (spesielt offentlig sektor) krever EHF-faktura levert via Peppol-nettverket. Fase 2 reserverte enum-verdi `peppol_ehf` men shipper ingen adapter-klasse. Fase 3 implementerer XML-generering + Peppol sending.

### 4.2 Implementasjon

**Bibliotek-valg (council):**
- `@pepol/ehf-node` (hypotetisk)
- Egen XML-generator med UBL 2.1-template + Handlebars
- Tredjeparts webservice (f.eks. Tickstar, Pagero) som håndterer både generering og sending

**Anbefaling:** start med egen XML-generator for minimum leverbar + bruk Tickstar eller tilsvarende som access point i production. Reduserer vendor-lock-in på generator, men utnytter eksisterende infrastruktur for transport.

### 4.3 Datamodell

**Ny kolonne på `company`:** `peppol_participant_id text` — format `0192:<orgnr>`. Settes av platform-admin eller via bedriftsregister-oppslag.

**Ny kolonne på `company`:** `ehf_enabled bool default false` — workspace kan toggle dette når de har konfigurert seg som EHF-sender.

### 4.4 Dispatch flow

1. `billing_dispatch_rule` med `channel='peppol_ehf'` + `target={peppol_participant_id: company.peppol_participant_id}` matcher
2. `PeppolEhfAdapter.send()` genererer XML fra invoice + line_items + company + tariff + VAT
3. Schematron-validering (Peppol BIS Billing 3.0)
4. POST XML til access point endpoint
5. `external_reference` = Peppol message-ID

### 4.5 Certification

Digdir-sertifisering krever:
- Test-sending til Digdir test-AP (2-3 uker, pair-review mot reference messages)
- Produksjons-registrering av Smartout som sending Peppol-deltaker (dette er Pontus sitt ansvar — eksisterer allerede eller må søkes)

**Handoff-element:** Fase 3-close inkluderer completed Peppol-sertifisering eller eksplisitt deferral til Fase 4.

---

## 5. Spor C — Automatisert Dunning

### 5.1 Problem

Fase 1 gav platform-admin mulighet til å markere faktura som overdue og legge til dunning-notat manuelt. Fase 3 automatiserer eskalerings-kjeden.

### 5.2 n8n-workflow

**Workflow:** `smartout-billing-dunning-scan`
- Trigger: pg_cron daglig 08:00 Oslo
- Query Supabase via API-nøkkel: fakturaer hvor `status='overdue'` AND `(dunning_status IS NULL OR dunning_status IN ('reminder_1', 'reminder_2'))`
- Per faktura: beregn `days_overdue`. Matrix:
  - +7 dager + `dunning_status = NULL` → skriv `dunning_status = 'reminder_1'`, opprette `invoice_dispatch` med email_customer + dunning_reminder_1_template
  - +14 dager + `dunning_status = 'reminder_1'` → `'reminder_2'`, tilsvarende dispatch
  - +30 dager + `dunning_status = 'reminder_2'` → `'collection'`, send final varsel + trigger intern eskalering (email til Pontus)

**Workspace opt-out:** workspace-admin kan opprette `billing_dispatch_rule` med `action='suppress'` + `trigger_event='invoice dunning_escalated'` → disables dunning for deres workspace.

### 5.3 Templates

Nye `billing_dispatch_template` rader:
- `dunning_reminder_1` (nb-NO, en-US): vennlig påminnelse
- `dunning_reminder_2` (nb-NO, en-US): formelt varsel
- `dunning_collection_notice` (nb-NO, en-US): inkassovarsel

### 5.4 Audit trail

Hvert eskaleringssteg emitter `invoice dunning_escalated` event med data.from_stage + data.to_stage. Event registrert i telemetry.

---

## 6. Spor D — Bidirectional Integration Sync

### 6.1 Problem

Fase 2 gjør outbound sync (Smartout → Fiken). Fase 3 legger til inbound: leser betalinger fra Fiken/Tripletex og auto mark-paid i Smartout.

### 6.2 Fiken-adapter

`packages/billing/src/integrations/adapters/fiken.ts` — implementerer `IntegrationAdapter`:

```ts
export const FikenAdapter: IntegrationAdapter = {
  type: 'fiken',
  supports: ['customer', 'invoice', 'contract', 'product', 'plan'],
  async sync(input) {
    // Outbound (som i Fase 2 placeholder, nå ekte):
    // Bruker Fiken REST API: POST /companies/{id}/invoices
    // Credentials fra 1Password via config.auth_ref
  },
  async testConnection(integration) {
    // GET /me
  },
};
```

### 6.3 Inbound poll

Ny `engine_process`: `integration_poll_payments`
- trigger_events: `['hourly_poll']` (kron-utløst)
- Steg 1: List Fiken-invoices med `paid=true` siden sist poll (`billing_integration.last_poll_at`)
- Steg 2: Match på `external_reference` → finn Smartout-invoice
- Steg 3: Hvis Smartout-invoice har status != 'paid', opprett `payment` rad + flip status
- Steg 4: Oppdater `billing_integration.last_poll_at`

### 6.4 Credential management

Per `billing_integration.config`:
```jsonb
{
  "api_base": "https://api.fiken.no/api/v2",
  "auth_ref": "op://smartout_ai/fiken_workspace_xyz/access_token"
}
```

`op://` resolved runtime ved bruk — aldri i logger/DB.

---

## 7. Spor E — Workspace Integration Config

### 7.1 Problem

Fase 2 la integration CRUD være platform-admin-only. Workspaces som vil koble til Fiken eller Tripletex må self-serve.

### 7.2 UI

`/dashboard/billing/settings/integrations`:
- Ny fane "Integrasjoner"
- "Koble til Fiken" / "Koble til Tripletex" / "Koble til Stripe" knapper
- OAuth flow for Fiken/Tripletex; Stripe Connect onboarding for Stripe
- Gallerivisning av tilkoblede integrasjoner + status (healthy/error)

### 7.3 RLS utvidelse

`billing_integration` RLS fra Fase 2:
- `platform_admin_all`: unchanged
- **NY:** `workspace_admin_own_crud`: `workspace_id IN (SELECT workspace_id FROM company_member WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))`

### 7.4 OAuth infrastructure

Ny Edge Function `integration-oauth-callback` — felles callback for Fiken/Tripletex/Stripe Connect. Verifiserer state-nonce, utveksler code for token, lagrer 1Password-ref.

---

## 8. Spor F — `invoice.delivery_*` DROP

### 8.1 Gjennomføring

**Migration `YYYYMMDDHHMMSS_drop_invoice_delivery_columns.sql`:**
- Pre-flight: grep `rg 'delivery_channel|delivery_status|external_reference' apps/ packages/` → forvent zero matches in app code. Hvis noe fortsatt leser → B2/B3-reversion.
- ALTER TABLE `invoice` DROP COLUMN `delivery_channel`, DROP COLUMN `delivery_status`, DROP COLUMN `external_reference`
- Drop tilhørende CHECK constraint
- Fjern dual-write kode fra B2's `dispatch_invoice` handler

**Deadline:** Migration landet før 2026-07-01 (ADR-0128).

---

## 9. Datamodell-oppsummering

| Tabell/kolonne | Endring | Migrasjonstype |
|---------------|---------|---------------|
| `payment` | NY | CREATE |
| `payment_attempt` | NY | CREATE |
| `payment_method_type` enum | NY | CREATE TYPE |
| `payment_status` enum | NY | CREATE TYPE |
| `company.peppol_participant_id` | NY kolonne | ALTER |
| `company.ehf_enabled` | NY kolonne | ALTER |
| `billing_dispatch_channel` enum | + `'stripe_invoice'` | ALTER TYPE |
| `billing_integration_type` enum | + `'peppol_ap'` hvis gateway-integration | ALTER TYPE (valgfri) |
| `billing_dispatch_template` seed | + dunning templates (3x) | INSERT |
| `engine_process` seed | + `integration_poll_payments` | INSERT |
| `engine_trigger` seeds | + hourly_poll → integration_poll_payments | INSERT |
| `invoice.delivery_channel` etc. | DROP (Spor F) | ALTER DROP COLUMN |
| `billing_integration` RLS | utvides med workspace_admin | DROP POLICY + CREATE POLICY |

**Estimat:** 7-10 nye migrasjoner.

---

## 10. ADR-kandidater

| ADR | Tittel | Hvorfor |
|-----|--------|---------|
| **ADR-next** | Stripe Connect vs direct Stripe (platform model) | Hvem eier Stripe-kontoen? Smartout mottar + viderefakturerer, eller workspaces mottar direkte via Connect? |
| **ADR-next** | Payment reconciliation — invoice → payment(s) vs payment → invoice | Multi-payment single invoice (partial payments), eller 1:1? |
| **ADR-next** | EHF XML library vs in-house generator | Bygge egen eller bruke 3rd-party (Tickstar, Pagero)? |
| **ADR-next** | n8n vs Supabase cron for dunning | n8n for flyt-fleksibilitet; Supabase cron for enkelhet. |
| **ADR-next** | `invoice.delivery_*` DROP migration gjennomføring | Når? Hvordan? Rollback-plan? |
| **ADR-next** | Workspace-admin integration OAuth flow (Fiken/Tripletex token storage) | 1Password vs kryptert jsonb vs Supabase Vault? |

---

## 11. Telemetry

Nye events i `packages/telemetry/src/registry.ts`:

| Event | Trigger | Destinations |
|-------|---------|--------------|
| `payment initiated` | Stripe Checkout session opprettet | posthog, logger, billing_activity_log |
| `payment succeeded` | Stripe webhook payment_intent.succeeded | posthog, logger, billing_activity_log, engine_event |
| `payment failed` | Stripe webhook | posthog, logger, billing_activity_log, *alert* |
| `payment refunded` | Stripe webhook charge.refunded | posthog, logger, billing_activity_log |
| `invoice dunning_escalated` | n8n dunning-workflow | posthog, logger, billing_activity_log, engine_event |
| `integration poll_started` | Fiken/Tripletex scheduled poll | logger only |
| `integration poll_found_payment` | inbound payment fra integration | posthog, logger, billing_activity_log, engine_event |
| `integration oauth_connected` | workspace konfigurerer Fiken/Stripe | posthog, logger, billing_activity_log |
| `ehf submission_sent` | Peppol XML sendt | posthog, logger, billing_activity_log |
| `ehf submission_accepted` | Peppol message receipt | posthog, logger, billing_activity_log |

---

## 12. RLS utvidelser

| Tabell | Endring |
|--------|---------|
| `payment` | RLS: platform_admin_all + workspace_admin_read (own workspace) |
| `payment_attempt` | RLS: platform_admin_all (ingen workspace-read — kan inneholde raw Stripe events med PII) |
| `billing_integration` | Utvid: workspace_admin_own_crud (workspace_id = any_user_workspace) |

---

## 13. Mobile parity

| Surface | Desktop | Mobile | Begrunnelse |
|---------|---------|--------|-------------|
| Platform-admin payments-liste | ✅ | ❌ | Admin-verktøy |
| Platform-admin refund-knapp | ✅ | ❌ | Admin-verktøy |
| Workspace "Betal nå"-knapp | ✅ | ✅ | Kunde-flow — mobil kritisk |
| Workspace Stripe Checkout | ✅ | ✅ | Stripe er mobilvennlig per default |
| Workspace "Integrasjoner"-fane | ✅ | ✅ | Workspace-admin kan koble til fra mobil |
| n8n dunning-workflow | N/A | N/A | Backend (n8n server-side) |
| EHF-generering | N/A | N/A | Backend |

Pure functions i `packages/billing/src/actions/payments/` + `integrations-oauth/` — gjenbrukbare for mobile.

---

## 14. i18n

Workspace-UI MUST bruke nb-NO + en-US via `@smartout/i18n`. Nye strings i `packages/i18n/locales/{nb,en}/billing.json`:
- `payments` namespace
- `integrations` namespace (utvides fra Fase 2)

Dunning-email-templates: lagres i `billing_dispatch_template.body_template` med Mustache-variabler. Bygges per locale (`locale` kolonne).

---

## 15. Batching (B1-B8)

| Batch | Scope | Estimert | Parallelt med |
|-------|-------|----------|---------------|
| **B1** | ADRs (6) + schema (payment/payment_attempt + RLS + dispatch_channel/integration_type enum extensions) + telemetry registry | 1.5 uker | serial (blokker) |
| **B2** | Stripe Connect backend: StripeDispatchAdapter, stripe-webhook Edge Function, PaymentIntent flow, dual-write handling | 2 uker | parallelt med B5 |
| **B3** | Stripe UI: "Betal nå"-knapp (workspace), payments-dashboard (platform), refund flow | 1.5 uker | parallelt med B4 |
| **B4** | PeppolEhfAdapter + XML-generering + schematron + Digdir test-sending | 2 uker | parallelt med B3 |
| **B5** | n8n dunning workflow + dunning templates + escalation rules + workspace opt-out | 1 uke | parallelt med B2 |
| **B6** | Fiken/Tripletex adapters (real implementation) + inbound payment poll | 1.5 uker | parallelt med B7 |
| **B7** | Workspace integration config UI + OAuth callback Edge Function | 1 uke | parallelt med B6 |
| **B8** | Spor F: DROP invoice.delivery_*, cleanup dual-write, migrate readers | 0.5 uker | sist (etter alle andre batcher merget) |

**Total:** ~9-10 uker med 2 agenter i parallell.

---

## 16. Risiko-register

| Risiko | Sannsynlighet | Impact | Mitigering |
|--------|---------------|--------|-----------|
| Stripe Connect onboarding delay (Stripe review tar 3-10 dager) | Høy | Medium — blokker B2 sluttfase | Søk Connect tidlig i Fase 3, parallell-utvikle mot Stripe testmode |
| Peppol-sertifisering tar lenger enn estimert | Høy | Høy — blokker B4 close | Søk tidlig; ha fallback plan for å shippe EHF som "coming soon" |
| PCI compliance — håndtere kortdata i payment_attempt.raw_event | Medium | Kritisk — PCI-brudd | Redact kortdata før skrive til DB; konsulter 1Password på hvor Stripe webhook payloads lagres |
| Fiken/Tripletex API rate-limit under poll | Lav | Medium | Exponential backoff + respect Retry-After headers; poll frekvens konfigurerbar |
| `invoice.delivery_*` DROP feiler fordi noen leser kolonnen | Medium | Høy | B1 grep-gate + CI-check; B8 gjør dry-run i staging først |
| n8n workflow timing — duplicate dunning-emails hvis cron kjører flere ganger | Lav | Medium | Idempotens-nøkkel per dunning-escalation (fra_stage + to_stage + invoice_id); tabell `dunning_escalation_log` hindrer duplikater |

---

## 17. Fase 4 forward compat

Fase 4 plukker opp:
- Multi-currency per invoice
- Prepayments / deposits / escrow
- Direct debit (AvtaleGiro)
- Advanced split/payout (marketplace)
- Reopen invoice after credit note
- Stripe Tax automation
- MVA-rapport automatisering

---

## 18. Åpne spørsmål (council agenda)

1. **Stripe Connect platform model** — Smartout eier Stripe-konto + viderebetaler workspace, eller workspace har egen Stripe Connect Account? (Avgjør compliance + payout-flow)
2. **Payment reconciliation** — multi-payment per invoice (partial payments lovlig?) eller 1:1?
3. **EHF sending transport** — egen Peppol AP via Tickstar-API eller bygge egen AP? (Tickstar anbefalt for MVP)
4. **Fiken/Tripletex inbound poll-frekvens** — hver time, hver 15. min, eller event-driven webhook (hvis de støtter det)?
5. **`peppol_participant_id` lookup** — manuell input i workspace-settings eller automatisk via Bedriftsregister-API?
6. **Dunning-eskaleringsregler — konfigurerbar per workspace?** Eller Smartout-sentral default?

---

**Neste steg:** Council-review → skriv 6 ADRs (accepted) → B1-B8 dispatch. Council agenda driven av §18 åpne spørsmål.
