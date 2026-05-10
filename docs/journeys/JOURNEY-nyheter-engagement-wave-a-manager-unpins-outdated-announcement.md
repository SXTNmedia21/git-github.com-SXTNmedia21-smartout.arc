---
title: "Journey — Manager unpins outdated announcement"
feature: nyheter-engagement-wave-a
journey: manager-unpins-outdated-announcement
status: draft
verified_at: null
e2e_test: apps/e2e/komm-nyheter/journey-3-pin-unpin-realtime.spec.ts
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [journey, unpin, server-action]
---

# Journey: Manager unpins outdated announcement

**Role:** manager (or admin / owner)

**Precondition:**
- Manager logged in to `/dashboard/komm/nyheter`
- At least one pinned announcement exists (`is_pinned=true` for current workspace)
- Manager has `role IN ('manager', 'admin', 'owner')`

## Happy Path

Two unpin entry points:

**Entry A — Strip-side inline button:**
1. Manager hovers a chip in PinnedStrip → inline "Løsne" button visible bottom-right of chip (only when `canManage=true`)
2. Manager clicks "Løsne" → `usePinMessage.mutate({ messageId, channelId, pin: false, profileId })` fires
3. Server Action UPDATE writes `is_pinned=false, pinned_by=null, pinned_at=null`
4. Toast: "Løsnet" → mutation invalidates messages → refetch
5. Chip animates out of strip; if last pin removed, entire PinnedStrip fades out via `motion.div` exit transition
6. Pinned marker (amber Pin icon) disappears from main feed card

**Entry B — Card menu:**
1. Manager clicks `MoreVertical` on pinned NewsCard → menu shows "Løsne" (instead of "Fest øverst") because `isPinned=true`
2. Manager clicks "Løsne" → same mutation path as Entry A

**Postcondition:**
- `channel_message.is_pinned=false`, `pinned_by=null`, `pinned_at=null`
- Telemetry `channel.message.unpinned` emitted with `message_id` + `channel_id`
- `activity_trail` row exists with `event_name='channel.message.unpinned'`, `entity_id=message_id` (audit symmetry with pinned per Pre-task A.2.3)

## Error Paths

- **Caller is employee:** Server Action returns role error → no DB write
- **Network failure:** mutation onError → toast shows error
- **Concurrent unpin (two managers click "Løsne" simultaneously):** UPDATE is idempotent on `is_pinned=false`; second call succeeds without effect, second telemetry row still emits (acceptable double-audit)

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (`apps/e2e/komm-nyheter/journey-3-pin-unpin-realtime.spec.ts` — second test case)
- [ ] Manually tested both entry points (strip inline + card menu) on dev workspace

**Mark `status: verified` in frontmatter when all three boxes are checked.**
