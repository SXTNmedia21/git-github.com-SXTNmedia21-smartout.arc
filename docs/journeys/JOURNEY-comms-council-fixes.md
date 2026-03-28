---
title: "User Journeys — comms-council-fixes"
status: done
updated: 2026-03-28
created: 2026-03-28
module: communications
tags: [journeys, chat, komm, telemetry]
---

# User Journeys — comms-council-fixes

## Journey: Employee Reacts to Chat Message

**Precondition:** Employee is in a Chat conversation with at least one message visible.

1. Employee clicks an emoji reaction on a message
2. System toggles the reaction (add or remove) via JSONB update on `chat_message.reactions`
3. System emits `chat.reaction.toggled` event with action ("added"/"removed"), emoji, and message ID
4. Event routes to PostHog (analytics), Logger (stdout), and activity_trail (audit)
5. Employee sees the reaction appear/disappear on the message

**Postcondition:** Reaction is persisted. Telemetry event recorded in PostHog and activity trail.

**Error paths:**

- Supabase update fails → mutation throws, no emit fires, no reaction change visible
- Network error → TanStack Query retry logic applies

---

## Journey: Employee Opens a Chat Conversation (Mark as Read)

**Precondition:** Employee has an unread Chat conversation.

1. Employee opens the conversation (or scrolls to bottom)
2. System updates `chat_participant.last_read_at` to current timestamp
3. System emits `chat.read` event with conversation ID
4. Event routes to PostHog and Logger (no activity_trail — high-frequency event)
5. Unread badge clears for this conversation

**Postcondition:** Read status updated. Analytics event recorded.

**Error paths:**

- Supabase update fails → mutation throws, no emit fires, badge remains

---

## Journey: Admin Mutes a Participant in Komm Voice Call

**Precondition:** Admin is in an active Komm voice call with at least one other participant.

1. Admin clicks the mute button on a participant tile
2. System calls `muteParticipant` via LiveKit's `call-command` Edge Function
3. On success, system emits `channel.call.participant_muted` event with target identity and muted state
4. Event routes to PostHog, Logger, and activity_trail (moderation action)
5. Participant's audio is muted server-side for all listeners

**Postcondition:** Participant is muted. Moderation action recorded in audit trail.

**Error paths:**

- Edge Function fails → toast error "Kunne ikke dempe deltaker", no emit fires
- LiveKit server unreachable → same error path

---

## Journey: Participant Count Updates in CallRoom

**Precondition:** User is in an active Komm voice call via CallRoom component.

1. A participant joins or leaves the LiveKit room
2. LiveKit SDK updates the `participants` array
3. `useEffect` fires with new `participantCount`
4. Parent component (`KommShell`) receives updated count via `onParticipantCountChange` callback
5. Participant count badge updates in the call header

**Postcondition:** UI reflects current participant count without render-cycle timing issues.

**Error paths:**

- None — `useEffect` handles the sync reactively. If callback is not provided, optional chaining skips the call.
