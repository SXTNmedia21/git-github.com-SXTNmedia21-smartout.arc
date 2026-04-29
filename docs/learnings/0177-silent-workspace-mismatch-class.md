---
title: "Silent Workspace-Mismatch on Tool Execution Is the Same Class as Forgeable IDs"
id: LEARNING_0177
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [silent-failure, workspace-scope, capability, adr-0099, adr-0134]
---

# Learning-0177: Silent Workspace-Mismatch on Tool Execution Is the Same Class as Forgeable IDs

## Context

Council R1 (2026-04-29) botsson-harness-builder code-traced `services/stage-engine/src/routes/agent/chat.ts:72-82`. When request body forwards `wizard_session_id`, stage-engine queries `wizard_session` to override `effectiveWorkspaceId` from the row's `workspace_id`. If the row exists, override applies. **If the row does NOT exist** (deleted, expired, typo, race), the `wizardRow?.workspace_id` check fails silently → `effectiveWorkspaceId` falls back to JWT-resolved first-profile workspace. The `save_draft` tool then runs `gate_action` against the wrong workspace AND attempts `wizard_session` UPDATE on a non-existent row. UPDATE silently affects 0 rows. Tool returns "Draft saved successfully." User sees confirmation. Nothing was saved.

## Discovery

This is the same class of bug as forgeable `profile_id` from request body (closed by ADR-0151), but inverted: the workspace is server-resolved from a body-supplied row reference. If the row is missing, the resolution silently falls back to a different workspace than the user intended. Three subtle variants of the same anti-pattern:

1. **ADR-0151 pattern:** body sends workspace_id, server defends by re-deriving — closed.
2. **ADR-0091 pattern:** body sends domain entity, server defends by validating domain → workspace mapping — partially closed.
3. **This pattern (new):** body sends row reference, server resolves workspace FROM the row, but row-missing case falls back to a DIFFERENT workspace silently.

The shared shape: any time a server resolves a security-relevant attribute (workspace, profile, role) by querying a row keyed on a body-supplied ID, the row-not-found case must fail fast, NOT fall back to a default. Silent fallback to a default is the bug.

The save_draft case is constrained: wizard_session is godmode-RLS-only, the BFF role-gates admin/owner, the wizard URL is godmode-only. So exploitation requires godmode + valid session + an attacker who can manipulate UUIDs. Practically unreachable today. But the shape is wrong, and ADR-0091 + ADR-0151 closed sibling shapes for the same reason — defense in depth, not because the live exploit existed.

## Impact

1. **Trust Gate addition:** any tool resolving workspace/profile/role from a row keyed on a body-supplied ID must declare its row-not-found behavior. Allowed: 4xx response with explicit error. Forbidden: silent fallback to JWT-resolved default.
2. **save_draft remediation:** add row-existence guard. If `wizard_session` row not found by `wizard_session_id`, return error before gate_action call.
3. **Pattern grep:** search `services/stage-engine/src/routes/` and `packages/ai/src/capabilities/` for `?.workspace_id` and `?.profile_id` patterns where a `?.` chain silently produces undefined and falls back. Each instance audited.
4. **Class name for memory:** "silent body-supplied row fallback." Distinct from "forgeable ID" (closed by re-derivation) and "missing emit" (closed by ADR-0134). New class, sibling shape.

## References

- ADR-0091 — workspace_id derivation from domain entity
- ADR-0099 — gate_action audit chain
- ADR-0134 — telemetry non-null contract
- ADR-0151 — server-derived profile_id
- ADR-0239 — Journey-Authoring Capability via Stage Engine
- Botsson Council R1 (2026-04-29) Phase 3 harness-builder trace

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
