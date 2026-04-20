---
title: "payment_attempt PII Redaction + Retention Policy"
id: ADR-0141
status: accepted
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-18
---

# ADR-0141: payment_attempt PII Redaction + Retention Policy

## Context and Problem Statement

Billing Fase 3A legger til `payment_attempt`-tabell som logger Stripe webhook-events for audit. Stripe webhooks inneholder PII (billing_details med navn + adresse, customer.email, receipt_url med kunde-IDer). ADR-0077 krever at PII i `engine_memory` er redaktert og har retention. `payment_attempt` må følge tilsvarende disiplin — lagring av raw Stripe payloads ville være en PCI-adjacent PII-lekk.

## Decision Drivers

- **PCI-DSS compliance:** Stripe sender aldri PAN (primary account number) eller CVC i webhooks, men sender `card.last4`, `card.brand`, `card.country`. Disse er non-sensitive under PCI, men PII under GDPR.
- **GDPR compliance:** Art 6(1)(b) kontraktsbehandling tillater opplagring av minimum nødvendig. Raw webhook lagring = over-kollektiv data.
- **Audit-verdi:** Må kunne bevise hva som skjedde i en payment-lifecycle for Stripe-disputer + intern reconciliation (minst 90 dager — Stripe-chargeback-window).
- **Debugability:** Platform-admin må kunne debugge failed payments uten rå-event (allerede dekket av `error_code`, `error_message`, `network_status`).

## Considered Options

1. **Lagre raw jsonb, ingen redaction** — enkelt, audit-fullt, men PII-lekk. *(Avvist.)*
2. **Redacted whitelist** — `redacted_payload` jsonb med kun PCI-safe + ikke-PII subset. *(Valgt.)*
3. **Drop raw-kolonnen helt** — kun `status`, `error_code`, `error_message`. *(Avvist — for dårlig audit for Stripe-disputer.)*

## Decision Outcome

Chosen option: **"Redacted whitelist"**, fordi det gir audit-verdi uten PII-eksponering.

**Implementasjon:**

`payment_attempt.redacted_payload jsonb` lagrer KUN:

| Felt | Kilde | Begrunnelse |
|------|-------|-------------|
| `event_id` | `event.id` | Idempotens-nøkkel |
| `event_type` | `event.type` | `payment_intent.succeeded` etc. |
| `created_at` | `event.created` | Event ordering |
| `payment_intent_id` | `data.object.id` | Stripe primary key |
| `amount` | `data.object.amount` | Beløp i minste enhet |
| `currency` | `data.object.currency` | 3-bokstavskode |
| `status` | `data.object.status` | `succeeded`, `failed`, etc. |
| `card_brand` | `data.object.payment_method.card.brand` | `visa`, `mastercard` — ikke-PII |
| `card_last4` | `data.object.payment_method.card.last4` | Non-sensitive under PCI |
| `card_country` | `data.object.payment_method.card.country` | `NO` |
| `error_code` | `last_payment_error.code` | Feilkategori |
| `error_message` | `last_payment_error.message` | Feiltekst |
| `outcome_network_status` | `outcome.network_status` | Rates-behandling |
| `outcome_risk_level` | `outcome.risk_level` | Fraud-klassifisering |

**Eksplisitt FORBUDTE felter** (filtreres ut ved INSERT):

- `billing_details.*` (navn, adresse, email, telefon)
- `customer.*` (Stripe customer object)
- `receipt_url` (inneholder identifiers)
- `source.*` (legacy kortobjekt med mer data)
- `charges.data[*].billing_details` 
- `charges.data[*].receipt_email`
- `shipping.*`

**B1 pgTAP test asserter** at `redacted_payload` ikke inneholder noen av de forbudte nøklene (rekursiv jsonb-sjekk).

**Retention:**

- `redacted_payload` beholdes **permanent** (audit-trail, allerede PII-fjernet)
- Ingen rå-event lagres i DB — kastes etter redaksjon i webhook-handler

**Access policy:**

- RLS: `payment_attempt` = platform-admin-only (workspaces får IKKE SELECT)
- Trigger: hver SELECT på `payment_attempt` fra en platform-admin logges via `billing_activity_log` event `platform_admin_pii_read` (ADR-0125)

## Rules & Consequences

- **Good, because** audit-verdi bevart uten PII-risiko
- **Good, because** permanent retention trygt (ingen rå-PII å utløpe)
- **Good, because** RLS + trigger-basert audit gir forensisk sporing ved mistanke om misbruk
- **Bad, because** platform-admin debugging mister noe kontekst (receipt-URL, billing_details) — men error_code + error_message er som regel nok
- **Bad, because** redaction-logikken MÅ kjøres før INSERT; pending webhook-handler-bug kan lekke data
- **Agent Impact:** Webhook-handlers MÅ kjøre redaction før DB-INSERT. B1 pgTAP-test asserter redaksjon. Ved code-review: enhver commit som endrer webhook-handler rødflagges hvis redaction-regler ikke vises. Hvis Stripe endrer webhook-format og legger til nye felt, defaulter de til EXCLUDED (whitelist-basert).

---

> Register in `docs/decisions/0000-decision-log.md` and update CLAUDE.md's ADR table.
