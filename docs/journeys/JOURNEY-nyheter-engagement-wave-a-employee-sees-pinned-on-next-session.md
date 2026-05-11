---
title: "Journey — Employee sees pinned announcement on next session"
feature: nyheter-engagement-wave-a
journey: employee-sees-pinned-on-next-session
status: draft
verified_at: null
e2e_test: null
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [journey, pin, read-only, manual-verify]
---

# Journey: Employee sees pinned announcement on next session

**Role:** employee

**Precondition:**
- Employee logged in to web dashboard
- Workspace has at least one pinned announcement (`channel_message.is_pinned=true` AND visible to employee per RLS)

## Happy Path

1. Employee navigates to `/dashboard/komm/nyheter` → page loads
2. PinnedStrip renders sticky at top of feed → header "Festet" + count + horizontally-scrollable chips
3. Each pinned chip shows: 3px left accent border in dept color, sender name as 10px uppercase meta, title line-clamped to 2 lines
4. Pinned NewsCard in main feed has amber `Pin` marker top-right
5. Employee can click a chip → smooth-scroll to that card in feed + 700ms warm highlight ring
6. Employee can click reactions on cards (existing functionality)
7. Auto-mark-as-read fires for newest message (existing behavior preserved from prior shipment)
8. Employee viewport does NOT show `MoreVertical` menu button on cards (manager-only via `canCompose=isAtLeast("manager")`)
9. Employee viewport does NOT show inline "Løsne" button on PinnedStrip chips (manager-only via `canManage` prop)

**Postcondition:**
- Employee sees pinned content but cannot mutate pin state
- `channel_member.last_read_message_id` advanced to newest message id (existing realtime + mark-as-read behavior)

## Error Paths

- **Pinned message is targeted away from this employee:** RLS `channel_message_jwt_select` blocks the row → PinnedStrip does NOT render that chip; main feed does NOT render the card. Employee sees a clean view without "ghost" pinned indicator.
- **Employee tries to invoke pin via DevTools:** menu component never renders, so even DOM injection fails the role guard at Server Action layer.

## Verification

- [ ] Implementation matches the steps above
- [ ] Manually tested end-to-end with employee fixture in dev workspace `Strøm Mat & Bar` (no E2E spec — auth-fixture work deferred per council 2026-05-11; manual smoke is the verification gate for this journey)
- [ ] DevTools-level role bypass attempt fails (manual security smoke)

**Mark `status: verified` in frontmatter when all three boxes are checked.**

## Notes

This journey has no E2E spec because `seedProfile` creates phantom `user_id` rows with no `auth.users` companion (see `apps/e2e/helpers/seed.ts:150`). Cross-user UI testing requires an auth-fixture sortie that's deferred. Manual verification gate covers it for Wave A.
