---
title: "User Journeys — Billing Engine Fase 2"
status: done
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [journey, billing, dispatch, integration, fase-2]
---

# User Journeys — Billing Engine Fase 2

> CLAUDE.md feature-closure gate: every flow this feature enables is documented. Fase 2 ships three spors (dispatch + integration + invoice editing) plus an AI tool. 8 primary journeys below.

Fase 2 spec: `docs/superpowers/specs/2026-04-17-billing-engine-fase-2-design.md`. ADRs: 0126 (engine-orchestrated integration sync), 0127 (dispatch rule 2-level with suppress), 0128 (invoice.delivery_\* deprecation), 0129 (adapter placeholder audit), 0130 (contract onboarding extracted to Fase 2.5).

---

## Journey 1: Platform-admin creates a default dispatch rule

**Actor:** Platform admin (`user_identity.is_godmode = true`).

**Precondition:** Platform admin logged in. At least one company + recurring-invoice workflow exists.

1. Admin navigates to `/platform-admin/billing/settings/dispatch`.
2. `DispatchRulesPage` renders a platform-rules table (reading `billing_dispatch_rule` WHERE workspace_id IS NULL).
3. Admin clicks **Legg til regel** → `DispatchRuleSheet` opens as a side drawer (Nordic Split motion spec: slide-in 240ms).
4. Admin fills form: channel = `email_internal`, trigger_event = `invoice generated`, target = `{email:"audit@smartout.no"}`, action = `send`, is_enabled = true.
5. Admin submits → client calls `createPlatformDispatchRuleAction` → Zod validates → platform-gate via `getSuperAdminId` → INSERT into `billing_dispatch_rule` with workspace_id = NULL → emit `dispatch_rule created`.
6. Sheet closes → toast "Regel opprettet" → table revalidates and shows the new rule.

**Postcondition:** Platform-default rule active. The next time `invoice generated` fires for ANY company, `enqueueDispatchesForInvoice` resolves `effective_dispatch_rules` and queues an email dispatch to `audit@smartout.no`.

**Error paths:**

- Zod validation fails (missing target.email) → first issue message toast.
- CHECK `dispatch_rule_platform_action` rejects platform rule with action=`suppress` (platform rules cannot suppress themselves) → toast "Platform-regler kan ikke ha suppress-action".
- Unauthorized (non-superadmin) → toast "Uautorisert".

---

## Journey 2: Workspace-admin adds an own dispatch recipient

**Actor:** Workspace admin (profile.role in `owner`/`admin` for the workspace).

**Precondition:** Workspace exists. Company is on a paying plan. Workspace admin logged in via SSO to `{slug}.smartout.ai/dashboard/billing/dispatch`.

1. Admin navigates to `Innstillinger → Faktura-leveranse`.
2. `WorkspaceDispatchRulesPage` renders two sections:
   - **Platform-regler (arvet)** — read-only list of platform-default rules.
   - **Mine regler** — workspace-scoped table (workspace_id = current workspace).
3. Admin clicks **Legg til egen regel** → `DispatchRuleSheet` opens with workspace_id pre-filled.
4. Admin fills: channel = `email_customer`, trigger_event = `invoice sent`, target = `{email:"regnskap@bedrift.no"}`, action = `send`.
5. Submit → `createWorkspaceDispatchRuleAction` → RLS-guarded INSERT → emit `dispatch_rule created` (workspace scope).
6. Sheet closes → row appears in "Mine regler" table.

**Postcondition:** Next `invoice sent` for this workspace fans out to BOTH platform rules AND this workspace rule (union semantics per ADR-0127).

**Error paths:**

- Zod validation → toast with first issue.
- RLS reject (wrong workspace) → generic "Handlingen ble avvist" toast.

---

## Journey 3: Workspace-admin suppresses a platform default

**Actor:** Workspace admin who wants to opt out of the platform default `email_internal` notification for their invoices.

**Precondition:** Platform rule exists for trigger `invoice issued` with `action=send`. Workspace admin viewing `Innstillinger → Faktura-leveranse`.

1. Admin spots the platform rule in "Platform-regler (arvet)" with a "Undertrykk" button.
2. Admin clicks **Undertrykk** → confirmation dialog "Undertrykk platform-regel for denne workspace?".
3. Admin confirms → `suppressPlatformDispatchRuleAction` → INSERT workspace-scoped `billing_dispatch_rule` row with action=`suppress`, same channel + trigger_event, workspace_id = current workspace.
4. UI re-renders: platform row shows strike-through + badge "Undertrykket for din workspace".

**Postcondition:** The `effective_dispatch_rules` SQL function (ADR-0127) returns the UNION minus rows this suppress cancels. Next invoice triggers the platform rule will NOT fire for this workspace.

**Error paths:**

- Workspace already has a suppress for this channel+trigger → UPDATE rather than INSERT (idempotent).
- Unsuppress: click **Gjenopprett** → DELETE suppress row → platform rule re-engages.

---

## Journey 4: Platform-admin retries a failed dispatch

**Actor:** Platform admin reviewing a failed dispatch (email bounced, API 500).

**Precondition:** `invoice_dispatch` row exists with status = `failed` and `error_code` set.

1. Admin navigates to `/platform-admin/billing/invoices/[id]` → "Leveranser"-section.
2. Table shows each dispatch with channel + status badge (`DispatchStatusBadge` — red for failed).
3. Admin clicks the failed row → row expands to show `error_code` + `error_message` + `attempts`.
4. Admin clicks **Prøv på nytt** → confirmation dialog.
5. On confirm → `retryDispatchAction` → reset `invoice_dispatch.status = 'pending'`, attempts stays, spawn new `engine_state` pointing at this `invoice_dispatch_id`, emit `invoice dispatch retry_requested`.
6. `engine-dispatch` Edge Function picks up the new state on its next run → runs the adapter → sets status to `delivered` or `failed` again.
7. Admin refreshes (or realtime pushes) → status badge flips to green/red.

**Postcondition:** Retry recorded in `invoice_dispatch.attempts` (+1). Delivery either succeeds or stays failed with newer error_code.

**Error paths:**

- Adapter returns 429 (rate limit) with `retryable: true` → engine_state schedules `engine_delayed_trigger` with backoff — admin sees status = `pending` again.
- Adapter returns permanent error (`not_retryable`) → status stays `failed`; retry attempts are still bumped for audit.

---

## Journey 5: Platform-admin creates an ad-hoc invoice (Sheet drawer)

**Actor:** Platform admin needing to bill a one-off service (onboarding fee, consulting hours, workshop).

**Precondition:** Target company exists. Admin has `is_godmode`.

1. Admin navigates to `/platform-admin/billing/invoices` → **Ny ad-hoc faktura**.
2. `AdHocInvoiceSheet` opens (side drawer).
3. Admin selects company (autocomplete), currency, period_from/period_to (optional), due_at.
4. Admin adds line items inline via `LineItemEditor` — one row per service: `description`, `unit_price_ex_vat`, `quantity`, `vat_rate`, `workspace_id` (optional).
5. Sheet shows live totals: `amount_excl_vat`, `vat_amount`, `amount_incl_vat`.
6. Admin clicks **Opprett som utkast** → `createAdHocInvoiceAction` → Zod parse → INSERT invoice (status=`draft`, invoice_type=`ad_hoc`) → INSERT manual line_items with `source='manual'` → emit `invoice generated` (with ad_hoc flag).
7. Sheet closes → redirect to `/platform-admin/billing/invoices/[new_id]` in draft state.
8. Admin reviews → clicks **Utsted faktura** → `assignInvoiceNumber` trigger fires → status flips to `issued` → emit `invoice issued`.
9. Dispatch fan-out runs automatically (see Journey 1).

**Postcondition:** New `invoice` row with `invoice_type = 'ad_hoc'`. Line items immutable once issued (trigger: `prevent_issued_line_item_mutation`).

**Error paths:**

- Zod validation (empty line items, negative quantity) → toast with first issue, sheet stays open.
- Invoice number allocation race → 1 retry, then toast "Kunne ikke reservere fakturanummer".

---

## Journey 6: Workspace-admin marks their own invoice paid

**Actor:** Workspace admin (owner/admin role) settling an invoice they just paid via bank transfer.

**Precondition:** Invoice in `issued`, `sent`, or `overdue` status belonging to this workspace's company.

1. Admin navigates to `/dashboard/billing/invoices/[id]`.
2. Detail page shows invoice metadata + line items + a **Merk som betalt** button (only visible to owner/admin with `is_godmode = false`).
3. Admin clicks → `WorkspaceMarkPaidDialog` opens.
4. Admin fills `payment_channel` (bank_transfer / stripe / manual), `payment_reference` (KID or bilagsnr), optional `notes`.
5. Submit → `markInvoicePaidByWorkspaceAdminAction` → capability gate `billing_self_service_mark_paid` (ADR-0130 workspace-scope) → idempotency check → UPDATE invoice SET status=`paid` → emit `invoice marked_paid` (actor_role = 'workspace_admin').
6. Toast "Faktura markert som betalt" → badge flips from "Forfalt"/"Sendt" to "Betalt".

**Postcondition:** `invoice.status = 'paid'`, `paid_at` set, payment fields populated. Platform admins see the same paid state (no separate reconciliation step needed — workspace write is the source of truth).

**Error paths:**

- Capability disabled for this workspace (platform admin revoked it) → button hidden / 403 if called anyway.
- Wrong invoice state (already paid / void) → toast "Fakturaen kan ikke markeres som betalt i sin nåværende tilstand".
- Idempotency key replay → server returns existing result (no double-emit).

---

## Journey 7: Platform-admin creates a placeholder integration + tests connection

**Actor:** Platform admin setting up a Fiken integration ahead of Fase 3 real adapter.

**Precondition:** Target workspace exists. Admin has `is_godmode`.

1. Admin navigates to `/platform-admin/billing/integrations`.
2. `IntegrationsPage` renders a table of `billing_integration` rows (grouped by integration_type).
3. Admin clicks **Ny integrasjon** → `IntegrationSheet` opens.
4. Admin fills: workspace_id, integration_type = `fiken`, display_name = "Fiken — Bedrift AS", config = `{api_key_ref:"op://smartout_ai_prod/fiken/bedrift-as"}`, is_placeholder = `true` (Fase 2 default).
5. Submit → `createIntegrationAction` → platform gate → INSERT into `billing_integration` with `is_placeholder = true` → emit `billing_integration created`.
6. Sheet closes → row appears in table with badge "Placeholder" + green dot (is_enabled).
7. Admin clicks row → detail sheet shows **Test tilkobling** button.
8. Admin clicks → `testConnectionAction` → spawns one-shot `engine_state` with action_type=`sync_integration`, entity_type=`customer`, entity_id=(workspace.company_id) → engine runs PlaceholderAdapter → adapter returns `{status:"mocked"}` → emit `integration sync mocked` with `audit_note = "[PLACEHOLDER] No external call was made (ADR-0129)."`
9. Admin sees toast "Test fullført (mocked — ingen ekstern kall gjort)" + "Historikk"-tab shows the mocked sync row.

**Postcondition:** `billing_integration.last_sync_at` timestamp updated, `last_sync_status = 'ok'`. `engine_state` for the test terminates with status=`complete`. `billing_activity_log` has a `[PLACEHOLDER]`-prefixed row so auditors can distinguish mocked from real sync.

**Error paths:**

- ADR-0129 violation: if a real adapter is configured with `is_placeholder=true` and returns `succeeded` → handler fails the state, emits `integration audit violation`, last_sync_status = `error`. Reverse: real row + mocked result = same violation.
- Unknown integration_type → adapter returns `failed` with `error_code = 'unknown_integration_type'`.

---

## Journey 8: Workspace-admin asks chat "did my invoice go out?" (AI tool)

**Actor:** Workspace admin (or owner) on mobile/web, invoking Mr. Botsson in chat.

**Precondition:** Workspace admin logged in. Fase 2 invoice exists (has `invoice_dispatch` rows). `billing_query` capability enabled for this workspace.

1. User opens Botsson chat panel → types "Ble faktura 2026-0017 sendt ut?".
2. Intent classifier (`intent-classifier.ts`, Haiku) classifies → `capability: billing_query`, confidence ≥ 0.7.
3. Tool selector loads `billing_query` tools — filtered by `allowedChannels: ['chat']` (voice path would hard-refuse per ADR-0078).
4. Agent loop (Sonnet) calls `list_invoice_dispatches` with `invoice_id` resolved via a preceding `list_my_invoices` or `get_my_invoice` call.
5. Tool executes: `requireChatChannel` → OK → `resolveCompanyId(ctx)` → scope check (invoice.company_id = viewer's company) → SELECT from `invoice_dispatch` ordered by created_at DESC.
6. Tool masks email targets → `{email:"r***@bedrift.no"}` before returning JSON.
7. Agent narrates: "Faktura 2026-0017 ble sendt til r***@bedrift.no via e-post 17. april kl 09:59 — levert kl 10:00:03 (ekstern referanse: sg-msg-abc). Den ble også posta til Fiken-API kl 10:00, men feilet (timeout) etter 3 forsøk. Vil du at jeg skal be admin prøve API-posten på nytt?"
8. User sees the answer; no raw PII leaked.

**Postcondition:** `engine_sessions.collected_data.conversation` captures the exchange. No mutation occurred — this is a pure read.

**Error paths:**

- User asks via voice → capability `allowedChannels` rejects at selector level + tool guard rejects as belt-and-suspenders ("Error: billing tools are chat-only.").
- User asks about invoice from another company → tool returns "Invoice does not belong to your company." Agent narrates that the invoice isn't theirs.
- Pre-Fase-2 invoice → empty list → tool description instructs LLM to "sjekk `invoice.delivery_status` for historikk". Agent narrates a historical fallback.
- RLS blocks invoice lookup (row doesn't exist at all) → "Invoice not found."

---

## Cross-cutting behaviours

**Telemetry:** Every mutation in Journeys 1–7 emits via `@smartout/telemetry`. Registry in `packages/telemetry/src/registry.ts` routes:

- `dispatch_rule created` → PostHog + billing_activity_log
- `invoice_dispatch queued/delivered/failed/retry_requested` → billing_activity_log + engine_event
- `integration sync succeeded/mocked/failed` → billing_activity_log (mocked rows prefixed `[PLACEHOLDER]`)
- `integration audit violation` → PostHog + billing_activity_log + Sentry alert
- `invoice marked_paid` → PostHog + billing_activity_log

**Scope separation:** Platform-admin pages live under `/platform-admin/billing/**` with `getSuperAdminId` gate. Workspace-admin pages live under `/dashboard/billing/**` with RLS + capability checks. The two UIs share `@smartout/billing` server actions but the server actions themselves branch on caller identity.

**Dispatch rule cascade (ADR-0127):** `effective_dispatch_rules(invoice_id, trigger_event)` SQL function resolves platform defaults + workspace rules in one query, with workspace `suppress` rows cancelling matching platform rules. Server actions and engine fan-out both consume this function — never hand-roll a UNION.

**Dual-write bridge (ADR-0128):** While `invoice_dispatch` is the source of truth, B2 still writes `invoice.delivery_status` / `delivery_attempted_at` for backwards compatibility. Hard drop scheduled 2026-07-01 or at Fase 3 close, whichever comes first.

**Adapter audit safety (ADR-0129):** `is_placeholder` on `billing_integration` gates `integration audit violation` events. The sync_integration handler enforces: placeholder row + succeeded result = violation; non-placeholder row + mocked result = violation. Both fail the engine_state terminally.
