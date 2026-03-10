---
title: "User Journeys — client-contract"
status: done
updated: 2026-03-10
created: 2026-03-10
module: contracts
tags: [contracts, platform-admin, docuseal, journeys]
---

# User Journeys — client-contract

## Journey: Platform Admin Creates and Sends Contract

**Precondition:** Admin is logged in with `is_godmode` access. Contract templates exist. Contract-service is running.

1. Admin navigates to `/platform-admin/contracts` → System fetches all contracts + events via server-side query → Admin sees sortable/filterable data table with status badges and visual tracking dots
2. Admin clicks "Ny kontrakt" → System navigates to `/platform-admin/contracts/new`
3. Admin selects template, company, recipient name + email → System validates via Zod schema
4. Admin submits → API creates draft contract record in DB, logs `contract created` telemetry event
5. If contract-service is configured: API auto-sends via microservice → contract-service resolves placeholders, creates DocuSeal submission, schedules reminders → Status becomes `sent`
6. If contract-service is NOT configured: contract saved as `draft` with warning → Admin can later send via detail page

**Postcondition:** Contract exists in DB. If sent, DocuSeal submission created, signing email dispatched, reminders scheduled.

**Error paths:**

- Template not found → 404 response
- Missing recipient email → 400 validation error
- Contract-service unreachable → Contract saved as draft with warning "Contract microservice unreachable"

---

## Journey: Platform Admin Views Contract Detail

**Precondition:** Contract exists.

1. Admin clicks a contract row → System navigates to `/platform-admin/contracts/[id]`
2. System fetches contract + events + reminders in parallel → Admin sees:
   - Header with title, contract number, status badge
   - Action buttons (send, cancel, download PDF, download audit log)
   - Contract info card (type, template, workspace, sender, recipient, timestamps)
   - Event timeline with icons and details
   - Reminder schedule table
3. If contract has DocuSeal submission but missing audit log/documents → "Hent dokumenter fra DocuSeal" button appears
4. Admin clicks fetch button → API calls contract-service → Documents stored on contract record → Page refreshes

**Postcondition:** Admin has full visibility into contract lifecycle.

---

## Journey: Platform Admin Sends Draft Contract

**Precondition:** Contract is in `draft` status. Contract-service is running.

1. Admin opens contract detail → Sees "Send" action button
2. Admin clicks Send → API calls contract-service `/contracts/:id/send`
3. Contract-service resolves any unresolved placeholders → Transforms HTML for DocuSeal → Creates submission with Leverandør (auto-signed) + Kunde parties → Stores signing URL + embed URL → Schedules reminders → Logs `sent` event
4. Admin sees status update to `sent`

**Postcondition:** Contract sent via DocuSeal. Recipient receives signing email. Reminders scheduled.

**Error paths:**

- Contract-service not configured → 503 "Contract microservice not configured"
- Contract not in draft → 400 "Cannot send contract in status: {status}"
- DocuSeal API error → 502 with error message

---

## Journey: Platform Admin Cancels Contract

**Precondition:** Contract is in `draft`, `sent`, or `viewed` status.

1. Admin opens contract detail or uses dropdown menu → Clicks Cancel
2. API calls contract-service `/contracts/:id/cancel`
3. Contract-service sets status to `cancelled` → Skips pending reminders → Logs `cancelled` event
4. Telemetry emits `contract cancelled`

**Postcondition:** Contract cancelled. Pending reminders skipped.

**Error paths:**

- Contract already signed/active/cancelled → 400 "Cannot cancel contract in status: {status}"

---

## Journey: Recipient Signs Contract (Webhook Flow)

**Precondition:** Contract is `sent`. Recipient has signing URL.

1. Recipient opens DocuSeal signing link → DocuSeal fires `form.viewed` webhook
2. Webhook handler finds contract by `docuseal_submission_id` → Checks status weight (viewed > sent) → Updates status to `viewed`, sets `viewed_at` → Logs event to `contract_event` + `platform_audit_log` → Emits `contract viewed` telemetry

3. Recipient signs → DocuSeal fires `form.completed` or `submission.completed` webhook
4. Webhook handler: status weight (signed > viewed) → Updates status to `signed`, sets `signed_at`, stores document URLs, updates signatories → Cancels pending reminders → Updates workspace `contract_status` to `active` → Triggers async document fetch from DocuSeal → Logs events → Emits `contract signed` telemetry

**Postcondition:** Contract signed. Documents stored. Workspace marked as active contract holder. Reminders cancelled.

**Error paths:**

- Out-of-order webhooks → Status weight prevents regression (silently acknowledged)
- Contract not found by submission ID → 404 (webhook ignored)

---

## Journey: Recipient Declines Contract (Webhook Flow)

**Precondition:** Contract is `sent` or `viewed`.

1. Recipient declines in DocuSeal → `form.declined` webhook fires
2. Webhook handler: sets status to `declined`, stores `declined_at` and `decline_reason` → Cancels pending reminders → Logs events → Emits `contract declined` telemetry

**Postcondition:** Contract declined. Reminders cancelled. Decline reason stored.

---

## Journey: Contract Expires (Webhook Flow)

**Precondition:** Contract is `sent` or `viewed`. Expiry date passed.

1. DocuSeal fires `submission.expired` webhook
2. Webhook handler: sets status to `expired` → Logs events → Emits `contract expired` telemetry

**Postcondition:** Contract expired.
