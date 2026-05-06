---
title: "Journey — Manager Acts on Overdue Ticket"
status: verified
feature: helpdesk-sla-timeout
updated: 2026-04-28
created: 2026-04-28
module: Helpdesk
tags: [journey, helpdesk, sla, manager, observer]
---

# Journey — Manager Acts on Overdue Ticket (J3)

Manager (workspace observer) reacts to an SLA-breached ticket they were notified about.

## Precondition

- Manager logged in. `profile.role='manager'` (or `'admin'` / `'owner'`). Authority `engine_authority_config` rows resolve them as the helpdesk observer.
- At least one ticket has fired SLA breach (J1 completed). Manager has received a chat notification (entry in `activity_trail`).
- Manager navigates to `/dashboard/komm` from the notification or directly.

## Happy Path

1. Manager opens `/dashboard/komm`. → System: renders sidebar + Min kø + channel list.
2. Manager spots the breached desk row in MinKoSection (calm "Forfalt" pill). → User sees: "HR-skranken — 5 åpne · Forfalt".
3. Manager clicks the desk to enter the channel view. → System: navigates to `/dashboard/komm/[channelId]`.
4. Channel view lists open tickets. → System: TicketHeader for each open ticket shows "Forfalt" pill when `context.sla_breached_at` populated.
5. Manager opens the breached ticket thread. → System: renders thread + TicketHeader with breach badge + breach timestamp tooltip.
6. Manager replies in chat OR clicks resolve. → System: emits `helpdesk.query.message_sent` (reply) OR `helpdesk.query.resolved` (resolve). Resolve marks linked `engine_delayed_trigger.status='cancelled'` (defensive — already fired, but cleans up state).
7. On resolve: `engine_state.status='complete'`, ticket drops from Min kø on next poll, badge disappears.

## Postcondition

- One reply OR resolve action recorded in `engine_event` + `activity_trail`.
- Resolved ticket: no longer in MinKoSection, `engine_state.status='complete'`.
- Linked `engine_delayed_trigger` is `status IN ('fired', 'cancelled')` — never `'pending'` after resolve.
- No new SLA breach event possible for this ticket.

## Error Paths

**E1. Manager not the observer.**
- Effect: notification went to wrong profile.
- Recovery: out-of-scope for this journey (authority misconfig). Tracked as separate concern; J3 assumes correct observer resolution from authority.

**E2. Manager resolves a ticket that another rep already resolved.**
- Effect: idempotent — second resolve emit no-ops because `engine_state.status='complete'` already.
- Recovery: UI shows toast "Allerede løst". Defensive Server Action check.

**E3. Reassign action (deferred from Phase 1).**
- Effect: Phase 2 does NOT add reassign UI. Manager can only reply or resolve.
- Recovery: documented as Phase 3 follow-up. Manager workaround: resolve + open new ticket to a different rep.

**E4. Tooltip shows wrong breach timestamp.**
- Effect: tooltip reads from `context.sla_breached_at`. If column not populated (computed-overdue case from J2 E3), tooltip falls back to "Mer enn 72t siden åpnet".
- Recovery: tooltip text differs deterministically based on data presence. E2E covers both.
