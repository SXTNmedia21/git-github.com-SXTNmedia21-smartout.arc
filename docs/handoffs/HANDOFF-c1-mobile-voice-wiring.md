---
title: "Handoff — C1 Mobile Voice Wiring (server primitives + transcript hook)"
status: ready
updated: 2026-04-24
created: 2026-04-24
module: ai-agent
tags: [handoff, mobile, voice, livekit, stage-engine, bff, adr-0132, adr-0135, campaign-c1]
---

# Handoff — C1 Mobile Voice Wiring

**Branch:** `feat/botsson-arena-c1-mobile-voice-wiring`
**Plan:** `docs/plans/PLAN-mobile-voice-wiring.md`
**ADRs honoured:** 0078 (channel guard), 0132 (mobile thin client), 0133 (web composes / mobile executes), 0134 (mobile telemetry), 0135 (LiveKit on mobile)
**Status:** server primitives + mobile transcript hook delivered. Botsson UI session wiring (`BotssonProvider.startVoiceSession()` → real LiveKit Room + Expo Speech TTS) deliberately deferred to **C1.b** (see "Spin-outs" below).

---

## What shipped

### Server primitives (load-bearing, ship-or-skip)

| File | Lines | What |
|------|------:|------|
| `apps/web/src/app/api/emma/voice/transcript/route.ts` | +267 | New BFF route. Pins `channel='voice'` server-side. Defence-in-depth `voice_participation` re-check. Proxies to stage-engine `/agent/chat`. PII-redacted telemetry (transcript text never leaves to PostHog). |
| `apps/web/src/app/api/emma/voice/transcript/__tests__/route.test.ts` | +228 | 6 unit tests locking I1–I4 invariants (channel pin, disabled→403, listen_only short-circuit, interactive→stage-engine, 401 unauth, 400 bad body). |
| `supabase/functions/livekit-token/index.ts` | +49 / -10 | New `purpose: 'human_call' \| 'ai_voice'` parameter. `ai_voice` reads `channel_ai_policy.voice_participation` instead of `channel.audio_policy`. `disabled` → 403. `listen_only` → token grants subscribe + data but locks mic. Default keeps every existing caller on the legacy `human_call` path — zero regression. Surfaces `purpose` + `voiceParticipation` in token response so the mobile UI can render mic-locked vs. open without a second round-trip. |

### Mobile control plane

| File | Lines | What |
|------|------:|------|
| `apps/mobile/src/hooks/use-voice-transcripts.ts` | +298 | Room-agnostic hook. Subscribes to `RoomEvent.TranscriptionReceived`, dedupes by `segment.id`, only forwards `final` transcripts. POSTs to BFF with Bearer JWT, dispatches agent response via `onResponse` callback for caller-driven TTS. Emits `voice.session_started` on mount, `voice.session_ended` on cleanup OR `Room.Disconnected`. Telemetry never blocks voice UX (try/catch swallow). |
| `apps/mobile/src/lib/web-api.ts` | +9 | `getEmmaVoiceTranscriptUrl()` helper following the `getEmmaChatUrl()` pattern. |
| `packages/walkieTalkie/src/call-mutations.ts` | +22 | `getLiveKitToken` accepts optional `purpose` and `TokenResult` exposes `voiceParticipation`. Backwards-compatible. |

### Telemetry contract (Invariant: 100% emit-registry coverage)

| File | Lines | What |
|------|------:|------|
| `packages/telemetry/src/registry.ts` | +92 | 4 new event interfaces (`VoiceSessionStarted`, `VoiceSessionEnded`, `VoiceTranscriptIn`, `VoiceResponseOut`) + union entries + `EVENT_ROUTING` rows. All four destinations (PostHog + logger + activity_trail + engine_event). PII-redacted payloads (lengths + latencies, never transcript text). |

### Regression guards

| File | Lines | What |
|------|------:|------|
| `packages/ai/src/router/__tests__/tool-selector-voice-pii.test.ts` | +60 | Live-registry test that locks `contract_intake` (real registered capability) is excluded when `channel='voice'` even at autonomous authority + 1.0 confidence. If anyone weakens ADR-0078's channel guard, this test breaks. |

### Documentation

- `docs/architecture/BOTSSON-SYSTEM-MAP.md` — L2 LiveKit BFF row promoted 🔴 → 🟡, L4 LiveKit adapter row updated.
- `docs/plans/CAMPAIGN-botsson-arena.md` — Phase C / C1 marked `[~]` partial with C1.b spin-out reference.

---

## Acceptance gate evidence

| # | Criterion | Status | Evidence |
|--:|-----------|:------:|----------|
| 1 | Mobile hook `useVoiceTranscripts` exists | ✅ | `apps/mobile/src/hooks/use-voice-transcripts.ts` |
| 2 | BFF accepts `channel='voice'` + `livekit_room_id` | ✅ | Route exists; Zod schema requires `livekitRoomId`. Note: the schema does NOT accept `channel` — this is the strongest possible form of "accepts voice" (it's the only thing the route does). |
| 3 | BFF pins channel server-side | ✅ | Test I1 (`forwards channel='voice' to stage-engine — and the schema rejects a client-supplied channel field`). Sends body with `channel: 'chat'` smuggled in; assertion confirms `forwarded.channel === 'voice'`. |
| 4 | `livekit-token` enforces voice_participation | ✅ | Edge function source: `voice_participation === 'disabled'` → 403 with `code: 'VOICE_PARTICIPATION_DISABLED'`. BFF re-check tested (I2). End-to-end Deno-runtime test for the edge function itself is **not added** (no Deno test runner in repo); see "Test gaps" below. |
| 5 | Voice telemetry events registered | ✅ | `grep -E '^  "voice\.' packages/telemetry/src/registry.ts` returns 4 hits (`session_started`, `session_ended`, `transcript_in`, `response_out`). All four destinations. |
| 6 | Voice-forbidden capability filtered | ✅ | `pnpm --filter @smartout/ai test -- --run src/router/__tests__/tool-selector-voice-pii.test.ts` — 3 tests pass against the LIVE registry. |
| 7 | Gate audit with `channel='voice'` | ✅ (existing infra) | `gate_action(p_channel TEXT)` exists since 2026-05-09 migration; `gatedMutation.ts:322` plumbs `args.channel` through. The agent-router already passes `channel` from session to `AgentToolContext`. Voice → tool → gate writes `gate_evaluation.channel='voice'`. **No code change needed in this sortie**; the path is lit up by the BFF pinning `channel='voice'`. |
| 8 | Scoped typecheck 0 errors | ✅ | `pnpm --filter web typecheck` ✓ · `pnpm --filter mobile typecheck` ✓ · `pnpm --filter @smartout/ai typecheck` ✓ · `pnpm --filter @smartout/telemetry typecheck` ✓ · `pnpm --filter stage-engine typecheck` ✓ · `pnpm --filter @smartout/walkie-talkie typecheck` ✓. |
| 9 | Lint no regression | ✅ | `pnpm --filter @smartout/ai lint` — 25 pre-existing warnings, 0 errors, no new findings. |
| 10 | No regression in web Ultravox | ✅ | Web is untouched. `pnpm --filter web test -- --run src/app/api/emma/chat` — 7 tests pass (regression sweep). Ultravox provider in `packages/agent-sdk` not modified. |

### Test summary

```
apps/web              → 6 new tests, all green; 7 emma-chat regression tests, all green
packages/ai           → 3 new tests, all green; 53 router regression tests, all green
packages/telemetry    → typecheck green; pre-existing parity test failure on
                        session-watchdog-demoter is NOT introduced by this sortie
                        (git diff campaign/botsson-arena -- packages/telemetry/__tests__/parity.test.ts
                         supabase/functions/session-watchdog-demoter/ → empty)
```

---

## Latency measurements

Latency could not be measured end-to-end on dev (no LiveKit dev cluster running locally + no mobile device hooked into BFF). Recipe for measurement once C1.b lands and a dev LiveKit room is available:

1. **ASR latency** is captured per-transcript at the source: `useVoiceTranscripts` computes `lastReceivedTime - firstReceivedTime` for each `TranscriptionSegment` (LiveKit-emitted). Sent to BFF as `asrLatencyMs`. Visible in `voice.transcript_in.data.asr_latency_ms`.
2. **Stage-engine pipeline latency** is computed server-side in the BFF: `t_response_received - t_request_arrived`. Returned to the client as `pipelineLatencyMs` and emitted in `voice.response_out.data.pipeline_latency_ms`.
3. **TTS latency** depends on TTS provider chosen in C1.b. If Expo Speech: it is platform-native and synchronous. If a remote TTS provider lands, add `voice.tts_synthesized` event with its own latency field.

Aggregated dashboards: `engine_event` rows for the four `voice.*` event types are query-ready in PostHog and Supabase.

---

## Surprises / things future-Pontus needs to know

### S1 — `livekit-token` had two policy surfaces, not one

The plan said: enforce `channel_ai_policy.voice_participation`. The existing edge function enforced `channel.audio_policy` + `channel.video_policy`. These are NOT the same field — the former gates the AI, the latter gates human-to-human calls. Naively replacing one with the other would have broken `useLiveKitCall` (channel calls / PTT) for every mobile user.

Resolution: added a new `purpose` parameter. Default `'human_call'` keeps every existing caller on the legacy path. Botsson voice sets `'ai_voice'` to opt into the AI policy gate. The two gates can coexist and stack in the future (e.g. a channel can disable both human and AI voice independently).

### S2 — Mobile uses `/api/emma/chat`, not `/api/botsson/chat`

The plan wrote "Extend `/api/botsson/chat` BFF". Reality: `/api/botsson/chat` is admin-only (web admin Botsson). Mobile users hit `/api/emma/chat` (Bearer-JWT supporting, employee-facing). For voice consistency, the new route is `/api/emma/voice/transcript`, not `/api/botsson/voice/transcript`. If a future admin-from-web voice surface is needed, a sibling `/api/botsson/voice/transcript` should be added (mirrors the chat split).

### S3 — `useLiveKitCall` is for channel calls, NOT for Botsson voice

Mobile already had `useLiveKitCall` for human-to-human PTT/group calls. Botsson voice is a different surface (one user + one AI in a room). They could share `useLiveKitCall` if the caller passes a Botsson-dedicated `roomName`, but the mic-toggle / active-speaker semantics are wrong for AI-driven sessions. C1.b will likely introduce a `useBotssonVoiceSession` hook that owns the LiveKit Room AND wires the new `useVoiceTranscripts` hook in one place.

### S4 — Phantom-capability scrutiny: my own work

The Botsson Harness Builder system prompt warns about "phantom" infrastructure that emits but never produces an artefact (Invariant 11 in the journey-engine CLAUDE.md). I checked my own work against this: the BFF route DOES forward to stage-engine and DOES return real text from the agent's `routeAgentMessage()`. The hook DOES POST and DOES dispatch the response via `onResponse`. The telemetry DOES register first, then emit. None of the new code emits a "started" event without producing the artefact. No phantom.

### S5 — `voice.session_started`'s `voice_participation` defaults to `'interactive'`

The mobile hook emits `voice.session_started` with `voice_participation: 'interactive'` because, by the time the hook is mounted with a live Room and `disabled=false`, the LiveKit token MUST have been issued for `interactive` (a `listen_only` token doesn't get the hook caller far — they can't speak). Future enhancement: thread the resolved policy from `getLiveKitToken` response into the hook so the field reflects the actual policy. Out of scope for C1.

### S6 — `engine_event` parity test pre-existing red

`pnpm --filter @smartout/telemetry test` shows one pre-existing failure: `parity.test.ts` flags `supabase/functions/session-watchdog-demoter/index.ts` for missing `engine_event` parity. Verified `git diff campaign/botsson-arena -- ` shows no touch on either file. This is unrelated debt; do not let the red test confuse a future closure.

### S7 — Typecheck hook in `.claude/hooks/typecheck.sh` re-modifies itself

While this sortie ran, an external hook process kept rewriting `.claude/hooks/typecheck.sh` with formatter changes. I reverted it to HEAD and excluded from this commit. If `git status` shows it modified after this sortie, it's that same external process and is unrelated to C1.

---

## Spin-outs

### C1.b — Botsson voice UI session (the actual "Jarvis" experience)

To get the demo working — user opens BotssonSheet, taps mic, speaks, hears Botsson reply — the following needs to land in a follow-up sortie:

1. **`useBotssonVoiceSession` hook** that:
   - Calls `getLiveKitToken({ channelId: <Botsson-room>, workspaceId, purpose: 'ai_voice' })`
   - Constructs a LiveKit Room and connects with the token
   - Wires `useVoiceTranscripts({ room, livekitRoomId, workspaceId, channelId, onResponse })`
   - Renders the agent text via Expo Speech (`expo-speech` is NOT yet a dep — `pnpm add expo-speech` in `apps/mobile`, EAS rebuild required)
   - Returns `{ status, isConnected, isMuted, toggleMic, end }`
2. **`BotssonProvider.startVoiceSession()`** wires this hook into the existing `voiceSessionRef` slot. **frontend-designer must NOT change** the public ref shape — it's part of the visual contract.
3. **`BotssonSheet`** — `frontend-designer` updates the orb states to track the new session (`connecting | active | listening | thinking | speaking | error`). Nordic Split rules apply.
4. **Decision: which channel hosts the Botsson room?** Two options:
   - **a** — A single workspace-wide "Botsson" channel with `voice_participation='interactive'` seeded at workspace bootstrap. Pros: one row to manage. Cons: every employee shares the same `roomName`, wasted LiveKit slots.
   - **b** — Per-profile or per-session ad-hoc rooms (no `channel_id`, just `workspace_id` + `profile_id`). The BFF already accepts `channelId: undefined`. Pros: clean per-user audio. Cons: requires a token-issue path that doesn't resolve `channel_ai_policy` (since there's no channel) — needs a workspace-level default for `voice_participation`.
   - Recommendation: **(a)** for v1, with a feature flag to migrate to (b) once usage warrants it.

### C1.c — Detox E2E

A full mobile E2E (Detox) that opens BotssonSheet, simulates a voice utterance, and asserts a response. Requires:
- Detox infra (not currently in repo)
- A LiveKit dev room setup
- Mock or real ASR provider

Estimated 1 sortie of its own. Not blocking C1 acceptance — the BFF and tool-selector tests cover the load-bearing invariants.

### Adjacent backlog items surfaced

- **`packages/agent-sdk/src/providers/livekit.ts`** is still a stub with `console.warn` calls. The C1 implementation deliberately bypasses this provider (BFF-routed control plane, LiveKit native client for media). Decide whether to delete the stub or implement it for parity with the Ultravox provider.
- **Stage-engine `agent-router.ts`** does not yet log `channel` distinctly to its session record — the channel is attached to each tool's gate audit, but no per-session "voice|chat" field exists for analytics. Consider adding when D2 (schedule diagnostics) lands.

---

## Decisions made (no new ADRs)

1. **`/api/emma/voice/transcript`, not `/api/botsson/voice/transcript`** — mirrors the existing `/api/emma/chat` pattern for employee/mobile traffic. See S2.
2. **`purpose` parameter on `livekit-token`, not a new edge function** — keeps the auth/membership/profile resolution logic in one place. See S1.
3. **Defence-in-depth voice_participation re-check in the BFF** — the LiveKit token already gates issuance, but if a workspace admin flips a channel to `disabled` mid-session, we don't want stale tokens to keep producing transcripts that reach the agent. Costs one DB query per transcript turn.
4. **Hook is room-agnostic** — `useVoiceTranscripts` takes any `Room | null`. Decouples from how the Room was created (Botsson session, channel call, future use cases).
5. **Telemetry redacts transcript text** — only character counts and latencies hit storage. Matches `botsson.turn_started`'s `[voice — transcript redacted]` precedent (ADR-0077).
6. **`actor_id` for telemetry uses `getProfileContext()` on the mobile side, BFF-resolved profile_id on the BFF side** — both paths converge on the same profile, both pass `nonEmpty()` (ADR-0134 invariant).

---

## Files changed (final inventory)

```
A  apps/mobile/src/hooks/use-voice-transcripts.ts                        (+298)
M  apps/mobile/src/lib/web-api.ts                                        (+9)
A  apps/web/src/app/api/emma/voice/transcript/route.ts                   (+267)
A  apps/web/src/app/api/emma/voice/transcript/__tests__/route.test.ts    (+228)
M  packages/ai/src/router/__tests__/tool-selector-voice-pii.test.ts      (NEW, +60)
M  packages/telemetry/src/registry.ts                                    (+92)
M  packages/walkieTalkie/src/call-mutations.ts                           (+22)
M  supabase/functions/livekit-token/index.ts                             (+49 / -10)
M  docs/architecture/BOTSSON-SYSTEM-MAP.md                               (2 row updates)
M  docs/plans/CAMPAIGN-botsson-arena.md                                  (1 row update)
A  docs/HANDOFF-c1-mobile-voice-wiring.md                                (this file)
```

`A` = added, `M` = modified.

---

## Next steps

1. **C1.b** sortie — see "Spin-outs" above. Estimated 1 sortie.
2. **C1.c** Detox E2E — separate sortie, lower priority.
3. **`livekit-token` Deno test** — write a Deno test for the edge function directly. Currently the policy enforcement is tested indirectly via the BFF route's defence-in-depth re-check. A direct test would tighten coverage but requires Deno test runner setup.
4. **Decide channel-id strategy for Botsson voice rooms** (S2 spin-out option a vs b).

The Jarvis moment now hinges on C1.b. The plumbing is laid; the orb and the TTS speak need wiring.
