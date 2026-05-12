---
title: "Botsson AI Harness — Full Technical Audit (2026-05-08)"
status: draft
type: audit
created: 2026-05-08
updated: 2026-05-08
verified_against_code: 2026-05-08
module: MODULE_BOTSSON
tags: [audit, botsson, voice, harness, stage-engine, ultravox, livekit]
---

# Botsson AI Harness — Full Technical Audit

> Pontus' ask: precise diagnostic, no fixes yet, verify everything against code (not docs).
> Method: 4 parallel sonnet research agents tracing voice plane, tool surface, stage-engine boundary, context pipe. Synthesized below.

---

## 0. TL;DR (one paragraph)

The harness is **architecturally cleaner than the headline narrative suggests**, but it carries one large parallel runtime that creates the symptoms Pontus sees as "voice as a separate service". The LiveKit voice path (`services/voice-agent/`) is **NOT** a parallel runtime — it is a thin LiveKit shell that proxies every capability call to `services/stage-engine/` `/agent/chat` and exercises the full harness (prompt-builder, agent-router, gate_action, guardian, recorder, memory). The genuine parallel runtime is the **Ultravox web path** (`apps/web/src/components/voice-assistant.tsx` + `apps/web/src/app/onboarding/hooks/useBotsson.ts` + `services/stage-engine/src/routes/adapters/ultravox.ts`) which bypasses `/agent/chat` entirely, has its own client-side tool surface with no `gate_action` enforcement, accepts a forgeable `workspace_id` from the request body, and produces zero `activity_trail` rows. ADR-0282 (council-approved, status `proposed`) prescribes deletion of this path; the migration has not landed. Three further issues compound: (1) **three divergent system prompts** for the same Mr. Botsson persona (mission registry, voice-agent hardcoded, onboarding mission DB), (2) **mobile LiveKit has no context-pipe publisher** so the voice-agent receives `ctx.user=null` and every capability call fails silently with "brukerdata mangler", (3) **dead and dead-on-arrival code** (orphan adapter + unimported tools-mission.ts + 3 chat-only capabilities mounted on voice surface that L2 always rejects).

---

## 1. Current architecture (how it actually works today)

### 1.1 Three parallel voice paths

**A. Web Ultravox** — onboarding wizard + dashboard `<VoiceAssistant>` widget

```
voice-assistant.tsx :: startSession()
  └─> POST /api/wizard/start
        └─> POST {STAGE_ENGINE_URL}/adapters/ultravox/create-call
              └─> services/stage-engine/src/lib/ultravox.ts → POST api.ultravox.ai/api/calls
                    └─> Ultravox Cloud (proprietary speech-to-speech model)
                          └─> client tools registered via UltravoxSession.registerToolImplementation()
                                ↳ executed in browser, NEVER hits /agent/chat
```

- System prompt: `mission.system_prompt` from registry OR `context.persona_prompt` from request body (client-overridable).
- Telemetry: only `evaluateSession` guardian events from `store`/`advance`. **Zero `botsson.turn_*` emit, zero activity_trail rows.**
- workspace_id: `body.workspace_id ?? profile.workspace_id` at `apps/web/src/app/api/wizard/start/route.ts:80`. **Forgeable.**

**B. Web LiveKit Orb** — `BotssonOrbVoiceMount.tsx` on dashboard

```
BotssonOrbVoiceMount.tsx :: connect()
  └─> POST /api/botsson/voice/token  (cookie auth, mints LiveKit token, room=botsson-orb:<profileId>)
  └─> Room.connect(LiveKit Cloud)
  └─> services/voice-agent (autojoins via @livekit/agents worker)
        ├─> OpenAI Realtime API (gpt-4o-realtime, voice="verse")
        ├─> orb tools (local, data-channel events only)
        └─> ALL OTHER TOOLS:
              adapter.ts :: ask(query, label)
                └─> POST {STAGE_ENGINE_URL}/agent/chat  channel="voice"
                      └─> routeAgentMessage()
                            ├─> prompt-builder (whispers, recorder turn=prompt_built)
                            ├─> agent-router → classifyIntent (recorder turn=classifier_input/output)
                            ├─> gate_action RPC (recorder turn=authority_load)
                            ├─> tool-selector (min-role, channel guard L2)
                            ├─> capability tool body (gate_action L1, channel guard L3)
                            ├─> guardian-evaluator → pg_notify('guardian_events')
                            ├─> session-recorder.recordTurn() at six phases
                            └─> emit() → activity_trail + engine_event + PostHog
```

- Context pipe: `BotssonOrbVoiceMount.tsx:331` fetches `/api/botsson/voice/session-context` and publishes `context_init` over LiveKit data channel topic `"botsson-context"`. `agent.ts:79-87` consumes via `RoomEvent.DataReceived`.
- System prompt: hardcoded `BOTSSON_VOICE_INSTRUCTIONS` in `services/voice-agent/src/agent.ts:35-62`. **Not loaded from mission registry.**
- ADR compliance: 0078 ✅, 0099 ✅, 0151 ✅, 0184/0185 ✅, 0186 ✅, 0135 R2 ✅.
- Single gap: `tools-schedule.ts` proposal tools are local-only (data-channel). No `activity_trail` row until proposal accepted (SMA-299 known debt).

**C. Mobile LiveKit** — `apps/mobile/src/hooks/use-botsson-voice-session.ts`

```
use-botsson-voice-session.ts :: connect()
  └─> getLiveKitToken(supabase, { channelId, workspaceId, purpose:"ai_voice" })
        └─> Supabase Edge Function: livekit-token (channel-aware, NOT /api/botsson/voice/token)
  └─> Room.connect(LiveKit Cloud), room=channel:<channelId>
  └─> services/voice-agent (autojoins same worker)

Capability calls on mobile use a DIFFERENT path:
  use-voice-transcripts.ts :: onFinalTranscript
    └─> POST /api/emma/voice/transcript
          └─> POST {STAGE_ENGINE_URL}/agent/chat  channel="voice"
                └─> routeAgentMessage()  (same harness as web Orb)
```

- **NO context_init publisher.** Mobile hook never sends `"botsson-context"` data messages. The voice-agent receives `ctx.user=null`/`ctx.workspace=null` for any mobile-initiated room and `adapter.ask()` early-returns "brukerdata mangler".
- Different room semantics than web Orb: channel rooms carry `channel_ai_policy.voice_participation` (listen_only/interactive) gates; Orb rooms do not.
- Telemetry: emitted in BFF transcript route, not in voice-agent.

### 1.2 Stage Engine — the L3 harness

`services/stage-engine/src/`. Hono service on port 5010. Routes split by surface:

| Route | Used by |
|---|---|
| `POST /agent/chat` | Web Orb voice-agent ask(), web BFF chat (`/api/emma/chat`, `/api/botsson/chat`), mobile transcript proxy |
| `POST /adapters/ultravox/create-call` + `/store` `/fetch` `/advance` | Ultravox path ONLY — entirely separate route tree |
| `POST /agent/queue` `/agent/dispatch` | Sixten orchestration, not Botsson voice |
| `GET /sessions` `/recorder/metrics` `/health` | Internal/observability |

`/agent/chat` invokes `core/agent-router.ts :: routeAgentMessage()` which serializes through `core/session-lane.ts`, walks intent classifier → tool-selector → capability tool, hooks recorder at six points, emits guardian events on user-message and agent-response.

`/adapters/ultravox/*` skips ALL of the above. It has its own session lifecycle in `routes/adapters/ultravox.ts` and its own session-manager prompt-build path.

### 1.3 Tool surfaces — three layers

| Layer | Where defined | Count | Governance |
|---|---|---|---|
| Capability tools | `packages/ai/src/capabilities/*/tools.ts` | ~70 across 28 capabilities | gate_action, ADR-0078 channel guard, telemetry, server-derived workspace_id |
| Voice-agent tools | `services/voice-agent/src/tools-{orb,personal,capability,schedule}.ts` | 27 (8 orb + 5 personal + 11 capability + 3 schedule) | Most proxy via `ask()` to capability layer; orb + schedule are local |
| Ultravox client tools | `apps/web/src/app/onboarding/hooks/useBotsson.ts` | 14 `temporaryTool` defs | None — execute in browser, mutate React state |

**12 of 14 Ultravox client tools have a capability-layer twin** (e.g. `useBotsson.updateBusiness` ↔ `onboarding.update_business`). Ultravox copies skip gate_action, skip telemetry, skip server-side workspace_id.

### 1.4 System prompt sources — three live versions

| Source | File | Used by |
|---|---|---|
| Mission registry | `packages/ai/src/missions/registry.ts` (mr-botsson, onboarding-interview, etc.) | Stage-engine session-manager when chat path or Ultravox path resolves a mission |
| Voice-agent hardcoded | `services/voice-agent/src/agent.ts:35-62` `BOTSSON_VOICE_INSTRUCTIONS` | Web LiveKit Orb + mobile LiveKit (any voice-agent room) |
| Onboarding mission DB rows | `engine_process` / mission seed migrations | Ultravox onboarding wizard via session-manager |

The Jarvis-mode patches landed today (`6a67f10f2`, `ea9f3091c`) updated source 1 (mission registry mr-botsson) and source 2 (voice-agent hardcoded). Source 3 (onboarding-interview mission and DB-seeded prompts) is unchanged.

### 1.5 Context pipe — partial coverage

| Surface | user_context | workspace_context | route_context | ADR-0151 |
|---|---|---|---|---|
| Web LiveKit Orb | ✅ server-derived | ✅ server-derived | partial (pathname only, entity always null) | ✅ |
| Web Ultravox | ❌ missing | ❌ missing | ❌ missing | ❌ workspace_id body-overridable |
| Mobile LiveKit | ❌ no publisher | ❌ no publisher | ❌ no publisher | ✅ for profile_id (BFF-derived in transcript route) |
| BFF Chat | ❌ missing | ❌ missing | ❌ missing | ✅ |

Stage-engine `chatSchema` declares all three context blobs as **optional**, so absence is legal but means the agent reasons without season/framework/cycle/role context.

---

## 2. Intended architecture (how it should work)

Per ADR-0282 (council-approved 2026-05-04, status `proposed`) + the BOTSSON-SYSTEM-MAP `verified_against_code: 2026-05-06` baseline:

1. **Single voice plane: LiveKit only.** `apps/web/src/components/voice-assistant.tsx` deleted or rewritten as `<InterviewSurface persona={...} />` LiveKit-Room wrapper. `useBotsson.ts` rewritten against `VoiceProvider` abstraction. `services/stage-engine/src/routes/adapters/ultravox.ts` + `lib/ultravox.ts` + `types/ultravox.ts` + `packages/agent-sdk/src/providers/ultravox.ts` deleted.
2. **Single system prompt source.** Mission registry is canonical. Voice-agent reads its instructions from the resolved mission (via stage-engine on session start), not from a hardcoded constant in `agent.ts`.
3. **Single tool surface.** Capability layer is the only source of truth. Voice-agent forwards every non-orb tool via `ask()`. Orb-control tools (expand/collapse/pulse/navigate) stay local because they manipulate the LiveKit Room and browser DOM.
4. **One context pipe.** Server-derived `user_context` + `workspace_context` published over LiveKit data channel by every surface (web Orb already does it; mobile must follow same pattern). Schema validated server-side; no body fallback.
5. **One telemetry path.** Every voice and chat turn emits via `/agent/chat`. No surface bypasses.
6. **voice-agent = thin shell.** Imports nothing from `@smartout/ai`. Owns LiveKit room state, OpenAI Realtime config, and the `ask()` HTTP bridge. Nothing else.

---

## 3. Broken or missing integrations

| # | Issue | File:line | Severity | Evidence |
|---|---|---|---|---|
| B1 | `workspace_id` forgeable on Ultravox path | `apps/web/src/app/api/wizard/start/route.ts:80` | HIGH (security, ADR-0151 violation) | `workspaceId = body.workspace_id ?? profile?.workspace_id` — body wins silently, no cross-check |
| B2 | Mobile LiveKit voice-agent never receives context_init | `apps/mobile/src/hooks/use-botsson-voice-session.ts` (no equivalent of `BotssonOrbVoiceMount.tsx:331-339`) | HIGH (functional dead-end) | adapter.ask() returns "brukerdata mangler" on every capability call from mobile voice |
| B3 | Voice-agent `BOTSSON_VOICE_INSTRUCTIONS` diverged from mission registry | `services/voice-agent/src/agent.ts:35-62` vs `packages/ai/src/missions/registry.ts:200+` | MEDIUM (drift, persona inconsistency) | Different rules, different tool mentions, must be updated separately. Council ADR-0282 mandates removal. |
| B4 | Onboarding mission system prompt not Jarvis-aligned | `packages/ai/src/missions/registry.ts:15-160` (`onboarding-interview`) | LOW (not in scope of today's Jarvis ask, but inconsistent) | Same Mr. Botsson character behaves differently across surfaces |
| B5 | Ultravox path has zero turn-level telemetry | `services/stage-engine/src/routes/adapters/ultravox.ts` (no `botsson.turn_*` emit) | HIGH (audit gap) | Every onboarding voice session produces zero `activity_trail` rows; recorder is never invoked |
| B6 | Silent context-fetch degradation on web Orb | `BotssonOrbVoiceMount.tsx :: fetchSessionContext()` returns null on failure, logs `console.warn`, no user surface | MEDIUM (UX) | Orb shows "listening" but every tool call fails; user sees nothing |
| B7 | 3 voice-agent capability tools dead-on-arrival | `services/voice-agent/src/tools-capability.ts:116,135,228` (`get_helpdesk_status`, `get_training_progress`, `get_knowledge`) | LOW (UX) | Capabilities `helpdesk_query`, `training`, `kb_query` have `allowedChannels:["chat"]`; L2 channel guard always rejects on voice |
| B8 | route_context entity-id never populated | `BotssonOrbVoiceMount.tsx :: buildRouteMessage()` always sets entity_type/entity_id/entity_label = null | LOW | Agent cannot reason about focused entity (selected shift, opened person) |
| B9 | Token mint paths diverge between web Orb and mobile | `/api/botsson/voice/token` (web) vs `livekit-token` Edge Function (mobile, channel-aware) | MEDIUM (semantic drift) | Different room naming, different policy gates, voice-agent autojoins both with no way to distinguish |

---

## 4. Duplicated services / "service-on-service" patterns

| Duplicate | Cost |
|---|---|
| Ultravox adapter route tree (`services/stage-engine/src/routes/adapters/ultravox.ts`) parallels `routes/agent/chat.ts` | Two reasoning pipelines, two telemetry shapes, two prompt-build paths, two session-manager helper sets. ADR-0282 Phase E6 deletes this. |
| Ultravox client `temporaryTool` definitions parallel capability tools | 12 functional duplicates for update_business, update_season, add_departments/locations/zones/procedures, search_company, identify_company, scrape_website, add_key_fact, save_memory. Ultravox copies skip ALL governance. |
| Three system-prompt sources for one persona | Mr. Botsson behaves differently on three surfaces. Maintenance load = 3x. |
| Two LiveKit token-mint paths | `/api/botsson/voice/token` (Orb) and `livekit-token` Edge Function (channel rooms). Voice-agent autojoins both but can't distinguish caller intent. |

**Genuine "service-on-service" anti-patterns:** none observed once the Ultravox path is deleted. Voice-agent → stage-engine is a clean BFF pattern, not a service-on-service. The Ultravox runtime is the single anti-pattern instance.

---

## 5. Root causes of degraded voice behavior

Pontus reports: (a) "Error 400 fetching info to Botsson", (b) Botsson auto-greets, (c) Botsson is too chatty / not Jarvis-mode.

| Symptom | Most likely root cause | Evidence |
|---|---|---|
| Auto-greeting on Orb open | Voice-agent system prompt explicitly told the model to introduce itself as "Mr. Botsson, Smartouts AI-assistent" with no "wait for user" rule. Patched today in `ea9f3091c`. | `services/voice-agent/src/agent.ts:36` (pre-patch) |
| Auto-greeting on dashboard widget (Ultravox) | `mr-botsson` mission greeting field used by `voice-assistant.tsx:274` only on fallback path; the actual TTS auto-greet came from system prompt. Patched today in `6a67f10f2`. | `packages/ai/src/missions/registry.ts:205` (pre-patch) |
| Auto-greeting on onboarding wizard | Onboarding mission system prompt section "1. ÅPNING" instructs `Si: "Hei! Jeg er Botsson..."`. **NOT patched.** | `packages/ai/src/missions/registry.ts:79` |
| Error 400 — most likely surfaces | The 400 came on a real authenticated request. Three plausible routes: (i) `/api/emma/chat` BFF → stage-engine `/agent/chat` Zod schema reject when context blobs absent or shape changed, (ii) `/api/botsson/voice/session-context` rejecting because profile lacks role/department, (iii) `/api/wizard/start` rejecting workspace_id mismatch. Without the request payload + response body from devtools, cannot pinpoint. | Stage-engine `/agent/chat` route returned 401 (unauthenticated probe), so route is alive. 400s require an auth'd payload to reproduce. |
| Mobile voice "doesn't do anything" | Mobile LiveKit path connects but voice-agent has no `ctx.user` → every capability call returns "brukerdata mangler". The room is up, audio flows, but the agent cannot answer about the workspace. | B2 above |

**Convergent root cause:** the harness has THREE entry points to the same persona (Ultravox, web LiveKit Orb, mobile LiveKit) and they were built incrementally without consolidating prompts, context, and governance. ADR-0282 was approved 4 days ago to fix this; nothing has shipped against it.

---

## 6. Files / modules most likely responsible

Ranked by blast-radius for the symptoms above:

1. **`services/voice-agent/src/agent.ts`** — system prompt, model config, room connect, context handlers. Touched 8× in last 14 days. Highest churn on voice path.
2. **`services/voice-agent/src/adapter.ts`** — single bridge to stage-engine. `ask()` failure surfaces as "brukerdata mangler" without telemetry. If this returns null silently, every voice tool fails.
3. **`apps/web/src/app/Botsson/_components/BotssonOrbVoiceMount.tsx`** — context-pipe publisher for web. If `fetchSessionContext()` 4xx's, orb is connected but agent is blind.
4. **`apps/web/src/app/api/botsson/voice/session-context/route.ts`** — context source. Profile + workspace + season + framework + cycle 4-way join. Any null surface here → 401/403/500.
5. **`apps/web/src/app/api/wizard/start/route.ts`** — Ultravox bridge. Forgeable workspace_id. Returns 400/401 on missing profile/workspace mismatch.
6. **`services/stage-engine/src/routes/agent/chat.ts`** — `chatSchema` Zod. If recent commits tightened any field, BFF requests with old shape get 400.
7. **`packages/ai/src/missions/registry.ts`** — three live missions affecting persona. Mid-priority for symptom (b)/(c), low for (a).
8. **`apps/mobile/src/hooks/use-botsson-voice-session.ts`** + **`use-voice-transcripts.ts`** — mobile path. Missing context publisher.
9. **`services/stage-engine/src/routes/adapters/ultravox.ts`** + **`services/stage-engine/src/lib/ultravox.ts`** — Ultravox adapter. Slated for deletion under ADR-0282.
10. **`apps/web/src/components/voice-assistant.tsx`** + **`apps/web/src/app/onboarding/hooks/useBotsson.ts`** — Ultravox client. Slated for rewrite/deletion under ADR-0282.

Dead code:
- **`packages/ai/src/adapters/livekit.ts`** (`toLiveKitTools`) — zero callers, zero tests. Confirmed orphan.
- **`services/voice-agent/src/tools-mission.ts`** — `getMissionProgress`, `getWhatsNext` never imported.

---

## 7. Recommended repair plan (priority order)

Each step is independently deployable. Each step has a falsifiable acceptance test.

### P0 — Today (verification + low-risk fixes only)

| # | Action | File | Acceptance |
|---|---|---|---|
| P0.1 | **Diagnose Pontus' 400.** Capture request payload + response body from browser devtools when 400 reproduces. Without this, P1+ may not address the actual symptom. | (Pontus action) | Payload + response written into incident note |
| P0.2 | Fix forgeable workspace_id on Ultravox path | `apps/web/src/app/api/wizard/start/route.ts:80` change `workspaceId = body.workspace_id ?? profile?.workspace_id` to `workspaceId = profile?.workspace_id` and reject mismatch with 403 | Probe with body `workspace_id` ≠ JWT-resolved → 403. ADR-0151 invariant I4 stays green. |
| P0.3 | Cut canary probe 3 (currently fake-UUID body) | `infra/scripts/botsson-canary.sh` strip probe_agent_chat_authed or rebuild against a real round-trip with `op://smartout_ai_prod/Botsson/canary_session` payload | Canary green; no false positives. |
| P0.4 | Fix `voice-assistant.tsx` empty-greeting fallback bubble | `apps/web/src/components/voice-assistant.tsx:274` skip push when `manifest.greeting` is empty string | Manual: open Orb when stage-engine returns no joinUrl; verify no empty bubble before "Voice unavailable" |
| P0.5 | Sort the 4 stale dirty files (mobile chat fix is real, reconciliation pair is intentional, welcome motion is exploratory) | Files in `git status`. Two commits + one stash. | `git status` clean except WelcomeClient |

### P1 — This week (close the worst gaps)

| # | Action | Acceptance |
|---|---|---|
| P1.1 | **Mobile context_init publisher.** Build mobile equivalent of `BotssonOrbVoiceMount.tsx:331-339`. New file `apps/mobile/src/hooks/use-botsson-context-publisher.ts` that fetches `/api/botsson/voice/session-context`, publishes over data channel topic `"botsson-context"` on connect + on route change. | Mobile voice call → voice-agent log shows `setSessionContext` for that profile. `ask()` calls return real responses, not "brukerdata mangler". |
| P1.2 | **Stop silent context-fetch degradation on web Orb.** `BotssonOrbVoiceMount.tsx` — surface `context_init` failure as a toast + auto-disconnect after 3 retries; emit telemetry. | Manual: kill `/api/botsson/voice/session-context`; orb disconnects with toast within 6s. |
| P1.3 | **Onboarding-interview mission Jarvis-alignment.** `packages/ai/src/missions/registry.ts:15-160` — rewrite system prompt to remove auto-open `Si: "Hei!..."`, mirror Jarvis rules from mr-botsson. | Onboarding voice session → agent waits for user input. |
| P1.4 | **Delete dead code.** `packages/ai/src/adapters/livekit.ts`, `services/voice-agent/src/tools-mission.ts`. | Typecheck green; grep for imports returns zero. |
| P1.5 | **Remove DOA voice-agent tools** (`get_helpdesk_status`, `get_training_progress`, `get_knowledge`) OR add `voice` to `allowedChannels` for those capabilities (council-question — pin first). | Pontus pin: drop or extend. Then code change. |
| P1.6 | **Set Sentry DSN + canary GH secrets in production.** PROD_STAGE_ENGINE_URL, PROD_STAGE_ENGINE_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID. | First scheduled cron run green; Sentry error appears on synthetic exception. |

### P2 — Next 2 weeks (consolidation per ADR-0282)

ADR-0282 is council-approved, status `proposed`. Estimated 5-8 days. Sequence is in the ADR itself (E1-E9). Summary:

| Phase | Action |
|---|---|
| E1 | 8-9 NEW capability tools/bridges (already partially landed via ADR-0275 — `onboarding` capability shipped 2026-05-04) |
| E2 | `getOnboardingState` BFF endpoint |
| E3 | `BotssonProvider.tsx:693` `provider:"ultravox"` → `"livekit"`; `useBotsson.ts` rewrite against `VoiceProvider` abstraction |
| E4 | `voice-assistant.tsx` rewrite as `<InterviewSurface persona={...} />` LiveKit wrapper (preserves Lise + Botsson personas) |
| E5 | `/api/wizard/start` flips to LiveKit token mint |
| E6 | Delete `ultravox-client` dep + 12 surfaces. Grep for `ultravox` returns zero in code. |
| E7 | Krisp NC wiring (already-installed packages) |
| E9 | VAD parity gate — `services/voice-agent/scripts/vad-bench.ts` — P50 ≤600ms, P95 ≤900ms, false-end ≤5% |

### P3 — Architectural cleanup (post-consolidation)

| # | Action |
|---|---|
| P3.1 | **Mission-driven voice prompt.** Voice-agent reads `BOTSSON_VOICE_INSTRUCTIONS` from the resolved mission via stage-engine on session start, not from a hardcoded constant. |
| P3.2 | **Unified context-pipe schema.** Pin `user_context` + `workspace_context` + `route_context` as required (not optional) on stage-engine `chatSchema`. Migrate all four BFF surfaces to populate. Add CI invariant. |
| P3.3 | **Token mint convergence.** One token-mint route for both web Orb and mobile, parameterized by `purpose` and channel policy gates. |
| P3.4 | **route_context entity enrichment.** Web Orb `buildRouteMessage()` resolves focused entity from route + URL params. |

---

## 8. What to test after each fix

| Step | Test |
|---|---|
| P0.2 | Probe `POST /api/wizard/start` with body workspace_id ≠ JWT — expect 403; original happy path still 200. Run existing E2E `apps/e2e/playwright/onboarding.spec.ts` if present. |
| P0.4 | Manually open Orb when stage-engine 502s — verify no empty agent bubble. |
| P1.1 | Mobile Detox test (when present): voice call → ask "hva er min vakt i morgen" → expect non-empty answer mentioning workspace name. Cross-check voice-agent logs for `[botsson-voice] context updated: context_init`. |
| P1.2 | Inject `/api/botsson/voice/session-context` 500 in dev; expect orb auto-disconnects with visible toast within 6s; PostHog event `voice_session_context_failed` fires. |
| P1.3 | Open onboarding wizard with voice; verify agent does NOT speak first; user prompt "hei" → expected reactive Jarvis-style response. |
| P1.4 | `pnpm turbo typecheck` green. `grep -r "toLiveKitTools\|getMissionProgress\|getWhatsNext" packages/ services/ apps/` returns zero. |
| P2.E3-E5 | Onboarding wizard voice still functional after each migration step; no overnight gap (ADR-0282 R6 explicit). |
| P2.E6 | `grep -r "ultravox\|UltravoxSession\|UltravoxSessionStatus" apps/ packages/ services/` returns zero outside `docs/`, comments, migrations. |
| P2.E9 | VAD bench: P50 ≤600ms, P95 ≤900ms, false-end-of-turn ≤5% on golden-transcript fixtures. |

---

## 9. Open questions for Pontus

1. **Capture the 400 payload.** Audit cannot pinpoint without devtools network capture. Reproduce + paste request URL, payload, response body.
2. **Voice-mode helpdesk/training/kb_query** — drop the DOA tools or extend the capabilities to allow voice channel? Council decision needed.
3. **ADR-0282 sortie scheduling** — 5-8 days estimated, currently `proposed`. Block on board ack or proceed?
4. **route_context entity enrichment** — is there a focused-entity contract Pontus wants (current selected shift, opened person on page)?

---

## 10. What this audit does NOT cover (out of scope, flagged for future)

- Sixten orchestration runtime (`packages/ai/src/agents/`, file-backed task queue) — separate harness layer
- Engine-world Phase 1+2 shared state (`packages/ai/src/capabilities/engine-world/`) — separate audit
- Recorder/whisper/break-glass platform-admin surfaces — covered in ADR-0184/0185 audits
- Capability-layer ADR-0099 compliance per capability — covered by `adr-contract-audit` skill
- Performance/latency benchmarks beyond E9 — see `services/voice-agent/scripts/vad-bench.ts` (TBD)

---

*Audit verified against code at HEAD `27eb50253` (development @ 2026-05-08 09:50 UTC). Re-verify before Phase 2 sortie launch.*
