---
title: Communications Council Fixes — P0/P1 Implementation Plan
status: draft
updated: 2026-03-28
created: 2026-03-28
module: communications
tags: [council, chat, komm, webrtc, telemetry, i18n]
---

# Communications Council Fixes — P0/P1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P0 and P1 issues identified by the System Council audit of Chat, Komm, WebRTC/LiveKit, and mobile messaging systems.

**Architecture:** Three independent fix categories: (1) telemetry gaps — add missing emit() calls to 3 mutations, (2) ADR — document the Chat/Komm consolidation decision, (3) code quality — fix queueMicrotask anti-pattern and add missing telemetry event definitions to the registry.

**Tech Stack:** TypeScript, TanStack Query v5, @smartout/telemetry, Supabase Edge Functions, Framer Motion

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/telemetry/src/registry.ts` | Add 3 new chat event types + routing |
| Modify | `apps/web/src/app/dashboard/chat/_hooks/use-reactions.ts` | Add emit() to onSuccess |
| Modify | `apps/web/src/app/dashboard/chat/_hooks/use-mark-as-read.ts` | Add emit() to onSuccess |
| Modify | `apps/web/src/app/dashboard/komm/_hooks/use-mute-participant.ts` | Add emit() to onSuccess |
| Modify | `apps/web/src/app/dashboard/komm/_components/CallRoom.tsx` | Replace queueMicrotask with useEffect |
| Create | `docs/decisions/0060-communication-system-consolidation.md` | ADR: Komm canonical, Chat frozen |

---

### Task 1: Register Missing Chat Telemetry Events

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

The registry has `"conversation created"` and `"message sent"` for Chat, but is missing events for reaction toggle and mark-as-read. We also need a `"channel.call.participant_muted"` event for the Komm mute mutation.

- [ ] **Step 1: Add chat event interfaces to registry.ts**

Find the `// ─── Chat Events ───` section (around line 984) and add after the existing `MessageSent` interface:

```typescript
export interface ChatReactionToggled extends BaseEvent {
  event: "chat.reaction.toggled";
  properties: {
    conversation_id: string;
    message_id: string;
    emoji: string;
    action: "added" | "removed";
  };
}

export interface ChatRead extends BaseEvent {
  event: "chat.read";
  properties: {
    conversation_id: string;
    profile_id: string;
  };
}
```

Find the channel call events section (around line 1802, after `channel.call.ptt_deactivated`) and add:

```typescript
export interface ChannelCallParticipantMuted extends BaseEvent {
  event: "channel.call.participant_muted";
  properties: {
    channel_id: string;
    target_identity: string;
    muted: boolean;
  };
}
```

- [ ] **Step 2: Add the new events to the EventRegistry union type**

Find the `SmartoutEvent` union type and add `ChatReactionToggled`, `ChatRead`, and `ChannelCallParticipantMuted` to it.

- [ ] **Step 3: Add routing metadata for the 3 new events**

Find the `EVENT_ROUTING` map (around line 2500) and add entries near the existing chat events:

```typescript
"chat.reaction.toggled": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "communication",
},
"chat.read": {
  destinations: ["posthog", "logger"],
  category: "communication",
},
"channel.call.participant_muted": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "channels",
},
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter @smartout/telemetry exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): add chat.reaction.toggled, chat.read, channel.call.participant_muted events

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add emit() to Chat useToggleReaction

**Files:**
- Modify: `apps/web/src/app/dashboard/chat/_hooks/use-reactions.ts`

Model after the Komm equivalent at `komm/_hooks/use-reactions.ts` which uses a proper `onSuccess` callback with emit().

- [ ] **Step 1: Add emit import**

Add to the existing imports at the top of the file:

```typescript
import { emit } from "@smartout/telemetry";
```

- [ ] **Step 2: Modify mutationFn to return the action taken**

The current `mutationFn` returns `void`. Change it to return the action so `onSuccess` can emit the right event. The `profileId` is already available as a mutationFn parameter — return it along with the action:

In the "Remove reaction" branch, before closing the if block, add:
```typescript
return { action: "removed" as const, emoji, messageId, profileId };
```

In the "Add reaction" branch, before closing the else block, add:
```typescript
return { action: "added" as const, emoji, messageId, profileId };
```

- [ ] **Step 3: Add onSuccess with emit()**

Add an `onSuccess` callback to the mutation options, between `mutationFn` and `onSettled`:

```typescript
onSuccess: (result) => {
  if (!result) return;
  void emit({
    event: "chat.reaction.toggled",
    workspace_id: workspaceId,
    actor_id: result.profileId,
    properties: {
      conversation_id: conversationId ?? "",
      message_id: result.messageId,
      emoji: result.emoji,
      action: result.action,
    },
    entity: {
      entity_type: "chat_message",
      entity_id: result.messageId,
    },
  });
},
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_hooks/use-reactions.ts
git commit -m "feat(chat): add telemetry emit to useToggleReaction

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add emit() to Chat useMarkAsRead

**Files:**
- Modify: `apps/web/src/app/dashboard/chat/_hooks/use-mark-as-read.ts`

Model after Komm's `komm/_hooks/use-mark-as-read.ts` which emits `"channel.read"`.

- [ ] **Step 1: Add emit import**

```typescript
import { emit } from "@smartout/telemetry";
```

- [ ] **Step 2: Modify mutationFn to return input data**

Change the `mutationFn` to return the input so `onSuccess` can reference it:

```typescript
mutationFn: async ({
  conversationId,
  profileId,
}: {
  conversationId: string;
  profileId: string;
}) => {
  const supabase = createClient();

  const { error } = await supabase
    .from("chat_participant")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("profile_id", profileId);

  if (error) throw error;
  return { conversationId, profileId };
},
```

- [ ] **Step 3: Add onSuccess with emit()**

Add between `mutationFn` and `onSettled`:

```typescript
onSuccess: (result) => {
  void emit({
    event: "chat.read",
    workspace_id: workspaceId,
    actor_id: result.profileId,
    properties: {
      conversation_id: result.conversationId,
      profile_id: result.profileId,
    },
    entity: {
      entity_type: "chat_message",
      entity_id: result.conversationId,
    },
  });
},
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/chat/_hooks/use-mark-as-read.ts
git commit -m "feat(chat): add telemetry emit to useMarkAsRead

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Add emit() to Komm useMuteParticipant

**Files:**
- Modify: `apps/web/src/app/dashboard/komm/_hooks/use-mute-participant.ts`

- [ ] **Step 1: Add emit import**

```typescript
import { emit } from "@smartout/telemetry";
```

- [ ] **Step 2: Add onSuccess with emit()**

Add an `onSuccess` callback after `mutationFn`:

```typescript
onSuccess: (_data, variables) => {
  void emit({
    event: "channel.call.participant_muted",
    workspace_id: workspaceId,
    actor_id: "system", // caller identity not available in this hook
    properties: {
      channel_id: variables.channelId,
      target_identity: variables.targetIdentity,
      muted: variables.muted ?? true,
    },
    entity: {
      entity_type: "channel",
      entity_id: variables.channelId,
    },
  });
},
```

Note: The hook doesn't have `profileId` available. We need to add it. Check if `useWorkspace()` provides it or if we need to accept it as a parameter. Looking at the hook signature, it only uses `useWorkspace()` for `workspaceId`. We should add `profileId` as a parameter:

Update the hook signature to accept profileId:

```typescript
export function useMuteParticipant(profileId: string) {
```

Then use it in `actor_id`:

```typescript
actor_id: profileId,
```

The caller in `KommShell.tsx` already has `profileId` as a prop, so pass it through:
```typescript
const muteParticipant = useMuteParticipant(profileId);
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/komm/_hooks/use-mute-participant.ts apps/web/src/app/dashboard/komm/_components/KommShell.tsx
git commit -m "feat(komm): add telemetry emit to useMuteParticipant

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Fix CallRoom queueMicrotask Anti-Pattern

**Files:**
- Modify: `apps/web/src/app/dashboard/komm/_components/CallRoom.tsx`

Replace the `queueMicrotask` call inside the render body with a proper `useEffect`.

- [ ] **Step 1: Remove the queueMicrotask call**

In the `CallRoomInner` component, find and remove these lines (around line 100-103):

```typescript
const participantCount = participants.length;
if (onParticipantCountChange) {
  queueMicrotask(() => onParticipantCountChange(participantCount));
}
```

- [ ] **Step 2: Add useEffect for participant count**

Replace with a proper `useEffect` that reacts to participant count changes:

```typescript
const participantCount = participants.length;

useEffect(() => {
  onParticipantCountChange?.(participantCount);
}, [participantCount, onParticipantCountChange]);
```

Make sure `useEffect` is already imported (check the existing imports — it should be from the `useState, useRef, useEffect` import line).

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/komm/_components/CallRoom.tsx
git commit -m "fix(komm): replace queueMicrotask with useEffect in CallRoom

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Write ADR — Communication System Consolidation

**Files:**
- Create: `docs/decisions/0060-communication-system-consolidation.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Read the decision template**

Read `docs/templates/decision.md` for the ADR format.

- [ ] **Step 2: Write the ADR**

Create `docs/decisions/0060-communication-system-consolidation.md`:

```markdown
---
title: "ADR-0060: Communication System Consolidation — Komm Canonical, Chat Frozen"
status: accepted
updated: 2026-03-28
created: 2026-03-28
module: communications
tags: [adr, chat, komm, messaging, architecture]
---

# ADR-0060: Communication System Consolidation

## Context

Smartout has two parallel messaging systems:

1. **Chat** (migration 20260320) — Simple DM/group/AI conversations. 3 tables: `chat_conversation`, `chat_participant`, `chat_message`. JSONB reactions. No workspace_id on messages.

2. **Komm/Channels** (migration 20260422) — Org-structure-aware channels with 7 channel types, 10 message types, origin tracking, delivery modes, audio/video/recording policies. 15+ tables. Proper reaction join table. Full telemetry coverage.

Both systems handle DMs and group messaging. There is no documented boundary between them. The System Council audit (2026-03-28) identified this as the single most critical architectural issue in the communication layer.

## Decision

**Komm is the canonical messaging system. Chat is frozen — no new features.**

### What this means:

1. All new messaging features target Komm (channels, channel_message, channel_member)
2. Chat tables remain for backwards compatibility but receive no new development
3. AI assistant conversations will add `channel_type = 'ai_assistant'` to Komm (not use Chat's `type = 'ai'`)
4. Mobile consolidates to Komm screens only; Chat screens are deprecated
5. LiveKit voice/video integration stays exclusive to Komm (current state)

### Migration path (future, not in scope now):

- Phase 1: Freeze Chat. All new work targets Komm. (this ADR)
- Phase 2: Add `channel_type = 'ai_assistant'` to Komm for AI conversations
- Phase 3: Migrate existing Chat data to Komm equivalents
- Phase 4: Remove Chat routes, components, hooks, and tables

### LiveKit integration model:

- Theme LiveKit components with Nordic Split CSS (not headless rebuild)
- LiveKit headless hooks only if theming proves insufficient

## Consequences

### Positive
- Single source of truth for all messaging
- Eliminates DM ownership confusion
- Eliminates JSONB reaction race condition (Komm uses proper join table)
- Halves the UI surface to maintain
- AI integration targets one system

### Negative
- Chat data migration effort (future)
- Existing Chat users see no new features until migration
- Theme compatibility between LiveKit CSS and Nordic Split needs validation

### Risks
- Chat data could be lost if migration is poorly handled — migration must preserve message history
- AI assistant conversations need a Komm channel type before Chat deprecation is complete

## Alternatives Considered

1. **Keep both systems** — Rejected. Undocumented dualism, split DM ownership, divergent quality levels.
2. **Merge Chat into Komm immediately** — Rejected. Data migration is non-trivial and would block current work.
3. **Deprecate Komm, keep Chat** — Rejected. Komm is architecturally superior (proper reactions, telemetry, org-structure, voice).
```

- [ ] **Step 3: Register in decision log**

Add to `docs/decisions/0000-decision-log.md`:

```markdown
| 4 | 2026-03-28 | ADR-0060: Komm is canonical messaging. Chat frozen, no new features. | accepted |
```

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0060-communication-system-consolidation.md docs/decisions/0000-decision-log.md
git commit -m "docs(decisions): ADR-0060 communication system consolidation

Komm canonical, Chat frozen. Council verdict 2026-03-28.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Log Council Session

**Files:**
- Modify: `docs/council/COUNCIL-LOG.md`

- [ ] **Step 1: Add council session entry**

Append to the council log:

```markdown
## 2026-03-28 — Communications Stack Architecture Audit

**Type:** architecture
**Verdict:** APPROVE WITH CHANGES
**Agents consulted:** system-steward, supervisor, system-agent-coordinator, frontend-designer
**Key decisions:**
- Komm is canonical messaging, Chat frozen (ADR-0060)
- LiveKit: theme approach, not headless rebuild
- 3 telemetry gaps fixed (Chat reactions, Chat read, Komm mute)
**ADR created:** 0060 — Communication System Consolidation
**Learning created:** none (findings captured in ADR)
**Agent effectiveness:**
- system-agent-coordinator: most valuable — surfaced AI integration gap
- supervisor: corrected 3 briefing errors (workspace context, voice RLS, telemetry count)
- frontend-designer: identified 4x MessageBubble maintenance problem
- system-steward: anchored the consolidation decision
```

- [ ] **Step 2: Commit**

```bash
git add docs/council/COUNCIL-LOG.md
git commit -m "docs(council): log 2026-03-28 communications audit session

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Tracked Debt (not in this plan)

These items were identified by the council but are P2/P3 — tracked for future work:

| Item | Priority | Notes |
|------|----------|-------|
| ~20+ hardcoded Norwegian strings | P2 | i18n sweep across chat + komm |
| Chat JSONB reaction race condition | P2 | Mitigated by Chat freeze; fix if migrating data |
| call-command service role removal | P2 | RLS already permits; security hygiene |
| call-command Zod validation | P2 | Add Zod schemas to Edge Functions |
| Shared MessageBubble primitives | P2 | Extract to packages/ui |
| Komm member panel AnimatePresence | P2 | Mirror Chat's pattern |
| LiveKit Nordic Split theming | P3 | CSS override of LiveKit components |
| Mobile LiveKit integration | P3 | Replace VideoCallOverlay placeholder |
| AI messaging identity model | P3 | ADR needed when AI-in-channels ships |
| Schema placement (communications schema) | P3 | Move when table count warrants |
