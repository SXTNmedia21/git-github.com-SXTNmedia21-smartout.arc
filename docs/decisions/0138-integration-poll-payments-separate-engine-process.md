---
title: "integration_poll_payments as Separate engine_process from integration_sync"
id: ADR-0138
status: superseded
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-18
superseded_by: ADR-0139
superseded_reason: Fase 3B rescoped — ingen inbound-poll. Betalinger som kommer via regnskapsfører markeres manuelt i Smartout (platform-admin eller accountant-rolle). Stripe-betalinger dekkes av Fase 3A webhook. Automatisert poll av Fiken/Tripletex er ikke nødvendig i CSV-scope.
---

# ADR-0138: integration_poll_payments as Separate engine_process from integration_sync

## Context and Problem Statement

Fase 3B introduserer inbound payment poll: periodisk pull av betalinger fra Fiken/Tripletex for auto mark-paid av Smartout-fakturaer. Fase 2 (ADR-0126) etablerte `integration_sync` engine_process for outbound sync. Spørsmålet: bør poll være en ny engine_process, eller utvide `integration_sync` med en `operation='poll'` variant?

## Decision Drivers

- **Trigger semantikk:** outbound sync er event-triggered (`customer.created`, `invoice.issued`, ...). Poll er cron-triggered (`billing.integration_poll_tick`). Forskjellige trigger-modeller.
- **Direction:** outbound er per-entity (N rows per invoice.generated event). Poll er per-integration (1 row per integration per cycle, each returning N matches).
- **Retry semantikk:** outbound retry = re-send same entity. Poll retry = re-poll (idempotens ligger på vendor side).
- **Handler complexity:** overlasting `sync_integration` med poll-operasjon blandes to konseptuelle flyter.
- **Audit-synlighet:** separate engine_process navn gir ren filtrering i `engine_state` queries.

## Considered Options

1. **Extend `integration_sync` med `operation='poll'`** — én engine_process, sync_integration handler bruker en if/else i payload. *(Avvist — ontologisk rotete.)*
2. **New `integration_poll_payments` engine_process + new `poll_integration_payments` action_type** — full separasjon. *(Valgt.)*
3. **New process, existing sync_integration handler with poll-branch** — hybrid. *(Avvist — handler-kompleksitet uten god grunn.)*

## Decision Outcome

Chosen option: **"Full separasjon"**, fordi det respekterer trigger + direction + retry semantikk-forskjeller + gir rene audit-queries.

**Implementasjon:**

1. **Engine_process seeded i Fase 3B B1:**
   ```
   engine_process:
     - name: 'integration_poll_payments'
     - allowed_channels: ['autonomous']
     - trigger_events: ['billing.integration_poll_tick']
     - steps:
       1. action_type: 'poll_integration_payments'
          action_payload: { include_types: ['fiken', 'tripletex'] }
          retry: max 3, backoff 15m
   ```

2. **pg_cron schedule:** hver time → emit `billing.integration_poll_tick` event

3. **Ny action_type handler `poll_integration_payments`:**
   - Load enabled integrations where `integration_type IN (payload.include_types) AND is_placeholder = false`
   - For each: call `adapter.pollPayments(integration.last_poll_at)` (ny interface-metode, optional)
   - Per returned payment: match + auto mark-paid via Fase 3A's `reconcileInvoiceOnPayment`
   - Update `integration.last_poll_at`
   - Emit `integration poll_found_payment` (per match) + `integration poll_no_match` (per unmatched)
   - Return aggregate stats

4. **Adapter interface utvidelse:** `IntegrationAdapter.pollPayments?(since: Date): Promise<PollResult>` — optional. Placeholder og Stripe har den ikke; Fiken + Tripletex implementerer.

5. **Audit-query:** platform-admin kan filtrere `engine_state WHERE process_name = 'integration_poll_payments'` for å se poll-historikk separat fra outbound sync.

**Delte primitiver:**
- Samme `billing_integration` row
- Samme Supabase Vault auth_ref (per ADR-0136)
- Samme retry/backoff-pattern via `engine_delayed_trigger`
- Samme emit bridge

## Rules & Consequences

- **Good, because** trigger-semantikk matcher direction (cron vs event)
- **Good, because** audit-queries kan filtrere rent på process_name
- **Good, because** `pollPayments` optional → Stripe + Placeholder trenger ikke implementere (ikke poller)
- **Good, because** retry-policy kan være separat mellom outbound (per-entity) og poll (per-cycle)
- **Bad, because** to engine_process å vedlikeholde i stedet for én
- **Bad, because** handler-fil-count øker (men under 5 handlers totalt for billing)
- **Agent Impact:** `poll_integration_payments` handler lives in `supabase/functions/engine-dispatch/handlers/poll-integration-payments.ts` — samme pattern som Fase 2's `sync-integration.ts`. B3 eier denne fil. `IntegrationAdapter` type utvides med optional `pollPayments` i B1.

---

> Register in `docs/decisions/0000-decision-log.md`. Cross-link ADR-0126.
