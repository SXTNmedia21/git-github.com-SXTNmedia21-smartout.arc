---
title: "Journey — Employee self-reveals own PII"
journey: payroll-phase-5-employee-self-reveals-own-pii
spec: docs/plans/PLAN-payroll-phase-5.md
status: verified
updated: 2026-05-08
created: 2026-05-08
module: payroll
roles: [employee]
tags: [journey, payroll, phase-5, pii, reveal, self-reveal, my-contract, mobile-boundary]
---

# Journey: Employee self-reveals own PII

**Role:** employee (or any profile viewing their own data)

## Critical boundary — web vs mobile

**WEB ONLY.** The PII reveal interaction (masked field → click → value shown for 5s) is a web-only pattern.

Mobile employees do NOT have a self-reveal surface. Mobile's role in PII is:

- **Submit:** employee submits their own personal_number and bank_account once via `apps/mobile/app/(app)/(me)/contract/complete-data.tsx` → `submit_own_pii` RPC. This is a write-once flow, not a reveal flow.
- **No reveal screen:** there is no `/profile-pii`, no native RevealableField-equivalent, no reveal BFF call initiated from mobile. This is intentional per ADR-0133 ("mobile executes") — mobile is the submission surface, web is the self-review surface.

The original plan section E ("UI Mobile — `profile-pii.tsx`") describes a screen that was NOT built in Phase 5 (TE Path A finding). The mobile path terminates at submission. Reveal = web-only.

---

## Precondition (web self-reveal)

- Employee logged in on web dashboard
- Employee navigates to `/dashboard/my-contract`
- Employee has a `personal_number` and/or `bank_account` in `public.profile` (set via admin or `submit_own_pii` RPC)
- The my-contract page server-renders both column values from the employee's own profile server-side (the page uses a server component that reads the employee's own data with their own auth context)

## Happy Path — web `/dashboard/my-contract`

1. Employee navigates to `/dashboard/my-contract`
   → Server component fetches `personal_number` + `bank_account` from `public.profile` using the employee's own auth (NOT admin client)
   → Values are passed as props to the page's client component: `personalNumber` and `bankAccount`

2. Employee scrolls to "Personlig informasjon" section (my-contract/page.tsx:524-558)
   → Section visible only if `(personalNumber || bankAccount) && workspaceId && profileId` (page.tsx:524)

3. Employee sees Personnummer row: masked "••••••••", Eye icon
   → `RevealableField` rendered in STATIC mode: `value={personalNumber}` (page.tsx:532-540)
   → Static mode: value is already in the component; no BFF call on reveal
   → `isSelf={true}` (page.tsx:538), `actorProfileId={profileId}` (page.tsx:539)

4. Employee clicks the Eye icon
   → `RevealableField.handleReveal()` fires (RevealableField.tsx:91)
   → Since static mode: `isFetchMode = false`, no BFF call
   → `setRevealed(true)` immediately
   → `emit("contract.pii.revealed", { event, workspace_id, actor_id, properties: { data: { pii_field: "personal_number", revealed: true, is_self: true } } })` (RevealableField.tsx:132-145)
   → Full personnummer renders for 5 seconds

5. Same for Bankkonto row (page.tsx:543-556) — identical flow, `fieldName="bank_account"`

6. After 5 seconds: auto-mask fires → "••••••••" shown again

**Postcondition:**

- `activity_trail` has a new row from `contract.pii.revealed` emit with `is_self = true`, `actor_id = profileId = entity_id`
- Employee sees their own data for 5 seconds — no admin is required

## Important note — audit event name on my-contract surface

The self-reveal on `/dashboard/my-contract` still emits `contract.pii.revealed` (the legacy event name) rather than `payroll.personal_number_revealed`. This is by design — the my-contract surface is a contract surface, not a payroll surface. Migration of contract-surface emits to typed payroll events is deferred to a follow-up sortie (Q4 in PLAN-payroll-phase-5.md). Phase 5 only migrates the payroll admin surfaces (LonnsprofilSection) to the new payroll-specific events.

## Mobile path — employee submits PII (not reveal)

**Surface:** `apps/mobile/app/(app)/(me)/contract/complete-data.tsx`

**Flow (submission, not reveal):**

1. Employee opens the mobile app (PWA port 8083) → navigates to contract completion screen
2. Employee fills in personnummer field (digits only, validated as 11 digits: `complete-data.tsx:62`)
3. Employee submits → `supabase.rpc("submit_own_pii", { p_profile_id: profileId, p_field_group: "identity", p_values: { personal_number: ... } })` (complete-data.tsx:86-90)
4. Result: `personal_number` written to `public.profile` row
5. Employee cannot view the submitted value in the mobile app — there is no reveal surface on mobile
6. If the employee needs to review their stored PII, they must use the web dashboard `/dashboard/my-contract`

**This is correct per ADR-0133.** No mobile reveal surface will be added in Phase 5. A future phase may add a read-only display (not reveal interaction) on mobile, but that requires a separate ADR.

## Error Paths (web self-reveal)

- **No PII on file:** `personalNumber` prop is `null` → section hidden entirely (page.tsx:524 guard); no RevealableField rendered
- **Static mode error:** RevealableField static mode cannot fail on reveal since value is pre-loaded; the only error path is `nonEmpty()` telemetry assertion failure if `workspaceId` or `profileId` is empty (RevealableField.tsx:133-134) — would throw at call site
- **Network failure on static mode:** no network call on reveal — no network error path in this mode

## Verification — file:line references

| Step | Implementation |
|------|----------------|
| my-contract page PII section | `apps/web/src/app/dashboard/my-contract/page.tsx:523-558` |
| Section guard | `page.tsx:524` (`(personalNumber || bankAccount) && workspaceId && profileId`) |
| RevealableField for personal_number (static mode) | `page.tsx:532-540` |
| isSelf=true | `page.tsx:538` |
| RevealableField for bank_account (static mode) | `page.tsx:543-556` |
| RevealableField static mode branch | `apps/web/src/components/RevealableField.tsx:80-83` (resolvedValue from props) |
| RevealableField client-side emit | `RevealableField.tsx:132-145` (contract.pii.revealed) |
| RevealableField auto-mask timer | `RevealableField.tsx:148-150` |
| Mobile submit_own_pii (PII write, not reveal) | `apps/mobile/app/(app)/(me)/contract/complete-data.tsx:86-90` |
| No mobile reveal screen | No file — intentionally absent per ADR-0133 + TE Path A |
