---
title: "LiveKit Functional Cutover + Guidance Mission MVP — Design"
status: draft
created: 2026-05-04
updated: 2026-05-04
module: MODULE_BOTSSON
campaign: campaign/botsson-arena
authors: [pontus, claude-opus-4-7, botsson-harness-builder, system-agent-coordinator, journey-audit]
tags: [botsson, livekit, ultravox, missions, cutover, engine-process, gate-action, adr-0270, adr-0271]
adrs: [ADR-0078, ADR-0099, ADR-0132, ADR-0135, ADR-0151, ADR-0184, ADR-0186, ADR-0220, ADR-0239, ADR-0270, ADR-0271]
brainstorm-source: 3-agent parallel brainstorm 2026-05-04 (botsson-harness-builder, system-agent-coordinator, journey-audit-via-general-purpose)
---

# LiveKit Functional Cutover + Guidance Mission MVP — Design

## Purpose

Take the Ultravox→LiveKit transition from "Botsson Orb has voice" to **"Mr. Botsson runs structured missions over LiveKit, talks to capabilities through the same pipe Emma uses, controls the Orb, navigates the dashboard, and gets out of the way when Pontus wants the wheel."**

This spec covers the **first** of an N-spec cutover campaign. It is the funksjonell cutover plus one mission (`guidance.contextual`) wired end-to-end as proof that the pipe holds. Other 3 mission types (`onboarding`, `presentation`, `knowledge-ingest`) plus mobile cutover plus Emma-BFF sunset are deferred to follow-up specs.

## Why this scope (B), not A or C

Three options were brainstormed:

- **A — Functional cutover only (L0-L3, no missions ported)**: Proves transport, not contract. Mission-aware code path exists but is never exercised end-to-end.
- **B — Functional cutover + one mission MVP (L0-L4 guidance only)**: Proves the full pipe with the lowest-risk mission. Defers 3 mission types.
- **C — Full L0-L7**: Decomposes into 2-3 specs minimum per superpowers/brainstorming guidance. Too large for one spec.

**B chosen** by all three brainstorm agents (botsson-harness-builder, system-agent-coordinator, journey-audit). YAGNI-cuts: presentation authority overlay full UX, knowledge-ingest embedding queue, Emma BFF mirror endpoints.

## Why guidance first, not onboarding (tie-broken by journey-audit evidence)

| Axis | Guidance | Onboarding-interview | Verdict |
|---|---|---|---|
| Existing E2E coverage | 3,951 LOC across 20 specs (`apps/e2e/tests/journey-help-*`, helpdesk lifecycle) | 527 LOC across 4 specs | 🟢 guidance |
| Voice-quality regression risk | Lower (contextual, read-mostly) | 🔴 30-min Norwegian customer interview, **zero voice-quality gates exist** in any journey doc | 🟢 guidance |
| `engine_process` blast radius | New row, additive, zero existing test assertions | 6 hardcoded `process_id="signup_onboarding"` test assertions + special-case branch in `stage-manager.ts:100` | 🟢 guidance |
| Voice-channel guard baseline | Mobile journey `08-ask-botsson` already guards mic-channel + agent_session events | None | 🟢 guidance |

The harness-builder's "12 client-tools + seeded engine_process" argument is real but is evidence of **complexity**, not readiness. Seed and special-case branches are exactly what break silently on a provider swap.

**Onboarding stays on Ultravox indefinitely until Norwegian voice quality on LiveKit Realtime is solved.** Documented in ADR-0271 as multi-provider routing.

---

## §1 — Architecture

```
L1 OVERFLATE      BotssonShell + BotssonProvider (provider-branch per mission.provider)
                       │
                       │ Ultravox path (onboarding-only, deferred-cutover)
                       │ LiveKit path  (guidance, presentation*, knowledge-ingest*)
                       ▼
L2 BFF            POST /api/botsson/voice/token
                    → mints LiveKit token
                    → INSERTs engine_state row (process_id, status="active",
                       context_jsonb.authority_snapshot = freeze_authority(workspace, profile))
                    → embeds mission_id in room metadata
                  POST /api/botsson/chat → /agent/chat (single transport)
                  apps/web/src/lib/agent-bff/  ← shared lib for Emma + Botsson BFF
                       ▼
L3 STAGE          POST /agent/chat   (single transport for ALL voice + chat)
                  agent-router.ts  →  authority overlay (frozen snapshot from engine_state)
                                  →  intent-classifier
                                  →  capability-tool-select (filtered by mission allowlist)
                                  →  gate_action(p_capability, p_mission_id := <engine_state.id>)
                       ▼
L4 BRAIN          mission capability + 3 new write-tools:
                    start_mission, advance_step, complete_mission
                  Modell B translator: getMissionForLiveKit(missionId) in adapters/livekit.ts
                       ▼
L5 PERSIST        engine_process (seed: guidance.contextual, is_active=false)
                  engine_state.context_jsonb.authority_snapshot ← frozen at mission-start
                  engine_state_step ← per-mission step progression
```

**Key architectural decisions:**

1. **Single transport.** `/agent/chat` handles every Botsson + Emma turn. No `/missions/*` route. No second pipe.
2. **Mission-modell B (runtime translator).** `AgentMission` keeps Ultravox shape. New function `getMissionForLiveKit(missionId)` produces LiveKit-shape config at consume time.
3. **Mission orchestration = `engine_process` spine + capability actuators.** No new state machine. Three new write-tools on existing `mission` capability.
4. **Authority overlay = frozen snapshot, not live config read.** At `start_mission`, freeze a JSON authority snapshot into `engine_state.context_jsonb.authority_snapshot`. `gate_action` reads snapshot, not live `engine_authority_config`. Prevents authority drift mid-mission.
5. **Multi-provider routing per mission.** `BotssonProvider` branches on `mission.provider` field — not per-app, not per-feature-flag. Onboarding stays Ultravox, guidance/presentation/knowledge-ingest go LiveKit. Same front-door, different transport.

---

## §2 — Components

### 2.1 — Functional cutover files (5)

| # | File | Change | Approx LOC |
|---|---|---|---|
| 1 | `packages/agent-sdk/src/providers/livekit.ts` | Stub→real. Delegate to `botsson-sdk/src/providers/livekit-voice.ts` `LiveKitVoiceSession`. Wire event forwarding (status / transcript / mic) to existing `VoiceSession` interface. | ~40 |
| 2 | `packages/agent-sdk/src/hooks/useAgent.ts` | Provider-branch: Ultravox calls `session.join(joinUrl)`, LiveKit calls `session.connect(token, serverUrl)`. Single if-else gate. | ~10 |
| 3 | `apps/web/src/app/Botsson/_components/BotssonProvider.tsx` | Branch on `mission.provider`. Two paths (Ultravox + LiveKit), not a 1-line switch. Coordinated with `frontend-designer` for visual contract preservation. | ~20 |
| 4 | `services/voice-agent/src/agent.ts` | Mission-aware: `parseContextPayload()` extracts `mission_id` from `context_init` data-message. Swap `BOTSSON_VOICE_INSTRUCTIONS` for mission-specific prompt. Filter `buildAllBotssonTools()` by mission allowlist. | ~15 |
| 5 | `services/voice-agent/src/adapter.ts` + `apps/web/src/app/api/botsson/voice/token/route.ts` | Extend `BotssonVoiceContextSchema` with `mission: { id, allowlist[], system_instruction_overlay }`. **Fix live blocker B**: add `Authorization: Bearer <STAGE_ENGINE_INTERNAL_TOKEN>` header to voice-agent → `/agent/chat` calls. Stage-engine middleware accepts internal token for `channel=voice`. | ~20 |

### 2.2 — Mission orchestration files (3 new)

| # | File | Change | Approx LOC |
|---|---|---|---|
| 6 | `packages/ai/src/capabilities/mission/tools.ts` | Add 3 new write-tools: `start_mission(mission_id)`, `advance_step(step_id)`, `complete_mission()`. All gated via `gate_action(capability="mission")`. `start_mission` writes the `engine_state` row + freezes authority snapshot. | ~120 |
| 7 | `packages/ai/src/adapters/livekit.ts` | Add `getMissionForLiveKit(missionId)` — translates `AgentMission` (Ultravox-shape) into LiveKit config: `{ systemPrompt, allowlist, voice, contextInitTemplate }`. Existing `toLiveKitTools()` stays. | ~30 |
| 8 | `apps/web/src/lib/agent-bff/index.ts` | NEW shared lib. Token issuance, channel pinning (ADR-0078), mission resolution. Both `/api/emma/chat` and `/api/botsson/chat` route handlers become thin shells that call this lib. | ~80 |

### 2.3 — Database changes (1 migration, 1 RPC amendment)

| # | File | Change |
|---|---|---|
| 9 | `supabase/migrations/YYYYMMDDHHMMSS_seed_guidance_contextual_engine_process.sql` | INSERT `engine_process` row for `guidance.contextual` with `is_active=false` (demand-started, not event-fired). Step structure modeled on `signup_onboarding_process` template (no `engine_trigger` event-fire). |
| 10 | `supabase/migrations/YYYYMMDDHHMMSS_gate_action_mission_id.sql` | Amend `gate_action` RPC signature to add `p_mission_id uuid default null`. When non-null, RPC reads `engine_state.context_jsonb.authority_snapshot` instead of live `engine_authority_config`. ADR-0099 amendment. |
| 11 | `supabase/migrations/YYYYMMDDHHMMSS_engine_state_active_mission_uniqueness.sql` | Partial unique index on `engine_state(workspace_id, profile_id, process_id) WHERE status='active'`. Prevents duplicate active mission rows. L0 phase verifies whether this constraint already exists (`engine_state` schema audit) — if present, this migration is a no-op skipped from the spec. |

### 2.4 — ADRs to write in this spec

| # | Title | Status |
|---|---|---|
| ADR-0270 | Mission as `engine_process`, capability as actuator | draft |
| ADR-0271 | Multi-provider routing per `mission.provider` — Botsson same front door, different transports | draft |
| ADR-0099 amendment | `gate_action` `p_mission_id` parameter + mission-lock authority-snapshot | draft |

---

## §3 — Data flow

### 3.1 — Guidance mission turn (end-to-end)

```
1. User clicks "Hjelp" / "Spør Botsson" on /dashboard/schedule
2. BotssonProvider mounts with mission="guidance.contextual", routeContext={path: "/dashboard/schedule"}
3. Provider checks mission.provider === "livekit" → take LiveKit branch
4. POST /api/botsson/voice/token { mission_id, route_context }
5. BFF agent-bff/index.ts:
   a. Verify cookie session via Supabase SSR
   b. Resolve workspace_id + profile_id from JWT (ADR-0151) — never from request body
   c. INSERT engine_state {
        process_id: "guidance.contextual",
        workspace_id, profile_id,
        status: "active",
        context_jsonb: {
          route_context,
          authority_snapshot: freeze_authority(workspace_id, profile_id)
        }
      }
   d. Mint LiveKit AccessToken with metadata={mission_id, engine_state_id}
   e. Return { token, serverUrl, roomName, profileId }
6. agent-sdk/providers/livekit.ts: session.connect(token, serverUrl)
7. Voice-agent worker autodispatch joins room, reads room metadata, sends context_init data-message
8. agent.ts parseContextPayload() extracts {mission_id, engine_state_id, allowlist, system_instruction_overlay}
9. Swap BOTSSON_VOICE_INSTRUCTIONS → guidance-mission system prompt
10. Filter buildAllBotssonTools() down to allowlist (e.g., {get_my_shifts, query_smartout, complete_mission, expand_orb, set_orb_state})
11. User speaks → LiveKit transcript → Realtime LLM
12. LLM picks tool → adapter.ts ask(query, label) → POST /agent/chat with:
    Authorization: Bearer <STAGE_ENGINE_INTERNAL_TOKEN>
    body: { workspace_id, profile_id, channel: "voice", mission_id, engine_state_id, query }
13. Stage-engine /agent/chat:
    a. agent-router.ts: read engine_state by id, get authority_snapshot
    b. intent-classifier (ADR-0112) routes to capability
    c. tool-select clamps to mission allowlist
    d. gate_action(p_capability, p_mission_id=<engine_state_id>):
       - reads engine_state.context_jsonb.authority_snapshot
       - returns { allowed, reason, downgrade_to? }
    e. Tool execute → emit() telemetry → return to voice-agent
14. Voice-agent publishes activity event on data channel for Arena LogView
15. User done → "Takk, det var alt"
16. LLM picks complete_mission → mission tool updates engine_state.status="completed"
17. Provider receives session-close event, BotssonProvider unmounts
```

### 3.2 — Mission-end recovery

Mission ends via `complete_mission` tool only. NOT timer (race condition risk), NOT background event (orphan risk). State transition: `engine_state.status` `"active" → "completed"`.

If voice-agent disconnects mid-mission (network, browser close), engine_state row stays `"active"`. Next time user starts a guidance session, **`agent-bff/index.ts` (BFF, not a background worker)** detects existing active row at session-start (`SELECT ... FROM engine_state WHERE workspace_id=? AND profile_id=? AND process_id='guidance.contextual' AND status='active'`) and chooses:
- (a) Resumes (passes existing `engine_state_id` to new session), or
- (b) Terminates abandoned (`UPDATE engine_state SET status='abandoned' WHERE id=...`, then INSERT new row)

**Decision: (b) — BFF terminates abandoned synchronously at new-session start, then inserts fresh row.** Guidance is contextual, not stateful across sessions. Resume semantics belong to onboarding (deferred). No background worker needed; the abandon-and-replace is a single transaction inside `/api/botsson/voice/token` token-mint.

---

## §4 — Error handling

| Failure | Detection | Recovery |
|---|---|---|
| Voice-agent stage-engine 401 (live blocker B) | Tool calls always fail in production today | **Fixed in L0**: `STAGE_ENGINE_INTERNAL_TOKEN` env-var, middleware accepts for `channel=voice` body |
| LiveKit Room.connect failure | `botsson-sdk/livekit-voice.ts` event | BotssonProvider receives event → user-visible error toast. **No fallback to Ultravox** — multi-provider routing is per-mission, not per-failure. Mission `guidance.contextual` is LiveKit-only. |
| Mission completes mid-tool-call | `gate_action` re-checks at execution | Returns `denied` → tool fails before write commits. No partial-state risk. |
| Authority drift mid-mission (admin demoted in `engine_authority_config`) | Live config diverges from snapshot | **Frozen snapshot in `engine_state.context_jsonb.authority_snapshot`** — `gate_action` reads snapshot, not live config. Mission completes with original authority. |
| `context_init` data-message dropped (LiveKit data-channel race) | `mission_id` not in `parseContextPayload()` result | agent.ts falls back to generic `BOTSSON_VOICE_INSTRUCTIONS` + 23-tool default set. **Telemetry alert**: `botsson.mission_context_init_failed` with `engine_state_id`. |
| Stage-engine intent-classifier no `mission` value | Classifier returns `unknown` | `query_smartout` fallback tool executes (existing behavior). Verify `intent-classifier.ts` enum includes `"mission"` BEFORE shipping. |
| `engine_state` row insert race (two simultaneous mission starts) | Unique constraint on (workspace_id, profile_id, process_id) WHERE status='active' | DB constraint enforces uniqueness. Second insert returns conflict, BFF returns 409 to client. Client retries after 500ms. |

---

## §5 — Testing

### 5.1 — Existing baseline (preserved, must stay green)

| Suite | Lines | What it asserts |
|---|---|---|
| `apps/e2e/tests/journey-help-v1.spec.ts` | 271 | Help panic-bar flow, voice-channel mic-button absence in hero |
| `apps/e2e/tests/journey-help-tour-*.spec.ts` (4 files) | 900+ | Tour-anchor verification |
| `apps/e2e/tests/journey-help-active-ticket-*.spec.ts` (3 files) | 669 | Ticket lifecycle |
| Helpdesk lifecycle (12 specs) | 2,000+ | Channel + helpdesk infrastructure |
| Mobile journey `08-ask-botsson` | n/a | Voice-channel guard (Gate 1: mic-select), `agent_session_started` / `agent_session_closed` events |

### 5.2 — New tests (in this spec)

| Test | What it covers |
|---|---|
| `gate_action_with_mission_id.test.sql` | pgTAP test for new `p_mission_id` parameter. Asserts read from `engine_state.context_jsonb.authority_snapshot` when non-null, fallback to live `engine_authority_config` when null. |
| `mission_lock_pattern.test.ts` | Stage-engine: change `engine_authority_config` mid-mission, verify `gate_action` still uses snapshot. |
| `context_init_mission_propagation.test.ts` | Voice-agent: send `context_init` with mission_id, verify system-prompt swapped + tool-allowlist filtered. |
| `mission_write_tools.test.ts` | Capability mission: `start_mission` inserts `engine_state` + freezes snapshot. `complete_mission` transitions status. `advance_step` writes `engine_state_step`. |
| `voice_channel_guard_guidance.test.ts` | ADR-0078: PII tools (personnummer, lønn-data) refused when `channel=voice` AND `mission=guidance.contextual`. Reuses existing channel-guard infrastructure. |
| `journey-help-v1-livekit.spec.ts` | E2E: full guidance session over LiveKit. New spec mirroring journey-help-v1 but on LiveKit transport. |

### 5.3 — Explicitly NOT covered (accepted risk)

- **Voice-quality regression for Norwegian on LiveKit Realtime.** No Norwegian-trained voice exists in Realtime. Risk flagged in ADR-0271. Mitigation: guidance mission is short (mid-task), low-stakes; degraded voice quality less catastrophic than 30-min onboarding interview. Onboarding stays on Ultravox until solved.
- **Mobile guidance via LiveKit.** Mobile cutover is separate sortie (ADR-0135 closeout). Mobile `08-ask-botsson` journey continues using whatever transport the mobile build ships with.

---

## §6 — Out of scope (deferred to follow-up specs)

| Item | Why deferred | Target spec |
|---|---|---|
| Onboarding mission LiveKit port | Norwegian voice quality unsolved on Realtime | When OpenAI Realtime ships Norwegian preset, OR when re-tune is proven on guidance baseline |
| Knowledge-ingest mission | Needs `engine_memory` write-paths + embedding queue + RLS audit | Spec 2 (kb_ingest capability buildout) |
| Presentation mission | Authority overlay UX needs walk-through surface design (highlight elements, narrate steps) | Spec 3 (presentation walkthrough surface) |
| Mobile cutover | ADR-0135 separate scope; mobile is theatre per L-0044 | ADR-0135 closeout sortie |
| Emma BFF endpoint sunset | `/api/emma/{history, memory, notes, tasks}` redirect to `/api/botsson/*` | Spec 4 (post-cutover Emma sunset) |
| ADR-0220 enforcement (Botsson sole front door) | Becomes meaningful only after Emma sunset starts | Spec 4 |
| Voice-agent Authorization-via-BFF-proxy alternative | If `STAGE_ENGINE_INTERNAL_TOKEN` proves brittle, BFF-proxy pattern is the ADR-0132-compliant alternative | If/when token approach fails |

---

## §7 — Hard constraints (gates that must hold throughout)

These ADRs are non-negotiable in the spec. Implementation must honor each. No bypass without ADR amendment in same PR.

| ADR | Rule |
|---|---|
| ADR-0078 | Voice forbidden for high-PII (personnummer, bank, salary, home address). Stage-engine layer-3 channel guard enforces. Mission-allowlist must NOT include PII tools when `provider=livekit`. |
| ADR-0099 | All mutations through `gate_action` RPC. Mission write-tools (`start_mission`, `advance_step`, `complete_mission`) gated. No bypass even though `mission` capability writes its own state. |
| ADR-0132 | Mobile capability traffic routes through web BFF, not direct to capabilities. Voice-agent → stage-engine pattern is the same — not direct to capability tools. |
| ADR-0151 | `workspace_id` + `profile_id` resolved server-side via JWT at BFF. Never from request body. Mission spec preserves this — `start_mission` reads ctx, not params. |
| ADR-0184 | Session recorder taps every turn. Mission turns must propagate `mission_id` + `engine_state_id` in recorder payload for replay. |
| ADR-0186 | Guardian bus uses `pg_notify('guardian_events')`, not in-process Set. Mission gate_action denials emit guardian events. |
| ADR-0220 | Botsson is sole conversational front door. ADR-0271 clarifies multi-provider per mission ≠ multi-front-door. |
| ADR-0270 (NEW) | Mission as `engine_process` row, capability as actuator. No `/missions/*` HTTP route. |
| ADR-0271 (NEW) | `BotssonProvider` branches on `mission.provider`. Onboarding remains Ultravox until Norwegian voice quality solved. |

---

## §8 — Phase decomposition (sub-sorties under campaign/botsson-arena)

This spec materializes into ~5 sub-sorties. Each is its own `feat/botsson-arena-<name>` branch under `~/dev/smartout.ai-botsson-arena-wt-N`.

| Phase | Sub-sortie name | Scope | Blocks |
|---|---|---|---|
| **L0** | `botsson-arena-l0-stalkontrol-and-auth-fix` | Refresh `BOTSSON-SYSTEM-MAP.md` to current state. Fix voice-agent → stage-engine 401 (`STAGE_ENGINE_INTERNAL_TOKEN` env-var + middleware acceptance for `channel=voice`). Verify intent-classifier enum includes `mission`. Verify all 12 engine_process action-handlers wired (B5 check). Write ADR-0270 + ADR-0271 + ADR-0099 amendment drafts. | All others |
| **L1** | `botsson-arena-l1-livekit-provider-real` | Real LiveKit provider in `agent-sdk/providers/livekit.ts` (deleg to `botsson-sdk/livekit-voice.ts`). `useAgent.ts` provider-branch. `getMissionForLiveKit()` translator in `adapters/livekit.ts`. | L3 |
| **L2** | `botsson-arena-l2-mission-as-engine-process` | Mission write-tools (`start_mission`, `advance_step`, `complete_mission`) on `mission` capability. `gate_action` `p_mission_id` migration. `engine_state.context_jsonb.authority_snapshot` writes. Seed `guidance.contextual` `engine_process` row (`is_active=false`). | L3, L4 |
| **L3** | `botsson-arena-l3-voice-agent-mission-aware` | `BotssonProvider.tsx` provider-branch per mission. `voice-agent/agent.ts` reads `mission_id` from `context_init`, swaps prompt + filters tools. Extend `BotssonVoiceContextSchema`. Write shared lib `agent-bff/index.ts`. | L4 |
| **L4** | `botsson-arena-l4-guidance-mission-mvp` | Wire end-to-end: BotssonProvider mounts guidance mission on /dashboard/schedule + /dashboard/help, voice-agent runs with allowlist, capability tools execute via authority snapshot, complete_mission terminates. New E2E `journey-help-v1-livekit.spec.ts`. | (terminal — feature complete) |

After L4, this spec is shipped. Follow-up specs pick up onboarding / presentation / knowledge-ingest / mobile / Emma sunset.

---

## §9 — Key metaphor and mantra

**Metaphor**: Botsson er ikke et chatbot-bytte. Han er **regissør i et hus med 12 rom** (Arena-views). Han har stemmen tilbake (LiveKit Orb landet 2026-04-29) men kan ikke styre stykket (mission). Vi gir ham regiboka.

**Mantra**: **Provider-agnostisk modell. Mission-styrt agent. Botsson same front door, different transports.**

---

## §10 — Open decisions deferred to implementation

| Decision | Default (recommended) | Alternative |
|---|---|---|
| Voice for guidance LiveKit Realtime | `"verse"` (neutral, low-aggression) | `"alloy"` (warmer female) — A/B after first session |
| Mission allowlist for guidance | `{ query_smartout, get_my_shifts, get_my_missions, get_helpdesk_status, expand_orb, collapse_orb, set_orb_state, complete_mission }` (8 tools) | Add `cite_legal_paragraph` if legal-context detected via routeContext |
| guidance mission `temperature` | 0.5 (slightly more deterministic than onboarding 0.6) | 0.7 if A/B shows mid-task help feels too rigid |
| Mission timeout if voice-agent crashes | None (abandoned row sits until next session start) | 1-hour `engine_delayed_trigger` to mark abandoned (existing helpdesk SLA pattern) |

These are implementation-level choices, not architectural. Selecting in plan phase, not spec.

---

## Brainstorm provenance

This design synthesizes 3-agent parallel brainstorm conducted 2026-05-04:

- **botsson-harness-builder** (sonnet, harness-pipe angle): provided 5-file cutover surface, runtime authority clamp pattern, recommended onboarding-first
- **system-agent-coordinator** (opus, architecture/coordination angle): provided mission-as-engine_process pattern, mission-lock frozen snapshot, recommended guidance-first via multi-provider routing, drafted ADR-0270 + ADR-0271
- **journey-audit** (sonnet, via general-purpose stand-in for unregistered journey-inference agent): tie-broke onboarding vs guidance with hard E2E coverage data (3,951 vs 527 LOC), zero voice-quality gates in onboarding journeys, additive blast radius for guidance

Divergence points (Q2 onboarding port, Q3 authority overlay location, Q4 mission-prio, Q5 Emma BFF strategy) resolved by either consensus + journey-audit evidence or by selecting more rigorous architectural pattern (system-coordinator's frozen-snapshot over harness-builder's runtime clamp).

## References

- ADR-0078 — Voice channel guard
- ADR-0099 — gate_action mandatory for mutations (amended in this spec)
- ADR-0112 — Intent-classifier enum coverage CI-gate (still missing per BOTSSON-SYSTEM-MAP A4)
- ADR-0132 — Mobile AI routing through web BFF
- ADR-0135 — Mobile voice via LiveKit not Ultravox
- ADR-0151 — workspace_id + profile_id from JWT, not request body
- ADR-0184 — Session recorder taps prompt-builder + agent-router + authority + guardian + memory
- ADR-0186 — Guardian bus via pg_notify
- ADR-0220 — Botsson sole conversational front door
- ADR-0239 — Botsson chat BFF auth resolution (Bearer + cookie)
- ADR-0270 (proposed in this spec) — Mission as engine_process, capability as actuator
- ADR-0271 (proposed in this spec) — Multi-provider routing per mission.provider
- `docs/architecture/BOTSSON-SYSTEM-MAP.md` (last verified 2026-04-30, refresh part of L0)
- `docs/plans/CAMPAIGN-botsson-arena.md` (sync log updated 2026-05-04)
- `docs/plans/ROADMAP-ai-harness.md`
- `packages/Botsson/concepts/VISION.md`

---

## Status

- [x] Brainstorm complete (3-agent parallel, 2026-05-04)
- [x] Design approved (Pontus, 2026-05-04)
- [x] Spec written (this file)
- [ ] Spec self-reviewed
- [ ] Spec user-reviewed
- [ ] Implementation plan written (via superpowers:writing-plans)
- [ ] L0 sub-sortie opened
