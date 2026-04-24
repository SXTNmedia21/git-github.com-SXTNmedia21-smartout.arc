---
title: "Botsson System Map — End-to-End Pipe Diagram"
status: canonical
updated: 2026-04-24
last_phase_closed: D1 (Session Recorder + Platform Admin Intervention — ADR-0184, ADR-0185)
last_refresh: 2026-04-24 (Council 2026-04-24 L-0138 caught drift: capability-count 14→17, dispatch-branch-count 17→29, helpdesk_query status, executeSubagent non-existence)
created: 2026-04-22
module: MODULE_BOTSSON
tags: [botsson, stage-engine, architecture, map, gaps, status]
---

# Botsson System Map

> **Formål:** Én dør inn til "hvor henger ting sammen, hva fungerer, hva er brutt". Lenkes fra alle relevante docs. Oppdateres når noe kobles opp eller brytes av.
>
> **Fargekoder:**
> - 🟢 **GRØNT** — finnes og er koblet end-to-end
> - 🟡 **GULT** — finnes, men bare halvt koblet / drifter / mangler en fase
> - 🔴 **RØDT** — **finnes ikke** eller er designet men aldri bygget
>
> Autoritativ kilde for Botsson-kampanjen. Se `docs/plans/CAMPAIGN-botsson-arena.md` for aktiv sprint.

---

## 0. TL;DR — hvor vi står i dag

Smartout har **bygget mye riktig**, men koblingene mellom delene er **ikke ferdige**. Motoren (Stage Engine) fungerer, verktøyene (capabilities) fungerer, overlayen (Arena) fungerer. Men:

- ~~Emma **husker ikke** (memory writer mangler)~~ → **FIKSET Phase A3 (2026-04-22)** — `memory` capability registrert med `save_memory` tool, gated via `gate_action` + chat-only per ADR-0078
- ~~Vi kan **ikke rekonstruere** hva som skjedde i en sesjon (session recorder mangler)~~ → **FIKSET Phase D1 (2026-04-22)** — Session Recorder landed via ADR-0184 + ADR-0185. `agent_session_recording` + `agent_session_envelope` + `agent_session_whisper` tabeller, 4 BFF endpoints (flag/whisper/session-dump/break-glass), hooks i prompt-builder + agent-router + authority + guardian + memory. Platform Admin UI-komponenter bygget (SessionList wired; TurnTimeline + AdminActionDrawer pending composition i Phase 2).
- ~~Guardian snakker til en **buss ingen lytter på**~~ → **FIKSET Phase A6 (2026-04-22)** — in-process Set erstattet med `pg_notify('guardian_events')` via trigger på `guardian_log`. ADR-0186.
- **Ingen CI-gate** stopper regressions

Det er hvorfor ting "plutselig slutter å fungere". Vi har ingen evidence-layer som gjør regressions synlige.

> **Invariants:** see [`INVARIANTS.md`](./INVARIANTS.md) — 9 harness invariants with CI enforcement status. Same 🟢/🟡/🔴 convention as this map.

---

## 1. Lagkartet — fra det brukeren ser til det som persisterer

```
┌──────────────────────────────────────────────────────────────────┐
│  L1  OVERFLATE — det brukeren rører                              │
│       Arena / Sticky / Orb / Immersive                           │
│       apps/web/src/app/Botsson/_components/                      │
└──────────────────────────────────────────────────────────────────┘
                    │ user message / voice turn
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L2  BFF — Next.js API routes i web-appen                        │
│       /api/botsson/chat                                          │
│       /api/emma/{chat, history, memory, notes, tasks}            │
│       apps/web/src/app/api/botsson + /api/emma                   │
└──────────────────────────────────────────────────────────────────┘
                    │ proxy to backend
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L3  STAGE ENGINE — Hono-service port 5010                       │
│       services/stage-engine/src/                                 │
│                                                                  │
│   ┌────────────┬────────────┬─────────────┬──────────────┐       │
│   │ Session    │ Stage      │ Prompt      │ Agent        │       │
│   │ Manager    │ Manager    │ Builder     │ Router       │       │
│   └────────────┴────────────┴─────────────┴──────────────┘       │
│   ┌────────────┬────────────┬─────────────┬──────────────┐       │
│   │ Guardian   │ Memory     │ Relationship│ Inbox        │       │
│   │ Evaluator  │ Manager    │ Manager     │ Writer       │       │
│   └────────────┴────────────┴─────────────┴──────────────┘       │
└──────────────────────────────────────────────────────────────────┘
                    │ tool dispatch
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L4  CAPABILITIES — Emmas verktøykasse (14 registrerte)          │
│       packages/ai/src/capabilities/*                             │
│       profile · ui · guardian · schedule · operations            │
│       communication · contract · contract_intake · shift_swap    │
│       operations_intelligence · training · shift_lifecycle       │
│       governance · billing_query                                 │
└──────────────────────────────────────────────────────────────────┘
                    │ DB writes via gate_action / Server Actions
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L5  PERSISTENCE — Supabase Postgres                             │
│       engine_process · engine_state · engine_state_step          │
│       engine_event · engine_memory · engine_authority_config     │
│       activity_trail · channel_event · channel_ai_policy         │
│       + alle domain-tabeller (schedule_shift, department, …)     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Status per komponent (detaljert)

### L1 — OVERFLATE (Arena/Sticky/Orb/Immersive)

| Komponent | Fil | Status | Merknad |
|-----------|-----|:------:|---------|
| BotssonShell (morphing div) | `apps/web/src/app/Botsson/_components/BotssonShell.tsx` | 🟢 | Magnetic edges, drag, throw-to-dismiss, resize — fungerer |
| BotssonOrb (6 states) | `.../BotssonOrb.tsx` | 🟢 | Idle/listening/thinking/speaking/notification + unread badge |
| BotssonSticky (retract, peek, hover) | `.../BotssonSticky.tsx` | 🟢 | 4s retract, neon sliver, hover controls |
| BotssonArena (12 views) | `.../BotssonArena.tsx` | 🟡 | **Form-view + Video-view er placeholders** — viser bare strengen "Skjema"/"Video" |
| Chat view (admin-chat) | `.../BotssonChat.tsx` | 🟢 | Wired til `/api/botsson/chat` |
| Voice visualizer | `.../BotssonArena.tsx` (VisualizerView) | 🟢 | 4 konsentriske lag, aurora, particles |
| Notepad med markdown | `.../BotssonArena.tsx` (NotepadView) | 🟢 | Sidebar, tags, checkbox, @mentions |
| Tasks med priority/deadline | `.../BotssonArena.tsx` (TasksView) | 🟢 | Priority cycling, inline datetime picker |
| Calculator | `.../BotssonArena.tsx` (CalculatorView) | 🟢 | Keyboard support, expression parsing |
| Settings view | `.../BotssonArena.tsx` (SettingsView) | 🟡 | Expander til 75% viewport, layout trenger polish |
| Log view (tool calls + telemetri) | `.../BotssonArena.tsx` (LogView) | 🟡 | Viser live events, men **kan ikke hente historisk**. Hover-flag per rad → `POST /api/botsson/recorder/flag-log-entry` (Phase 2b landet 2026-04-22). Endepunktet resolver session_id server-side fra brukerens nyligste turn (agent-sdk eksponerer ikke sessionId til klienten); tomt respons-session_id logges likevel som escaleringsintensjon i `activity_trail`. |
| Memory view | `.../BotssonArena.tsx` (MemoryView) | 🟢 | Leser `/api/emma/memory`. Phase A3 landet `memory` capability + writer — view fylles opp etter hvert som agenten lagrer minner (scope=`personal`, `conversation`, m.fl.) |
| History view (transcript) | `.../BotssonArena.tsx` (HistoryView) | 🟢 | Per session |
| **Signature Emma-illustrasjon** | `docs/design/botsson/project/components/emma.jsx` → `EmmaProfile.tsx` | 🔴 | **Ikke implementert.** Kun bokstaven "E" på gradient i dag. Mockup finnes i Claude Design handoff — frontend-designer implementerer (Phase D3). |
| **Immersive backdrop** | `docs/design/botsson/project/components/immersive.jsx` → `BotssonShell.tsx` | 🔴 | **Ikke implementert.** Bare radius 0, ingen bakgrunnsdesign. Mockup finnes i Claude Design handoff — frontend-designer implementerer (Phase D3). |
| **Overlay pixel-parity audit** | `docs/design/botsson/project/**` vs `apps/web/src/app/Botsson/_components/` | 🟡 | **Handoff-bundle lastet ned 2026-04-22** (Claude Design). Arena/Orb/Sticky finnes men ikke validert mot mockup. Plan: `docs/plans/PLAN-botsson-overlay-implementation.md`. |

### L1 — PLATFORM ADMIN (recorder intervention surfaces)

Landed via ADR-0184 + ADR-0185 (Phase D1, 2026-04-22). Se `docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md` for design-kilde.

| Komponent | Fil | Status | Merknad |
|-----------|-----|:------:|---------|
| `useRecorderSessions` hook | `apps/web/src/app/platform-admin/guardian/_hooks/useRecorderSessions.ts` | 🟢 | Realtime + REST-fallback mot `agent_session_recording`. Godmode-read (no workspace filter) — RLS filtrerer. |
| SessionList (recorder overlay) | `.../_components/SessionList.tsx` | 🟢 | Turn-count + flag-count + attention-score-pill rendres per rad når recorder-data finnes. Wired inn i GuardianMonitor. |
| RedactedPill (PII reveal) | `.../_components/RedactedPill.tsx` | 🟡 | Komponent bygget. `onReveal` → `/api/botsson/recorder/break-glass/[envelope_id]`. **Ikke komponert inn i TurnCard ennå** (Phase 2c — full replay-surface per-turn PII-reveal). |
| TurnCard (expandable turn) | `.../_components/TurnCard.tsx` | 🟢 | Phase-badge + verdict-tint + hover-flag icon (opacity 0→100 200ms). Wired inn i TurnTimeline. Phase 2b (2026-04-22). |
| TurnTimeline (session replay) | `.../_components/TurnTimeline.tsx` | 🟢 | Fetcher `/api/botsson/recorder/sessions/[id]` + rendrer TurnCards. Wired inn i GuardianMonitor via Replay-tab. Phase 2b (2026-04-22). |
| AdminActionDrawer (whisper/flag/force-stop) | `.../_components/AdminActionDrawer.tsx` | 🟢 | POST til `/whisper`, `/flag-session` og `/force-stop` fungerer end-to-end (Phase 2a). Wired inn i GuardianMonitor via Actions-knapp. Phase 2b (2026-04-22). |
| GuardianMonitor (composition host) | `.../_components/GuardianMonitor.tsx` | 🟢 | 3-panel layout med Info/Replay-tab-switcher + Actions-launcher i høyre pane. Renders TurnTimeline når Replay aktiv; mounter AdminActionDrawer ved knappeklikk. Phase 2b (2026-04-22). |

### L2 — BFF ROUTES

| Endepunkt | Fil | Status | Merknad |
|-----------|-----|:------:|---------|
| `POST /api/botsson/chat` | `apps/web/src/app/api/botsson/chat/route.ts` | 🟢 | Admin chat — workspace-scoped |
| `POST /api/emma/chat` | `apps/web/src/app/api/emma/chat/route.ts` | 🟢 | — |
| `GET /api/emma/history` | `apps/web/src/app/api/emma/history/route.ts` | 🟢 | — |
| `GET /api/emma/memory` | `apps/web/src/app/api/emma/memory/route.ts` | 🟢 | Leser `engine_memory`. Phase A3 landet `memory` capability + writer — tabellen fylles opp når agenten kaller `save_memory` |
| `GET/POST /api/emma/notes` | `apps/web/src/app/api/emma/notes/route.ts` | 🟢 | — |
| `GET/POST /api/emma/tasks` | `apps/web/src/app/api/emma/tasks/route.ts` | 🟢 | — |
| `POST /api/botsson/recorder/flag` | `apps/web/src/app/api/botsson/recorder/flag/route.ts` | 🟢 | Per-turn flag. Utvider retention 90d → 365d. Emitter `recorder.turn_flagged`. Phase D1 (ADR-0184). |
| `POST /api/botsson/recorder/whisper` | `apps/web/src/app/api/botsson/recorder/whisper/route.ts` | 🟢 | Admin-injeksjon til neste turn. C4-gated via `engine_authority_config.recorder.whisper`. Phase D1 (ADR-0185). |
| `GET /api/botsson/recorder/sessions/[id]` | `apps/web/src/app/api/botsson/recorder/sessions/[id]/route.ts` | 🟢 | Session dump — alle turns sortert på `turn_index`. Phase D1 (ADR-0184). |
| `GET /api/botsson/recorder/break-glass/[envelope_id]` | `apps/web/src/app/api/botsson/recorder/break-glass/[envelope_id]/route.ts` | 🟢 | PII-decrypt via `decrypt_envelope` RPC. 5s UI-vindu + audit i `activity_trail`. Krever `is_godmode` + `recorder.pii_reveal='confirm'`. Phase D1 (ADR-0185). |
| `POST /api/botsson/recorder/flag-session` | `apps/web/src/app/api/botsson/recorder/flag-session/route.ts` | 🟢 | Fan-out flag — setter `is_flagged=true` på alle `agent_session_recording`-rader for `session_id` + `workspace_id`. Emitter `recorder.session_flagged` med `flagged_turn_count`. Admin/owner-gate. Phase 2a (2026-04-22). |
| `POST /api/botsson/recorder/flag-log-entry` | `apps/web/src/app/api/botsson/recorder/flag-log-entry/route.ts` | 🟢 | Bruker-eskalering fra Arena LogView. Enhver autentisert rolle kan kalle. session_id resolves server-side fra brukerens nyligste turn (siste 30 min). Ingen DB-mutasjon — ren telemetri via `recorder.user_flag_submitted`. Phase 2b (2026-04-22). |
| `POST /api/botsson/recorder/force-stop` | `apps/web/src/app/api/botsson/recorder/force-stop/route.ts` | 🟢 | Admin nødbrems — inserter auto-generert "Previous turn interrupted by admin, begin fresh" som whisper; neste prompt-rebuild plukker den opp via `<admin_note>`-pipen. C4-gated via `recorder.force_stop`. Phase 2a (2026-04-22). **Design-note:** ADR-0185's `session_lane.status='interrupted'`-formulering er aspirasjonell — `SessionLane` er en in-memory promise-kø, ikke en tabell. Whisper-pipen matcher ADR-ens operasjonelle intensjon 1:1. |
| `GET /api/botsson/recorder/_metrics` | `apps/web/src/app/api/botsson/recorder/_metrics/route.ts` | 🟢 | Godmode-only proxy til stage-engine `/recorder/metrics` — returnerer `buffer_size` / `drop_count` / `error_count` / `recorder_blocking_emma` (alltid `false` per Q8b). For recorder-failure-resilience E2E. Phase 2a (2026-04-22). |
| **LiveKit transcript → BFF** (mobile voice) | `apps/web/src/app/api/emma/voice/transcript/route.ts` | 🟡 | **Phase C1 — server primitives landed (2026-04-24).** BFF route accepts `channel='voice'` (server-pinned), enforces `channel_ai_policy.voice_participation` defence-in-depth, proxies to stage-engine. `livekit-token` edge function gates on `voice_participation` for `purpose='ai_voice'`. Mobile hook `useVoiceTranscripts` listens to `RoomEvent.TranscriptionReceived` and POSTs final transcripts. 4 voice.* events registered. Voice-PII regression test locks `contract_intake` filter. **Phase C1.b landed (2026-04-24):** `useBotssonVoiceSession` hook (`apps/mobile/src/hooks/use-botsson-voice-session.ts`) mints `purpose='ai_voice'` token, creates LiveKit Room, attaches `useVoiceTranscripts`, speaks responses via `expo-speech` (`language: 'nb-NO'`). `BotssonProvider.startVoiceSession()` wired end-to-end; 6-state machine (`idle \| connecting \| listening \| thinking \| speaking \| error`) exposed via `voiceStatus`. 9 unit tests on pure orchestrators (`handleAgentResponse`, `performStart`). **Remaining:** workspace-bootstrap migration to seed `profile.botsson_channel_id` (blocks Jarvis demo); Detox E2E (C1.c); UI orb polish to consume fine-grained `voiceStatus` (frontend-designer). |
| **Generator API** (`/api/.../generate`) | — | 🔴 | **Phase C2.** 4 generatorer (journey-botsson, -doc, -e2e, -linear) finnes som pure functions, ingen HTTP-flate |

### L3 — STAGE ENGINE (services/stage-engine/src/)

| Modul | Fil | Status | Merknad |
|-------|-----|:------:|---------|
| Session Manager | `core/session-manager.ts` | 🟢 | Holder per-user session state |
| Agent Session | `core/agent-session.ts` | 🟢 | — |
| Session Lane | `core/session-lane.ts` | 🟢 | — |
| Stage Manager | `core/stage-manager.ts` | 🟢 | Stage chain, advance rules |
| **Prompt Builder** | `core/prompt-builder.ts` | 🟢 | Bygger + injiserer platform-admin whispers + recorder skriver prompt_built-turn. Phase D1 (ADR-0184 + ADR-0185 landed 2026-04-22). |
| **Agent Router** | `core/agent-router.ts` | 🟢 | Klassifier-kontekst fra `buildClassifierContext()` (role + department) — Phase A5 closed 2026-04-22 |
| **Admin Router** | `core/admin-router.ts` | 🟢 | — |
| **Authority gate** | `core/authority.ts` | 🟡 | Fungerer, men **dual-gate divergence** med Server Actions (Phase B1) |
| **Guardian Evaluator** | `core/guardian-evaluator.ts` | 🟡 | Evaluerer — men sender verdict til in-process bus (se under) |
| **Guardian Bus** | `core/guardian-bus.ts` + `core/pg-notify-bus.ts` | 🟢 | **Phase A6 landet 2026-04-22.** In-process `Set<ClientInfo>` erstattet med pg_notify. AFTER INSERT-trigger på `guardian_log` fyrer `pg_notify('guardian_events')`; stage-engine `LISTEN` broadcaster til WebSocket-klienter per instans. ADR-0186. |
| Calendar Guardian | `core/calendar-guardian.ts` | 🟢 | — |
| Operations Evaluator | `core/operations-evaluator.ts` | 🟢 | — |
| **Memory Manager** | `core/memory-manager.ts` | 🟢 | Leser `engine_memory` (reader siden 2026-03). Producer-side koblet Phase A3 (2026-04-22) via `packages/ai/src/context/memory-writer.ts` + ny `memory` capability. Stage-engine `saveMemory()` står fortsatt urørt (service-role helper for fremtidig session-summary writer). |
| Relationship Manager | `core/relationship-manager.ts` | 🟢 | — |
| Inbox Writer | `core/inbox-writer.ts` | 🟢 | — |
| Telegram Bridge | `core/telegram-bridge.ts` | 🟢 | Bruker pg_notify — referansemønster for guardian-bus |
| Webhook Sender | `core/webhook-sender.ts` | 🟢 | — |
| **Session Recorder** | `core/session-recorder.ts` | 🟢 | Fire-and-forget ring buffer + async flush. Hook-punkter: prompt-builder (prompt_built), agent-router (classifier I/O + llm_request/response), authority (authority_load), guardian-evaluator (guardian_eval), memory-manager (memory_read/write), tool exec. Recorder-feil blokkerer aldri Emma (ADR-0184 Q8b). Phase D1 (2026-04-22). |

### L3 — ROUTES (services/stage-engine/src/routes/)

| Route | Fil | Status | Merknad |
|-------|-----|:------:|---------|
| `advance.ts` | Stage advancement | 🟢 | |
| `fetch.ts` | Session fetch | 🟢 | |
| `sessions.ts` | Session CRUD | 🟢 | |
| `store.ts` | Store updates | 🟢 | |
| `guardian.ts` | Guardian endpoints | 🟢 | WebSocket → Guardian Bus (pg_notify siden Phase A6, 2026-04-22) |
| `agent/chat.ts` | Agent chat endpoint | 🟢 | Emitter `engine_event` + `activity_trail` |
| `ws.ts` | WebSocket | 🟢 | Ultravox transport |
| `health.ts` | Healthcheck | 🟢 | — |
| `recorder-metrics.ts` | Recorder introspection | 🟢 | **Phase 2a (2026-04-22).** `GET /recorder/metrics` leser `getBufferSize` / `getDropCount` / `getErrorCount` fra recorder-singleton + returnerer konstant `recorder_blocking_emma: false` (Q8b). Proksert fra web-BFF på `/api/botsson/recorder/_metrics` med godmode-gate. |
| **Session recorder route** | — | 🟢 | **Phase D1 (2026-04-22).** Session-dump håndteres BFF-side via `GET /api/botsson/recorder/sessions/[id]` (L2) med service-role read av `agent_session_recording`. Stage-engine har ingen egen route for session-dump — all lesing går gjennom BFF med RLS-policy. |

### L3 — STAGE ENGINE → profile_id derivation

| Gap | Status | Plan |
|-----|:------:|------|
| `profile_id` kommer fra request body (forgeable) | 🟢 | **FIKSET 2026-04-23 (harness-hardening Tasks 2+3+4)** — `/agent/chat` + `/sessions` server-derive profile_id via bearer-token → `deriveProfileId` helper; `AgentToolContext` brand widened to accept the derived value (ADR-0151 accepted, ADR-0193 scope amendment). CI invariant I4 (`invariants:server-actor`) blocks regressions that re-add `profile_id: z.string()` to any POST body schema. |

### L4 — CAPABILITIES (packages/ai/src/capabilities/)

**17 registrerte** i `capabilities/registry.ts` (verifisert 2026-04-24 Council L-0138 drift-check):

| Capability | Fil | Status | Merknad |
|------------|-----|:------:|---------|
| profile | `profile/` | 🟢 | |
| ui | `ui/` | 🟢 | |
| guardian | `guardian/` | 🟢 | Tools skriver via `emitGuardianEvent` → `guardian_log` → `pg_notify` (Phase A6 landet 2026-04-22, ADR-0186) |
| schedule | `schedule/` | 🟡 | **User-reported bugs: finner ikke alle dager, velger feil dag** — diagnose pending |
| operations | `operations/` | 🟢 | |
| communication | `communication/` | 🟢 | Leser engine_memory (compile-day-brief, briefing) |
| contract | `contract/` | 🟢 | |
| **contract_intake** | `contract-intake/` | 🟢 | **Phase A1 landet 2026-04-23.** `submit_field_group` + `decline_intake` kaller nå `callGateAction` før mutation (ADR-0099, Invariant 13). `gate.ts` speiler shift-lifecycle-templaten. 4 unit-tester (allow / deny / downgrade→suggest / four_eyes_required) + ADR-0138-kompatibel discriminated-union-retur. Se `docs/HANDOFF-contract-intake-gate-fix.md`. |
| shift_swap | `shift-swap/` | 🟢 | |
| operations_intelligence | `operations-intelligence/` | 🟡 | Leser engine_memory (predict-tools) |
| training | `training/` | 🟢 | |
| shift_lifecycle | `shift-lifecycle/` | 🟢 | 5-lag model (ADR-0095) |
| governance | `governance/` | 🟢 | |
| billing_query | `billing-query/` | 🟢 | |
| **memory** | `memory/` | 🟢 | **Phase A3 landet 2026-04-22.** Materialiserer `memory`-intenten som lenge var stub. `save_memory` tool: chat-only, gated via `gate_action`, PII-filter. Standardauthority = `read_only` (hidden) — workspaces må opte inn for at agenten skal skrive minner. |
| **helpdesk_query** | `helpdesk_query/` | 🟢 | **Phase B4 verified 2026-04-24.** Capability registrert i registry.ts:18+39, `CapabilityName` + intent-classifier enum dekker `helpdesk_query`. Authority seedet i 6/6 workspaces (`confirm` + `manager`, ingen default-allow). ADR-0165 `helpdesk_enabled` er primær discriminator; legacy `channel_type='desk'` kun i accept-OR for backfill-window (kommentert). 22/22 tests green inkl. 3 Invariant-12 artefact-assertions (falsifiability-probe bekreftet). Schema + seed migrations alle applied (B3 levert). |
| **journey** | `journey/` | 🟢 | Deles med `campaign/journey-engine`. Cross-campaign-koordinasjon kreves for endringer (ADR-0210). |

### L4 — ROUTER (packages/ai/src/router/)

| Modul | Fil | Status | Merknad |
|-------|-----|:------:|---------|
| Intent Classifier | `router/intent-classifier.ts` | 🟢 | Fôres med role/department-kontekst fra agent-router.ts — Phase A5 closed 2026-04-22 |
| Tool Selector | `router/tool-selector.ts` | 🟢 | |
| Min-role gate | `router/min-role.ts` | 🟢 | |
| **ADR-0112 coverage CI** | `packages/ai/scripts/check-intent-coverage.ts` | 🟢 | **Phase A4 closed 2026-04-23.** `invariants:intent-coverage` script + `harness-invariants` CI step. Wired into `lint`. Allow-list: `knowledge`, `payroll`, `general`. 13 unit tests. |

### L4 — MISSIONS (packages/ai/src/missions/)

6 registrerte i `missions/registry.ts`:

| Mission | ID | Status |
|---------|-----|:------:|
| Onboarding | `onboarding-interview` | 🟢 |
| Season lifecycle | `season-lifecycle` | 🟢 |
| Contract intake | (via contract agent) | 🟡 |
| Journey compilation | (via journey agent) | 🟢 |
| Schedule inspection | (via schedule agent) | 🟡 |
| Botsson admin | (via botsson agent) | 🟢 |

### L4 — AGENTS (packages/ai/src/agents/)

7 domain-agenter — wrapper rundt capabilities:

| Agent | Fil | Status |
|-------|-----|:------:|
| botsson | `agents/botsson.ts` | 🟢 |
| contract | `agents/contract.ts` | 🟢 |
| docs | `agents/docs.ts` | 🟢 |
| journey | `agents/journey.ts` | 🟢 |
| onboarding | `agents/onboarding.ts` | 🟢 |
| reports | `agents/reports.ts` | 🟢 |
| schedule | `agents/schedule.ts` | 🟡 |

### L4 — ADAPTERS (packages/ai/src/adapters/)

| Adapter | Fil | Status | Merknad |
|---------|-----|:------:|---------|
| Vercel AI SDK | `adapters/vercel-ai.ts` | 🟢 | OpenRouter |
| **LiveKit** | `adapters/livekit.ts` | 🟡 | Provider-stub i agent-sdk. Mobile-side bridge fra LiveKit Room → stage-engine landed Phase C1 (2026-04-24) via `apps/mobile/src/hooks/use-voice-transcripts.ts` + BFF `/api/emma/voice/transcript`. C1.b (2026-04-24): `useBotssonVoiceSession` eier hele LiveKit Room-livssyklusen på mobil (token mint → connect → mic publish → Expo Speech TTS). Adapter selv står fortsatt som stub — selve agentene snakker LiveKit indirekte via BFF, ikke via denne abstraksjonen. |

### L4 — GENERATORS (packages/ai/src/generators/)

4 pure functions — **ingen API-flate**:

| Generator | Fil | Status |
|-----------|-----|:------:|
| journey-botsson | `generators/journey-botsson.ts` | 🟡 |
| journey-doc | `generators/journey-doc.ts` | 🟡 |
| journey-e2e | `generators/journey-e2e.ts` | 🟡 |
| journey-linear | `generators/journey-linear.ts` | 🟡 |
| **API-route for generatorer** | — | 🔴 | **Finnes ikke.** Phase C2 |

### L5 — PERSISTENCE (Supabase)

| Tabell | Status | Merknad |
|--------|:------:|---------|
| `engine_process` (blueprints) | 🟢 | |
| `engine_state` (live instances) | 🟢 | |
| `engine_state_step` | 🟢 | |
| `engine_event` (workflow events) | 🟢 | |
| `engine_memory` | 🟢 | Tabell + reader + writer alle koblet. Phase A3 landet 2026-04-22 — `memory` capability skriver via `gate_action`. Embedding-kolonne forblir NULL inntil videre (retrieval ranker på importance, ikke similarity). |
| `engine_authority_config` (C4) | 🟢 | |
| `activity_trail` | 🟢 | Emittes per mutation (ADR-0116) |
| `channel_event` + `channel_ai_policy` | 🟡 | **Dead infra** — ingen konsumenter før Helpdesk Phase 1 wire-up (B3) |
| `gate_action` (RPC) | 🟡 | Virker isolert, men **dual-gate** med `cascade_gate_write` (Phase B1) |
| `cascade_gate_write` (RPC) | 🟡 | Samme |
| `agent_session_recording` | 🟢 | **Phase D1 landet 2026-04-22** via ADR-0184. Én rad per turn, JSONB `content_redacted` + `meta`, `turn_kind` + `phase` enums, `attention_score` (0-1), `is_flagged` boolean. Retention: redacted 90d / flagged 365d / metadata permanent. RLS: JWT admin-scope + godmode for platform-admin. |
| `agent_session_envelope` | 🟢 | **Phase D1 landet 2026-04-22** via ADR-0184. Pgcrypto-krypterte raw-verdier for break-glass PII reveal. TTL 30d via pg_cron. `redact_after` kolonne + `pii_class`. Dekrypteres via `decrypt_envelope` RPC (godmode-only). |
| `agent_session_whisper` | 🟢 | **Phase D1 landet 2026-04-22** via ADR-0185. Platform-admin injeksjoner til neste turn. `content` + `is_consumed` + `admin_profile_id`. `prompt-builder.ts` leser unconsumed whispers + wrapper i `<admin_note>`-tag. **Aldri user-facing** (ADR-0078 + ADR-0185 Trust Gate). |
| **`engine_delayed_trigger`** | 🟢 | Refurbished for helpdesk SLA (ADR-0162) |

### EngineActionType dispatch

`supabase/functions/engine-dispatch/index.ts` håndterer **29 case branches** (verifisert 2026-04-24 Council — tidligere map sa "17", det var stale).

### Missing EngineActionType handlers (Phase B5)

3 enum-verdier er definert, **men dispatcheren har ingen case**:

| Action Type | Status | Merknad |
|-------------|:------:|---------|
| `create_deviation` | 🔴 | HACCP Phase 2c blokkert |
| `validate_settlement` | 🔴 | Samme |
| `lock_checkout` | 🔴 | Samme |

### Subagent primitive (Council 2026-04-24 finding)

- `executeSubagent()` in-process: **finnes ikke** (0 grep hits i `packages/ai/**` og `services/stage-engine/**` per 2026-04-24)
- `action_type: run_subagent` i engine-dispatch: **finnes ikke** (0 grep hits per 2026-04-24)
- `start_process` case ved `engine-dispatch/index.ts:886-911` skriver allerede `engine_state` med `parent_state_id` + `depth+1` — cattle-primitivet eksisterer; wrapper gjør det ikke
- Botsson v2 (ADR-0206) foreslår subagent-cattle som wrapper over `start_process`. Scope: greenfield, ikke migrasjon

---

## 3. SESSION RECORDING — eget kart

**Status 2026-04-22 — Phase D1 landet.** Session Recorder er koblet end-to-end. Se ADR-0184 + ADR-0185.

```
Per turn fanges IDAG:                       Pending Phase 2c:
─────────────────────────────              ─────────────────────
• engine_event (workflow)      🟢          • E2E browser tests            🔴
• activity_trail (audit)       🟢            (drawer click → whisper,     🔴
• pino logger (stdout)         🟢             force-stop hold, replay     🔴
• Arena Log-view (live)        🟢             flag round-trip)            🔴
• Intent-classifier I/O        🟢          • Recorder failure injection   🔴
• Rå LLM request body          🟢            (Q8b assertion surface)      🔴
• Rå LLM response body         🟢          • RedactedPill in TurnCard     🟡
• Guardian verdict per turn    🟢          • Schedule wrong-day diagnose  🔴
• Authority load per turn      🟢            (D2 follow-up)               🔴
• Memory read/write per turn   🟢          Phase 2a endpoints (LANDED):
• Platform-admin whispers      🟢          • flag-session endpoint        🟢
• Tiered retention (90/30/365) 🟢          • force-stop endpoint          🟢
• Encrypted envelope for PII   🟢          • recorder _metrics endpoint   🟢
                                            Phase 2b UI (LANDED):
                                            • TurnTimeline composition    🟢
                                            • AdminActionDrawer wiring    🟢
                                            • flag-log-entry endpoint     🟢
```

**Delivered via ADR-0184 + ADR-0185 (Phase D1):**

1. ✅ `agent_session_recording` (JSONB) — én rad per turn, 8 `turn_kind` + 10 `phase`-verdier
2. ✅ `agent_session_envelope` — pgcrypto-krypterte raw-verdier for break-glass
3. ✅ `agent_session_whisper` — platform-admin injeksjoner
4. ✅ Hooks i prompt-builder + agent-router + authority + guardian-evaluator + memory-manager
5. ✅ `session-recorder.ts` fire-and-forget ring buffer (Emma aldri blokkert)
6. ✅ PII redact-on-write (regex) + audit-logged decrypt
7. ✅ BFF endpoints: flag, whisper, sessions/[id] dump, break-glass
8. ✅ `useRecorderSessions` hook + SessionList-overlay (godmode)
9. ✅ Platform Admin UI-komponenter bygget (TurnTimeline + TurnCard + RedactedPill + AdminActionDrawer)
10. ✅ Arena LogView hover-flag affordance
11. ✅ C4-authority seed (per workspace — NULL workspace_id avvik dokumentert i ADR-0185)
12. ✅ RLS: admin-scope JWT + godmode cross-workspace
13. ✅ Cron: ttl-sweep for envelope (30d) + redacted (90d) + flagged (365d)

**Phase 2a (landet 2026-04-22):**

- ✅ `/flag-session`, `/force-stop`, `/_metrics` endpoints bygget med fan-out flag, whisper-basert interrupt, og godmode metrics-proxy.

**Phase 2b (landet 2026-04-22):**

- ✅ TurnTimeline + AdminActionDrawer komponert inn i GuardianMonitor (Info/Replay tabs + Actions launcher).
- ✅ `/flag-log-entry` endpoint for Arena LogView user-eskalering (server-side session_id resolution, any role).
- ✅ Integration test for GuardianMonitor composition contracts.

**Phase 2c follow-ups:**

- RedactedPill komposisjon inn i TurnCard (per-turn PII-reveal i replay-surface).
- E2E browser tests: drawer click → whisper, force-stop hold, TurnTimeline flag round-trip.
- Recorder-failure-injection for E2E (ADR-0184 Q8b assertion surface).

**Source:** `docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md` · `docs/superpowers/plans/2026-04-22-session-recorder-platform-admin.md`

---

## 4. CAMPAIGN PHASE-BINDING

Kartet over speiler direkte fasene i `docs/plans/CAMPAIGN-botsson-arena.md`:

| Fase | Gap som tettes | Estimat |
|------|----------------|---------|
| **Phase A — Close open gates** | A1 contract-intake gate • A2 profile_id derivation • A3 **engine_memory writer** • A4 ADR-0112 CI • A5 intent-classifier context • A6 observability P0 | 2-3 uker |
| **Phase B — Wave 2B unblock** | B1 dual-gate reconciliation • B2 Season dual-emission • B3 Helpdesk Phase 1 migrations • B4 helpdesk_query registrering • B5 3 action handlers | 3-4 uker |
| **Phase C — Voice + generators + polish** | C1 mobile LiveKit wiring • C2 generator API routes • C3 Nordic Split audit | 4-6 uker |
| **Phase D — observability + diagnostics** | ✅ D1 **Session Recorder + Platform Admin Intervention** (landed 2026-04-22, ADR-0184 + ADR-0185) • ⬜ D2 Schedule capability diagnostics (wrong day bug) — Phase 2 • ⬜ **D3 Botsson Overlay pixel-parity implementation** (handoff `docs/design/botsson/`) | D1 done · D2/D3: 1-2 uker hver |

---

## 5. "Jeg trenger X — hvor leter jeg?"

| Trenger | Gå til |
|---------|--------|
| Se live tool-calls mens Emma jobber | Arena → Logg view (Context FAB) |
| Se hva Emma har "husket" | Arena → Minne view |
| Se hele samtalen | Arena → Historikk view |
| Endre persona / voice / temperatur | Arena → Emma-meny → Innstillinger |
| Se hva som er brutt i systemet | Denne filen (BOTSSON-SYSTEM-MAP.md) |
| Se aktiv sprint | `docs/plans/CAMPAIGN-botsson-arena.md` |
| Se Emma-vision / filosofi | `packages/Botsson/concepts/VISION.md` |
| Se design-token / farger / animasjoner | `.claude/skills/smartout-nordic-split/SKILL.md` + `docs/design/BOTSSON-OVERLAY-BRIEF.md` |
| Lese blueprint (ui-components / api-surface / data-contracts) | `packages/Botsson/blueprints/` |
| Lese ADR for agent-arkitektur | `docs/decisions/0042-*`, `0099-*`, `0112-*`, `0127-0135`, `0151-*`, `0160-0163` |
| Lese full state snapshot | `docs/plans/ROADMAP-ai-harness.md` |

---

## 6. Oppdateringsrutine

Denne filen oppdateres **hver gang**:

- En komponent går fra 🔴 → 🟡 → 🟢 (eller motsatt)
- En ny tabell eller route legges til i L1-L5
- En ADR skifter status som berører pipene
- En campaign-fase fullføres eller splittes

Endringer skal også reflekteres i:
- `docs/plans/CAMPAIGN-botsson-arena.md` (fase-binding)
- `docs/plans/ROADMAP-ai-harness.md` (evidence trail)

---

## 7. Linked from

Denne filen er lenket fra:

- `docs/INDEX.md` (master nav)
- `docs/ORIENTATION.md` (boot cheat sheet)
- `docs/plans/CAMPAIGN-botsson-arena.md` (aktiv sprint)
- `docs/plans/ROADMAP-ai-harness.md` (evidence trail)
- `packages/Botsson/INDEX.md` (Botsson-pakkerot)
- `CLAUDE.md` (prosjekt-root)

Hvis du finner denne uten å ha kommet via en av disse — den linken mangler, vennligst legg til.
