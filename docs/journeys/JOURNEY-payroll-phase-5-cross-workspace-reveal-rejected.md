---
title: "Journey — Cross-workspace reveal rejected"
journey: payroll-phase-5-cross-workspace-reveal-rejected
spec: docs/plans/PLAN-payroll-phase-5.md
status: verified
updated: 2026-05-08
created: 2026-05-08
module: payroll
roles: [admin]
tags: [journey, payroll, phase-5, pii, reveal, cross-workspace, forgery, adr-0151, security]
---

# Journey: Cross-workspace reveal rejected

**Role:** admin in workspace A attempting to reveal data belonging to workspace B

**Threat model:** An admin authenticates legitimately against workspace A, then crafts a request with a `profile_id` that belongs to workspace B. Without the workspace-scoped SELECT guard, the tool would leak cross-workspace PII. This journey verifies the forgery defence holds end-to-end.

**Precondition:**

- Admin authenticated against workspace A (JWT encodes `workspace_id = A`)
- Admin has a `profile_id` from workspace B (obtained e.g. by guessing a UUID, via a previous breach, or from a shared directory)
- Both workspaces have profiles in `public.profile`
- Local Supabase running with at least 2 workspaces (seed workspace + one additional)

## Happy Path (the rejection is the happy path)

1. Admin (workspace A) navigates to `/dashboard/people/[id]/complete-data` for any employee in their own workspace — the path is irrelevant for the attack; the forgery is in the request body, not the URL

2. Attack: Admin (or a script acting as admin) sends:
   ```
   POST /api/payroll/reveal-personal-number
   Content-Type: application/json
   { "profileId": "<uuid-of-profile-in-workspace-B>" }
   ```
   The request includes the admin's valid session cookie/JWT (credentials: same-origin).

3. BFF route executes:
   - `rejectCrossOrigin(request)` passes (same-origin request)
   - `RevealRequestSchema.safeParse(body)` passes — the UUID is structurally valid
   - `resolvePayrollAuth(request)` resolves `workspaceId = A` from JWT — NOT from the request body (ADR-0151 forgery defence)
   - Auth returns `{ workspaceId: "workspace-A-uuid", profileId: "admin-profile-A", ... }`
   - Synthetic `AgentToolContext` built with `workspaceId = A`, `channel = "chat"`

4. `viewPersonalNumber.execute({ profile_id: "<workspace-B-profile-uuid>" }, ctx)` executes:
   - `assertChatChannel` — passes
   - `callGateAction(ctx.supabaseAdmin, ctx.workspaceId = A, ctx.profileId = admin-A, { actionType: "view_personal_number", entityId: workspace-B-profile-uuid })` — gate evaluates based on workspace A authority config; result depends on workspace A's `engine_authority_config` for payroll. Gate likely passes (admin has authority in workspace A).
   - SELECT from `public.profile WHERE id = <workspace-B-profile-uuid> AND workspace_id = "workspace-A-uuid"` (tools.ts:458-463)
   - **Row not found** — because the profile belongs to workspace B, and `workspace_id = A` constraint filters it out
   - Branch: `if (error || !data)` (tools.ts:467)
   - **Attempt-audit emit fires:** `emit("payroll.personal_number_revealed", { workspace_id: ctx.workspaceId, actor_id: ctx.profileId, properties: { entity: { entity_type: "employment_contract", entity_id: "<workspace-B-profile-uuid>" }, data: { target_profile_id: "<workspace-B-profile-uuid>", is_self: false, gate_evaluation_id: gate.gateEvaluationId } } })` (tools.ts:469-481)
   - Returns `JSON.stringify({ ok: false, reason: "not_found" })`

5. BFF maps `reason: "not_found"` to HTTP 404 (route.ts:52-56 via `REASON_TO_STATUS` map)
   → Response: `{ ok: false, reason: "not_found", detail: null }`

6. `RevealableField` (if triggered via the UI) receives `ok: false` → `setFetchError("not_found")` → renders inline error text

**Postcondition:**

- `activity_trail` has a row with `event_name = "payroll.personal_number_revealed"` (attempt-audit), `entity_id = <workspace-B-profile-uuid>`, `workspace_id = workspace-A-uuid`, `actor_id = admin-A-profile-uuid`, `data.target_profile_id = <workspace-B-profile-uuid>`, `data.is_self = false`. This is the forgery-attempt audit trail.
- No `personal_number` value is returned. Workspace B's PII is NOT exposed.
- The response body gives no information about whether the profile exists in workspace B — "not_found" is identical whether the UUID is valid-in-workspace-B or entirely non-existent. Cross-workspace existence is NOT leaked.
- `gate_evaluation_id` is present in the attempt-audit row (gate was evaluated before the SELECT, so a gate_evaluation_id exists from the gate call)

## Why the audit fires even on rejection

The emit at tools.ts:469-481 fires BEFORE the `return JSON.stringify({ ok: false, reason: "not_found" })` at tools.ts:482. This is intentional — every reveal attempt must be audited, including failed/rejected ones. The audit row encodes `revealed=false` only implicitly (no `revealed` field in the emit payload; the `not_found` return is the implicit signal). The activity_trail row exists to enable forensic reconstruction of who attempted to access whose data and when.

## Contrast: what does NOT happen

- The query does NOT first look up the profile and then check workspace → no "found, wrong workspace" branch that could leak existence
- The BFF does NOT fall back to JWT-default workspace if workspace resolution fails → explicit 401, not a silent fallback (L-0177)
- The `not_found` reason is identical for "profile exists in wrong workspace" and "UUID does not exist anywhere" → existence oracle attack is prevented

## ADR references

- ADR-0151: workspace_id + profile_id always server-derived; never from request body
- L-0177: fail-fast on row-not-found, no silent fallback to JWT-default
- ADR-0099: gate_action called first (before the workspace-scoped SELECT)

## Error Paths

- **Malformed profileId (not a UUID):** `RevealRequestSchema.safeParse` fails → 400 `{ ok: false, reason: "invalid_request" }` before any DB query — no audit emit (correct; not an access attempt)
- **Admin not authenticated:** `resolvePayrollAuth` returns null → 401 → no audit emit
- **Gate denied in workspace A:** `callGateAction` returns `allow: false` → tool returns `{ ok: false, reason: "authority_denied" }` before the workspace-scoped SELECT is even attempted → 403 → no attempt-audit emit (gate_evaluation row is the audit trail in this case)

## Verification — file:line references

| Step | Implementation |
|------|----------------|
| BFF resolvePayrollAuth — never trusts body | `apps/web/src/app/api/payroll/reveal-personal-number/route.ts:89` |
| BFF synthetic ctx uses resolved workspace (not body profileId) | `route.ts:98-105` |
| Tool workspace-scoped SELECT (the key guard) | `packages/ai/src/capabilities/payroll/tools.ts:458-463` |
| Tool not-found branch | `tools.ts:467` |
| Attempt-audit emit on not-found | `tools.ts:469-481` |
| not_found return | `tools.ts:482` |
| BFF REASON_TO_STATUS 404 mapping | `apps/web/src/app/api/payroll/reveal-personal-number/route.ts:52-56` |
| Same pattern for bank account | `packages/ai/src/capabilities/payroll/tools.ts:558-582` |
