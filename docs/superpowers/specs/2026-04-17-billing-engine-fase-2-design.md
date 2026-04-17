---
title: "Billing Engine Fase 2 — Dispatch + Integration (Spec, rev 2)"
status: draft
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [billing, invoice, faktura, dispatch, integration, sendgrid, peppol, ehf, stripe, platform-admin, cascade-c3, engine-process]
depends_on: [docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md]
related: [docs/superpowers/specs/2026-XX-XX-billing-contract-onboarding-design.md]
---

# Billing Engine Fase 2 — Dispatch + Integration

> **Status:** Draft spec rev 2. Council-reviewed 2026-04-17 (APPROVE WITH CHANGES). Rev 2 applies all 5 blockers + 5 must-fix from synthesis.
> **Authors:** Pontus Lindroth + Claude Opus 4.7 + System Council.
> **Bygger på:** Fase 1 (fakturamotor merget til development 2026-04-17, commit `11036771`).
> **Fase 2.5 (separat spec):** Contract onboarding (kontrakt-signert → workspace-provisjonering → onboarding-faktura) — ekstrahert fra Fase 2 §7 etter council-syntese.

---

## 1. Kjerneprinsipp

Fase 1 bygde **fakturamotoren** — den genererer, nummererer, og lagrer fakturaer med full sporbarhet. Men fakturaer lever i dag kun i databasen. De når ingen. Fase 2 bygger **utsendelsen og integrasjonslaget**, og gir workspace-admin manuell kontroll over egne fakturaer.

Tre spor:

- **Spor A — Dispatch System:** flerkanalsutsendelse per faktura. Hver kanal er en pluggbar *adapter* (email, HTTP API, Peppol-skjelett). Konfigureres dynamisk via 2-nivå regelsett (platform-baseline + workspace-override). `invoice_dispatch`-tabell tracker per-kanal-leveranse. Retry via `engine_delayed_trigger`.
- **Spor B — Integration Framework:** utgående integrasjonsregister (`billing_integration` config-tabell) + adapter-interface for tredjepartssystemer (Fiken, Tripletex, senere Stripe). **Synkronisering orkestreres av `engine_process` (eksisterende workflow runtime), IKKE en parallell motor.** Trigges på `engine_trigger` rader matchet mot eksisterende telemetry-events (`customer created`, `contract signed`, `invoice generated` — mellomrom-separert per ADR-konvensjon).
- **Spor C — Invoice Editing + Manual Controls:** platform-admin kan legge til manuelle linjer på draft-fakturaer, lage ad-hoc fakturaer (bruker eksisterende `one_off` enum-verdi), workspace-admin får "marker betalt"-knapp med reversal via credit note.

**Arkitektonisk plassering:** Alle tre spor er C3 Commercial consumers. Ingen nye cascade-dimensjoner. `invoice_dispatch` er den eneste nye runtime-state-tabellen — alt orkestreringsarbeid gjenbruker `engine_process`/`engine_state`/`engine_delayed_trigger`.

**Fase 2 sender ikke betalinger.** Stripe Checkout, automatisert dunning, EHF XML-generering, og onboarding-automatikk arves til Fase 3 eller Fase 2.5 (onboarding).

---

## 2. Fase-scope

### In scope (Fase 2, rev 2)

1. **Dispatch-regler** — `billing_dispatch_rule` (2-nivå: platform + workspace), dynamisk antall mottakere per kanal, eksplisitt `action` felt for `send | suppress` (workspace kan overstyre platform-default med suppress).
2. **Dispatch-adapters** — email til kunde/internt (SendGrid), generisk HTTP API med HMAC signatur. `PeppolEhfAdapter` IKKE implementert som klasse — kun enum-verdi + `BillingIntegrationAdapter` interface beholdes for Fase 3 forward-compat.
3. **Dispatch-historikk** — `invoice_dispatch` per-invoice-per-kanal rad; orkestreres via `engine_process` action_type `dispatch_invoice`; retry via `engine_delayed_trigger`.
4. **Integration framework** — `billing_integration` config-tabell + adapter-interface. Runtime-synkronisering via `engine_process` action_type `sync_integration`. **Ingen `billing_integration_sync` tabell, ingen `dispatch-retry-scan` Edge Function** (erstattet av engine_state + fire-delayed-triggers).
5. **Invoice editing** — platform-admin kan legge til/fjerne manuelle linjer på draft-fakturaer. Manuelle linjer identifiseres av `invoice_line_item.usage_snapshot_id IS NULL` (eksisterende kolonne + line_type='adjustment').
6. **Manuell paid-knapp (workspace-admin)** — "marker betalt" via manuell bankbetaling. Reversal = credit note (per ADR-0120, Fase 1), IKKE direkte status-flip.
7. **Ad-hoc faktura** — platform-admin lager manuelt med `invoice_type = 'one_off'` (eksisterende enum-verdi). UI = Sheet-drawer, ikke full side.
8. **Settings-UI** — platform-admin konfigurerer Smartout-defaults. Workspace-admin ser defaults (read-only seksjon "Fra Smartout") + legger til/overstyrer (egen seksjon "Dine regler").
9. **AI-tool `list_invoice_dispatches`** — 6. tool i `billing_query`-capability. **Trust Gate: slippes først etter B3** (workspace dispatch read UI) — ellers returnerer tomme arrays for legacy-leverte fakturaer.
10. **Telemetry** — 13 nye events (se §9). Alle mellomrom-separert. `PlaceholderAdapter` emitter `integration sync mocked` (IKKE `succeeded`) for audit-ærlighet.

### Explicit out of scope (Fase 3+)

| Element | Hvorfor utsatt |
|---------|---------------|
| Stripe Checkout (card payments) | Venter på Stripe Connect-onboarding — egen fase. Payment state-lifecycle kan trenge egen `payment`/`payment_attempt`-tabell (må valideres i Fase 3 discovery; Fase 2 forward-compat er IKKE garantert) |
| Automatisert dunning (n8n email-kjeder) | Krever Spor A først + separat policy-motor |
| EHF XML-generering | `peppol_ehf` enum + interface i Fase 2. Adapter-klasse + Digdir-sertifisering i Fase 3. |
| Reverse integration (les fra Fiken/Tripletex) | Fase 2 er outbound-only. Bidirectional sync er Fase 3. |
| Workspace-admin integration CRUD | Fase 2 = platform-admin only. Workspace self-serve ("Min Fiken") er Fase 3. |

### Extracted to separate spec (Fase 2.5)

**Contract onboarding flow** (tidligere Fase 2 §7). Ekstrahert fordi:
- DocuSeal-webhook mangler `company_id` + `metadata` i select (krever fiks)
- `supabase-js` har ikke transaksjoner — "i samme transaksjon" fra tidligere spec var falsk
- Onboarding-provisjonering bør gå via `engine_process` trigget på `contract signed`, ikke inline i webhook (separation-of-concerns)
- Har uavhengig beslutningsvekt (plan-mapping, proration, trial periods)

Se `docs/superpowers/specs/2026-XX-XX-billing-contract-onboarding-design.md` (opprettes før Fase 3).

---

## 3. Spor A — Dispatch System

### 3.1 Problem

I dag har `invoice.delivery_channel` tre CHECK-verdier (`manual` | `stripe` | `ehf`) og er en enkelt kolonne. Det lar oss dispatche til én kanal per faktura, og regelen er bundet til `pricing_terms`.

Virkeligheten:
- En faktura skal kunne gå til flere mottakere (kunde + regnskap + integrasjon).
- Smartout vil ha kopi av alle fakturaer som standard (for audit).
- Workspaces skal kunne legge til egne mottakere (AR, CEO, egen bokføring).
- Workspaces skal kunne SUPPRESS en platform-default (f.eks. "ikke send kopi til Smartout").
- Dispatch-status må trackes per kanal (email kan feile mens API-kall lykkes).

### 3.2 Datamodell

**Ny tabell: `billing_dispatch_rule`**

| Felt | Type | Note |
|------|------|------|
| `dispatch_rule_id` | uuid PK | |
| `workspace_id` | uuid NULL | NULL = platform-level baseline. NOT NULL = workspace-override/tillegg |
| `company_id` | uuid NULL | Optional scoping: regel kun for spesifikk company |
| `channel` | `billing_dispatch_channel` enum | `email_customer`, `email_internal`, `http_api`, `peppol_ehf` |
| `trigger_event` | text | Mellomrom-separert per konvensjon: `invoice generated`, `invoice issued`, `invoice voided`, `credit_note issued` |
| `target` | jsonb | Kanalspesifikk: `{email: "..."}`, `{integration_id: uuid}`, `{peppol_participant_id: "..."}` |
| `template_id` | uuid NULL | FK til `billing_dispatch_template` |
| `action` | `dispatch_rule_action` enum | `send` (default) eller `suppress` (disable matchende platform-regel) |
| `is_enabled` | bool default true | Soft-disable uten å slette |
| `created_at`, `updated_at` | timestamptz | |
| `created_by` | uuid → user_identity | |

**CHECK constraint:** `CHECK (workspace_id IS NOT NULL OR (action = 'send' AND company_id IS NULL))` — platform-level regler (workspace NULL) kan ikke være `suppress` og kan ikke være company-scoped (forhindrer platform-admin i å lage company-spesifikke platform-regler).

**Regelevaluering** (ADR-0127):
```
1. Samle platform_rules (workspace_id IS NULL) for matchende event
2. Samle workspace_rules (workspace_id = invoice.workspace_id) for matchende event
3. For hver platform_rule: dedup-key = canonical_json(channel + trigger_event + target)
4. Hvis workspace har regel med samme dedup-key + action='suppress' → platform_rule droppes
5. Hvis workspace har regel med samme dedup-key + action='send' → workspace-regel overstyrer (template_id etc. fra workspace)
6. Ellers: UNION av alle aktive regler
```

**Ny tabell: `billing_dispatch_template`**

| Felt | Type | Note |
|------|------|------|
| `template_id` | uuid PK | |
| `workspace_id` | uuid NULL | NULL = platform-eide maler; workspace kan ikke opprette egne i Fase 2 (out-of-scope) |
| `name` | text | "Standard faktura-email (NO)" |
| `channel` | enum | Hvilken kanal den er for |
| `subject_template` | text | Mustache-style `{{invoice.number}}` |
| `body_template` | text | HTML/plain per kanal |
| `locale` | text | `nb-NO`, `en-US` |
| `created_at`, `updated_at` | timestamptz | |

**Ny tabell: `invoice_dispatch`** (kilde-av-sannhet for leveranse; erstatter `invoice.delivery_*` gradvis — se ADR-0128 dual-write)

| Felt | Type | Note |
|------|------|------|
| `invoice_dispatch_id` | uuid PK | |
| `invoice_id` | uuid FK NOT NULL | |
| `dispatch_rule_id` | uuid FK NULL | NULL for ad-hoc ("send på nytt" fra UI) |
| `channel` | enum | Snapshot ved dispatch-tid |
| `target` | jsonb | Snapshot (bevarer hvem fakturaen faktisk gikk til) |
| `status` | `dispatch_status` enum | `pending`, `in_flight`, `delivered`, `failed`, `bounced` |
| `engine_state_id` | uuid NULL | FK til `engine_state` — linker til workflow-instans som orkestrerer retry. NULL inntil engine_process starter. |
| `attempts` | int default 0 | Synkronisert med `engine_state.retry_count` |
| `last_attempt_at` | timestamptz NULL | |
| `delivered_at` | timestamptz NULL | |
| `error_code` | text NULL | |
| `error_message` | text NULL | |
| `external_reference` | text NULL | SendGrid message_id, API response ID, etc. |
| `created_at`, `updated_at` | timestamptz | |

**Partial index for retry-scan:** `CREATE INDEX idx_invoice_dispatch_retry ON public.invoice_dispatch(status) WHERE status IN ('pending', 'in_flight');`

### 3.3 Adapter-interface

```ts
// packages/billing/src/dispatch/types.ts
export type DispatchAdapter = {
  channel: BillingDispatchChannel;
  send(input: {
    invoice: Invoice;
    target: Record<string, unknown>;
    template?: BillingDispatchTemplate;
  }): Promise<DispatchResult>;
  testConnection?(target: Record<string, unknown>): Promise<TestConnectionResult>;
};

export type DispatchResult =
  | { status: 'delivered'; external_reference: string }
  | { status: 'in_flight'; external_reference: string; check_back_at: Date }
  | { status: 'failed'; error_code: string; error_message: string; retryable: boolean };

export type TestConnectionResult =
  | { status: 'ok' }
  | { status: 'error'; message: string }
  | { status: 'timeout' };
```

**Fase 2 implementasjoner:**
- `EmailCustomerAdapter` — SendGrid, PDF attachment, customer-vendt template
- `EmailInternalAdapter` — SendGrid, minimal template (Smartout audit + interne mottakere)
- `HttpApiAdapter` — POST JSON til `target.endpoint` med HMAC-signatur fra `target.signing_key_ref` (1Password op://)

**Ikke i Fase 2:** Ingen `PeppolEhfAdapter`-klasse. Enum `peppol_ehf` + interface beholdes som forward-compat. Dead code unngås (per council-verdikt).

### 3.4 Orkestrering via Event Engine (erstatter `dispatch-retry-scan`)

**Ny `engine_process`: `invoice_dispatch_delivery`** (seedes i B1-migrasjon):

```
engine_process:
  - name: 'invoice_dispatch_delivery'
  - trigger_events: ['invoice issued', 'invoice dispatch retry_requested']
  - steps:
    1. action_type = 'dispatch_invoice'
       action_payload: { invoice_dispatch_id, adapter_type }
       on_failure: retry with exponential backoff (1m, 5m, 15m, 1h, 6h)
       max_retries: 5
    2. On final success → emit 'invoice dispatched'
    3. On final failure → emit 'invoice dispatch failed', create deviation
```

**Ny action_type i `engine-dispatch/index.ts`:** `dispatch_invoice`
- Leser `invoice_dispatch` rad via payload-id
- Kaller riktig adapter basert på `channel`
- Oppdaterer `invoice_dispatch.status` + `external_reference` + `error_*`
- Skriver til `billing_activity_log`
- Emitter dispatch-events

**Retry:** Bruk eksisterende `engine_delayed_trigger` + `fire-delayed-triggers` Edge Function (pg_cron). Ingen ny Edge Function opprettes.

### 3.5 Telemetry-konsumering

Ved `invoice issued`:
1. `emit('invoice issued', ...)` — eksisterende Fase 1 event
2. Ny `engine_trigger` rad: `event_type='invoice issued'` → starter `invoice_dispatch_delivery` engine_process
3. Engine-process leser `billing_dispatch_rule` (platform ∪ workspace med suppress-semantikk)
4. Per matchende regel: opprett `invoice_dispatch`-rad med `status='pending'`
5. Engine schedulerer `dispatch_invoice` steg per rad (parallell)

**Konvensjon:** Alle Fase 2 events bruker mellomrom-separator (`invoice dispatched`, aldri `invoice.dispatched`). pgTAP-test i B1 asserter at ingen event-navn i `engine_trigger.event_type` inneholder `.`.

### 3.6 UI (se §13 motion specs, §10 RLS, §11 mobile parity)

**Platform-admin:**
- `/platform-admin/billing/settings/dispatch` — dispatch-regler tabell (gruppert: platform-defaults + per-workspace). Søk + filter chips. Ingen flat liste (Nordic Split scale-hensyn).
- `/platform-admin/billing/invoices/[id]` — ny seksjon "Dispatches": liste med `DispatchStatusBadge` per rad (IKKE gjenbruk `InvoiceStatusBadge`), "Send på nytt"-knapp per rad, "Legg til ad-hoc mottaker"-dialog.

**Workspace-admin:**
- `/dashboard/billing/settings` — ny fane "Utsendelse":
  - Seksjon 1: "Fra Smartout" — muted bakgrunn (`bg-muted/50`), regler read-only, info-ikon per rad
  - Seksjon 2: "Dine regler" — default bakgrunn, full CRUD + "Legg til" ghost card. Workspace kan opprette `action='suppress'` regel for å disable en platform-default.
- `/dashboard/billing/[invoice_id]` — ny seksjon "Leveranser": samme `DispatchStatusBadge` som platform (read-only her).

---

## 4. Spor B — Integration Framework

### 4.1 Problem + prinsippendring fra rev 1

Vi vil ha forhåndsbygd kabling mot eksterne systemer. I rev 1 foreslo spec'en en *parallell* polling-motor (`billing_integration_sync` + `dispatch-retry-scan`). Council-syntese (Agent Coordinator code-trace) avdekket at dette bryter CLAUDE.md-loven "no second event system": `engine_process` er den universelle workflow-runtimen og har allerede retry/backoff/delayed-triggers.

**Rev 2-beslutning (ADR-0126):** Integration-sync orkestreres via `engine_process`. Kun `billing_integration` config-tabell legges til. Ingen ny orkestreringstabell, ingen ny Edge Function.

### 4.2 Datamodell

**Ny tabell: `billing_integration`**

| Felt | Type | Note |
|------|------|------|
| `integration_id` | uuid PK | |
| `workspace_id` | uuid NULL | NULL = platform-level (Smartout-eid integrasjon). NOT NULL = workspace-spesifikk (Fase 3, out-of-scope i Fase 2 UI). |
| `integration_type` | `billing_integration_type` enum | `fiken`, `tripletex`, `stripe`, `placeholder` |
| `display_name` | text | "Fiken (Smartout AS)" |
| `config` | jsonb | Type-spesifikk: API-URL, auth-scheme-ref (`op://`), sync-innstillinger |
| `is_enabled` | bool default true | |
| `is_placeholder` | bool default false | TRUE for PlaceholderAdapter — gater audit-oppførsel (se §4.4) |
| `last_sync_at` | timestamptz NULL | Oppdatert av engine_process steg |
| `last_sync_status` | text NULL | `ok`, `error`, `partial` |
| `created_at`, `updated_at` | timestamptz | |

**Ikke eksisterende i rev 2:** `billing_integration_sync`-tabellen (fjernet). Synkroniseringshistorikk lagres i `engine_state` + `engine_state_step` (eksisterende tabeller).

### 4.3 Adapter-interface

```ts
// packages/billing/src/integrations/types.ts
export type IntegrationAdapter = {
  type: BillingIntegrationType;
  supports: IntegrationEntity[];
  sync(input: {
    integration: BillingIntegration;
    entity_type: IntegrationEntity;
    operation: 'create' | 'update' | 'delete';
    payload: Record<string, unknown>;
  }): Promise<SyncResult>;
  testConnection(integration: BillingIntegration): Promise<TestConnectionResult>;
};
```

**Fase 2 implementasjoner:**
- `PlaceholderAdapter` — logger payload til `engine_state_step.output`, emitter `integration sync mocked` (IKKE `succeeded`). `is_placeholder = true` gater dette. Audit-ærlig.

Ingen ekte integrasjon (Fiken/Stripe) implementeres i Fase 2 — kun rammeverket.

### 4.4 Orkestrering

**Ny `engine_process`: `integration_sync`** (seedes i B1-migrasjon):

```
engine_process:
  - name: 'integration_sync'
  - trigger_events: [
      'customer created',
      'invoice generated',
      'invoice issued',
      'contract signed',
      'contract terminated'
    ]
  - steps:
    1. action_type = 'sync_integration'
       action_payload: { integration_id, entity_type, entity_id, operation }
       on_failure: retry with exponential backoff
       max_retries: 5
```

**Ny action_type i `engine-dispatch/index.ts`:** `sync_integration`
- Leser `billing_integration` rad via payload-id
- Kaller riktig adapter basert på `integration_type`
- Hvis `is_placeholder = true`: emitter `integration sync mocked` (ikke `succeeded`) og skriver klart `[PLACEHOLDER]` prefix til `billing_activity_log`
- Oppdaterer `billing_integration.last_sync_at` + `last_sync_status`

**Trigger fan-out:** `engine_trigger`-rader for hver (event × enabled integration). Ved 100 workspaces × 3 integrasjoner × `invoice generated` = 300 engine_state-rader per sync-cycle. Retension: `engine_state` har allerede cleanup-policy (referer til engine_process-dokumentasjon).

### 4.5 UI

**Platform-admin:**
- `/platform-admin/billing/integrations` — liste + CRUD for integrasjoner. Per integrasjon: sync-historikk (les fra `engine_state` joined på integration_id i payload), "Test connection"-knapp med full micro-interaction (4 utfall: `ok | error | ambiguous | timeout`, se §13), retrigger-knapp.
- Placeholder-integrasjon vises med eksplisitt badge "Placeholder — ingen ekstern effekt".

**Workspace-admin:** Ikke i Fase 2.

---

## 5. Spor C — Invoice Editing + Manual Controls

### 5.1 Problem

Fase 1 lar platform-admin markere betalt / annullere / kreditere, men fakturalinjer er `computed` fra usage_snapshot. Det er ingen måte å:
- Legge til en manuell linje ("Ekstra konsulentoppdrag kr 2 500")
- Lage en ad-hoc faktura (oppstartsgebyr, egen avtale)
- La workspace-admin markere betalt når kunde har betalt via bank

### 5.2 Funksjonalitet

**Invoice editing (platform-admin):**

- På `/platform-admin/billing/invoices/[id]` (kun når `invoice.status = 'draft'`):
  - "Legg til linje"-knapp → dialog: description + quantity + unit_price + VAT override
  - Rediger/slett linjer — **kun der `invoice_line_item.usage_snapshot_id IS NULL`**. Linjer med `usage_snapshot_id IS NOT NULL` er immutable (ADR-0119 reproducibility, Fase 1).
  - Manuelle linjer får `line_type = 'adjustment'` (eksisterende enum-verdi; ingen ny enum trengs).
  - Pris + VAT rekalkuleres på hver endring.
- Emit `invoice line_item added` / `invoice line_item edited` / `invoice line_item removed` events.
- Blokkeres etter `invoice.status != 'draft'` via RLS UPDATE-policy + trigger.

**Ad-hoc faktura (platform-admin):**

- Opprettes via slide-out `Sheet`-drawer fra `/platform-admin/billing/invoices` (ikke ny side).
- Form: company picker + periode + custom line items (ingen usage_snapshot-binding)
- `invoice.invoice_type = 'one_off'` (eksisterende enum-verdi)
- Går gjennom normal dispatch når den issues

**Manuell paid (workspace-admin):**

- På `/dashboard/billing/[invoice_id]` (eksisterende read-only side):
  - Knapp "Marker som betalt" (kun synlig når `invoice.status = 'issued'`)
  - Dialog: payment_date + payment_reference + note + bekreftelses-copy: *"Dette markerer faktura #X som betalt. Hvis feil — kontakt Smartout for å utstede kreditnota."*
  - Server Action `markInvoicePaidByWorkspaceAdmin` i `packages/billing/src/actions/` (mobile-klar) — skaper `billing_activity_log` med `source = 'web'`, `actor_user_id = admin`
  - Samme event som platform-admin's mark-paid: `invoice marked_paid`
  - Platform-admin ser "betalt av [workspace-admin] [dato]" i admin-UI

**Reversal-semantikk (ADR-0120 bekreftelse):**

Workspace-admin kan IKKE angre sin egen "marker betalt". Reversal = kreditnota utstedt av platform-admin. UI viser tydelig: *"Kan ikke angres — kontakt Smartout."* Dette er bevisst for å holde audit-kjeden ren.

**Datamodell-endring (minimal):**
- `invoice_line_item` — **ingen ny kolonne**. Bruker eksisterende `usage_snapshot_id IS NULL` som "manual line"-predikat. Bruker eksisterende `line_type='adjustment'` enum-verdi.
- `invoice_type` enum — **ingen endring**. Ad-hoc bruker eksisterende `one_off`.
- Ny trigger: prevent UPDATE/DELETE av `invoice_line_item WHERE usage_snapshot_id IS NOT NULL` når `invoice.status != 'draft'`.

---

## 6. Datamodell-oppsummering

| Tabell | Endring | Migrasjonstype |
|--------|---------|---------------|
| `billing_dispatch_rule` | NY | CREATE |
| `billing_dispatch_template` | NY | CREATE |
| `invoice_dispatch` | NY (med `engine_state_id` FK) | CREATE |
| `billing_integration` | NY (med `is_placeholder` bool) | CREATE |
| `billing_dispatch_channel` enum | NY | CREATE TYPE |
| `dispatch_status` enum | NY | CREATE TYPE |
| `dispatch_rule_action` enum | NY (`send | suppress`) | CREATE TYPE |
| `billing_integration_type` enum | NY (`fiken | tripletex | stripe | placeholder`, + `peppol_ehf` reservert) | CREATE TYPE |
| `engine_process` | 2 nye blueprint-rader: `invoice_dispatch_delivery`, `integration_sync` | INSERT |
| `engine_trigger` | N nye trigger-rader som mapper events til engine_process | INSERT |
| `engine-dispatch/index.ts` | 2 nye action_type handlers: `dispatch_invoice`, `sync_integration` | CODE |
| Trigger på `invoice_line_item` | Blokker UPDATE/DELETE av `usage_snapshot_id IS NOT NULL` rader utenfor draft | CREATE TRIGGER |
| `invoice.delivery_channel` / `delivery_status` / `external_reference` | DEPRECATED (dual-write under B2, hard drop Fase 3 per ADR-0128) | — |

**Fjernet fra rev 1:** `billing_integration_sync`-tabell, `invoice_line_item.line_source`-kolonne, `invoice_type + 'adhoc'` enum-utvidelse, `dispatch-retry-scan` Edge Function, `PeppolEhfAdapter` klasse.

**Estimat:** 5-6 migrasjoner. Timestamps starter `>= 20260511200000` (utenfor development HEAD sitt max `20260511100000`) for å unngå kollisjon med annen work.

---

## 7. RLS matrise (MÅ implementeres i B1)

| Tabell | Platform-admin | Workspace-admin | Anon/employee |
|--------|---------------|-----------------|---------------|
| `billing_dispatch_rule` | SELECT/INSERT/UPDATE/DELETE alle rader | SELECT alle platform-rader + CRUD egne (`workspace_id = any_user_workspace`) | — |
| `billing_dispatch_template` | SELECT/INSERT/UPDATE/DELETE alle rader | SELECT alle (read-only ref) | — |
| `invoice_dispatch` | SELECT/INSERT/UPDATE alle rader | SELECT kun for egne workspace sine invoices | — |
| `billing_integration` | SELECT/INSERT/UPDATE/DELETE alle rader | Ingen tilgang (Fase 2) | — |

**Helpers å gjenbruke:** `get_workspace_ids_for_user()`, `is_admin_in_workspace()`, `is_platform_admin()`. Pattern-navn: `{table}_platform_admin_all`, `{table}_workspace_admin_read`, `{table}_workspace_admin_own_crud`. Se Fase 1 `20260417123732_billing_rls_policies.sql` for navngivningskonvensjon.

---

## 8. Mobile parity

| Surface | Desktop | Mobile | Begrunnelse |
|---------|---------|--------|-------------|
| Platform-admin dispatch settings | ✅ | ❌ | Admin-verktøy, ingen mobil-behov |
| Platform-admin integrations | ✅ | ❌ | Admin-verktøy |
| Platform-admin ad-hoc invoice (Sheet) | ✅ | ❌ | Admin-verktøy |
| Platform-admin invoice editing | ✅ | ❌ | Admin-verktøy |
| Workspace dispatch settings | ✅ | ✅ | Workspace-admin må kunne legge til mottakere fra mobil |
| Workspace mark-paid knapp | ✅ | ✅ | Kritisk — admin på stedet ved bank-betaling |
| Workspace per-invoice dispatches (read-only) | ✅ | ✅ | "Gikk fakturaen ut?" er mobil-spørsmål |

**Arkitekturkonsekvens:** Alle workspace-mutasjoner (mark-paid, dispatch-rule CRUD) implementeres i `packages/billing/src/actions/` som rene funksjoner. Web bruker Server Actions som tynn wrapper; mobile React Native bruker samme funksjoner via API-client. Ingen duplisering.

---

## 9. i18n

**Beslutning:** Fase 2 workspace-admin UI er `nb-NO` fra dag én via `@smartout/i18n` + `useTranslations()`. Platform-admin UI kan være engelsk (interne workspaces/audits) men bør også bruke i18n-hooks for konsistens.

**Hvorfor:** Fase 1 deferret i18n for platform-admin (rettferdig, intern surface). Fase 2 introduserer NY workspace-admin UI rettet mot norske kunder (dispatch settings tab, mark-paid dialog, dispatch leveranser visning). Hardkodet norsk bryter CLAUDE.md "Never hardcode Norwegian text — use i18n keys".

**Scope:**
- Alle nye workspace-admin strings → `packages/i18n/src/locales/nb-NO/billing.json`
- Alle nye platform-admin strings → samme struktur, også `en-US/billing.json`
- ESLint-regel aktiveres for `apps/web/src/app/dashboard/billing/**` (ikke for platform-admin i Fase 2; det beholdes som opt-in)

---

## 10. ADRs som må skrives FØR B1 starter (5 stk)

| ADR | Tittel | Status |
|-----|--------|--------|
| **ADR-0126** | Integration sync as Event Engine process, not parallel motor | Må skrives + accepted før B1 |
| **ADR-0127** | Billing dispatch rule 2-level evaluation + suppress semantics | Må skrives + accepted før B1 |
| **ADR-0128** | invoice.delivery_* deprecation lifecycle (dual-write → drop) | Må skrives + accepted før B1 |
| **ADR-0129** | Billing integration adapter pattern + is_placeholder audit-safety | Må skrives + accepted før B1 |
| **ADR-0130** | Fase 2 scope exclusion: Contract onboarding extracted to Fase 2.5 | Må skrives + accepted før B1 |

> Merk: ADR-numrene 0116-0120 er reservert for disse. Sjekk `0000-decision-log.md` for faktiske neste ledige numre ved writing-tid.

---

## 11. Telemetry (13 events, alle mellomrom-separert)

Nye events i `packages/telemetry/src/registry.ts`:

| Event | Trigger | Destinations |
|-------|---------|--------------|
| `invoice dispatched` | `dispatch_invoice` action fullført | posthog, logger, billing_activity_log, engine_event |
| `invoice dispatch failed` | Final-failed etter retries | posthog, logger, billing_activity_log, engine_event, *alert* |
| `invoice dispatch retried` | Hver retry-attempt | logger only (høy-volum debug) |
| `invoice dispatch retry_requested` | Manual "send på nytt" | logger, billing_activity_log |
| `integration sync succeeded` | Ekte adapter (ikke placeholder) | posthog, logger, billing_activity_log, engine_event |
| `integration sync failed` | Final failed | posthog, logger, billing_activity_log, engine_event, *alert* |
| `integration sync mocked` | PlaceholderAdapter | logger only (audit-ærlig) |
| `integration test_connection succeeded` | Manual "test" fra UI | logger, billing_activity_log |
| `integration test_connection failed` | Manual test mislyktes | logger, billing_activity_log |
| `invoice line_item added` | Manuell add i draft | posthog, logger, billing_activity_log |
| `invoice line_item edited` | Manuell edit i draft | posthog, logger, billing_activity_log |
| `invoice line_item removed` | Manuell remove i draft | posthog, logger, billing_activity_log |
| `invoice adhoc_created` | Ad-hoc invoice via drawer | posthog, logger, billing_activity_log |
| `workspace marked_paid` | Workspace-admin paid-knapp | posthog, logger, billing_activity_log, engine_event |
| `dispatch_rule created` / `updated` / `deleted` | CRUD | posthog, logger, billing_activity_log |
| `integration created` / `updated` / `deleted` | CRUD | posthog, logger, billing_activity_log |
| `dispatch_rule evaluated` | Debug: rulematch per invoice | logger only |

**pgTAP-gate i B1:** assertion som sjekker at ingen event-navn inneholder `.` separator. Kjøres i CI.

---

## 12. Tests

Fase 2 tests følger Fase 1 mønster (pgTAP for schema/triggers, vitest for pure functions, Playwright for journeys).

**Obligatorisk i B1-B5:**

| Batch | Test | Hva |
|-------|------|-----|
| B1 | pgTAP | RLS per tabell (7 nye tabeller/enums), trigger på invoice_line_item mutability, event-name convention audit (no `.`) |
| B2 | vitest | Adapter-interface contract per adapter, idempotens (samme event 2x → samme `invoice_dispatch` row count), retry-loop (exponential backoff) |
| B2 | pgTAP | 2-nivå rule evaluation med canonical JSON dedup + suppress |
| B3 | Playwright | Journey: platform-admin lager regel + sender faktura + ser dispatch-status |
| B3 | Playwright | Journey: workspace-admin legger til mottaker + suppresser platform-default |
| B4 | vitest | PlaceholderAdapter emitter `mocked` ikke `succeeded`; test_connection returnerer alle 4 utfall |
| B5 | Playwright | Journey: workspace-admin markerer betalt + ser bekreftelse; platform-admin ser hvem som markerte |
| B5 | pgTAP | Invoice editing: usage_snapshot_id IS NOT NULL rader er immutable utenfor draft |

---

## 13. Motion specs (Nordic Split compliance)

Alle transisjoner bruker spring-physics (stiffness 35, damping 22, mass 2.2 om ikke annet spesifisert). Min 250ms exit / 500ms entrance.

| Surface | Animasjon |
|---------|-----------|
| `DispatchStatusBadge` state-endring | Scale 0.95 → 1.00, spring default |
| `in_flight` dispatch | Pulserende ring, 2.2s cycle, scale 1.00 ↔ 1.03, opacity 0.6 ↔ 1.0 |
| Test-connection flyt | Klikk → "Tester..." med pulsering; success = checkmark stroke-dasharray 600ms; failure = warm amber flash 400ms |
| Invoice draft→issued lås | Delete-knapper fade+collapse 250ms; input→text layout animation spring mass 2.2; lock-indikator warm amber top-edge glow 500ms entrance |
| Mark-paid success | Badge transition med spring + toast entrance fra bottom-right |
| Dispatch "send på nytt" | Row background warm amber pulse, 1.2s × 1 |
| Sheet/drawer (ad-hoc invoice) | Slide-in fra høyre, spring, 500ms entrance |
| Dispatch-rules grupping i UI | Chip-filtre med 200ms cross-fade |

**Ingen CSS `transition: all` — alle animasjoner via Framer Motion eller eksplisitt CSS keyframes.**

---

## 14. Komponent-inventar (nye i `_components/`)

```
apps/web/src/app/platform-admin/billing/_components/
  DispatchStatusBadge.tsx          — NY sibling til InvoiceStatusBadge
  DispatchRulesTable.tsx           — NY, grupping + search
  DispatchRow.tsx                  — NY, brukes i per-invoice seksjon
  InvoiceLineItemEditor.tsx        — NY, draft/locked states
  IntegrationStatusIndicator.tsx   — NY, 4 utfall
  TestConnectionButton.tsx         — NY, full micro-interaction
  AdHocInvoiceDrawer.tsx           — NY, Sheet-basert

apps/web/src/app/dashboard/billing/_components/
  MarkPaidButton.tsx               — NY, workspace
  MarkPaidDialog.tsx               — NY, bekreftelse
  WorkspaceDispatchRulesPanel.tsx  — NY, 2 seksjoner (fra-Smartout + dine)
  WorkspaceInvoiceDispatches.tsx   — NY, read-only dispatch liste
```

**Accessibility:** `DispatchStatusBadge` har `role="status"` + `aria-live="polite"`. Editable tabeller har dokumentert tab-rekkefølge + aria-labels på inline-aksjoner. Alle dialogs/drawers har focus-trap. Status-farger duplikeres alltid med Lucide-ikoner (CheckCircle, XCircle, Loader, AlertTriangle) — aldri kun farge.

---

## 15. Batching (B1-B6) + parallelism

| Batch | Scope | Estimert | Parallelt med |
|-------|-------|----------|---------------|
| **B1** | 5 ADRs + migrasjoner (5-6 stk) + RLS + engine_process-seeds + engine_trigger rader + pgTAP event-name audit + telemetry registry-oppdatering | 1.5 uker | serial (blokker alle andre) |
| **B2** | Dispatch server: adapter-interface i `packages/billing/src/dispatch/`, 3 reelle adapters, `dispatch_invoice` action-handler i engine-dispatch, Server Actions i `packages/billing/src/actions/` (mobile-klar), dual-write bridge til legacy delivery_* kolonner | 1.5 uker | parallelt med B4 |
| **B3** | Dispatch UI: platform-admin settings side, workspace-admin "Utsendelse" fane (2 seksjoner), per-invoice dispatches seksjon, `DispatchStatusBadge`, i18n nb-NO, mobile for workspace | 1.5 uker | parallelt med B5 |
| **B4** | Integration framework: `billing_integration` CRUD, `sync_integration` action-handler, `PlaceholderAdapter`, test_connection UI med 4 utfall | 1.0 uker | parallelt med B2 |
| **B5** | Invoice editing + mark-paid: line-item CRUD, draft→locked transition, workspace mark-paid Server Action + dialog, ad-hoc invoice Sheet-drawer | 1.5 uker | parallelt med B3 |
| **B6** | AI-tool `list_invoice_dispatches` i billing-query capability. **Trust Gate — slippes først etter B3 er merget.** | 0.5 uker | sist, etter B3 |

**Total:** ~6-7 uker med 2 agenter parallelt for B2+B4 og B3+B5.

**Fase 2.5 (contract onboarding):** Egen spec skrives senere, implementeres etter Fase 2 merge.

---

## 16. Risiko-register

| Risiko | Sannsynlighet | Impact | Mitigering |
|--------|---------------|--------|-----------|
| Event-navn drift (dot vs space) | Høy uten gate | Kritisk — silent duplikat vokabular | B1 pgTAP-test asserter at ingen event-navn inneholder `.`. CI-gate. |
| Integration-motor duplisering (implementør drifter tilbake til parallell motor) | Medium | Høy (2-3 uker unwind) | ADR-0126 skrives FØRST i B1. PR-beskrivelser refererer til den. Code-review sjekkliste: "legges retry/backoff-state utenfor `engine_state`? Forklar hvorfor." |
| `delivery_*` deprecation uten hard drop-dato | Medium | Høy (permanent tech debt) | ADR-0128 spesifiserer hard drop: Fase 3-close eller 2026-Q3. Telemetry-alert hvis `invoice.delivery_status` leses etter B3-merge. |
| Mobile parity gap (mutasjoner havner i `apps/web/` i stedet for `packages/billing/src/actions/`) | Medium | Høy (brutal refaktor senere) | B1 lint-regel som feiler hvis Server Action for Fase 2 bor under `apps/web/src/app/...` og gjør mutasjon på `billing_*` tabell |
| Trust Gate brudd (B6 AI tool slippes før B3) | Lav med dokumentasjon | Høy (tomme arrays = verre enn ingen verktøy) | Spec §2 punkt 9 explicit: B6 etter B3. Capability-registry kommentar. |
| Placeholder-adapter forurenser audit | Lav (med `is_placeholder` gate) | Medium | `integration sync mocked` event (ikke `succeeded`), `[PLACEHOLDER]` prefix i billing_activity_log |

---

## 17. Fase 3 forward-compat (modifisert claim)

Fase 3 plukker opp:
- **Stripe Connect** — nytt `stripe_payment_intent_id` felt på invoice + Stripe webhook som auto-flipper mark_paid. **MERK:** Stripe payment state-lifecycle (setup_intent, payment_intent, charge, refund) kan trenge egen `payment`/`payment_attempt`-tabell som IKKE er forutsett i Fase 2 schema. Må valideres i Fase 3 discovery — ikke garantert forward-compat.
- **EHF XML-generering** — implementerer `PeppolEhfAdapter`-klasse + Digdir-sertifisering
- **Automatisert dunning** — n8n-workflow leser `invoice WHERE dunning_status IS NOT NULL` og oppretter `invoice_dispatch` på `email_customer` med dunning-template
- **Bidirectional integration sync** — les inn kundebetalinger fra Fiken/Tripletex, auto-mark-paid via nytt `engine_process`
- **Workspace integration config** — `/dashboard/billing/settings/integrations` for self-serve kobling

**Fase 2.5 plukker opp:**
- Contract onboarding: webhook select-extension, engine_process for provisjonering, pricing_terms fra contract.metadata, onboarding-faktura generering

---

## 18. Spec coverage self-check (vs council-verdikt)

| Krav fra council | Dekket av |
|-----------------|-----------|
| Blocker 1: Fjern billing_integration_sync + dispatch-retry-scan → engine_process | §4.1, §4.4, §3.4 |
| Blocker 2: Event-navn mellomrom-separert | §3.2, §3.5, §11, pgTAP-gate §12 |
| Blocker 3: Ekstraher §7 onboarding | §2 "Extracted to separate spec" + frontmatter `related:` |
| Blocker 4: Fjern PeppolEhfAdapter klasse | §3.3 + §17 |
| Blocker 5: Fjern line_source + `'adhoc'` fra §6 | §5.2 (bruker eksisterende `usage_snapshot_id IS NULL` + `line_type='adjustment'` + `one_off`) |
| Must-fix 6: RLS matrise | §7 |
| Must-fix 7: ADR-0127 dispatch rule evaluation | §3.2 + §10 |
| Must-fix 8: ADR-0128 delivery_* deprecation | §10 + §16 risiko-register |
| Must-fix 9: Mobile parity | §8 |
| Must-fix 10: i18n | §9 |
| Frontend motion specs | §13 |
| Frontend komponenter + accessibility | §14 |
| Supervisor batching B1-B6 | §15 |

---

**Neste steg:** Skriv ADR-0126 til 0130 → B1 kan dispatches.
