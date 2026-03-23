---
title: "User Journeys — Walkie Talkie / Komm"
status: done
updated: 2026-03-22
created: 2026-03-22
module: communications
tags: [komm, channels, chat, nyheter, help-desk]
---

# User Journeys — Walkie Talkie / Komm

## Journey: Employee views channel list

**Precondition:** Employee is logged in, has a profile in a workspace with department.

1. User navigates to Komm tab → System loads `get_my_channels()` RPC → User sees channel list grouped by type (Avdelinger, Team, Egne kanaler)
2. User sees their department channel (auto-created) with unread badge → System shows last message preview + timestamp
3. User taps a channel → System loads messages via `get_channel_messages()` RPC → User sees WhatsApp-style message timeline

**Postcondition:** User is viewing channel messages with sender names, reactions, and date separators.

**Error paths:**

- No channels exist → User sees "Ingen kanaler ennå" empty state
- RPC fails → Error toast, retry on pull-to-refresh

---

## Journey: Employee sends a message

**Precondition:** Employee is viewing a channel they are a member of.

1. User types in message input → System enables send button
2. User presses Enter or taps send → System inserts message with `client_message_id` for idempotent retry → User sees message appear in timeline
3. System emits `channel.message.sent` telemetry event
4. Other members receive message via Supabase Realtime → Their channel list updates with new preview

**Postcondition:** Message is persisted and visible to all channel members.

**Error paths:**

- Network failure → Toast "Kunne ikke sende melding", message not shown
- Duplicate `client_message_id` → Idempotent, no duplicate created

---

## Journey: Employee reacts to a message

**Precondition:** Employee is viewing messages in a channel.

1. User hovers over a message → System shows action buttons (emoji, reply)
2. User clicks emoji picker → System shows 6 quick emojis
3. User selects an emoji → System toggles reaction (add if not present, remove if already reacted)
4. System emits `channel.reaction.added` or `channel.reaction.removed` telemetry

**Postcondition:** Reaction appears/disappears on the message. Reaction count updates for all members via Realtime.

---

## Journey: Employee starts a direct message

**Precondition:** Employee is on the Chat sub-tab in Komm.

1. User sees active DM conversations on top + all workspace members below
2. User filters by name in the search bar → System filters the member list in real-time
3. User taps a person → System calls `create_channel()` RPC with `p_channel_type = 'direct'` and both profile IDs
4. If channel already exists → System returns existing channel (idempotent via `direct_pair_hash`)
5. User sees the DM conversation view

**Postcondition:** A direct channel exists between the two users, conversation view is open.

**Error paths:**

- Both members must belong to same workspace → RPC raises exception
- User taps themselves → Not possible (self excluded from member list)

---

## Journey: Manager creates a custom channel

**Precondition:** User is a manager, admin, or owner. On the Kanaler sub-tab.

1. User clicks the + button → System opens "Opprett kanal" dialog
2. User selects "Kanal" type → System shows name input + member picker
3. User enters channel name and selects members → System validates name is not empty
4. User clicks "Opprett" → System calls `create_channel()` RPC with `p_channel_type = 'custom'`
5. Creator is added as channel admin, selected members as members
6. System emits `channel.created` telemetry event
7. Channel appears in the "Egne kanaler" section

**Postcondition:** Custom channel created with specified members.

**Error paths:**

- Employee tries to create → RPC raises "Only manager/admin/owner can create custom channels"
- Empty name → Button disabled, cannot submit

---

## Journey: Employee reads news/announcements

**Precondition:** Employee is on the Nyheter sub-tab in Komm.

1. User sees social feed of announcement posts → System queries messages from channels with `channel_type = 'news'`
2. Each post shows: author avatar, name, timestamp, content, reaction pills
3. User reacts to a post → System toggles reaction via same reaction mechanism as channels

**Postcondition:** User has seen and optionally reacted to announcements.

**Error paths:**

- No news channel exists → "Ingen nyhetskanal ennå" empty state

---

## Journey: Employee uses help desk

**Precondition:** Employee needs help during a shift.

1. User opens help desk (via Komm) → System shows 4 quick actions: Spør Botsson, Meld problem, Finn manual, Ring leder
2. User taps "Meld problem" → System shows create ticket form (title + description)
3. User fills in and submits → System inserts into `help_request` table, emits `help_request.created` telemetry
4. User sees ticket appear in "Mine henvendelser" with status "Åpen"
5. Manager resolves the ticket → Status changes to "Løst"

**Postcondition:** Help request is tracked with status visible to the employee.

**Error paths:**

- Empty title → Submit button disabled
- No permission to resolve → Only managers/admins can update help_request status

---

## Journey: Auto-channel creation on department setup

**Precondition:** Admin creates a new department in the workspace.

1. Admin creates department → Database trigger `auto_create_department_channel()` fires
2. System creates a channel with `channel_type = 'department'` and `name = '#' + lower(department.name)`
3. Uniqueness constraint prevents duplicate channels per department
4. When employees are assigned to the department → Trigger `sync_profile_department_channel()` adds them to the channel

**Postcondition:** Department channel exists with all department members auto-enrolled.

**Error paths:**

- Department already has an active channel → INSERT is skipped (WHERE NOT EXISTS guard)
- Employee changes department → Old channel membership gets `left_at = now()`, new channel membership created

---

## Journey: Employee shares knowledge in chat

**Precondition:** Employee is in a channel conversation.

1. User taps the 📎 paperclip icon → System shows 8-item attachment popup (Bilder, Oppgave, Prosedyre, Lenke, Opplæring, Quiz, Veikart, Snarvei)
2. User selects a type (e.g., Prosedyre) → System will open a picker to select content (Phase 2)
3. Selected content is shared as a message with `system_data = { shared_type, shared_id, title, description }`
4. Other members see a KnowledgeCard inline in the chat with "Åpne prosedyre →" link
5. System emits `knowledge.shared` telemetry event

**Postcondition:** Knowledge content is shared in the channel as a rich card.

**Note:** Full content picker integration is Phase 2. Currently shows toast placeholder.
