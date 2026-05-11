---
title: "Journey — PII boundary: tool return has no raw profile_ids"
feature: botsson-publishannouncement-capability
journey: pii-boundary-no-raw-ids
status: draft
verified_at: null
e2e_test: apps/e2e/komm-nyheter/agent-publish/journey-4-pii-boundary.spec.ts
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [journey, pii-boundary, adr-0151, adr-0163, council-b5]
---

# Journey: PII boundary — tool return has no raw profile_ids

**Role:** Botsson agent (any path: draft or publish)

**Precondition:**
- Workspace has profiles (any audience kind valid)
- callGateAction granted

## Happy Path

1. Agent invokes `publish_announcement` with `audience_kind: "department", departmentIds: [...]`
2. Tool resolves audience server-side via `ctx.supabaseAdmin` → internally has `target_profile_ids: ["uuid1", "uuid2", "uuid3"]`
3. Tool INSERT writes `target_profile_ids` to `channel_message.target_profile_ids` column (RLS filter uses it — required for visibility)
4. Tool return value to agent: `{ phase: "published", message_id: "...", target_profile_count: 3, audience_label: "Bar (3)" }`
5. **`target_profile_ids` is NOT in the return string.** Agent LLM context never sees the raw UUIDs.

**Postcondition:**
- DB has the raw IDs in `target_profile_ids` (required for RLS)
- Agent context contains ONLY count + label
- ADR-0151 server-derive boundary preserved + ADR-0163 PII allowedChannels boundary preserved

## Error Paths

- Regression: a future patch adds `targetProfileIds` to the return object → unit test MUST catch it (asserts `Object.keys(returnObj).indexOf("target_profile_ids") === -1` AND `Object.keys(returnObj).indexOf("targetProfileIds") === -1`)
- Audience resolution fails silently → tool returns error, no IDs leaked

## Verification

- [ ] Unit test parses tool return JSON + asserts no `target_profile_ids`-shaped key exists
- [ ] E2E spec captures tool result string and regex-matches against `/[0-9a-f]{8}-[0-9a-f]{4}-/` UUID pattern → 0 matches in return value (allowing only `message_id` which is a single UUID, not a list)
- [ ] Code-review: grep tool source for `target_profile_ids` in return path → must only appear in INSERT payload, never in `return` statement

**Mark `status: verified` when all 3 boxes checked.**
