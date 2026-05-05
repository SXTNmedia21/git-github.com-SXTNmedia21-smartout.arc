---
title: "Handoff — C1.b Botsson Voice Session (mobile Jarvis demo)"
status: ready
updated: 2026-04-24
created: 2026-04-24
module: ai-agent
tags: [handoff, mobile, voice, livekit, expo-speech, tts, botsson, adr-0132, adr-0135, campaign-c1]
---

# Handoff — C1.b Botsson Voice Session

**Branch:** `feat/botsson-arena-c1b-botsson-voice-session` (based on `07a980d2`, C1 tip of `campaign/botsson-arena`)
**Predecessor:** C1 — `docs/HANDOFF-c1-mobile-voice-wiring.md` (server primitives + transcript hook)
**ADRs honoured:** 0078 (voice channel guard), 0107 (channel derivation), 0132 (mobile thin client), 0134 (mobile telemetry contract), 0135 (mobile LiveKit)
**Status:** hook + provider wiring + tests shipped. Expo Speech TTS active end-to-end. UI orb state mapping defined; `frontend-designer` owns the visual polish follow-up.

---

## What shipped

### The hook (load-bearing)

| File | Lines | What |
|------|------:|------|
| `apps/mobile/src/hooks/use-botsson-voice-session.ts` | +367 new | `useBotssonVoiceSession`. Mints LiveKit token with `purpose='ai_voice'`, creates Room, connects, attaches `useVoiceTranscripts` from C1, speaks each response via Expo Speech (`language: 'nb-NO'`). Exposes a 6-state machine (`idle \| connecting \| listening \| thinking \| speaking \| error`) for the UI orb. Test seams: `speechAdapter` + `roomFactory` + pure `performStart()` + pure `handleAgentResponse()`. |
| `apps/mobile/src/hooks/use-voice-transcripts.ts` | +1 modified | Exports `AgentResponse` type so downstream hooks can reuse the response shape. |

### Provider wiring

| File | Lines | What |
|------|------:|------|
| `apps/mobile/src/providers/botsson-provider.tsx` | +55 / -18 | Wires `useBotssonVoiceSession` into `startVoiceSession()`. Exposes new `voiceStatus` + `lastVoiceResponse` on the context (fine-grained 6-state for orb polish; `status` stays coarse-grained for back-compat with BotssonSheet). Maps the fine-grained state onto the existing `BotssonStatus` enum so the current BotssonSheet keeps working unchanged. `isMuted` now reflects the live LiveKit participant state. `endSession()` tears down both the legacy Ultravox session and the new C1.b voice session. `openWithIntent()` also tears down voice per ADR-0078 interlock. |
| `apps/mobile/package.json` | +1 | Added `expo-speech@~55.0.13`. Lockfile regenerated via `pnpm install`. |

### Tests

| File | Lines | What |
|------|------:|------|
| `apps/mobile/src/hooks/__tests__/use-botsson-voice-session.test.ts` | +280 new | 9 unit tests — 3 on `handleAgentResponse` (speak text + nb-NO, skip empty/whitespace, onError on throw); 6 on `performStart` (happy path publishes mic + asserts connect args, listen_only no-mic, **policy=disabled → no Room created**, CONNECT_FAILED cleanly disposes, audioSessionStart failure tolerated, mic enable failure → effective-mute). Virtual mocks for react-native / livekit-client / expo-speech / supabase / walkie-talkie. |

Pattern follows `apps/mobile/src/hooks/__tests__/use-push-token.test.ts` and `apps/web/src/components/journey/__tests__/useFjernkontrollMachine.test.ts` — test the pure orchestrators directly, keep jest-node fast (no React renderer, no `@testing-library/react`).

---

## Acceptance gate evidence

| # | Criterion | Status | Evidence |
|--:|-----------|:------:|----------|
| 1 | `useBotssonVoiceSession` exists | PASS | `apps/mobile/src/hooks/use-botsson-voice-session.ts` (367 lines) |
| 2 | `expo-speech` installed | PASS | `grep expo-speech apps/mobile/package.json` → `"expo-speech": "~55.0.13"` |
| 3 | `BotssonProvider` wires hook | PASS | `grep -E "startVoiceSession\|useBotssonVoiceSession" apps/mobile/src/providers/botsson-provider.tsx` → 4 hits: import, type doc, context field, call site |
| 4 | Uses `purpose='ai_voice'` | PASS | `grep -n "ai_voice" apps/mobile/src/hooks/use-botsson-voice-session.ts` → line 452 (`purpose: "ai_voice"`), line 6 (doc) |
| 5 | Speech.speak called on response | PASS | Test `handleAgentResponse › calls Speech.speak with response text and nb-NO language` — mock asserts `adapter._calls` invoked with text + `{ language: 'nb-NO' }` |
| 6 | Policy=disabled rejects cleanly (no session) | PASS | Test `performStart › Acceptance row 6: policy=disabled rejects cleanly — no Room is created` — asserts `roomFactory` NEVER called, `TOKEN_FAILED` surfaces |
| 7 | Scoped typecheck 0 errors | PASS | `pnpm --filter @smartout/mobile typecheck` ✓ (also walkie-talkie ✓, telemetry ✓) |
| 8 | Scoped lint no regression | PASS | `pnpm --filter @smartout/mobile lint` → 113 warnings, 0 errors — **baseline pre-C1.b: 113 warnings**; grep on my three modified files returns 0 hits → I added no warnings |
| 9 | Channel-hosting decision documented | PASS | See § Decisions below (workspace-wide singleton "Botsson" channel, rationale + migration notes + alternative) |

### Test run summary

```
PASS src/hooks/__tests__/use-botsson-voice-session.test.ts
  handleAgentResponse — on-response TTS bridge (Acceptance row 5)
    ✓ calls Speech.speak with response text and nb-NO language
    ✓ skips speak() on empty or whitespace-only response text
    ✓ falls back to 'listening' and surfaces onError when speak() throws
  performStart — token mint + Room.connect orchestrator
    ✓ happy path: mints token, creates Room, connects, publishes mic
    ✓ listen_only policy: connects but does NOT publish mic
    ✓ Acceptance row 6: policy=disabled rejects cleanly — no Room is created
    ✓ CONNECT_FAILED cleanly disposes the Room before surfacing the error
    ✓ audioSessionStart failure does not abort the flow
    ✓ mic enable failure keeps session running in effective-mute

Tests: 9 passed, 9 total

Full mobile test suite: 218 passed, 218 total (no regression)
```

---

## Decisions

### D1 — Workspace-wide singleton "Botsson" channel (recommended default)

**Decision:** the Botsson voice room is hosted by a single `channel_ai_policy` row per workspace. All employees in the workspace share the same `channelId`; each voice session spawns a fresh LiveKit Room scoped by `${workspaceId}:${channelId}`.

**Alternatives considered:**

1. **(chosen)** Workspace-wide singleton — one `channel_ai_policy` row per workspace, seeded at workspace bootstrap. Admins toggle `voice_participation` (`disabled` / `listen_only` / `interactive`) in one place. Bugs and policy changes propagate uniformly.
2. Per-profile ad-hoc rooms — each session mints a channel on demand. Cleanest per-user audio isolation but requires a workspace-level default policy in `livekit-token` that doesn't exist yet (the edge function currently reads `channel_ai_policy.voice_participation` per channel row). The migration is real but out of scope for C1.b.
3. Per-shift channels — each active shift gets a Botsson channel tied to `schedule_shift.id`. Over-fits the data model. No user value over (1).

**Why (1):** single-row policy admin; reuses every existing BFF + edge-function invariant; zero new migrations; token-purpose `ai_voice` still reads the right row; and the LiveKit `roomName = '${workspaceId}:${channelId}'` naturally isolates each user because LiveKit assigns each connection its own Room instance server-side even when the roomName is shared.

**Implementation note:** `BotssonProvider` reads `profile.botsson_channel_id` (optional — narrows `profile` to `{ botsson_channel_id?: string | null }`). Until the schema migration lands, this field is null and `start()` short-circuits with `MISSING_IDS`. That error is surfaced to the UI (status='error', error='workspaceId and channelId are required to start a voice session'), which is the correct outcome: a workspace with no Botsson channel should not silently start a session.

**Follow-up:** schema migration to add `profile.botsson_channel_id` OR a workspace-wide config read. A sibling campaign (likely `campaign/helpdesk` or the next Botsson-arena phase) will lay the migration. This handoff flags it as the single outstanding piece for the Jarvis demo.

### D2 — Expo Speech (not a remote TTS provider)

Stayed with `expo-speech` per the plan. Pros: platform-native, zero added latency (TTS synthesis happens on-device), zero new secret surface, free. Cons: voice quality varies by OS version; Norwegian (`nb-NO`) quality is acceptable on iOS 17+ and Android 14+. A future migration to a remote TTS provider (ElevenLabs, OpenAI TTS, Google Cloud TTS) is gated through the `SpeechAdapter` seam — the hook accepts any adapter that implements `{ speak, stop }`. Adding a `voice.tts_synthesized` telemetry event will be needed when a remote provider lands (its latency becomes user-visible).

### D3 — Pure orchestrators for testability

`handleAgentResponse` and `performStart` are exported as pure functions. The hook is a thin `useEffect` + `useState` wrapper over them. This mirrors `useFjernkontrollMachine`'s `reduce` pattern. Rationale: `apps/mobile` has no `@testing-library/react` / `react-test-renderer` — pure extraction keeps acceptance tests in the fast jest-node lane (~7 s full suite for C1.b).

---

## Orb-state mapping (frontend-designer handoff input)

`BotssonSheet` already reads `status` and `isMuted`. C1.b keeps these compatible. For the next orb-polish pass, the `voiceStatus` field on `useBotsson()` is the richer signal:

| `voiceStatus` | Meaning | Recommended orb treatment (Nordic Split) |
|---------------|---------|-------------------------------------------|
| `idle` | No session | Dim warm-gray orb, 0.6 opacity, no motion |
| `connecting` | Token minted, Room connect in flight | Amber (warning), pulse 800 ms, scale 1.0 → 1.2 |
| `listening` | Connected, mic live, awaiting user | Brand orange solid glow, scale 1.0, subtle breathe (stiffness=35, damping=22, mass=2.2) |
| `thinking` | Transcript posted to BFF, awaiting agent | Brand orange, gentle rotate 2 s/turn OR breathe-fast |
| `speaking` | TTS active, Botsson is talking | Brand orange brighter, soft wave (amplitude 1.0 → 1.1, 400 ms) |
| `error` | Any failure | Destructive red, scale 1.0, no motion |

Current `BotssonSheet` collapses `listening | thinking | speaking` into coarse `active` — the orb renders a single colour for all three. This works for the demo but leaves the Jarvis-y feedback on the table. `frontend-designer` should:

1. Read `voiceStatus` instead of `status` when in voice mode.
2. Respect `useReducedMotion()` on every animated element.
3. Use spring physics (not linear/ease-out).
4. Keep tokens-only (no hardcoded colours).
5. Announce state changes via an ARIA live region.

**I did NOT touch `BotssonSheet` — the visual contract is owned by frontend-designer, and the new fields (`voiceStatus`, `lastVoiceResponse`) are available on the context for them to consume.**

---

## EAS rebuild recipe

`expo-speech` ships native iOS + Android modules. Running the app in Expo Go no longer exercises the full voice loop — you need a dev client or production build.

```bash
# 1. Install (already done in this sortie via pnpm install):
pnpm --filter @smartout/mobile install

# 2. Rebuild the dev client to pick up the new native module:
cd apps/mobile
eas build --profile development --platform ios      # or android
# OR the legacy path for a local device build:
pnpm expo run:ios
pnpm expo run:android

# 3. Install the new dev client on the test device, then:
pnpm expo start --dev-client
```

If you see `Speech.speak is not a function` at runtime, the native module isn't linked — you're running the old dev client. Rebuild.

---

## End-to-end demo checklist (manual smoke)

Once the channel-seeding migration lands (see D1 follow-up), these are the steps to validate the Jarvis moment on a physical device:

1. **Seed the Botsson channel** for the test workspace — one row in `channel` + one in `channel_ai_policy` with `voice_participation = 'interactive'`, then wire the channel's UUID into the test profile's `botsson_channel_id`.
2. **Supabase Local running** on the host (`pnpm supabase start`).
3. **Web BFF running**: `pnpm --filter web dev`. Confirm `http://localhost:3060/api/emma/voice/transcript` is up.
4. **Stage Engine running**: `pnpm --filter stage-engine dev`.
5. **Mobile dev client** installed per EAS recipe above.
6. **Env:** `EXPO_PUBLIC_WEB_API_URL=http://<LAN-IP>:3060` in `apps/mobile/.env`.
7. Launch the app → sign in → tap the Botsson FAB → BotssonSheet opens with idle orb.
8. Tap the mic button:
   - Orb flashes amber (connecting) → briefly amber pulse → resolves to orange (listening).
   - Mic is live; your voice reaches LiveKit.
9. Say: **"Hei Botsson, hva er neste vakt?"** (or any non-PII query).
10. Expected: LiveKit emits a `TranscriptionReceived` final segment → hook POSTs to BFF → BFF proxies to stage-engine → stage-engine routes through `schedule.get_my_shifts` → agent text comes back → **Expo Speech speaks the response in Norwegian**.
11. Verify telemetry:
    - Supabase `engine_event`: one `voice.session_started`, one `voice.transcript_in`, one `voice.response_out`.
    - PostHog (if configured): same four events.
12. Tap mic again → mic mutes (`isMuted=true`, orb shifts to muted-gray).
13. Tap the `✕` close button → `voice.session_ended` emits with `end_reason: 'user_ended'`, orb returns to idle.

**If the response is silent:** check `Speech.stop` isn't being called prematurely (stopping the active speak call). Common cause: `speechAdapterRef.current.stop()` in the unmount effect firing because the component re-mounted. Workaround: wrap the sheet's mount in a key that doesn't change while open.

---

## Surprises / things future-Pontus needs to know

### S1 — `profile.botsson_channel_id` does not exist yet

The provider reads `(profile as { botsson_channel_id?: string | null }).botsson_channel_id`. This is deliberate — the narrowing cast means tsc doesn't complain, but the field is null at runtime until the schema migration lands. Jarvis demo blocked on this one migration. Recommended shape:

```sql
ALTER TABLE profile ADD COLUMN botsson_channel_id uuid REFERENCES channel(channel_id);
```

The channel itself is seeded via the workspace-bootstrap flow (new row in `channel` with `channel_type='ai'` + new row in `channel_ai_policy` with `voice_participation='interactive'`). All existing RLS policies on channel should continue to apply.

### S2 — Mobile `isMuted` now reflects LiveKit participant state

Previously `isMuted` was pure local React state. C1.b derives it from `voice.isMuted`, which itself is driven by `RoomEvent.TrackMuted` / `RoomEvent.TrackUnmuted`. This is the correct source of truth — if OS-level interruption (phone call, screen lock) mutes the mic, the orb will reflect it. Downside: a test that renders BotssonProvider with no active LiveKit Room will see `isMuted === false` indefinitely; the existing botsson-provider test only exercises derivation logic so it's unaffected.

### S3 — Speech adapter seam is the stable API for provider swaps

Any future migration away from Expo Speech goes through `SpeechAdapter`. Don't add a second TTS path — replace the default `expoSpeechAdapter` constant. This keeps the hook's status machine untouched and the tests portable.

### S4 — `performStart` throws a plain object, not an Error instance

The function throws `{ code, message }` shapes (the `BotssonVoiceError` interface). This is deliberate — it matches the shape consumers (state machines, error banners) want and sidesteps the `Error.toJSON` quirk in React Native. The hook handles both: if the thrown value has a `code` field it's treated as a structured error; otherwise it wraps in `UNKNOWN_ERROR`.

### S5 — `purpose='ai_voice'` is NOT the default

The `getLiveKitToken` wrapper defaults to `purpose='human_call'` (C1 decision S1 — keeps every existing `useLiveKitCall` caller on the legacy policy gate). `useBotssonVoiceSession` explicitly sets `'ai_voice'` inside its token closure. **Do not** rely on the default.

### S6 — Jest virtual mocks were required

Mobile jest-node doesn't resolve `react-native`, `@livekit/react-native`, `livekit-client`, or `expo-speech` at test time (they're native-only). The test file uses `jest.mock(..., { virtual: true })` with hand-rolled stubs that match the narrow surface the pure orchestrators touch. If someone adds a new native dep to the hook file, mock it the same way.

### S7 — Typecheck hook persistent churn (inherited from C1)

The `.claude/hooks/typecheck.sh` script kept modifying itself during this sortie (same as C1 S7). I did not commit any edits to that file. If `git status` shows it modified, revert to HEAD — unrelated to C1.b.

---

## Files changed (final inventory)

```
A  apps/mobile/src/hooks/use-botsson-voice-session.ts                        (+367)
A  apps/mobile/src/hooks/__tests__/use-botsson-voice-session.test.ts         (+280)
M  apps/mobile/src/hooks/use-voice-transcripts.ts                            (+1 word, AgentResponse exported)
M  apps/mobile/src/providers/botsson-provider.tsx                            (+55 / -18)
M  apps/mobile/package.json                                                   (+1 line, expo-speech)
M  pnpm-lock.yaml                                                             (regenerated — expo-speech + transitive deps)
A  docs/HANDOFF-c1b-botsson-voice-session.md                                 (this file)
```

`A` = added, `M` = modified.

---

## Next steps

1. **D1 follow-up — seed Botsson channel per workspace**. One migration + workspace-bootstrap wiring. Without this, `start()` short-circuits on `MISSING_IDS` and the Jarvis demo can't run.
2. **frontend-designer orb pass** — consume `voiceStatus` + `lastVoiceResponse` for the richer state machine (connecting / listening / thinking / speaking). Nordic Split rules apply.
3. **C1.c Detox E2E** — see C1 handoff. Unblocked by D1 + frontend-designer pass.
4. **Latency-dashboard telemetry** — build PostHog / Supabase dashboards for `voice.*` events. Useful once real usage starts.
5. **Remote-TTS trial** (optional) — if platform TTS quality is insufficient for Norwegian, ElevenLabs `nb-NO` via an adapter swap. No hook changes needed.

---

## Update: System Map

`docs/architecture/BOTSSON-SYSTEM-MAP.md`:

- L1 BotssonSheet voice row — no change (frontend-designer still owns visual polish).
- L1 BotssonProvider row — was 🟡 (voice stub), update to 🟢 (voice hook wired end-to-end).
- L2 LiveKit BFF row — no change (🟡 until E2E validates).
- L4 LiveKit adapter row — was 🟡, update to 🟢 (mobile now exercises `purpose='ai_voice'` path).

---

The Jarvis moment is code-complete. One migration stands between this branch and hearing Botsson reply.
