---
title: Visual Verification — Mobile UI
status: in_progress
created: 2026-05-16
updated: 2026-05-16
module: mobile
tags: [mobile, design-tokens, visual-verification, ADR-0338, quality-gate]
---

# Visual Verification — Mobile UI

Methodology document mandated by ADR-0338 (proposed). Codifies four inspection
steps required after any mobile UI change that touches design tokens, motion, or
gestures. Run before merging a Phase that adds or modifies a visual surface.

---

## When to Run

Run this checklist when any of the following are true:

- A Phase closes that adds or modifies token-driven color surfaces (bubble
  backgrounds, receipt indicators, dividers, overlays).
- A Phase closes that introduces or changes animation (spring, fade, gesture).
- A sortie builds visual surface on top of work that has not yet been
  PWA-verified.
- A new component imports from `@smartout/design-tokens/native` for the first
  time.
- Any change touches `packages/design-tokens/src/native.ts`.

Do not substitute a typecheck pass for this checklist. TypeScript cannot detect
token-collision (two differently-named tokens resolving to the same hex value)
or spring approximation (CSS falling back where Reanimated is expected).

---

## Step 1 — Token Resolved-Value Audit

**Goal:** Catch token-collision — two tokens resolving to the same hex value in
a context where they are intended to produce visually distinct surfaces.

**Canonical trap (Phase 1 class):** `colors.secondary` and `colors.muted` both
resolved to `"#f5f3f0"` in light mode. Any component using `secondary` for an
own-bubble background and `muted` for an other-bubble background produced
visually identical bubbles. The T8 fix replaced `secondary` with `warnSoft`
(`"#fceedb"`) for own bubbles — a meaningfully different hex.

### Procedure

1. Open `packages/design-tokens/src/native.ts` (campaign/mobile version).
2. For each token used in the target components, record the actual hex value
   from the `light` block (primary theme mode for audit; dark mode is
   secondary).
3. Build a collision table: group tokens by resolved hex and flag any group
   with more than one token name that appears in the same visual role.
4. Alternatively, run:

```
grep -n '"#' packages/design-tokens/src/native.ts | sort -t'"' -k4
```

to sort tokens by hex value and visually scan for duplicates.

### Document

For each audited component, record a table:

| Token name | Hex (light) | Role | Collision? |
|---|---|---|---|
| `warnSoft` | `#fceedb` | Own bubble background | No |
| `muted` | `#f5f3f0` | Other bubble background | No |
| ... | ... | ... | ... |

**Pass:** No two tokens used in the same visual role resolve to the same hex.
**Fail:** One or more collision pairs found. Name the pair and the hex.

---

## Step 2 — Motion Timing Audit

**Goal:** Confirm spring physics are applied at runtime, not falling back to a
CSS approximation (PWA) or to Reanimated defaults.

**Canonical trap:** On PWA, `react-native-reanimated` renders via CSS
approximation. A spring configured with `springSnappy` (`stiffness: 45,
damping: 24, mass: 2`) should produce a slow, critically-damped rebound (not
an underdamped bounce). If the motion feels mechanical or instant, CSS
approximation may have silently replaced the spring.

**`springSnappy` spec (from `nativeTheme.motion`):**

| Key | Value | Feel |
|---|---|---|
| `stiffness` | 45 | Slow spring |
| `damping` | 24 | Critically damped |
| `mass` | 2 | Heavy — no bounce |

### Procedure

For each animated surface:

1. Trigger the motion (swipe, long-press, fade-in, fade-out, sticky swap).
2. Observe the motion character:
   - **Swipe return:** Should feel like releasing a rubber band — slow glide
     back to zero, no bounce.
   - **Long-press scale:** `1.0 → 1.05` on press, spring back `1.05 → 1.0`
     on release. Should feel weighted, not instant.
   - **ReactionBar enter:** `FadeInDown.springify()` — slides up from below
     with opacity 0→1, spring character (slight overshoot is acceptable).
   - **TypingIndicator enter/exit:** `FadeIn.duration(500)` / `FadeOut.duration(250)`.
     Should be a plain opacity fade, not spring.
3. Time with a mental stopwatch or browser DevTools performance trace.
   - Swipe return to rest: expect 400–800ms (heavy spring, slow settle).
   - Scale spring: expect 200–400ms.
   - Typing fade-in: expect ~500ms.
   - Typing fade-out: expect ~250ms.

### Document

| Surface | Expected motion | Observed character | Duration estimate | PASS/FAIL |
|---|---|---|---|---|
| Swipe return | Heavy spring (no bounce) | — | — | NEEDS-PWA-MANUAL |
| Long-press scale | Weighted spring | — | — | NEEDS-PWA-MANUAL |
| ReactionBar enter | springify fade-up | — | — | NEEDS-PWA-MANUAL |
| TypingIndicator enter | 500ms fade | — | — | NEEDS-PWA-MANUAL |
| TypingIndicator exit | 250ms fade | — | — | NEEDS-PWA-MANUAL |

**Pass:** Motion character matches spec within reasonable tolerance (±50ms for
fades; spring feel matches description).
**Fail:** Motion is instant, mechanical, or bounces when it should not.

---

## Step 3 — Side-by-Side Reference Comparison

**Goal:** Detect visual gaps from the design reference used during
implementation. For chat-whatsapp work, the reference is WhatsApp (iOS/Android).

### Procedure

1. Open the PWA (`localhost:8083`) in a browser window.
2. Open the reference app (WhatsApp) side-by-side on the same screen or a
   second device.
3. Navigate to a conversation with mixed own-and-other messages, reactions, and
   read receipts on both surfaces.
4. Compare core surfaces one by one:
   - Own bubble: background color, corner radii, timestamp + receipt position.
   - Other bubble: background color, avatar, sender name, corner radii.
   - Read receipt icons: pending/sent/delivered/read states.
   - Date divider: pill shape, label format, position.
   - Sticky date overlay: pin behavior during scroll.
   - Typing indicator: position, label format, animation.
   - ReactionBar: position relative to bubble, emoji set, dismiss behavior.

### Document

| Surface | Reference behavior | PWA behavior | Match? | Gap description |
|---|---|---|---|---|
| Own bubble | Warm off-white bg, BR corner = 4pt | — | — | NEEDS-PWA-MANUAL |
| Other bubble | Light gray bg, BL corner = 4pt | — | — | NEEDS-PWA-MANUAL |
| ... | ... | ... | ... | ... |

**Pass:** No visible gap that would break the WhatsApp-feel contract.
**Fail:** Surface looks meaningfully different from reference in a way that
degrades the WhatsApp-feel intent.

---

## Step 4 — Gesture-Recognizer Conflict Check on PWA

**Goal:** Detect gesture-handler vs FlatList scroll competition on PWA touch
events. On PWA, `react-native-gesture-handler` dispatches via the web Pointer
Events API. FlatList vertical scroll is handled by the browser. Competition
produces situations where a swipe attempt triggers unwanted vertical scroll, or
a long-press fires a pan.

### Procedure

1. Open the PWA on a touch device or use browser DevTools touch emulation.
2. For each gesture, perform the action and observe:

**Horizontal pan (swipe-to-reply):**
- Swipe right on an own message. Expect: bubble translates right, reply icon
  fades in on left, springs back on release.
- During swipe, observe if the list scrolls vertically. Expect: no vertical
  scroll while panning horizontally.
- Swipe left on an own message. Expect: no translation (wrong direction
  clamped to 0).

**Long-press:**
- Long-press a bubble. Expect: scale 1.05 spring, ReactionBar appears.
- Observe if a pan fires accidentally. Expect: no pan fires during a
  stationary long-press.

**Concurrent gesture:**
- Start a long-press then move finger slightly. Expect: scale resets on
  finalize, no unintended pan recognizer win.

**FlatList scroll during swipe:**
- Begin a diagonal swipe (mostly horizontal, slight vertical). Expect:
  `activeOffsetX: [-10, 10]` should gate pan recognition so the FlatList
  retains vertical scroll on diagonal input.

### Document

| Gesture | Test action | Expected outcome | Observed outcome | PASS/FAIL |
|---|---|---|---|---|
| Swipe-to-reply (own) | Swipe right | Bubble moves, springs back | — | NEEDS-PWA-MANUAL |
| Swipe-to-reply (other) | Swipe left | Bubble moves, springs back | — | NEEDS-PWA-MANUAL |
| Long-press | Hold 300ms | Scale + ReactionBar | — | NEEDS-PWA-MANUAL |
| Diagonal swipe | Mostly horizontal | Scroll wins | — | NEEDS-PWA-MANUAL |
| FlatList vertical scroll | Swipe up/down | List scrolls, no bubble translate | — | NEEDS-PWA-MANUAL |

**Pass:** All gestures respond as specified with no cross-contamination.
**Fail:** A gesture triggers an unintended peer gesture, or FlatList scroll
competes with horizontal pan.

---

## Output Format

Produce an audit document at:

```
docs/audits/<YYYY-MM-DD>-<feature>-visual-audit.md
```

Each step produces a table with status: `PASS`, `FAIL`, or `NEEDS-PWA-MANUAL`.

- `PASS` — verified by code inspection (token hex match, correct token name,
  correct animation API call).
- `FAIL` — verified by code inspection that something is wrong (collision
  found, wrong token, missing animation call).
- `NEEDS-PWA-MANUAL` — cannot be verified from code alone; requires human to
  open PWA and observe.

Mark the overall audit verdict as one of:

- `GREEN` — all inspectable steps PASS; no FAIL; manual steps enumerated.
- `AMBER` — one or more steps are NEEDS-PWA-MANUAL; no FAIL.
- `RED` — one or more steps are FAIL.

Document any `RED` findings with: file path, line number or code excerpt,
exact collision or error, and recommended fix.

---

## Frequency

| Trigger | Mandatory |
|---|---|
| Close a Phase that adds visual surface | Yes |
| Merge a sortie touching `native.ts` | Yes |
| Merge a sortie touching any chat/bubble/receipt component | Yes |
| Pre-audit before building new visual surface on top | Yes |
| Routine development with no visual change | No |

---

## Appendix — Token Quick-Reference (light mode)

Tokens most commonly used in chat surfaces. Verify hex values match this table
before shipping.

| Token | Expected hex (light) | Design intent |
|---|---|---|
| `warnSoft` | `#fceedb` | Own bubble background — warm cream, distinct from muted |
| `muted` | `#f5f3f0` | Other bubble background, system pill background, DateDivider |
| `foreground` | `#1c1814` | Primary text on both bubble types |
| `mutedForeground` | `#7a756e` | Timestamps, sender names, pending/sent/delivered receipt icons, reply icons |
| `brandOrange` | `#f97316` | Read receipt (read state), reply indicator border (other bubble) |
| `border` | `#e8e5e1` | Reply indicator border (own bubble), reaction pill border |
| `card` | `#fdfcfa` | Reaction pill background, ReactionBar background |
| `scrim` | `rgba(0,0,0,0.3)` | Video thumbnail overlay |
| `secondary` | `#f5f3f0` | Same hex as `muted` — DO NOT use for own-bubble background |
