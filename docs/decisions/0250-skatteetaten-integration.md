---
title: "Skatteetaten Integration — Sertifisering, Credential Management, Reconciliation, Failure Handling"
id: ADR_0250
status: proposed
layer: decision
created: 2026-04-30
updated: 2026-04-30
supersedes: []
relates_to:
  - ADR_0241
  - ADR_0242
  - ADR_0077
  - ADR_0078
  - ADR_0186
  - ADR_0039
  - ADR_0004
---

# ADR-0250: Skatteetaten Integration — Sertifisering, Credential Management, Reconciliation, Failure Handling

## Context and Problem Statement

Phase 7 of `docs/plans/PLAN-contract-employee.md` (Tripletex push-sync + audit polish) cannot
be production-deployed without an authoritative tax-data source for `employee_payroll_profile`.

`docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md` §"Felt-klassifisering"
lines 172-174 classifies three columns as **DERIVED** — meaning they must come from Skatteetaten,
not from user input:

| Column | Classification | Source (verbatim) |
|--------|----------------|-------------------|
| `tax_table_number` | DERIVED | "Hentes fra Skatteetaten API" |
| `tax_card_type` | DERIVED | "Skatteetaten" |
| `tax_percentage` | DERIVED | "Skatteetaten" |

Migration `supabase/migrations/20260519100100_contracts_module_foundation.sql` lines 495-524
adds these columns and the `tax_card_type` enum (`percentage | table | freecard`) plus
`tax_card_fetched_at timestamptz` and `tax_card_year smallint`. The columns exist in the
schema. They are nullable. They have no authoritative source yet.

`docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md` §"Åpne
spørsmål" line 233 explicitly deferred: *"Skatteetaten-integrasjon: hvilken
sertifiserings-løype, og hvem håndterer feilet skattekort-respons?"*

ADR-0242 (`0242-contract-payroll-capability-split.md`) establishes the `payroll` capability
as the sole channel for High-PII payroll data. Tax card data is explicitly in scope:
capability allocation table row `payroll` lists `query_tax_card` and `view_tax_table` as
target tools. This ADR is a prerequisite before those tools can be implemented correctly.

Without this ADR, the Skatteetaten integration has no certification path, no credential-
management policy, no failure-mode specification, and no legal basis documentation. Shipping
a live payroll calculation against manually entered tax-table numbers exposes Smartout to
compliance liability under Skattebetalingsloven kap. 5 (trekkplikt) if the wrong rate is
applied.

### Legal basis

Processing tax-card data is required for compliance with:

- **Skattebetalingsloven kap. 5** — arbeidsgiver har lovpålagt trekkplikt. The employer
  must apply the correct tax rate published by Skatteetaten or face legal liability for
  undertrekkede skattebeløp.
- **Aml. §14-6 bokstav g** — lønn skal fremgå skriftlig. Correct lønn computation requires
  correct skattesats.
- **GDPR Art. 9(2)(b)** — processing is necessary for obligations under employment law and
  social security law ("nødvendig for å oppfylle forpliktelser [...] innenfor arbeidsrett,
  trygde- og sosiallovgivning"). Personnummer is required to look up the tax card — this is
  the legal basis for transmitting fnr to Skatteetaten.

Data minimisation principle (GDPR Art. 5(1)(c)): only the tax-card fields returned by the
API endpoint are stored. No full Skatteetaten response is cached beyond the five fields
(`tax_table_number`, `tax_card_type`, `tax_percentage`, `tax_card_fetched_at`,
`tax_card_year`). The personnummer transmitted to Skatteetaten is never persisted in plaintext
(ADR-0077 §Storage rules line 66-67: `profile.personal_number` stored via pgsodium).

### Retention

Bokføringsloven §13 establishes a five-year retention requirement for regnskapsmateriale,
measured from the end of the *regnskapsår* in which the record was created — not from
`terminated_at`. This was clarified in ADR-0241 §Lovsen Amendments item 7 (lines 83-84).
Tax-card snapshots that feed lønnskjøring are regnskapsmateriale. The retention policy for
`employee_payroll_profile.tax_card_fetched_at` and any snapshot table is therefore:
**retain until `regnskapsår_slutt + 5 år`**, then anonymise or delete per GDPR Art. 17.

---

## Decision Drivers

- ADR-0001-contract-service lines 172-174: DERIVED classification of tax fields is load-bearing
- ADR-0241 §Consequences point 2: "Skatteetaten-integrasjon er en go-live-blocker for produksjon"
- ADR-0242: `payroll` capability owns tax-card tools; tools cannot be implemented safely without
  this ADR specifying the write path
- ADR-0077: personnummer is Høy-sensitivity; transmission to Skatteetaten must follow the
  no-echo + pgsodium rules
- ADR-0078 Layer 1-3 channel restriction: tax fields are chat-only; the fetch must originate
  server-side, never client-side
- ADR-0039 (`0039-infra-consolidation.md`): workspace-scoped data endpoints route through
  workspace-api Edge Function; Skatteetaten is platform-triggered (per profile) so needs
  a dedicated service function
- `docs/protocols/SECURITY.md` §2.2 Tier 2: external API secrets go in Supabase Vault
  (pgsodium, AES-256-GCM); never in code or plaintext env vars
- `docs/protocols/SECURITY.md` §Vault Naming: two vaults — `smartout_ai` (dev/preview),
  `smartout_ai_prod` (production)
- Stage Engine `services/stage-engine/src/secrets.ts`: established pattern for Vault-first
  with env-var fallback (acceptable for dev, not for production TLS client certificates)
- ADR-0186 (`0186-guardian-bus-pg-notify.md`): guardian fanout for platform-admin
  notifications; certificate expiry and persistent API failures must route here

---

## Considered Options

### A. Credential management

**A1 — 1Password vault `smartout_ai_prod` + `op://` reference, injected into Edge Function
via Vercel/Supabase env sync at deploy time.**

Credentials never in code. Cert file path referenced as `op://smartout_ai_prod/Skatteetaten
Production Cert/cert_path`. Runtime reads from env var that was populated by `op run` at
deploy. Consistent with existing `docs/protocols/SECURITY.md` §3 workflow and
`infra/scripts/sync-env-to-vercel.sh` NUKE-AND-REPLACE pattern.

Limitation: TLS client certificates (`.p12` / `.pem`) cannot be injected as env var values
— they are binary blobs. The certificate file must be stored as a Base64-encoded secret in
1Password, decoded into a temp file (or kept in memory) at function startup.

**A2 — pgsodium (Postgres Vault extension) encrypted at rest, decrypted via service role.**

`vault.secrets` table stores cert bytes. Edge Function calls `SELECT vault.decrypted_secrets`
via service role. Consistent with Tier 2 pattern in `docs/protocols/SECURITY.md` §2.2.

Limitation: Supabase Vault (`vault_secret_name` pattern, confirmed in
`packages/supabase/src/database.types.ts` line 13312) is designed for small string secrets,
not binary certificate files. Cert rotation requires a migration or an RPC — adds operational
complexity with no security benefit over 1Password for this use case.

**A3 — Supabase managed secrets via `delete_vault_secret`/`vault_secrets` RPC surface
(`database.types.ts` line 19540, 16282).**

Same as A2 but managed via Supabase dashboard rather than pgsodium directly. Same limitations.

**Decision A: Option A1 — 1Password vault `smartout_ai_prod` with Base64-encoded cert +
password as two separate items. Edge Function reads at cold start, decodes, builds TLS
context. No cert bytes in code, logs, DB columns, or prompts.**

A2/A3 are correct for API keys (Ultravox, OpenRouter — see `secrets.ts` lines 21-38) but
wrong for binary TLS certificates. The existing Vault pattern handles string secrets; extending
it for binary blobs is unnecessary complexity. 1Password is already the master credential
store per SECURITY.md.

Rejected A2/A3: Supabase Vault is not a certificate store. Binary blobs require workarounds
(base64-in-text column) that provide no auditability benefit over 1Password, which already
has rotation reminders, access logs, and expiry fields built in.

### B. Where the Skatteetaten call runs

**B1 — New dedicated Edge Function `supabase/functions/skatteetaten-fetch/index.ts`.**

`verify_jwt = false` in config.toml (consistent with `heartbeat-dispatcher`, `stripe-webhook`,
`tariff-amendment-sweep`). Auth is: inbound call must carry a signed workspace-api HMAC or
service-role bearer token (internal-only trigger). Outbound call uses TLS client certificate
from 1Password (Option A1). No browser client ever calls this function directly.

**B2 — Extend `workspace-api` gateway.**

ADR-0039 + workspace-api is the pattern for workspace-scoped data endpoints. Skatteetaten
lookup is triggered per `profile_id` (workspace-scoped) but its credential surface is
platform-level. Adding cert-management + Skatteetaten auth into workspace-api couples the
gateway to a single external system with strict certification requirements. Blast radius:
workspace-api handles all data mutations; a cert expiry or Skatteetaten outage must not
degrade the entire gateway.

**Decision B: Option B1 — Dedicated `supabase/functions/skatteetaten-fetch/index.ts`.**

Isolation principle: Skatteetaten's availability and certification lifecycle must not
contaminate the workspace-api availability SLA. Internal-trigger-only (no public surface).

### C. Sertifisering path

Skatteetaten Skattekort-API requires:

1. Registration as developer/integrasjonspartner at `skatteetaten.no/samarbeidspartnere`
2. Test environment access (Skatteetaten testmiljø) with synthetic test data
3. Production certification after integration test

Owner decision: **Pontus Lindroth (CEO)** signs the sertifisering paperwork and is the
named integrasjonspartner. If a DPO is appointed before go-live, the DPO role is documented
in the sertifisering application. This out-of-band registration is a go-live prerequisite
— it cannot be automated and must be tracked outside codebase.

Certificates issued by Buypass or Commfides (Norwegian qualified certificate authorities)
have a 2–3 year validity period. Renewal tracking: 1Password item for the cert MUST include
an expiry date field. The `skatteetaten.cert_expiring_soon` telemetry event (see §Telemetry)
fires 60 days before expiry; `skatteetaten.cert_expired` fires on first failed call.

Environment split:

| Environment | Cert type | Skatteetaten endpoint |
|-------------|-----------|----------------------|
| Local dev + Supabase Local | No real cert — mock fixture response | Mock handler in Edge Function |
| Supabase Preview branch | Test cert (Skatteetaten testmiljø) | Test environment API |
| Production (Supabase Cloud) | Production cert | Production Skattekort-API |

The mock/test/prod distinction is controlled by env var `SKATTEETATEN_ENV` set to
`mock | test | production`. Mock mode returns a canned fixture. This is consistent with the
`ENVIRONMENT` pattern used by other Edge Functions.

### D. Reconciliation loop

Tax cards are issued per **kortår** (calendar year). The primary trigger is 1. januar each
year. Additional triggers:

| Trigger | Mechanism | Notes |
|---------|-----------|-------|
| Annual (1. januar) | pg_cron job (`IF EXISTS pg_cron` guard per `20260406150100_guardian_signal_push_trigger.sql` line 23) | Bulk pull for all active profiles in workspace |
| On-demand (contract activation) | `engine_event` consumer in `skatteetaten-fetch/` | When `employment_contract.status` transitions to `active` |
| On-demand (admin request) | `payroll` capability tool `query_tax_card` | Manual refresh from HR tab |
| Tariff renegotiation | Deferred — tracked in PLAN-contract-employee.md §Risks #2 | Out of scope for this ADR |

**Storage decision:** Tax-card data is stored directly in `employee_payroll_profile` via the
five existing columns (confirmed in migration `20260519100100_contracts_module_foundation.sql`
lines 495-499 and `database.types.ts` lines 7293-7297). A separate
`employee_tax_card_snapshot` timeline table is deferred to Cycle 4+ — this ADR is Phase 7
scope. The `tax_card_year smallint` column already provides cortège identification (which
kortår the fetched data belongs to); stale detection is based on `tax_card_year !=
EXTRACT(YEAR FROM CURRENT_DATE)` at payroll-computation time.

**Why not a separate snapshot table now:** The migration already landed the five columns.
Adding a snapshot table in the same phase requires a capability migration, RLS additions, and
a new query path — all without a consumer in scope. Deferred explicitly; this ADR documents
the deferral so Cycle 4 can pick it up with context.

### E. Failure handling

Every failure mode maps to a specific `engine_event` action type and a guardian signal per
ADR-0186 (`0186-guardian-bus-pg-notify.md`). The guardian bus delivers to platform-admin
monitoring. No failure mode results in silent data corruption.

| Failure | Classification | Action | Payroll gate |
|---------|----------------|--------|--------------|
| 404 — employee not registered at Skatteetaten | WARN | Emit `skatteetaten.fetch_failed` with `reason: not_registered`. Set `tax_card_type = NULL`, `tax_card_fetched_at = now()` so the failure is recorded. Notify workspace admin via guardian signal. | **Block** payroll computation for this profile until resolved. Admin must override with documented reason. |
| 503 / 500 — Skatteetaten unavailable | TRANSIENT | Retry 3x with exponential backoff (2s, 8s, 32s). If all fail, emit `skatteetaten.fetch_failed` with `reason: api_unavailable`. Use last-known-good snapshot if `tax_card_year = CURRENT_YEAR`. | **Warn** if snapshot is current year; **Block** if snapshot is prior year. |
| 401 / 403 — invalid or expired certificate | CRITICAL | Emit `skatteetaten.cert_expired`. Guardian signal routed to platform-admin (ADR-0186 fanout). Page Pontus immediately via Telegram bot (existing `telegram_bot_token` secret in Vault). | **Block all payroll** until cert renewed. Not workspace-isolated — affects platform. |
| Stale tax card (fetched_year < current year) | WARN | Detect at payroll-computation time via `tax_card_year != EXTRACT(YEAR FROM CURRENT_DATE)`. Trigger on-demand refresh. If refresh fails, block with explicit error. | **Block** if stale year and refresh fails; **Warn** if stale year and refresh is in-flight. |
| Timeout (> 30s) | TRANSIENT | Treat as 503. Same retry + fallback logic. 30-second timeout is the outer bound — Skatteetaten SLA is typically < 5s. | Same as 503. |

**Failure handling implementation contract:**

All failure paths MUST:
1. Emit the appropriate `skatteetaten.*` telemetry event (see §Telemetry)
2. Write a record to `activity_trail` (audit path — never silent)
3. NOT leave `tax_card_type = NULL` without `tax_card_fetched_at` being updated —
   NULL + stale `fetched_at` is ambiguous; NULL + current `fetched_at` means "tried and
   failed today"
4. Return a structured error to the caller (not a generic 500)

---

## Decision Outcome

**Decisions taken by this ADR:**

| ID | Decision |
|----|----------|
| SK-A | Credentials: 1Password `smartout_ai_prod` vault, Base64-cert + password as two named items. Edge Function decodes at cold start. |
| SK-B | Runtime: dedicated `supabase/functions/skatteetaten-fetch/index.ts`, verify_jwt=false, internal-trigger-only. |
| SK-C | Sertifisering owner: Pontus Lindroth (CEO). Test + prod environment split via `SKATTEETATEN_ENV` env var. Cert renewal tracked in 1Password with expiry field. |
| SK-D | Reconciliation: annual pg_cron (1. januar) + on-demand triggers (contract activation, admin request). Storage in existing `employee_payroll_profile` columns. `employee_tax_card_snapshot` timeline table deferred to Cycle 4+. |
| SK-E | Failure modes: 5 explicitly mapped; all block or warn payroll; none silent. Guardian bus (ADR-0186) used for platform-admin notification. |
| SK-F | Legal basis: GDPR Art. 9(2)(b) for personnummer transmission. Bokføringsloven §13 retention = `regnskapsår_slutt + 5 år`. |
| SK-G | Telemetry: 5 new events in `payroll.*` namespace (see §Telemetry). PostHog receives no amounts/rates — high-level only. |

---

## Rules & Consequences

### Immediate (Phase 7 prerequisites)

- **New 1Password item required:** `smartout_ai_prod` → "Skatteetaten Production Cert". Fields:
  `cert_base64` (PEM encoded, base64), `cert_password`, `cert_expiry_date` (ISO-8601),
  `issuing_ca` (Buypass or Commfides), `org_number` (Smartout AS). Pontus creates this
  out-of-band after sertifisering.
- **New env var required:** `SKATTEETATEN_ENV` (`mock | test | production`) in `.env.template`
  as `op://smartout_ai_prod/Skatteetaten Config/env`. `SKATTEETATEN_CERT_B64` and
  `SKATTEETATEN_CERT_PASSWORD` as `op://` references. Never raw values.
- **New Edge Function file:** `supabase/functions/skatteetaten-fetch/index.ts`. Registered
  with `verify_jwt = false` in `supabase/config.toml`. Internal auth via service-role bearer.
- **pg_cron migration required:** Annual reconciliation job, guarded by
  `IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')` pattern from
  `supabase/migrations/20260406150100_guardian_signal_push_trigger.sql` lines 21-25.
- **Telemetry registration required:** 5 new events (see §Telemetry) in
  `packages/telemetry/src/registry.ts` under `payroll.*` namespace before first merge.
- **Pontus out-of-band action:** Register Smartout AS as Skatteetaten integrasjonspartner
  at `skatteetaten.no/samarbeidspartnere` and request testmiljø access. Cannot be delegated
  to code.

### Architectural constraints for build agents

- **NEVER call Skatteetaten from browser or mobile.** ADR-0078 Layer 1-3 channel restriction
  applies: tax fields are `allowedChannels: ["chat"]`; the fetch itself is system-channel only.
  The Edge Function is the only valid call site. ADR-0077 no-echo rule applies: the
  personnummer used for the lookup must NOT be logged, stored in `engine_memory`, returned
  to LLM context, or echoed in tool responses.
- **The payroll capability `query_tax_card` tool** triggers a refresh call to
  `skatteetaten-fetch/` via an internal signed request, then reads the updated
  `employee_payroll_profile` row. It does NOT call Skatteetaten directly. This preserves
  the capability/service boundary.
- **workspace_id isolation:** Every call to `skatteetaten-fetch/` must carry a
  `profile_id` that resolves to a workspace via `profile.workspace_id`. Fail fast on
  row-not-found (per L-0177 anti-pattern: `wizardRow?.workspace_id` with no else-branch is
  forbidden). Return 400 with explicit error — never fall back to JWT-default workspace.
- **No amounts or tax rates in PostHog.** Telemetry routes:
  `skatteetaten.fetch_succeeded` → Logger + activity_trail + engine_event only. PostHog
  receives the event name and `is_success: boolean` only. GDPR data-minimisation.
- **Supabase Vault (pgsodium) is NOT used for the Skatteetaten TLS certificate.** The
  existing `get_secret` RPC pattern (`services/stage-engine/src/secrets.ts` lines 21-38)
  is used for string API keys (Ultravox, OpenRouter). TLS cert bytes belong in 1Password.
  Do not extend the Vault pattern to binary blobs.

### Telemetry

Five new events to register in `packages/telemetry/src/registry.ts` under the `payroll.*`
namespace (consistent with existing `payroll.tax_card_queried` at line 6025 and
`payroll.set_pension_scheme` at line 6013):

| Event name | Destinations | Properties |
|------------|--------------|------------|
| `skatteetaten.fetch_initiated` | Logger + activity_trail | `profile_id` (non-empty), `tax_card_year: number`, `trigger: 'annual' \| 'contract_activation' \| 'admin_request'` |
| `skatteetaten.fetch_succeeded` | Logger + activity_trail + engine_event | `profile_id`, `tax_card_year: number`, `tax_card_type: TaxCardType` (enum value only — not rate/table number) |
| `skatteetaten.fetch_failed` | Logger + activity_trail + engine_event | `profile_id`, `tax_card_year: number`, `reason: 'not_registered' \| 'api_unavailable' \| 'cert_invalid' \| 'timeout'`, `http_status: number \| null` |
| `skatteetaten.cert_expiring_soon` | Logger + activity_trail + engine_event + PostHog | `days_until_expiry: number`, `cert_expiry_date: string` (ISO-8601 date, no time) |
| `skatteetaten.cert_expired` | Logger + activity_trail + engine_event + PostHog | `cert_expiry_date: string` |

PostHog inclusion for cert events only: cert expiry is not personal data and its detection
is operationally critical. The two cert events are the only `skatteetaten.*` events routed
to PostHog.

Naming: dot convention per L-0129 (`skatteetaten.*` not `skatteetaten_fetch_*`). Consistent
with `payroll.*`, `contract.*`, `engine.*` namespaces already in registry.

ADR-0193 NonEmptyString brand applies to `profile_id` in all skatteetaten events — build
agents must verify `profile_id` is non-empty before calling `emit()`.

### Consequences for downstream ADRs

- **ADR-0242:** `payroll` capability `query_tax_card` tool can now be implemented. Tool calls
  `skatteetaten-fetch/` internally. Tool contract: `allowedChannels: ["chat"]`, `min_role:
  'admin'`, ADR-0151 forgery defence (profile_id workspace membership verified server-side).
- **PLAN-contract-employee.md Phase 7:** Tripletex push-sync can include `tax_table_number`
  and `tax_card_type` in the employee payload once `skatteetaten-fetch/` is operational.
  The sync must NOT push NULL tax fields — add a pre-sync guard.
- **Cycle 4+ (out-of-scope here):** Author migration adding `employee_tax_card_snapshot`
  timeline table with `(profile_id, tax_card_year)` unique constraint, RLS on `workspace_id`
  (denormed via `profile.workspace_id` JOIN or trigger), and retention trigger for
  `regnskapsår_slutt + 5 år`.

### Good consequences

- Phase 7 Tripletex push-sync has a real, auditable tax-data source.
- GDPR Art. 9(2)(b) basis is explicitly documented and linked to the data flow.
- Certificate expiry is monitored proactively; no silent cert rot.
- Failure modes are exhaustive and all route to platform-admin visibility (ADR-0186 fanout).
- All tax fields remain DERIVED — no manual input path is ever opened.

### Bad consequences (accepted trade-offs)

- Skatteetaten sertifisering is a manual out-of-band prerequisite; cannot be automated or
  CI-gated. Go-live is blocked until Pontus completes registration.
- Annual pg_cron bulk-pull introduces a once-per-year load spike (all profiles in platform).
  Mitigation: batch fetch with per-workspace cursor, 50ms sleep between requests to stay
  within Skatteetaten rate limits.
- `employee_tax_card_snapshot` deferral means there is no audit trail for year-over-year
  tax-card changes until Cycle 4. The `tax_card_fetched_at` + `tax_card_year` pair provides
  minimal provenance for the most recent fetch only.
- Binary cert management (Base64 in 1Password) is operationally less ergonomic than a
  secret manager with native cert support. Accepted: adding a dedicated cert store (HashiCorp
  Vault, AWS ACM) is disproportionate to the current scale.

---

## Open Questions

1. **Multi-arbeidsgiver edge case:** If an employee has two active `employment_contract` rows
   (ADR-0001-contract-service D2 — parallel contracts allowed) under two different workspace
   IDs, Skatteetaten issues one tax card per fnr. Which workspace triggers the fetch and
   "owns" the result? Current answer: the workspace that calls `query_tax_card` gets the
   authoritative data; the other workspace will need its own fetch. Coordination between
   workspaces is out of scope (PLAN §Risks #6). Needs its own ADR if multi-arbeidsgiver
   becomes a real use case.

2. **A-melding rapportering:** Tax-card data feeds Tripletex (Phase 7). Tripletex handles
   A-melding to Skatteetaten/Altinn. Smartout does not submit A-melding directly. The handoff
   point is the Tripletex sync — tax fields are part of the employee payload. Documented here
   as a boundary, not a decision gap. A-melding kode 111-A for tips is an ADR-0241 §item 9
   concern (separate from tax-card fetch).

3. **Sjømenn / luftpersonell special tax regimes:** These groups have different
   trekkpliktsregler (e.g., Skattebetalingsloven §5-4 sjøfolk). Out of scope for Phase 7.
   Flag: if these employee categories are ever onboarded, the `skatteetaten-fetch/` handler
   must route to the correct API variant. ADR required before onboarding these categories.

4. **Lærling tax handling:** ADR-0241 §Lovsen Amendments item 5 flags apprentice contracts
   as requiring their own ADR (Opplæringsloven kap. 4). Apprentices may have lower tax rates
   in some cases. Interaction with this ADR: the tax-card fetch path is identical; however,
   the payroll computation that consumes the result must handle apprentice-specific edge cases.
   Track in future ADR-0249 (legal capability, fifth sibling) if it covers Opplæringsloven.

5. **DPO-rolle:** GDPR Art. 37 DPO requirement for organisations processing sensitive personal
   data at scale. Smartout AS should assess whether a DPO is required before production go-
   live with personnummer-based Skatteetaten calls. Out-of-band decision for Pontus. DPA
   (Datatilsynet) registration of the processing activity is required under GDPR Art. 30
   (records of processing activities). This ADR documents the processing activity; the
   formal registration is Pontus's responsibility.

6. **Rate limiting and SLA:** Skatteetaten's developer portal (`skatteetaten.no/api/` and
   the API documentation at `data.skatteetaten.no`) specifies rate limits for the Skattekort-
   API. These must be verified at sertifisering time and reflected in the bulk-fetch batch
   size (currently assumed 50 profiles per batch with 50ms sleep). If limits are lower,
   the pg_cron schedule and batch logic must be adjusted.

7. **Altinn signing for API access:** Some Skatteetaten API endpoints require an Altinn
   authorisation (delegation from company to system). Verify at registration time whether
   Skattekort-API requires Altinn delegation or ID-porten alone. If Altinn delegation is
   required, Pontus must perform the delegation in Altinn portal (out-of-band, non-automatable).

---

## References

| Reference | Location / URL |
|-----------|---------------|
| ADR-0001-contract-service (superseded, field classification) | `docs/architecture/contract-service/ADR-0001-kontrakt-og-lonnsprofil-fundament.md` lines 167-184 (DERIVED tax fields), lines 231-233 (deferred open question) |
| ADR-0241 (contract schema migration foundation) | `docs/decisions/0241-contract-schema-migration-foundation.md` §Consequences point 2, §Lovsen item 7 |
| ADR-0242 (contract/payroll capability split) | `docs/decisions/0242-contract-payroll-capability-split.md` capability allocation table + GDPR Art. 9 section |
| ADR-0077 (PII handling, no-echo rule) | `docs/decisions/0077-contract-intake-pii-handling.md` §Storage rules lines 66-67, §No-echo rule |
| ADR-0078 (channel restriction, 3-layer defence) | `docs/decisions/0078-engine-process-channel-restriction.md` §Layer 1-3 |
| ADR-0039 (infra consolidation, workspace-api gateway) | `docs/decisions/0039-infra-consolidation.md` |
| ADR-0186 (guardian bus pg LISTEN/NOTIFY fanout) | `docs/decisions/0186-guardian-bus-pg-notify.md` |
| ADR-0004 (unified telemetry) | `docs/decisions/0004-unified-telemetry-engine.md` |
| ADR-0193 (NonEmptyString brand for telemetry IDs) | `docs/decisions/0193-adr-0134-amendment-non-empty-string-brand-for-telemetry-ids.md` |
| L-0177 (fail-fast on row-not-found) | CLAUDE.md `docs/decisions/` §"What NOT to Do" |
| SECURITY.md §2.2 Tier 2 / Vault Naming | `docs/protocols/SECURITY.md` lines 58-64, lines 88-95 |
| Stage Engine secrets pattern | `services/stage-engine/src/secrets.ts` lines 21-38 |
| Tax column migration | `supabase/migrations/20260519100100_contracts_module_foundation.sql` lines 495-524 |
| Tax columns in database.types.ts | `packages/supabase/src/database.types.ts` lines 7293-7297, 20411 |
| Payroll telemetry entries | `packages/telemetry/src/registry.ts` lines 5993-6044 |
| pg_cron guard pattern | `supabase/migrations/20260406150100_guardian_signal_push_trigger.sql` lines 21-25 |
| PLAN-contract-employee.md Phase 7 + Risks #1 | `docs/plans/PLAN-contract-employee.md` lines 154-166, line 181 |
| Bokføringsloven §13 | Regjeringen.no — 5-year retention from end of regnskapsår |
| Skattebetalingsloven kap. 5 | Lovdata.no — employer withholding obligation |
| GDPR Art. 9(2)(b) | EUR-Lex — processing necessary for employment law obligations |
| Skatteetaten Skattekort-API documentation | `https://skatteetaten.github.io/datasamarbeid-api-dokumentasjon/` |
| Skatteetaten developer/partner registration | `https://www.skatteetaten.no/samarbeidspartnere/` |

---

> After writing: register in `docs/decisions/0000-decision-log.md`. Note: ADR-0247 is
> occupied (`0247-engine-state-schema-relaxation.md`). This ADR is numbered 0250 —
> the next free slot after 0249 (`0249-legal-capability-fifth-sibling.md`).
