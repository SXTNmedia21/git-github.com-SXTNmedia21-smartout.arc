---
title: "Journey — Agent drafts announcement, human confirms, agent publishes"
feature: botsson-publishannouncement-capability
journey: agent-drafts-then-publishes
status: verified
verified_at: 2026-05-12
e2e_test: apps/e2e/komm-nyheter/agent-publish/journey-1-draft-then-publish.spec.ts
created: 2026-05-11
updated: 2026-05-12
module: MODULE_COMMUNICATION
tags: [journey, happy-path, two-call-pattern]
---

# Journey: Agent drafts announcement, human confirms, agent publishes

**Role:** Botsson agent + manager (workspace admin) in chat channel

**Precondition:**
- `communication` capability seeded in `engine_authority_config` with `level >= 'suggest'`
- `ctx.channel = "chat"` (not voice)
- At least one active profile in target audience

## Happy Path

1. User: "Compose announcement for bar staff: espressomaskinen byttes tirsdag morgen"
2. Agent invokes `publish_announcement` with `{ confirm: false, title, body, audience_kind: "department", departmentIds: [bar.id] }`
3. Tool execute(): voice-channel check (passes — chat), callGateAction (granted), server-side audience resolve → `{ profileIds: [bar staff], count: 3, label: "Bar (3)" }`
4. Tool returns `{ phase: "draft", target_profile_count: 3, audience_label: "Bar (3)", draft: { title, body } }` — NO raw profile_ids
5. Agent shows draft + count to user: "Klar til å sende til 3 bar-ansatte. Bekreft?"
6. User confirms
7. Agent invokes `publish_announcement` again with `{ confirm: true, title, body, audience_kind: ..., departmentIds: ... }`
8. Tool execute(): voice check + gate + resolve again, then INSERT into `channel_message`
9. Tool returns `{ phase: "published", message_id, target_profile_count: 3, audience_label: "Bar (3)" }`
10. emit `channel.message.sent` fires with `origin_type: "agent"`, audience props
11. Trigger writes `notification_outbox` priority=1 mode='work' per bar staff profile

**Postcondition:**
- `channel_message` row with `message_type='announcement'`, `visibility_scope='targeted_members'`, `target_profile_ids` populated, `sender_id = ctx.profileId`
- `notification_outbox` rows for each bar staff
- `activity_trail` rows for gate evaluation + message.sent
- Tool return strings contain ZERO raw profile_ids

## Error Paths

- User declines confirm → agent does not call publish_announcement again → no INSERT
- Tool called with `confirm: true` but draft never shown to user → tool still publishes (the gate-action audit trail captures this; future C4 four-eyes would block); acceptable for v1
- Audience resolves to 0 profiles → tool returns descriptive error, no INSERT

## Verification

- [ ] E2E spec passes
- [ ] Unit tests for both phases pass
- [ ] Manual smoke

**Mark `status: verified` when all 3 boxes checked.**
