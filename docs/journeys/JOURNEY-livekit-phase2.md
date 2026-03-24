---
title: "User Journeys — LiveKit Phase 2: Voice Calls + Push-to-Talk"
status: done
updated: 2026-03-22
created: 2026-03-22
module: webrtc
tags: [livekit, voice, push-to-talk, calls, journeys]
---

# User Journeys — LiveKit Phase 2

## Journey: Employee makes a 1:1 voice call (Web)

**Precondition:** Employee is logged in, viewing a direct message channel with audio_policy != 'disabled'.

1. User sees phone icon in channel header -> System shows icon enabled (audio_policy = open_mic)
2. User clicks phone icon -> System calls `call-command` Edge Function (action: start, callType: direct)
3. System creates `channel_call_session` row, broadcasts `call_invite` via Realtime to callee's personal channel
4. System fetches LiveKit token via `livekit-token` Edge Function -> connects to LiveKit room with Krisp noise cancellation
5. Callee's device receives `call_invite` broadcast -> IncomingCallOverlay appears with caller name, avatar, accept/reject buttons
6. Callee clicks Accept -> System calls `call-command` (action: respond, responseAction: accept), broadcasts `call_accepted` -> fetches own LiveKit token -> connects to same room
7. Both users see CallBar at bottom with active speaker indicators, mute toggle, end call button
8. Audio flows bidirectionally via LiveKit Cloud (EU region)
9. Either user clicks End Call -> LiveKit room closes -> `room_finished` webhook fires -> system finalizes `channel_call_session`, creates `call_log`

**Postcondition:** Call recorded in `call_log` with duration and participant summary. Both users return to normal channel view.

**Error paths:**

- Callee rejects -> `call_rejected` broadcast, caller sees "Samtale avvist" toast
- No answer (30s timeout) -> Caller sees "Ingen svar" toast, webhook detects missed call (max_participants <= 1)
- Network failure during call -> LiveKit auto-reconnects. If reconnect fails, call ends via webhook
- Voice disabled on channel -> Phone icon hidden, cannot initiate

---

## Journey: Employee makes a 1:1 voice call (Mobile)

**Precondition:** Employee is on mobile app, viewing a DM channel.

1. User taps phone icon in channel header -> Same Edge Function flow as web
2. System starts AudioSession (`AudioSession.startAudioSession()`) before connecting to LiveKit room
3. Callee receives push via Realtime -> IncomingCallScreen renders full-screen
4. Callee taps Accept -> AudioSession starts, connects to room
5. Both see CallBar (fixed bottom bar) with mute/end controls
6. On call end -> AudioSession stopped (`AudioSession.stopAudioSession()`)

**Postcondition:** Same as web. AudioSession properly cleaned up.

**Error paths:**

- App backgrounded during call -> Call continues (in-app only, no CallKit in Phase 2)
- App killed -> LiveKit detects disconnect, webhook fires `participant_left` then `room_finished`

---

## Journey: Manager starts a group call from channel

**Precondition:** Manager is viewing a department/team/session/custom channel with audio_policy = open_mic.

1. Manager clicks phone icon in channel header -> System calls `call-command` (callType: group)
2. System creates `channel_call_session`, broadcasts `group_call_started` to channel Realtime
3. GroupCallBanner appears in channel header for all members: "1 i samtale - [Bli med]"
4. Manager connects to LiveKit room, CallBar appears
5. Other members see the banner, click "Bli med" -> each fetches token, joins room
6. Banner updates participant count: "3 i samtale - [Bli med]"
7. Active speaker indicators show who is talking
8. Members leave individually by clicking End in CallBar
9. Last person leaves -> webhook fires `room_finished` -> session finalized, call_log created

**Postcondition:** Call logged with all participants' join/leave times and speaking durations.

**Error paths:**

- No one joins -> Room closes after emptyTimeout, session ended with max_participants = 1
- Channel is archived during call -> Call continues until participants leave (no auto-end)

---

## Journey: Employee uses push-to-talk (walkie-talkie mode)

**Precondition:** Employee is viewing a channel with audio_policy = 'ptt'.

1. User opens PTT channel -> System auto-connects to persistent LiveKit room (mic starts MUTED)
2. MessageInput shows PTTButton instead of send button
3. User presses and holds PTTButton -> mic unmutes (`setMicrophoneEnabled(true)`), PTTButton pulses/animates
4. Other connected members hear audio immediately (~10-20ms latency, connection already established)
5. Active speaker indicator shows on the talker's avatar
6. User releases PTTButton -> mic mutes, PTTButton returns to idle state
7. Debounced telemetry: `channel.call.ptt_activated` / `channel.call.ptt_deactivated` emitted max every 5s
8. User navigates away or shift ends -> disconnects from room

**Postcondition:** PTT room persists (emptyTimeout = 300s). Room auto-recreated when next user opens the channel.

**Error paths:**

- Network drop while connected -> LiveKit auto-reconnect, mic stays muted on reconnect
- Multiple people talk simultaneously -> All audio mixes (no floor control in Phase 2)
- Component unmounts while talking -> Safety auto-mute fires

---

## Journey: Employee uses push-to-talk on mobile

**Precondition:** Employee is on mobile app, viewing a PTT channel.

1. User opens PTT channel -> AudioSession starts, auto-connects to LiveKit room (muted)
2. Large PTTButton appears at bottom (thumb-friendly target)
3. User presses PTTButton (onPressIn) -> mic unmutes, haptic feedback fires
4. User releases (onPressOut) -> mic mutes
5. AudioSession cleaned up on channel exit

**Postcondition:** Same as web PTT.

**Error paths:**

- Same as web PTT + AudioSession cleanup on app background/kill

---

## Journey: Employee views call history

**Precondition:** Employee is in a channel that has had voice calls.

1. User sees call history accessible in channel (CallHistory component)
2. System queries `call_log` via `getCallHistory()` -> shows list of past calls
3. Each entry shows: start time, duration, participant count, missed/completed status
4. Participant summary shows who was in each call and how long they spoke

**Postcondition:** User has visibility into past call activity for the channel.

**Error paths:**

- No calls yet -> Empty state: "Ingen samtaler enna"
- RPC fails -> Error toast, retry on pull-to-refresh

---

## Journey: Employee receives incoming call while in another channel

**Precondition:** Employee is anywhere in the dashboard (not necessarily in the caller's channel).

1. `use-call-signaling` hook runs globally in KommShell, subscribed to personal Realtime channel
2. `call_invite` broadcast received -> IncomingCallOverlay renders on top of current view
3. User sees caller name, avatar, accept/reject buttons
4. Accept -> navigates to the DM channel, connects to call
5. Reject -> overlay dismisses, rejection broadcast sent

**Postcondition:** Incoming calls are surfaced globally regardless of current navigation state.

**Error paths:**

- User is already in a call -> Incoming call overlay still shows (no auto-reject in Phase 2)
- Caller cancels before answer -> `call_cancelled` broadcast dismisses overlay
