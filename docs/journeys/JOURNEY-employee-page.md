---
title: "User Journeys — Employee Page"
status: done
updated: 2026-04-09
created: 2026-04-09
module: people
tags: [people, contracts, onboarding, journeys]
---

# User Journeys — Employee Page

## Journey: Admin views employee list
**Precondition:** Admin is logged in, workspace has employees
1. Admin navigates to `/dashboard/people` → System loads profiles, departments, invitations, readiness scores, contract status
2. Admin sees 4 metric cards (Total Staff, Active, Avg Readiness, Pending Invites) → System calculates from live data
3. Admin clicks a metric card → Table filters to matching subset
4. Admin uses search or advanced filters → Table narrows results
**Postcondition:** Admin has overview of workforce status
**Error paths:** No employees → empty state with invite CTA

## Journey: Admin invites employee (single)
**Precondition:** Admin on people page
1. Admin clicks "Inviter" → Invite dialog opens
2. Admin fills name, email, department, role → Selects invite channels (email/SMS/link)
3. Admin clicks "Send invitasjon" → System calls create-invitation Edge Function
4. Admin sees invite link → Can copy to clipboard
**Postcondition:** Invitation created with pending status, visible in table
**Error paths:** Missing required fields → validation errors shown

## Journey: Admin sends contract to employee
**Precondition:** Admin on people page, contract templates exist
1. Admin clicks "..." on employee row → Selects "Send kontrakt"
2. ContractSendDrawer opens → Step 1: Template list loads from API (system + workspace templates)
3. Admin selects a template → Clicks "Neste"
4. Step 2: Review fields pre-filled from profile/contract/workspace/company → Admin overrides values if needed
5. Step 3: Preview rendered contract in Tiptap editor → Admin can edit text
6. Admin clicks "Send kontrakt" → Confirmation dialog warns about irreversibility
7. Admin confirms → POST /api/contracts creates draft → POST /api/contracts/[id]/send attempts DocuSeal dispatch
8. If service available: status = "sent", success toast → If service unavailable: status = "draft" with send_requested_at, warning toast
**Postcondition:** Contract created in DB, visible on /dashboard/contracts
**Error paths:** No templates → empty state. Service down → contract queued with warning. Employee has no email → 400 error.

## Journey: Admin edits employee HR data
**Precondition:** Admin on people page
1. Admin clicks employee row → Slide-out profile card opens
2. Admin navigates to "HR & Logg" tab → Sees address, personnummer, bank, emergency contact
3. Admin clicks "Rediger" → Fields become editable
4. Admin changes values → Clicks "Lagre"
5. System updates profile table (address, personnummer, bank) + user_identity table (emergency contact)
**Postcondition:** HR data persisted across both tables
**Error paths:** RLS denies write → error toast

## Journey: Admin changes employee role/department/status
**Precondition:** Admin on people page
1. Admin clicks "..." on employee row → Dropdown shows available actions based on role hierarchy
2. Admin selects "Endre rolle" → Submenu shows allowed roles (owner > admin > manager > employee)
3. Admin selects new role → Server action validates + updates → Telemetry event emitted
**Postcondition:** Employee has new role, event logged in activity_trail + PostHog
**Error paths:** Insufficient permissions → action not shown. Invalid transition → server rejects.

## Journey: Admin bulk-updates employees
**Precondition:** Admin on people page with multiple employees
1. Admin checks multiple employee checkboxes → Bulk action bar appears
2. Admin selects action (assign dept / change role / change status / deactivate)
3. For destructive actions → Confirmation dialog
4. System calls bulkUpdateProfiles server action → Updates all selected
**Postcondition:** All selected employees updated
**Error paths:** Mixed statuses may cause partial failures

## Journey: Admin navigates to contracts
**Precondition:** Admin on people page
1. Admin sees "Kontrakter" link above the data table → Clicks it
2. System navigates to `/dashboard/contracts` → Shows all workspace contracts with status tabs
**Postcondition:** Admin on contracts page
**Alternative:** Admin uses sidebar sub-link (visible when on people/contracts pages) or Cmd+K search

## Journey: Admin uses composition wizard
**Precondition:** Admin navigates to /dashboard/contracts → Clicks "Ny kontrakt"
1. Step 1: Employee picker loads workspace profiles → Admin searches and selects employee
2. Step 2: Admin enters position title
3. Step 3: System calls POST /api/employment-contracts → Cascade derives terms from D2+K1a+K1b → Shows loading → "Forslag hentet"
4. Step 4: Review shows GhostValueCards (hourly rate, percentage, category) with sources → Admin acknowledges each
5. Step 5: Mandatory clauses from framework displayed (locked)
6. Step 6: Send step → Blocked if blockers exist, ready if clean
**Postcondition:** Contract draft proposed with cascade-derived terms
**Error paths:** No framework binding → API error. Tariff not found → null rate shown.

## Journey: Admin fills PII on behalf of employee
**Precondition:** Admin navigates to /dashboard/people/[id]/complete-data
1. Admin selects field group (identity/banking/address) → Fills in values
2. Admin writes reason (min 10 chars) for audit trail
3. Admin clicks submit → Confirmation dialog
4. System calls admin_submit_employee_pii RPC (SECURITY DEFINER) → Employee gets notification
**Postcondition:** PII stored, audit trail created
**Error paths:** Reason too short → validation. RPC fails → error toast.
