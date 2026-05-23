---
title: "Botsson — Architecture"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: botsson
tags: [domain, botsson, architecture, code-map, persona, soul, mission]
---

# Botsson — Architecture

> L1–L5 code map (persona surface only). **Code wins.** Every component cited with a grep-able anchor + line ±hint. Re-verified vs code 2026-05-23.
>
> **L-0150 closure note:** Original `docs/architecture/BOTSSON-SYSTEM-MAP.md` is now archived (`status: archived`, `superseded_by: docs/domains/botsson/`). The system-map's 🟢/🟡/🔴 nodes were re-verified vs code during this `pre` run. All findings logged as Deviations in GAPS-AND-DEBT.md. Last-re-verified: **2026-05-23**.

## Layer model

```
┌──────────────────────────────────────────────────────────────────┐
│  L1  OVERFLATE — brukeren rører                                  │
│       Arena / Sticky / Orb / VoiceCall / Host + EmmaOverlay      │
│       apps/web/src/app/Botsson/_components/                      │
└──────────────────────────────────────────────────────────────────┘
                    │ user message / voice turn
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L2  BFF — Next.js API routes                                    │
│       /api/botsson/{chat,sessions,voice,recorder,pos}            │
│       /api/emma/{chat,memory,notes,tasks,voice,session}          │
│       apps/web/src/app/api/botsson + /api/emma                   │
└──────────────────────────────────────────────────────────────────┘
                    │ proxy to backend (OUT of botsson domain)
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L3  STAGE ENGINE — HARNESS (future agent-harness domain)        │
│       services/stage-engine/src/                                 │
│       Botsson domain does NOT own L3 internals.                  │
│       This diagram boundary is the BFF→stage-engine call.        │
└──────────────────────────────────────────────────────────────────┘
                    │ tool dispatch (OUT of botsson domain)
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L4  SOUL + MISSIONS (persona-owned)                             │
│       packages/ai/src/missions/   ← mission framework            │
│       packages/ai/src/prompts/    ← soul: posture + mr-botsson   │
│       packages/ai/src/context/    ← context collection + memory  │
│       packages/ai/src/agents/botsson.ts ← persona agent wrapper  │
│  (capabilities are OUT — each cap self-owns)                     │
└──────────────────────────────────────────────────────────────────┘
                    │ writes via gate_action / Server Actions
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L5  PERSISTENCE (persona-relevant tables)                       │
│       agent_session_recording · agent_session_envelope           │
│       agent_session_whisper · agent_profile · agent_relationship │
│       engine_memory (read+write) · engine_authority_config (read)│
│       engine_sessions (read only — harness owns write)           │
└──────────────────────────────────────────────────────────────────┘
```

---

## L1 — Overlay UI (`apps/web/src/app/Botsson/_components/`)

Re-verified 2026-05-23: all files listed confirmed present by `ls`.

| Component | Anchor | Status | Notes |
|---|---|---|---|
| `BotssonShell` | `BotssonShell.tsx` | 🟢 | Morphing div, magnetic edges, drag, throw-to-dismiss, resize |
| `BotssonOrb` | `BotssonOrb.tsx` | 🟢 | 6 states: idle/listening/thinking/speaking/notification + unread badge |
| `BotssonOrbVoiceMount` | `BotssonOrbVoiceMount.tsx` | 🟢 | LiveKit Room + Krisp NC; token route `POST /api/botsson/voice/token` |
| `BotssonArena` | `BotssonArena.tsx` | 🟡 | 12 views; form-view + video-view are placeholder strings |
| `BotssonSticky` | `BotssonSticky.tsx` | 🟢 | 4s retract, neon sliver, hover controls |
| `BotssonChat` | `BotssonChat.tsx` | 🟢 | Wired to `/api/botsson/chat` |
| `BotssonProvider` | `BotssonProvider.tsx` | 🟢 | localStorage state + voice session payload + `declareDomainChatOwnership` |
| `BotssonHost` | `BotssonHost.tsx:26` | 🟢 | ADR-0362; SSR-safe `<BotssonProvider workspaceId>` wrapper |
| `EmmaOverlay` | `EmmaOverlay.tsx` | 🟢 | `next/dynamic({ssr:false})`, renders `<BotssonShell/>` only |
| `DomainChatOwnership` | `DomainChatOwnership.tsx:78` | 🟢 | ADR-0238; hook + component; 3 declaration sites verified |
| `EmmaProfile` | `EmmaProfile.tsx` | 🟢 | Settings UI — 3 tabs (Identity, Voice, Presets). 706+ lines |
| `persona-engine.ts` | `persona-engine.ts:17` | 🟢 | `buildPersonaPrompt(identity)` — 4 personas × 5 ranks × blend 0–10 |
| `types.ts` | `types.ts` | 🟢 | `VOICE_OPTIONS`, `LISA_PERSONALITIES` (6 presets), all UI types |
| `tool-registry.ts` | `tool-registry.ts` | 🟢 | Page-scope tool registration per ADR-0327 |
| `BotssonTools.ts` | `BotssonTools.ts` | 🟢 | Client-side tool definitions |
| `emma-awareness.ts` | `emma-awareness.ts` | 🟢 | Context-awareness helpers |
| `BotssonHistory` | `BotssonHistory.tsx` | 🟢 | Session history view |
| **Emma signature illustration** | `EmmaProfile.tsx` (letter "E" fallback) | 🔴 | Mockup at `docs/design/botsson/project/components/emma.jsx` not implemented |
| **Immersive backdrop** | `BotssonShell.tsx` (radius 0) | 🔴 | Mockup at `docs/design/botsson/project/components/immersive.jsx` not implemented |

### Tool bridges (domain-surface-mounted, per ADR-0327)

These are mounted per dashboard surface and registered through `tool-registry.ts`:

| Bridge | Path | Status |
|---|---|---|
| `help-takeover-tools-bridge.tsx` | `_components/` | 🟢 |
| `help-tour-tools-bridge.tsx` | `_components/` | 🟢 |
| `help-voice-tools-bridge.tsx` | `_components/` | 🟢 |
| Komm tool bridge | `apps/web/src/app/dashboard/komm/_tools/komm-tools-bridge.tsx` | 🟢 |
| Notifications tool bridge | `apps/web/src/app/dashboard/notifications/_tools/notifications-tools-bridge.tsx` | 🟢 |
| Calendar tool bridge | `apps/web/src/app/dashboard/calendar/_tools/` | 🟢 |
| Governance tool bridge | `apps/web/src/app/dashboard/governance/_tools/` | 🟢 |
| Year-wheel tool bridge | `apps/web/src/app/dashboard/year-wheel/_tools/` | 🟢 |
| Reconciliation tool bridge | `apps/web/src/app/dashboard/reconciliation/_tools/` | 🟢 |
| Season tool bridge | `apps/web/src/app/dashboard/season/[seasonId]/_tools/` | 🟢 |

### Platform Admin surfaces (session recorder intervention — ADR-0184, ADR-0185)

| Component | Path | Status |
|---|---|---|
| `useRecorderSessions` | `apps/web/src/app/platform-admin/guardian/_hooks/useRecorderSessions.ts` | 🟢 |
| `SessionList` | `.../_components/SessionList.tsx` | 🟢 |
| `TurnCard` | `.../_components/TurnCard.tsx` | 🟢 |
| `TurnTimeline` | `.../_components/TurnTimeline.tsx` | 🟢 |
| `AdminActionDrawer` | `.../_components/AdminActionDrawer.tsx` | 🟢 |
| `GuardianMonitor` | `.../_components/GuardianMonitor.tsx` | 🟢 |
| `RedactedPill` | `.../_components/RedactedPill.tsx` | 🟡 | Component built; not yet composed into TurnCard (Phase 2c) |

---

## L2 — BFF Routes (`apps/web/src/app/api/`)

Re-verified 2026-05-23: `ls /apps/web/src/app/api/botsson/` and `/api/emma/` confirm directories exist.

| Endpoint | File anchor | Status |
|---|---|---|
| `POST /api/botsson/chat` | `api/botsson/chat/route.ts` | 🟢 |
| `POST /api/emma/chat` | `api/emma/chat/route.ts` | 🟢 |
| `GET /api/botsson/sessions` | `api/botsson/sessions/route.ts` | 🟢 |
| `GET/DELETE /api/botsson/sessions/[id]` | `api/botsson/sessions/[id]/route.ts` | 🟢 |
| `GET /api/emma/memory` | `api/emma/memory/route.ts` | 🟢 |
| `GET/POST /api/emma/notes` | `api/emma/notes/route.ts` | 🟢 |
| `GET/POST /api/emma/tasks` | `api/emma/tasks/route.ts` | 🟢 |
| `POST /api/botsson/voice/token` | `api/botsson/voice/token/route.ts` | 🟢 |
| `POST /api/botsson/voice/session-context` | `api/botsson/voice/session-context/route.ts` | 🟢 |
| `POST /api/botsson/recorder/flag` | `api/botsson/recorder/flag/route.ts` | 🟢 |
| `POST /api/botsson/recorder/whisper` | `api/botsson/recorder/whisper/route.ts` | 🟢 |
| `GET /api/botsson/recorder/sessions/[id]` | `api/botsson/recorder/sessions/[id]/route.ts` | 🟢 |
| `GET /api/botsson/recorder/break-glass/[envelope_id]` | `api/botsson/recorder/break-glass/[envelope_id]/route.ts` | 🟢 |
| `POST /api/botsson/recorder/flag-session` | `api/botsson/recorder/flag-session/route.ts` | 🟢 |
| `POST /api/botsson/recorder/flag-log-entry` | `api/botsson/recorder/flag-log-entry/route.ts` | 🟢 |
| `POST /api/botsson/recorder/force-stop` | `api/botsson/recorder/force-stop/route.ts` | 🟢 |
| `GET /api/botsson/recorder/_metrics` | `api/botsson/recorder/_metrics/route.ts` | 🟢 |
| `GET /api/emma/session` | `api/emma/session/route.ts` | 🟡 | G5: consumer dropped in Phase F0 T3; route exists but orphaned |
| **Generator API** (`/api/.../generate`) | — | 🔴 | G14: 4 pure generator functions have no HTTP route yet |

---

## L3 — Stage Engine (OUT — future `agent-harness` domain)

Stage engine (`services/stage-engine/src/`) is **harness plumbing, not persona surface**. The boundary is the BFF→stage-engine HTTP call. This domain documents only the BFF-side routes (L2) and the mission/soul packages (L4) that configure what the harness runs.

For reference: stage-engine services include `session-manager.ts`, `stage-manager.ts`, `prompt-builder.ts`, `agent-router.ts`, `guardian-evaluator.ts`, `session-recorder.ts`, `memory-manager.ts`. These are out of botsson-domain scope.

---

## L4 — Soul + Missions (`packages/ai/src/`)

### Missions framework (`packages/ai/src/missions/`)

| File | Anchor | Purpose |
|---|---|---|
| `registry.ts` | `missions/registry.ts:14` (`MISSIONS` const) | 7 mission configs — verified 2026-05-23 |
| `types.ts` | `missions/types.ts` | `AgentMission`, `MissionId`, voice types |
| `index.ts` | `missions/index.ts` | Re-exports |
| `manifest.ts` | `missions/manifest.ts` | Mission manifest |

### Soul / prompts (`packages/ai/src/prompts/`)

| File | Anchor | Purpose |
|---|---|---|
| `mr-botsson.ts` | `prompts/mr-botsson.ts` | `buildBotssonPromptFromContext()` — dynamic prompt assembler |
| `posture.ts` | `prompts/posture.ts` | `resolvePosture()` — 5D personality adaptation engine |

### Context (`packages/ai/src/context/`)

| File | Anchor | Purpose |
|---|---|---|
| `collector.ts` | `context/collector.ts` | `collectContext()` — parallel DB fetches for AgentContext |
| `memory-writer.ts` | `context/memory-writer.ts` | Shared `saveMemory` helper (Phase A3) |
| `types.ts` | `context/types.ts` | `AgentContext`, `RelationshipData`, `AgentProfileData` |

### Agents (`packages/ai/src/agents/`)

| File | Anchor | Purpose | In/Out scope |
|---|---|---|---|
| `botsson.ts` | `agents/botsson.ts` | Persona agent wrapper | **IN** (persona config) |
| `onboarding.ts` | `agents/onboarding.ts` | Onboarding agent | **IN** (persona config) |
| `contract.ts` | `agents/contract.ts` | Contract agent | **OUT** (capability) |
| `docs.ts` | `agents/docs.ts` | Docs agent | **OUT** |
| `journey-ops.ts` | `agents/journey-ops.ts` | Journey ops agent | **OUT** |
| `journey.ts` | `agents/journey.ts` | Journey agent | **OUT** |
| `reports.ts` | `agents/reports.ts` | Reports agent | **OUT** |
| `schedule.ts` | `agents/schedule.ts` | Schedule agent | **OUT** |

Note: `agents/` directory contains both persona-wrappers and capability-agents. Only `botsson.ts` + `onboarding.ts` are IN-scope for this domain.

### Voice agent (`services/voice-agent/src/`)

| File | Anchor | Purpose |
|---|---|---|
| `agent.ts` | `voice-agent/src/agent.ts` | LiveKit Agents 1.3.0 worker, 4 telemetry events, Krisp NC, mission dispatch |
| `tools-capability.ts` | `voice-agent/src/tools-capability.ts` | Voice-surface tool wrappers |
| `tools-mission.ts` | `voice-agent/src/tools-mission.ts` | Mission-specific voice tools |
| `tools-orb.ts` | `voice-agent/src/tools-orb.ts` | Orb state sync over LiveKit data channel (ADR-0378) |
| `tools-personal.ts` | `voice-agent/src/tools-personal.ts` | Personal task/note tools |
| `tools-schedule.ts` | `voice-agent/src/tools-schedule.ts` | Schedule voice tools |
| `context.ts` | `voice-agent/src/context.ts` | Context pipe from stage-engine |
| `client-tool-rpc.ts` | `voice-agent/src/client-tool-rpc.ts` | LiveKit data-channel RPC for client tools (ADR-0378) |

### Surface package (`packages/Botsson/`)

| Path | Purpose |
|---|---|
| `INDEX.md` | Package index + blueprint nav |
| `concepts/VISION.md` | Philosophy + architecture principles |
| `blueprints/api-surface.md` | API surface blueprint |
| `blueprints/data-contracts.md` | Data contracts |
| `blueprints/mission-orchestration.md` | Mission orchestration blueprint |
| `blueprints/ui-components-inventory.md` | UI component inventory |
| `blueprints/voice-sdk-architecture.md` | Voice SDK architecture |

---

## L5 — Persistence (persona-relevant)

Tables the persona domain **owns or primarily reads**. Re-verified vs migrations 2026-05-23.

| Table | Migration anchor | Role | Notes |
|---|---|---|---|
| `agent_session_recording` | `20260515120100_agent_session_recording.sql` (`CREATE TABLE public.agent_session_recording`) | owned | Per-turn recorder. 8 `turn_kind` + 10 `phase` enums. `attention_score`, `is_flagged`. |
| `agent_session_envelope` | `20260515120200_agent_session_envelope.sql` (`CREATE TABLE public.agent_session_envelope`) | owned | pgcrypto-encrypted PII. TTL 30d. Break-glass via `decrypt_envelope` RPC. |
| `agent_session_whisper` | `20260515120300_agent_session_whisper.sql` (`CREATE TABLE public.agent_session_whisper`) | owned | Platform-admin injections to next turn. NEVER user-facing (ADR-0185). |
| `engine_memory` | `20260302000000_engine_memory.sql` (`CREATE TABLE IF NOT EXISTS engine_memory`) | read+write | Long-term memories. `content`, `memory_type`, `scope`, `importance`, `embedding` (pgvector). |
| `agent_profile` | `20260307000000_agent_profile_system.sql` (`CREATE TABLE IF NOT EXISTS agent_profile`) | read | Per-workspace personality config. `display_name`, `greeting`, `language`, 5D personality. |
| `agent_relationship` | `20260307000000_agent_profile_system.sql` (`CREATE TABLE IF NOT EXISTS agent_relationship`) | read | Per-profile relationship scores. `familiarity_score`, `trust_score`, `sentiment_score`. |
| `engine_authority_config` | (harness-owned) | read | Per-capability authority level. Botsson reads to determine tool availability. |
| `engine_sessions` | (harness-owned) | read | Session lifecycle. `collected_data.conversation` for history view. |

---

## Soul wire-status (channel matrix)

Re-verified vs `BOTSSON_SOUL_ARCHITECTURE.md` + code 2026-05-23:

| Layer | Chat | Voice | Note |
|---|---|---|---|
| L1 Identity (persona/rank/blend) | 🔴 not wired | ✅ live | Chat drops `persona_prompt` at `api/emma/chat/route.ts` — confirmed Deviation G:P0 |
| L2 Posture | ✅ live | ✅ live | `buildBotssonPromptFromContext` + `posture.ts` |
| L3 Voice tuning | N/A | ✅ live | `BotssonProvider.tsx:814-819` → voice session payload |
| L4 LLM model | Claude Sonnet 4.6 | GPT-Realtime | Hardcoded per channel |
| L5 Context injection | ✅ live | ✅ live | Same `user_context`, `workspace_context`, `workforce_context` |
| L6 Memory | ✅ live | ✅ live | Both channels read/write `engine_memory` |
| L7 Authority | ✅ live | ✅ live | Same C4 gate |
| L8 Tools | ✅ chat-bundle | ✅ voice-bundle (subset) | Channel policy filters per ADR-0078 |
