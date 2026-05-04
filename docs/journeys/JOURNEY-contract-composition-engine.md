---
title: User Journeys — Contract Composition Engine
status: verified
updated: 2026-04-22
created: 2026-04-09
module: contracts
tags: [contract, composition, journey, pii, signing, drawer]
verified_by: council-gate-3 2026-04-22
verified_note: Wizard → drawer migration live (CompositionDrawer at apps/web/src/components/contracts/CompositionDrawer.tsx). Legacy CompositionWizard retained per L-0105 (live consumer in revise flow). Preview renders in step 4 (Bekreft) per JOURNEY-contract-preview-editor amendment.
---

# User Journeys — Contract Composition Engine

> **Redesign note (2026-04-22):** `/dashboard/contracts/new` route retired per council 2026-04-22 (Q4). Composition now runs inside the `CompositionDrawer` launched from the `Kontrakter` tab in the hub, from the `Maler` tab (bulk-send), or from the employee detail page (reverse flow). Step count reduced from 6 steps on a page to 5 steps in the drawer: Ansatt → Stilling → Gjennomgang → Bekreft → Send.

## Journey: Admin Composes Employment Contract

**Precondition:** Admin is logged in, workspace has active framework binding, employee profile exists.

1. Admin navigates to `/dashboard/contracts` (tabs-in-hub IA: `Kontrakter | Maler | Bindinger`)
2. Admin clicks "Lag kontrakt" on the `Kontrakter` tab
   → System opens `CompositionDrawer` (right-side Sheet, 640px, glass surface `bg-background/80 backdrop-blur-xl`)
   → Drawer shows step 1 of 5: Ansatt (employee picker)
3. Admin selects employee — virtualized list (TanStack Virtual, row height ~64px) so 500+ profiles do not block render
4. Admin enters position title in step 2 (Stilling)
5. System derives contract terms from cascade (D2 profile + K1a framework rules + tariff rates) — step 3 (Gjennomgang)
   → Derivation runs via `useComposeContract` → `POST /api/employment-contracts` → `resolveComposition` in `packages/utils/src/resolve-composition.ts`
   → Template resolved via `contract_template_binding` K1b cascade (employee_group → employment_category → system fallback)
6. Admin reviews auto-suggested values (GhostValueCards) and acknowledges each block
7. If tariff deviation: admin provides written justification, stored in `compliance_overrides` JSONB
8. System shows mandatory clauses (locked, from framework_rule) in step 4 (Bekreft)
   → If template is `deprecated_at IS NOT NULL`: compliance warning banner shown (Phase 4, see `JOURNEY-cascade-drift-observability.md`)
   → If template's `source_template_version` lags current K1a version: amber drift chip visible on the header
9. Admin clicks "Send" in step 5
10. System snapshots framework rules into `framework_snapshot` JSONB on employment_contract
11. If employee has missing PII (personal_number, bank_account, address): status transitions to `pending_data`, system creates `contract_data_intake` engine_process, schedules escalation triggers (day 3/7/10)
12. If all data present: status transitions to `sent`, system creates `contract_signing` engine_process
13. Drawer closes, toast: "Kontrakt sendt til {recipient_name}", `Kontrakter` tab list refreshes

**Postcondition:** Employment contract row created with framework_snapshot, status is `sent` or `pending_data`, engine_state running.

**Error paths:**
- Compliance blocker (law violation): Send button disabled, admin cannot proceed until blocker is resolved
- Missing framework binding: derivation returns empty rules, admin sees warning
- Drawer closed before send: all local state (employee, position, overrides) reset on next open
- Deep link to retired `/dashboard/contracts/new`: redirect to `/dashboard/contracts?open=compose` (drawer auto-opens)
- Performance gate: drawer open-to-interactive p95 must be <250ms — asserted in `apps/e2e/tests/performance-gates.spec.ts`

---

## Journey: Employee Completes Data Intake (Chat)

**Precondition:** Contract is `pending_data`, employee has Botsson chat access.

1. Mr. Botsson presents the first intake group (identity: personal number + address) with empathy copy
2. Employee provides personal number (11 digits) and address via chat
3. Botsson validates Norwegian format (11-digit personnummer, 4-digit postnummer)
4. Tool calls `admin_submit_employee_pii` RPC scoped to own profile
5. Tool returns generic "Takk, lagret" — NEVER echoes the submitted value
6. Botsson presents next group (banking: bank account)
7. Employee provides bank account (11 digits)
8. When all groups complete: contract status transitions from `pending_data` to ready, pending escalation triggers are cancelled

**Postcondition:** Profile PII fields populated, contract ready for signing.

**Error paths:**
- Voice channel attempt: Botsson refuses PII collection, offers to open chat instead
- Invalid format: Botsson reports validation error, asks for correction
- Employee declines: `decline_intake` tool marks engine_state_step as failed, admin notified

---

## Journey: Employee Completes Data Intake (Web UI)

**Precondition:** Contract is `pending_data`, employee is logged in.

1. Employee navigates to `/dashboard/my-profile/complete`
2. System shows TaskRunner with identity group fields (personal_number, address, postal_code, city)
3. Employee fills in fields and clicks "Lagre"
4. System calls `admin_submit_employee_pii` RPC
5. System shows success message
6. Employee can navigate to banking group for next submission

**Postcondition:** Same as chat journey.

---

## Journey: Employee Signs Contract

**Precondition:** Contract data intake complete, `contract_signing` engine_process running.

1. Employee receives signing task
2. Employee reviews contract terms (review_terms step)
3. Employee acknowledges rights from framework_rule cards (acknowledge_rights step)
4. Employee signs via embedded DocuSeal (sign step via collect_signature action)
5. DocuSeal webhook confirms signature
6. Contract status transitions to `signed`, framework_snapshot becomes immutable

**Postcondition:** Employment contract signed, framework_snapshot locked, visible on `/dashboard/my-contract`.

**Error paths:**
- Employee declines signing: contract status transitions to `declined`, decline_reason_code + decline_reason_text saved, admin notified

---

## Journey: Employee Declines Data Intake

**Precondition:** Contract is `pending_data`, Botsson presents intake group.

1. Employee tells Botsson they don't want to provide the data
2. Botsson calls `decline_intake` tool with reason_code
3. Engine_state_step marked as `failed` with refusal reason
4. Botsson says "Din administrator vil folge opp" and stops — does NOT re-ask
5. Admin receives notification about the decline
6. Contract status transitions to `declined`

**Postcondition:** Contract declined, admin notified, Botsson does not negotiate.

---

## Journey: Admin Fills PII on Behalf of Employee (Bypass)

**Precondition:** Employee declined intake or is unable to provide data. Admin is logged in.

1. Admin navigates to `/dashboard/people/[id]/complete-data` (behind secondary menu)
2. System shows warning: "Den ansatte vil bli varslet"
3. Admin selects field group (Identitet / Bank / Adresse)
4. Admin fills in values
5. Admin writes justification (min 10 characters required)
6. Admin confirms in modal
7. System calls `admin_submit_employee_pii` SECURITY DEFINER RPC
8. RPC verifies admin/owner role, writes to profile, creates audit trail entry, notifies employee
9. PII values are NOT logged in audit trail — only field_group + reason

**Postcondition:** Employee profile updated, audit trail written, employee notified, contract can proceed.

**Error paths:**
- Reason too short: form validation blocks submission
- Not admin/owner: RPC throws access denied

---

## Journey: Admin Views Compliance Drift

**Precondition:** Signed contract exists with framework_snapshot. Framework rules have changed since signing.

1. Admin navigates to `/dashboard/contracts/[id]`
2. System queries `compliance_drift` materialized view
3. If drift detected: admin sees drift summary showing rule changes (added, modified, deleted)
4. Admin can click "Regenerer fra framework" to re-derive a draft with current rules
5. Re-derivation creates a new draft (NOT modifying the signed contract)
6. Compliance drift is read-only signal — NO automatic re-derivation (ADR-0080)

**Postcondition:** Admin is informed of regulatory changes. Can choose to create a new contract version.

---

## Journey: Admin Revises Sent Contract

**Precondition:** Contract is sent/signed/pending_data. Admin wants to change terms.

1. Admin navigates to `/dashboard/contracts/[id]` and clicks "Rediger"
2. System creates new employment_contract row with `parent_contract_id = current`, status `draft`
3. Admin modifies terms in composition wizard (pre-filled)
4. Admin sends the new version
5. Old DocuSeal envelope is voided (if applicable)
6. New version has its own framework_snapshot
7. Lineage is tracked via `parent_contract_id` FK chain

**Postcondition:** New contract version created, linked to parent. Active query uses `status = 'signed' AND no child with status = 'signed'` (ADR-0082).

---

## Journey: Employee Views Contract

**Precondition:** Employee has an employment contract.

1. Employee navigates to `/dashboard/my-contract`
2. System shows active (signed) contract as hero card: position, rate, percentage, start date
3. Historical contracts shown below with reduced opacity
4. Employee can tap a contract to see detail view

**Postcondition:** Employee sees their contract status and terms.

---

## Journey: Escalation (Day 3/7/10)

**Precondition:** Contract is `pending_data`, employee has not completed intake.

1. Day 3: `fire-delayed-triggers` fires nudge event, employee gets reminder notification
2. Day 7: second reminder fires
3. Day 10: escalation fires, admin gets notification about the stalled intake
4. If employee completes intake at any point: pending triggers are cancelled via `cancelled_at` column

**Postcondition:** Admin is aware of stalled intakes. Cancelled triggers are skipped by the cron.
