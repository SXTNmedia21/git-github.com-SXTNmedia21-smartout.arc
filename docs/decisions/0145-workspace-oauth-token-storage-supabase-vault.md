---
title: "Workspace Integration OAuth Token Storage — Supabase Vault"
id: ADR-0145
status: superseded
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-18
superseded_by: ADR-0148
superseded_reason: Fase 3B rescoped — EHF skjer via regnskapsfører-CSV/PDF-eksport, ikke via workspace-OAuth til Fiken/Tripletex. Ingen workspace-tokens trengs i Fase 3B. ADR beholdes som historikk for eventuell senere OAuth-fase.
---

# ADR-0145: Workspace Integration OAuth Token Storage — Supabase Vault

## Context and Problem Statement

Fase 3B introduserer workspace-admin self-serve OAuth-flyt for Fiken + Tripletex. Tokens fra disse OAuth-er (access_token + refresh_token) trenger persistent storage. ADR-0077 secrets protocol tillater kun `op://` refs — men `op://` er Smartout-platform-scope, ikke per-workspace. Workspace kan ikke opprette 1Password-entries ved runtime. Vi trenger per-workspace, per-integration secret storage med rotation-support.

## Decision Drivers

- **Per-workspace isolation:** hver workspace må ha sine egne tokens. Cross-workspace lekk er GDPR-brudd.
- **Rotation:** OAuth access_tokens utløper (typisk 1-4 timer); vi må trygge refresh og oppdatere tokens uten user-intervensjon.
- **Audit:** alle cred-tilgang må logges.
- **Ingen rå-tokens i main DB:** storage må være kryptert på column-nivå.
- **Deno-kompatibilitet:** Edge Functions (Deno) må kunne lese tokens uten `1password-cli` subprocess.

## Considered Options

1. **1Password per-workspace entries** — opprettes ved OAuth success. *(Avvist — ingen runtime API for å opprette nye op:// entries.)*
2. **Kryptert jsonb i billing_integration.config** — application-encrypt before INSERT, decrypt on read. *(Avvist — nøkkelhåndtering blir DB-intern kompleksitet.)*
3. **Supabase Vault** — PG extension `pgsodium` + Supabase's `vault` schema. Key-value store med column-level kryptering. *(Valgt.)*

## Decision Outcome

Chosen option: **"Supabase Vault"**, fordi det gir kryptert, roterende, auditet per-workspace storage uten å introdusere ekstern avhengighet.

**Implementasjon:**

1. `billing_integration.config.auth_ref` lagrer `vault_secret_id` (ikke rå tokens)
2. Ved OAuth success: write to Vault via `vault.create_secret()` → returnerer UUID
3. Runtime resolution i adapter:
   ```ts
   async function resolveWorkspaceToken(integration: BillingIntegration) {
     const vaultId = integration.config.auth_ref;
     // Query vault schema via service role
     const { data } = await supabase.rpc('vault_decrypted_secrets', { secret_id: vaultId });
     return JSON.parse(data.decrypted_secret);
   }
   ```
4. Refresh flow: adapter catches 401 → refresh_token grant → write new tokens back to same vault_id
5. Retention: tokens slettes når `billing_integration` deletes (triggered via DELETE cascade eller eksplisitt `vault.delete_secret` call)

**RLS:** ingen direkte access for workspace-admin (bare platform-admin + service_role). Adapter kjører via service_role i Edge Function / Edge-like context.

**Audit:** hver `vault_decrypted_secrets` RPC-call logges via trigger til `billing_activity_log` som `integration_token_read` event.

**Prerekvisitt:** Supabase Vault må være enabled i Supabase Cloud-instansen. Dette er ett konfig-flag; sjekk `SELECT * FROM pg_extension WHERE extname = 'supabase_vault'` før B1-implementasjon.

## Rules & Consequences

- **Good, because** per-workspace, per-integration isolasjon på dataplanet
- **Good, because** Supabase-native — ingen ekstern avhengighet utover det prosjektet allerede bruker
- **Good, because** rotation er transparent for workspace-admin (happen via refresh_token grant i adapter)
- **Bad, because** Vault legger til en runtime RPC-call per adapter-use (ytelsespåvirkning minimal — ms)
- **Bad, because** service_role trengs for Vault reads → adapter kjøring må alltid være i serverside kontekst (aldri client)
- **Agent Impact:** Ingen adapter kode kan lese tokens direkte fra `billing_integration.config` — MÅ gå via `resolveWorkspaceToken()` helper. Client-side kode kan aldri nå Vault. B1 må include Vault-enabled-check + helper function; B2+B3 adapters bruker helperen.

---

> Register in `docs/decisions/0000-decision-log.md`.
