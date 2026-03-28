---
title: "Emma Arena Views — Chat, History, Memory, Log"
status: draft
created: 2026-03-19
updated: 2026-03-19
module: walkAi
tags: [emma, arena, chat, history, memory, log, voice-emulator, design]
---

# Emma Arena Views — Design Spec

## Problem

Four views inside the Emma Arena are empty placeholders: `HistoryView`, `MemoryView`, `LogView` show nothing. `ChatView` exists but lacks text input and the voice emulator is not integrated with the chat transcript. Settings also did not persist (fixed separately).

## Scope

Implement the **content** inside 4 existing views. The Arena's layout, header, FABs, voice controls, and navigation remain unchanged. Only the view components inside `VIEW_COMPONENTS` are modified.

## Design Decisions

### D1: Chat View — Voice Emulator + Transcript Split

The chat view has two modes controlled by a draggable divider:

**Voice mode (default when connected):**

- Voice emulator reuses and composes the existing `VisualizerView` elements (breathing rings, particles, aurora — already in WalkAiArena.tsx lines 681-936). Enhanced with additional sparks and glow.
- Below the divider: only the **last 2 messages** shown, no scroll, compact bubbles via CSS `overflow: hidden` + `:nth-last-child(-n+2)` selector
- Copy button for transcript

**Expanded mode (toggle via divider click):**

- Emulator hidden (flex: 0, height: 0, opacity: 0, animated out with 0.5s transition)
- Full conversation history with scroll
- Same copy button
- Messages source: `agent.transcript` for live session

**Text input:** Always visible at the bottom. Enter sends a text message via the `/agent/chat` endpoint (Stage Engine POST /agent/chat). This is the existing text chat path — NOT voice injection into Ultravox. Text messages are appended to `agent.transcript` locally for display, and sent to the Stage Engine for agent response.

**Copy transcript:** Button in the chat area header. Copies messages as:

```
Du: message text
Emma: response text
```

Shows "Kopiert!" for 2 seconds. Source: `agent.transcript` for live session, `emma_transcript` rows for historical conversations.

### D2: History View — Conversation Cards with Preview

Loads data from `GET /api/emma/history` (already exists, returns `emma_conversation` + `emma_transcript`).

**Layout:**

- Header: "Historikk" + subtitle "Tidligere samtaler med Emma"
- Scrollable list of conversation cards
- Each card shows:
  - Title: `summary` field if available, otherwise first user message text truncated to 50 chars
  - Timestamp (relative: "I dag 14:32", "I gar 09:15", "17. mar") + duration (computed from `started_at` / `ended_at`)
  - 2-3 preview bubbles: first transcript entries, role name in orange
  - Opacity fades for older conversations (0.7, 0.5)

**Data in context:**

- `WalkAiProvider` adds: `conversations: Conversation[]` to context (loaded on mount via `GET /api/emma/history`)
- Type: `{ id: string; started_at: string; ended_at: string | null; summary: string | null; emma_transcript: { role: string; content: string; created_at: string }[] }[]`

**Interactions:**

- Click card → `switchView('chat')` + set a `viewingConversationId` state. ChatView detects this and renders the historical transcript (read-only, no voice bar, full scroll) instead of the live session.
- Back button in historical view → clears `viewingConversationId`, returns to live chat.
- (Future: resume conversation — out of scope for v1)

### D3: Memory View — Personal + Workspace Sections

**API change required:** `GET /api/emma/memory` currently filters to `scope = 'conversation'` only. Must be updated to return ALL scopes for the authenticated user's profile.

**Layout:**

- Header: "Minne" + subtitle "Hva Emma husker om deg og arbeidsplassen"
- Two sections divided by section headers:
  - **Personlig** — memories with scope `personal` or `conversation`
  - **Arbeidsplass** — memories with scope `workspace` or `team`
- Each memory item shows:
  - Type badge (preference / fact / summary / general)
  - Content text (truncated to 2 lines when collapsed)
  - Date ("Lagret 18. mar")

**Interactions:**

- Click → expand with textarea (editable) + two buttons:
  - "Lagre" — calls `PATCH /api/emma/memory` with body `{ id, content }`
  - "Slett" — calls `DELETE /api/emma/memory` with body `{ id }`
- Click again → collapse

**API additions (same route file, body-based — no dynamic route segment):**

- `PATCH /api/emma/memory` — body: `{ id: string, content: string }` → updates memory content
- `DELETE /api/emma/memory` — body: `{ id: string }` → deletes memory

**Migration required:** Add `FOR DELETE` RLS policy on `engine_memory` for JWT auth (profile-scoped).

### D4: Log View — Telemetry + Emma Actions with Filters

Reuses the existing `TelemetryLog.tsx` component's data source (`useEmmaTelemetry()` from `emma-awareness.ts`) and renders it with a new layout inside the Arena view.

**Existing categories in emma-awareness.ts:** auth, department, shift, session, protocol, contract, wizard, reconciliation, communication, handbook, invitation, page, button.

**Mapped filter chips (grouping related categories):**

- **Alle** — shows everything
- **Emma** — category `emma` (new, emitted from walkai-tools.ts on tool execution)
- **Skift** — category `shift`
- **Sesjon** — category `session`
- **Nav** — categories `page`, `button`
- **Protokoll** — category `protocol`

Clicking an active non-Alle chip deselects it and returns to Alle (radio behavior).

**Layout:**

- Header: "Logg" + subtitle "Handlinger og hendelser"
- Filter chips bar (scrollable horizontal)
- Scrollable monospace event list with color-coded category badges

**Emma action tracking:** Each tool implementation in `walkai-tools.ts` emits a telemetry event via the existing `useEmmaTelemetry` dispatch. Event format: `{ category: "emma", event: "tool_name → description", timestamp }`.

## Files to Modify

| File                                        | Change                                                                                                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WalkAiArena.tsx`                           | Replace `HistoryView`, `MemoryView`, `LogView` placeholders. Rewrite `ChatView` with emulator split + text input. Extract reusable emulator elements from `VisualizerView`.               |
| `WalkAiProvider.tsx`                        | Add `conversations` state (loaded on mount). Add `viewingConversationId` state + setter. Add `updateMemory()`, `deleteMemory()` callbacks. Update `emmaMemories` GET to fetch all scopes. |
| `walkai-tools.ts`                           | Emit `emma` telemetry event in each tool implementation.                                                                                                                                  |
| `emma-awareness.ts`                         | Add `emma` to `CATEGORY_COLORS` map.                                                                                                                                                      |
| `TelemetryLog.tsx`                          | No structural changes — LogView composes it or replaces with in-arena version.                                                                                                            |
| `apps/web/src/app/api/emma/memory/route.ts` | Add PATCH handler (update content) and DELETE handler (remove memory). Update GET to return all scopes (remove `.eq("scope", "conversation")`).                                           |

### New files:

| File                                                                 | Purpose                                                         |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `supabase/migrations/20260319120500_engine_memory_delete_policy.sql` | Add JWT DELETE policy on `engine_memory` scoped to own profile. |

## Files NOT Modified

- Arena layout, header, FABs, voice controls, resize handles — all untouched
- `EmmaProfile.tsx` — already updated with settings persistence
- `persona-engine.ts`, `types.ts` — no changes
- Database tables — no new tables needed

## API Surface

### Modified:

- `GET /api/emma/memory` → remove scope filter, return all scopes for user's profile

### New (same route file, body-based):

- `PATCH /api/emma/memory` → body `{ id: string, content: string }` → update memory
- `DELETE /api/emma/memory` → body `{ id: string }` → delete memory

### Unchanged:

- `GET /api/emma/history` → conversations with transcripts
- `POST /api/emma/history` → start/end/append conversations
- `POST /api/emma/memory` → create memory

## Voice Emulator Visual Spec

The emulator **reuses** existing `VisualizerView` elements (WalkAiArena.tsx lines 681-936) which already include: aurora shimmer, idle particles (glitter + skyfall), breathing rings, core orb, speaking particles.

**Enhancements to add:**

1. **Glow ring** — 280px diffuse radial gradient behind the rings (more depth)
2. **Wave pulses** — 3 concentric rings expanding outward when speaking (2s cycle, staggered 0.7s)
3. **Spark particles** — 10 additional sparks flying outward with glow trails and warm color variants
4. **Core orb upgrade** — 3D lighting (top-left highlight, bottom shadow), larger glow shadow (30-60px)

These are CSS/animation additions to the existing component, not a rebuild.

## Mockups

Interactive mockups:

- `.superpowers/brainstorm/47210-1773921754/arena-simple.html` — all 4 views navigable
- `.superpowers/brainstorm/47210-1773921754/chat-voice-v2.html` — chat with voice emulator split (voice mode + expanded mode)
