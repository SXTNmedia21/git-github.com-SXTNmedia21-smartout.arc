---
title: Contract System Phase 2-3 — Template Binding, Intake Agent, Notifications
status: done
updated: 2026-04-22
created: 2026-04-14
module: contracts
tags: [journey, contracts, ai-agent, notifications, template-binding]
---

# Contract System Phase 2-3 Journey

Three features shipping together complete the contract lifecycle from admin-side template setup through employee PII collection to event notifications.

> **Redesign note (2026-04-22):** Bindings UI moved from Settings (`/dashboard/settings → Kontraktmaler` tab) to the contracts hub (`/dashboard/contracts → Bindinger` tab) per council 2026-04-22 (Q2 resolution). The `/settings/contracts` route is retired. Component logic and data flow unchanged — only navigation moved.

## Feature 1 — Contract Template Binding UI

### Journey: Admin binds template to lønnsgruppe

**Precondition:** Admin is logged into workspace, has role admin or owner, at least one contract template exists.

1. Admin navigates to **Kontrakter** → **Bindinger** tab → System renders BindingMatrix (3 columns: Fast/Deltid/Tilkalling × N rows: Workspace standard + employee groups) → Admin sees current bindings or empty cells with "Knytt mal" ghost button
2. Admin clicks empty cell → CategoryBindSheet slides in → Admin picks template from Select, sets priority, confirms → System POSTs to `/api/contract-template-bindings` → emits `template_binding created` → BindingMatrix refreshes showing new binding
3. Admin clicks deactivate on existing binding → System PUTs `is_active: false` → emits `template_binding updated` → cell shows muted with "Aktiver" action
4. Admin edits binding → Same Sheet opens in edit mode → Admin changes template or priority → PUT `/api/contract-template-bindings/[id]` → matrix updates
5. Admin deletes binding → System DELETE → emits `template_binding deleted` → cell returns to empty state

**Postcondition:** `contract_template_binding` table reflects admin's configuration. Template resolution at contract creation time respects priority-ordered cascade (group-specific → workspace-category → system fallback).

**Error paths:**
- Non-admin user: API returns 403 Forbidden
- Duplicate (workspace_id, employment_category, employee_group_id): POST upserts (no error)
- Network failure: toast.error surfaced, no partial state

### Mobile variant
Below `md:` breakpoint: card-stack layout — one card per row (workspace default + each group), with 3 labeled category sections inside each card. Same data, same actions, vertical scroll instead of horizontal matrix.

---

## Feature 2 — Contract Intake Agent

### Journey: Admin sends contract to employee with missing PII

**Precondition:** Contract template is bound via Feature 1. Admin creates an employment contract for an employee whose PII is incomplete (no personnummer, bank account, or address on profile).

1. Admin creates contract via composition wizard → System POSTs to `/api/employment-contracts` → resolveComposition runs template cascade → contract saved with status `pending_data`
2. Admin clicks "Send" → `/api/employment-contracts/[id]/send` detects missing PII → creates `engine_state` with process_id=`contract_data_intake` → inserts `emma_task` row (mission=`contract_intake`, status=`triggered`, profile_id=employee)
3. Admin sees contract in "Venter på ansatt" bucket on dashboard

### Journey: Employee completes PII intake via chat

**Precondition:** Employee logs into app, has a `pending_data` contract with active `emma_task`.

1. Employee opens app → `useEmmaTriggeredTasks` polls `/api/emma/tasks` → detects mission=`contract_intake` task → BotssonProvider opens chat panel with prime context
2. Employee types "Hei" → Frontend POSTs to `/api/emma/chat` with JWT → proxy resolves profile_id/workspace_id → injects prime context ("Ansatt har ventende arbeidsavtale som mangler personopplysninger...") → forwards to stage-engine `/agent/chat` with user_jwt
3. Stage-engine creates user-scoped Supabase client from JWT → router classifies intent as `contract_intake` → selectTools enforces `allowedChannels: ["chat"]` (ADR-0078) → returns identity/banking/address intake tools
4. Agent asks for personnummer + address → Employee provides → `submitFieldGroup` called with group=`identity` → validates via `validatePersonnummer` (Modulus 11) → calls `submit_own_pii` RPC via **user-scoped client** (not service role, so `auth.uid()` resolves correctly) → PII written to profile table
5. Tool calls `check_contract_intake_completion` RPC → returns `{ complete: false, contract_id }` → tool returns `{ saved: true, group: "identity", complete: false }` (NEVER the actual PII values)
6. Agent asks for bank account → Employee provides → Same flow → `validateNorwegianBankAccount` (Modulus 11) → `submit_own_pii` with group=`banking`
7. `check_contract_intake_completion` detects all fields present → updates contract status to `ready_to_send` → inserts `contract_event` (event_type=`intake_complete`) → updates `engine_state.status=complete` → returns `{ complete: true, contract_id }`
8. Agent delivers closing message: "Takk! Administrator vil sende kontrakten din snart." → `emma_task` dismissed

**Postcondition:** Employee's PII is stored in `profile` table. Contract is in `ready_to_send` status. Admin is notified (via Feature 3). Conversation history contains zero PII values.

**Error paths:**
- Employee declines → `declineIntake` tool → updates `employment_contract.status=declined`, `contract_event` event_type=`intake_declined` → notifies admin
- Invalid personnummer (fails Modulus 11) → tool returns validation error → agent re-asks
- JWT expires mid-conversation → `/api/emma/chat` 401 → frontend refreshes session

### Security guarantees
- PII written via `submit_own_pii` RPC with `auth.uid()` check — employee can only write their own profile
- PII never returned from tools or echoed in conversation turns
- `allowedChannels: ["chat"]` enforced at 3 layers: API route (channel hardcoded), tool-selector (filters capabilities), tool.execute (channel guard)
- `sensitivity: pii` tag blocks memory writes during intake session

---

## Feature 3 — Contract Event Notifications

### Journey: Automated notification on contract state change

**Precondition:** `contract_event` INSERT happens (from any path: admin action, DocuSeal webhook, cron, agent RPC).

1. Trigger `trg_contract_event_notify` fires AFTER INSERT → `dispatch_contract_notification()` runs in same transaction
2. Function resolves recipients:
   - Employee via `contract → employment_contract → profile_id`
   - Admin via `contract.created_by`
3. Function inserts `notification_outbox` rows per recipient per channel (routing table in SQL):

| Event | Employee | Admin | Channels |
|---|---|---|---|
| contract_created | yes | no | push, in_app |
| contract_sent | yes | no | email, push, in_app |
| contract_viewed | no | yes | in_app |
| contract_signed | yes | yes | email, push, in_app |
| contract_declined | no | yes | email, in_app |
| contract_expired | yes | yes | email, in_app |
| intake_complete | no | yes | in_app, push |
| reminder_due | yes | no | email, push |

4. For priority=2 events (signed, expired): `trg_critical_notification_dispatch` fires immediately, calls `process-notifications` Edge Function
5. For priority=0-1 events: 30-second `process-notifications` cron picks up outbox rows
6. `process-notifications`:
   - Applies quiet hours check → defers if needed
   - Inserts `notification` row (in-app, Realtime-enabled)
   - Fans out to `push-dispatch` (Expo tokens) and SendGrid (email) per `allowed_channels`
   - Looks up `message_template` by key (e.g. `contract.employee.sent`), renders body in recipient locale
7. Employee sees push notification + in-app bell badge + email with deep link

**Postcondition:** All relevant parties notified in their preferred channels. Audit trail in `contract_event` and `notification` tables.

### Journey: Reminder for unsigned contract

**Precondition:** Contract sent but not signed within 3 days.

1. `contract_reminder` rows inserted at contract send time: +3 days, +7 days, +10 days
2. `contract-lifecycle` Edge Function runs on cron → queries `contract_reminder WHERE status='scheduled' AND scheduled_at <= now()`
3. For each due reminder: check contract still in `sent` status (skip if signed/declined/expired) → insert outbox row with `reminder_due` event → mark reminder `sent`
4. `process-notifications` delivers email + push: "Påminnelse: Arbeidsavtalen venter på signering"

**Postcondition:** Employee receives up to 3 reminders before contract expires. Each delivery logged in `contract_reminder.sent_at`.

### Error paths
- Missing employment_contract (contract for not-yet-profiled recipient): trigger uses IF FOUND guard, silently skips
- Missing push token: push-dispatch skips push channel, email/in-app still deliver
- Critical event + no push token: SMS fallback via Twilio (contract.signed, contract.expired)
- Quiet hours: priority<2 events defer; priority=2 events bypass

---

## Integration points between the 3 features

```
Feature 1 (Template Binding)
   │ resolveTemplate() finds correct template
   ▼
Admin creates contract
   │ → contract table status=pending_data
   │ → employment_contract table
   │ → contract_event INSERT (event_type=created) ─────┐
   ▼                                                    │
Feature 2 (Intake Agent)                               │
   │ emma_task triggered                                ├─► Feature 3 (Notifications)
   │ employee chats with Emma                           │    │
   │ submit_own_pii → profile                           │    │ notification_outbox
   │ check_contract_intake_completion                   │    │    ↓
   │ → contract status = ready_to_send                  │    │ process-notifications
   │ → contract_event (intake_complete) ────────────────┤    │    ↓
   ▼                                                    │    │ email + push + in_app
Admin sends to DocuSeal                                 │    │
   │ contract_event (sent) ──────────────────────────────┘    │
   ▼                                                         │
Employee signs in DocuSeal                                   │
   │ webhook → contract_event (signed) ───────────────────────┘
   ▼
Contract active
```

## Known debt

- Component file size (contract-template-bindings-settings.tsx at 547+ lines) — should decompose into sub-component files
- No Framer Motion entrance animations on matrix rows
- No E2E tests specific to these features (covered by happy-path contract E2E)
- Mobile UI for template binding management not yet in React Native app (web-only for now)
