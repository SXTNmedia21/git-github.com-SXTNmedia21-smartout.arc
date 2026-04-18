---
title: "Billing Engine Fase 3A — Stripe Payments + Dunning + delivery_* Drop (Spec rev 2)"
status: draft
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [billing, invoice, faktura, stripe, stripe-connect, dunning, platform-admin, cascade-c3]
depends_on:
  - docs/superpowers/specs/2026-04-17-billing-engine-fase-2-design.md
related:
  - docs/superpowers/specs/2026-XX-XX-billing-engine-fase-3b-design.md
  - docs/superpowers/specs/2026-XX-XX-billing-contract-onboarding-design.md
---

# Billing Engine Fase 3A — Stripe Payments + Dunning + delivery_* Drop

> **Status:** Draft spec rev 2. Council-reviewed 2026-04-17 (APPROVE WITH CHANGES: split into 3A/3B, 5 blocker ADRs).
> **Authors:** Pontus Lindroth + Claude Opus 4.7 + System Council.
> **Bygger på:** Fase 2 (ceef4a9e+ på `feat/billing-engine-fase-2`). Fase 2 er pushet; må merges til development før Fase 3A B1 starter.

> **Rev 2-endringer fra rev 1:** (1) Split i 3A/3B — 3A = Spor A + C + F, 3B = EHF + bidirectional sync + workspace OAuth. (2) n8n for dunning → erstattet av `engine_process` (ADR-0126 compliance). (3) `peppol_ap` enum-addition fjernet (galt ontologisk). (4) `integration_poll_payments` utsatt til 3B. (5) Stripe Connect-model → dedikert ADR pre-B1. (6) PII redaction for `payment_attempt.raw_event` → dedikert ADR pre-B1. (7) ADR-0120 refund-flow → dedikert ADR pre-B1. (8) CTA-hierarchy matrix i §5.1. (9) PaymentStatusBadge som ny sibling.

---

## 1. Kjerneprinsipp

Fase 3A bygger **betaling + automatisk påminnelse + opprydding**. Tre spor:

- **Spor A — Stripe Connect payments:** Stripe Checkout flow + webhook → auto mark-paid. Ny `payment` + `payment_attempt` tabeller. `StripeDispatchAdapter` som ny dispatch-adapter.
- **Spor C — Automatisert dunning via engine_process:** *IKKE n8n* (rev 2). Ny `engine_process` `dunning_escalation_scan` kjørt via `engine_delayed_trigger` + eksisterende `fire-delayed-triggers` Edge Function. Genererer `invoice_dispatch` rows med dunning-template basert på `days_overdue`.
- **Spor F — `invoice.delivery_*` DROP COLUMN:** Per ADR-0128, hard drop før 2026-07-01 eller Fase 3A-close. Dual-write fjernes. Alle readere verifisert migrert.

**Arkitektonisk plassering:** C3 Commercial utvidelser. Ingen nye cascade-dimensjoner. Gjenbruker Fase 2's engine_process-orkestrering + dispatch-adapter-pattern + `billing_activity_log` audit.

**Ikke i Fase 3A:** EHF/Peppol (Fase 3B), Fiken/Tripletex ekte adapters (Fase 3B), workspace-admin integration OAuth (Fase 3B), contract onboarding (Fase 2.5).

---

## 2. Scope

### In scope (Fase 3A)

**Spor A — Stripe Connect payments:**
1. `payment` + `payment_attempt` tabeller (per ADR-0131 Stripe Connect model)
2. Stripe Connect onboarding — **Smartout-owned model** per ADR-0131 (Smartout er merchant-of-record, workspaces får ikke egne Stripe-kontoer i 3A)
3. `StripeDispatchAdapter` — ny `DispatchAdapter`-implementasjon (channel `stripe_invoice`)
4. `stripe-webhook` Edge Function — verifiserer signature, håndterer `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`. Idempotent via `payment_attempt.stripe_event_id` UNIQUE.
5. Auto mark-paid via webhook: `payment_intent.succeeded` → `payment.status='succeeded'` → hvis sum(payment.amount) >= invoice.amount_incl_vat, set `invoice.status='paid'` (guard: kun hvis invoice.status IN ('issued','sent','overdue'))
6. Auto credit-note via webhook: `charge.refunded` full → opprett credit-note (per ADR-0142). Partial refund → credit-note på refunded amount, invoice.status forblir 'paid'.
7. "Betal nå"-knapp (workspace) + Stripe Checkout redirect med trust-anchor interstitial
8. Platform-admin payments-dashboard + refund-flyt

**Spor C — Automatisk dunning (engine_process, IKKE n8n):**
1. Ny `engine_process` `dunning_escalation_scan` — trigger_events `['dunning_daily_tick']`, allowed_channels `['autonomous']`
2. Steg: scan `invoice WHERE status IN ('issued','sent','overdue') AND due_at < now()`, per invoice beregn `days_overdue`, match eskaleringsregel, oppdater `dunning_status`, opprett `invoice_dispatch` med dunning-template
3. Eskaleringsmatrise:
   - +3 dager + `dunning_status NULL` → `reminder_1` (vennlig påminnelse, nb-NO)
   - +7 dager + `dunning_status = 'reminder_1'` → `reminder_2` (formell)
   - +14 dager + `dunning_status = 'reminder_2'` → `collection_notice` (siste varsel før inkasso)
4. pg_cron eller `engine_delayed_trigger` schedulerer daglig 08:00 Oslo
5. Idempotens: ny tabell `dunning_escalation_log(invoice_id, from_stage, to_stage, escalated_at)` UNIQUE på (invoice_id, to_stage)
6. Workspace opt-out: eksisterende `billing_dispatch_rule` med `action='suppress'` + `trigger_event='invoice dunning_escalated'` (Fase 2 mekanisme)
7. 3 dunning-template rows seeded (nb-NO) — engelsk copy i 3B

**Spor F — `invoice.delivery_*` DROP (siste batch):**
1. Grep-gate: `apps/`, `packages/`, `supabase/functions/` må returnere 0 treff for `delivery_channel | delivery_status | external_reference` i app-kode + string literals (inkl. AI tool descriptions)
2. Migration DROP COLUMN
3. Fjern dual-write kode fra B2's `dispatch_invoice` handler (Fase 2)
4. Regenerer `database.types.ts`
5. CI gate: type compile check

### Out of scope (Fase 3B)

| Element | Hvorfor utsatt |
|---------|---------------|
| EHF/Peppol XML implementasjon | Digdir-sertifisering 3 uker; blokker for 3A-revenue |
| Fiken/Tripletex real adapters | Bidirectional sync + OAuth + per-vendor-API = mye overflate |
| Workspace integration OAuth | Krever Fase 2.5 onboarding pre-req + per-workspace credential model |
| `peppol_participant_id` + `ehf_enabled` på company | Hører til Fase 3B med EHF |
| `integration_poll_payments` engine_process | Inbound payment-sync = Fase 3B scope |

### Out of scope (Fase 4+)

| Element | Hvorfor utsatt |
|---------|---------------|
| Multi-currency utover NOK/EUR | Markedet er nordisk |
| Deposits / prepayments | Ikke etterspurt |
| Stripe Tax automation | Bruker Smartouts MVA-logikk |
| Apple/Google Pay eksplisitt konfig | Stripe Checkout støtter automatisk |
| Direct debit (AvtaleGiro) | Separat fase |
| AI-tools for payments (list_my_payments) | Defer til Fase 4 når mønster stabiliserer |

---

## 3. Spor A — Stripe Payments

### 3.1 Stripe Connect platform model (ADR-0131)

**Valgt:** Smartout-owned Stripe account. Smartout er merchant-of-record. Workspaces får IKKE egne Stripe Connect Accounts i 3A.

**Konsekvens:**
- `payment.company_id` = Smartout platform company (ikke workspace's company)
- Penger lander i Smartouts bank → Smartout viderefakturerer til workspaces internt (egen intern payout-flyt, IKKE i 3A scope)
- Ingen KYC/PSD2-kompleksitet for workspaces
- Enklere FK-modell: `invoice.company_id` er customer, `payment.invoice_id` er påstand, ingen workspace-payout-tabell trengs
- `billing_integration.integration_type='stripe'` forblir platform-level (workspace_id NULL) i Fase 3A

**Revurderes** i Fase 3B+ når workspaces etterspør direkte payouts.

### 3.2 Datamodell

**Ny tabell: `payment`**

| Felt | Type | Note |
|------|------|------|
| `payment_id` | uuid PK | |
| `invoice_id` | uuid FK NOT NULL | |
| `company_id` | uuid FK NOT NULL | Snapshot fra invoice ved oppretting |
| `payment_method` | `payment_method_type` enum | `stripe_card`, `stripe_bank`, `bank_transfer`, `manual_adjustment` |
| `amount` | decimal(12,2) NOT NULL | |
| `currency` | `currency` enum NOT NULL | |
| `status` | `payment_status` enum | `pending`, `processing`, `succeeded`, `failed`, `refunded`, `partially_refunded` |
| `external_id` | text | Stripe payment_intent_id |
| `paid_at` | timestamptz NULL | |
| `refunded_amount` | decimal(12,2) NULL | Aggregert refund for denne payment |
| `created_at`, `updated_at` | timestamptz + trigger | |

**Ny tabell: `payment_attempt`**

Logger hver Stripe-event for audit (per ADR-0141 PII-redaction):

| Felt | Type | Note |
|------|------|------|
| `payment_attempt_id` | uuid PK | |
| `payment_id` | uuid FK | |
| `attempt_number` | int NOT NULL | |
| `stripe_event_id` | text UNIQUE NOT NULL | Idempotens-nøkkel |
| `status` | text | Stripe event-navn e.g. `payment_intent.succeeded` |
| `redacted_payload` | jsonb | Kun PCI-safe subset per ADR-0141 (event.id, amount, currency, status, last_payment_error.code, outcome.network_status). IKKE billing_details, customer, source, receipt_url |
| `error_code` | text NULL | |
| `error_message` | text NULL | |
| `created_at` | timestamptz | |

**Retention:** `payment_attempt` rader beholdes permanent (audit-trail). `redacted_payload` feltet er allerede PII-fjernet; ingen ekstra retention-policy trengs.

**Ny tabell: `dunning_escalation_log`**

| Felt | Type | Note |
|------|------|------|
| `log_id` | bigserial PK | |
| `invoice_id` | uuid FK | |
| `from_stage` | text NULL | NULL = initial escalation |
| `to_stage` | text NOT NULL | `reminder_1` | `reminder_2` | `collection_notice` |
| `escalated_at` | timestamptz | |
| UNIQUE | `(invoice_id, to_stage)` | Idempotens |

**Utvidelser:**
- `billing_dispatch_channel` enum + `'stripe_invoice'`
- `payment_method_type` enum (ny): `stripe_card | stripe_bank | bank_transfer | manual_adjustment`
- `payment_status` enum (ny): `pending | processing | succeeded | failed | refunded | partially_refunded`

### 3.3 StripeDispatchAdapter

Ny adapter `packages/billing/src/dispatch/adapters/stripe.ts` (implementerer `DispatchAdapter`-interface fra Fase 2):

```ts
export const StripeDispatchAdapter: DispatchAdapter = {
  channel: 'stripe_invoice',
  async send({ invoice, target, template }) {
    // 1. Opprett Stripe PaymentIntent via Stripe SDK
    // 2. Opprett Stripe Checkout Session → Checkout URL
    // 3. INSERT payment row (status='pending')
    // 4. Return { status: 'in_flight', external_reference: payment_intent_id, check_back_at: +24h }
    //    Webhook flipper til 'delivered' senere
  },
};
```

**Stripe SDK:** `stripe` npm package (Node). Edge Function bruker `stripe` via Deno compat eller fetch direkte.

### 3.4 stripe-webhook Edge Function

`supabase/functions/stripe-webhook/index.ts`:

- `verify_jwt = false` + manuell Stripe signature verifikasjon
- Events håndtert: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
- Idempotens: UPSERT på `payment_attempt.stripe_event_id`
- Event-ordering: sortér etter `event.created` timestamp, latest-wins for status

**Flow per event:**

1. **`payment_intent.succeeded`:**
   - Opprett `payment_attempt` (ON CONFLICT DO NOTHING)
   - Oppdater `payment.status = 'succeeded'`, `payment.paid_at = event.created`
   - Hvis sum(successful payments) >= invoice.amount_incl_vat AND invoice.status IN ('issued','sent','overdue') → set invoice.status='paid', invoice.paid_at=now. **Guard:** ikke overwrite hvis allerede 'paid' (workspace-admin kan ha markert manuelt).
   - Emit `payment succeeded`

2. **`payment_intent.payment_failed`:**
   - payment.status = 'failed'
   - Emit `payment failed` + alert

3. **`charge.refunded`:**
   - Opprett `payment_attempt` (idempotent)
   - Update payment.refunded_amount + status
   - **Per ADR-0142:** hvis refund.amount == payment.amount (full) → auto-opprett credit-note med `invoice_type='credit_note'`, `credits_invoice_id=original_invoice_id`, én linje = refunded amount. Invoice.status forblir 'paid' (credit-note balanserer).
   - **Partial refund:** opprett credit-note med samme line-items delvis. payment.status = 'partially_refunded'.
   - Emit `payment refunded` + `invoice credit_note_created`

**Emit bridge:** gjenbruk `/api/internal/emit` fra Fase 1/2.

### 3.5 UI — CTA hierarchy matrix

Per Frontend-council R1:

| Invoice state | Workspace-admin ser | Platform-admin ser |
|---------------|---------------------|---------------------|
| `draft` | — | "Utsted faktura" (primary) |
| `issued` + Stripe aktiv | **"Betal nå"** (primary, glow halo) | "Marker som betalt" (ghost variant) |
| `issued` + ingen Stripe | "Bankoverføring info" (secondary) | **"Marker som betalt"** (primary) |
| `paid` | Kvittering-nedlasting (tertiary link) | Kvittering + "Start refusjon" (ghost) |
| `overdue` | **"Betal nå"** (primary, warning halo) | "Send purring" + "Marker som betalt" (begge ghost) |

Visual weight via variant, ikke farge. Nordic Split: varselbusser har `border-destructive/20`, ikke `bg-destructive`.

**Ny komponent `PaymentStatusBadge.tsx`** (sibling til `InvoiceStatusBadge` + `DispatchStatusBadge`):
- States: pending, processing, succeeded, failed, refunded, partially_refunded
- Motion: `processing` har pulse-dot (spring stiffness 35, damping 22, mass 2.2)
- `role="status"` + `aria-live="polite"` (WCAG 4.1.3 for financial UI)

**Stripe Checkout redirect interstitial** (600ms):
- Card morpher (layoutId) til "Sender deg til Stripe for sikker betaling..."
- Lock-ikon (Lucide), noise-overlay progress bar
- Etter 600ms: `window.location.href = checkout_url`

### 3.6 Platform-admin payments dashboard

`/platform-admin/billing/payments`:
- Liste med filter (status, dato, company)
- Per row: refund-knapp → `RefundDialog` (Frontend R3: "grave but not destructive" — RotateCcw-ikon, `variant="outline"` med focus-ring amber, tydelig "irreversibelt etter 90 dager" copy)
- Payment history per-invoice på eksisterende detail-side: accordion-in-list, 1 attempt = flat row, flere attempts = expandable

---

## 4. Spor C — Automatisk Dunning (engine_process)

### 4.1 Hvorfor IKKE n8n (rev 2-endring)

Council Agent Coordinator + Steward + Supervisor konvergerte:
- Smartout har allerede `engine_process` + `engine_delayed_trigger` + `fire-delayed-triggers` (universell workflow-runtime)
- n8n = parallell motor, brudd på CLAUDE.md "no second event system"
- Idempotens + RLS + telemetry + CI coverage mye renere i monorepo
- n8n beholdes for andre bruksområder; billing-logikken bor her

### 4.2 engine_process blueprint

Seed i B1-migrasjon:

```
engine_process:
  - name: 'dunning_escalation_scan'
  - allowed_channels: ['autonomous']
  - trigger_events: ['dunning_daily_tick']
  - steps:
    1. action_type: 'scan_overdue_invoices'
       action_payload: { stages: [{ days: 3, from: null, to: 'reminder_1' }, ...] }
       on_failure: retry max 3, backoff 5m
```

**Trigger source:** `pg_cron` scheduler jobs `smartout-dunning-daily-08:00` emit `dunning_daily_tick` event. Dette matcher engine_trigger, spawner engine_state.

**Ny action_type handler** i `engine-dispatch/index.ts`: `scan_overdue_invoices`:
- Leser eskaleringsmatrise fra action_payload
- For hver regel: SELECT invoices matchende `days_overdue >= rule.days AND dunning_status = rule.from`
- Per invoice:
  - INSERT `dunning_escalation_log (invoice_id, from_stage, to_stage)` ON CONFLICT DO NOTHING (idempotens)
  - Hvis INSERT lyktes (ingen konflikt): UPDATE `invoice.dunning_status = to_stage`
  - Opprett `invoice_dispatch` row med channel `email_customer`, template = `dunning_<to_stage>`
  - Emit `invoice dunning_escalated` event (data.from_stage, data.to_stage, data.invoice_id)
- Return step_status based on success

### 4.3 Dunning templates

Seed som `billing_dispatch_template` rows:

| Template name | Locale | Subject | Body tone |
|---------------|--------|---------|-----------|
| `dunning_reminder_1` | nb-NO | "Påminnelse: Faktura {invoice_number}" | Vennlig |
| `dunning_reminder_2` | nb-NO | "Forfalt: Faktura {invoice_number}" | Formell |
| `dunning_collection_notice` | nb-NO | "Siste purring før inkasso — {invoice_number}" | Alvorlig |

English versjoner seeded i Fase 3B (Frontend R10 flagger tone-critical copy — må forfattes av designer i 3B).

### 4.4 Workspace opt-out

Workspace-admin oppretter `billing_dispatch_rule`:
- `workspace_id = <their_workspace>`
- `channel = 'email_customer'`
- `trigger_event = 'invoice dunning_escalated'`
- `action = 'suppress'`
- `is_enabled = true`

Evaluert via Fase 2's `effective_dispatch_rules()` (ADR-0127): suppress-regelen matcher dunning-events og disabler dispatch. engine_process fortsetter å oppdatere `dunning_status` (interne audit), men ingen email går ut.

### 4.5 UI — workspace opt-out placement

Per Frontend R8: `/dashboard/billing/settings` → ny seksjon "Automatiske påminnelser":
- Toggle: "Send e-post når fakturaer blir forfalt (3, 7, 14 dager)"
- Når av: hjelpetekst "Du må sende påminnelser manuelt."
- Mekanikk: toggle ON = ingen suppress-regel, toggle OFF = opprett/slett suppress-regel

---

## 5. Spor F — `invoice.delivery_*` DROP

### 5.1 Pre-flight grep-gate

**I B1 (foran B8):** CI-script som grep-er alle `.ts`, `.tsx`, `.sql`, `.md` for `delivery_channel | delivery_status | external_reference` i:
- `apps/web/src/**`
- `packages/**/src/**`
- `supabase/functions/**`
- `packages/ai/src/capabilities/billing-query/tools.ts` — **spesielt viktig:** Fase 2's `list_invoice_dispatches` tool-beskrivelse inneholder string "sjekk `invoice.delivery_status` for historikk" (Agent Coord finding). Må oppdateres før B8.

Hvis > 0 treff: B8 blokkert. Treff migreres til `invoice_dispatch`-spørringer.

### 5.2 DROP migration

Migration `YYYYMMDDHHMMSS_drop_invoice_delivery_columns.sql`:

```sql
ALTER TABLE public.invoice
  DROP COLUMN delivery_channel,
  DROP COLUMN delivery_status,
  DROP COLUMN external_reference;

-- Drop tilhørende CHECK constraint hvis eksisterer
ALTER TABLE public.invoice DROP CONSTRAINT IF EXISTS invoice_delivery_channel_check;
```

### 5.3 Dual-write fjerning

`supabase/functions/engine-dispatch/index.ts` — Fase 2 B2's `dispatch_invoice` handler dual-skriver linjer 2532-2541. Fjern dem.

### 5.4 Regenerer typer + CI gate

- `pnpm --filter @smartout/supabase run db:types` regenererer `database.types.ts`
- `pnpm turbo typecheck` må fortsatt være grønn
- Hvis noen ikke-fangede `select("*")`-kallere fortsatt ser de slettede kolonnene, blir type-inference korrekt uten dem; runtime-kall feiler kun hvis kode eksplisitt casts til forventet shape

### 5.5 Deadline

ADR-0128 spesifiserer 2026-07-01 eller Fase 3-close. **Fase 3A-close er hard deadline for B8.** Hvis Fase 3A slipper etter 2026-07-01 → separat hotfix migration.

---

## 6. Datamodell-oppsummering (Fase 3A)

| Tabell/endring | Type | Timestamp-start |
|---------------|------|-----------------|
| `payment` | NY | 20260512000000 |
| `payment_attempt` | NY | 20260512000001 |
| `dunning_escalation_log` | NY | 20260512000002 |
| `payment_method_type` enum | NY | 20260512000003 |
| `payment_status` enum | NY | 20260512000004 |
| `billing_dispatch_channel` enum | + `'stripe_invoice'` | 20260512000005 |
| `engine_process` + `engine_trigger` | Seed `dunning_escalation_scan` | 20260512000006 |
| `billing_dispatch_template` | Seed 3 dunning-templates (nb-NO) | 20260512000007 |
| `dispatch_invoice` handler dual-write | Fjernes i B8 | 20260512000099 (sist) |
| `invoice.delivery_*` kolonner | DROP (B8) | 20260512000100 |

**Estimat:** 9-10 migrasjoner totalt.

---

## 7. RLS-matrise

| Tabell | Platform-admin | Workspace-admin | Anon/employee |
|--------|---------------|-----------------|---------------|
| `payment` | ALL | SELECT for egen workspace sine invoices (join via invoice → company → `get_workspace_ids_for_user()`) | — |
| `payment_attempt` | SELECT (via `is_platform_admin()`) | **Ingen tilgang** (PII i redacted_payload — platform-only) | — |
| `dunning_escalation_log` | ALL | SELECT for egen workspace sine invoices | — |

**Helpers:** `get_workspace_ids_for_user(auth.uid())`, `is_admin_in_workspace(auth.uid(), workspace_id)`, `is_platform_admin()`. Pattern-navn følger Fase 2 konvensjon.

**Audit** (per ADR-0141): alle SELECT mot `payment_attempt` logges via `billing_activity_log` (platform_admin_pii_read event).

---

## 8. Mobile parity (per Frontend R9)

| Surface | Desktop | Mobile | Begrunnelse |
|---------|---------|--------|-------------|
| Platform-admin payments-liste | ✅ | ❌ | Admin-verktøy |
| Platform-admin refund-dialog | ✅ | ❌ | Admin-verktøy |
| **Workspace "Betal nå"-knapp** | ✅ | ✅ **kritisk** | Kunder betaler fra mobil |
| Stripe Checkout redirect | ✅ | ✅ | Stripe er mobilvennlig native |
| Return-side etter betaling | ✅ | ✅ | 360px-kompatibel |
| Workspace dunning opt-out toggle | ✅ | ✅ | Fast workspace-settings-fane |

**Pure functions i `packages/billing/src/actions/payments/`:**
- `initiatePayment(client, invoice_id): Promise<{ checkout_url, client_secret, payment_id }>` — mobile + web
- `getPaymentStatus(client, payment_id): Promise<PaymentWithAttempts>`
- `refundPayment(client, payment_id, amount?, reason?): Promise<RefundResult>` (platform-admin)

Web Server Actions = tynne wrappers.

---

## 9. i18n

Nye strings i `packages/i18n/locales/{nb,en}/billing.json`:
- `payments` namespace (~20 keys: betal_nå, marker_betalt, prosesserer, feilet, refunder, ...)
- `dunning` namespace (~15 keys: opt-out toggle, email templates, escalation stages)
- `refund` namespace (~10 keys: dialog copy, reason dropdown, confirmation)

Engelsk templates for dunning-emails seedes i Fase 3B (tone-kritisk, krever designer).

---

## 10. ADRs som MÅ skrives FØR B1 (5 stk)

| ADR | Tittel | Påvirkning |
|-----|--------|------------|
| **ADR-0131** | Stripe Connect platform model — Smartout-owned | Låser `payment.company_id` semantikk + at workspaces ikke får Stripe Connect Accounts i 3A |
| **ADR-0141** | payment_attempt PII redaction + retention | Definerer redacted_payload-subset + retention-policy |
| **ADR-0142** | Invoice refund flow + ADR-0120 amendment | Full refund → auto credit-note. Partial refund → credit-note linje. invoice.status forblir 'paid'. |
| **ADR-0143** | Dunning via engine_process (no n8n) | Låser engine_process som orkestreringspunkt + idempotens via dunning_escalation_log |
| **ADR-0144** | `invoice.delivery_*` DROP lifecycle (amendment av ADR-0128) | Spesifiserer grep-gate + Fase 3A-close deadline |

Numrene 0131-0135 er reservert. Verifiser mot `0000-decision-log.md` ved writing-tid.

---

## 11. Telemetry (Fase 3A events)

Nye events i `packages/telemetry/src/registry.ts`, alle mellomrom-separert:

| Event | Trigger | Destinations |
|-------|---------|--------------|
| `payment initiated` | Stripe Checkout session opprettet | posthog, logger, billing_activity_log |
| `payment succeeded` | Stripe webhook payment_intent.succeeded | posthog, logger, billing_activity_log, engine_event |
| `payment failed` | Stripe webhook payment_intent.payment_failed | posthog, logger, billing_activity_log, *alert* |
| `payment refunded` | Stripe webhook charge.refunded | posthog, logger, billing_activity_log |
| `invoice dunning_escalated` | dunning_escalation_scan | posthog, logger, billing_activity_log, engine_event |
| `invoice credit_note_auto_created` | ADR-0142 refund flow | posthog, logger, billing_activity_log, engine_event |
| `platform_admin_pii_read` | SELECT `payment_attempt` (trigger-basert audit) | logger, billing_activity_log |

---

## 12. Tests per batch

| Batch | Tester |
|-------|--------|
| B1 | pgTAP: RLS per ny tabell, CHECK constraints, UNIQUE idempotens (dunning_escalation_log), allowed_channels non-empty |
| B2 | vitest: StripeDispatchAdapter contract (mock Stripe SDK), idempotens (dobbel invoke = én payment), Stripe webhook signature verifikasjon, credit-note auto-creation on refund |
| B3 | Playwright: workspace "Betal nå" flow (happy path + timeout), platform refund flow |
| B4 | vitest: scan_overdue_invoices handler (alle 3 stages + idempotens via UNIQUE), dunning-template rendering |
| B5 | Playwright: workspace opt-out toggle, dunning email blocked via suppress |
| B6 | Grep-gate runs zero delivery_* hits, type-check green after DROP |

---

## 13. Batching (B1-B6, rev 2)

| Batch | Scope | Estimert |
|-------|-------|----------|
| **B0** | Refaktor: innfør `withPlatformAdmin()` + `withWorkspaceAdmin()` wrappers i `packages/billing/src/actions/`. Migrer eksisterende Fase 2 actions. | 0.5 uker |
| **B1** | 5 ADRs + migrasjoner (9-10 stk) + RLS + engine_process seeds + telemetry registry + pgTAP gates | 1.5 uker |
| **B2** | Stripe backend: `StripeDispatchAdapter`, `stripe-webhook` Edge Function, payments pure functions, Server Actions | 2 uker |
| **B3** | Stripe UI: "Betal nå" (workspace, mobile-first), payments dashboard (platform), `PaymentStatusBadge`, refund dialog, trust-anchor interstitial | 1.5 uker |
| **B4** | Dunning engine_process handler: `scan_overdue_invoices` action_type, `dunning_escalation_log` idempotens, template seeds | 1 uke |
| **B5** | Dunning UI: workspace opt-out toggle i `/dashboard/billing/settings`, pg_cron schedule | 0.5 uker |
| **B6** | Spor F: grep-gate + DROP migration + dual-write fjerning + type regen | 0.5 uker |

**Total:** 7.5 uker med 1 agent. Parallellisering: B2+B4 kan kjøres parallelt (forskjellige filer), B3+B5 likeså. Med 2 agenter: ~5 uker.

---

## 14. Risiko-register

| Risiko | Sannsynlighet | Impact | Mitigering |
|--------|---------------|--------|-----------|
| Stripe Connect onboarding review 3-10 dager | Høy | Medium | Søk Connect NÅ (pre-B1); parallell-bygg mot Stripe testmode |
| PCI compliance — `payment_attempt.raw_event` lekker PII | Medium | Kritisk | ADR-0141 enumerer explicit allowed-fields; B1 pgTAP-test asserter at `redacted_payload` ikke inneholder forbudte nøkler |
| ADR-0128 deadline slip (2026-07-01) | Medium | Høy | B6 gjør grep-gate allerede i B1 som monitor; Spor F = siste batch men prioriteres |
| Stripe webhook duplicate processing | Lav | Medium | UNIQUE på `payment_attempt.stripe_event_id` |
| Workspace markerer betalt samtidig som Stripe webhook | Lav | Medium | Status-guard i webhook handler (kun flip hvis `status IN ('issued','sent','overdue')`) |
| Dunning-email sendes to ganger samme dag | Lav | Medium | UNIQUE `(invoice_id, to_stage)` på dunning_escalation_log |
| `billing_query` AI tool description refererer droppet kolonne | Medium | Lav | B1 grep-gate inkluderer `.ts` string literals; Agent Coord fanget dette |
| Refund trigger ADR-0120 immutability-konflikt | Lav | Kritisk | ADR-0142 spesifiserer credit-note-flow eksplisitt |

---

## 15. Fase 3B forward compat

Fase 3B plukker opp:
- **EHF/Peppol** XML + Digdir-sertifisering + Tickstar access point
- **Fiken/Tripletex real adapters** (erstatter Placeholder)
- **Bidirectional integration sync** — nytt `engine_process` `integration_poll_payments` + `poll_integration_payments` action_type
- **Workspace-admin integration config UI** + OAuth callback Edge Function (`integration-oauth-callback`)
- **`peppol_participant_id` + `ehf_enabled`** på company
- **Engelsk copy for dunning-templates**

**Fase 4+:**
- Multi-currency utover NOK/EUR, prepayments, direct debit
- AI-tools for payments (`list_my_payments` etc.)
- Stripe Tax

---

## 16. Spec coverage self-check

| Council-blocker | Dekket av |
|-----------------|-----------|
| Split i 3A/3B | §1, §2 out-of-scope til 3B |
| Stripe Connect model bestemt pre-B1 | §3.1 + ADR-0131 |
| PII redaction for payment_attempt | §3.2 + ADR-0141 |
| ADR-0120 refund flow eksplisitt | §3.4 + ADR-0142 |
| n8n erstattet av engine_process | §4 + ADR-0143 |
| `peppol_ap` enum fjernet | Ikke i §6 datamodell |
| `integration_poll_payments` utsatt til 3B | §15 |
| `list_invoice_dispatches` tool-description fix i grep-gate | §5.1 |
| CTA hierarchy matrix | §3.5 |
| PaymentStatusBadge som sibling | §3.5 |
| RLS bruker `get_workspace_ids_for_user()` (ikke ikke-eksisterende `company_member.workspace_id`) | §7 |
| Mobile parity explicit | §8 |
| Migration timestamps fra 20260512000000 | §6 |
| `withPlatformAdmin()` refaktor | §13 B0 |
| Grep-gate inkluderer string literals | §5.1 |

---

**Neste steg:** Skriv 5 ADRs (0131-0135) → flipp accepted → commit → dispatch B0+B1 (serial).
