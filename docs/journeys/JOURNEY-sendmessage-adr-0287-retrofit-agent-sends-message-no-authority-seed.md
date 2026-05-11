---
title: "Journey — Agent sends message, no authority seed (fail-closed)"
feature: sendmessage-adr-0287-retrofit
journey: agent-sends-message-no-authority-seed
status: draft
verified_at: null
e2e_test: packages/ai/src/capabilities/communication/__tests__/sendMessage.gate.test.ts
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [journey, default-deny, fail-closed, adr-0189, l-0066, l-0097]
---

# Journey: Agent sends message, no authority seed (fail-closed)

**Role:** Botsson agent in fresh / un-seeded workspace

**Precondition:**
- Workspace exists but `engine_authority_config` has NO row for `(workspace_id, capability='communication')`
- All other layers OK (channel_member exists, channel allows AI)

## Happy Path (default-deny)

1. Agent invokes `send_message` tool
2. `sendMessage.execute()` calls `callGateAction(... capability: "communication" ...)`
3. Gate looks up `engine_authority_config` row → finds NONE
4. Per ADR-0189 + L-0066 default-deny invariant: gate returns `{ outcome: "denied", reason: "default-deny-missing-seed" }` (NOT default-allow, which was the L-0066 CVE-class trap)
5. `sendMessage` execute() checks `outcome !== "granted"`, returns descriptive error: `"Authority not configured for communication capability in this workspace. Contact admin to seed engine_authority_config."`
6. NO channel_message INSERT
7. NO `channel.message.sent` emit
8. `gate.*` audit event records the denial with `outcome: "denied"`, `reason: "default-deny-missing-seed"`

**Postcondition:**
- Zero rows in `channel_message` for this attempt
- Zero `channel.message.sent` events
- ONE `gate.denied` event recorded
- Agent surfaces a developer-actionable error so operations can seed the authority config

## Error Paths

- **Gate falls back to default-allow (regression)** — must NEVER happen. Test asserts deny. ADR-0189 enforces seed-parity at registration; L-0097 documents the CVE-class fail-open trap.
- **Gate throws on missing row instead of returning denied outcome** — also acceptable as long as no INSERT happens. Test allows either denied-outcome OR thrown-error, but NOT silent grant.

## Verification

- [ ] Unit test `sendMessage.gate.test.ts` case "no authority seed → denied or throws, no INSERT" passes
- [ ] Test verifies behavior is fail-closed even when supabase mock returns empty `engine_authority_config` row
- [ ] Test asserts NO INSERT on `channel_message` table mock and NO emit call

**Mark `status: verified` when all three boxes are checked.**
