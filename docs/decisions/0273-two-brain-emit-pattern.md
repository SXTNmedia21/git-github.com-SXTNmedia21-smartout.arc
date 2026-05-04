---
title: "Two-Brain emit-pattern — workflow synchronous vs audit async outbox"
id: ADR_0273
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
depends_on:
  - ADR-0099 (unified authority gate)
  - ADR-0116 (activity_trail mutation audit)
  - ADR-0134 (mobile telemetry contract)
  - ADR-0180 (engine_event parity contract)
  - ADR-0274 (Mission Run Contract)
---

# ADR-0273: Two-Brain emit-pattern — Workflow Synchronous vs Audit Async Outbox

## Context and Problem Statement

Smartout har i dag én `emit()`-funksjon fra `@smartout/telemetry` som fanner til fire destinasjoner: PostHog (analytics), Logger (stdout), `activity_trail` (audit), `engine_event` (workflow). Disse fire destinasjonene har **ulike reliability-krav**:

**Workflow-brain (`engine_event`):**
- Cascade-trigger-fire er synchronous og deterministisk — et engine_process-steg som venter på `engine_event` MÅ se eventet i samme TX som mutasjonen
- Tap av `engine_event` betyr at cascade-workflow aldri trigges = silent bug
- Krav: **skrives i SAMME TX som mutasjon**

**Audit-brain (PostHog, Logger, `activity_trail`):**
- Analytics kan tape noen events uten katastrofe
- Logger taper ikke data (stdout er OK)
- `activity_trail` MÅ være eventual consistent, men trenger ikke synchronous
- Krav: **best-effort delivery, retry ved feil**

Dagens `emit()` gjør alt fire-and-forget. Etter en DB-write kan `engine_event` INSERT feile stille — cascade-workflow trigges aldri, men mutation skjedde. Dette er adressert som gap i STAGE-ENGINE.md §6.

## Decision Drivers

- Welcome Mission V0 trenger durable `engine_event` for stage-advance cascade
- Audit-data (PostHog, activity_trail) kan tåle retry-latens på sekunder
- `engine_event` kan ikke tåle retry-latens (cascade er deterministisk)
- Eksisterende `emit()` brytes ikke — to-brain er en ny mekanikk på toppen

## Considered Options

1. **Option A** — Alle fire via outbox (audit + workflow begge deferred)
2. **Option B** — Workflow sync i TX, audit via outbox (dette ADR)
3. **Option C** — Beholdende dagens fire-and-forget emit() for alt

## Decision Outcome

Chosen option: **"Option B"** — klar split mellom de to brainene.

## Teknisk beslutning

### Workflow-brain — synchronous

`engine_event` skrives i **SAMME DB-TX** som step-completion (eller mutation). Implementert via Supabase service-role INSERT i samme `await`-chain som mutation:

```typescript
// Eksempel: step completion + engine_event i samme TX
const { error: stepError } = await supabase
  .from("engine_session_step")
  .update({ status: "completed", completed_at: new Date().toISOString() })
  .eq("session_id", sessionId)
  .eq("stage_idx", stageIdx);

if (stepError) throw stepError;  // Rollback hvis step-update feiler

// engine_event i SAMME kode-flyt (ikke via outbox)
const { error: eventError } = await supabase
  .from("engine_event")
  .insert({
    workspace_id: workspaceId,
    event_type: "welcome.stage_advanced",
    // ...
  });

if (eventError) throw eventError;  // Rollback begge hvis event-insert feiler
```

Dette er ikke en DB-transaksjon i teknisk forstand (Supabase REST API støtter ikke BEGIN/COMMIT), men to-phase-commit-aktig via exceptions: hvis `engine_event`-INSERT feiler, kastes error og steg-update er allerede landed. **Merk:** True atomicity krever Postgres `BEGIN/COMMIT` via RPC — se OQ nedenfor.

### Audit-brain — async outbox

`activity_trail`, PostHog og Logger skrives via `engine_audit_outbox`:

```typescript
// Audit via outbox — ikke blokkerende
await supabase.from("engine_audit_outbox").insert({
  idempotency_key: crypto.randomUUID(),
  session_id: sessionId,
  workspace_id: workspaceId,
  destinations: ["activity_trail", "posthog"],
  event_name: "welcome.stage_advanced",
  payload: { /* ... */ },
  status: "pending",
});
// Flush-worker håndterer faktisk fanout asynkront
```

Flush-worker (`audit-outbox-flusher`) polles hvert 5s, leser `status='pending'`-rader, fanner til hver destinasjon, setter `status='flushed'`.

### Strengt forbud

`engine_event` er FORBUDT i `engine_audit_outbox.destinations`. Tabellnavn + COMMENT håndhever dette sosialt. Fremtidig: CHECK-constraint kan håndheve det teknisk.

### Invariant i kode

Ethvert sted som skriver til `engine_event` ETTER en async-delay (outbox, setTimeout, background job) = **bug klasse B** (phantom contract, silent cascade-miss). Code-reviewer sjekker dette som del av PR-review for alle stage-engine-endringer.

## Schema-endringer

Se `IMPLEMENTATION_SPEC_welcome_mission_v0.md` M5 for full SQL av `engine_audit_outbox`.

## Rules & Consequences

- **Good, because** cascade-workflow er deterministisk — `engine_event` kan aldri tapes etter step-completion
- **Good, because** audit-brain er retry-safe via outbox — ingen audit-tap ved PostHog-outage
- **Bad, because** to-phase-commit ikke garantert atomic (uten Postgres RPC) — `engine_event` kan feile etter step-update uten rollback av step. Se OQ under.
- **Bad, because** ny flush-worker er nødvendig (eller pg_cron job) for outbox-drain
- **Bad, because** `engine_audit_outbox`-tabellen legger til migrasjonskompleksitet
- **Agent Impact:** Alle nye capability tools og stage-engine-mutations MÅ enten (a) bruke eksisterende `emit()` for audit-only events, eller (b) for engine_event-kritiske events: INSERT `engine_event` SYNC i kode-flyten + INSERT `engine_audit_outbox` for audit-fanout. Aldri bruke outbox for `engine_event`.

## Åpent spørsmål (OQ)

**True atomicity:** Supabase REST API støtter ikke BEGIN/COMMIT. For sann atomicity mellom `engine_session_step` UPDATE og `engine_event` INSERT: implementer som Postgres RPC (SECURITY DEFINER-funksjon som gjør begge i én transaksjon). Dette er Phase A-arbeid og defer til etter V0. V0 bruker to-fase kode-flyt med exception-propagation som pragmatisk løsning.

## Implementation notes

- Flush-worker: `services/stage-engine/src/workers/audit-outbox-flusher.ts`
- Polling-interval: 5s (hardkodet i V0, konfigurerbar via `AUDIT_OUTBOX_FLUSH_INTERVAL_MS` i V0.1)
- Retry-policy: max 5 forsøk, exponential backoff, `status='failed'` etter max
- Monitoring: `GET /health` i stage-engine bør eksponere `pending_outbox_count` for alerting

## Migration strategy

M5 (`engine_audit_outbox`) er additive. Ingen eksisterende data endres.

---

> Etter skriving: registrer i `docs/decisions/0000-decision-log.md`
