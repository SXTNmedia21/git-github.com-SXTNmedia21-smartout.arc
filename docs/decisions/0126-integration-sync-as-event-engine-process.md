---
title: "Integration Sync as Event Engine Process, Not Parallel Motor"
id: ADR-0126
status: accepted
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-17
---

# ADR-0126: Integration Sync as Event Engine Process, Not Parallel Motor

## Context and Problem Statement

Billing Fase 2 (spec rev 1) foreslo en dedikert `billing_integration_sync`-tabell med eget `status`/`attempts`/`next_retry_at`-felt, orkestrert av en ny `dispatch-retry-scan` Edge Function på pg_cron. Dette ville opprette en parallell workflow-motor inne i billing-domenet — samme semantikk som `engine_process` + `engine_state` + `engine_delayed_trigger` allerede leverer på plattformnivå. Council-syntese 2026-04-17 (Agent Coordinator code-trace) avdekket dette som et brudd på CLAUDE.md-regelen *"No mutation without emit. No second event system."*

## Decision Drivers

- **Platform integritet:** `engine_process` er den kanoniske workflow-runtimen. Dupliserte retry-state-maskiner drifter over tid og skaper vedlikeholdsgjeld.
- **Audit konsistens:** `engine_state` + `engine_state_step` har allerede etablert tracking + cleanup-policy. Parallell tabell ville måtte replikere dette.
- **Eksisterende primitiver:** `engine_delayed_trigger` + `fire-delayed-triggers` Edge Function løser eksponentiell backoff i dag. Ingen grunn til å re-implementere.
- **CLAUDE.md-lov:** "No second event system" er eksplisitt forbud — ikke en guideline.

## Considered Options

1. **Parallell motor** — `billing_integration_sync` tabell + `dispatch-retry-scan` Edge Function. Isolert fra plattformens workflow-system. *(Avvist.)*
2. **Subsum i Event Engine** — bruk `engine_process` med ny `action_type = 'sync_integration'` handler. Ingen nye orkestreringstabeller, kun config-tabell `billing_integration`. *(Valgt.)*
3. **Hybrid** — config + audit-tabell i billing, orkestrering i engine. Ville delvis duplisere state. *(Avvist — mer kompleksitet, samme rot-problem.)*

## Decision Outcome

Chosen option: **"Subsum i Event Engine"**, fordi det respekterer platformens workflow-prinsipp, eliminerer state-duplisering, og gjør Fase 3-utvidelser (Stripe Connect, bidirectional sync) til naturlige engine_process-definisjoner i stedet for nye motorer per integrasjon.

**Konkret implementering (Fase 2, B1-B2):**

1. **Ny `engine_process` blueprint** seedes: `integration_sync` med trigger_events `['customer created', 'invoice generated', 'invoice issued', 'contract signed', 'contract terminated']`. Action_type `sync_integration` med retry-konfigurasjon (max 5, eksponentiell backoff 1m/5m/15m/1h/6h).
2. **Ny action_type handler** i `supabase/functions/engine-dispatch/index.ts`: `sync_integration` leser `billing_integration`-raden via payload-id, kaller riktig adapter via `IntegrationAdapter.sync()`, oppdaterer `billing_integration.last_sync_at` + `last_sync_status`, skriver til `billing_activity_log`, emitter `integration sync succeeded | failed | mocked`.
3. **Retry** via eksisterende `engine_state.retry_count` + `engine_delayed_trigger` + `fire-delayed-triggers` Edge Function. Ingen ny Edge Function opprettes.
4. **Kun én ny tabell** i Fase 2 Spor B: `billing_integration` (config registry, ikke runtime-state).

**Invoice_dispatch forblir separat (IKKE subsumert):** Dispatch-per-kanal har distinkt per-resipient-lifecycle og trackes i `invoice_dispatch`-tabellen. Men selve *orkestreringen* bruker samme mønster: ny `action_type = 'dispatch_invoice'` + `invoice_dispatch_delivery` engine_process. `invoice_dispatch.engine_state_id` FK kobler rad til workflow-instans.

## Rules & Consequences

- **Good, because** ingen parallell workflow-motor å vedlikeholde; Fase 3 Stripe/Fiken-adaptere plugger inn uten skjema-endringer
- **Good, because** audit-kjede bevares gjennom `engine_state` + `engine_state_step` — debug-verktøy for engine fungerer allerede
- **Good, because** retry-policy (backoff, max-attempts) konfigureres deklarativt i `engine_process`-blueprint, ikke hardkodes per feature
- **Bad, because** krever at billing-utviklere forstår `engine_process`-modellen — læringskurve
- **Bad, because** debug krever traversal av engine_state → engine_state_step → billing_integration — mer indirection enn en flat sync-tabell
- **Agent Impact:** Alle fremtidige billing-integrasjoner MÅ rutes via `engine_process`. Ved code-review: "legger du retry/backoff-state utenfor `engine_state`? Forklar hvorfor eller avvis." B1 må inkludere pgTAP-test som asserter at `billing_integration_sync`-tabellen ikke eksisterer.

---

> Register in `docs/decisions/0000-decision-log.md` and update CLAUDE.md's ADR table.
