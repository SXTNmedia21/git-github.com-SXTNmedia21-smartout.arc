---
title: "Handoff — chat-whatsapp-phase2"
feature: chat-whatsapp-phase2
branch: feat/mobile-chat-whatsapp-phase2
closed: 2026-05-16
module: mobile
---

# Handoff — chat-whatsapp-phase2

> Sub-sortie under `campaign/mobile`. 10 commits.

## Summary

Full WhatsApp-feel mobile chat — motion (swipe-reply, sticky dividers, long-press scale-spring, ReactionBar fade) + presence (typing indicator, delivered-state ack) + cleanup (DELETE sub on read receipts). 6 of 7 planned tracks shipped; T7 (E2E) deferred to dedicated Phase 3 sortie since framework is greenfield.

## Commits

| SHA | Track | Scope |
|---|---|---|
| `b65f2db75` | T6 | DELETE subscription on channel_message_read with multi-reader readerIndex |
| `f3a9c5e7e` | T1 | Swipe-to-reply Pan gesture (48px threshold, springSnappy back, CornerUpLeft reveal) |
| `601acb562` | T2 | Sticky date dividers (Path B absolute overlay — inverted FlatList + web invalidates Path A) |
| `54ec90ded` | T4 | Typing presence via Supabase broadcast (2s debounce / 4s expiry) |
| `2cbceb923` | T3 | Long-press scale-spring + ReactionBar FadeInDown.springify |
| `731cc9d43` | T5 | Delivered-state ack via presence-join broadcast on chat-presence channel |
| `d0c4a03dd` | T10 | T8/T9 review fixes — channel-leak x2 + worklet sharedValue + token namespace + journey drift + ADR-0334 |

## Journeys Delivered

| Journey | Status | E2E test |
|---|---|---|
| chat-phase2-swipe-reply | verified | none (Phase 3 sortie) |
| chat-phase2-sticky-divider | verified | none (Phase 3 sortie) |
| chat-phase2-long-press-react | verified | none (Phase 3 sortie) |
| chat-phase2-typing-indicator | verified | none (Phase 3 sortie) |
| chat-phase2-delivered-state | verified | none (Phase 3 sortie) |

## Decisions Made

| Decision | Reason | Impact |
|---|---|---|
| G1 typing path: broadcast | No migration needed, ephemeral by design fits typing semantics | No schema change, no RLS surface change |
| G1 delivered path: broadcast presence-join | `channel_message.delivered_at` doesn't exist; migration would be heavy for ephemeral state | Same |
| G1 T7 E2E: DEFER to Phase 3 | Greenfield framework choice (Detox vs Maestro vs Playwright) is its own scope | Phase 2 ships 6 tracks not 7 |
| T2 sticky: Path B absolute overlay | `stickyHeaderIndices` defeated by `scaleY(-1)` web inversion of inverted FlatList | Inline divider gets opacity:0 to preserve height (no jump) |
| Two-channel pattern per conversation | Separate `chat-receipts:` (postgres_changes) + `chat-presence:` (broadcast) keeps concerns clean | Documented in ADR-0334 |
| ADR-0334 — Ephemeral presence via broadcast vs durable channel_presence table | Pattern decision worth codifying before copy-paste to next presence feature | Future presence features (online status, video participants) decide table vs broadcast against this rubric |

## Learnings

| Learning | Context |
|---|---|
| **Two tokens with identical resolved colors = invisible visual bug** (carry-forward from Phase 1) | T2 picked `secondary === muted` in Phase 1; T8/T9 audits passed because they checked token NAMES not RESOLVED VALUES. Future review pattern: side-by-side resolved-color check on visual surfaces. |
| **Supabase `channel()` calls leak if not paired with `removeChannel`** | T8 caught this in `use-emit-typing` (channel per 2s emit) and `ConversationBody` T5 (channel per feed change). Pattern: always create channel via `useEffect`, store in `useRef`, cleanup. T10 fixed both. |
| **Reanimated worklets capture JS-thread closures at gesture-object construction time** | T8 caught `isOwnMessage` capture. Result: gesture object re-created every render, native recognizer torn down/rebuilt. Fix: store direction in `useSharedValue`. |
| **`@smartout/design-tokens` (web tokens.ts) ≠ `@smartout/design-tokens/native` (native.ts)** | T8 caught TypingIndicator imported from web tokens. Native components MUST import from `/native` path. Pattern: native tokens may be missing values present in web (T10 added `motion.enterMs`/`exitMs` to native to mirror web). |
| **`stickyHeaderIndices` broken on inverted FlatList + RN-web** | T2 chose Path B absolute overlay early. Saved iteration cycles. Pattern: assume sticky-on-inverted needs fallback. |
| **High-frequency presence events need logger-only telemetry destinations** | T4 added `chat typing` with destinations `["logger"]` only (no posthog, no activity_trail). Pattern: typing-frequency events would pollute analytics + waste audit-trail storage. |
| **Multi-reader DELETE semantics need readerIndex** | T6 added per-message reader Set. Removing one reader only regresses `read → sent` when LAST reader removed. Naive "drop on any DELETE" would over-regress. |

## Known Issues / Debt

- **E2E tests still missing for Phase 1 + Phase 2 journeys (8 total).** T7 deferred — needs Phase 3 sortie to choose framework (Detox vs Maestro vs Playwright PWA path) + set up tooling + write first tests.
- **Reply persistence is local state only.** `channel_message.replied_to_message_id` column doesn't exist. Phase 3 candidate: migration + UI for quoted-reply display in receiver's bubble.
- **`ConversationScreen.tsx:131-136` LiveKit auto-camera bug** still present (surfaced Phase 1 PWA verification). Browser PWA emits `NotReadableError` on every chat open. NOT chat-whatsapp scope — needs separate fix gated by call state, not just flag.
- **Phase 2 PWA visual verification deferred.** T8 code-review + T9 steward audit both passed on code shape. Side-by-side PWA comparison vs WhatsApp screenshot not done. Recommend before Phase 3 motion polish.
- **`channel_presence` table still unused.** Per ADR-0334 it's reserved for future durable status work (online/away/offline) — not blocking.

## Next Steps

- **Phase 3 sortie candidates** (in priority order):
  1. E2E test setup + 8 journey coverage (Detox or Maestro — ADR + tooling + tests)
  2. Reply persistence (`replied_to_message_id` column + receiver-side quote display)
  3. LiveKit auto-camera bug fix (`ConversationScreen.tsx:131-136`)
  4. Chat settings/admin (mute, archive, invite, member-role) — surfaced Phase 1 as Phase 4 scope
  5. Visual PWA verification + WhatsApp-feel polish round (likely small motion-tuning sortie)
- **ADR-0334 status: proposed** — promote to `accepted` after first downstream presence feature validates the pattern.
