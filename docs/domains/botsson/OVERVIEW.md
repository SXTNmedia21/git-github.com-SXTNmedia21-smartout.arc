---
title: "Botsson — Overview"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: botsson
tags: [domain, botsson, overview, persona, ai-agent, cascade]
---

# Botsson — Overview

> What this domain is and why it exists. **Code wins** — if this contradicts code, update here.

## 1. What it is

Botsson is Smartout's conversational AI persona — "AI-kollega som forbereder (onboarding), guider (daglig støtte) og vedlikeholder (kontinuerlig kompetanse)". It is the face the user talks to: a floating overlay in the dashboard, a voice on a phone call, a wizard guide during setup.

The domain covers the **persona surface only**: the orb, the shell/arena overlay, the voice call mount, the soul (how Botsson thinks, sounds, and acts), and the mission framework (what conversations Botsson can have). The plumbing beneath — stage-engine routing, capability dispatch, classifier, gate — belongs to a future `agent-harness` domain.

## 2. Cascade placement

**Primary: C2 — Context & Interaction.** Botsson is the conversational interface layer that mediates between a user and the cascade system. It does not own production data (D6) or governance rules (C4) — it surfaces and communicates them.

**Consumes:**
- C1 (Observability & Calibration) — world state and memory feed into the soul's context injection layer.
- C4 (Policy & Governance) — `engine_authority_config` determines what each mission/capability is authorized to do. "Confident ≠ Authorized."

**Does NOT produce cascade state.** Botsson reads D1–D6 data via capability tools; it does not own dimension tables.

## 3. Soul architecture — 8-layer model

The "soul" is not a single system-prompt. It is a stacked runtime composed of 8 layers. Verified against `BOTSSON_SOUL_ARCHITECTURE.md` (2026-05-15) + code 2026-05-23:

| Layer | What | Files (verified) |
|---|---|---|
| L1 Identity | Persona × Rank × Blend — who is he? | `persona-engine.ts` (~`apps/web/src/app/Botsson/_components/`) |
| L2 Posture | 5D personality axis dynamically adjusted per role/situation/authority/relationship | `packages/ai/src/prompts/posture.ts` |
| L3 Voice Tuning | voice_id, temperature, speed, VAD — how he sounds (voice channel only) | `services/voice-agent/src/agent.ts` + `BotssonProvider.tsx` |
| L4 LLM Model | Claude Sonnet 4.6 (chat, via OpenRouter) · GPT-Realtime (voice) | `services/stage-engine/src/core/agent-router.ts` + `services/voice-agent/src/agent.ts` |
| L5 Context injection | user + workspace + workforce snapshot + route + relationship score + onboarding state + world state | `apps/web/src/lib/botsson-context-snapshot.ts` + `packages/ai/src/context/collector.ts` |
| L6 Memory | `engine_memory` (long-term) + `engine_sessions.collected_data` (in-session) + `activity_trail` (audit) | `packages/ai/src/context/memory-writer.ts` |
| L7 Authority (C4) | Per-tool `engine_authority_config` + `min_role` gate. Authority adjusts posture. | `services/stage-engine/src/core/authority.ts` + `packages/ai/src/router/min-role.ts` |
| L8 Tool bundle | capabilityTools + pageScopeTools + clientTools − minRoleFiltered − channelFiltered | `packages/ai/src/router/tool-selector.ts` |

**Key cross-channel gap (G:P0):** Persona/rank/blend (L1 Identity) is saved to `localStorage` and forwarded to voice, but **dropped** by `/api/emma/chat/route.ts` before proxying to stage-engine. Chat-Botsson ignores identity tuning. Tracked in GAPS-AND-DEBT.md §Gaps.

## 4. Mission framework

7 missions registered in `packages/ai/src/missions/registry.ts` (verified 2026-05-23 by grep of `id:` keys):

| Mission ID | Agent Name | firstSpeaker | Stage chain | Status |
|---|---|---|---|---|
| `onboarding-interview` | Botsson | agent | 8 stages (DB seeded) | 🟢 |
| `landing-demo` | Lise | agent | single-prompt | 🟡 (text-only post-F0 strip) |
| `lise-interview` | Lise | agent | single-prompt | 🟢 |
| `mr-botsson` | Mr. Botsson | user | single-prompt (posture-dynamic) | 🟡 (G10 schedule-wrong-day; G11 0 E2E) |
| `haccp-inspector` | HACCP-inspektoren | agent | single-prompt | 🟢 |
| `shift-assistant` | Vaktassistenten | user | single-prompt | 🟡 (G10 same tz bug) |
| `botsson-session` | Botsson | varies | single-prompt | 🟡 (generic fallback) |

**DB drift (G12):** `engine_stages` table has orphan rows for `season-lifecycle` (8 stages) and `discovery-call` (3 stages) without matching registry entries. See GAPS §Deviations.

## 5. Host mount + provider scope (ADR-0362)

`DashboardShell` mounts:
```
<BotssonHost workspaceId={…}>   ← provides BotssonProvider scope for all children
  {children}
  <EmmaOverlay />               ← renders <BotssonShell /> (orb + arena)
</BotssonHost>
```

`BotssonHost` (`apps/web/src/app/Botsson/_components/BotssonHost.tsx:26`) is a synchronous SSR-safe wrapper. `EmmaOverlay` (`EmmaOverlay.tsx`) is loaded via `next/dynamic({ssr:false})`. Both share one `BotssonProvider` scope.

## 6. Boundaries

**Owns:**
- Overlay UI (`apps/web/src/app/Botsson/`)
- Soul compilation + posture system (`packages/ai/src/prompts/`)
- Mission framework (`packages/ai/src/missions/`)
- Host mount + provider-channel derivation (ADR-0107, ADR-0362)
- Surface disambiguation (ADR-0238, `DomainChatOwnership` component)
- Voice protocol / LiveKit data-channel (ADR-0378, `services/voice-agent/`)
- BFF routes for chat/sessions/recorder/voice (`apps/web/src/app/api/botsson/`, `/api/emma/`)
- `packages/Botsson/` surface package (blueprints, concepts)
- Session recording observability (`agent_session_recording`, `agent_session_envelope`, `agent_session_whisper`)

**Does NOT own:**
- `services/stage-engine/` — L3 runtime, agent router, session manager, prompt builder → future `agent-harness`
- `packages/ai/src/capabilities/` — each capability self-owns (communication ✅, payroll ✅, task, schedule, billing-query, …); botsson REGISTERS them
- `packages/ai/src/router/`, `/classifiers/`, `/gate/`, `/scheduler/`, `/engine/` — harness plumbing
- `packages/agent-sdk/` — separate concern
- `packages/ai/src/generators/` — harness side (journey/doc/e2e/linear generators)
- `packages/ai/src/adapters/` — harness adapters
- `packages/ai/src/harness/` — name says it

**Edge domains (overlap logged in GAPS-AND-DEBT):**
- `communication` — botsson posts to channels via communication capability; `channel_ai_policy` owned by communication
- `procedure-engine` — botsson surfaces procedures/routines via mission lifecycle; doesn't own procedure data
- `task` — botsson surfaces tasks via task capability; doesn't own task tables
- `core-structure` / `day-session` — botsson reads context; doesn't author D1/D6 data

## 7. Key invariants

1. **Gate invariant:** Every capability mutation passes through `gate_action` RPC. Verified by CI invariant I13 (`invariants:no-phantom-gate`). File: `packages/ai/src/capabilities/*/gate.ts` (per-cap wrapper).
2. **Emit invariant:** Every mutation calls `emit()` with `workspaceId + actorId` non-empty. Verified by CI `invariants:emit-completeness`. L-0027.
3. **Server-actor invariant:** `profile_id` server-derived from JWT, never from request body. ADR-0151. CI invariant I4.
4. **Channel guard:** PII tools reject `ctx.channel === "voice"`. ADR-0078 Layer 3 per-tool guard. Checked in tool-selector.
5. **Surface-ownership:** Domain surfaces that declare `DomainChatOwnership` suppress Orb to passive mode. ADR-0238 + ADR-0337. Three production sites verified 2026-05-23.
