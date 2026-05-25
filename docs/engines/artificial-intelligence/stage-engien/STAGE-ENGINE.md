---
title: Stage Engine — Sessions, Guardian, Whispers
status: in_progress
updated: 2026-05-25
created: 2026-05-04
module: stage-engine
tags: [architecture, stage-engine, guardian, whispers, sessions, agent-runtime, capability-bridge]
---

# Stage Engine

Verifisert mot kode på `development @ 3f6e657f` denne sesjonen. Filstier `path:linje` er datafyrt der relevant.

## TL;DR

Stage Engine er ett Hono-service (`services/stage-engine` på port 5010) som er den eneste runtime for agent-trafikk. Eier fire ting:

| Ansvar | Hovedtabell | Utad |
|---|---|---|
| Session-lifecycle | `engine_sessions` | REST + WS |
| Stage-navigasjon | `engine_stages` + `engine_missions` | Mission mode |
| Guardian-observability | `guardian_log` + WS | platform-admin |
| Recorder | `agent_session_recording` | Forensikk |

Guardian + Whispers + Sessions er ikke separate moduler — de er tre konsentriske lag rundt samme session-objekt:

```
       ┌──────────────────────────────────┐
       │  WHISPERS  (admin → session)     │  ← ord
       │  ┌─────────────────────────────┐ │
       │  │  GUARDIAN  (session → admin)│ │  ← syn
       │  │  ┌────────────────────────┐ │ │
       │  │  │  SESSION (engine core) │ │ │  ← kropp
       │  │  └────────────────────────┘ │ │
       │  └─────────────────────────────┘ │
       └──────────────────────────────────┘
```

Kropp = state. Syn = observability ut. Ord = supervisory in.

## 1. Stage Engine — service-flate

### Routes

| Route | Fil | Formål |
|---|---|---|
| `POST /sessions` | `routes/sessions.ts` | Opprett session (mission eller agent mode) |
| `POST /sessions/:id/advance` | `routes/advance.ts` | Manuell stage-advance (mission mode) |
| `GET /sessions/:id/fetch` | `routes/fetch.ts` | Hent session-state |
| `POST /store` | `routes/store.ts` | Skriv collected_data inn i session |
| `WS /ws` | `routes/ws.ts` | Live agent-WS (Ultravox/voice/chat) |
| `WS /guardian` | `routes/guardian.ts` | platform-admin overvåking + whisper-input |
| `POST /agent/chat` | `routes/agent/chat.ts` | Agent-mode chat (free-form, ingen mission) |
| `POST /agent/dispatch` | `routes/agent/dispatch.ts` | Tool-dispatch fra agent |
| `POST /adapters/ultravox` | `routes/adapters/ultravox.ts` | Ultravox webhook-bridge |
| `POST /adapters/telegram` | `routes/adapters/telegram.ts` | Telegram-bridge |
| `POST /internal/engine-dispatch/invoke-capability-tool` | `routes/internal/invoke-capability-tool.ts` | EF→Node bridge for `invoke_capability_tool` action (ADR-0424 §Transport) |
| `GET /health`, `GET /recorder-metrics` | `routes/health.ts`, `routes/recorder-metrics.ts` | Helse + observability |

### Workers (bakgrunnsjobber, startes i `index.ts`)

| Worker | Cadence | Formål |
|---|---|---|
| `expireStaleSession` | Periodisk | Marker `engine_sessions.status='expired'` etter `expires_at` |
| `cleanExpiredMemories` | Periodisk | TTL-purge `engine_memory` |
| `evaluateAllActiveSessions` | Hvert 120s (default, configurable via `GUARDIAN_INTERVAL_MS`) | Guardian-evaluator over alle aktive sesjoner |
| `evaluateCalendarTriggers` | Periodisk | Calendar-guardian — tidsstyrte triggere |
| `relayToTelegram` | Event-driven | Telegram-bridge fanout |
| `pgNotifyBus` | LISTEN-loop | Cross-instance Guardian-event fanout |
| `MissionPoolSlot` | Polling | Mission-spawn from queue |
| `SixtenOrchestrator` | Periodisk | Sixten-ops |

### Konsentrerte invariants

- **In-memory `SessionLane`** (`core/session-lane.ts`) serialiserer turn-handling per session — én tur av gangen for samme `session_id`. Kritisk for å unngå race på `collected_data` JSONB-merge.
- **Recorder singleton** (ADR-0184) initialiseres ved boot, satt globalt via `setRecorder()`. Alle hooks (prompt-builder, agent-router, authority, guardian, memory) skriver via `getRecorder()`. Fire-and-forget ring-buffer → `agent_session_recording`.
- **Multi-instance** stage-engine: Guardian-event-fanout via `pg_notify('guardian_events')` (ADR-0186). Hver instans LISTEN-er, parser, og fanout-er til sine egne WS-klienter.

### Internal capability-tool bridge (ADR-0424 §Transport)

Stage-engine exposes one internal route consumed only by the `engine-dispatch` Edge
Function. It is the Node-side half of the `invoke_capability_tool` action-type bridge.

**Why a bridge exists.** The dispatcher action `invoke_capability_tool` needs to execute
capability tool bodies that live in `packages/ai` (Node ESM). The dispatcher itself runs as
a Deno Edge Function (`supabase/functions/engine-dispatch/index.ts`) which cannot import
Node ESM. The EF therefore stays a thin proxy and HTTP-fetches into this route.

**Dispatch flow** (per ADR-0424 §Transport):

```
pg_cron / engine_trigger
        │
        ▼
engine-dispatch EF (Deno)
        │  1. Reads next engine_state_step (action_type = 'invoke_capability_tool')
        │  2. Recursion-depth check via partial index idx_engine_state_step_invoke_cap
        │  3. Resolves system-bot fallback for actor_profile_id (sanity hint only)
        │  4. POSTs to stage-engine internal route with x-api-key (scope engine:invoke)
        ▼
POST /internal/engine-dispatch/invoke-capability-tool (Node, this service)
        │  5. Re-derives workspace_id + actor_profile_id from engine_state row (ADR-0151
        │     cross-runtime extension — body values are sanity-check / hint only)
        │  6. Runs gate_action(workspace_id, capability, level)
        │  7. resolveCapabilityTool(capability, tool) (PR #477 shim)
        │  8. tool.execute(args, ctx)
        │  9. emit('engine.action.invoked.invoke_capability_tool', …) with
        │     actor_capability + delegated_via (ADR-0356 audit symmetry)
        │ 10. Returns { ok, result | error, gate_evaluation_id, duration_ms }
        ▼
engine-dispatch EF
       11. Persists gate_evaluation_id from response into engine_state_step row
       12. emit('engine.dispatch.bridge_invoked', …) — transport fact only,
           routes posthog+logger+activity_trail (NOT engine_event — Node already
           emitted the execution event, double engine_event would orphan-row)
```

**Key invariants:**

| Invariant | Enforced where | ADR |
|---|---|---|
| Recursion depth ≤ 1 (no `invoke_capability_tool` chains itself) | EF pre-check (partial index) + Node assert `depth === 0` | ADR-0424 §Recursion limit |
| Identity server-derived from `engine_state_id` | Node `deriveEngineStateContext()` | ADR-0151 §Cross-runtime extension |
| Gate runs on the side that owns the mutation audit row | Node (Gate placement co-located with `tool.execute()`) | ADR-0356, ADR-0424 §Gate placement |
| Two telemetry events for two distinct facts (execution + transport) | Node emits execution; EF emits transport | ADR-0424 §Telemetry split, L-0094 |
| EF auth via dedicated `STAGE_ENGINE_INTERNAL_KEY` scoped `engine:invoke` | Stage-engine `x-api-key` validator | ADR-0265, ADR-0424 §Env var contract |

**Future evolution.** The bridge is interim. ADR-0424 §Future evolution defers sortie **B6**
(engine-dispatch migration from Deno EF to Node service) which would let dispatcher
`import { resolveCapabilityTool }` directly. See
[`docs/plans/B6-ENGINE-DISPATCH-NODE-MIGRATION.md`](../../../plans/B6-ENGINE-DISPATCH-NODE-MIGRATION.md)
for scope.

## 2. Sessions — kropp

### Skjema (`engine_sessions`)

| Kolonne | Type | Notat |
|---|---|---|
| `id` | UUID PK | |
| `mode` | TEXT | `'mission'` \| `'agent'` (default mission) |
| `mission_id` | TEXT FK → `engine_missions.id` | NULL hvis mode='agent' (CHECK-constraint) |
| `journey_id` | UUID nullable | Mission-mode: lenke til journey for guardian-evaluator |
| `workspace_id` | UUID FK → workspace | Tenant-isolasjon |
| `user_id` / `profile_id` | UUID nullable | Hvem (auth.uid + profile) |
| `channel` | TEXT | `'voice'` \| `'sms'` \| `'chat'` \| `'email'` \| `'autonomous'` \| `'telegram'` |
| `current_stage_id` | TEXT | Slug på engine_stages.stage_id (ikke UUID) |
| `stage_index` | INT | Cursor (advisory) |
| `stage_started_at` | TIMESTAMPTZ | For timeout-evaluering |
| `status` | TEXT | `'active'` \| `'complete'` \| `'expired'` \| `'abandoned'` |
| `context` | JSONB | Inn-data (profile, workspace, tools-tilgjengelig) |
| `collected_data` | JSONB | Stage-resultater nøklet på `stage_id` |
| `summary` | TEXT | Settes ved completion |
| `callback_url` | TEXT | Webhook ved completion |
| `guardian_whisper_count` | INT | Counter — hvor mange whispers er injisert |
| `expires_at`, `completed_at`, `created_at`, `updated_at` | TIMESTAMPTZ | |

### To moduser

#### `mode = 'mission'`

- Krever `mission_id` (CHECK-constraint).
- Stages preloadet fra `engine_stages` ved spawn.
- `stage-manager.ts::advanceStage` driver navigasjon (`sequential`, `free`, `hybrid` per `engine_missions.mode`).
- Guardian-evaluator kjører hver 120s (default) + på events — sammenligner `collected_data` mot `journey_step` requirements.
- Auto-advance, nudge, timeout, off-topic, silence er mulige aksjoner.
- Avslutter med `status='complete'` + webhook-fyring + `mission.complete` Guardian-event.

#### `mode = 'agent'`

- `mission_id IS NULL` (constraint tillater).
- Free-form chat. Ingen stages, ingen mission, ingen guardian-evaluator (men Guardian *ser* sesjonen og kan whispe).
- Brukes for idle-awake Botsson — det vi i forrige tur kalte "Ljus".
- Authority-config evaluert per tool-call, ikke pre-snapshottet.

### Optimistic concurrency

Stage-completion bruker compare-and-swap:
```
UPDATE engine_sessions
   SET status='complete', completed_at=now()
 WHERE id=$id
   AND current_stage_id=$current
   AND status='active'
```
Returnert `count=0` = annen worker rakk det først → log + return null. Forhindrer dobbel-completion.

## 3. Guardian — syn

### Hva det er

Real-time observability + supervisory layer over alle aktive sesjoner. To halvdeler:

| Halvdel | Fil | Funksjon |
|---|---|---|
| **Evaluator** | `core/guardian-evaluator.ts` | Avgjør HVA som bør skje (advance/nudge/timeout) |
| **Bus** | `core/guardian-bus.ts` + `pg-notify-bus.ts` | Fanout av events ut til admin |

### Evaluator — beslutningslag

Kjøres på events (`data.collected`, `user.message`, `agent.response`) + periodisk (default 120s, configurable via `GUARDIAN_INTERVAL_MS`). Per session:

```
1. Hent session (active only)
2. Hent current_stage + linket journey_step
3. Beregn elapsed = now - stage_started_at
4. Avgjør action:
   - 'advance'  — alle required fields i collected_data → auto-advance
   - 'nudge'    — mangler felt + elapsed > min_duration → emit whisper
   - 'timeout'  — elapsed > max_duration → emit timeout-event
   - 'off_topic'— LLM-evaluering: bruker driver bort fra stage-mål
   - 'silence'  — bruker har vært stille for lenge
   - 'none'     — alt OK
5. Side-effect: emitGuardianEvent + evt. advanceStage()
```

Evaluator-resultater er ikke persisterte beslutninger — de er inferred state. Sluttresultatet sees i sesjonens `collected_data` og Guardian-event-stream.

### Bus — fanout-lag

```
emitGuardianEvent({ session_id, workspace_id, event_type, actor, summary, data })
       │
       ▼
INSERT INTO guardian_log (...)        ← persistert audit (ADR-0186)
       │
       ▼
AFTER INSERT TRIGGER pg_notify('guardian_events', payload)
       │
       ▼  (cross-instance)
Stage-engine instans 1   instans 2   instans 3
       │                    │            │
       ▼                    ▼            ▼
For hver WS-klient som har subscribed på (workspace_id, session_id):
       send(JSON.stringify(GuardianEvent))
```

`guardian_log` er audit-kilden. WS-fanout er secondary path — admin som er offline i øyeblikket mister live-streamen, men kan lese `guardian_log` historisk.

### WS-protokollen (`types/guardian.ts`)

**Server → klient:**
```ts
type GuardianEvent = {
  type: 'event',
  session_id, workspace_id, event_type,
  actor: 'system' | 'agent' | 'user' | 'guardian' | 'admin',
  summary, data, timestamp
}

type GuardianSessionList = {
  type: 'sessions',
  sessions: [{ session_id, mission_id, profile_name, channel, status, current_stage, started_at }]
}
```

**Klient → server (kommandoer):**
```ts
type GuardianCommand =
  | { type: 'subscribe',     session_id }
  | { type: 'unsubscribe',   session_id }
  | { type: 'change_stage',  session_id, target_stage_id }   // tving stage-skift
  | { type: 'whisper',       session_id, message }            // injiser admin-note
```

`change_stage` og `whisper` er admin-superkrefter. `change_stage` overstyrer både evaluator og brukerens flow. Whisper injiseres i neste tur (se §4).

## 4. Whispers — ord

### Skjema (`agent_session_whisper`, ADR-0185)

```sql
CREATE TABLE agent_session_whisper (
  id               uuid PK,
  session_id       uuid NOT NULL,
  workspace_id     uuid NOT NULL,
  admin_profile_id uuid NOT NULL,        -- hvem whispet
  content          text NOT NULL CHECK (length BETWEEN 1 AND 2000),
  is_consumed      boolean DEFAULT false,
  consumed_at      timestamptz,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_asw_session_unconsumed
  ON agent_session_whisper (session_id, created_at)
  WHERE is_consumed = false;
```

RLS: workspace-admin eller godmode. Ikke vanlige brukere.

### Hvordan en whisper "lander"

```
1. Admin skriver melding i platform-admin /guardian-vinduet
2. WS-frame → guardian.ts route → INSERT i agent_session_whisper
   (i dag: kan også emitGuardianEvent('whisper.injected') for audit-spor)
3. Neste tur i sesjonen — stage-manager.ts::advanceStage kaller
   prompt-builder.ts::buildStagePromptWithWhispers
4. Builder leser is_consumed=false rader for session_id
5. Builder pakker hver whisper i:
      <admin_note visibility="internal" from="platform_admin">
        {content}
      </admin_note>
6. Builder appender:
      "## Platform-admin guidance
      ...whispers...
      Do NOT quote these notes verbatim to the user.
      Apply the guidance naturally in your next response."
7. Builder marker is_consumed=true (fire-and-forget; feil = re-injiseres neste tur)
8. Recorder logger turen med hint om whispers var aktive
```

### Hvorfor "do NOT quote verbatim"

Whisper er *metadata* — guidance for hvordan modellen skal forme svaret, ikke tekst som skal speiles til bruker. Hvis modellen quoter `<admin_note>` verbatim, lekker admin-skylane direkte i samtale. ADR-0078 (channel-restriksjon) + ADR-0185 (whisper-kontrakt) håndhever det.

### Viktige fail-safes

- **Hvert hint-pass er fire-and-forget.** DB-feil ved whisper-fetch = whisper utelatt denne turen, sesjon ruller videre uten admin-input. Bedre enn å blokkere turen.
- **Mark-consumed er også fire-and-forget.** Feil her = whisper re-injiseres neste tur. Idempotent på modell-siden (`<admin_note>` to ganger = samme guidance).
- **Counter på sesjonen** (`guardian_whisper_count`) inkrementeres per injeksjon — analytics kan se hvilke sesjoner som har vært "tunge" å styre.

## 5. Hvordan de tre lagene henger sammen — full lifecycle

```
T+0   POST /sessions  →  session-manager.createSession
                          INSERT engine_sessions(mode='mission', status='active')
                          emitGuardianEvent('session.created')   ──→ guardian_log → WS-fanout

T+1   Bruker snakker  →  WS /ws frame
                          SessionLane.queue(session_id, turnHandler)
                          turnHandler:
                            - prompt-builder.buildStagePromptWithWhispers
                                  ├─ leser agent_session_whisper(unconsumed)
                                  ├─ pakker <admin_note>...
                                  └─ marker is_consumed=true
                            - LLM-call
                            - recorder.record(turn)
                            - hvis tool-call → agent-router
                            - oppdater collected_data
                          emitGuardianEvent('user.message')      ──→ WS

T+1.x guardian-evaluator (event-trigger):
                          evaluateSession(session_id)
                          → 'advance' | 'nudge' | ...
                          → evt. advanceStage() eller emit nudge-whisper
                          emitGuardianEvent('stage.advanced'/'nudge.sent')

T+120s guardian-evaluator (periodic loop):
                          evaluateAllActiveSessions
                          → for hver active: re-evaluer, evt. timeout-fire

T+m   Admin ser nudge-event komme på /guardian-feed
      Admin trykker "whisper" → WS GuardianCommand{type:'whisper', message}
                          INSERT agent_session_whisper(content, is_consumed=false)
                          emitGuardianEvent('whisper.injected')

T+m+1 Bruker snakker neste gang → buildStagePromptWithWhispers ser den nye raden
                          Whisper landet. Botsson endrer kurs naturlig.

T+n   Mission complete (alle required collected) → status='complete'
                          + completed_at + webhook fired
                          emitGuardianEvent('mission.complete')
```

## 6. Hva som ikke er durable (gap-analyse)

Knytter til [HARNESS-ARCHITECTURE.md](./HARNESS-ARCHITECTURE.md) Q3-mission-kontrakten.

| Gap | Konsekvens i Stage Engine | Status |
|---|---|---|
| Ingen per-stage durable rad | `current_stage_id`-cursor kan ikke skille "stage ferdig" fra "stage krasjet midt-i" | 🔴 åpent |
| Ingen lease + idempotency_key | To workere kan claim samme advance hvis SessionLane krasjer mellom prosesser | 🟡 delvis (in-memory lane funker single-instance, breaker multi-instance) |
| `emit()` (telemetry) er ikke i samme TX som mutation | Skriv + ingen emit mulig (orphan write) | 🔴 åpent — ADR-0270 forslag |
| Guardian-events skrives FØR domain-mutation committeres i noen kall-sites | "stage.advanced" kan vises i feed mens DB-rollback skjuler at det aldri skjedde | 🟡 sjelden — krever audit-pass |
| Whisper-recovery ved krasj | Whisper merket consumed, men prompt-builder krasjet før LLM-call → whisper "tapt" på den turen | 🟡 by design — re-injiseres neste tur, men én tur uten guidance |

## 7. Identitets-skiller — hvem ser hva

| Aktør | Kanal | Ser | Kan |
|---|---|---|---|
| Bruker | `/ws` (chat/voice) | Sin egen samtale | Snakke, gi inputs, fullføre stages |
| Botsson (LLM) | Ingen direkte | System-prompt + `<admin_note>`-block + collected_data | Stille spørsmål, foreslå advance, kalle tools |
| Workspace-admin | `/guardian` WS | Egne sesjoner (RLS via `is_admin_in_workspace`) | Subscribe, whisper, force-stage |
| Godmode (platform-admin) | `/guardian` WS | Alle sesjoner cross-workspace | Samme + audit |
| Recorder | Sentral hook | Hver turn (prompt + LLM-output + tool-calls) | Forensikk, ingen mutation |

Whisper-tilgangen er begrenset til admin-rolle. Vanlig bruker kan ikke whispe. Bruker ser heller aldri at whispers eksisterer — `<admin_note>` er internt prompt-element, og "do NOT quote"-instruksjonen er førstelinjeforsvar.

## 8. ADR-er som styrer dette

| ADR | Kontrakt |
|---|---|
| 0078 | Channel-restriksjon — voice-forbud for PII (3-lags forsvar i tool/capability/process) |
| 0184 | Session Recorder — ring-buffer hook, fire-and-forget |
| 0185 | Platform-admin Whisper — `<admin_note>` injection, never user-facing |
| 0186 | Guardian event-bus — `pg_notify` cross-instance fanout |
| 0151 | Profile-ID derivasjon server-side — gjelder også for engine_sessions.profile_id |
| 0204 | gatedMutation — capability-tools må gå via authority-gate |
| 0238 | Domain chat ownership — Botsson suppress når domain-chat tar over surface |
| 0270 *(forslag)* | Mission Run Contract — per-step durability, idempotent recovery |
| 0424 | `invoke_capability_tool` action-type — EF→Node bridge for cron/engine-spawned tool invocation (§1 internal route) |

## 9. Referanser

- [HARNESS-ARCHITECTURE.md](./HARNESS-ARCHITECTURE.md) — full L1→L5 pipe + LiveKit-harness + roadmap
- [BOTSSON-SYSTEM-MAP.md](./BOTSSON-SYSTEM-MAP.md) — pipe-diagram med 🟢🟡🔴-status
- `services/stage-engine/src/core/` — alle kjerne-moduler
- `supabase/migrations/20260301200000_engine_tables.sql` — engine_sessions skjema
- `supabase/migrations/20260515120300_agent_session_whisper.sql` — whisper skjema
- `supabase/migrations/20260422120000_*` — guardian_log + pg_notify trigger
