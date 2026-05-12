---
title: "Journey — Manager publishes targeted announcement"
feature: nyheter-engagement-wave-a
journey: manager-publishes-targeted-announcement
status: verified
verified_at: 2026-05-12
e2e_test: apps/e2e/komm-nyheter/journey-2-audience-targeting.spec.ts
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [journey, audience-targeting, compose]
---

# Journey: Manager publishes targeted announcement

**Role:** manager (or admin / owner)

**Precondition:**
- Manager logged in to web dashboard at `/dashboard/komm/nyheter`
- Workspace has at least one department + one role + one active employee profile
- News channel exists for workspace (auto-created on first publish if missing)

## Happy Path

1. Manager clicks "Ny kunngjøring" → ComposeAnnouncement Sheet opens (right-side slide)
2. Manager fills `Tittel` field → input accepts text
3. Manager fills `Melding` field → textarea auto-resizes
4. Manager clicks "Avdeling" segment in AudiencePicker → segment becomes active (`bg-card`, brand-orange icon)
5. Drilldown grid renders 2-column dept tiles → manager picks "Bar" tile → tile gets brand-border + ring + tinted bg
6. RecipientCountPill bumps to show count of bar-staff profiles via `useAudienceResolver({ kind: "department", departmentIds: [...] })`
7. Manager clicks "Publiser" → `useSendAnnouncement.mutate` fires
8. INSERT into `channel_message` with `message_type='announcement'`, `visibility_scope='targeted_members'`, `target_profile_ids=[bar-staff ids]`, `system_data.audience_kind='department'`
9. Toast: "Publisert" → Sheet closes → feed refreshes → new card appears at top
10. RLS `channel_message_jwt_select` filters the row to bar-staff members + sender; non-targeted profiles never receive it

**Postcondition:**
- `channel_message` row visible only to targeted profiles (verified via service-role + alternate-user JWT in unit test of SELECT policy)
- `notification_outbox` row created per targeted profile with `priority=1, mode='work'`
- Telemetry `channel.message.sent` emitted with `audience_kind='department'`, `target_profile_count=N`, `visibility_scope='targeted_members'`

## Error Paths

- **Empty title:** publish button disabled
- **Audience picker on Department/Role/Individuals with empty selection:** `recipientCount===0` → publish disabled, RecipientCountPill switches to muted tone
- **Workspace has no departments yet:** Department drilldown renders empty grid; manager must use "Alle" or pick another segment
- **INSERT fails (RLS or network):** toast "Publisering feilet" → Sheet stays open with values intact

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (`apps/e2e/komm-nyheter/journey-2-audience-targeting.spec.ts`)
- [ ] Manually tested end-to-end on dev workspace `Strøm Mat & Bar`

**Mark `status: verified` in frontmatter when all three boxes are checked.**
