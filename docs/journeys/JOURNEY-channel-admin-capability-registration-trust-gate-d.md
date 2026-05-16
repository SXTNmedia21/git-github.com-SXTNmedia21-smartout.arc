---
title: "Journey — channel_admin capability registers → Trust Gate D unblocks"
feature: channel-admin-capability-registration
status: verified
verified_at: 2026-05-16
verification_note: "Capability + 6 tools shipped at commit dfcfac0e1. T3 system-steward confirmed all 6 tools match ADR-0336 design table (per-tool authority + min_role + channel). emitPrefix 'channel_admin' verified unique via getAllCapabilities() self-check. Typecheck clean. Skeleton bodies fail-fast per ADR-0196 Invariant 11."
updated: 2026-05-16
created: 2026-05-16
module: ai
tags: [journey, ai, capability, adr-0336, trust-gate]
---

# Journey: channel_admin capability appears in registry with 6 tools

**Precondition:** ADR-0336 accepted (commit b2060888e on development). `packages/ai/src/capabilities/registry.ts` does NOT yet contain `channel_admin`. Trust Gate D blocked.

1. Sortie ships `packages/ai/src/capabilities/channel-admin/index.ts` + 6 skeleton tools.
2. Registry edit: `channel_admin` capability imported + entered in registry table.
3. `CapabilityName` union in `types.ts` includes `channel_admin`.
4. Importing the registry exposes `channel_admin` capability object with `tools` length === 6.
5. Each tool has correct `level` + `min_role` + `channel` matching ADR-0336 design table:
   - mute_channel: autonomous / employee / chat
   - leave_channel: autonomous / employee / chat
   - invite_to_channel: confirm / manager / chat
   - rename_channel: confirm / admin / chat
   - archive_channel: confirm / admin / chat
   - change_member_role: confirm / admin / chat
6. Calling any tool body throws `"Not implemented in registration sortie — track in feat/channel-admin-<tool>-body"`.

**Postcondition:** Trust Gate D unblocked. `campaign/chat-admin` can start sub-sorties to implement each tool body without re-registering the capability.

**Error paths:**
- Capability collision in registry → duplicate name detected at build time → fail loud.
- Tool authority mismatch with ADR-0336 → system-steward review catches before merge.
- Skeleton body called by accident → throws fail-fast with sortie tracking message.
