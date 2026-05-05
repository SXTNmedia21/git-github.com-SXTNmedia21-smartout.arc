---
title: User Journeys — employee-contract-management
status: superseded
superseded_by: docs/architecture/contract-service/JOURNEY-contract-module.md
updated: 2026-04-29
created: 2026-04-07
module: contracts
tags: [contracts, docuseal, botsson, employee, journey]
---

# User Journeys — Employee Contract Management

> Workspace admins create, send, and track employee contracts via DocuSeal e-signing. Botsson AI handles the same flows via voice/text. Webhook propagates signing state to `employment_contract`.

## Roles

- **Admin / Owner** — workspace-scoped role required to create or send contracts
- **Manager** — read-only access to contracts, cannot create/send
- **Employee** — recipient of the contract; receives signing link via DocuSeal email
- **Botsson** — AI assistant that surfaces contract tools to admins

---

## Journey 1: Admin sends a contract from the People list

**Precondition:**
- Admin or owner is logged into the dashboard
- An employee profile exists in the workspace
- The employee profile has an associated `user_identity` with an email address
- At least one active employee contract template exists for the workspace (3 system templates seeded by migration: Fast ansatt, Deltid, Tilkallingsvikar)

**Steps:**

1. Admin navigates to `/dashboard/people`
   → System renders the people DataTable with all workspace profiles
   → Admin sees a row per employee with status, role, department

2. Admin clicks the `⋯` actions menu on an employee row
   → System opens the dropdown menu showing available actions

3. Admin clicks "Send kontrakt" (gated on profile_id existing)
   → System opens the ContractSendDrawer (slide-in Sheet from the right)
   → Drawer shows step 1 of 3: Template Selection

4. System fetches `GET /api/contracts/templates?workspace_id={id}`
   → Route applies RLS scoping
   → Returns active employee templates (system-level + workspace-specific)
   → Drawer renders templates as cards (≤3 templates) or radio list (>3)

5. Admin clicks a template card (e.g. "Arbeidsavtale — Fast ansatt")
   → Drawer marks template as selected
   → "Neste" button becomes enabled

6. Admin clicks "Neste"
   → Drawer transitions to step 2: Data Review
   → Drawer displays auto-filled placeholder values from the template definition
   → Each field shows source label ("Fra profil", "Fra arbeidsavtale", "Manuelt")
   → Editable fields allow override

7. Admin reviews and (optionally) edits override fields
   → Drawer keeps `overrides` state in sync

8. Admin clicks "Neste" → step 3: Preview & Send
   → Summary card shows template name, employee name, key fields

9. Admin clicks "Send kontrakt"
   → System opens AlertDialog: "Bekreft sending — kontrakten kan ikke kalles tilbake etter sending"

10. Admin clicks "Bekreft" in the dialog
    → Drawer fires `POST /api/contracts` with body `{workspace_id, profile_id, template_id, overrides}`
    → Route validates Zod schema (returns 400 if shape wrong)
    → Route verifies caller has admin/owner role via user-scoped supabase query (returns 403 if not)
    → Route builds employee placeholder map from profile + employment_contract + workspace + company (parallel queries)
    → Route resolves recipient_email from profile.user_identity
    → Route calls contract-service `POST /contracts` with X-Service-Key auth and full payload
    → Contract service creates DocuSeal submission, returns `{contract_id, status: "draft", ...}`
    → Route uses admin client to set `employment_contract.signing_contract_id = contract_id` (cross-table system operation)
    → Route fires `void emit({event: "contract created", workspace_id, actor_id, properties: {entity, data}})`
    → Route returns 201 with the contract object

11. Drawer fires `POST /api/contracts/{contract_id}/send`
    → Route verifies contract is in draft status
    → Route calls contract-service `/contracts/{id}/send` with X-Service-Key
    → Contract service triggers DocuSeal envelope send (email goes to employee)
    → Route fires `void emit({event: "contract sent"})`
    → Route returns success

12. Drawer shows toast: "Kontrakt sendt til {recipient_name}"
    → Drawer closes
    → onSuccess callback refreshes the people DataTable

**Postcondition:**
- A new row exists in `contract` table with `contract_type='employee'`, `status='sent'`
- `employment_contract.signing_contract_id` points to the new contract row
- DocuSeal submission was created and notification email was sent to employee
- Telemetry events fired: `contract created`, `contract sent`
- Activity trail records the mutation with admin as actor

**Error paths:**

- **Drawer closed before sending:** All local state (selected template, overrides) is reset on drawer close
- **Templates fetch fails:** Drawer shows skeleton then empty state "Ingen maler tilgjengelig"
- **Employee has no email:** Route returns 400 with "Employee has no email address", drawer shows error toast
- **Caller is not admin/owner:** Route returns 403, drawer shows error toast
- **Contract service unavailable (CONTRACT_SERVICE_URL not set):** Route returns 503, drawer shows error toast
- **Contract service error:** Route returns the upstream error code/body, drawer shows error toast
- **Send fails after create:** Contract exists in `draft` status but is not sent. Admin can retry from `/dashboard/contracts` overview page or via Botsson `send_employee_contract` tool. Drawer stays open with error toast.

---

## Journey 2: Admin tracks contracts on the overview page

**Precondition:**
- Admin or owner is logged in
- One or more contracts exist for the workspace

**Steps:**

1. Admin navigates to `/dashboard/contracts`
   → System renders ContractsPage with the DataTable

2. System fetches `GET /api/contracts?workspace_id={id}&page=1`
   → Route returns contracts for `contract_type='employee'`, paginated (page size 20), sorted by `created_at desc`
   → DataTable shows columns: recipient name, status badge, sent date, signed date, actions

3. Status badges are color-coded using semantic OKLCH tokens (no hardcoded palette colors):
   - draft: muted
   - sent: primary
   - viewed: primary subtle
   - signed: primary filled
   - expired: destructive
   - cancelled: muted with strikethrough

4. Admin filters by status using the dropdown
   → DataTable resets to page 1 and refetches with `status` filter

5. Admin clicks the `⋯` actions menu on a row
   → Menu shows: Vis detaljer, Send på nytt, Avbryt
   → Send/Cancel actions are disabled for `signed` and `cancelled` contracts

6. Admin clicks "Send på nytt" on a `sent` contract
   → DataTable fires `POST /api/contracts/{id}/send`
   → Route validates contract is draft (returns 400 if already sent)
   → DataTable refreshes

**Postcondition:**
- Admin sees current state of all employee contracts in the workspace
- All actions emit telemetry via the underlying API routes

---

## Journey 3: Employee receives and signs the contract

**Precondition:**
- A contract has been created and sent (Journey 1 completed)
- Employee has access to email

**Steps:**

1. Employee receives email from DocuSeal with signing link
   → Email contains link to DocuSeal submission page

2. Employee clicks the link
   → DocuSeal opens the contract preview in browser

3. DocuSeal fires `form.viewed` webhook to `/api/webhooks/docuseal`
   → Webhook handler validates X-DocuSeal-Signature
   → Updates `contract.status = 'viewed'` and `contract.viewed_at = now()`
   → Inserts `contract_event` audit row
   → Fires `void emit({event: "contract viewed"})`

4. Employee reviews contract content, fills any required fields, signs
   → DocuSeal records the signature

5. DocuSeal fires `form.completed` webhook
   → Webhook handler updates `contract.status = 'signed'`, `signed_at = now()`, `signed_pdf_url`
   → Cancels pending contract reminders
   → **Branches on `contract_type`:**
     - `'employee'` → updates `employment_contract.status = 'signed'`, `document_url`, `signed_at` via admin client `WHERE signing_contract_id = contract_id`
     - SaaS contracts → updates `workspace.contract_status = 'active'` (existing legacy behavior)
   → Calls contract-service `/contracts/{id}/fetch-documents` to backfill audit log + PDF
   → Fires `void emit({event: "contract signed"})`

**Postcondition:**
- `contract.status = 'signed'`, `signed_pdf_url` populated
- `employment_contract.status = 'signed'`, `signed_at` populated
- Activity trail and engine_event capture the lifecycle
- HR record is now complete with link to legal signing entity

**Error paths:**

- **Employee declines:** DocuSeal fires `form.declined` webhook → contract status set to `'declined'` → for employee contracts, `employment_contract.status` set to `'terminated'` (closest valid enum value, since `contract_status` enum has no `declined` — see ADR-2 in feature decision log)
- **Contract expires:** DocuSeal fires expiry webhook → contract status set to `'expired'`
- **Webhook signature invalid:** Returns 401, no state change
- **Out-of-order webhooks:** Status weight check prevents regression (e.g. a `viewed` event after `signed` is silently skipped)

---

## Journey 4: Botsson creates and sends a contract via voice/text

**Precondition:**
- Admin is engaged with Botsson via voice or chat
- Admin has admin or owner role in the workspace
- Authority level is `suggest`, `confirm`, or `autonomous`

**Steps:**

1. Admin says: "Vis meg tilgjengelige kontraktmaler"
   → Intent classifier routes to `contract` capability
   → Tool selector returns `readOnlyTools` for the contract capability (3 read tools)
   → Botsson calls `list_employee_templates` tool
   → Tool queries `contract_template` via `ctx.supabaseAdmin` filtered by `contract_type='employee'`, `is_active=true`, `workspace_id matches OR is null`
   → Tool returns JSON with `template_id`, `name`, `description`, `created_at` for each template
   → Botsson reads the response and tells the admin the available templates

2. Admin says: "Lag en kontrakt for Anna Hansen"
   → Botsson identifies Anna's profile (via prior context or `get_employee` tool)
   → Botsson selects the appropriate template
   → Tool selector at `suggest` level surfaces `create_employee_contract` (it's in `suggestTools`)
   → Botsson proposes the action — UI confirmation flow gates execution

3. Admin confirms in the UI
   → Botsson calls `create_employee_contract` tool with `{template_id, profile_id}`
   → Tool runs role guard: `resolveActorRole(ctx)` queries `profile.role` for the actor
   → Tool returns "Access denied" if not admin/owner
   → Tool builds employee placeholder map via shared `buildEmployeePlaceholderMap` from `@smartout/utils`
   → Tool fetches recipient_email from profile → user_identity (parallel query)
   → Tool calls contract-service `POST /contracts` with `X-Service-Key` header and 10s AbortController timeout
   → Tool fires `void emit({event: "contract created", source not in payload, actor_id=ctx.profileId, properties.entity, properties.data: {template_id, recipient_email, contract_type: "employee"}})` — same shape as REST route
   → Tool returns success message with `contract_id`

4. Admin says: "Send kontrakten"
   → Tool selector at `suggest` level surfaces `send_employee_contract` (also in `suggestTools` — irreversible, requires confirm)
   → Botsson proposes the send action
   → Admin confirms in the UI

5. Botsson calls `send_employee_contract` tool with `{contract_id}`
   → Tool runs role guard
   → Tool verifies contract status is `draft` AND `contract_type === "employee"` (rejects non-employee contracts even if id is valid)
   → Tool calls contract-service `/contracts/{id}/send` with X-Service-Key + 10s timeout
   → Tool returns success message

**Postcondition:**
- Same as Journey 1, but the actor of record is the admin profile (not Botsson)
- Telemetry events flow through the same `emit()` pipeline as the REST route
- All four destinations are covered: PostHog, logger, activity_trail, engine_event-where-routed

**Error paths:**

- **Authority too low (read_only):** Tool selector does not surface `create_employee_contract` at all — Botsson cannot propose the action
- **Caller not admin/owner:** Tool returns "Access denied" string, Botsson reports back
- **Contract service timeout (>10s):** Tool returns "Contract service timed out after 10 seconds"
- **Service unavailable:** Tool returns "Contract service is not configured"

---

## Cross-cutting concerns

### State ownership
| State | Owned by | Mutated by |
|-------|----------|------------|
| `contract.status` | `contract` table | DocuSeal webhook only |
| `contract.signed_pdf_url` | `contract` table | DocuSeal webhook only |
| `employment_contract.signing_contract_id` | `employment_contract` | Dashboard API at send time (set once) |
| `employment_contract.status` | `employment_contract` | Webhook propagation from `contract.status` (declined → terminated mapping) |
| `employment_contract.document_url` | `employment_contract` | Webhook copies from `contract.signed_pdf_url` |
| `employment_contract.signed_at` | `employment_contract` | Webhook sets on signing |
| `workspace.contract_status` | `workspace` | SaaS contract webhook ONLY — never from employee contracts |

### Authorization
- **REST routes** (POST /api/contracts): user-scoped client query of `profile.role`, requires `admin` or `owner`
- **Botsson tools** (create_employee_contract, send_employee_contract): in-tool `resolveActorRole(ctx)` guard
- **GET routes**: rely on RLS for row-level filtering (admin sees workspace contracts, employees see only their own via FK join)
- **DocuSeal webhook**: validates `X-DocuSeal-Signature` header against `DOCUSEAL_WEBHOOK_SECRET`

### Telemetry coverage
Every mutation in this feature emits via `emit()` from `@smartout/telemetry`:
- POST /api/contracts → `contract created`
- POST /api/contracts/{id}/send → `contract sent`
- POST /api/contracts/{id}/cancel → `contract cancelled`
- DocuSeal webhook → `contract viewed`, `contract signed`, `contract declined`, `contract expired`
- Botsson `create_employee_contract` → `contract created` (same registry event, parallel emission site)

### Known gaps
- Type regen + `as never` cast cleanup deferred (closure-blocker, gated on Supabase Local migration drift resolution)
- PII handling decision for personnummer in placeholder map deferred (closure-blocker, needs ADR)
- E2E happy-path test (with seeded contract service + templates) not yet written — only API gate regression tests in `apps/e2e/tests/contracts-api.spec.ts`
