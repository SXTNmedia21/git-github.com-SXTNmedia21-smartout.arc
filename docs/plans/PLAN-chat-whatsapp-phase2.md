---
title: "Plan — chat-whatsapp-phase2"
status: in_progress
updated: 2026-05-16
created: 2026-05-16
module: mobile
tags: [plan, mobile, chat, ux, gestures, presence]
---

# Plan — chat-whatsapp-phase2

> Branch: `feat/mobile-chat-whatsapp-phase2` | Worktree: `/home/sxtnl/dev/smartout.ai-mobile-wt-1` | Base: `campaign/mobile` | Module: mobile | Started: 2026-05-16

## Goal

Full WhatsApp-feel on mobile chat — motion (swipe, sticky, long-press) + presence (typing, delivered) + cleanup (delete-sub, E2E). Phase 1 delivered visual bubbles + receipts + inline dividers. Phase 2 delivers the "feel".

## Hard constraints

- Nordic Split tokens only. Tokens already proven: `warnSoft` (own bubble), `muted` (other), `brandOrange` (read), `scrim` (overlays).
- ADR-0132/0133/0134/0135/0136 unchanged — no AI routing changes, no compose-verbs on mobile, telemetry contract holds, LiveKit reserved for live calls, ADR-0136 camera evidence pattern respected.
- Motion budget: spring physics from `@smartout/design-tokens` `motion.springSnappy` for press/swipe; no inline magic numbers.
- Reanimated v3 + Gesture Handler v2 already in tree — no new deps.
- Mobile telemetry contract: `getProfileContext()` fail-fast on every mutation.

## Sub-agent tracks

| Track | Agent | Model | Status | Depends |
|---|---|---|---|---|
| T0 Explore | general-purpose | haiku | dispatching | — |
| T1 Swipe-reply | general-purpose | sonnet | blocked on T0 | T0 |
| T2 Sticky dividers | general-purpose | sonnet | blocked on T0 | T0 |
| T3 Long-press spring | general-purpose | sonnet | blocked on T0 | T0 |
| T4 Typing presence | general-purpose | sonnet | blocked on G1 | T0+G1 |
| T5 Delivered ack | general-purpose | sonnet | blocked on G1 | T0+G1 |
| T6 DELETE sub | general-purpose | sonnet | blocked on T0 | T0 |
| T7 E2E | general-purpose | sonnet | blocked on G2 | T1-T6+G2 |
| T8 Review | code-reviewer | sonnet | blocked on G2 | G2 |
| T9 Steward | system-steward | opus | blocked on G2 | G2 |

## T0 — Explore (haiku, background)

Map current state. Read-only. Inputs for G1 + T1-T6 scoping.

1. **Gesture surface readiness.** Check `react-native-gesture-handler` + `react-native-reanimated` versions in apps/mobile/package.json. Confirm `Gesture.Pan()` API + `withSpring` available.
2. **FlatList sticky support.** ConversationBody uses inverted FlatList. Confirm `stickyHeaderIndices` works on inverted lists. If not, plan alternative (absolute-positioned overlay tracking scroll position).
3. **Presence infrastructure.** Search for any existing presence/typing tables: `grep -i "typing\|presence" packages/supabase/src/database.types.ts`. Check Supabase `channel.send({ type: 'broadcast' })` usage anywhere in mobile/web codebase. Report what exists, what's missing.
4. **Delivered-ack pattern.** Look at `channel_message` columns — does `delivered_at` exist? Any prior delivery tracking?
5. **E2E setup status.** Check `apps/mobile/e2e/` for Detox config, `apps/mobile/.detoxrc.js`, `package.json` test scripts. Report: Detox configured? Maestro? Playwright RN? Nothing?
6. **onSwipeReply prop trail.** Confirm dead-wire status — declared but not invoked in MessageBubble + ChannelMessageBubble (Phase 1 left this for Phase 2).
7. **Long-press current behavior.** Read ReactionBar usage in ConversationBody — does it animate in, or just appear? Report current motion (or lack of).

Output: G1 decision input — schema path (new table vs broadcast), E2E framework choice, motion-budget baseline.

## G1 — Schema + framework decisions

After T0:
- Typing presence: `channel_typing` table (durable) vs Supabase broadcast (ephemeral, no schema). Recommend broadcast unless heartbeat needed.
- Delivered-ack: column on `channel_message` (durable) vs broadcast presence join (ephemeral). Recommend broadcast.
- E2E framework: Detox if mobile-only, Maestro if cross-platform, Playwright if web-PWA path acceptable. Decide based on what's already configured (T0 reports).
- **Council escalation** if any choice requires migration with RLS implications, or if frameworks all absent (greenfield E2E setup is its own sortie).

## T1 — Swipe-to-reply (sonnet)

**Files:**
- `apps/mobile/src/components/chat/MessageBubble.tsx` — wrap render in `Gesture.Pan()` via Reanimated. Wire dead `onSwipeReply` prop.
- `apps/mobile/src/components/komm/ChannelMessageBubble.tsx` — same pattern.

**Behavior:**
- Horizontal drag triggers translation 0 → 64px max.
- Threshold 48px → haptic + fire `onSwipeReply`.
- Spring back via `withSpring` using `motion.springSnappy` tokens.
- Reply-icon (Lucide `Reply` or `CornerUpLeft`) fades in behind bubble during drag.
- Direction: drag toward bubble's own side (right for own, left for other). Verify against WhatsApp convention.
- Memoize bubble; only re-render if `(id, content, reactions.length, readReceiptState)` change — gesture-state lives in shared values, not React state.

## T2 — Sticky date dividers (sonnet)

**Files:**
- `apps/mobile/src/components/komm/ConversationBody.tsx` — add `stickyHeaderIndices` derived from FeedItem positions.

**Behavior:**
- Date divider stays pinned to top of viewport while its day's messages scroll under it.
- On inverted FlatList: divider sticks at top during downward scroll (toward newer messages).
- Style on sticky state: same pill, but slight elevation/shadow via `colors.scrim`.
- If `stickyHeaderIndices` doesn't work on inverted lists, fall back to absolute-positioned overlay reading `onScroll` offset.

## T3 — Long-press scale-spring (sonnet)

**Files:**
- `apps/mobile/src/components/chat/MessageBubble.tsx` — add scale-spring on press-in/long-press start.
- `apps/mobile/src/components/komm/ChannelMessageBubble.tsx` — same.
- `apps/mobile/src/components/chat/ReactionBar.tsx` — fade-in with `motion.springSnappy` from below bubble.

**Behavior:**
- Long-press starts: bubble scales to 1.05 with `springSnappy`.
- Haptic on threshold (existing wired).
- Release → bubble scales back, ReactionBar mounts with opacity 0 → 1 + translateY 8px → 0.
- Cancel on outside-tap.

## T4 — Typing presence (sonnet, blocked on G1)

Depends on G1 schema decision.

**Path A — Supabase broadcast (recommended)**:
- `apps/mobile/src/hooks/use-typing-indicator.ts` — subscribes to broadcast on channel `typing:${channelId}`, returns `Set<profileId>` of who's typing.
- `apps/mobile/src/hooks/mutations/use-emit-typing.ts` — debounced 1s broadcast emit on text-input change.
- `apps/mobile/src/components/chat/TypingIndicator.tsx` — shows "Anna skriver…" pill above composer, 3-dot pulse animation.
- Wire `MessageInput` `onChange` → `emitTyping`.
- Wire `ConversationScreen` above-composer slot to render indicator.

**Path B — channel_typing table**: only if council recommends after T0 surfaces durable-presence need.

## T5 — Delivered-state ack (sonnet, blocked on G1)

Depends on G1.

**Path A — Broadcast presence-join (recommended)**:
- On `ConversationScreen` mount, broadcast `presence:joined:${channelId}` with current `unread` message_ids.
- Server-side trigger OR sender-side handler: on `presence.joined` event with message_ids that include sender's outbound messages, update local cache state from `sent` → `delivered`.
- `use-channel-read-receipts` gains a `deliveredSet: Set<message_id>` tracking presence-driven acks.

**Path B — channel_message.delivered_at column**: heavier, requires migration. Only if council deems persistence required.

## T6 — DELETE subscription on channel_message_read (sonnet)

**Files:**
- `apps/mobile/src/hooks/use-channel-read-receipts.ts` — extend Realtime subscription to include DELETE events on `channel_message_read`. On DELETE, remove the (message_id, profile_id) entry from local state. Sender's `read` → `sent` transition.

Closes T6 finding from Phase 1 audit.

## G2 — Integration gate

After T1-T6:
- `pnpm --filter @smartout/mobile --filter @smartout/telemetry typecheck` clean
- Mobile bundles READY
- Manual PWA verification: swipe a bubble, see sticky pill, long-press shows spring, typing indicator renders, delivered/read state visible end-to-end.

## T7 — E2E tests (sonnet, blocked on G2)

Depends on G1 E2E framework decision.

Coverage targets — 5 Phase 1+2 journeys:
1. employee-read: bubbles + dividers + receipts visible
2. employee-send: pending → sent → delivered → read progression
3. manager-long-thread: sticky divider on scroll
4. employee-swipe-reply: swipe gesture fires reply
5. employee-typing: typing indicator appears/disappears

If E2E framework greenfield (no Detox/Maestro configured): council before this lands. May spin off as separate sortie.

## T8 — Code review (sonnet, blocked on G2)

Standard pass. Focus areas:
- No hardcoded colors/durations/spring values. All via tokens.
- Reanimated worklets correctly marked. No JS-thread bridge regressions.
- emit() ADR-0134 contract on every new mutation.
- FeedItem type still discriminated after sticky additions.
- DELETE sub cleanup on unmount.

## T9 — Steward (opus, blocked on G2)

ADR-0132/0133/0134/0135/0136 compliance. Plan-vs-reality. Any new ADR needed?
- Council on schema if T4/T5 chose Path B (durable tables) — adds RLS surface.
- Verify motion tokens not fragmented into magic numbers (per Nordic Split debt list).

## G3 — Close

After T7+T8+T9 green:
- HANDOFF written with all 7 tracks + decisions + learnings
- 5 journeys verified
- Decision log updated if any new ADR
- `/close-feature` → merges to campaign/mobile

## AI Council escalation rules

Trigger council when:
- T0 surfaces presence requires new schema with RLS complexity → schema council
- G1: E2E framework absent everywhere → tool-choice council (Detox vs Maestro vs spin-off sortie)
- T1 sticky on inverted FlatList unsupported and overlay fallback adds 16ms+ frame cost → motion-budget council
- T5 delivered-ack via broadcast doesn't survive RLS scrutiny → auth-model council
- Reanimated worklets cause Android low-end measured >16ms frame drops → council on motion budget

Default council members: `code-architect`, `system-steward`, `frontend-designer` (advisory only — can't write). Add `system-agent-coordinator` if AI router touched.

## Acceptance Criteria

- [ ] T0 explore + G1 decisions made
- [ ] T1 swipe-reply works on inverted FlatList
- [ ] T2 sticky date dividers
- [ ] T3 long-press scale-spring + ReactionBar fade
- [ ] T4 typing indicator with broadcast (or table per G1)
- [ ] T5 delivered state reaches user (no sent/read collapse)
- [ ] T6 DELETE sub on channel_message_read
- [ ] G2 typecheck green + bundles
- [ ] T7 E2E coverage on 5 journeys
- [ ] T8 review pass
- [ ] T9 steward green
- [ ] 5 journeys written
- [ ] HANDOFF written
