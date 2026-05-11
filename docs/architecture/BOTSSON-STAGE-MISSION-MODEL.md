---
title: "Botsson — Stage + Mission Capability Model"
status: canonical
created: 2026-05-10
updated: 2026-05-10
verified_against_code: 2026-05-10
verified_against_db: 2026-05-10
module: MODULE_BOTSSON
tags: [botsson, missions, stages, capabilities, validation]
---

# Botsson — Stage + Mission Capability Model

> Single canonical source for stage chains, mission contracts, and per-mission tool/data requirements. Code wins over this doc; this doc wins over BOTSSON-SYSTEM-MAP for stage/mission specifics. Cross-checked against:
>
> - `packages/ai/src/missions/registry.ts` (code registry)
> - `engine_stages` table (DB seed)
> - `services/stage-engine/src/core/stage-manager.ts` (advancement logic)

---

## 1. Stage Engine model

Stage advancement is **per-mission, mode-driven**. Modes are sequential, free, or hybrid (per `stage-manager.ts`).

| Mode | Behavior |
|---|---|
| `sequential` | Stages run in registry order. Agent advances when current stage completes. Backward navigation forbidden. |
| `free` | Agent picks next stage. Stage advancement requires explicit `advance` request with target. |
| `hybrid` | Some stages are gates (sequential); others are free-choice. |

Stage table: `engine_stages`. Rows:

| Field | Note |
|---|---|
| `id` (UUID) | PK |
| `stage_id` (TEXT) | Slug, mission-unique |
| `mission_id` (TEXT) | FK to `engine_missions.id` |
| `stage_order` (INT) | Sequential ordering |
| `instructions` (TEXT) | Natural-language goal for agent |
| `success_criteria` (TEXT) | When stage is complete |
| `tuning_notes` (TEXT) | Personality + creative-freedom hints |
| `tools_available` | Per-stage tool subset (optional) |

**No `workspace_id` on `engine_stages`.** Tenant isolation via `mission_id → engine_missions.workspace_id`. ADR-0042 model.

---

## 2. Mission registry — canonical truth

**Code-side: 7 missions in `packages/ai/src/missions/registry.ts`.**

### 2.1 onboarding-interview — Botsson (Onboarding wizard)

| Field | Value |
|---|---|
| Agent | Botsson |
| firstSpeaker | agent |
| Stages (DB) | **8 stages** seeded in `engine_stages` |
| Stage chain | sequential |
| Voice | Norwegian default |
| Capabilities | `onboarding` (10 tools), `memory` (alias `add_key_fact` → `save_memory`), `business_intelligence` (BRREG search via bridge) |
| Data model | Mostly IN-MEMORY wizard state until `finalize-workspace` Edge Function (ADR-0123 exception to ADR-0179 pre-workspace) |
| BFF entry | `/api/wizard/start` (issues LiveKit room token via `livekit-token` EF with `purpose: "wizard"`) |
| Validation | 4 vitest cases for wizard/start (forge-rejected, match-accepted, omit-derives, onboarding-passthrough) |
| Status | 🟢 implemented, Phase E rewrite landed 2026-05-10 |

### 2.2 mr-botsson — Mr. Botsson (Daily-ops dashboard assistant)

| Field | Value |
|---|---|
| Agent | Mr. Botsson |
| firstSpeaker | user |
| Stages | none (single-prompt; dynamic via posture system) |
| Voice | mark / sarah / coral options (post-Phase-E LiveKit Realtime voice IDs) |
| Capabilities | All 29 caps available, gated per workspace via `engine_authority_config`. Heavily uses: `profile`, `schedule`, `operations`, `communication`, `personal`, `availability`, `engine_world`, `memory` (when G1 closes), `helpdesk_query`, `kb_query`, `tips`, `shift_swap`, `shift_lifecycle`, `season`, `governance`, `training` |
| Prompt assembly | `buildBotssonPromptFromContext()` + `<world_state>` + `<user_memories>` + posture overlay |
| BFF entry | `/api/botsson/voice/token` (per-user `botsson-orb:<profileId>` rooms) |
| Validation | F-ME-07 — has `done` status without `e2e_test` frontmatter; **0 E2E coverage** |
| Status | 🟡 implemented, voice runs end-to-end; G1 memory blocks "remembering" feel; G10 schedule-wrong-day; F-ME-01 no E2E |

### 2.3 lise-interview — Lise (Pre-Phase-E mission)

| Field | Value |
|---|---|
| Agent | Lise |
| firstSpeaker | agent |
| Stages | none (single-prompt) |
| Voice | `coral` (OpenAI Realtime, frontend-designer council 2026-05-08 R1) |
| Greeting | "Hei! Jeg er Lise. La meg hjelpe deg gjennom dette." |
| Capabilities | Limited — interview/onboarding-flow demo |
| Status | 🟢 implemented (Phase F0 KRIT-6 D1, 2026-05-09 PR #353) |

### 2.4 landing-demo — Lise (Landing page ambassador)

| Field | Value |
|---|---|
| Agent | Lise |
| firstSpeaker | agent |
| Stages | none (single-prompt) |
| Voice | `coral` |
| Capabilities | Demo + Q&A about Smartout |
| BFF entry | `apps/landing/src/app/api/wizard/engine-start/route.ts` (returns 410 Gone post-Phase-F0 T1 strip; landing-wizard text-only) |
| Status | 🟡 mission registered; landing voice surface stripped Phase F0 — text-only redirect to smartout.ai/onboarding |

### 2.5 haccp-inspector — HACCP-inspektoren

| Field | Value |
|---|---|
| Agent | HACCP-inspektoren |
| firstSpeaker | agent |
| Stages | none (single-prompt) |
| Capabilities | `governance` (HACCP control lists + tests), `operations` (deviation create), `engine_world` (kitchen surface state) |
| Status | 🟢 mission registered; concrete HACCP runtime via Phase 2c handlers (`engine-dispatch/index.ts:800/910/995`) |

### 2.6 shift-assistant — Vaktassistenten

| Field | Value |
|---|---|
| Agent | Vaktassistenten |
| firstSpeaker | user |
| Stages | none (single-prompt) |
| Capabilities | `schedule`, `shift_swap`, `availability`, `operations_intelligence` |
| Status | 🟡 mission registered; G10 schedule-wrong-day affects this mission too |

### 2.7 botsson-session — generic Botsson session

| Field | Value |
|---|---|
| Agent | Botsson (generic) |
| Stages | none |
| Status | 🟡 generic fallback; specifics deferred to Phase F |

---

## 3. DB-side stage seeds (audit 2026-05-10)

`engine_stages` GROUP BY mission_id:

| mission_id | stages | code-registry match |
|---|---|---|
| `onboarding-interview` | 8 | ✅ matches mission registry |
| `season-lifecycle` | 8 | ❌ **DB-only — no code-registry entry** |
| `discovery-call` | 3 | ❌ **DB-only — no code-registry entry** |

**Drift risk (G12):** 2 of 3 DB stage chains are orphans relative to current code registry. Either:
- Legacy seeds from earlier mission-set that should be migrated out
- Currently-live missions whose registry entries are missing
- Mission-renames that left stage rows tagged with old IDs

**Action required:** decide intent for each, then either delete stale seeds (with ADR justification) OR add registry entries with proper voice/firstSpeaker config.

---

## 4. Per-mission tool/data requirements (capability cross-reference)

### Onboarding (workplace setup)

| Need | Capability | Tool |
|---|---|---|
| Update business basics (name, org_number) | `onboarding` | `update_business` |
| Set season period + revenue baseline | `onboarding` | `update_season` |
| Add departments / locations / zones | `onboarding` | `add_departments`, `add_locations`, `add_zones` (IN-MEMORY) |
| Add procedures | `onboarding` | `add_procedures` (chat-only, gate+emit) |
| Look up company on BRREG | `onboarding` | `search_company`, `identify_company` (delegate to scrapling) |
| Scrape website for context | `onboarding` | `scrape_website` |
| Save key facts | `onboarding` (alias) | `add_key_fact` → `memory.save_memory` |
| Persist memories | `memory` | `save_memory` (**G1: hidden until authority seeded**) |

### Daily ops (mr-botsson)

| User scenario | Capability | Tools |
|---|---|---|
| "Hvilke vakter har jeg i dag/morgen?" | `schedule` | `get_my_shifts`, `get_team_schedule` (**G10: wrong-day bug**) |
| "Hva må jeg gjøre nå?" | `operations` | `get_my_tasks`, `get_session_info`, `get_department_status` |
| "Marker oppgave fullført" | `operations` | `complete_task` (gate+emit) |
| "Meld avvik" | `operations` | `create_deviation` (gate+emit) |
| "Hvor mange uleste meldinger?" | `communication` | `get_unread_count`, `get_conversations` |
| "Send melding til Lene" | `communication` | `send_message` (gate+emit) |
| "Hva sa de i kanal X sist?" | `communication` | `get_channel_context` |
| "Søk i kunnskapsbase" | `kb_query` / `communication` | `search_knowledge` |
| "Sett notat" / "Sett påminnelse" | `personal` | `add_note`, `set_reminder`, `create_task` |
| "Sett tilgjengelighet" | `availability` | `set_own_availability`, `clear_own_availability` |
| "Spør om bytte" | `shift_swap` | `request_shift_swap` (gate+emit) |
| "Status på lønn / faktura" | `payroll` / `billing_query` | listed tools (**G3: billing-query no emit**) |
| "Hva sier loven om §X?" | `legal` | `lovsen` agent tools |
| "Hjelp / billett / status" | `helpdesk_query` | `open_ticket`, `list_my_queue`, `get_ticket`, `resolve_ticket` |
| Workplace state awareness | `engine_world` | `read_surface`, `read_surface_class` (read), `report_observation` (gated write) |
| "Husk at jeg liker kaffe svart" | `memory` | `save_memory` (**G1: blocked**) |

### Helpdesk (B4 verified)

`helpdesk_query` capability (4 tools: `open_ticket`, `list_my_queue`, `get_ticket`, `resolve_ticket`). Full ADR chain: ADR-0160-0163 + ADR-0165/0166. Surface-untested (no UI consumer outside helpdesk Phase 1 yet).

---

## 5. Stage success/failure validation

### Per-stage success contract

Each `engine_stages` row carries `success_criteria` (TEXT, natural language). Stage-manager evaluates implicitly via `req.result` payload at advance-time. No automated success-validator today.

**Open gap (G16-proposed):** programmatic stage validators. Acceptance gate-as-spec-cathedral risk per ADR-0282 R6 step 8 lesson — synthetic validators may demolish mid-run. Prefer runtime telemetry probes:

| Mission | Telemetry probe | Where wired |
|---|---|---|
| `onboarding-interview` | `voice.first_speech_ts_ms`, `voice.turn_end_ts_ms`, `voice.user_recut`, `voice.session_abandonment` | `services/voice-agent/src/agent.ts:138-261` |
| `mr-botsson` | `agent.tool_call`, `agent.tool_response`, `agent.intent_routed` | Arena LogView consumes via `voiceActivity` (commit `cafd6c30c`) |
| All missions | `engine_event` workflow events | Per-mutation emit |

### Failure modes + fallback behavior

| Failure | Symptom | Fallback (current) | Fallback (target) |
|---|---|---|---|
| `engine_world` unreachable | `<world_state>unavailable</world_state>` injected | Agent operates without world snapshot | OK as designed (ADR-0290) |
| `engine_memory` unreachable | Empty `<user_memories>` | Agent has no memory context | OK |
| Tool call → `gate_action` denies | Tool returns "Ikke tillatt: <reason>" | Agent reports denial to user | OK |
| Tool call → DB error | Tool returns "Error loading X: <message>" | Agent retries or apologizes | OK |
| LiveKit room → connection lost | `voice_call_status` flips to `error` | Orb shows error state | OK (post-Phase-E) |
| Krisp NC fails to load | Track publishes without NC | Voice still works, no noise filter | Acceptable — NC is enhancement |
| Stage advance → DB write conflict | Optimistic concurrency check fails, returns null | Stage stays put, user retries | OK (stage-manager.ts:73) |
| **G1 memory writer hidden** | `save_memory` not in toolset | Agent says "I'll remember" but doesn't | **Blocking — fix via F-MEM-UNBLOCK** |

---

## 6. Validation checklist (per-mission, pre-promote-to-prod)

Before declaring a mission production-ready:

- [ ] Mission registered in `packages/ai/src/missions/registry.ts` with: `id`, `name`, `description`, `agentDisplayName`, `greeting`, `language`, `voice`, `temperature`, `maxDurationSeconds`, `firstSpeaker`, `initialOutputMedium`, `systemPrompt`
- [ ] Voice ID validated against LiveKit Agents OpenAI Realtime supported set (`coral`, `mark`, `sarah`, `shimmer`, `verse`, `alloy`)
- [ ] If staged: `engine_stages` rows seeded via migration with `mission_id` matching registry id
- [ ] If staged: every stage has `instructions` + `success_criteria` populated
- [ ] Capabilities used by mission verified in `packages/ai/src/capabilities/registry.ts`
- [ ] Per-capability authority seeded in `engine_authority_config` for target workspaces (avoid G1-class drift)
- [ ] Channel guard: voice-PII tools reject `ctx.channel === "voice"` (Layer 3 per-tool guard, not just `allowedChannels`)
- [ ] Every mutation calls `gate_action` (or `gatedMutation` orchestrator if SS-4 flag-on)
- [ ] Every mutation `emit()`s with non-empty workspaceId + actorId — no `?? ""` fallbacks (L-0083 trap)
- [ ] BFF route exists if mission needs token mint or pre-call setup
- [ ] Frontmatter `e2e_test` populated on JOURNEY-*.md
- [ ] Playwright E2E exists in `apps/e2e/<mission-slug>/` covering happy path + at least one failure path
- [ ] Telemetry events registered in `packages/telemetry/src/registry.ts` BEFORE any `emit()` calls (per Council R3 trust gate)
- [ ] HANDOFF written if mission shipped via sortie/campaign

---

## 7. Recovery anchors

When a mission misbehaves in prod:

1. **Read `<world_state>` block** from session log — confirms whether agent had workplace context
2. **Read `<user_memories>` block** — confirms memory feed (currently G1-blocked for new memories)
3. **Trace `engine_event` rows** for the session — who called what tool when
4. **Trace `activity_trail` rows** — every mutation should have one row; missing rows = L-0176 / F-CT-01-class drift
5. **Inspect `agent_session_recording` rows** for the session — turn-level replay (Phase D1) with `phase`, `turn_kind`, `attention_score`, `is_flagged`
6. **Run platform-admin Replay tab** for visual inspection of turn timeline
7. **Trigger `force_stop` whisper** if mission is stuck in a loop (admin-only, gated `recorder.force_stop`)
