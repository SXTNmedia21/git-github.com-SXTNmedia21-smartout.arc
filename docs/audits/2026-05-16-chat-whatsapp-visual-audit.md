---
title: Chat WhatsApp Phase 1+2 — Visual Audit
status: in_progress
created: 2026-05-16
updated: 2026-05-16
module: mobile-chat
tags: [audit, visual-verification, mobile, chat, ADR-0338, whatsapp-phase1, whatsapp-phase2]
---

# Chat WhatsApp Phase 1+2 — Visual Audit

One-shot audit of the chat-whatsapp Phase 1 and Phase 2 visual surfaces using
the methodology defined in `docs/protocols/VISUAL-VERIFICATION-MOBILE.md`.

**Audit path used:** Path B — files read from `origin/campaign/mobile` via
`git show`. This provides the merged Phase 1+2 state including all T-series
fixes (T7, T8 token fixes from Phase 1; T1–T6 additions from Phase 2).

**Worktree:** `feat/domain-chat-ownership` (branched from `development`).
`campaign/mobile` is not yet merged to `development`. The audit findings
described below reflect the campaign/mobile state. If code behavior in the
current worktree differs, it is because campaign/mobile has not merged yet.

**Audited commit:** `d95a4c1` — `feat(merge): feat/mobile-chat-whatsapp-phase2
into campaign/mobile`.

---

## Component Map

| Component | File | Phase |
|---|---|---|
| `MessageBubble` | `apps/mobile/src/components/chat/MessageBubble.tsx` | 1 (bubbles) + 2 (swipe, scale) |
| `ChannelMessageBubble` | `apps/mobile/src/components/komm/ChannelMessageBubble.tsx` | 1 (bubbles) + 2 (swipe, scale) |
| `ReadReceipt` | `apps/mobile/src/components/chat/ReadReceipt.tsx` | 1 |
| `DateDivider` | `apps/mobile/src/components/chat/DateDivider.tsx` | 1 (inline) + 2 (sticky via ConversationBody) |
| `ReactionBar` | `apps/mobile/src/components/chat/ReactionBar.tsx` | 2 (mount/unmount animation) |
| `TypingIndicator` | `apps/mobile/src/components/chat/TypingIndicator.tsx` | 2 |
| `ConversationBody` / `StickyDateOverlay` | `apps/mobile/src/components/komm/ConversationBody.tsx` | 2 (sticky overlay mechanism) |

Token source: `packages/design-tokens/src/native.ts` (campaign/mobile version).

---

## Step 1 — Token Resolved-Value Audit

### Token table (light mode, extracted from `native.ts`)

| Token name | Hex (light) | Role in chat components | Collision? |
|---|---|---|---|
| `warnSoft` | `#fceedb` | Own bubble background (MessageBubble + ChannelMessageBubble) | No |
| `muted` | `#f5f3f0` | Other bubble background, DateDivider pill, TypingIndicator pill, system pill | No |
| `secondary` | `#f5f3f0` | NOT used in chat components (same hex as muted — collision class) | N/A |
| `foreground` | `#1c1814` | Message text on both own and other bubbles | No |
| `mutedForeground` | `#7a756e` | Timestamps (both bubbles), sender name label, pending/sent/delivered receipt icons, reply icon (swipe), DateDivider text, TypingIndicator text | No |
| `brandOrange` | `#f97316` | Read receipt "read" state, reply indicator border (other bubble via `replyIndicator`) | No |
| `border` | `#e8e5e1` | Reply indicator border (own bubble via `replyIndicatorOwn`), reaction pill border, ReactionBar border | No |
| `card` | `#fdfcfa` | Reaction pill background, ReactionBar container background | No |
| `scrim` | `rgba(0,0,0,0.3)` | Video thumbnail dark overlay | No |
| `primaryForeground` | `#fafafa` | Video play icon on scrim | No |

### Collision analysis

**No active collision found in Phase 1+2 ship state.**

The Phase 1 class trap (`secondary === muted === "#f5f3f0"`) was present in the
pre-T8 codebase. T8 (commit `11354f317`) replaced `secondary` with `warnSoft`
(`#fceedb`) for own-bubble backgrounds in both `MessageBubble` and
`ChannelMessageBubble`. The two bubble types now use visibly different hex
values:

| Role | Token | Hex (light) | Hex (dark) |
|---|---|---|---|
| Own bubble | `warnSoft` | `#fceedb` | `#3a2f1c` |
| Other bubble | `muted` | `#f5f3f0` | `#262626` |

These hex values are meaningfully distinct in both modes. **No collision
exists in the merged Phase 1+2 state.**

`secondary` (`#f5f3f0`) is not referenced in any chat component file. The
collision class is resolved.

**Step 1 verdict: PASS**

---

## Step 2 — Motion Timing Audit

### Surfaces with code-verifiable motion

#### Swipe-to-reply (MessageBubble + ChannelMessageBubble, Phase 2 T1)

- **API used:** `withSpring(0, springSnappy)` on `panGesture.onEnd`.
- **springSnappy values:** `{ stiffness: 45, damping: 24, mass: 2 }`.
- **Analysis:** Stiffness 45 is low (slow spring). Damping 24 with mass 2
  gives a damping ratio of approximately 24 / (2 × sqrt(45 × 2)) ≈ 1.27 —
  overdamped. No bounce. Settles slowly. Matches the "rubber band glide"
  description in the methodology doc.
- **Code path verified:** `panGesture.onEnd` worklet calls
  `translateX.value = withSpring(0, springSnappy)` and resets `hasFired`.
  The pan uses `activeOffsetX: [-10, 10]` to gate activation.
- **Static verdict:** Code uses the correct spring config. Runtime behavior
  cannot be confirmed from code alone.

**Swipe return: NEEDS-PWA-MANUAL**

Test: swipe right on own message, observe return — expect slow glide, no
bounce. Swipe left on other message, observe same.

#### Long-press scale (MessageBubble + ChannelMessageBubble, Phase 2 T3)

- **API used:** `withSpring(1.05, springSnappy)` on `longPressGesture.onStart`,
  `withSpring(1, springSnappy)` on `longPressGesture.onFinalize`.
- **springSnappy values:** same as above.
- **Code path verified:** Scale shared value animates between 1.0 and 1.05.
  Composed with `Gesture.Simultaneous(panGesture, longPressGesture)` so both
  can recognize independently.
- **Static verdict:** Code uses the correct spring config and API.

**Long-press scale: NEEDS-PWA-MANUAL**

Test: hold bubble 300ms — expect scale 1.05 spring, ReactionBar appears.
Release — expect scale returns to 1.0.

#### ReactionBar enter/exit (Phase 2 T3)

- **Entering:** `FadeInDown.springify()` — opacity 0→1 with a bottom-up
  slide using spring easing. The `.springify()` modifier applies Reanimated's
  built-in spring easing to the layout animation, giving a slight overshoot
  on the slide that reads as "snappy."
- **Exiting:** `FadeOut.duration(sheetSlideMs)` where `sheetSlideMs = 200`.
  Plain opacity fade-out over 200ms — matches sheet dismissal token.
- **Static verdict:** API calls are correct. `FadeInDown.springify()` is
  the standard Reanimated layout-animation spring pattern.

**ReactionBar enter/exit: NEEDS-PWA-MANUAL**

Test: long-press a bubble, observe ReactionBar slide-up with opacity fade.
Tap a reaction or tap outside, observe 200ms fade-out.

#### TypingIndicator enter/exit (Phase 2 T4)

- **Entering:** `FadeIn.duration(nativeTheme.motion.enterMs)` where
  `enterMs = 500`.
- **Exiting:** `FadeOut.duration(nativeTheme.motion.exitMs)` where
  `exitMs = 250`.
- **Static verdict:** Tokens used correctly. Duration values sourced from
  `nativeTheme.motion`, no inline constants. The fade (not spring) is
  intentional — a spring on the typing indicator would feel jittery since
  it appears and disappears frequently.

**TypingIndicator enter/exit: NEEDS-PWA-MANUAL**

Test: trigger typing from a second session, observe 500ms fade-in. Stop
typing, observe 250ms fade-out.

#### StickyDateOverlay (Phase 2 T2)

- **Mechanism:** State-driven swap, not animated. The sticky overlay is an
  absolute-positioned `View` with `pointerEvents="none"`. It shows
  `<DateDivider date={stickyDividerKey} />` when a key is active, and
  mounts/unmounts via React conditional render.
- **No animation on the overlay itself.** The inline divider for the sticky
  key is hidden via `opacity: 0` (hiddenDivider style) to avoid duplication
  during the swap. No spring or fade is applied to the overlay.
- **Static verdict:** State-driven mechanism confirmed by code. No motion
  artifacts expected from the overlay itself. Scroll performance and
  `onLayout`/`onScroll` wiring are the runtime risk — cannot be confirmed
  from code.

**StickyDateOverlay: NEEDS-PWA-MANUAL**

Test: scroll a long conversation. Observe the date pill pins to the top of
the list while scrolling. Verify the inline divider disappears when the
overlay takes over (no duplication). Verify the overlay dismisses when
scrolled to the bottom (no sticky pill visible on a single-day thread).

### Step 2 summary

| Surface | Static verdict | PWA test required |
|---|---|---|
| Swipe return spring | API correct | Yes |
| Long-press scale spring | API correct | Yes |
| ReactionBar enter (springify) | API correct | Yes |
| ReactionBar exit (200ms fade) | API correct | Yes |
| TypingIndicator enter (500ms) | API correct | Yes |
| TypingIndicator exit (250ms) | API correct | Yes |
| StickyDateOverlay swap | State-driven, no motion | Yes (scroll behavior) |

**Step 2 verdict: NEEDS-PWA-MANUAL** (no FAIL found in code; all APIs
use correct tokens and spring configs)

---

## Step 3 — Side-by-Side Reference Comparison

Cannot be performed from code inspection alone. All items in this step require
a human to open the PWA and compare against WhatsApp.

### PWA test checklist

**Own bubble:**
- [ ] Background is visibly warm cream (not the same gray as other bubble).
- [ ] Bottom-right corner is 4pt, other corners 16pt.
- [ ] Timestamp + read receipt are inline, bottom-right inside the bubble.
- [ ] Text color is dark (foreground, not muted).

**Other bubble:**
- [ ] Background is light gray (muted).
- [ ] Bottom-left corner is 4pt, other corners 16pt.
- [ ] Sender name micro-label appears above bubble (for multi-participant
  conversations).
- [ ] Avatar (28pt) is left-aligned, aligned to bubble bottom.
- [ ] No read receipt shown.

**ReadReceipt states:**
- [ ] Pending: clock icon, muted color.
- [ ] Sent: single checkmark, muted color.
- [ ] Delivered: double checkmark, muted color.
- [ ] Read: double checkmark, orange (`#f97316`), visually distinct.

**DateDivider:**
- [ ] Centered pill with translucent muted background (opacity 0.7).
- [ ] Mono uppercase text.
- [ ] Labels: "I DAG" / "I GÅR" / uppercase weekday / lowercase long-date.

**StickyDateOverlay:**
- [ ] Date pill stays pinned at top of list while scrolling through older messages.
- [ ] Inline divider disappears when overlay is active (no duplicate pill).
- [ ] No sticky pill visible when at the bottom of a single-day thread.

**TypingIndicator:**
- [ ] Appears above composer when another user is typing.
- [ ] Label format: "Anna skriver…" / "Anna og Bob skriver…" / "3 personer
  skriver…"
- [ ] Disappears within ~3s after typing stops.

**ReactionBar:**
- [ ] Appears above the selected bubble after long-press.
- [ ] Six emojis: 👍 ✅ 👀 🔥 ⚠️ ❤️.
- [ ] Card-bg pill with hairline border and shadow.
- [ ] Dismisses cleanly on tap outside or on reaction selection.

**Step 3 verdict: NEEDS-PWA-MANUAL**

---

## Step 4 — Gesture-Recognizer Conflict Check

Cannot be performed from code inspection alone. All items require PWA touch
testing.

### Static analysis

**`activeOffsetX: [-10, 10]`** is set on the pan gesture in both
`MessageBubble` and `ChannelMessageBubble`. This gates horizontal pan
recognition until 10px of horizontal travel — preventing accidental pan
activation on vertical scroll or tap.

**`Gesture.Simultaneous(panGesture, longPressGesture)`** is used so both
gesture recognizers can be active at the same time. This prevents the
long-press from blocking the pan during a press-and-drag sequence.

**Direction clamping** is implemented via `isOwnSV`:
- Own messages: `Math.max(0, raw)` clamps negative X to 0 (no left swipe).
- Other messages: `Math.min(0, raw)` clamps positive X to 0 (no right swipe).

### PWA test checklist

| Gesture | Test action | Expected | To verify |
|---|---|---|---|
| Swipe-to-reply (own) | Swipe right on own bubble | Bubble moves right, icon fades left, springs back | [ ] |
| Swipe-to-reply (other) | Swipe left on other bubble | Bubble moves left, icon fades right, springs back | [ ] |
| Wrong-direction guard (own) | Swipe left on own bubble | No translation, no feedback | [ ] |
| Wrong-direction guard (other) | Swipe right on other bubble | No translation, no feedback | [ ] |
| Long-press | Hold 300ms | Scale 1.05, ReactionBar appears | [ ] |
| Long-press then pan | Hold then drag | Scale resets, no unintended swipe reply | [ ] |
| Diagonal scroll | Swipe up/down at slight angle | FlatList scrolls, bubble does not translate | [ ] |
| FlatList vertical scroll | Fast vertical scroll | Smooth scroll, no bubble translate | [ ] |

**Step 4 verdict: NEEDS-PWA-MANUAL**

---

## Overall Audit Verdict

**AMBER** — no FAIL found in code inspection; all Steps 2–4 require human
PWA verification before the overall verdict can be upgraded to GREEN.

### Summary

| Step | Verdict | Evidence |
|---|---|---|
| 1. Token resolved-value | PASS | `warnSoft` `#fceedb` ≠ `muted` `#f5f3f0`. T8 collision resolved. No active collision in Phase 1+2 state. |
| 2. Motion timing | NEEDS-PWA-MANUAL | APIs correct: `springSnappy` used for all gesture springs; `FadeIn/FadeOut` with token durations for fades. |
| 3. Side-by-side reference | NEEDS-PWA-MANUAL | Cannot compare WhatsApp parity without opening PWA. |
| 4. Gesture conflict | NEEDS-PWA-MANUAL | `activeOffsetX`, direction clamping, and `Gesture.Simultaneous` all implemented. Runtime behavior requires touch testing. |

### NEEDS-PWA-MANUAL surfaces count: 7

| Surface | Step | PWA test action |
|---|---|---|
| Swipe return spring | 2 | Swipe right/left on bubble, observe spring back |
| Long-press scale | 2 | Hold bubble 300ms, observe 1.05 scale |
| ReactionBar enter | 2 | Long-press, observe FadeInDown springify |
| ReactionBar exit | 2 | Tap reaction, observe 200ms fade-out |
| TypingIndicator fade | 2 | Trigger from second session, observe 500ms in / 250ms out |
| StickyDateOverlay scroll | 2 + 3 | Scroll long thread, observe sticky date pin |
| Gesture conflict check | 4 | All 8 gesture scenarios in Step 4 table |

---

## Phase 1 Token-Collision — Canonical Trap Signature

Documented for posterity and ADR-0338 reference:

**Trap:** `secondary` and `muted` shared hex `"#f5f3f0"` in light mode.
`MessageBubble` used `secondary` for own-bubble background and `muted` for
other-bubble background. Both rendered the same gray. Own messages were
visually indistinguishable from other messages.

**Detection:** Pontus noticed during PWA inspection (no automated detection).
TypeScript type-checking passes because both are valid token names.

**Fix:** T8 (commit `11354f317`) — replaced `secondary` with `warnSoft`
(`"#fceedb"`) for own-bubble background in both `MessageBubble` and
`ChannelMessageBubble`. Same fix applied in both files in the same commit.

**Prevention:** Step 1 of this methodology — build the collision table before
any Phase close. Any token pair resolving to the same hex in the same visual
role is a FAIL that blocks merge.
