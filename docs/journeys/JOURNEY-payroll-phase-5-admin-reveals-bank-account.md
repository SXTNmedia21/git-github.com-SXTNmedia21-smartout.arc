---
title: "Journey — Admin reveals employee bank account"
journey: payroll-phase-5-admin-reveals-bank-account
spec: docs/plans/PLAN-payroll-phase-5.md
status: verified
updated: 2026-05-08
created: 2026-05-08
module: payroll
roles: [admin]
tags: [journey, payroll, phase-5, pii, reveal, bank-account, audit]
---

# Journey: Admin reveals employee bank account

**Role:** admin

**Precondition:**

- Admin logged in and on `/dashboard/people/[id]/complete-data`
- Target employee has a `bank_account` value in `public.profile` (may be `null` — see error paths)
- `employee_payroll_profile` row exists for the employee
- Admin's session has `isAdminMode = true` from DashboardContext
- Local Supabase running

## Happy Path

1. Admin navigates to `/dashboard/people/{employee-uuid}/complete-data`
   → System loads `HrTabSections.tsx`; `isAdminMode` read from `DashboardContext` (HrTabSections.tsx:1300)
   → `LonnsprofilSection` mounted with `isAdmin={isAdminMode}` (HrTabSections.tsx:1385-1389)

2. Admin scrolls to the "Høy-PII felt" subsection within the Lønnsprofil card
   → HIGH-PII block renders (LonnsprofilSection.tsx:865-932); Bankkonto row appears before Personnummer row

3. Admin sees the Bankkonto row: label "Bankkonto", masked value "••••••••", Eye icon button
   → `RevealableField` at LonnsprofilSection.tsx:886-893 in BFF-fetch mode (`fetchEndpoint="/api/payroll/reveal-bank-account"`)
   → Wrapper div at `data-testid="reveal-bank_account"` (LonnsprofilSection.tsx:885)
   → Initial state: `fetchedValue === null` → masked state shown

4. Admin clicks the Eye icon button
   → `RevealableField.handleReveal()` fires (RevealableField.tsx:91)
   → `fetching = true`; POST to `/api/payroll/reveal-bank-account` with body `{ profileId: "<employee-uuid>" }`

5. BFF route `POST /api/payroll/reveal-bank-account` executes:
   - `rejectCrossOrigin(request)` guard
   - Parses + validates body via `RevealRequestSchema` (z.string().uuid on profileId)
   - `resolvePayrollAuth(request)` derives identity server-side from JWT (ADR-0151)
   - Builds synthetic `AgentToolContext` with `channel: "chat"` forced (ADR-0078)
   - Calls `viewBankAccount.execute({ profile_id: employeeUuid }, ctx)`

6. Inside `viewBankAccount.execute()` (tools.ts:530):
   - `assertChatChannel(channel)` — passes
   - `callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, { capability: "payroll", actionType: "view_bank_account", entityId: params.profile_id })` (tools.ts:537-542)
   - Gate returns `{ allow: true, gateEvaluationId: "<uuid>" }`
   - SELECT from `public.profile WHERE id = params.profile_id AND workspace_id = ctx.workspaceId` (tools.ts:558-563)
   - Row found; `data.bank_account` is non-null
   - `emit("payroll.bank_account_revealed", { workspace_id, actor_id, ... })` (tools.ts:586-598) → routes to `logger + activity_trail + engine_event`; PostHog EXCLUDED (ADR-0077)
   - Returns `{ ok: true, value: "<11-digit-account>", is_self: false, has_value: true, gate_evaluation_id: "<uuid>" }`

7. BFF maps to HTTP 200; `RevealableField` receives `{ ok: true, value: "<11-digit-account>", has_value: true }`
   - `setFetchedValue("<11-digit-account>")` (RevealableField.tsx:120)
   - `setRevealed(true)` (RevealableField.tsx:129)
   - 5-second auto-mask timer starts (RevealableField.tsx:148)
   - Full account number renders in `font-mono text-sm` (RevealableField.tsx:192-193)

8. After 5 seconds: timer fires → `setRevealed(false)` → MASK shown again
   → EyeOff icon while revealed, Eye icon when masked (RevealableField.tsx:228-233)

**Postcondition:**

- `activity_trail` has a new row with `event_name = "payroll.bank_account_revealed"`, `entity_type = "employment_contract"`, `entity_id = <employee-profile-id>`, `workspace_id = <admin-workspace-id>`, `actor_id = <admin-profile-id>`, `data.is_self = false`, `data.gate_evaluation_id = <uuid>`
- PostHog receives NO event (ADR-0077)
- Bank account value never appears in any telemetry payload — only the reveal fact is emitted
- Norwegian bank account format note: `profile.bank_account` is TEXT, no MOD11 validation on read. If the stored value is malformed, it is returned as-is (Q2 from plan — format validation deferred)

## Error Paths

- **Not logged in / expired session:** `resolvePayrollAuth` returns null → 401 → RevealableField shows "Kunne ikke hente verdi"
- **Gate denied:** tool returns `{ ok: false, reason: "authority_denied" }` → HTTP 403 → component error text
- **Cross-workspace attempt:** SELECT returns no rows (workspace mismatch) → emit attempt-audit with `is_self=false`, `gate_evaluation_id` present → returns `{ ok: false, reason: "not_found" }` → HTTP 404 (see cross-workspace journey for full trace)
- **No bank account on file (`bank_account = null`):** tool returns `{ ok: true, value: null, has_value: false }` → RevealableField hides Eye button, shows "—" (RevealableField.tsx:205-207)
- **Network failure:** `fetch()` throws → `setFetchError("Nettverksfeil")` → destructive error text rendered (RevealableField.tsx:175-177)

## Additional context — "Endre bankkonto" button

LonnsprofilSection shows a disabled "Endre bankkonto" button below the RevealableField (LonnsprofilSection.tsx:895-908) with tooltip "PII-inntak-flyt ikke tilgjengelig ennå". This is intentional — writing bank account changes requires a separate PII intake flow per ADR-0077. Phase 5 covers reveal only; write-path is a future sortie.

## Verification — file:line references

| Step | Implementation |
|------|----------------|
| HrTabSections mounts LonnsprofilSection with isAdmin | `apps/web/src/app/dashboard/people/[id]/complete-data/HrTabSections.tsx:1385-1389` |
| LonnsprofilSection HIGH-PII block — Bankkonto | `apps/web/src/app/dashboard/people/[id]/_components/LonnsprofilSection.tsx:883-908` |
| data-testid="reveal-bank_account" wrapper | `LonnsprofilSection.tsx:885` |
| RevealableField for bank_account | `LonnsprofilSection.tsx:886-893` (fetchEndpoint="/api/payroll/reveal-bank-account") |
| RevealableField BFF POST | `apps/web/src/components/RevealableField.tsx:104-127` |
| BFF route file | `apps/web/src/app/api/payroll/reveal-bank-account/route.ts` |
| BFF resolvePayrollAuth | `route.ts:89` (same shape as reveal-personal-number) |
| BFF synthetic ctx channel="chat" | `route.ts:103` |
| BFF delegate to viewBankAccount.execute | `route.ts:108` |
| Tool channel check | `packages/ai/src/capabilities/payroll/tools.ts:531-535` |
| Tool callGateAction | `tools.ts:537-542` |
| Tool workspace-scoped SELECT | `tools.ts:558-563` |
| Tool emit payroll.bank_account_revealed | `tools.ts:586-598` |
| Tool null-check return | `tools.ts:600-617` |
| RevealableField auto-mask | `apps/web/src/components/RevealableField.tsx:148-150` |
| Disabled "Endre bankkonto" write-guard | `LonnsprofilSection.tsx:895-908` |
