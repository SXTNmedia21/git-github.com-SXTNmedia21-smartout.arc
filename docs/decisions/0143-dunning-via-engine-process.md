---
title: "Automated Dunning via engine_process, Not n8n"
id: ADR-0143
status: accepted
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-18
---

# ADR-0143: Automated Dunning via engine_process, Not n8n

## Context and Problem Statement

Billing Fase 3A automatiserer dunning (påminnelses-eskalering for forfalte fakturaer). Rev 1-spec foreslo n8n-workflow som leser fra Supabase og oppretter `invoice_dispatch`-rader. Council-syntese (Steward + Supervisor + Agent Coordinator) advarte: dette ville skape et parallelt workflow-system ved siden av eksisterende `engine_process` + `engine_delayed_trigger` + `fire-delayed-triggers` — samme feil som ADR-0126 etablerte forbud mot for integration-sync.

## Decision Drivers

- **CLAUDE.md-lov:** *"No mutation without emit. No second event system."*
- **ADR-0126 presedens:** Integration-sync ble subsumert i engine_process av samme grunn.
- **Monorepo coherence:** Billing-logikk bor i repo'et (med RLS + type-safety + CI coverage + telemetry). n8n skaper split ownership.
- **n8n's legitimate scope:** n8n beholdes for generisk workflow-orkestrering på tvers av SaaS-tools (Slack, email, etc.). Billing dunning er intern DB-mutasjon + intern email — hører hjemme i engine_process.

## Considered Options

1. **n8n-workflow** — Leser Supabase via REST API, oppretter invoice_dispatch-rader. *(Avvist.)*
2. **engine_process `dunning_escalation_scan`** — Ny blueprint, ny action_type handler, triggered av pg_cron. *(Valgt.)*
3. **Inline pg_cron function** — PL/pgSQL stored procedure kalt direkte fra pg_cron. *(Avvist — mindre observerbarhet, ingen engine_state-sporing, ingen retry/backoff-pattern.)*

## Decision Outcome

Chosen option: **"engine_process `dunning_escalation_scan`"**, fordi det respekterer universal workflow runtime + reproduserer ADR-0126 mønsteret for symmetri.

**Implementasjon:**

### 1. engine_process blueprint seedes i B1-migrasjon:

```
engine_process:
  - name: 'dunning_escalation_scan'
  - allowed_channels: ['autonomous']  -- per ADR-0078 alle engine_process må deklarere dette
  - trigger_events: ['dunning_daily_tick']
  - steps:
    1. action_type: 'scan_overdue_invoices'
       action_payload: {
         stages: [
           { days: 3, from: null, to: 'reminder_1', template: 'dunning_reminder_1' },
           { days: 7, from: 'reminder_1', to: 'reminder_2', template: 'dunning_reminder_2' },
           { days: 14, from: 'reminder_2', to: 'collection_notice', template: 'dunning_collection_notice' }
         ]
       }
       retry: max 3, backoff 5m/15m/1h
```

### 2. Ny action_type handler i `supabase/functions/engine-dispatch/index.ts`:

Case `'scan_overdue_invoices'`:
1. Les `action_payload.stages`
2. For hver stage: SELECT invoices hvor `(due_at < now() - stage.days * INTERVAL '1 day') AND status IN ('issued','sent','overdue') AND dunning_status = stage.from`
3. For hver invoice per stage:
   - INSERT `dunning_escalation_log (invoice_id, from_stage, to_stage)` ON CONFLICT (invoice_id, to_stage) DO NOTHING → idempotens
   - Hvis INSERT lyktes: UPDATE `invoice.dunning_status = stage.to`
   - Kall `enqueueDispatchesForInvoice(invoice_id, trigger_event='invoice dunning_escalated', template_key=stage.template)` fra @smartout/billing → Fase 2 dispatch-system håndterer resten
   - Emit `invoice dunning_escalated` event (data.from_stage, data.to_stage, data.invoice_id)
4. Return step_status='succeeded' med aggregert antall eskaleringer

### 3. pg_cron schedulerer dunning_daily_tick event:

```sql
SELECT cron.schedule(
  'smartout-dunning-daily',
  '0 8 * * *',  -- 08:00 hver dag
  $$ SELECT enqueue_engine_trigger('dunning_daily_tick', '{}'::jsonb) $$
);
```

`enqueue_engine_trigger` = helper som spawner engine_state matching trigger_events.

### 4. Workspace opt-out via eksisterende Fase 2 mekanisme:

Workspace-admin oppretter `billing_dispatch_rule` med `action='suppress'` + `trigger_event='invoice dunning_escalated'`. `effective_dispatch_rules()` (ADR-0127) filtrerer dispatches før de sendes. engine_process fortsetter å oppdatere `dunning_status` (intern tilstand) men ingen email går ut.

## Rules & Consequences

- **Good, because** én universal workflow runtime — billing følger samme mønster som integration-sync
- **Good, because** engine_state gir automatisk retry/backoff + observability + audit via eksisterende tooling
- **Good, because** workspace opt-out reuser Fase 2's dispatch_rule suppress-mekanisme — ingen ny primitiv
- **Good, because** dunning_escalation_log UNIQUE-constraint gir idempotens ved doble cron-kjøringer
- **Bad, because** pg_cron + engine_trigger roundtrip er mer indirection enn naken n8n
- **Bad, because** credential for å kjøre scan må være service_role (cron kan ikke holde JWT) — OK fordi allowed_channels='autonomous'
- **Agent Impact:** Alle fremtidige billing-automasjoner MÅ rutes via engine_process. Hvis noen foreslår n8n for billing-logikk, ADR-0126 + ADR-0143 + ADR-0078 blokkerer. n8n forblir i scope for eksterne SaaS-integrasjoner (GitHub → Slack, kalender-sync, etc.) — IKKE billing/cascade-intern work. B1 pgTAP-test asserter at `dunning_escalation_scan` engine_process-rad eksisterer og har `allowed_channels = ['autonomous']`.

---

> Register in `docs/decisions/0000-decision-log.md` and update CLAUDE.md's ADR table. Cross-link from ADR-0126.
