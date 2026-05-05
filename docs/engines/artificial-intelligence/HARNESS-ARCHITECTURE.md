---
title: "Harness Architecture — Botsson + LiveKit-Voice (faktisk tilstand + roadmap)"
status: in_progress
updated: 2026-05-04
created: 2026-05-04
module: architecture
tags: [harness, botsson, livekit, stage-engine, voice-agent, roadmap, scope]
---

# Harness Architecture

> Komplett arkitektsbeskrivelse av Smartouts to AI-harnesser slik de er bygget i dag på `development @ 3f6e657f`. Dokumentet er kompilert mot kode 2026-05-04 og dekker (1) Botsson-harnessen L1→L5, (2) LiveKit-voice-harnessen, og (3) scope + roadmap fremover med kjente blockers.
>
> **Trust hierarchy:** Kode vinner over dette dokumentet. Hvis kode og dokument er uenige — oppdater dokumentet. Autoritativ status-kilde for komponentnivå er fortsatt [`BOTSSON-SYSTEM-MAP.md`](./BOTSSON-SYSTEM-MAP.md). Dette dokumentet binder MAP + LiveKit-harness + roadmap sammen i én lesning.

---

## TL;DR

Smartout har to overlappende, men distinkte AI-harnesser:

- **Botsson-harnessen** (L1–L5) — chat + Stage Engine + capabilities + persistens. Modnet betraktelig Q2 2026 (Phase A1/A3/A5/A6 + Phase D1 alle landet april 2026). 25 capabilities registrert (vs. 14–15 i tidligere snapshots).
- **LiveKit-voice-harnessen** — `services/voice-agent` som LiveKit Agents Worker, mobil + Botsson Orb (web) som klienter. Worker bruker `@livekit/agents` natively + ruter alt via stage-engine `/agent/chat` (ADR-0132). Tool-flate ble komplettert Phase 0d (2026-04-30).

Største 🔴 i dag:

1. **Generator API-flate mangler** (Phase C2) — 4 generatorer er pure functions uten HTTP-flate.
2. **Mobile LiveKit C1.c (Detox E2E + orb-polish)** gjenstår — token + transcript hooks landet 2026-04-24/28.
3. **Form-view + Video-view i Arena er placeholders** — viser bare strengen.
4. **Signature Emma-illustrasjon + Immersive backdrop** — design-handoff lastet ned, frontend-designer eier implementering (Phase D3).
5. **Helpdesk Phase 0 lifecycle spawner aldri** — to bugs i seed-migrasjonen + manglende `engine_trigger`-rad (P0-blocker fra STATE-SUMMARY).

Største roadmap-blocker: ADR-0246 / 0247 / 0248 (engine_state vs engine_sessions ontologi-rekonsiliering, 5–6 uker, blokkerer A4b emit).

---

## Del 1 — Botsson-harnessen (L1→L5 pipe)

### 1.0 Pipe-oversikt

```
L1  OVERFLATE       apps/web/src/app/Botsson/_components/
                    + apps/web/src/app/platform-admin/guardian/_components/  (recorder UI)
        │ user-melding / voice-turn / tool-call
        ▼
L2  BFF             apps/web/src/app/api/botsson/*  +  /api/emma/*
        │ proxy m/ JWT (Bearer eller cookie)
        ▼
L3  STAGE ENGINE    services/stage-engine/  (Hono, port 5010)
        │  agent-router → intent classifier → tool selector → LLM
        ▼
L4  CAPABILITIES    packages/ai/src/capabilities/  (25 stk)
                    + missions/ + agents/ + adapters/ + generators/ + router/
        │ DB writes via gate_action / cascade_gate_write / gatedMutation
        ▼
L5  PERSISTENCE     supabase/  (Postgres + pgcrypto + pg_notify + RLS)
                    engine_state · engine_sessions · engine_event · engine_memory
                    activity_trail · gate_action · agent_session_recording · ...
```

### 1.1 L1 — Overflate

**Sti:** `apps/web/src/app/Botsson/_components/`

| Komponent | Fil | Status | Notat |
|-----------|-----|:------:|-------|
| BotssonShell | `BotssonShell.tsx` | 🟢 | Magnetic edges, drag, resize, mic-knapp |
| BotssonOrb (6 states) | `BotssonOrb.tsx` | 🟢 | idle / listening / thinking / speaking / notification / unread-badge |
| BotssonSticky | `BotssonSticky.tsx` | 🟢 | 4s retract, peek, hover |
| BotssonArena (12 views) | `BotssonArena.tsx` | 🟡 | Form-view + Video-view fortsatt placeholders |
| BotssonChat | `BotssonChat.tsx` | 🟢 | Wired til `/api/botsson/chat` (admin) |
| BotssonProvider | `BotssonProvider.tsx` | 🟢 | Persona, voice-tuning, view-actions ref |
| BotssonTools (16 globale) | `BotssonTools.ts` | 🟢 | `buildBotssonToolKit()` — viewActionsRef-mønster |
| Page-tools registry | `tool-registry.ts` | 🟢 | `registerTools()` + `useRegisterTools(source, kit)` + `useRegisteredTools()` med stable empty fallback |
| **BotssonVoiceCall** | `BotssonVoiceCall.tsx` | 🟢 | LiveKit Orb-mount; lytter på agent-audio + binder til `<audio>`; reagerer på `ActiveSpeakersChanged` |
| Help-takeover/help-tour kits | `help-takeover-kit.ts` / `help-tour-kit.ts` + bridges | 🟢 | Domain-spesifikke tool-bundler |
| Persona engine | `persona-engine.ts` | 🟢 | — |
| Emma awareness | `emma-awareness.ts` | 🟢 | — |
| EmmaProfile (signature illustrasjon) | `EmmaProfile.tsx` | 🔴 | Bare bokstaven "E" på gradient — handoff i `docs/design/botsson/` venter (Phase D3) |
| Immersive backdrop | (i `BotssonShell.tsx`) | 🔴 | Ikke implementert |

**Recorder-UI (Platform Admin):** `apps/web/src/app/platform-admin/guardian/_components/`

| Komponent | Fil | Status |
|-----------|-----|:------:|
| GuardianMonitor (composition host) | `GuardianMonitor.tsx` | 🟢 |
| SessionList | `SessionList.tsx` | 🟢 |
| TurnTimeline | `TurnTimeline.tsx` | 🟢 |
| TurnCard | `TurnCard.tsx` | 🟢 |
| AdminActionDrawer (whisper / flag / force-stop) | `AdminActionDrawer.tsx` | 🟢 |
| RedactedPill (PII-reveal) | `RedactedPill.tsx` | 🟡 — komponert i Phase 2c |
| `useRecorderSessions` | `_hooks/useRecorderSessions.ts` | 🟢 |

### 1.2 L2 — BFF

| Endepunkt | Fil | Auth | Status |
|-----------|-----|------|:------:|
| `POST /api/botsson/chat` | `apps/web/src/app/api/botsson/chat/route.ts` | cookie (admin) | 🟢 |
| `POST /api/botsson/voice/token` | `apps/web/src/app/api/botsson/voice/token/route.ts:33-121` | cookie | 🟢 — minter LiveKit AccessToken for `botsson-orb:<profileId>` rom; `profileId` server-derivert (ADR-0151) |
| `POST /api/emma/chat` | `apps/web/src/app/api/emma/chat/route.ts:91-244` | cookie ELLER `Authorization: Bearer` (mobil per ADR-0132) | 🟢 |
| `GET /api/emma/history` | `.../api/emma/history/route.ts` | cookie | 🟢 |
| `GET /api/emma/memory` | `.../api/emma/memory/route.ts` | cookie | 🟢 |
| `GET\|POST /api/emma/notes` | `.../api/emma/notes/route.ts` | cookie | 🟢 |
| `GET\|POST /api/emma/tasks` | `.../api/emma/tasks/route.ts` | cookie | 🟢 |
| `POST /api/botsson/recorder/flag` | `.../recorder/flag/route.ts` | godmode/admin | 🟢 — Phase D1 |
| `POST /api/botsson/recorder/whisper` | `.../recorder/whisper/route.ts` | C4-gated `recorder.whisper` | 🟢 |
| `GET /api/botsson/recorder/sessions/[id]` | `.../recorder/sessions/[id]/route.ts` | godmode | 🟢 |
| `GET /api/botsson/recorder/break-glass/[envelope_id]` | `.../recorder/break-glass/[envelope_id]/route.ts` | `recorder.pii_reveal=confirm` + godmode | 🟢 — `decrypt_envelope` RPC + 5s vindu + audit |
| `POST /api/botsson/recorder/flag-session` | `.../recorder/flag-session/route.ts` | admin/owner | 🟢 |
| `POST /api/botsson/recorder/flag-log-entry` | `.../recorder/flag-log-entry/route.ts` | hvilken som helst auth | 🟢 — bruker-eskalering, server-side session-resolve fra nyligste turn |
| `POST /api/botsson/recorder/force-stop` | `.../recorder/force-stop/route.ts` | C4-gated | 🟢 |
| `GET /api/botsson/recorder/_metrics` | `.../recorder/_metrics/route.ts` | godmode | 🟢 — proxy til stage-engine |
| **Generator-routes** (`/api/.../generate`) | — | — | 🔴 — Phase C2; generatorer finnes som pure functions, ingen HTTP-flate |

**Channel-pinning (ADR-0078) hardkodet i BFF:** `/api/emma/chat` setter `channel: "chat"` server-side på linje 193 og aksepterer aldri en `channel`-felt fra klienten. Voice-trafikk bruker LiveKit-spor (se Del 2) og forwarder `channel: "voice"` fra `services/voice-agent/src/adapter.ts:75`.

### 1.3 L3 — Stage Engine

**Sti:** `services/stage-engine/src/`. Hono på port 5010. Bootet av `index.ts` med 12 route-registreringer + 5 bakgrunnsløkker + recorder-singleton.

#### Core moduler (`src/core/`)

| Modul | Fil | Status | Notat |
|-------|-----|:------:|-------|
| Session Manager | `session-manager.ts` | 🟢 | Per-user session-state |
| Agent Session | `agent-session.ts` | 🟢 | Konversasjonshistorikk |
| Session Lane (per-session serialization) | `session-lane.ts` | 🟢 | Promise-kø for å hindre race i samme session |
| Stage Manager | `stage-manager.ts` | 🟢 | — |
| Prompt Builder | `prompt-builder.ts` | 🟢 | Inj. recorder + admin whispers (`<admin_note>`) |
| **Agent Router** | `agent-router.ts:84-100` | 🟢 | `buildClassifierContext()` henter role + department fra `profile`-rad — Phase A5 lukket |
| Admin Router | `admin-router.ts` | 🟢 | — |
| **Authority gate** | `authority.ts` | 🟡 | Fungerer; **dual-gate divergence** med `cascade_gate_write` (Phase B1, ADR-0231 dedup-mønster, ADR-0204 gatedMutation-orkestrator) |
| Guardian Evaluator | `guardian-evaluator.ts` | 🟢 | — |
| Guardian Bus + pg-notify | `guardian-bus.ts` + `pg-notify-bus.ts` | 🟢 | Phase A6 / ADR-0186 — AFTER INSERT-trigger på `guardian_log` → `pg_notify('guardian_events')` |
| Calendar Guardian | `calendar-guardian.ts` | 🟢 | — |
| Operations Evaluator | `operations-evaluator.ts` | 🟢 | — |
| **Memory Manager** | `memory-manager.ts` | 🟢 | Reader siden 2026-03; producer-side koblet Phase A3 via `packages/ai/src/context/memory-writer.ts` + `memory`-capability |
| Relationship Manager | `relationship-manager.ts` | 🟢 | — |
| Inbox Writer | `inbox-writer.ts` | 🟢 | — |
| Telegram Bridge | `telegram-bridge.ts` | 🟢 | Referansemønster for pg_notify |
| **Session Recorder** | `session-recorder.ts` | 🟢 | Fire-and-forget ring buffer; hooks i prompt-builder, agent-router, authority, guardian-evaluator, memory-manager, tool-exec |
| Mission Summary | `mission-summary.ts` | 🟢 | — |
| **derive-profile-id** | `derive-profile-id.ts:1-46` | 🟢 | ADR-0151 — `deriveProfileId(userId, workspaceId, supabaseAdmin)` |

#### Routes (`src/routes/`)

| Route | Fil | Status |
|-------|-----|:------:|
| `POST /agent/chat` | `routes/agent/chat.ts:94-323` | 🟢 — workspace fra JWT (linje 97), profile via `deriveProfileId` (linje 154), wizard_session_id fail-closed (linje 121-138) |
| `POST /agent/dispatch` | `routes/agent/dispatch.ts` | 🟢 — Sixten persona wake-endpoint, ADR-0255 |
| `POST /sessions` + CRUD | `routes/sessions.ts` | 🟢 |
| `GET /fetch` | `routes/fetch.ts` | 🟢 |
| `POST /advance` | `routes/advance.ts` | 🟢 |
| `POST /store` | `routes/store.ts` | 🟢 |
| `* /adapters/ultravox/*` | `routes/adapters/ultravox.ts` | 🟢 — web Ultravox-spor |
| `POST /adapters/telegram/webhook` | `routes/adapters/telegram.ts` | 🟢 |
| `* /ws/*` | `routes/ws.ts` | 🟢 — Ultravox transport |
| `* /guardian/*` | `routes/guardian.ts` | 🟢 — WebSocket fanout |
| `GET /recorder/metrics` | `routes/recorder-metrics.ts` | 🟢 — Phase 2a |
| `GET /health` | `routes/health.ts` | 🟢 |

#### Workers (`src/workers/`)

| Worker | Fil | Status |
|--------|-----|:------:|
| **mission-pool-slot** | `workers/mission-pool-slot.ts` | 🟢 — Phase 0 Crown LOCKED 2026-04-30; LISTEN på `mission_dispatch`, hash-verifies `ir/journey.yaml`, emitter 4-event journey-trace |
| sixten-orchestrator | `workers/sixten-orchestrator.ts` | 🟢 — Phase 0d.1, poller `engine_event` for `sixten.pulse_received` |
| sixten-checks | `workers/sixten-checks.ts` | 🟢 — 5 health-checks |

### 1.4 L4 — Capabilities, Missions, Agents, Adapters, Generators

#### Capabilities (`packages/ai/src/capabilities/`) — 25 registrerte

Verifisert mot `registry.ts`. Tidligere `BOTSSON-SYSTEM-MAP.md` lister 14–15; den dokumenterer er en eldre snapshot. Her er fullstendig liste (sortert etter rekkefølge i registry):

| # | Capability | Status | emitPrefix / Auth | Notat |
|---|-----------|:------:|---|---|
| 1 | profile | 🟢 | profile | — |
| 2 | ui | 🟢 | ui | — |
| 3 | guardian | 🟢 | guardian | Skriver via `emitGuardianEvent` → `guardian_log` → `pg_notify` |
| 4 | schedule | 🟡 | schedule | Bruker rapporterer wrong-day-bug — diagnose pending (D2) |
| 5 | operations | 🟢 | operations | — |
| 6 | communication | 🟢 | comm | Leser `engine_memory` for compile-day-brief |
| 7 | contract | 🟢 | contract | — |
| 8 | contract_intake | 🟢 | contract_intake | A1 lukket 2026-04-29 — alle 4 mutasjoner går via `callGateAction()` + `gatedMutation` (ADR-0204). Channel-guard på `decline_intake` |
| 9 | shift_swap | 🟢 | shift_swap | — |
| 10 | operations_intelligence | 🟡 | ops_intel | Leser `engine_memory` |
| 11 | training | 🟢 | training | — |
| 12 | shift_lifecycle | 🟢 | shift_lifecycle | 5-lags model (ADR-0095) |
| 13 | governance | 🟢 | governance | — |
| 14 | billing_query | 🟢 | billing | — |
| 15 | **memory** | 🟢 | memory | Phase A3 (2026-04-22) — `save_memory` chat-only + gated. Standard authority `read_only` (opt-in) |
| 16 | helpdesk_query | 🟢 | helpdesk | 4 tools (open_ticket, list_my_queue, get_ticket, resolve_ticket); ADR-0160-0163 |
| 17 | kb_query | 🟢 | kb | Read-only. Intent-classifier binder `knowledge → kb_query` (ADR-0221 amendment) |
| 18 | journey | 🟢 | journey | Frozen-4 capability per ADR-0173 |
| 19 | journey_authoring | 🟡 | journey_authoring | ADR-0240: `publishDraftTool` har 3 direkte writes utenfor `gatedMutation` (linje 443-481). Markert dead-code; må delegeres til `journey.publish_mission`. **Phantom contract — fix før produksjonsbruk** |
| 20 | season | 🟢 | season | M3.2 ADR-0201 (2026-04-23). `season_budget.updated` → `cascade_budget_propagation` action_type (engine-dispatch:1118) |
| 21 | availability | 🟢 | availability | D2 source-data; 3 tools (set_own + clear_own voice-OK; query_others chat-only) |
| 22 | tips | 🟡 | tips | 4 skeleton tools (not_implemented). Bodies i Sortie 2+3 |
| 23 | **payroll** | 🟢 | payroll | ADR-0256. **chat-only** (Høy-PII). 6 skeleton tools. Authority confirm/admin/24h |
| 24 | mission | 🟢 | mission | Read-only. Surfacer aktive `engine_state`-misjoner |
| 25 | personal | 🟢 | personal | 5 utility tools (note, task, reminder, history, setting). chat+voice. Authority suggest |
| 26 | **legal** | 🟡 | legal | ADR-0249. Phase 0c skeleton: `validate_aml_14_6` (stub, mandatory gate i `/api/contracts/send`), `cite_law` (stub, chat+voice), `classify_amendment` (stub, server-only). Lovdata MCP integrasjon Phase 0c+ |

> Når `helpdesk_query` legges til i `BOTSSON-SYSTEM-MAP.md`-tellingen er total 26 i registry; map sin "14 registrerte" er stale og bør oppdateres i samme commit som dette dokumentet.

#### Missions (`packages/ai/src/missions/`)

`registry.ts` registrerer 6 misjoner: `onboarding-interview`, `season-lifecycle`, contract intake (via contract agent), journey compilation, schedule inspection, botsson admin. Manifest i `missions/manifest.ts`. Ultravox transport-mapping i `missions/ultravox.ts`.

#### Agents (`packages/ai/src/agents/`) — 7 wrappers

| Agent | Fil | Notat |
|-------|-----|---|
| botsson | `agents/botsson.ts` | Phase 0d (2026-04-30): utvidet fra 5 → 23 capabilities (full registry-paritet) |
| contract | `agents/contract.ts` | — |
| docs | `agents/docs.ts` | — |
| journey-ops | `agents/journey-ops.ts` | — |
| onboarding | `agents/onboarding.ts` | — |
| reports | `agents/reports.ts` | — |
| schedule | `agents/schedule.ts` | 🟡 — wrong-day-bug |

#### Adapters (`packages/ai/src/adapters/`)

| Adapter | Fil | Status |
|---------|-----|:------:|
| Vercel AI SDK (OpenRouter) | `adapters/vercel-ai.ts` | 🟢 |
| LiveKit (`toLiveKitTools()` converter) | `adapters/livekit.ts` | 🟡 — 47 LOC pure-converter, **0 consumers** (voice-agent bruker `@livekit/agents` natively, ikke denne) |

#### Generators (`packages/ai/src/generators/`)

`journey-botsson.ts`, `journey-doc.ts`, `journey-e2e.ts`, `journey-linear.ts` — alle 🟡: pure functions, ingen API-flate (Phase C2 mangler).

#### Router (`packages/ai/src/router/`)

| Modul | Fil | Status |
|-------|-----|:------:|
| Intent Classifier | `router/intent-classifier.ts` | 🟢 — fôret med `ClassifierContext` (role + department + channel + workspaceId), Phase A5 |
| Tool Selector | `router/tool-selector.ts` | 🟢 — `knowledge → kb_query` mapping (linje 106) |
| Min-role gate | `router/min-role.ts` | 🟢 |

### 1.5 L5 — Persistens

Workspace-scoped Postgres + RLS + pgcrypto + pg_notify. Migrasjoner i `supabase/migrations/`.

| Tabell / RPC | Status | Notat |
|--------------|:------:|-------|
| `engine_process` (blueprint) | 🟢 | — |
| `engine_state` (live instance) | 🟢 | Stage-engine reader **mangler** for non-journey kinds — 27+ konsumer-sites går mot `engine_sessions` (ADR-0246 Phase A4a) |
| `engine_state.context.mission_id` | 🟡 | Forward-looking JSONB write fra `journey.run_guided`. Ingen stage-engine konsumer ennå (B1) |
| `engine_state_step` | 🟢 | — |
| `engine_sessions` (voice/agent-session) | 🟢 | Brukes som primary av stage-engine i dag |
| `engine_event` | 🟢 | Per-mutation. Dot-notation lagring (`toDotNotation()` i `packages/telemetry/src/providers/engine-event.ts`) |
| `engine_memory` | 🟢 | Reader + writer koblet (Phase A3). Embedding-kolonne fortsatt NULL — retrieval ranker på importance |
| `engine_authority_config` | 🟢 | C4 — per workspace + capability. Default = `read_only` ved manglende rad |
| `activity_trail` | 🟢 | Audit per mutasjon (ADR-0116) |
| `channel_event` + `channel_ai_policy` | 🟡 | Helpdesk-bølgen (2026-04-29) wired infra. Backfill i `20260515160000_channel_helpdesk_backfill.sql`. Full 🟢 når Komm thread-continuation legger til write-consumers |
| `gate_action` (RPC) | 🟡 | Den ene gate fra agent-laget. Dual-gate med `cascade_gate_write` ikke fullt rekonsiliert (Phase B1, ADR-0204 mitigation via gatedMutation-orkestrator) |
| `cascade_gate_write` (RPC) | 🟡 | Server Actions / cascade-engine spor |
| `agent_session_recording` | 🟢 | Phase D1 (ADR-0184) — 1 rad per turn, 8 `turn_kind` × 10 `phase`-verdier |
| `agent_session_envelope` | 🟢 | pgcrypto break-glass + 30d TTL via pg_cron |
| `agent_session_whisper` | 🟢 | Admin-injection, aldri user-facing |
| `engine_delayed_trigger` | 🟢 | Refurbished for helpdesk SLA (ADR-0162) |
| `profile.botsson_channel_id` | 🟢 | C1.d (2026-04-28) — UUID FK → `channel(id)`. Auto-bootstrap-trigger. Jarvis demo unblocked |
| Heartbeat scheduling | 🟢 | `engine_state.scheduled_for` + `recurrence` + `dispatch_lock_id` (`20260520110000_engine_state_scheduling.sql`) + `heartbeat_pickup` RPC + `heartbeat-dispatcher` Edge Function (pg_cron 1m) |

### 1.6 Cross-cutting laws (ADR-aksiomer som rammer alle 5 lag)

| Law | ADR | Hvor det håndheves |
|-----|-----|-------------------|
| Workspace scope på alle queries | ADR-0099 + 0134 | `ctx.workspaceId` non-null sjekkes i hver capability-`execute()` |
| `gate_action` før mutate | ADR-0099 | Capability tools — agent-layer write-path |
| `gatedMutation` orkestrator | ADR-0204 | `packages/ai/src/lib/gated-mutation.ts` — dual-gate composition |
| Channel guard for PII | ADR-0078 | 3-lags forsvar: process `allowed_channels` + capability `allowedChannels` + tool `ctx.channel === "voice"` reject |
| Telemetry contract | ADR-0134 + 0151 | `emit()` workspace_id + actor_id non-empty; ingen `?? ""` |
| Server-derive actor | ADR-0151 (CI invariant I4) | `derive-profile-id.ts`; CI `invariants:server-actor` |
| Mobile thin client | ADR-0132 | All AI-trafikk → web BFF → stage-engine (mobil ringer aldri capabilities direkte) |
| Web composes, mobile executes | ADR-0133 | D1–D5 web; D6 + C4 mobile |
| Dual-surface ownership | ADR-0238 (proposed) | `<DomainChatOwnership>` på sider med embedded chat (wizard, helpdesk-preview) |

CI-invariants i `docs/architecture/INVARIANTS.md` (10 stk: I1-I6 + I10 🟢; I7+I9 🟡; I8 🔴).

---

## Del 2 — LiveKit-voice-harnessen

### 2.0 Hvordan dette spor er organisert

To distinkte voice-spor, **bevisst delt** per ADR-0135 (proposed):

- **Web (Botsson Orb)** og **mobil** = LiveKit (`services/voice-agent`).
- **Web (Ultravox-driven flows)** = Ultravox via `services/stage-engine/src/routes/adapters/ultravox.ts` + `routes/ws.ts`.

ADR-0135 har status `proposed` per 2026-05-04 — mobile LiveKit anses derfor som "implementert men ikke ratifisert" til ADRen aksepteres.

### 2.1 voice-agent-tjenesten

**Sti:** `services/voice-agent/`

| Fil | Rolle |
|-----|------|
| `Dockerfile` | 2-stage build på `node:22-slim`. **Stage 2 installerer `ca-certificates`** (linje 29-35) — `@livekit/rtc-node` Rust-binding leser OS CA-store for TLS til LiveKit Cloud. Uten dette får `Room.connect()` "engine: signal failure" (L-201 fra 2026-05-03, fikset). Prod-install kjøres UTEN `--ignore-scripts` slik at `rtc-node.linux-x64-musl.node`-binding bygges via postinstall (linje 40-43) |
| `package.json` | Dependencies: `@livekit/agents@^1.3.0`, `@livekit/agents-plugin-openai@^1.3.0`, `@livekit/agents-plugin-silero`, `@livekit/rtc-node@^0.13.27`, `dotenv`. **Ingen `@smartout/*` workspace-deps** — koblet til monorepo som pnpm workspace, men ruter via HTTP til stage-engine (ADR-0132) |
| `src/agent.ts:56-126` | `defineAgent` entry-point. På `entry()`: `ctx.connect()`, registrer Room med adapter, lytter etter `botsson-context` data-msg, bygger merged tool-context via `buildAllBotssonTools()`, instansierer `voice.Agent` + `voice.AgentSession` med `RealtimeModel({ voice: "verse", turnDetection: server_vad / 250ms silence })`, generere åpningshilsen |
| `src/adapter.ts:53-114` | `ask(query, label)` — bridge mot stage-engine. POST til `${STAGE_ENGINE_URL}/agent/chat` med `channel: "voice"`, `profile_id` + `workspace_id` fra context, `session_id` formatet `voice-${workspaceId}-${profileId}` (deterministisk per bruker) |
| `src/adapter.ts:154-162` | `buildAllBotssonTools()` — merger `orbTools + personalTools + capabilityTools` til ett `llm.ToolContext` |
| `src/adapter-internal.ts` | Room-ref + activity-publisher — `_publishActivity()` sender `tool_call` + `tool_response` på `botsson-activity` data-channel for Arena LogView |
| `src/context.ts:86-137` | Module-scoped session context + `parseContextPayload()` for inbound `botsson-context` data |
| `src/tools-orb.ts` | 7 orb-controls (expand, collapse, pulse, pin, unpin, move, set_state) |
| `src/tools-personal.ts` | 5 utility tools (add_note, create_task, set_reminder, get_history, update_setting) |
| `src/tools-capability.ts:27-252` | 10 capability-query tools (`get_my_shifts`, `get_my_missions`, `cite_legal_paragraph`, `get_training_progress`, `get_helpdesk_status`, `get_my_profile`, `get_operations_summary`, `get_shift_swap_status`, `get_governance_summary`, `get_knowledge`) + `query_smartout` fallback |
| `src/tools-mission.ts` | Mission-spesifikke voice-tools |
| `.env.template` | Definerer `LIVEKIT_URL` (vs. Web Frontend-vault som heter `NEXT_PUBLIC_LIVEKIT_URL`) — agent SDK leser `LIVEKIT_URL`, ikke `NEXT_PUBLIC_*` (verifisert i `dev-startup.sh:350-355`) |

**Worker-modus:** Worker connecter outbound til LiveKit Cloud (WSS). Auto-dispatch: ingen `agentName` satt → join på alle nye rom. For Botsson Orb-rom heter rommet `botsson-orb:<profileId>`.

### 2.2 Klient-siden (web Orb)

**Sti:** `apps/web/src/app/Botsson/_components/BotssonVoiceCall.tsx`

| Trinn | Detalj |
|-------|--------|
| 1. Mic-knapp aktiverer | `BotssonShell.tsx` driver `active`-prop |
| 2. Token-fetch | `POST /api/botsson/voice/token` med `{ workspaceId }` (linje 100-109) |
| 3. BFF minter | `apps/web/src/app/api/botsson/voice/token/route.ts:91-113` — `AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)`, `identity = profile.profile_id`, `room = botsson-orb:${profileId}`, ttl 2h, metadata `{ device_type: "web", is_ai: false, source: "botsson-orb" }`, grants `roomJoin/canPublish/canSubscribe/canPublishData/canUpdateOwnMetadata` |
| 4. Klient kobler til | `Room.connect(serverUrl, token)` + `setMicrophoneEnabled(true)` (linje 182-187) |
| 5. Voice-agent autojoiner | Worker har ingen `agentName` → joiner alle nye rom |
| 6. Audio-spor | `RoomEvent.TrackSubscribed` → `track.attach(audioRef)` (hidden `<audio>`) |
| 7. Status-mapping | `ActiveSpeakersChanged` → `idle/connecting/listening/thinking/speaking` → `voiceStatusToOrb()` driver Orb-state |

### 2.3 Klient-siden (mobil)

| Komponent | Status |
|-----------|:------:|
| `useBotssonVoiceSession` hook | 🟢 — landed 2026-04-24 (C1.b) |
| LiveKit transcript → BFF | 🟡 — server primitives + transcript hook landet 2026-04-24 |
| `profile.botsson_channel_id` + workspace bootstrap | 🟢 — C1.d landed 2026-04-28 |
| Detox E2E + orb-polish | 🔴 — C1.c gjenstår |

Mobile sender alltid `Authorization: Bearer <supabase_access_token>` til `/api/emma/chat`, som så validerer via admin client (`/api/emma/chat/route.ts:70-77`) og forwardrer til stage-engine. Channel-pinning `chat`/`voice` settes server-side — klient kan ikke forge.

### 2.4 Channel-policy (ADR-0078) — 3-lags forsvar

Trippelt forsvar mot at PII (personnummer, bank, adresse, lønn) lekker over voice:

1. **Process `allowed_channels`** — engine_process kan kun aktiveres på sanksjonerte kanaler (DB-konstrant).
2. **Capability `allowedChannels`** — `payroll` (ADR-0256), `legal.validate_aml_14_6`, `contract*-mutations` markert `chat-only` i `CapabilityDefinition`. Tool-selector hard-gater før LLM ser tools'en.
3. **Tool-level `ctx.channel === "voice"` reject** — defence in depth. Returnerer "Av sikkerhetshensyn må dette skje i chat" på norsk.

Voice-agent forwardrer `channel: "voice"` på linje 75 i `services/voice-agent/src/adapter.ts`. Stage-engine `agent-router.ts` propagerer videre til alle capability-`execute(params, ctx)`-kall.

System-instruksjonen i `services/voice-agent/src/agent.ts:35-52` har eksplisitt forbud — Botsson skal redirecte til chat med `expand_orb` hvis bruker spør om PII over voice.

### 2.5 TLS / CA-trap (L-201, fikset 2026-05-03)

**Symptom:** `Room.connect()` feilet med `engine: signal failure: failed to retrieve region info: error sending request` på `node:22-slim` Dockerfile.

**Årsak:** Node sin innebygde `fetch()` bruker bundled CAs og fungerer fint, men `@livekit/rtc-node` Rust-bindingen leser OS CA-store og feiler uten `ca-certificates`.

**Fix:** `RUN apt-get install ca-certificates` i Stage 2 av Dockerfile (linje 33-35). Verifisert via "container registers with LiveKit"-sjekk + Room.connect HTTPS-path.

### 2.6 dev-startup.sh — voice-spor

`scripts/dev-startup.sh` håndterer alt med `op run --env-file=.env.template`-wrapping:

- Linje 109: `op run -- npx supabase start` (slik at `config.toml`-`env(LIVEKIT_*)` interpolation resolverer mot 1Password-injected shell, ellers booter `edge_runtime` uten `LIVEKIT_API_KEY` → livekit-token returnerer 500). L-201 fra 2026-05-03 fikset.
- Linje 124-141: explicit edge-runtime crash-detection + restart.
- Linje 354-355: `cd services/voice-agent && nohup op run --env-file=.env.template -- pnpm dev` — voice-agent starter med `op run` mot egen `.env.template` som mapper `LIVEKIT_URL` (ikke `NEXT_PUBLIC_LIVEKIT_URL`).

---

## Del 3 — Scope & Roadmap

### 3.1 Aktive campaigns (parallelle worktrees)

`git worktree list` shower 12+ aktive campaigns. Status per 2026-05-04:

| Campaign | Worktree | Plan | Hovedfokus |
|----------|----------|------|-----------|
| **botsson-arena** | `~/dev/smartout.ai-botsson-arena` | `CAMPAIGN-botsson-arena.md` | Phase A-D harness reparasjon. Aktiv. |
| **journey-engine** | `~/dev/smartout.ai-journey-engine` | `CAMPAIGN-journey-engine.md` | M3.5 levert; ADR-0171–0177 alle accepted; v1.7.0 bound |
| **helpdesk** | `~/dev/smartout.ai-helpdesk` | `CAMPAIGN-helpdesk.md` | Phase 1 UI levert; Phase 1.1 cleanup + Phase 2 (SLA via `engine_delayed_trigger`) |
| **bubble-migration** | `~/dev/smartout.ai-bubble-migration` | `CAMPAIGN-services.md`* | 3 WS migrert til Local. Backport-sortie BM-01/BM-02 + 8 P3 schema-fixes pending |
| **mobile** | `~/dev/smartout.ai-mobile` | — | 4-tab-restorering. `mobile-restore-4tab-plan` foreslått (delete digest+(komm), restore Hjem/Vakter/[FAB]/Chat/Meg) |
| **lovsen** | `~/dev/smartout.ai-lovsen` | `CAMPAIGN-lovsen.md` | Norsk arbeidsrett MCP (lovdata, arbeidstilsynet, mattilsynet, NHO-reiseliv) |
| **payroll** | `~/dev/smartout.ai-payroll` | `CAMPAIGN-payroll.md` | ADR-0256 + payroll capability skeleton i registry |
| **schedule-harness** | `~/dev/smartout.ai-schedule-harness` | `CAMPAIGN-schedule-harness.md` | Wrong-day-bug + D2 follow-up |
| **daily-operation** | `~/dev/smartout.ai-daily-operation` | `CAMPAIGN-daily-operation.md` | D6 + WebDayControl evolusjon |
| **core-module** | `~/dev/smartout.ai-core-module` | `CAMPAIGN-core-module.md` | Kjernemodul-konsolidering |
| **order-system** | `~/dev/smartout.ai-order-system` | `CAMPAIGN-order-system.md` | admin.smartout.ai (PR #307 merged); Vercel + DNS + env-sync pending |
| **services** | `~/dev/smartout.ai-services` | `CAMPAIGN-services.md` | Backend-tjenester (strike-mcp, bubble-migration emit chain) |
| **year-wheel** | (avsluttet?) | `CAMPAIGN-year-wheel.md` | Shell-replacement per ADR-0164. Phase 1.1 deferred (activation-gate, missing-checklist, Activate/Archive/Duplicate, Goals tab, Procedures tab) |

### 3.2 Near-term (2-4 uker) — konkrete sortier

**Fra STATE-SUMMARY P0 + Phase A-D unfinished + L-201 follow-ups:**

1. **Phase 0 helpdesk_query_lifecycle dispatcher fix** — to bugs i `20260515130200`: (a) `wait_for_event` bruker `action_payload.event_type` mens dispatcher matcher `action_payload.event` (linje 419 i `engine-dispatch/index.ts`); (b) ingen `engine_trigger`-rad mapper `helpdesk.query.opened` → `helpdesk_query_lifecycle`. P0-blocker for Phase 2.
2. **Mobile LiveKit C1.c** — Detox E2E + orb-polish. Voice-spor ellers ferdig (token + transcript + bootstrap landet).
3. **journey_authoring publishDraft delegation (ADR-0240)** — fjern 3 direkte writes på linje 443-481, deleger til `journey.publish_mission`. Phantom contract.
4. **Form-view + Video-view i Arena** — implementer reelle visninger (Phase D-overhead som er rett-fram).
5. **Generator API-flate (Phase C2)** — eksponere 4 generatorer på `/api/.../generate`. Pure functions finnes; kun HTTP-flate mangler.
6. **Build-perf Wave 1 follow-up** — `next.config.ts:72-134` har webpack-only alias-blokk (12 `@smartout/ai/*` subpath aliases). Test om Turbopack på Next 16.1.6 håndterer subpath-exports natively (preferred), eller port aliasene til `turbopack.resolveAlias`.

### 3.3 Medium-term (5–12 uker)

1. **ADR-0246 Phase A0–A4a — engine_state vs engine_sessions ontologi** — schema reconciliation + dual-write + backfill + cutover. 5–6 uker honest cost. Blokkerer A4b emit (`journey.completed/stuck/run_failed`).
2. **Wave 2A Season Wizard migrering** — SeasonSetupStep → Server Action; telemetry fix; `gatedUpdate.entityIdColumn` required (Council 2026-04-18 APPROVE WITH CHANGES).
3. **Helpdesk Phase 2 — SLA via engine_delayed_trigger** — etter Phase 1.1 cleanup. ADR-0162 definerer mekanikk.
4. **EmmaProfile + Immersive backdrop (Phase D3)** — frontend-designer implementerer fra `docs/design/botsson/` Claude Design handoff-bundle.
5. **Schedule wrong-day diagnose + fix (D2)** — TZ-aware fixtures; reproduser bug. Tied til skjema fra `useShifts` / `useDepartmentShifts` / `useRoster` (sistnevnte er odd-one-out, filterer `.eq("department_id")` direkte og misser NULL-rader).
6. **kb_query SLO + UI consumer** — capability registrert, intent-binding wired, men "surface-untested (no UI consumer outside helpdesk Phase 1 yet)". /dashboard/help v1 M1 G1 lukket; M2+ surface-bygging.
7. **Trust-freeze Mobile Trust Gate** — 12-uker remediation plan fra Council 2026-04-17. Telemetry contract test, Zod at enqueue, Botsson bridge ADR+stub.

### 3.4 Horizon (>12 uker)

1. **Phase A4b emit producer** — blokkert av tre gates: (a) ADR-0248 accepted, (b) B5 action-handlers i `engine-dispatch/`, (c) consumer registrert i `packages/telemetry/src/registry.ts`. Til alle tre passer = ingen kode.
2. **Phase F External Adapters (Tripletex first)** — placeholder finnes; Wrightegaarden pilot cutover prep (135 profiles, 2750 shifts); 2 upstream gaps (STYRK-08 code, employment_form).
3. **Helpdesk Phase 3 — call recording via LiveKit** — blokkert på ADR-0135 acceptance.
4. **Multiple permissive policies refactor (2311 lints)** — Supabase perf-lint baseline 2026-05-04. Krever ADR (refaktorerer load-bearing dual-auth-konvensjon).
5. **Bubble-migration produksjon-cutover** — auth-bridge Phase B + Cloud + pgsodium + PII typed columns. Separat sortie etter campaign-merge.
6. **K1a industripakker utover hospitality** — kun hospitality.ts seedet i dag.

### 3.5 Kjente blockers

| Blocker | Konsekvens | Eier |
|---------|-----------|------|
| **ADR-0246 ontologi** | Phantom-emit gap; 27+ konsumer-sites på `engine_sessions`; A4b emit kan ikke skrives | system-agent-coordinator + botsson-arena |
| **ADR-0238 dual-surface UX** (proposed) | Sider med embedded chat (`/platform-admin/journeys/wizard/*`, `/platform-admin/helpdesk-preview/*`, `/dashboard/komm/*`, `/platform-admin/communications/compose/*`) viser to AI-chat-flater uten label → silent misroute | frontend-designer + botsson-arena |
| **`journey_authoring.publishDraft` phantom contract** (ADR-0240) | Tool deklarerer ADR-0204-compliance i docstring, body bryter. Dead-code i dag, men phantom-timebomb | botsson-harness-builder |
| **gate_action default-allow (CVE-class side-finding)** | Council 2026-04-19 helpdesk-runde fant default-allow i ad-hoc agent-router. Layer 1 silent. | system-steward |
| **🔴-poster fra MAP** | Form-view, Video-view, EmmaProfile, Immersive backdrop, Generator API, Mobile LiveKit C1.c, Helpdesk Phase 0 dispatcher fix | per-blocker-eier (se 3.2) |
| **Dual-gate divergence (`gate_action` vs `cascade_gate_write`)** | Samme logiske mutasjon kan gå via to gates med ulikt utfall. ADR-0204 mitigation, ADR-0231 dedup, men reconciliation-ADR mangler fortsatt | code-architect |
| **ADR-0135 (mobile-voice-via-livekit) status `proposed`** | Implementert men ikke ratifisert. Helpdesk Phase 3 blokkert til den er accepted | system-agent-coordinator |

### 3.6 Hva vi IKKE jobber med (eksplisitt)

Fra `CAMPAIGN-botsson-arena.md` Out-of-Scope:

- Ingen ny runtime/framework. Stage Engine + Hono + Vercel AI SDK + OpenRouter står.
- Ingen Ultravox → LiveKit migrering på web. Web beholder Ultravox; mobil kjører LiveKit.
- Ingen voice-for-PII capabilities. Permanent forbud per ADR-0077 / 0078.
- Ingen mobile authoring UIs. ADR-0133 binder.
- Ingen nye agent-modi/personas/missions utover de 6 registrerte (Sixten er en separat orchestrator-persona, ikke en mission).
- Ingen K1a industripakker utover hospitality (deferred).

---

## Vedlegg

### A. Kildeliste (verifisert mot kode 2026-05-04 @ commit 3f6e657f)

- `docs/architecture/BOTSSON-SYSTEM-MAP.md` — autoritativ pipe-diagram (oppdatert 2026-04-30)
- `docs/architecture/INVARIANTS.md` — 10 CI-håndhevde invariants
- `docs/STATE-SUMMARY.md` — current priorities (2026-04-20)
- `docs/decisions/0078-engine-process-channel-restriction.md` — ADR-0078 channel guard
- `docs/decisions/0099-unified-authority-gate.md` — ADR-0099 gate_action
- `docs/decisions/0132-mobile-thin-client-via-web-bff.md` — ADR-0132
- `docs/decisions/0133-web-composes-mobile-executes.md` — ADR-0133
- `docs/decisions/0134-mobile-telemetry-contract-enforcement.md` — ADR-0134
- `docs/decisions/0135-mobile-voice-via-livekit-not-ultravox.md` — ADR-0135 (proposed)
- `docs/decisions/0151-stage-engine-profile-id-server-derivation.md` — ADR-0151
- `docs/decisions/0173-journey-capability-model.md` — ADR-0173 frozen-4
- `docs/decisions/0186-guardian-bus-pg-notify.md` — ADR-0186
- `docs/decisions/0204-gated-mutation-composition-orchestrator.md` — ADR-0204
- `docs/decisions/0238-botsson-surface-disambiguation.md` — ADR-0238 (proposed)
- `docs/decisions/0240-journey-authoring-tool-boundary.md` — ADR-0240 (proposed)
- `docs/decisions/0246-engine-state-vs-engine-sessions-ontology.md` — ADR-0246 (proposed)
- `services/stage-engine/src/index.ts` — bootstrap, route-registry, recorder-singleton, pg_notify, mission-pool, sixten-orchestrator
- `services/stage-engine/src/routes/agent/chat.ts:94-323` — `/agent/chat` med JWT-derive-profile + wizard fail-closed
- `services/stage-engine/src/core/agent-router.ts:84-100` — `buildClassifierContext`
- `services/stage-engine/src/core/derive-profile-id.ts` — ADR-0151 implementasjon
- `services/voice-agent/Dockerfile` — ca-certificates fix linje 33-35
- `services/voice-agent/src/agent.ts:56-126` — entry-point
- `services/voice-agent/src/adapter.ts:53-114` — `ask()` bridge mot stage-engine
- `services/voice-agent/src/tools-capability.ts:27-252` — 10 capability-query tools + fallback
- `apps/web/src/app/api/botsson/voice/token/route.ts:33-121` — LiveKit token mint
- `apps/web/src/app/api/emma/chat/route.ts:91-244` — BFF dual-auth (cookie + Bearer) + channel-pinning
- `apps/web/src/app/Botsson/_components/BotssonVoiceCall.tsx:64-235` — Orb-mount klient
- `packages/ai/src/capabilities/registry.ts:1-109` — 25 capabilities + emitPrefix collision check
- `scripts/dev-startup.sh:90-115, 333-355` — op run wrap + voice-agent start

### B. Verifiseringsstatus

| Tema | Status |
|------|:------:|
| Capability-tellingen i `BOTSSON-SYSTEM-MAP.md` (14) | 🟡 — stale; faktisk = 25 i `registry.ts`. Bør oppdateres i samme commit. |
| ADR-0246 Phase A0–A4a code-spec | 🟡 — proposed, ikke akseptert. Implementeringsplan finnes, ikke kode. |
| `journey_authoring.publishDraft` direkte writes (ADR-0240) | 🔴 — proposed; phantom contract i koden, dead-code i dag. |
| Mobile LiveKit C1.c Detox E2E | 🔴 — ikke verifisert i denne runden. |
| Schedule wrong-day-bug rotårsak | 🔴 — ikke diagnostisert i denne runden. |
| `gate_action` default-allow (CVE-class) | 🔴 — Council-side-finding 2026-04-19, ikke fikset. |

---

## Oppdateringsrutine

Dette dokumentet skal oppdateres når:

- En ny ADR (proposed → accepted) endrer pipe-mønstre.
- Et nytt voice-spor legges til (eller ett av eksisterende endrer transport).
- En blocker fra §3.5 lukkes (oppdater status + flytt til "completed").
- Nye campaigns startes som påvirker harness-laget.

Hvis kode og dokument er uenige — kode vinner. Oppdater dokumentet i samme commit som koden endres.

---

## Linked from

- [`docs/architecture/BOTSSON-SYSTEM-MAP.md`](./BOTSSON-SYSTEM-MAP.md) (lenkes som "full arkitektsbeskrivelse")
- [`docs/INDEX.md`](../INDEX.md) — Architecture-seksjonen

## Linked to

- [`docs/architecture/STAGE-ENGINE.md`](./STAGE-ENGINE.md) — dybde-dokumentasjon på Stage Engine, Sessions, Guardian og Whispers (lag-detalj for §1.3)
