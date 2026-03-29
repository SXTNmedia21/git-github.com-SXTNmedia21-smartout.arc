---
title: Mobile Group Call — Expanded UI + Video
status: draft
updated: 2026-03-28
created: 2026-03-28
module: communications
tags: [livekit, webrtc, mobile, group-call, video, ptt, walkie-talkie]
---

# Mobile Group Call — Expanded UI + Video Design Spec

## Problem

Mobile has the infrastructure for group calls (LiveKit connection, signaling, PTT state machine, CallBar, GroupCallBanner) but lacks a proper in-call experience. CallBar shows participant count and mic toggle — nothing more. No way to see who's in the call, who's speaking, or enable video. Web has a full CallRoom with expandable grid, video tiles, and chat integration.

## Council Review (2026-03-28)

Reviewed by System Steward (chair), Supervisor, Frontend Designer. Verdict: **PASS WITH CONDITIONS**. This spec incorporates all required changes.

## Goal

Add an expanded call UI to mobile: bottom sheet that slides up from CallBar showing participant grid, active speaker focus, and optional video. Respects channel audio/video policies. No backend changes.

## Decisions

| #   | Decision                                          | Rationale                                                                                                         |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| D1  | Bottom sheet pattern (CallBar tap → expand)       | Most natural mobile pattern. User keeps context, swipe down to minimize.                                          |
| D2  | Adaptive video layout: grid for 1-2, focus for 3+ | 1:1 = equal split. Group = speaker focus with thumbnail strip.                                                    |
| D3  | Both PTT and open mic modes supported             | Controlled by `audio_policy` on channel. PTT for service, open mic for meetings.                                  |
| D4  | Camera default respects `video_policy`            | `disabled` = no camera option. `optional` = off by default. `default_on` = on by default. `required` = forced on. |
| D5  | No backend changes                                | All infrastructure exists. Token minting already grants video publish based on policy.                            |

## Architecture

```
CallBar (existing, minimal)
  |-- onPress → opens CallSheet
  |
  CallSheet (new, bottom sheet)
    |-- Header (channel name, duration, count, minimize)
    |-- ParticipantGrid (adaptive layout)
    |   |-- ParticipantTile[] (video OR avatar + speaker glow)
    |-- CallControls (mic, camera, end — adapts to audio_policy)
```

### Data Flow

No new data sources. All from existing hooks:

```
useLiveKitCall()
  → room: Room instance
  → isConnected, isMicEnabled, activeSpeakers, participantCount

room.localParticipant
  → setCameraEnabled(true/false) — publish/unpublish video track
  → videoTrackPublications — local video track

room.remoteParticipants
  → forEach → getTrackPublications() — remote video/audio tracks

RoomEvent.TrackSubscribed / TrackUnsubscribed
  → video track added/removed for a participant

RoomEvent.ActiveSpeakersChanged
  → list of currently speaking participants

CallSession (from getActiveCallSession)
  → audioPolicy: "ptt" | "open_mic" | "listen_only" | "disabled"

Channel query (video_policy lives on the channel table, NOT on CallSession)
  → videoPolicy: "disabled" | "optional" | "default_on" | "required"
  → Source: channel.video_policy column, same query used by token minting

NOTE: LiveKit token canPublish is a single boolean (audio OR video).
Audio-only vs audio+video enforcement is UI-layer responsibility,
not server-side token control. The PTT state machine and CallControls
are the enforcement boundary.
```

## Detailed Design

### 1. CallSheet (Bottom Sheet Container)

Full-screen bottom sheet that slides up from CallBar. Uses React Native gesture handler + Reanimated for smooth swipe-to-dismiss.

**Header section:**

- Channel name (left-aligned, bold)
- Live duration timer (MM:SS, updates every second)
- Participant count badge
- Chevron-down button to minimize (or swipe down)

**Body:** ParticipantGrid fills remaining space.

**Footer:** CallControls fixed at bottom.

**Behavior:**

- Opens with spring animation (Nordic Split: stiffness 35, damping 22, mass 2.2 via `withSpring` from Reanimated)
- Swipe down to minimize back to CallBar
- Stays open across tab navigation (not modal — persistent overlay)
- Closes automatically when call ends

### 2. ParticipantGrid (Adaptive Layout)

Renders participants based on count and video state.

**Audio-only mode** (no video tracks or `video_policy == disabled`):

- Circle avatars arranged in a centered grid
- Active speaker gets amber glow ring (animated, pulsing)
- Name label below each avatar
- Mic-off icon overlay when muted

**Video mode — 1-2 participants:**

- Grid layout (equal split)
- 1 participant: full width/height
- 2 participants: 50/50 vertical split
- Each tile shows video track with name overlay at bottom

**Video mode — 3+ participants:**

- Active speaker takes ~75% of screen height
- Remaining participants in horizontal ScrollView strip at bottom (~25%)
- Speaker switches automatically based on `ActiveSpeakersChanged` event
- Animated transition when speaker changes: focused tile scales up from grid position (shared element style via Reanimated `withSpring`), not a hard cut
- If no one is speaking, last speaker stays focused

**Edge cases:**

- Mixed video/audio: participants without video show avatar tile in same grid
- All cameras off in video-enabled channel: falls back to audio-only layout
- Single participant (waiting for others): shows own video/avatar centered + i18n key `call.waiting_for_participants`

### 3. ParticipantTile (Single Participant)

Renders one participant as either video or avatar.

**Video variant:**

- LiveKit video track rendered via `RTCView` from `@livekit/react-native-webrtc`
- Name overlay at bottom (semi-transparent background)
- Mic-off icon at top-right when muted
- Green border when actively speaking
- Mirror mode for local participant's front camera

**Avatar variant:**

- Circular avatar image (or initials fallback)
- Name below
- Amber glow ring when speaking (spring-driven opacity via Reanimated shared value, NOT CSS keyframe pulse — responds to audio level: silent=0, speaking=0.6, loud=1.0)
- Mic-off icon overlay when muted
- Subtle scale animation (1.0 → 1.05) when speaking

**Shared:**

- i18n key `call.you_suffix` on local participant name (e.g. "(Du)")
- "AI" badge if `isAi == true` (from participant metadata)

### 4. CallControls (Bottom Control Bar)

Adapts to `audio_policy` from the call session.

**Open mic mode (`audio_policy == "open_mic"`):**

- Mic toggle button (Mic / MicOff icon)
- Camera toggle button (Camera / CameraOff icon) — hidden if `video_policy == "disabled"`
- End call button (red, PhoneOff icon)
- All buttons: 48x48 touch targets, circular, with labels below

**PTT mode (`audio_policy == "ptt"`):**

- Large PTT button center (64x64, hold to talk)
- Camera toggle (if video enabled) to the left
- End call button to the right
- PTT button states: idle (muted color), pressed (green, scale 1.1, haptic)

**Listen-only mode (`audio_policy == "listen_only"`):**

- No mic button (can't talk)
- Camera toggle (if video enabled)
- End call button
- i18n key `call.listen_only_label` at top

### 5. use-call-tracks Hook

New hook that wraps LiveKit room events for track management.

```typescript
type ParticipantTrackInfo = {
  identity: string;
  name: string;
  avatarUrl: string | null;
  isLocal: boolean;
  isAi: boolean;
  isSpeaking: boolean;
  isMicEnabled: boolean;
  videoTrack: VideoTrack | null; // null = no video published
};

function useCallTracks(room: Room | null): {
  participants: ParticipantTrackInfo[];
  activeSpeakerIdentity: string | null;
  hasAnyVideo: boolean;
};
```

Listens to:

- `RoomEvent.TrackSubscribed` / `TrackUnsubscribed`
- `RoomEvent.TrackMuted` / `TrackUnmuted`
- `RoomEvent.ActiveSpeakersChanged`
- `RoomEvent.ParticipantConnected` / `ParticipantDisconnected`
- `RoomEvent.ParticipantMetadataChanged`

Returns sorted participant list (local first, then alphabetical) with track state.

### 6. Camera Management

**Enable camera:**

```typescript
await room.localParticipant.setCameraEnabled(true);
```

**Disable camera:**

```typescript
await room.localParticipant.setCameraEnabled(false);
```

**On join — respect video_policy:**

- `disabled` → don't enable, hide camera button
- `optional` → don't enable, show camera button (user can toggle)
- `default_on` → enable on join, show camera button
- `required` → enable on join, hide camera button (can't disable)

Token minting already grants `canPublish: true` when video isn't disabled. No backend change needed.

**iOS/Android considerations:**

- Camera permission must be requested before enabling (Expo Camera permissions)
- `AudioSession` from `@livekit/react-native` must include video category
- Front camera default, no flip support in v1

## New Files

| File                  | Location                                        | Responsibility                                                                          |
| --------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `CallSheet.tsx`       | `apps/mobile/src/features/channels/components/` | Bottom sheet, header, duration timer, orchestrates layout                               |
| `ParticipantGrid.tsx` | `apps/mobile/src/features/channels/components/` | Adaptive layout — audio circles, grid, or focus                                         |
| `ParticipantTile.tsx` | `apps/mobile/src/features/channels/components/` | Single participant — video or avatar + speaker indicator                                |
| `CallControls.tsx`    | `apps/mobile/src/features/channels/components/` | Mic, camera, PTT, end — adapts to audio_policy                                          |
| `use-call-tracks.ts`  | `apps/mobile/src/hooks/`                        | Track subscription, speaker detection, participant list (read-only — NOT in mutations/) |

## Modified Files

| File                  | Change                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `CallBar.tsx`         | Add `onPress` prop that opens CallSheet                                                                        |
| `use-livekit-call.ts` | Room already exposed. Only change: add `setCameraEnabled` wrapper if needed (or call directly in CallControls) |

## What Does NOT Change

- Backend / Edge Functions — zero changes
- walkieTalkie package — zero changes
- Database schema — zero changes
- Web Komm implementation — unaffected
- GroupCallBanner, IncomingCallScreen, CallHistoryList — unchanged
- PTT state machine in walkieTalkie — unchanged

## Dependencies

- `@livekit/react-native` (already installed) — Room, VideoTrack, AudioSession
- `@livekit/react-native-webrtc` (already installed) — RTCView for video rendering
- `react-native-reanimated` (already in project) — sheet animation
- `react-native-gesture-handler` (already in project) — swipe to dismiss
- `expo-haptics` (already in project) — PTT feedback
- `expo-camera` (check if installed) — camera permissions

## Telemetry

Every mutation emits via `@smartout/telemetry`:

| Action                  | Event                              | Properties                        |
| ----------------------- | ---------------------------------- | --------------------------------- |
| Sheet opened            | `call.sheet_opened`                | `{ channelId, participantCount }` |
| Sheet closed            | `call.sheet_closed`                | `{ channelId, durationOpen }`     |
| Camera toggled          | `call.camera_toggled`              | `{ channelId, enabled: boolean }` |
| Call ended (from sheet) | Uses existing `channel.call.ended` | Already emitted by webhook        |

Register new events in `packages/telemetry/src/registry.ts` with routing to `activity_trail`.

## Accessibility

- All tappable elements: minimum 48x48dp touch targets
- `accessibilityLabel` on every ParticipantTile: `"{name}, {speaking ? 'snakker' : 'stille'}"` (via i18n)
- `accessibilityRole="button"` on tiles that are tappable (for focus mode selection)
- Visible minimize button (chevron-down, 48x48) — swipe-to-dismiss alone is NOT accessible
- Respect `AccessibilityInfo.isReduceMotionEnabled`: all spring animations fall back to instant (0ms) transitions
- PTT button: `accessibilityHint` explaining hold-to-talk behavior

## Scope

- 5 new files (~400-500 lines total)
- 1-2 modified files (~20 lines changed)
- No new packages (verify `expo-camera` installed)
- No backend changes
- No database changes
