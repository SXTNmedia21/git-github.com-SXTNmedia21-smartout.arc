---
title: "Journey — Agent attempts publish without authority seed (fail-closed)"
feature: botsson-publishannouncement-capability
journey: fail-closed-without-seed
status: verified
verified_at: 2026-05-12
e2e_test: apps/e2e/komm-nyheter/agent-publish/journey-3-fail-closed.spec.ts
created: 2026-05-11
updated: 2026-05-12
module: MODULE_COMMUNICATION
tags: [journey, default-deny, fail-closed, adr-0189, l-0066]
---

# Journey: Agent attempts publish without authority seed (fail-closed)

**Role:** Botsson agent in workspace where `communication` capability not yet seeded

**Precondition:**
- `engine_authority_config` has NO row for `(workspace_id, capability='communication')` for this workspace
- Tool invoked in chat channel
- Audience valid (non-zero profiles)

## Happy Path (deny)

1. Agent invokes `publish_announcement` with valid params
2. Tool execute(): voice check passes, then callGateAction with `capability="communication"`, `action_type="publish_announcement"`
3. Gate looks up `engine_authority_config` → NOT FOUND
4. Per ADR-0189 default-deny + L-0066 CVE-class trap mitigation: gate returns `{ allow: false }` (NOT default-allow)
5. Tool checks `gate.allow !== true` → returns `"Communication capability not authorized in this workspace. Contact admin to seed engine_authority_config."`
6. NO audience resolution call
7. NO INSERT
8. NO emit

**Postcondition:**
- Zero rows added to `channel_message`
- Zero `channel.message.sent` events
- ONE `gate.denied` audit row in `activity_trail` with `outcome: "denied"`, `reason: "default-deny-missing-seed"` (or equivalent)

## Error Paths

- Gate returns silent default-allow (CVE class regression) → MUST NOT HAPPEN. Test asserts deny.
- Workspace seeded but with `level='read_only'` → gate denies with different reason; still no INSERT

## Verification

- [ ] E2E spec passes — fail-closed verified against unseeded workspace
- [ ] Unit test asserts deny when mock returns `{ allow: false }`
- [ ] Service-role assertion: `activity_trail` has `gate.denied` row

**Mark `status: verified` when all 3 boxes checked.**
