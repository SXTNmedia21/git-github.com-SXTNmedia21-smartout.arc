---
title: "User Journeys — Billing Engine Fase 3A"
status: done
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [journey, billing, stripe, payments, dunning, fase-3a]
---

# User Journeys — Billing Engine Fase 3A

Fase 3A leverer: Stripe-betaling (workspace "Betal nå"), platform refund-flow, automatisk dunning-eskalering (engine_process), workspace opt-out av auto-dunning, og opprydding av `invoice.delivery_*` kolonner.

---

## Journey 1: Workspace-admin pays invoice via Stripe Checkout

**Precondition:** Workspace har aktiv Stripe-integrasjon (Smartout-owned per ADR-0131). Faktura har `status='issued'` eller `'sent'` eller `'overdue'`.

1. Workspace-admin navigerer til `/dashboard/billing/[invoice_id]`
2. Ser invoice-detalj + "Betal nå"-knapp (primær med glow halo, warning-halo hvis overdue)
3. Klikker "Betal nå"
4. System: kaller `initiatePaymentAction(invoice_id)` → opprettet `payment` rad (status='pending') + Stripe PaymentIntent + Stripe Checkout Session
5. UI: card morpher til trust-anchor interstitial "Sender deg til Stripe for sikker betaling..." (600ms)
6. System: `window.location.href = stripe_checkout_url`
7. Bruker på Stripe Checkout-side: fyller kortinfo, bekrefter
8. Stripe redirector tilbake til `/dashboard/billing/[invoice_id]?payment=success`
9. Stripe webhook treffer `payment_intent.succeeded`:
   - UPSERT `payment_attempt` (idempotent via stripe_event_id UNIQUE)
   - UPDATE `payment.status='succeeded'`, `paid_at=event.created`
   - Hvis sum(successful payments) >= invoice.amount_incl_vat: flipper `invoice.status → 'paid'` + `invoice.paid_at`
   - Emit `payment succeeded` event
10. UI viser post-payment-konfirmasjon: badge-transition issued→paid (spring animation), subtile amber halo pulse, toast "Takk! Betalingen er mottatt."
11. aria-live announcement for screen readers

**Postcondition:** Invoice status = 'paid', payment rad eksisterer med status='succeeded', audit-trail i billing_activity_log + payment_attempt.

**Error paths:**
- **User cancels på Stripe:** returneres til `?payment=cancelled` → gentle copy "Betaling avbrutt. Du kan prøve igjen når som helst."
- **Card declined:** Stripe webhook `payment_intent.payment_failed` → `payment.status='failed'` → emit `payment failed` alert → UI viser "Betaling feilet, prøv igjen" ved neste navigasjon
- **Webhook duplicate:** UNIQUE(stripe_event_id) hindrer dobbel-prosessering
- **Race mellom webhook og workspace manual mark-paid:** webhook har status-guard, flipper kun fra `issued/sent/overdue` til `paid` — aldri overwriter en allerede `paid` status

---

## Journey 2: Platform-admin refunds a payment

**Precondition:** Payment er `succeeded` eller `partially_refunded`. Platform-admin logget inn med godmode.

1. Platform-admin navigerer til `/platform-admin/billing/payments`
2. Ser liste over payments, filtrert på status/date/company
3. Klikker "Refunder" på en payment-rad
4. `RefundDialog` åpner — shadcn AlertDialog med Nordic Split "grave but not destructive" styling:
   - Heading: "Refunder betaling" (Instrument Serif italic)
   - Lucide RotateCcw ikon (rotation = reversal)
   - Amount-felt: numerisk input, defaulter til full payment amount
   - Reason-dropdown: `duplicate`, `fraudulent`, `requested_by_customer`, `other`
   - Advarsel-copy: "Du refunderer {amount} NOK til {company}. Dette er irreversibelt i Stripe etter 90 dager."
   - Confirm-knapp: `variant="outline"` + amber focus-ring (IKKE destructive red)
5. Klikker Confirm
6. System: kaller `refundPaymentAction` → `stripe.refunds.create({ payment_intent, amount, reason })`
7. Stripe svarer med refund-ID; UI viser success toast
8. (Senere, asynkront) Stripe webhook treffer `charge.refunded`:
   - UPSERT `payment_attempt`
   - Update `payment.refunded_amount`, `payment.status = 'refunded'` (full) eller `'partially_refunded'`
   - Per ADR-0133: auto-opprett credit-note:
     - Full: `invoice_type='credit_note'`, `credits_invoice_id=original`, line_items mirror med positive amounts
     - Partial: single line "Delvis refusjon — {stripe_refund_id}"
   - **Original invoice.status FORBLIR 'paid'** — credit-note balanserer regnskapsmessig
   - Emit `payment refunded` + `invoice credit_note_auto_created`
9. Platform-admin ser payment status-badge oppdatert ved neste navigasjon; credit-note vises i invoice-historikken

**Postcondition:** Payment refunded. Credit-note invoice eksisterer med `credits_invoice_id=original_invoice_id`. Invoice status = 'paid' (uendret).

**Error paths:**
- **Amount > available:** server validates `amount <= payment.amount - payment.refunded_amount`
- **Stripe API-feil:** action returnerer error, dialog holder seg åpen
- **Refund allerede prosessert:** UNIQUE(stripe_event_id) på webhook hindrer dobbel-credit-note

---

## Journey 3: Automatic dunning escalation (system-driven)

**Precondition:** Minst én faktura i systemet med `due_at < now() - 3 days`, `status='issued'` eller `'sent'` eller `'overdue'`, `dunning_status=null`.

1. pg_cron: daglig 08:00 Oslo → emitter `dunning_daily_tick` event
2. engine_trigger matcher → starter `dunning_escalation_scan` engine_process (allowed_channels=['autonomous'] per ADR-0078)
3. engine-dispatch kjører `scan_overdue_invoices` action_type handler:
   - For hver stage (3 dager/reminder_1, 7/reminder_2, 14/collection_notice):
     - Query invoices matching criteria
     - Per match: INSERT `dunning_escalation_log(invoice_id, from_stage, to_stage)` ON CONFLICT DO NOTHING (idempotens via UNIQUE)
     - Hvis INSERT lyktes: UPDATE `invoice.dunning_status = to_stage`
     - Opprett `invoice_dispatch` row via Fase 2 dispatch-mekanisme med dunning-template
     - Emit `invoice dunning_escalated` event (data.from_stage, data.to_stage, data.invoice_number)
4. Dispatch handler (Fase 2) sender email til kunde med rendered template (Mustache `{{invoice.number}}`, `{{company.name}}`, `{{days_overdue}}`)

**Postcondition:** `dunning_status` oppdatert, `dunning_escalation_log` rad skrevet, email sendt (med mindre workspace har suppress-regel — se Journey 4).

**Error paths:**
- **Cron kjører to ganger samme dag:** UNIQUE(invoice_id, to_stage) på `dunning_escalation_log` gjør INSERT no-op. Ingen dobbel-email.
- **Handler-exception under én stage:** partial-failure policy — loggføres i output, men scan fortsetter med neste stage.
- **Template mangler:** dispatch rapporterer error, invoice.dunning_status oppdatert men email går ikke ut.

---

## Journey 4: Workspace-admin opts out of auto-dunning

**Precondition:** Workspace-admin logget inn. Ingen eksisterende suppress-regel for dunning.

1. Workspace-admin navigerer til `/dashboard/billing/settings`
2. Ser "Automatiske påminnelser" seksjon med `Switch`:
   - Label: "Automatiske betalingspåminnelser"
   - Helper: "Send e-post til kunden når fakturaer er forfalt (3, 7, 14 dager)."
   - Sub-helper: "Smartout sender automatisk påminnelse." (når ON)
3. Klikker togglen → OFF
4. System: kaller `createDispatchRuleAction` med `{workspace_id=<current>, channel='email_customer', trigger_event='invoice dunning_escalated', action='suppress', is_enabled=true}`
5. UI: sub-helper oppdaterer til "Du må sende påminnelser manuelt."
6. Toast: "Innstillingen er lagret"
7. **Neste dunning-scan** (Journey 3): `scan_overdue_invoices` handler kaller `effective_dispatch_rules(invoice_id, 'invoice dunning_escalated')` → ADR-0127 suppress-rule matcher → email_customer dispatch suppressed
   - `invoice.dunning_status` oppdateres fortsatt (intern audit)
   - `dunning_escalation_log` skriver fortsatt
   - Event emittes med `data.suppressed=true`
   - Ingen email går ut

**Postcondition:** `billing_dispatch_rule` rad eksisterer med `action='suppress'`. Framtidige dunning-eskaleringer for denne workspace stopper ved dispatch-steget.

**Error paths:**
- **Toggle backoff:** hvis server action feiler, UI går tilbake til forrige state + toast-error
- **Workspace har allerede regel:** UI leser eksisterende state, `delete` i stedet for `create` når togglen går ON

---

## Journey 5: Platform-admin views per-invoice payment history

**Precondition:** Invoice har én eller flere `payment` rader.

1. Platform-admin navigerer til `/platform-admin/billing/invoices/[id]`
2. Ser invoice-detalj + ny seksjon "Betalinger" (under "Linjer", før "Utsendelser")
3. Hvis 1 payment (vanlig case): flat summary-rad med PaymentStatusBadge + amount + paid_at
4. Hvis flere payments eller failed attempts: accordion-in-list mønster — hver rad expandable
5. Expanded rad viser:
   - Alle `payment_attempt` rader for denne payment (sortert chronologisk)
   - Hver attempt: PaymentStatusBadge + timestamp + external_id (Geist Mono) + error_code hvis failed
   - Framer Motion layout animation for expand/collapse (spring 40/24)

**Postcondition:** Platform-admin har full payment-lifecycle-sporing for feilsøking.

**Error paths:**
- **Payment uten attempts (gammel data):** viser kun payment-raden, ingen attempt-liste
- **Platform-admin-only access:** RLS på `payment_attempt` blokkerer non-platform-admin (ADR-0132)

---

## Journey 6: Workspace-admin reads own invoice's payments (limited visibility)

**Precondition:** Workspace-admin har `paid` invoice i workspaces company.

1. Workspace-admin navigerer til `/dashboard/billing/[invoice_id]`
2. Ser invoice-detalj + "Betalinger"-seksjon (read-only)
3. Viser payment-rader: amount, status badge, paid_at
4. **IKKE synlig:** `payment_attempt` rå-data, external_id, error_details
5. RLS (fra B1) tillater kun SELECT på egne company's payments (via invoice→company→workspace join)

**Postcondition:** Workspace-admin får bekreftet at fakturaen er betalt + når, uten PII-lekk.

**Error paths:**
- **Tries to access other workspace's invoice:** 404 via RLS (row invisible)
- **No payments yet:** empty-state "Ingen betalinger registrert"

---

## Journey 7: Platform-admin generates ad-hoc onboarding fee invoice, workspace pays via Stripe

**Precondition:** Ny workspace opprettet manuelt (ADR-0130 Fase 2.5 ikke enda implementert). Platform-admin skal sende oppstartsgebyr.

1. Platform-admin navigerer til `/platform-admin/billing/invoices`
2. Klikker "Lag ad-hoc faktura" (Fase 2 B5 Sheet drawer)
3. Fyller inn: company, periode, linje "Oppstartsgebyr 2 500 NOK"
4. Submit → faktura opprettet med `invoice_type='one_off'`, `status='draft'`
5. Platform-admin publiserer (eksisterende issue-knapp) → `status='issued'`
6. Fase 2 dispatch-engine opprettet `invoice_dispatch` på `email_customer` kanal (effective_dispatch_rules)
7. Kunde mottar email med faktura + "Betal nå"-lenke
8. Kunde klikker lenke → Stripe Checkout (Journey 1)
9. Betaling kommer inn → invoice flipper til `paid`

**Postcondition:** Onboarding-faktura betalt via Stripe. Automatisk når Fase 2.5 kommer med auto-provisioning.

---

## Journey 8: Post-`invoice.delivery_*` DROP — legacy readers already migrated

**Precondition:** Fase 3A B6 migrasjon kjørt. `invoice.delivery_channel | delivery_status | external_reference` ikke lenger eksisterer.

1. `billing_query` AI tool (workspace-admin) spør "Er fakturaen sendt?"
2. LLM kaller `list_invoice_dispatches(invoice_id)` — leser fra `invoice_dispatch` (NY kilde)
3. Returnerer per-kanal-status (email_customer=delivered, peppol_ehf=pending, etc.)
4. LLM svarer naturlig: "Ja, fakturaen ble levert via email den 5. april."

**Postcondition:** AI-capability fortsetter å fungere. Gamle `invoice.delivery_*` kolonner er ikke lenger referert noe sted i app-koden (grep-gate asserterer dette i CI).

**Error paths:**
- **AI tool-description refererer droppet kolonne (caught by B6 grep-gate):** blokkert ved migration-tid, kan ikke skje ved runtime.

---

**Relatert:** `docs/HANDOFF-billing-engine-fase-3a.md` for decisions + learnings + next steps.
