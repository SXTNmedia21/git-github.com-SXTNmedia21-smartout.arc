---
title: "Journey — Admin reveals employee personal number"
journey: payroll-phase-5-admin-reveals-personal-number
spec: docs/plans/PLAN-payroll-phase-5.md
status: verified
updated: 2026-05-08
created: 2026-05-08
module: payroll
roles: [admin]
tags: [journey, payroll, phase-5, pii, reveal, personal-number, audit]
---

# Journey: Admin reveals employee personal number

**Role:** admin

**Precondition:**

- Admin logged in and on `/dashboard/people/[id]/complete-data`
- Target employee has a `personal_number` value in `public.profile` (may be `null` — see error paths)
- `employee_payroll_profile` row exists for the employee (required for LonnsprofilSection to fetch tax-card data)
- Admin's session has `isAdminMode = true` (DashboardContext) — controls `isAdmin` prop on LonnsprofilSection
- Local Supabase running; `npx supabase start` done without `op run` wrap

## Happy Path

1. Admin navigates to `/dashboard/people/{employee-uuid}/complete-data`
   → System loads `HrTabSections.tsx`; reads `isAdminMode` from `DashboardContext` (line 1300 in HrTabSections.tsx)

2. Admin scrolls to the "Høy-PII felt" subsection within the Lønnsprofil card
   → System renders `LonnsprofilSection.tsx` (line 480); the HIGH-PII block at line 865-932 is always visible regardless of edit mode

3. Admin sees the Personnummer row: label "Personnummer", masked value "••••••••", Eye icon
   → `RevealableField` at line 918-928 of LonnsprofilSection.tsx rendered in BFF-fetch mode (`fetchEndpoint="/api/payroll/reveal-personal-number"`)
   → Initial masked state shows MASK ("••••••••") because `fetchedValue === null` before first click

4. Admin clicks the Eye icon button
   → `RevealableField.handleReveal()` fires (`RevealableField.tsx:91`)
   → Component sets `fetching = true`, POSTs to `/api/payroll/reveal-personal-number` with body `{ profileId: "<employee-uuid>" }`

5. BFF route `POST /api/payroll/reveal-personal-number` (`route.ts`) executes:
   - `rejectCrossOrigin(request)` guard (route.ts:60)
   - Parses + validates body via `RevealRequestSchema` (route.ts:74)
   - `resolvePayrollAuth(request)` derives `workspaceId` + `profileId` + `userId` server-side from JWT — never from request body (ADR-0151, route.ts:89)
   - If auth missing → 401 (route.ts:91)
   - Builds synthetic `AgentToolContext` with `channel: "chat"` forced (ADR-0078, route.ts:98-105)
   - Calls `viewPersonalNumber.execute({ profile_id: employeeUuid }, ctx)` (route.ts:108)

6. Inside `viewPersonalNumber.execute()` (`tools.ts:430`):
   - `assertChatChannel(channel)` — passes (channel is forced to "chat" by BFF)
   - `callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, { capability: "payroll", actionType: "view_personal_number", entityId: params.profile_id })` (tools.ts:437)
   - Gate returns `{ allow: true, gateEvaluationId: "<uuid>" }`
   - SELECT from `public.profile WHERE id = params.profile_id AND workspace_id = ctx.workspaceId` (tools.ts:458-463)
   - Row found; `data.personal_number` is non-null
   - `emit("payroll.personal_number_revealed", { workspace_id, actor_id, ... })` (tools.ts:486-498) → routes to `logger + activity_trail + engine_event` only (PostHog EXCLUDED per ADR-0077)
   - Returns `JSON.stringify({ ok: true, value: "<full-fnr>", is_self: false, has_value: true, gate_evaluation_id: "<uuid>" })`

7. BFF maps tool result to HTTP 200 `{ ok: true, value: "<full-fnr>", is_self: false, has_value: true, gate_evaluation_id: "<uuid>" }` (route.ts:124-133)

8. `RevealableField` receives the response:
   - `setFetchedValue("<full-fnr>")` (RevealableField.tsx:120)
   - `setRevealed(true)` (RevealableField.tsx:129)
   - 5-second auto-mask timer starts via `setTimeout` (RevealableField.tsx:148)
   - Renders the full personnummer in `font-mono text-sm` within AnimatePresence (RevealableField.tsx:184-194)

9. After 5 seconds: timer fires → `setRevealed(false)` → component renders MASK again
   → Eye icon (EyeOff while revealed, Eye when masked) updates state for the admin

**Postcondition:**

- `activity_trail` has a new row with `event_name = "payroll.personal_number_revealed"`, `entity_type = "employment_contract"`, `entity_id = <employee-profile-id>`, `workspace_id = <admin-workspace-id>`, `actor_id = <admin-profile-id>`, `data.is_self = false`, `data.gate_evaluation_id = <uuid>`
- PostHog receives NO event for this reveal (high-PII access excluded per ADR-0077)
- The personnummer value is NEVER sent to any logging destination; only the fact of reveal is emitted
- Second reveal click uses the already-fetched `fetchedValue` (no second BFF call) — see `RevealableField.tsx:100` (`fetchedValue === null` guard)

## Error Paths

- **Not logged in / expired session:** `resolvePayrollAuth` returns null → 401 `{ ok: false, reason: "unauthorized" }` → `RevealableField` renders inline error "Kunne ikke hente verdi" (RevealableField.tsx:175-177)
- **Gate denied (authority level below `view_personal_number`):** tool returns `{ ok: false, reason: "authority_denied" }` → BFF maps to HTTP 403 → `RevealableField` shows error text
- **Employee belongs to different workspace (cross-workspace attempt):** `callGateAction` still passes (actor is admin of their workspace), but SELECT `WHERE id=X AND workspace_id=admin-workspace` returns no rows → tool emits `payroll.personal_number_revealed` with `revealed=false` attempt-audit → returns `{ ok: false, reason: "not_found" }` → BFF maps to 404 → component shows error (this is the ADR-0151 forgery defence path; see cross-workspace journey)
- **No PII on file (`personal_number = null`):** tool reaches the null-check at tools.ts:500, returns `{ ok: true, value: null, has_value: false }` → BFF maps to 200 → `RevealableField` receives `has_value: false`, hides Eye button and shows "—" (RevealableField.tsx:205-207)
- **Network failure:** `fetch()` in `RevealableField.handleReveal()` throws → `setFetchError("Nettverksfeil")` → component renders error paragraph in `text-destructive` (RevealableField.tsx:175-177)

## Verification — file:line references

| Step | Implementation |
|------|----------------|
| HrTabSections mounts LonnsprofilSection | `apps/web/src/app/dashboard/people/[id]/complete-data/HrTabSections.tsx:1385-1389` |
| isAdminMode from DashboardContext | `HrTabSections.tsx:1300` |
| LonnsprofilSection HIGH-PII block | `apps/web/src/app/dashboard/people/[id]/_components/LonnsprofilSection.tsx:865-932` |
| RevealableField for personal_number | `LonnsprofilSection.tsx:918-928` (fetchEndpoint="/api/payroll/reveal-personal-number") |
| data-testid="reveal-personal_number" wrapper | `LonnsprofilSection.tsx:917` |
| RevealableField BFF-fetch mode | `apps/web/src/components/RevealableField.tsx:100-126` |
| RevealableField emit (client-side, contract.pii.revealed) | `RevealableField.tsx:132-145` — NOTE: this emit still fires in BFF-fetch mode as a belt-and-suspenders client-side audit; server-side tool emit is the canonical audit per ADR-0077 |
| BFF route CORS guard | `apps/web/src/app/api/payroll/reveal-personal-number/route.ts:60` |
| BFF resolvePayrollAuth (ADR-0151) | `route.ts:89` |
| BFF synthetic ctx channel="chat" (ADR-0078) | `route.ts:103` |
| BFF delegate to viewPersonalNumber.execute | `route.ts:108` |
| Tool channel check | `packages/ai/src/capabilities/payroll/tools.ts:431-435` |
| Tool callGateAction | `tools.ts:437-442` |
| Tool workspace-scoped SELECT (ADR-0151, L-0177) | `tools.ts:458-463` |
| Tool emit payroll.personal_number_revealed | `tools.ts:486-498` |
| Tool return value | `tools.ts:510-517` |
| RevealableField auto-mask timer | `apps/web/src/components/RevealableField.tsx:148-150` |
| RevealableField revealed render | `RevealableField.tsx:183-194` |
