---
title: "Design — LiveKit Phase 2: Voice Calls + Push-to-Talk"
status: approved
updated: 2026-03-22
created: 2026-03-22
module: webrtc
tags: [livekit, voice, push-to-talk, calls, realtime, mobile, krisp]
---

# Design — LiveKit Phase 2: Voice Calls + Push-to-Talk

> Real-time voice calling for Smartout channels. 1:1 calls, group calls, and push-to-talk
> walkie-talkie mode. Web + Mobile. LiveKit Cloud (EU) with Krisp noise cancellation.
> Extends Phase 1 channel messaging (merged to development).

---

## 1. Scope

### In scope

- 1:1 voice calls (DM call button, invite signaling, accept/reject/missed)
- Group voice calls (from department/team/session/custom channels)
- Push-to-talk walkie-talkie mode (persistent rooms, hold-to-speak)
- Web (Next.js) + Mobile (React Native + Expo)
- Krisp noise cancellation (both platforms)
- Call history and logging
- Telemetry for all call lifecycle events

### Out of scope (Phase 3+)

- Video calls + camera switching
- SIP/PSTN telephony
- Call recording (Egress)
- AI agent participation (Botsson in calls)
- E2E encryption
- Voice transcription

---

## 2. Architecture

### Backend ownership

Edge Functions own all call orchestration. Next.js routes are thin wrappers for web convenience.
Mobile calls Edge Functions directly via `supabase.functions.invoke()`.

```
Client (Web or Mobile)
  |
  +-- supabase.functions.invoke('call-command')    --> call orchestration
  +-- supabase.functions.invoke('livekit-token')   --> token generation
  +-- Supabase Realtime Broadcast                  --> call signaling (ephemeral)
  +-- LiveKit Cloud (EU)                           --> media transport
  |
LiveKit Cloud
  +-- Webhooks --> supabase.functions/livekit-webhook --> DB reconciliation (authoritative)
```

### Truth model

- **Supabase Realtime Broadcast**: ephemeral signaling only (ringing, accept, reject, cancel)
- **Database + LiveKit webhooks**: authoritative call state
- **LiveKit**: authoritative media state (who is connected, speaking, etc.)

### LiveKit Cloud

- Project: `walkie-talkie` (`walkie-talkie-6ejzctmi.livekit.cloud`)
- Plan: Ship ($50/month, 150,000 minutes included)
- Region: EU (GDPR compliant)
- Room naming: `{workspace_id}:{channel_id}`

---

## 3. Database Schema (Subsystem 2)

### Existing from Phase 1

Enums already created: `channel_call_status` (active/ending/ended), `channel_presence_status` (online/away/offline).

Channel table already has: `audio_policy`, `video_policy`, `recording_policy`, `ai_voice_policy` columns.

### Ringing state

`ringing` is **NOT** a value in `channel_call_status`. It is an ephemeral state that exists only
in Supabase Realtime Broadcast signaling. The DB enum values are `active | ending | ended` only.
A 1:1 call is created as `status = active` immediately. If the callee never joins and the room
closes, the webhook handler detects this via `call_type = 'direct'` + `max_participants <= 1`.

### New tables

#### `channel_presence`

Non-authoritative persistence. Authoritative runtime presence lives in Supabase Realtime Presence
and LiveKit participant state. This table is a coarse analytics/last-seen snapshot only.

| Column         | Type                    | Constraint                                             | Notes                    |
| -------------- | ----------------------- | ------------------------------------------------------ | ------------------------ |
| `id`           | uuid                    | PK, default gen_random_uuid()                          |                          |
| `channel_id`   | uuid                    | FK -> channel(id) ON DELETE CASCADE, NOT NULL          |                          |
| `workspace_id` | uuid                    | FK -> workspace(workspace_id), NOT NULL                | RLS                      |
| `profile_id`   | uuid                    | FK -> profile(profile_id) ON DELETE RESTRICT, NOT NULL |                          |
| `status`       | channel_presence_status | NOT NULL                                               |                          |
| `device_type`  | text                    | NULL                                                   | web, ios, android        |
| `last_seen_at` | timestamptz             | DEFAULT now()                                          |                          |
| `created_at`   | timestamptz             | DEFAULT now()                                          |                          |
| `updated_at`   | timestamptz             | DEFAULT now()                                          | + set_updated_at trigger |

Constraints: `UNIQUE(channel_id, profile_id)`

#### `channel_call_session`

Active call instance in a channel. One active session per channel at a time.

New enum required: `channel_call_type` (`direct | group | ptt`).

| Column              | Type                     | Constraint                                    | Notes                                 |
| ------------------- | ------------------------ | --------------------------------------------- | ------------------------------------- |
| `id`                | uuid                     | PK, default gen_random_uuid()                 |                                       |
| `channel_id`        | uuid                     | FK -> channel(id) ON DELETE CASCADE, NOT NULL |                                       |
| `workspace_id`      | uuid                     | FK -> workspace(workspace_id), NOT NULL       | RLS                                   |
| `call_type`         | channel_call_type        | NOT NULL                                      | direct/group/ptt                      |
| `livekit_room_name` | text                     | NOT NULL                                      | `{workspace_id}:{channel_id}`         |
| `status`            | channel_call_status      | NOT NULL                                      | active/ending/ended (never 'ringing') |
| `audio_policy`      | channel_audio_policy     | NOT NULL                                      | Snapshot from channel at call start   |
| `video_policy`      | channel_video_policy     | NOT NULL                                      | Always 'disabled' in Phase 2          |
| `recording_policy`  | channel_recording_policy | NOT NULL                                      | Always 'off' in Phase 2               |
| `started_by`        | uuid                     | FK -> profile(profile_id), NULL               |                                       |
| `max_participants`  | int                      | DEFAULT 0                                     | Updated by webhook                    |
| `started_at`        | timestamptz              | DEFAULT now()                                 |                                       |
| `ended_at`          | timestamptz              | NULL                                          | Set by webhook                        |
| `created_at`        | timestamptz              | DEFAULT now()                                 |                                       |
| `updated_at`        | timestamptz              | DEFAULT now()                                 | + set_updated_at trigger              |

Design note: Module 18 proposes `active_call_id` FK on `channel` and `call_status` on `profile`.
Phase 2 intentionally omits both. Active call is queried via
`channel_call_session WHERE channel_id = X AND status = 'active'`. Profile call status is deferred
to Phase 3 (when SIP/telephony needs it).

#### `channel_call_participant`

Per-participant state in an active call.

| Column             | Type        | Constraint                                                 | Notes                    |
| ------------------ | ----------- | ---------------------------------------------------------- | ------------------------ |
| `id`               | uuid        | PK, default gen_random_uuid()                              |                          |
| `call_session_id`  | uuid        | FK -> channel_call_session(id) ON DELETE CASCADE, NOT NULL |                          |
| `workspace_id`     | uuid        | FK -> workspace(workspace_id), NOT NULL                    | RLS                      |
| `profile_id`       | uuid        | FK -> profile(profile_id) ON DELETE RESTRICT, NOT NULL     |                          |
| `is_ai`            | boolean     | DEFAULT false                                              | Future: Botsson          |
| `joined_at`        | timestamptz | DEFAULT now()                                              |                          |
| `left_at`          | timestamptz | NULL                                                       | NULL = still in call     |
| `mic_enabled`      | boolean     | DEFAULT false                                              |                          |
| `speaking_seconds` | int         | DEFAULT 0                                                  | Accumulated              |
| `device_type`      | text        | NULL                                                       | web, ios, android        |
| `created_at`       | timestamptz | DEFAULT now()                                              |                          |
| `updated_at`       | timestamptz | DEFAULT now()                                              | + set_updated_at trigger |

Partial unique index: `UNIQUE(call_session_id, profile_id) WHERE left_at IS NULL`

#### `call_log`

Historical record. Created from `channel_call_session` when call ends.

| Column                | Type        | Constraint                                    | Notes                                       |
| --------------------- | ----------- | --------------------------------------------- | ------------------------------------------- |
| `id`                  | uuid        | PK, default gen_random_uuid()                 |                                             |
| `channel_id`          | uuid        | FK -> channel(id) ON DELETE CASCADE, NOT NULL |                                             |
| `workspace_id`        | uuid        | FK -> workspace(workspace_id), NOT NULL       | RLS                                         |
| `call_session_id`     | uuid        | FK -> channel_call_session(id), NOT NULL      | Source                                      |
| `livekit_room_name`   | text        | NOT NULL                                      |                                             |
| `started_at`          | timestamptz | NOT NULL                                      |                                             |
| `ended_at`            | timestamptz | NOT NULL                                      |                                             |
| `duration_seconds`    | int         | NOT NULL                                      |                                             |
| `max_participants`    | int         | NOT NULL                                      |                                             |
| `total_participants`  | int         | NOT NULL                                      | Distinct profiles                           |
| `participant_summary` | jsonb       | NOT NULL                                      | [{profile_id, joined, left, spoke_seconds}] |
| `created_at`          | timestamptz | DEFAULT now()                                 |                                             |

### RLS pattern

All four tables:

- **JWT SELECT**: `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))`
- **JWT INSERT/UPDATE**: scoped to own profile or channel admin role
- **API key SELECT**: `workspace_id = get_api_workspace_id()`

### Realtime

Enable Supabase Realtime on:

- `channel_call_session` (INSERT, UPDATE) — live call state in UI
- `channel_call_participant` (INSERT, UPDATE) — participant changes

---

## 4. Edge Functions

### `livekit-token` (verify_jwt = true)

Single token issuer. No alternative minting path.

1. Authenticate user via Supabase Auth
2. Validate workspace membership + channel membership
3. Read channel `audio_policy` to determine grants
4. Generate LiveKit AccessToken (v2 SDK):
   - `identity`: `profile_id`
   - `room`: `{workspace_id}:{channel_id}`
   - `canPublish`: true (unless `listen_only`)
   - `canSubscribe`: true
   - `canPublishData`: true
   - `canUpdateOwnMetadata`: true
   - `canPublishSources`: `['microphone']` (no camera in Phase 2)
   - `ttl`: 6 hours
5. Return `{ token, serverUrl }`

### `livekit-webhook` (verify_jwt = false)

Authoritative call state reconciliation. Validates HMAC via `WebhookReceiver`.

| Webhook event        | Action                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `participant_joined` | Upsert `channel_call_participant`, update `max_participants`, emit `channel.call.participant_joined`                                                                              |
| `participant_left`   | Set `left_at` on participant, emit `channel.call.participant_left`                                                                                                                |
| `room_started`       | Create `channel_call_session` if not exists                                                                                                                                       |
| `room_finished`      | Finalize session (status=ended, ended_at), create `call_log`, emit `channel.call.ended`. If `call_type = 'direct'` and `max_participants <= 1`: emit `channel.call.invite_missed` |

### `call-command` (verify_jwt = true)

Call orchestration: start, respond.

**Action: `start`**

1. Validate channel membership
2. Check `audio_policy != 'disabled'`
3. Create `channel_call_session` row
4. For 1:1: broadcast `call_invite` to `profile:{workspaceId}:{calleeProfileId}:calls`
5. For group: broadcast `group_call_started` to `channel:{workspaceId}:{channelId}:calls`
6. Emit `channel.call.started` telemetry (DB row created = authoritative moment)
7. For 1:1: also emit `channel.call.invite_sent` (broadcast dispatched = authoritative moment)
8. Return `{ callSessionId, roomName }`

**Action: `respond`**

1. Body: `{ callSessionId, action: 'accept' | 'reject' | 'cancel' }`
2. Broadcast appropriate event via Realtime
3. On reject/cancel with no other participants: update session status
4. Emit `channel.call.invite_accepted`, `channel.call.invite_rejected`, or `channel.call.invite_cancelled`

---

## 5. Call Signaling (Supabase Realtime Broadcast)

Workspace-scoped channel names:

```
profile:{workspaceId}:{profileId}:calls    -- 1:1 invite/accept/reject
channel:{workspaceId}:{channelId}:calls    -- group call announcements
```

Events:

| Event                | Direction            | Payload                                                          |
| -------------------- | -------------------- | ---------------------------------------------------------------- |
| `call_invite`        | caller -> callee     | { callSessionId, channelId, callerName, callerAvatar, roomName } |
| `call_accepted`      | callee -> caller     | { callSessionId }                                                |
| `call_rejected`      | callee -> caller     | { callSessionId }                                                |
| `call_cancelled`     | caller -> callee     | { callSessionId }                                                |
| `call_ended`         | either -> other      | { callSessionId }                                                |
| `group_call_started` | initiator -> channel | { callSessionId, initiatorName, roomName, participantCount }     |

---

## 6. Telemetry

All events registered in `packages/telemetry/src/registry.ts` before implementation.
Uses `channel.call.*` namespace consistent with Phase 1's `channel.*` pattern (calls are a
subsystem of channels, not a separate top-level domain).

Note: Edge Functions emit telemetry via direct `activity_trail` INSERT + PostHog server-side API.
The `emit()` helper from `@smartout/telemetry` is designed for Next.js/client contexts. Edge
Functions use a lightweight Deno-compatible emit path that must be verified in Slice 1.

| Event                             | Emitted from          | Authoritative moment                                | Destinations                          |
| --------------------------------- | --------------------- | --------------------------------------------------- | ------------------------------------- |
| `channel.call.started`            | `call-command` EF     | DB row created                                      | PostHog, activity_trail, engine_event |
| `channel.call.ended`              | `livekit-webhook` EF  | `room_finished` webhook                             | PostHog, activity_trail, engine_event |
| `channel.call.participant_joined` | `livekit-webhook` EF  | `participant_joined` webhook                        | PostHog, activity_trail               |
| `channel.call.participant_left`   | `livekit-webhook` EF  | `participant_left` webhook                          | PostHog, activity_trail               |
| `channel.call.invite_sent`        | `call-command` EF     | Broadcast dispatched (1:1 calls only)               | PostHog, activity_trail               |
| `channel.call.invite_accepted`    | `call-command` EF     | Respond action                                      | PostHog, activity_trail               |
| `channel.call.invite_rejected`    | `call-command` EF     | Respond action                                      | PostHog, activity_trail               |
| `channel.call.invite_missed`      | `livekit-webhook` EF  | `room_finished` + direct call + max_participants<=1 | PostHog, activity_trail               |
| `channel.call.group_announced`    | `call-command` EF     | Broadcast dispatched                                | PostHog, activity_trail               |
| `channel.call.ptt_activated`      | Client (debounced 5s) | User action                                         | PostHog                               |
| `channel.call.ptt_deactivated`    | Client (debounced 5s) | User action                                         | PostHog                               |

---

## 7. API Routes (Next.js — thin wrappers)

| Method | Route                             | Proxies to                          | Auth |
| ------ | --------------------------------- | ----------------------------------- | ---- |
| POST   | `/api/channels/[id]/call/start`   | `call-command` EF (action: start)   | JWT  |
| POST   | `/api/channels/[id]/call/token`   | `livekit-token` EF                  | JWT  |
| POST   | `/api/channels/[id]/call/respond` | `call-command` EF (action: respond) | JWT  |
| GET    | `/api/channels/[id]/call/status`  | Direct Supabase query               | JWT  |
| GET    | `/api/channels/[id]/call/history` | Direct Supabase query               | JWT  |

Mobile bypasses these routes and calls Edge Functions directly via `supabase.functions.invoke()`.

---

## 8. Shared Package: `packages/walkieTalkie`

Data layer and business logic shared between web and mobile.

```
packages/walkieTalkie/
  src/
    call-types.ts           -- CallSession, CallParticipant, IncomingCall, PTTState
    call-keys.ts            -- TanStack Query key factory
    call-queries.ts         -- getCallStatus, getCallHistory (Supabase client queries)
    call-mutations.ts       -- startCall, respondToInvite (invoke Edge Functions)
    call-signaling.ts       -- Realtime broadcast subscribe/publish helpers
    ptt-logic.ts            -- PTT state machine (pure logic, no UI)
    index.ts                -- public exports
```

### Key types

```typescript
type CallSession = {
  id: string;
  channelId: string;
  workspaceId: string;
  callType: "direct" | "group" | "ptt";
  livekitRoomName: string;
  status: "active" | "ending" | "ended";
  audioPolicy: "disabled" | "ptt" | "open_mic" | "listen_only";
  startedBy: string | null;
  maxParticipants: number;
  startedAt: string;
  endedAt: string | null;
};

type IncomingCall = {
  callSessionId: string;
  channelId: string;
  callerName: string;
  callerAvatar: string | null;
  roomName: string;
};

type PTTState = "idle" | "connecting" | "connected_muted" | "talking";
```

---

## 9. Hooks

### Web hooks (`apps/web/src/app/dashboard/komm/_hooks/`)

| Hook                    | Type                | Purpose                                                                            |
| ----------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `use-livekit-call.ts`   | Connection          | LiveKit room lifecycle (web adapter). Krisp init. Uses `@livekit/components-react` |
| `use-call-state.ts`     | Query               | Active `channel_call_session` via `callQueries`                                    |
| `use-call-history.ts`   | Query               | Paginated `call_log` via `callQueries`                                             |
| `use-start-call.ts`     | Mutation            | `callMutations.startCall` + TanStack                                               |
| `use-call-invite.ts`    | Mutation + Realtime | Send invite, listen for response                                                   |
| `use-call-signaling.ts` | Realtime            | Subscribe to `profile:{wid}:{pid}:calls` — incoming calls                          |
| `use-push-to-talk.ts`   | Local               | Web PTT (onPointerDown/Up) + `pttLogic`                                            |
| `use-call-realtime.ts`  | Realtime            | Subscribe to `channel_call_session` + `channel_call_participant`                   |

### Mobile hooks (`apps/mobile/src/hooks/`)

| Hook                    | Type       | Purpose                                       |
| ----------------------- | ---------- | --------------------------------------------- |
| `use-livekit-call.ts`   | Connection | RN adapter with `AudioSession` lifecycle      |
| `use-call-state.ts`     | Query      | Same as web (shared query functions)          |
| `use-call-history.ts`   | Query      | Same as web                                   |
| `use-start-call.ts`     | Mutation   | Same as web                                   |
| `use-call-signaling.ts` | Realtime   | Same as web                                   |
| `use-push-to-talk.ts`   | Local      | Mobile PTT (Pressable onPressIn/Out, haptics) |
| `use-call-realtime.ts`  | Realtime   | Same as web                                   |

### `use-livekit-call` interface

```typescript
interface UseLiveKitCallOptions {
  token: string | null;
  serverUrl: string;
  onDisconnected?: () => void;
}

interface UseLiveKitCallReturn {
  room: Room | null;
  connectionState: ConnectionState;
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[]; // v2: identity-keyed
  isMicEnabled: boolean;
  activeSpeakers: Participant[];
  toggleMic: () => Promise<void>;
  disconnect: () => void;
}
```

---

## 10. Components

### Web (`apps/web/src/app/dashboard/komm/_components/`)

| Component                    | Purpose                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `CallBar.tsx`                | Floating overlay when in call — participants, active speakers, mute/end |
| `PTTButton.tsx`              | Hold-to-talk — large, pulsing when active, onPointerDown/Up             |
| `IncomingCallOverlay.tsx`    | Full-screen modal — caller info, accept/reject, ringtone                |
| `GroupCallBanner.tsx`        | Banner in channel header — "3 in call — [Join]"                         |
| `CallHistory.tsx`            | Past calls list — duration, participants, status                        |
| `ActiveSpeakerIndicator.tsx` | Green ring/pulse around speaking avatar                                 |

### Mobile (`apps/mobile/src/features/channels/components/`)

| Component                | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `CallBar.tsx`            | Fixed bottom bar — native styling          |
| `PTTButton.tsx`          | Pressable, haptic feedback, thumb-friendly |
| `IncomingCallScreen.tsx` | Full-screen with AudioSession lifecycle    |
| `GroupCallBanner.tsx`    | Banner in channel header                   |
| `CallHistoryList.tsx`    | FlatList of call_log                       |

### Integration points

- **`ChannelHeader.tsx`**: call button (phone icon), disabled when `audio_policy = 'disabled'`, shows `GroupCallBanner` when active call
- **`KommShell.tsx`**: renders `IncomingCallOverlay` (global) and `CallBar` (when in call)
- **`MessageInput.tsx`**: PTT mode replaces send button with `PTTButton` when `audio_policy = 'ptt'` and user connected

### Audio policy -> UI mapping

| `audio_policy` | Call button  | PTT button             | Behavior                    |
| -------------- | ------------ | ---------------------- | --------------------------- |
| `disabled`     | Hidden       | Hidden                 | No voice                    |
| `ptt`          | Hidden       | Shown (when connected) | Auto-connect, hold to talk  |
| `open_mic`     | Shown        | Hidden                 | Tap to call, mic open       |
| `listen_only`  | Shown (join) | Hidden                 | Listen only, cannot publish |

---

## 11. Environment Variables

```
LIVEKIT_API_KEY=                    # op://Smartout/livekit/api-key
LIVEKIT_API_SECRET=                 # op://Smartout/livekit/api-secret
NEXT_PUBLIC_LIVEKIT_URL=wss://walkie-talkie-6ejzctmi.livekit.cloud   # plain value (not a secret)
LIVEKIT_WEBHOOK_SECRET=             # op://Smartout/livekit/webhook-secret
```

`NEXT_PUBLIC_LIVEKIT_URL` is a public endpoint, not a secret — stored as plain value in `.env.template`.
The other three credentials from `~/.livekit/cli-config.yaml` must be moved to 1Password.

---

## 12. SDK Versions (installed)

### Web (`apps/web`)

| Package                       | Version |
| ----------------------------- | ------- |
| `livekit-client`              | 2.17.3  |
| `@livekit/components-react`   | 2.9.20  |
| `@livekit/components-styles`  | 1.2.0   |
| `@livekit/krisp-noise-filter` | 0.3.4   |

### Mobile (`apps/mobile`)

| Package                                    | Version     |
| ------------------------------------------ | ----------- |
| `@livekit/react-native`                    | 2.9.6       |
| `@livekit/react-native-webrtc`             | 137.0.2     |
| `@livekit/react-native-expo-plugin`        | 1.0.2 (dev) |
| `@livekit/react-native-krisp-noise-filter` | 0.0.3       |

### Edge Functions (Deno — npm import)

| Package              | Version |
| -------------------- | ------- |
| `livekit-server-sdk` | 2.15.0  |

### SDK v2 notes

All code uses LiveKit SDK v2 APIs:

- `room.remoteParticipants` (not `room.participants`)
- `participant.getTrackPublication()` (not `getTrack()`)
- `publishData(data, { reliable, destinationIdentities })` (not positional args)
- `await room.getSid()` (not `room.sid`)

---

## 13. Implementation Slices

Vertical slices, each testable end-to-end.

### Slice 0: Infrastructure

- 1Password: move LiveKit credentials from CLI config
- `.env.template`: add 4 LiveKit env vars
- `apps/web/src/env.ts`: Zod validation
- `supabase/functions/config.toml`: register `livekit-webhook` (verify_jwt = false)
- `packages/telemetry/src/registry.ts`: register 11 `channel.call.*` events
- `apps/mobile/app.json`: add LiveKit Expo plugins
- `packages/walkieTalkie/`: scaffold package (types, keys, queries, mutations, signaling, ptt-logic)
- ADRs: write "LiveKit as WebRTC provider" and "Edge Functions own call orchestration" ADRs
- Reference docs: update `docs/reference/ENV_VARS.md`, `docs/reference/ROUTES.md`
- Verify `emit()` works from Deno Edge Functions; if not, document alternative telemetry path

### Slice 1: Database + Edge Functions

- Migration: 4 tables + RLS + indexes + triggers
- Regenerate `database.types.ts`
- `livekit-token` Edge Function
- `livekit-webhook` Edge Function
- `call-command` Edge Function
- Test with `lk` CLI

### Slice 2: 1:1 Voice Calls (Web)

- `packages/walkieTalkie/`: implement shared functions
- Web hooks: use-livekit-call, use-start-call, use-call-state, use-call-invite, use-call-signaling
- Next.js thin routes
- Components: IncomingCallOverlay, CallBar, ActiveSpeakerIndicator
- Wire into ChannelHeader (direct channels) and KommShell
- Krisp noise filter init

### Slice 3: 1:1 Voice Calls (Mobile)

- `registerGlobals()` at app entry
- Mobile hooks: use-livekit-call (RN adapter + AudioSession), use-start-call, use-call-signaling
- Components: IncomingCallScreen, CallBar
- Wire into mobile channel screens
- Test on physical device (dev build)

### Slice 4: Group Calls (Web + Mobile)

- Extend call-command EF for group broadcasts
- use-call-realtime hook (both platforms)
- GroupCallBanner, CallHistory components (both platforms)
- Wire group call button into ChannelHeader for non-direct channels
- Call history route

### Slice 5: Push-to-Talk (Web + Mobile)

- ptt-logic.ts in walkieTalkie package
- use-push-to-talk hooks (web + mobile)
- PTTButton components (web + mobile)
- Auto-connect on PTT channel open
- Wire into MessageInput when audio_policy = 'ptt'
- Room emptyTimeout = 300s for PTT

### Slice 6: Polish + Integration

- Call state persistence across navigation
- Reconnection handling
- Error states (room full, connection failed, permission denied)
- Missed call notifications (from webhook -> notification pipeline)
- PTT room idempotency: handle `room_finished` webhook for PTT rooms gracefully (no false `invite_missed`)
- WORKLOG, decision log, learning log updates
- Update `docs/reference/EDGE_FUNCTIONS_REFERENCE.md` with 3 new functions

**Dependency:** 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6
Slices 4 and 5 are independent after Slice 2.

---

## 14. Decisions for ADR

| Decision            | Choice                                  | Reason                                              |
| ------------------- | --------------------------------------- | --------------------------------------------------- |
| Backend ownership   | Edge Functions (not Next.js routes)     | Singular truth, mobile parity                       |
| Token minting       | Single path via livekit-token EF        | Avoid auth/grants drift                             |
| Signaling           | Supabase Realtime Broadcast (ephemeral) | Reuse existing infra, not authoritative             |
| Call state truth    | DB + LiveKit webhooks                   | Webhooks are authoritative, not client commands     |
| Telemetry timing    | Emit from authoritative moments         | No optimistic lifecycle events                      |
| Shared logic        | packages/walkieTalkie                   | Mobile parity, no web-only business logic           |
| Signaling namespace | Workspace-scoped channel names          | Match existing comms pattern                        |
| Krisp version       | 0.3.4 (not 0.4.1)                       | Peer dependency compatibility with components-react |
| Noise cancellation  | Included from start                     | Restaurant environments are noisy                   |
| LiveKit SDK         | v2 APIs only                            | v1 patterns deprecated                              |

---

## 15. Out of Scope (YAGNI)

- Video tracks / camera (Phase 3)
- SIP/PSTN telephony (Phase 3)
- Call recording / Egress (Phase 3)
- AI agent in calls (Phase 3)
- E2E encryption (conflicts with future recording)
- Voice transcription
- iOS CallKit / background audio (Phase 3 — accept in-app-only for Phase 2)
- Android foreground service for background calls (Phase 3)
- Multi-device support (second device displaces first)
