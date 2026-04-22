---
title: "Reassignment mutations must demote the prior holder"
id: LEARNING_0080
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [channel-member, helpdesk, reassignment, upsert-trap]
---

# Learning-0080: Reassignment mutations must demote the prior holder

## Context

`updateDeskResponsible` (desks admin Server Action) upserted the new rep
into `channel_member` with `role = 'representative'` but never touched
the previous rep's row. Across multiple reassignments, a single desk
accreted ghost representatives — every past holder stayed a
`channel_member` with the elevated role, leaking ownership symbols
(avatar chips, "I'm responsible" filters, notification routing) forever.

## Discovery

Whenever a domain uses a single-owner pattern backed by a
many-to-many membership table, the **"assign new"** half of reassignment
is only half the transaction. The **"demote old"** half must be explicit.
Upsert-on-conflict semantics only cover the new holder's row — the prior
holder's row is untouched.

Three classes of fix exist, pick based on whether historical membership
matters:

1. **Demote to `member`** (chosen here): preserves message authorship,
   reactions, and historical channel-access. Right when the person
   should remain in the channel but no longer represents it.
2. **Delete the membership row**: right when representation was the
   only reason for membership (e.g. role-based channels).
3. **Mark inactive via a dedicated column**: right when you need an
   audit trail of who held the role when.

## Impact

Apply this rule to every future "change holder" mutation across the
codebase: shift swap (reassign `schedule_shift.profile_id`), desk
reassignment, department manager change, team leader change. Each
should answer two questions, not one:

- Where does the new holder land?
- What happens to the old holder?

If the code only answers question 1, the table accretes ghosts.

## References

- `apps/web/src/app/dashboard/komm/desks/_actions/desk-actions.ts::updateDeskResponsible` — fix applied via commit `1c20680a`.
- Related pattern: shift swap reassignment, department manager change.
