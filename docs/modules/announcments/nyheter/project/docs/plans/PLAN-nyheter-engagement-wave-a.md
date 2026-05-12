# PLAN — Nyheter Engagement Wave A

Slug: nyheter-engagement-wave-a
Branch: feat/nyheter-engagement-wave-a
Surface: web only (/dashboard/komm/nyheter) + 1 trigger migration
Effort: S+M+M (~1–1.5 days)

## Problem
1. Push fatigue — `trg_channel_message_notification` hardcodes priority=0/mode='community' for every channel_message insert.
2. Dead column — `channel_message.target_profile_ids` exists + RLS filters on it, but compose UI only offers "All".
3. Inert pin state — `is_pinned`, `pinned_by`, `pinned_at` columns + telemetry events registered, no UI surface.

## Items
- **A** — trigger migration: branch on `message_type='announcement'` → priority=1, mode='operational'.
- **B** — ComposeAnnouncement audience picker (All / On duty / Department / Role / Individuals) + RecipientCountPill (extract from QuickBroadcast).
- **C** — NewsCard overflow menu (manager+) with Fest øverst / Løsne + sticky PinnedStrip with motion.spring entry.

## Sequencing (5 commits on feat/nyheter-engagement-wave-a)
1. Migration (Item A).
2. Extract RecipientCountPill.
3. Wire ComposeAnnouncement audience picker.
4. Pin mutation hook.
5. PinnedStrip + NewsCard menu UI.

## Acceptance / journeys
See full source spec — manager publishes targeted op-priority announcement; manager pins → strip fans out via realtime within 500ms; employee sees strip on next session; unpin clears state.

## Untouchable
- packages/ai capability tools (separate ADR work)
- packages/ai gatedMutation
- mobile 5-tab layout + digest screen
- existing realtime + auto-mark-as-read blocks (just shipped)
- telemetry registry (all events pre-registered)

## Verification
typecheck zero, `supabase db reset` clean, e2e spec covers RLS + priority + pin-realtime, manual smoke on dev workspace Strøm Mat & Bar, HANDOFF doc.

## Open recommendations after close
- ADR for sendMessage ADR-0287 retrofit (prereq for Botsson publishAnnouncement)
- ADR for entity-ref pattern in notification_outbox.metadata
- Sortie: feat/mobile-nyheter-strip
- Sortie: ReadReceipt aggregation (after RPC scope decision)
