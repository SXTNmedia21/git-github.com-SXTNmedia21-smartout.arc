---
title: "Billing Engine Fase 3B — EHF + Bidirectional Sync + Workspace OAuth (Spec)"
status: draft
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [billing, ehf, peppol, fiken, tripletex, oauth, workspace-integration, cascade-c3]
depends_on:
  - docs/superpowers/specs/2026-04-17-billing-engine-fase-3-design.md
related:
  - docs/superpowers/specs/2026-04-17-billing-engine-fase-2-design.md
---

# Billing Engine Fase 3B — EHF + Bidirectional Sync + Workspace OAuth

> **Status:** Draft spec. Follows pattern from Fase 3A council-approved architecture.
> **Bygger på:** Fase 3A (`feat/billing-engine-fase-3`, pushet — 65 commits).

> **Ekstern-avhengig:** Digdir Peppol-sertifisering (3 uker), Fiken OAuth app registration, Tripletex OAuth app registration. Alle er Pontus's administrative oppgaver. Spec scaffolder kode + arkitektur; produksjons-aktivering skjer når ekstern-infra er klar.

---

## 1. Kjerneprinsipp

Fase 3A leverer Stripe + dunning + opprydding. Fase 3B fullfører integrasjonslaget:

- **Spor B — EHF/Peppol XML:** implementerer `PeppolEhfAdapter` (Fase 2 skjelett → ekte XML-generering), Peppol BIS Billing 3.0 format, Tickstar access point.
- **Spor D — Bidirectional integration sync:** Fiken + Tripletex ekte adapter-implementasjoner (erstatter PlaceholderAdapter). Ny `integration_poll_payments` engine_process for inbound sync (auto mark-paid fra regnskapssystem).
- **Spor E — Workspace integration OAuth:** self-serve "Koble til Fiken/Tripletex" for workspace-admin + OAuth callback Edge Function + Supabase Vault for per-workspace token storage.

**Arkitektonisk plassering:** C3 Commercial utvidelser. Ingen nye cascade-dimensjoner. Bygger på Fase 2/3A's adapter-pattern + engine_process-orkestrering.

---

## 2. Scope

### In scope (Fase 3B)

**Spor B — EHF/Peppol (scaffold + deactivated until Digdir cert):**
1. `PeppolEhfAdapter` class implementerer `DispatchAdapter` (erstatter Fase 2 skjelett)
2. XML-generering: UBL 2.1 / Peppol BIS Billing 3.0
3. Schematron validering pre-send
4. `company.peppol_participant_id text` + `company.ehf_enabled bool default false` kolonner
5. Tickstar (eller tilsvarende) SaaS access point — `target.ap_vendor: 'tickstar' | 'self_hosted'`
6. Feature flag `BILLING_EHF_ENABLED` — default off; toggles på når Digdir-sertifisering komplett

**Spor D — Fiken/Tripletex real adapters + inbound poll:**
1. `FikenAdapter` + `TripletexAdapter` ekte implementasjoner av `IntegrationAdapter`
2. Outbound sync (allerede i Fase 2 framework) — nå ekte: POST til Fiken/Tripletex REST API
3. **Nytt:** `integration_poll_payments` engine_process — cron-triggered (hourly), leser payments fra Fiken/Tripletex, matcher mot Smartout-invoices, auto mark-paid
4. Ny action_type `poll_integration_payments` handler
5. Credential rotation: tokens lagret i Supabase Vault (ikke 1Password for workspace-scope — per ADR-next)

**Spor E — Workspace integration config UI + OAuth:**
1. `/dashboard/billing/settings/integrations` — ny fane for workspace-admin
2. "Koble til Fiken" / "Koble til Tripletex" knapper (Stripe Connect deferred til Fase 3B+ eller egen fase)
3. OAuth callback Edge Function `integration-oauth-callback` — felles for begge providers, state-nonce validation, token exchange
4. `billing_integration` RLS utvides: `workspace_admin_own_crud` (workspace_id match)
5. Supabase Vault for per-workspace access tokens + refresh tokens (roterer automatisk)

### Out of scope (Fase 4+)

| Element | Hvorfor |
|---------|---------|
| Stripe Connect workspace payouts | 3A locked Smartout-owned model (ADR-0131); revurderes når workspaces etterspør direkte payouts |
| Additional integrations (Visma, Uni Micro, SAP) | Fase 3B gir Fiken/Tripletex som referanse; ny adapter per vendor is incremental work |
| Apple/Google Pay eksplisitt | Stripe Checkout støtter automatisk |
| Peppol inbound (motta EHF fra kunder) | Separat skope — Smartout er issuer, ikke receiver |

### Deferred externally-dependent

- **Digdir Peppol-sertifisering:** 3-ukers prosess. Spec scaffolder kode + feature flag; produksjons-aktivering krever sertifisering
- **Fiken OAuth app registration:** Pontus administrative oppgave — søker fra Fiken dev portal
- **Tripletex OAuth app registration:** Pontus administrative oppgave
- **Supabase Vault enabling:** infrastruktur-oppgave (sjekk om allerede aktivert i prosjektet)

---

## 3. Spor B — EHF/Peppol XML

### 3.1 Datamodell

**Nye kolonner på `company`:**
- `peppol_participant_id text NULL` — format `0192:<orgnr>` (norsk-spesifikk)
- `ehf_enabled bool NOT NULL DEFAULT false`

**CHECK:** `ehf_enabled=true` krever `peppol_participant_id IS NOT NULL`.

### 3.2 XML-generering

`packages/billing/src/dispatch/adapters/peppol-ehf/`:
- `generator.ts` — bygger UBL 2.1 XML fra invoice + line_items + company (seller + buyer) + tariff
- `schematron.ts` — validering mot Peppol BIS Billing 3.0 rules
- Templates: Mustache-basert XML template med escaping

### 3.3 Transport

`PeppolEhfAdapter.send()`:
1. Generate XML
2. Run schematron validation → hvis fail, return `{status: 'failed', error_code: 'schematron_invalid'}`
3. POST til Tickstar API (eller valgt AP) med autentisert bearer token (fra op:// eller env)
4. Return `{status: 'in_flight', external_reference: peppol_message_id}` — Peppol er async, accepted != delivered
5. (Future) webhook fra Tickstar på accept/reject — oppdaterer `invoice_dispatch.status`

### 3.4 Feature flag

`BILLING_EHF_ENABLED=true|false` — environment variable. Default false.
- Når false: `PeppolEhfAdapter.send()` returnerer `{status: 'failed', error_code: 'ehf_not_enabled'}`
- Når true: full operasjon

Toggles når Digdir-sertifisering komplett + Tickstar-avtale på plass.

---

## 4. Spor D — Fiken/Tripletex Real Adapters + Inbound Poll

### 4.1 Fiken adapter

`packages/billing/src/integrations/adapters/fiken.ts`:

```ts
export const FikenAdapter: IntegrationAdapter = {
  type: 'fiken',
  supports: ['customer', 'invoice'],  // contract/product/plan = Fase 4
  async sync({ integration, entity_type, operation, payload }) {
    const token = await resolveWorkspaceToken(integration);
    // POST til api.fiken.no/api/v2/...
    // Returnerer { status, external_reference }
  },
  async testConnection(integration) {
    const token = await resolveWorkspaceToken(integration);
    // GET /me — success? return { status: 'ok' }
  },
  async pollPayments?(since) {
    // Ny metode for inbound — se Spor D.2
  },
};
```

`integration.config.auth_ref` → Supabase Vault key → access_token + refresh_token. Auto-refresh når 401.

### 4.2 Tripletex adapter

Samme pattern som Fiken. Egen API-base `api.tripletex.io`.

### 4.3 Inbound poll — `integration_poll_payments`

**Ny `engine_process`:**
- `name: 'integration_poll_payments'`
- `allowed_channels: ['autonomous']`
- `trigger_events: ['billing.integration_poll_tick']`
- Steg: `action_type: 'poll_integration_payments'`

**pg_cron:** hver time → emit `billing.integration_poll_tick` event.

**Ny action_type handler `poll_integration_payments`:**
1. Load enabled integrations where `integration_type IN ('fiken', 'tripletex')` + `is_placeholder=false`
2. For each: call `adapter.pollPayments(integration.last_poll_at ?? startOfMonth)`
3. Per payment returned from vendor: match mot Smartout-invoice via `external_reference` eller invoice_number + amount + date
4. Hvis match: opprett `payment` rad (payment_method='bank_transfer', external_id=vendor_payment_id) + reconcile invoice status (Fase 3A's `reconcileInvoiceOnPayment`)
5. Update `integration.last_poll_at`
6. Emit `integration poll_found_payment` event per match

**Idempotens:** UNIQUE constraint på `payment(external_id, company_id)` hindrer dobbel-insert av samme vendor-payment.

### 4.4 Credential rotation

Supabase Vault stores `{access_token, refresh_token, expires_at}` per integration. Adapter sjekker expires_at pre-use, refresher automatisk via OAuth refresh_token grant, skriver nye tokens tilbake til Vault.

---

## 5. Spor E — Workspace OAuth

### 5.1 `/dashboard/billing/settings/integrations`

Server Component + Suspense. Viser liste over workspaces integrasjoner (filtrert RLS workspace_id=current).

Hver integration row:
- `IntegrationStatusIndicator` (healthy / error / in_flight / placeholder)
- Last sync timestamp
- "Koble fra" button
- Reauth button hvis token expired

"Legg til integrasjon" knapp åpner provider-dropdown (Fiken / Tripletex).

### 5.2 OAuth flow

1. User klikker "Koble til Fiken"
2. System: generate state-nonce, binds til (workspace_id, user_id), TTL 10 min
3. Redirect til Fiken OAuth `https://fiken.no/oauth/authorize?client_id=...&state=...&redirect_uri=...`
4. User authoriserer på Fiken
5. Fiken redirector til `https://app.smartout.no/api/integrations/oauth-callback?code=...&state=...`
6. Edge Function `integration-oauth-callback`:
   - Verify state-nonce (match workspace_id + user_id + not expired)
   - Exchange code for tokens (POST til Fiken token endpoint med client_secret)
   - Lagre tokens i Supabase Vault
   - INSERT `billing_integration` rad med `integration_type='fiken'`, `workspace_id=<ws>`, `config.auth_ref=<vault_key>`, `is_enabled=true`, `is_placeholder=false`
   - Redirect til `/dashboard/billing/settings/integrations?oauth=success&integration_id=<id>`
7. UI viser suksess-flyt (OAuthConnectingShimmer per Fase 2 Frontend R5)

### 5.3 RLS utvidelse

```sql
-- Fase 2 original: platform_admin_all only
-- Fase 3B: add workspace_admin_own_crud

CREATE POLICY billing_integration_workspace_admin_own_crud
  ON public.billing_integration
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
    AND is_placeholder = false  -- workspace cannot create placeholder integrations
  );
```

Platform-admin beholder `platform_admin_all` policy (kan fortsatt se alle).

### 5.4 OAuth callback Edge Function

`supabase/functions/integration-oauth-callback/`:
- `verify_jwt = false` (OAuth returner uten JWT)
- Validates state-nonce
- Exchanges code for tokens via provider-spesifikk logic (dispatch via query param `provider`)
- Writes to Vault + `billing_integration` table

---

## 6. Datamodell-oppsummering

| Endring | Type |
|---------|------|
| `company.peppol_participant_id text NULL` | ALTER |
| `company.ehf_enabled bool NOT NULL DEFAULT false` | ALTER |
| CHECK (`ehf_enabled=true ⇒ peppol_participant_id NOT NULL`) | CREATE |
| `billing_integration` RLS `workspace_admin_own_crud` | CREATE POLICY |
| `payment(external_id, company_id)` UNIQUE | CREATE INDEX UNIQUE |
| `engine_process` seed `integration_poll_payments` | INSERT |
| `engine_trigger` seed `billing.integration_poll_tick → integration_poll_payments` | INSERT |
| pg_cron `billing-integration-poll` (hourly) | CREATE schedule |
| `billing_integration_oauth_state` table (state-nonce TTL) | CREATE |

**Estimat:** 6-7 migrasjoner.

---

## 7. ADRs

| ADR | Tittel | Hvorfor |
|-----|--------|---------|
| **ADR-0136** | Workspace integration OAuth token storage — Supabase Vault | `op://` ikke mulig for workspace-scope (per-workspace credentials); Vault gir kryptert storage + rotation |
| **ADR-0137** | Peppol EHF transport via Tickstar SaaS access point | Unngå vendor-lock-in for XML-generator; bruk etablert AP for transport |
| **ADR-0138** | `integration_poll_payments` som separat engine_process fra `integration_sync` | Samme adapter-interface, men cron vs event trigger. Ontologically distinkt per Fase 3A rev 2 council-merknad |

---

## 8. Batching (B1-B6)

| Batch | Scope | Ekstern-avhengighet |
|-------|-------|---------------------|
| **B1** | 3 ADRs + schema (company EHF kolonner + OAuth state tabell + payment UNIQUE) + RLS utvidelse + engine_process seeds + telemetry | Ingen |
| **B2** | FikenAdapter + TripletexAdapter outbound real implementations + Vault integration | Fiken/Tripletex sandbox API keys (Pontus) |
| **B3** | `poll_integration_payments` handler + pg_cron + `payment(external_id)` matching | Samme som B2 |
| **B4** | Workspace OAuth UI + `integration-oauth-callback` Edge Function + state-nonce lifecycle | OAuth app registration (Pontus) |
| **B5** | `PeppolEhfAdapter` XML generator + schematron + Tickstar transport | Digdir sertifisering + Tickstar avtale (Pontus, 3 uker) |
| **B6** | Closure: user journeys + handoff + feature flag activation notes | — |

**Total:** ~5-6 uker. Kan kjøres parallelt dersom ekstern-infra er på plass. Uten ekstern-infra: B1 + B4 UI (som feilesafe viser "Connect not available yet") er reelle deliverables, resten scaffolder.

---

## 9. Telemetry

| Event | Trigger |
|-------|---------|
| `integration oauth_initiated` | User klikker "Koble til X" |
| `integration oauth_connected` | OAuth callback success |
| `integration oauth_failed` | OAuth callback error |
| `integration poll_started` | `poll_integration_payments` handler start |
| `integration poll_found_payment` | Match mellom vendor payment og Smartout invoice |
| `integration poll_no_match` | Vendor payment uten match (platform-admin reviewer) |
| `ehf submission_sent` | PeppolEhfAdapter.send() success |
| `ehf submission_failed` | Schematron fail eller Tickstar error |
| `ehf validation_error` | Schematron detaljfeil (logger-only + alert) |

---

## 10. Risiko

| Risiko | Mitigering |
|--------|-----------|
| Digdir sertifisering slipper > 3 uker | B5 som separat merge; feature flag gjør shipping trygt |
| Fiken/Tripletex OAuth app-approval delay | B2+B3 med mock/staging mode; real tokens når approval klar |
| Supabase Vault ikke aktivert | Check early i B1; fallback til `credential_ref` (Vault-pointer) pattern |
| Token refresh race | Mutex på workspace_id før refresh; retry on 401 with lock |
| Peppol schematron breaks på edge cases | pgTAP-test av XML-outputs mot kjente fakturaer; manual sign-off for prod |

---

## 11. Forward compat (Fase 4)

- Multi-currency utover NOK/EUR
- Prepayments / deposits
- Stripe Connect workspace payouts (revisit ADR-0131)
- Additional integrations (Visma, Uni Micro, etc.)
- Bidirectional sync av flere entiteter (contract, product, plan)
- AI tools for payments/integrations

---

**Neste steg:** Skriv ADR-0136/0137/0138 accepted → dispatch B1.
