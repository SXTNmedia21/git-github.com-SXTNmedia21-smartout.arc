---
title: "Design — Smartout Komm: Communication Redesign"
status: draft
updated: 2026-03-22
created: 2026-03-22
module: communications
tags: [komm, channels, chat, nyheter, walkie-talkie, webrtc, knowledge, help-desk, mobile-first]
---

# Design — Smartout Komm: Communication Redesign

> Redesign of the channel communications system. Replaces the Slack-style 3-column layout with a mobile-first, WhatsApp-inspired UX. Single footer tab "Komm" containing Kanaler, Chat, Nyheter, with WebRTC walkie-talkie, knowledge sharing, and help desk.

---

## 1. Architecture Overview

One footer tab — **Komm** — with three sub-tabs plus overlay screens:

```
Footer: Hjem | Vakter | [Komm] | Innsikt | Meg

Komm (sub-tabs):
├── Kanaler — group channels (department, team, custom, session)
├── Chat — direct messages + people directory
└── Nyheter — social announcement feed

Overlay screens (from within Komm):
├── Channel conversation (WhatsApp-style)
│   ├── Walkie Talkie (WebRTC push-to-talk)
│   ├── Dele-meny (📎 popup: Bilder, Oppgave, Prosedyre, Lenke, Opplæring, Quiz, Veikart, Snarvei)
│   └── Medlemmer + Innstillinger
├── DM conversation (same chat UI)
├── Opprett kanal (modal)
├── Hjelp-tjeneste (Botsson, Meld problem, Finn manual, Ring leder + tickets)
└── Nyhetspost (social card with reactions/comments)
```

### Key Design Decisions

| Decision                                             | Rationale                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Single "Komm" tab, not separate Chat/Channels tabs   | Fewer footer items. Sub-tabs handle separation. Mobile workers don't want 5+ tabs.                                     |
| WhatsApp-style chat, not Slack-style columns         | Target users are shift workers on phones, not desk workers.                                                            |
| Dele-meny from 📎, not always-visible toolbar        | Clean input area. Share options appear on demand.                                                                      |
| Nyheter as social feed, not chat channel             | Announcements need reactions/comments, not threaded chat. Connecteam-inspired.                                         |
| Walkie button in channel header, not separate screen | Voice is contextual to the channel you're in. One tap to start.                                                        |
| People directory in Chat tab, not search-only        | Browse by department/role. Filter by name. No "create DM" modal needed — tap a person.                                 |
| Hjelp-tjeneste accessible from Komm                  | Shift workers need quick access to help: Botsson AI, report problem, find manual, call leader.                         |
| Knowledge as rich cards in chat                      | Procedures, manuals, quizzes shared inline. Tap to open in full screen. Links to existing training/governance modules. |
| Mr. Botsson hidden, not prominent                    | Available via Hjelp, @mention in channels, and as DM contact. Proactive only during onboarding.                        |

---

## 2. Navigation Structure

### 2.1 Mobile (React Native + Expo)

```
(app)/_layout.tsx — Tab navigator
├── (home)/      — Hjem tab
├── (shifts)/    — Vakter tab
├── (komm)/      — Komm tab ← NEW
│   ├── _layout.tsx — Stack navigator
│   ├── index.tsx — Sub-tab container (Kanaler | Chat | Nyheter)
│   ├── [channelId].tsx — Channel/DM conversation
│   ├── walkie/[channelId].tsx — WebRTC voice stream
│   ├── create.tsx — Create channel modal
│   ├── settings/[channelId].tsx — Channel settings
│   ├── members/[channelId].tsx — Member list
│   ├── help.tsx — Help desk
│   └── news/[postId].tsx — News post detail
├── (insights)/  — Innsikt tab
└── (me)/        — Meg tab
```

### 2.2 Web (Next.js App Router)

```
/dashboard/komm — Komm page
  Left panel: Sub-tabs (Kanaler | Chat | Nyheter) + channel/DM list
  Center: Message area (WhatsApp-style)
  Right panel (collapsible): Members + Settings + Shared content
```

Desktop uses the same sub-tab structure but renders in a 3-panel layout. The left panel shows the channel/DM list, center shows messages, right shows context (members, settings, shared content).

### 2.3 Footer Tab Bar

| Tab      | Icon                       | Label    |
| -------- | -------------------------- | -------- |
| Hjem     | House (lucide)             | Hjem     |
| Vakter   | Calendar (lucide)          | Vakter   |
| **Komm** | **MessageSquare (lucide)** | **Komm** |
| Innsikt  | BarChart (lucide)          | Innsikt  |
| Meg      | User (lucide)              | Meg      |

Badge on Komm tab: total unread count across all channels + DMs.

---

## 3. Screen Specifications

### 3.1 Kanaler Sub-Tab

Channel list grouped by type. Each row shows: icon, channel name, last message preview, timestamp, unread badge.

**Sections (in order):**

1. **Avdelinger** — department channels (auto-created)
2. **Team** — team channels (auto-created)
3. **Egne kanaler** — custom channels (user-created)
4. **Sesjon** — session channels (only during active shift)

**Row anatomy:**

- Left: Colored icon (SVG, not emoji) with type-specific background
- Center: Channel name (#name) + last message preview (sender: content...)
- Right: Timestamp + unread badge (orange pill)

**Header:** "Komm" title + search button (top right).

**Actions:** + button in header for "Opprett kanal" flow.

### 3.2 Chat Sub-Tab

Two sections in one scrollable list:

1. **Active conversations** — DMs with recent messages, sorted by last activity. Shows: avatar (initials, colored), name, preview, timestamp, unread badge.
2. **Alle medarbeidere** — Full workspace directory below a divider. Shows: avatar, name, department + role. Tapping starts a DM (via `create_channel()` RPC). Slightly dimmed to distinguish from active conversations.

**Header:** "Komm" title + compose button (pencil icon, top right).

**Filtering:** Top search/filter bar. Filters the full list by name. Not a search — it filters the visible list in real-time.

### 3.3 Nyheter Sub-Tab

Social feed of announcement posts. Only admins/owners can create posts. All members can react and comment.

**Post card anatomy:**

- Header: Author avatar + name + relative timestamp
- Body: Text content (supports bold, links, line breaks)
- Footer: Reaction pills (emoji + count) + comment count + "Kommenter" action

**Post detail:** Tapping a post opens full view with comment thread below.

### 3.4 Channel Conversation (Inside a Channel or DM)

WhatsApp-style message view.

**Header bar:**

- Back arrow (←)
- Channel icon + name + member count
- **Walkie button** (green circle, microphone icon) — starts WebRTC voice
- Members button (people icon)
- More (⋯) for settings

**Message area:**

- Inverted scroll (newest at bottom)
- Date separators ("I dag", "I går", etc.)
- Other messages: Left-aligned. Sender name (color-coded) + bubble (card background) + reactions + timestamp.
- Own messages: Right-aligned. Orange bubble + timestamp.
- System messages: Centered, muted italic.
- Images: Rendered inline with rounded corners.
- Shared content: Rich cards (see 3.6).

**Input bar:**

- Paperclip icon (📎) — opens dele-meny popup
- Text input field
- Send button (orange circle)

**Dele-meny (attachment popup):** Grid of 8 options, each with colored icon circle + label:

| Option    | Icon color | Description                       |
| --------- | ---------- | --------------------------------- |
| Bilder    | Blue       | Image picker from camera/gallery  |
| Oppgave   | Green      | Create/assign task from chat      |
| Prosedyre | Orange     | Share a procedure from governance |
| Lenke     | Orange     | Share a URL                       |
| Opplæring | Cyan       | Share a training module           |
| Quiz      | Pink       | Share a knowledge test            |
| Veikart   | Gray       | Share a roadmap/journey           |
| Snarvei   | Gray       | Share a shortcut action           |

Popup appears above the input bar when 📎 is pressed. Dismissed by tapping outside or selecting an option.

### 3.5 Walkie Talkie (WebRTC Voice Stream)

Full-screen overlay within a channel. Activated by pressing the green walkie button.

**Layout:**

- Channel name at top
- Connection status: "Aktiv — N tilkoblet" with pulsing green dot
- Participant grid: Avatar circles with mic status indicator (green = unmuted, red = muted). Green ring animation around the active speaker.
- Speaking indicator: Audio waveform bars + "[Name] snakker..." text in green pill
- Controls: Mute (speaker icon) | PTT (large green mic button) | End call (red phone icon)
- Hint text: "Hold inne for å snakke (push-to-talk)"

**Behavior:**

- Default mode: Push-to-talk (hold mic button to speak)
- Optional: Toggle mic mode (tap to unmute, tap again to mute)
- Mode controlled by channel `audio_policy` setting (ptt | open_mic | listen_only)
- WebRTC via LiveKit Cloud (Phase 2 infrastructure)

### 3.6 Knowledge Cards (Shared Content in Chat)

Rich preview cards for shared content. Rendered inline in the message timeline.

**Card anatomy:**

- Header: Type icon (colored) + type label (uppercase)
- Body: Title (bold) + description (steps count, duration, deadline, etc.)
- Footer: "Åpne [type] →" action link

**Types:**

| Type      | Icon                  | Opens                                   |
| --------- | --------------------- | --------------------------------------- |
| Prosedyre | Document (orange)     | `/dashboard/governance/procedures/[id]` |
| Manual    | Book (blue)           | Knowledge base viewer / PDF             |
| Quiz      | Question mark (pink)  | `/dashboard/training/quiz/[id]`         |
| Opplæring | Graduation cap (cyan) | `/dashboard/training/modules/[id]`      |
| Oppgave   | Checkbox (green)      | Task detail / assignment                |
| Veikart   | Map (gray)            | Journey/roadmap viewer                  |

Cards are stored as `channel_message` with `message_type = 'system'` and `system_data` containing `{ shared_type, shared_id, title, description }`.

### 3.7 Hjelp-Tjeneste (Help Desk)

Accessible from Komm via a help button or from the Hjem screen.

**Layout:**

- 4 quick action cards in a 2x2 grid:
  - **Spør Botsson** (amber) — Opens Botsson DM conversation
  - **Meld problem** (red) — Creates a ticket/henvendelse to leader
  - **Finn manual** (blue) — Searches knowledge base
  - **Ring leder** (green) — Direct phone call to shift leader
- **Mine henvendelser** section below: List of open/resolved tickets with status badges

**Ticket anatomy:**

- Status badge: Åpen (amber) | Venter (amber) | Løst (green)
- Title + description
- Meta: When reported + who resolved

Tickets map to the existing `deviation` table or a new lightweight `help_request` table.

### 3.8 Opprett Kanal (Create Channel)

Modal/full-screen form:

- Icon picker (grid of contextual icons)
- Channel name input
- Description (optional)
- Member picker: Filter by name, chips for selected members
- "Opprett kanal" button

Only `custom` type can be created by users. Department/team channels are auto-created by triggers.

### 3.9 Kanalinnstillinger (Channel Settings)

Settings screen for a channel:

- Channel icon + name + type label (editable for custom channels)
- Varsler (notification preference)
- Lydpolicy (audio policy: push-to-talk / open mic / listen only)
- Skrivebeskyttet toggle (read-only)
- Lesebekreftelser toggle (read receipts)
- Medlemmer (member count, tap to open member list)
- Inviter medlemmer (add members)
- Forlat kanal (leave, red text)

---

## 4. Database Schema

The existing schema from Phase 1 is **kept as-is**. All 11 tables, 16 enums, RLS policies, RPCs, and triggers remain. The redesign is purely a UX change — the data layer is unchanged.

**Additions needed:**

| Table/Change                                    | Purpose                                                    |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `help_request` (new table)                      | Help desk tickets. FK to profile, workspace. Status enum.  |
| `channel_message.system_data` schema convention | Define JSON shape for shared content cards                 |
| Nyheter rendering                               | Existing `news` channel type + `announcement` message type |

---

## 5. Performance Fixes

The current implementation is slow because:

1. **`get_my_channels()` RPC** does correlated subqueries per channel for unread counts. Fix: Use a single CTE-based aggregation.
2. **No query caching** on the client. Fix: Add `staleTime: 30_000` to channel list queries.
3. **Full re-render on Realtime events.** Fix: Surgical cache updates instead of full invalidation.

---

## 6. What This Spec Does NOT Cover

- **LiveKit infrastructure setup** (WebRTC SFU) — Phase 2
- **Actual WebRTC implementation** — Phase 2 (this spec defines the UI only)
- **Push notifications** — Separate cross-cutting concern
- **File upload to Supabase Storage** — Attachment pipeline
- **Old chat_conversation sunset** — Phase 4
- **E2E tests** — Separate task after stable
- **Botsson AI responses in channels** — Phase 3

---

## 7. Mockup Reference

Visual mockups in `.superpowers/brainstorm/9299-1774146382/`:

- `comms-v4.html` — Mobile (Kanaler, Chat, I kanal med dele-meny) + Desktop 3-panel
- `comms-v5-walkie-help.html` — Walkie Talkie active, Knowledge cards in chat, Help desk
