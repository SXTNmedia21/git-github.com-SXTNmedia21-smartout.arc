---
title: "User Journey — LiveKit Voice/Video Calling"
status: done
updated: 2026-03-24
created: 2026-03-24
module: walkieTalkie
tags: [livekit, voice, video, webrtc, calling]
---

# User Journey — LiveKit Voice/Video Calling

## Journey: Employee starts a group voice call

**Precondition:** User is logged in, has an active profile, is a member of a channel with `audio_policy !== "disabled"`.

1. User opens Komm → selects a channel → User sees ChannelHeader with phone icon and participant count
2. User clicks "Ring" button → System calls `call-command` edge function (action: start) → creates `channel_call_session` with status "active"
3. System broadcasts `group_call_started` via Supabase Realtime REST API → other channel members see notification
4. System auto-joins caller → calls `livekit-token` edge function → gets LiveKit JWT token + server URL
5. CallRoom renders with LiveKitRoom provider → audio connects, microphone enabled
6. User sees collapsed CallRoom at bottom: ControlBar (mic, camera, screen share) + participant count
7. User speaks → remote participants hear audio via RoomAudioRenderer

**Postcondition:** Call session is active, caller is connected, other members can see the call is active.

**Error paths:**

- Channel has `audio_policy === "disabled"` → "Ring" button not shown
- Token fetch fails → sonner toast "Kunne ikke koble til samtale"
- Mic permission denied → console warning, user can toggle via ControlBar manually

---

## Journey: Employee joins an existing call

**Precondition:** A call is active in the channel (shown by participant count badge in ChannelHeader).

1. User sees "X i samtale" badge in ChannelHeader → clicks "Bli med" button
2. System calls `livekit-token` → gets token → sets `livekitConnection` state
3. CallRoom renders, connects to LiveKit room → user hears existing participants
4. Existing participants see toast "Bruker ble med i samtalen"
5. Participant count updates live from LiveKit room (not DB)

**Postcondition:** User is in the call, hearing and being heard by other participants.

---

## Journey: Employee receives a direct call

**Precondition:** User is in Komm, another user starts a direct call targeting them.

1. Caller starts call with `callType: "direct"` and `calleeProfileId` → System broadcasts `call_invite` to callee's personal channel
2. Callee sees IncomingCallOverlay → dialog with caller name, accept/reject buttons
3. Callee presses Enter or clicks "Aksepter" → calls `call-command` (respond: accept) → gets LiveKit token → joins room
4. Both users are in the call, CallRoom renders

**Postcondition:** Both users are connected in a direct call.

**Error paths:**

- Callee presses Escape or clicks "Avslå" → sends reject response, overlay dismissed
- Token fetch fails → sonner toast with "Prøv igjen" action button

---

## Journey: Employee uses video and screen share in a call

**Precondition:** User is in an active call (CallRoom visible).

1. User clicks expand button (Maximize2 icon) → CallRoom goes fullscreen with video grid + chat panel
2. User clicks camera button in ControlBar → camera enabled, video track published
3. Other participants see video in GridLayout (1-2 participants) or FocusLayout (3+)
4. User clicks screen share button → screen share track published, visible to all
5. User clicks minimize button → CallRoom collapses, video shown only if active tracks

**Postcondition:** Video/screen share visible to all participants.

---

## Journey: Employee uses in-call chat

**Precondition:** User is in expanded CallRoom.

1. User sees chat panel on right (desktop) or bottom (mobile) with existing channel messages
2. User types message in MessageInput → message sent via existing Supabase channel message system
3. All channel members (including those not in call) see the message in normal chat timeline
4. User can toggle chat panel visibility via MessageSquare button in header

**Postcondition:** Messages persist in channel history, visible to all members.

**Error paths:**

- Mobile view: chat panel takes half the screen height, can be dismissed via close button

---

## Journey: Admin mutes another participant

**Precondition:** User is an admin/owner, in an active call, MemberPanel is open.

1. Admin opens MemberPanel → sees member list with MicOff button next to each non-self member
2. Admin clicks MicOff button → calls `useMuteParticipant` hook → invokes `call-command` (action: mute_participant)
3. Edge function verifies admin role → calls LiveKit `RoomServiceClient.mutePublishedTrack()` → participant's mic is muted server-side
4. Muted participant's audio stops for all listeners

**Postcondition:** Target participant is muted. They can unmute themselves.

**Error paths:**

- Non-admin user → MicOff button not shown (only admins/owners)
- Participant not in room → 404 error, sonner toast "Kunne ikke dempe deltaker"

---

## Journey: Employee leaves a call

**Precondition:** User is in an active call.

1. User clicks red PhoneOff button in CallRoom header → `onDisconnect` fires
2. LiveKitRoom disconnects → `onDisconnected` callback clears `livekitConnection` state
3. CallRoom unmounts → user returns to normal channel view
4. Other participants see toast "Bruker forlot samtalen"
5. Participant count updates for remaining users

**Postcondition:** User is disconnected, CallRoom hidden. If last participant leaves, webhook handler ends the session.

---

## Journey: Webhook processes call events (system)

**Precondition:** LiveKit Cloud sends webhook events to `livekit-webhook` edge function.

1. Participant joins room → webhook receives `participant_joined` → inserts into `channel_call_participant` → emits `participant_joined` telemetry event
2. Participant leaves room → webhook receives `participant_left` → updates `left_at` on participant row → emits `participant_left` telemetry
3. Room empties → webhook receives `room_finished` → updates `channel_call_session` status to "ended", sets `ended_at` → emits `call_ended` telemetry

**Postcondition:** Database reflects accurate call history. Telemetry events logged for analytics.

**Error paths:**

- Missing Authorization header → 401
- Invalid webhook signature → 401
- No active session found → logged as warning, no DB update
