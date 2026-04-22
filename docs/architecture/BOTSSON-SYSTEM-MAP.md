---
title: "Botsson System Map — End-to-End Pipe Diagram"
status: canonical
updated: 2026-04-22
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
- Vi kan **ikke rekonstruere** hva som skjedde i en sesjon (session recorder mangler)
- Guardian snakker til en **buss ingen lytter på**
- **Ingen CI-gate** stopper regressions

Det er hvorfor ting "plutselig slutter å fungere". Vi har ingen evidence-layer som gjør regressions synlige.

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
| Log view (tool calls + telemetri) | `.../BotssonArena.tsx` (LogView) | 🟡 | Viser live events, men **kan ikke hente historisk** |
| Memory view | `.../BotssonArena.tsx` (MemoryView) | 🟢 | Leser `/api/emma/memory`. Phase A3 landet `memory` capability + writer — view fylles opp etter hvert som agenten lagrer minner (scope=`personal`, `conversation`, m.fl.) |
| History view (transcript) | `.../BotssonArena.tsx` (HistoryView) | 🟢 | Per session |
| **Signature Emma-illustrasjon** | `docs/design/botsson/project/components/emma.jsx` → `EmmaProfile.tsx` | 🔴 | **Ikke implementert.** Kun bokstaven "E" på gradient i dag. Mockup finnes i Claude Design handoff — frontend-designer implementerer (Phase D3). |
| **Immersive backdrop** | `docs/design/botsson/project/components/immersive.jsx` → `BotssonShell.tsx` | 🔴 | **Ikke implementert.** Bare radius 0, ingen bakgrunnsdesign. Mockup finnes i Claude Design handoff — frontend-designer implementerer (Phase D3). |
| **Overlay pixel-parity audit** | `docs/design/botsson/project/**` vs `apps/web/src/app/Botsson/_components/` | 🟡 | **Handoff-bundle lastet ned 2026-04-22** (Claude Design). Arena/Orb/Sticky finnes men ikke validert mot mockup. Plan: `docs/plans/PLAN-botsson-overlay-implementation.md`. |

### L2 — BFF ROUTES

| Endepunkt | Fil | Status | Merknad |
|-----------|-----|:------:|---------|
| `POST /api/botsson/chat` | `apps/web/src/app/api/botsson/chat/route.ts` | 🟢 | Admin chat — workspace-scoped |
| `POST /api/emma/chat` | `apps/web/src/app/api/emma/chat/route.ts` | 🟢 | — |
| `GET /api/emma/history` | `apps/web/src/app/api/emma/history/route.ts` | 🟢 | — |
| `GET /api/emma/memory` | `apps/web/src/app/api/emma/memory/route.ts` | 🟢 | Leser `engine_memory`. Phase A3 landet `memory` capability + writer — tabellen fylles opp når agenten kaller `save_memory` |
| `GET/POST /api/emma/notes` | `apps/web/src/app/api/emma/notes/route.ts` | 🟢 | — |
| `GET/POST /api/emma/tasks` | `apps/web/src/app/api/emma/tasks/route.ts` | 🟢 | — |
| **LiveKit transcript → BFF** (mobile voice) | — | 🔴 | **Phase C1** i kampanjen. Mobile voice kobler aldri til Stage Engine |
| **Generator API** (`/api/.../generate`) | — | 🔴 | **Phase C2.** 4 generatorer (journey-botsson, -doc, -e2e, -linear) finnes som pure functions, ingen HTTP-flate |

### L3 — STAGE ENGINE (services/stage-engine/src/)

| Modul | Fil | Status | Merknad |
|-------|-----|:------:|---------|
| Session Manager | `core/session-manager.ts` | 🟢 | Holder per-user session state |
| Agent Session | `core/agent-session.ts` | 🟢 | — |
| Session Lane | `core/session-lane.ts` | 🟢 | — |
| Stage Manager | `core/stage-manager.ts` | 🟢 | Stage chain, advance rules |
| **Prompt Builder** | `core/prompt-builder.ts` | 🟡 | Bygger, men **lagrer ikke** hva som ble bygget |
| **Agent Router** | `core/agent-router.ts` | 🟢 | Klassifier-kontekst fra `buildClassifierContext()` (role + department) — Phase A5 closed 2026-04-22 |
| **Admin Router** | `core/admin-router.ts` | 🟢 | — |
| **Authority gate** | `core/authority.ts` | 🟡 | Fungerer, men **dual-gate divergence** med Server Actions (Phase B1) |
| **Guardian Evaluator** | `core/guardian-evaluator.ts` | 🟡 | Evaluerer — men sender verdict til in-process bus (se under) |
| **Guardian Bus** | `core/guardian-bus.ts` | 🔴 | **In-process** — ingen cross-process lyttere. Skal erstattes med pg_notify (Phase A6) |
| Calendar Guardian | `core/calendar-guardian.ts` | 🟢 | — |
| Operations Evaluator | `core/operations-evaluator.ts` | 🟢 | — |
| **Memory Manager** | `core/memory-manager.ts` | 🟢 | Leser `engine_memory` (reader siden 2026-03). Producer-side koblet Phase A3 (2026-04-22) via `packages/ai/src/context/memory-writer.ts` + ny `memory` capability. Stage-engine `saveMemory()` står fortsatt urørt (service-role helper for fremtidig session-summary writer). |
| Relationship Manager | `core/relationship-manager.ts` | 🟢 | — |
| Inbox Writer | `core/inbox-writer.ts` | 🟢 | — |
| Telegram Bridge | `core/telegram-bridge.ts` | 🟢 | Bruker pg_notify — referansemønster for guardian-bus |
| Webhook Sender | `core/webhook-sender.ts` | 🟢 | — |

### L3 — ROUTES (services/stage-engine/src/routes/)

| Route | Fil | Status | Merknad |
|-------|-----|:------:|---------|
| `advance.ts` | Stage advancement | 🟢 | |
| `fetch.ts` | Session fetch | 🟢 | |
| `sessions.ts` | Session CRUD | 🟢 | |
| `store.ts` | Store updates | 🟢 | |
| `guardian.ts` | Guardian endpoints | 🟡 | Koblet på route-nivå, men output ingen lytter |
| `agent/chat.ts` | Agent chat endpoint | 🟢 | Emitter `engine_event` + `activity_trail` |
| `ws.ts` | WebSocket | 🟢 | Ultravox transport |
| `health.ts` | Healthcheck | 🟢 | — |
| **Session recorder route** | — | 🔴 | **Finnes ikke.** Ingen `GET /sessions/:id/recording` |

### L3 — STAGE ENGINE → profile_id derivation

| Gap | Status | Plan |
|-----|:------:|------|
| `profile_id` kommer fra request body (forgeable) | 🔴 | **ADR-0151** proposed. Phase A2. `docs/plans/PLAN-stage-engine-profile-id-derivation.md` |

### L4 — CAPABILITIES (packages/ai/src/capabilities/)

15 registrerte i `capabilities/registry.ts`:

| Capability | Fil | Status | Merknad |
|------------|-----|:------:|---------|
| profile | `profile/` | 🟢 | |
| ui | `ui/` | 🟢 | |
| guardian | `guardian/` | 🟡 | Tools finnes, men "write-verdict" skriver til in-process bus |
| schedule | `schedule/` | 🟡 | **User-reported bugs: finner ikke alle dager, velger feil dag** — diagnose pending |
| operations | `operations/` | 🟢 | |
| communication | `communication/` | 🟢 | Leser engine_memory (compile-day-brief, briefing) |
| contract | `contract/` | 🟢 | |
| **contract_intake** | `contract-intake/` | 🔴 | **Live ADR-0099-brudd.** `submitFieldGroup` bypasser `gate_action`. Phase A1. `docs/plans/PLAN-contract-intake-gate-fix.md` |
| shift_swap | `shift-swap/` | 🟢 | |
| operations_intelligence | `operations-intelligence/` | 🟡 | Leser engine_memory (predict-tools) |
| training | `training/` | 🟢 | |
| shift_lifecycle | `shift-lifecycle/` | 🟢 | 5-lag model (ADR-0095) |
| governance | `governance/` | 🟢 | |
| billing_query | `billing-query/` | 🟢 | |
| **memory** | `memory/` | 🟢 | **Phase A3 landet 2026-04-22.** Materialiserer `memory`-intenten som lenge var stub. `save_memory` tool: chat-only, gated via `gate_action`, PII-filter. Standardauthority = `read_only` (hidden) — workspaces må opte inn for at agenten skal skrive minner. |
| **helpdesk_query** | `helpdesk/` | 🔴 | **Ikke registrert**. Phase B4 — ADR-0160-0163 godkjent, schema-drafts ligger som `.sql.draft` |

### L4 — ROUTER (packages/ai/src/router/)

| Modul | Fil | Status | Merknad |
|-------|-----|:------:|---------|
| Intent Classifier | `router/intent-classifier.ts` | 🟢 | Fôres med role/department-kontekst fra agent-router.ts — Phase A5 closed 2026-04-22 |
| Tool Selector | `router/tool-selector.ts` | 🟢 | |
| Min-role gate | `router/min-role.ts` | 🟢 | |
| **ADR-0112 coverage CI** | `scripts/check-intent-coverage.ts` (forslag) | 🔴 | **Check er definert i ADR, script finnes ikke.** Phase A4 |

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
| **LiveKit** | `adapters/livekit.ts` | 🟡 | Finnes, men **ikke koblet mobilapp ↔ stage-engine** |

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
| **`agent_session_recording` (foreslått)** | 🔴 | **Finnes ikke.** Dette er hullet som gjør regression-debugging umulig |
| **`engine_delayed_trigger`** | 🟢 | Refurbished for helpdesk SLA (ADR-0162) |

### Missing EngineActionType handlers (Phase B5)

3 enum-verdier er definert, **men dispatcheren har ingen case**:

| Action Type | Status | Merknad |
|-------------|:------:|---------|
| `create_deviation` | 🔴 | HACCP Phase 2c blokkert |
| `validate_settlement` | 🔴 | Samme |
| `lock_checkout` | 🔴 | Samme |

---

## 3. SESSION RECORDING — eget kart

Brukeren spurte: "har vi ikke allerede en recorder?" Svaret: **halvparten finnes, men ingen sammenhengende flate**.

```
Per turn fanges dette IDAG:                Per turn MANGLER:
─────────────────────────────              ─────────────────────
• engine_event (workflow)      🟢          • Rå LLM request body      🔴
• activity_trail (audit)       🟢          • Rå LLM response body     🔴
• console logs (stdout)        🟡          • Intent-classifier I/O    🔴
• Arena Log-view (live)        🟡          • Guardian verdict per turn🔴
                                            • Full session replay file 🔴
                                            • Pinned date per turn     🔴
                                            • Model version + git SHA  🔴
```

**Hva som trengs (samle, ikke bygge nytt):**

1. Ny tabell `agent_session_recording` (JSONB) — én rad per turn
2. Hooks i **eksisterende** prompt-builder + agent-router + guardian-evaluator
3. BFF endpoint `GET /api/botsson/sessions/:id` → dump som JSON
4. Log-view i arenaen utvides med "Last opp gammel sesjon"-knapp
5. TTL 7 dager, RLS per workspace

**Plan:** Skrives som `docs/plans/PLAN-agent-session-recorder.md` (pending).

---

## 4. CAMPAIGN PHASE-BINDING

Kartet over speiler direkte fasene i `docs/plans/CAMPAIGN-botsson-arena.md`:

| Fase | Gap som tettes | Estimat |
|------|----------------|---------|
| **Phase A — Close open gates** | A1 contract-intake gate • A2 profile_id derivation • A3 **engine_memory writer** • A4 ADR-0112 CI • A5 intent-classifier context • A6 observability P0 | 2-3 uker |
| **Phase B — Wave 2B unblock** | B1 dual-gate reconciliation • B2 Season dual-emission • B3 Helpdesk Phase 1 migrations • B4 helpdesk_query registrering • B5 3 action handlers | 3-4 uker |
| **Phase C — Voice + generators + polish** | C1 mobile LiveKit wiring • C2 generator API routes • C3 Nordic Split audit | 4-6 uker |
| **Phase D (ny, foreslått)** | D1 **Session Recorder** • D2 Schedule capability diagnostics (wrong day bug) • **D3 Botsson Overlay pixel-parity implementation** (handoff `docs/design/botsson/`) | 1-2 uker + D3: 1-2 uker |

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
