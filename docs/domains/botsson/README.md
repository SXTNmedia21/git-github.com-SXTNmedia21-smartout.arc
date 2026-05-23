---
title: "Botsson — Domain Index"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: botsson
tags: [domain, botsson, ai-agent, persona, soul, mission, source-of-truth]
---

# Botsson — Source of Truth

> Authoritative folder for the **botsson** domain (Scope A = persona surface). If code contradicts this folder → **CODE wins**, update these docs.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| Overlay UI (`apps/web/src/app/Botsson/_components/`) | ✅ | 🟡 | BotssonShell/Orb/Sticky/Arena/VoiceCall all built; form-view + video-view placeholders; Emma signature 🔴 |
| Host mount + provider scope (ADR-0362) | ✅ | ✅ | `BotssonHost` + `EmmaOverlay` wired in `DashboardShell` |
| Surface disambiguation / domain-chat-ownership (ADR-0238) | ✅ | ✅ | `DomainChatOwnership` component + 3 declaration sites |
| Soul: persona engine + posture system | ✅ | 🟡 | Posture live on both channels; persona/rank/blend voice-only (chat unwired — G: P0) |
| Mission framework (7 missions, `packages/ai/src/missions/`) | ✅ | 🟡 | 7 missions registered; 0 of 7 have Playwright E2E (G11) |
| Voice protocol / LiveKit transport (ADR-0282, ADR-0378) | ✅ | 🟡 | Single LiveKit plane post-Phase E; C1.c Detox deferred |
| BFF routes (`/api/botsson/*`, `/api/emma/*`) | ✅ | 🟡 | Chat + sessions + recorder + voice token routes all built; generator API 🔴 |
| Session recorder (ADR-0184, ADR-0185) | ✅ | 🟡 | Phase D1 + 2a + 2b landed; Phase 2c E2E 🔴 |
| Soul compilation + snapshot audit (ADR-0329, ADR-0330) | 🟡 | 🔴 | ADRs accepted; soul-on-platform-admin sortie not built |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix across all domains: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map (persona-surface only) |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Tables, FKs, enums, RLS, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | verified | Flow index → journeys |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan + ADR/journey refs |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Built-vs-planned delta + deviations |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test = proof of built |

## Agent Guardrails

> Read before touching botsson code. Truth lives in this folder.

### Hard boundary: persona ≠ harness

**Botsson domain = persona surface (Scope A).** The plumbing is OUT:

| In scope (botsson domain) | Out of scope (future `agent-harness` domain) |
|---|---|
| `apps/web/src/app/Botsson/` overlay UI | `services/stage-engine/` — L3 runtime, BFF proxy |
| `packages/ai/src/missions/` mission framework | `packages/ai/src/{router,classifiers,gate,scheduler,engine}/` |
| `packages/ai/src/prompts/` soul/posture | `packages/ai/src/capabilities/` (each cap self-owns) |
| `packages/Botsson/` surface package | `packages/agent-sdk/` |
| `services/voice-agent/` voice agent | `packages/ai/src/generators/` (harness side) |
| BFF routes `/api/botsson/*` + `/api/emma/*` | `packages/ai/src/adapters/` + `/src/harness/` |

### Hard rules

- **Persona ≠ orchestrator.** ADR-0220: Botsson is a conversational front-door, NOT an orchestrator. Never route capability-dispatch logic through persona code.
- **"Confident ≠ Authorized."** Every mutation MUST pass through `gate_action` (ADR-0099). No capability tool bypasses this. Capability tools self-own their gate; botsson registers them, doesn't re-implement.
- **Soul ≠ system-prompt-at-runtime.** ADR-0329: soul is compiled server-side (snapshot). Runtime prompt is assembled by `prompt-builder.ts` from snapshot + context. Never hardcode system prompts in persona components.
- **Mission ≠ stage.** A mission is a top-level conversational unit (`packages/ai/src/missions/registry.ts`). A stage is a sub-unit within a sequential/free/hybrid mission (`engine_stages` table). A stage-less mission uses a single dynamic prompt.
- **ADR-0238 surface-ownership:** When `DomainChatOwnership` is declared on a surface (komm-chat, shift-clock-chat, komm-thread), Orb MUST suppress to passive mode. Never mount dual AI chat surfaces without this declaration.
- **L-0027 emit requirement:** Every mutation tool MUST call `emit()` with non-null `workspaceId` + `actorId`. No `?? ""` fallbacks. Checked at every audit cycle.
- **L-0150 staleness:** System-map claims drift. Trust this domain folder (re-verified 2026-05-23) over stale BOTSSON-SYSTEM-MAP (now archived).

### Owning surfaces

- Package: `packages/ai/src/missions/`, `packages/ai/src/prompts/`, `packages/Botsson/`
- Web UI: `apps/web/src/app/Botsson/`
- Voice agent: `services/voice-agent/`
- BFF: `apps/web/src/app/api/botsson/`, `apps/web/src/app/api/emma/`
- Tables: `agent_session_recording`, `agent_session_envelope`, `agent_session_whisper`, `engine_memory` (read), `agent_profile`, `agent_relationship`, `engine_authority_config` (read)
