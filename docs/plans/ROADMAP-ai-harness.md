---
title: "Roadmap — AI Harness State Snapshot"
status: active
updated: 2026-04-22
created: 2026-04-22
module: MODULE_BOTSSON
tags: [roadmap, ai-harness, stage-engine, capabilities, telemetry, authority, memory]
---

# Roadmap — AI Harness State Snapshot

> Campaign reference: `docs/plans/CAMPAIGN-botsson-arena.md`
> Pipe status-kart: [`docs/architecture/BOTSSON-SYSTEM-MAP.md`](../architecture/BOTSSON-SYSTEM-MAP.md) — visuell 🟢/🟡/🔴 oversikt
>
> **Filosofi:** Vi bygger ingenting nytt. Kampanjen forbedrer og synkroniserer eksisterende elementer (Botsson Arena, Stage Engine, 14 capabilities, `gate_action`, `emit()`, `engine_memory`, `engine_process`, missions, journeys, event dispatcher). Dette dokumentet er bevis-sporet: hva finnes, hvor det sitter, hvor det henger uferdig. Alle tiltak i kampanjen refererer tilbake hit.
>
> Snapshotted 2026-04-22 fra 6 parallelle kodesøk. Claims er sporbare til file:line på `campaign/botsson-arena`. Når koden endres går dette dokumentet stale — oppdater eller erstatt.

---

## 1. Architecture Map

```
┌──────────────────────────────────────────────────────────────────┐
│  UI SURFACES   Botsson orb · Onboarding wizard · WalkAi toolkits │
│                Mobile (chat via BFF, voice NOT wired)            │
├──────────────────────────────────────────────────────────────────┤
│  BFF           /api/emma/chat · /api/botsson/chat (channel pin)  │
├──────────────────────────────────────────────────────────────────┤
│  STAGE ENGINE  Hono :5010 · 10 routes · mission + agent modes    │
│                intent-classifier → tool-selector → LLM           │
├──────────────────────────────────────────────────────────────────┤
│  CAPABILITIES  14 registered · 51+ tools · 4 stub intents        │
├──────────────────────────────────────────────────────────────────┤
│  CONTROL       gate_action RPC · engine_authority_config · 4-eye │
│                channel_ai_policy · 3-layer channel defence       │
├──────────────────────────────────────────────────────────────────┤
│  MEMORY/TEL    engine_memory (read-only) · activity_trail ·      │
│                engine_event · PostHog · registry.ts (SSOT)       │
├──────────────────────────────────────────────────────────────────┤
│  KNOWLEDGE     K1a hospitality package · K1b workspace_doc_chunk │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Current State By Layer

### 2.1 Stage Engine Core

**Shipped.** `services/stage-engine/` on Hono port 5010.

- 10 HTTP/WS routes (sessions CRUD, agent/chat, ws/:sessionId, adapters/ultravox, adapters/telegram, guardian, health).
- Two session modes: `mission` (guided wizard) and `agent` (conversational Botsson) — ADR-0042.
- 6 background loops: session expiry, memory cleanup, Guardian evaluation (30s), calendar triggers (60s), Telegram bridge (pg NOTIFY), agent router processing.
- Intent classifier: Sonnet 4.6 via OpenRouter, 19 capability labels, confidence threshold 0.7 (`packages/ai/src/router/intent-classifier.ts:65-113`).
- Tool selector: authority + channel filter (`packages/ai/src/router/tool-selector.ts:32-79`).
- Agent router orchestrates: `loadAuthorityConfig` → `classifyIntent` → `gate_action` RPC → `collectContext` → `selectTools` → `buildBotssonPromptFromContext` → `generateText` (`services/stage-engine/src/core/agent-router.ts:64-100+`).

**Gaps:**
- 3 `EngineActionType` enum values have no dispatcher handler: `create_deviation`, `validate_settlement`, `lock_checkout` (`packages/types/src/engine.ts:15-25` defines, `supabase/functions/engine-dispatch/index.ts:39-81` missing cases). Blocks HACCP Phase 2c.
- Context arg to `classifyIntent()` is empty string (`agent-router.ts:83`). Discards role/department signal.
- ADR-0112 CI coverage check not wired — silent intent/capability drift possible.
- Session state mutable in-memory (`SessionLane`, `index.ts:45`) — stage-engine restart orphans in-flight voice sessions.

### 2.2 Capabilities

**14 registered**, 51+ tools. Full inventory:

| # | Capability | Tools | Wired | Authority | Status |
|---|-----------|-------|-------|-----------|--------|
| 1 | `schedule` | 5 read-only | ✓ | `allowedChannels: [chat, voice, system]` | Stable |
| 2 | `shift_lifecycle` | 4 (2 suggest + 2 system) | ✓ | dotted names per ADR-0099, all mutations call `gate_action` | **Stable — Phase 5 shipped (ADR-0095)** |
| 3 | `contract` | 7 (5 read + 2 suggest) | ✓ | chat-only per ADR-0138 | Stable |
| 4 | `contract_intake` | 3 (1 read + 2 mutate) | ✓ | chat-only, PII | **⚠️ LIVE ADR-0099 VIOLATION** — `submitFieldGroup` calls RPC directly without `gate_action` (`tools.ts:114,157,206,223`) |
| 5 | `profile` | 4 read-only | ✓ | chat-only, PII | Stable |
| 6 | `operations` | 5 (3 read + 2 suggest) | ✓ | chat-only | Stable |
| 7 | `shift_swap` | 4 (2 read + 2 suggest) | ✓ | chat-only | Stable |
| 8 | `communication` | 8 (7 read + `send_message`) | ✓ | all channels, text-policy gate live (commit b6aa3f51) | Stable |
| 9 | `guardian` | 3 (2 read + 1 suggest) | ✓ | all channels (no PII) | Stable |
| 10 | `training` | 3 (employee + manager split) | ✓ | chat-only | Stable |
| 11 | `operations_intelligence` | 6 (5 read + 1 suggest) | ✓ | chat-only, manager+ | Stable (ADR-0088) |
| 12 | `governance` | 1 read-only (`checkReadiness`) | ✓ | chat-only | **Stub** — no write tools, called inline by `shift_lifecycle` only |
| 13 | `ui` | 5 (navigate/fill/highlight/panel/toast) | ✓ | all channels (presentation) | Stable |
| 14 | `billing_query` | 6 read-only | ✓ | chat-only (invoice numbers need exact spelling) | Stable (ADR-0118) |

**Stub intents (in `intentSchema` but not registered, by design):** `knowledge`, `memory`, `payroll`, `training` → agent falls through to natural language, per ADR-0073 addendum.

**Tool contract:** `SmartoutTool<AgentToolContext>` — framework-agnostic, bridged via `toVercelTools()` (`packages/ai/src/adapters/vercel-ai.ts:27-87`) and `toLiveKitTools()`. Auto-emits `botsson.tool_invoked` / `botsson.tool_failed` per ADR-0116.

### 2.3 Authority / Control Plane

**Mature.** `gate_action` RPC is the unified gate (ADR-0099) with four-eyes support (ADR-0101).

- Signature: `gate_action(workspace_id, capability, channel, actor_profile_id, action_type, [engine_process_id], [engine_state_id], [approvers_present[]], [entity_id])` → `{allow, downgrade_to, min_role_required, channel_allowed, reason, gate_evaluation_id, four_eyes_required, approvers_needed, approvers_present}`.
- Default: no config row = allow (ADR-0099 §5, explicit default-allow).
- `gate_evaluation` table writes one row per call. PgTAP test suite at `supabase/tests/gate-action.sql` passes 8/8 scenarios.
- Both agent-router (`services/stage-engine/src/core/agent-router.ts`) and engine-dispatch (`supabase/functions/engine-dispatch/index.ts`) gate uniformly — **prior "default-allow Layer 1 silent for ad-hoc agent-router" CVE is CLOSED.**

**Dual-gate risk:** agent tools call `gate_action` (old pattern, ADR-0099); Server Actions call `cascade_gate_write` (new, ADR-0091). Same mutation via different code paths can diverge on rule evolution. Reconciliation blocks Wave 2B (STATE-SUMMARY line 59).

**Channel restrictions (ADR-0078) — 3-layer defence:**
- Layer 1 (process-level, `engine_process.allowed_channels`): silent for ad-hoc chat (agent-router doesn't pass `p_engine_process_id`).
- Layer 2 (capability-level, `CapabilityDefinition.allowedChannels`): live, mandatory per ADR-0163 (init-time check on all 8 PII-risk capabilities).
- Layer 3 (tool-level, `ctx.channel` guard): live for `send_message`, honored by `contract_intake`, `shift_lifecycle`.

### 2.4 Memory

**Table shipped, producer missing.**

- `engine_memory` (migration `20260302000000`) with pgvector(1536), scope enum (personal/team/workspace), importance [0,1], `expires_at`.
- Reader: `packages/ai/src/context/collector.ts:73-76` — loads top 10 by importance into prompt.
- **Writer: NONE.** No code path persists new memories. Table is seed-only or externally populated.
- TTL enforcement: `cleanExpiredMemories()` defined but not scheduled. No cron.

### 2.5 Telemetry

**Registry SSOT, enforcement aspirational.**

- `emit()` 4-destination fanout per runtime:
  - Server (`packages/telemetry/src/emit.ts`): PostHog → Logger → activity_trail → engine_event (+ billing_activity_log for billing events).
  - Client (`emit.client.ts`): PostHog → console → CustomEvent bus → server proxy `/api/telemetry`.
  - React Native (`emit.native.ts`): PostHog RN → console (dev) → edge function proxy `telemetry-proxy`.
- `EVENT_ROUTING: Record<SmartoutEvent["event"], EventMeta>` in `packages/telemetry/src/registry.ts` is the single source of truth (registry.ts:4834).
- Engine-event contract test validates producer/consumer `entity_id` shape.

**Known holes:**
- "Every mutation emits" is documented, not lint-enforced. Council 2026-04-17 caught season wizard emitting `"button clicked"` instead of `"season created"`.
- Season dual-emission: DB trigger + `emit()` both fire → duplicate downstream workflows. Documented, not fixed.
- activity_trail + billing_activity_log lack producer-consumer contract tests.

**Mobile telemetry corruption — FIXED (ADR-0134):**
- Pre-fix: 6 hooks emitted with `workspace_id: null` / `actor_id: ""` (empty-string silently accepted).
- Post-fix: `apps/mobile/src/lib/profile-context.ts` `getProfileContext()` throws on missing/empty IDs, called at entry of all mutation hooks (use-punch, use-swap, use-create-shift, use-request-absence, use-submit-supplement).

### 2.6 Channels + Helpdesk

**Phase 0 complete 2026-04-20.** Commits: `b6aa3f51`, `21ae0ef5`, `62bf6805`, `d6802916`, `01d54570`.

- 4 ADRs accepted: 0160 (channel_event as projection of engine_event), 0161 (ticket IS engine_state), 0162 (helpdesk_query capability placement), 0163 (allowedChannels mandatory for PII).
- Dead infra revived: `channel_ai_policy` text-path wired into `send_message`; `channel_event` projection trigger live (whitelist `channel.*` + `helpdesk.*` event_types).
- 8 capabilities retrofitted with explicit `allowedChannels`.

**Phase 1 pending.** 5 migration drafts ready as `.sql.draft` (schema drafts approved, not applied). Tasks:
- Apply enum extension (`desk`, `representative`).
- Apply `channel.responsible_profile_id` + CHECK.
- Apply `engine_process('helpdesk_query_lifecycle')` blueprint.
- Seed `engine_authority_config` for `helpdesk_query`.
- Register `helpdesk_query` capability + tools.

### 2.7 Voice

**Web (Ultravox) — shipped.** Direct HTTP API, `services/stage-engine/src/routes/adapters/ultravox.ts`. `voice_participation` policy column exists, **no enforcer yet**. Voice blocked on PII tools via tool-level guard.

**Mobile (LiveKit) — theatre.** ADR-0135 accepted. LiveKit tokens issued (`supabase/functions/livekit-token`), webhook wired (`supabase/functions/livekit-webhook`), `useLiveKitCall` hook exists. **Transcripts DO NOT route to stage-engine.** Agent reasoning never reaches mobile voice. Week 7+ work per ADR-0132.

### 2.8 Prompts / Missions / Journeys / Generators

- **Prompts** — `buildBotssonPromptFromContext()` (6-stream context assembly + posture resolution in `packages/ai/src/prompts/`).
- **Missions** — 6 registered (`onboarding-interview`, `landing-demo`, `mr-botsson`, `haccp-inspector`, `shift-assistant`, `botsson-session`). Hand-authored TS in `packages/ai/src/missions/registry.ts`.
- **Journeys** — 68 rows in `journey` table, 13-state lifecycle (ADR-0031). Wizard agent + save_draft tool shipped in Phase 2.
- **Generators** — 4 pure functions (e2e test, onboarding doc, Linear spec, Botsson voice script) in `packages/ai/src/generators/`. API integration (`/api/.../generate`) NOT yet shipped — ADR-0038 Phase 2.

### 2.9 K1a / K1b Knowledge

- **K1a hospitality** — `apps/web/src/lib/industry/packages/hospitality.ts` + `tariff_rate_table` platform rows (workspace_id IS NULL). 3-tier loader fallback.
- **Riksavtalen rates — FIXED** on `campaign/botsson-arena` (commit `1311c42c`, 2026-04-14). Correct values now.
- **K1b workspace** — `workspace_doc_chunk` (embeddings) + `engine_memory`. Ingestion path is manual/webhook — V2 planned.

### 2.10 UI Surfaces

- **Botsson web** — shipped. `EmmaOverlay` → `BotssonShell` → `BotssonOrb` (4 states: speaking/thinking/listening/notification). `useEntityDrawerOptional` + `useWorkspaceOptional` provide graceful degrade (earlier crash claim is stale on this branch).
- **Onboarding wizard** — 9 sections + Done, 19 client tools via `useBotsson.ts`, mission `onboarding-interview`. Agent mutates React state directly (no server round-trip per tool call).
- **WalkAi registration** — dynamic `useRegisterTools(source, ClientToolKit)` pattern. Schedule + onboarding populated; other pages empty until needed.
- **Mobile chat** — shipped. `useBotssonChat` → BFF `/api/botsson/chat` → stage-engine `/agent/chat`. Session in MMKV, channel pinned `"chat"` server-side.
- **Nordic Split compliance on orb** — not verified. No audit doc found.

---

## 3. Blockers Ranked

| # | Blocker | Evidence | Impact | Fix owner |
|---|---------|----------|--------|-----------|
| 1 | contract-intake `submitFieldGroup` bypasses `gate_action` | `packages/ai/src/capabilities/contract-intake/tools.ts:114,157,206,223` | Live ADR-0099 violation, PII writes ungated | **Phase A1** |
| 2 | Dual-gate divergence | `gate_action` (agent tools) vs `cascade_gate_write` (Server Actions) | Same mutation, different authz | **Phase B1** |
| 3 | Stage-engine `profile_id` from request body | `services/stage-engine/src/routes/agent/chat.ts:34,94,131,191` | API-key callers can forge actor | **Phase A2** (ADR-0151) |
| 4 | Season dual-emission | DB trigger + `emit()` both fire on season activation | Duplicate downstream workflows | **Phase B2** |
| 5 | `engine_memory` no writer | Grep: no INSERT into `engine_memory` from app code | Agent never learns | **Phase A3** |
| 6 | Mobile voice not routed | `packages/walkieTalkie/` primitives exist, transcripts never reach stage-engine | "Theatre" | **Phase C1** |
| 7 | 3 missing action handlers | `create_deviation`, `validate_settlement`, `lock_checkout` in enum, no dispatcher case | HACCP Phase 2c blocked | **Phase B5** |
| 8 | ADR-0112 CI check not wired | No `scripts/check-intent-coverage.ts` + no lint hook | Silent intent/capability drift | **Phase A4** |
| 9 | Intent-classifier context is `""` | `agent-router.ts:83` passes empty string | Discards role/department signal | **Phase A5** |

---

## 4. Roadmap

See `docs/plans/CAMPAIGN-botsson-arena.md` for the authoritative phase-bound task list. This doc is the evidence layer; the campaign is the execution layer.

**Phase A (2–3 weeks) — Close open gates.** A1–A6.
**Phase B (3–4 weeks) — Unblock Wave 2B + fix dual-emission.** B1–B5.
**Phase C (4–6 weeks) — Voice + generators + polish.** C1–C3.

---

## 5. Where the evidence came from

Surveyed 2026-04-22 by 6 parallel Explore agents against `campaign/botsson-arena` (HEAD `046cd430`). Agents mapped:

1. Stage Engine core + router → `services/stage-engine/`, `packages/ai/src/{engine,router,agents,context}/`.
2. Capabilities + tools → `packages/ai/src/{capabilities,tools,adapters,schemas}/`, `apps/web/src/app/Botsson/_components/tool-registry.ts`.
3. Voice + channels + helpdesk → Ultravox/LiveKit adapters, `channel_*` tables, helpdesk Phase 0 commits.
4. Memory + authority + telemetry → `engine_memory`, `engine_authority_config`, `activity_trail`, `engine_event`, `packages/telemetry/`.
5. Prompts + generators + missions + journeys → `packages/ai/src/{prompts,generators,missions,journey,context,industry}/`.
6. UI surfaces → `packages/Botsson/`, `apps/web/src/app/{onboarding,Botsson,walkAi}/`, `apps/mobile/src/`.

If any layer has evolved beyond this snapshot, update the affected section and bump `updated:` in frontmatter. When this doc no longer matches the code, it is wrong by definition — code wins.
