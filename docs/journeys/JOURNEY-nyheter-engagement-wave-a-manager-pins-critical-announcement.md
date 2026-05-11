---
title: "Journey — Manager pins critical announcement"
feature: nyheter-engagement-wave-a
journey: manager-pins-critical-announcement
status: draft
verified_at: null
e2e_test: apps/e2e/komm-nyheter/journey-3-pin-unpin-realtime.spec.ts
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [journey, pin, server-action, realtime]
---

# Journey: Manager pins critical announcement

**Role:** manager (or admin / owner)

**Precondition:**
- Manager logged in to web dashboard at `/dashboard/komm/nyheter`
- At least one announcement card visible in feed
- Manager has `role IN ('manager', 'admin', 'owner')` in current workspace

## Happy Path

1. Manager hovers a NewsCard → top-right `MoreVertical` (32×32) button visible
2. Manager clicks `MoreVertical` → DropdownMenu opens with motion fade-in
3. Menu shows "Fest øverst" / "Send påminnelse" (placeholder) / "Se hvem som har lest" (placeholder) / separator / "Slett" (destructive)
4. Manager clicks "Fest øverst" → `usePinMessage.mutate({ messageId, channelId, pin: true, profileId })` fires
5. `pinMessageAction` Server Action: `resolveCurrentProfile` derives profile from JWT → workspace match check → role guard `["manager", "admin", "owner"]` → `createAdminClient` UPDATE on `channel_message` with `is_pinned=true, pinned_by=profile.id, pinned_at=now()` filtered by `id` AND `workspace_id`
6. Toast: "Festet øverst" → mutation invalidates `channelKeys.messages` → feed refetches
7. PinnedStrip animates in at top of feed via `motion.div` spring (initial `{opacity:0, y:-10, maxHeight:0}` → `{opacity:1, y:0, maxHeight:200}`)
8. Pinned NewsCard gains amber `Pin` icon top-right (offset to left of menu button)
9. Realtime via `useChannelRealtime` fans `UPDATE` event to all open Nyheter sessions; PinnedStrip appears in other tabs within ~500ms

**Postcondition:**
- `channel_message.is_pinned=true`, `pinned_by=manager_profile_id`, `pinned_at=<recent>`
- Telemetry `channel.message.pinned` emitted with `message_id` + `channel_id`
- `activity_trail` row exists with `event_name='channel.message.pinned'`, `entity_id=message_id`

## Error Paths

- **Caller is employee (not manager):** Server Action returns `{ ok:false, reason:"Insufficient role" }` → toast shows error, no DB write
- **Caller workspace mismatches body workspace:** Server Action returns `{ ok:false, reason:"Workspace mismatch" }` → no DB write
- **Network failure:** mutation onError fires → toast shows error message

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (`apps/e2e/komm-nyheter/journey-3-pin-unpin-realtime.spec.ts` — first test case)
- [ ] Manually tested end-to-end on dev workspace `Strøm Mat & Bar`

**Mark `status: verified` in frontmatter when all three boxes are checked.**
