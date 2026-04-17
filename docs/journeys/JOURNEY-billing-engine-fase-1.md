---
title: "User Journeys — Billing Engine Fase 1"
status: done
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [journey, billing, fase-1]
---

# User Journeys — Billing Engine Fase 1

> CLAUDE.md feature-closure gate requires every user flow this feature enables to be documented. Below: 6 primary journeys covering cron → platform-admin ops → workspace-admin read → AI agent.

---

## Journey 1: Monthly invoice generation (cron, no human)

**Actor:** n8n scheduler invokes the `generate-monthly-invoices` Edge Function.

**Precondition:** Day 5 of month, 00:01 CET. At least one active `company` exists with linked workspaces and a currently-effective `pricing_terms` row.

1. n8n Scheduler Trigger fires → HTTP Request node POSTs to `https://<project>.supabase.co/functions/v1/generate-monthly-invoices` with `Authorization: Bearer $WATCHDOG_CRON_SECRET`.
2. Edge Function validates bearer → creates service-role Supabase client.
3. Function computes previous calendar month in UTC (`periodStart`, `periodEnd`).
4. For each active company:
   - Idempotency fast-path: skip if non-void recurring invoice already exists for (company, period).
   - Load effective `pricing_terms` row.
   - For each workspace: run ADR-0119 predicate → count completed shifts with employee_id → upsert `usage_snapshot` with `counted_profile_ids` + `source_query_hash`.
   - Compute `amount_excl_vat` (base_plan + Σ overages), `vat_amount` (25%), `amount_incl_vat`.
   - Insert `invoice` row (status=draft, pricing_terms_id snapshot per ADR-0121).
   - Insert `invoice_line_item` rows (base_plan + per-workspace user_overage lines).
   - Emit `usage_snapshot created` × N and `invoice generated` via `/api/internal/emit`.
   - Update status draft → issued → `assign_invoice_number` trigger fires, `invoice_number_seq` allocates.
   - Emit `invoice issued` with the assigned number.
5. Overdue scan: flip issued/sent with `due_at < today` → overdue; emit `invoice overdue_detected` each.
6. Function returns JSON `{period_from, period_to, companies_processed, invoices_created, invoices_skipped, overdue_flipped, errors[]}` → n8n logs success or notifies Telegram on error.

**Postcondition:** One recurring invoice per active company for the previous month. Usage snapshots frozen. Overdue invoices flagged. Audit trail in `billing_activity_log`.

**Error paths:** Invoice insert fails → per-company error added to `errors[]`, remaining companies still processed. Emit failure is logged but does not abort invoice generation.

---

## Journey 2: Platform-admin registers a payment

**Actor:** Platform admin (Smartout internal; `user_identity.is_godmode = true`).

**Precondition:** An invoice exists in `issued`, `sent`, or `overdue` status.

1. Admin navigates to `/platform-admin/billing/invoices`.
2. Invoice list renders with `InvoiceFilterBar` (status dropdown) and a `Table` of invoices. Row click adds `?preview=<invoice_id>` to the URL.
3. `InvoiceDetailSheet` opens as a side panel; admin clicks "Åpne full visning" to navigate to `/platform-admin/billing/invoices/[id]`.
4. Full-page `InvoiceDetail` renders with 3 tabs: Oversikt, Historikk, Handlinger.
5. Admin clicks the **Handlinger** tab → `InvoiceActions` shows three buttons (Merk som betalt, Annuller faktura, Legg til notat).
6. Admin clicks **Merk som betalt** → `MarkPaidDialog` opens.
7. Dialog pre-fills today's date + invoice amount. Admin fills `payment_channel` (bank_transfer), `payment_reference` (KID/bilagsnr), optional `notes`.
8. Admin submits → client generates `idempotency_key` via `crypto.randomUUID()` → calls `markInvoicePaid` Server Action.
9. Server Action: `getSuperAdminId` gate → Zod parse → UPDATE invoice SET status='paid' WHERE status IN (issued/sent/overdue) → emit `invoice marked_paid` → `revalidatePath`.
10. Client toasts success → dialog closes → detail page re-renders with `InvoiceStatusBadge` now showing "Betalt".
11. Admin switches to **Historikk** tab → `InvoiceTimeline` shows the `invoice marked_paid` event with payment channel + timestamp.

**Postcondition:** `invoice.status = 'paid'`, `paid_at` timestamp set, payment fields populated. `billing_activity_log` row created via telemetry provider with actor_user_id = admin's `user_identity.user_id`.

**Error paths:**
- Invoice in terminal state (paid/void/uncollectible) → `invoice_not_found_or_not_in_payable_state` toast.
- Zod validation failure → first issue message toast.
- Unauthorized (no superadmin) → `unauthorized` toast.

---

## Journey 3: Platform-admin voids an invoice + issues credit note

**Actor:** Platform admin.

**Precondition:** An invoice in `issued`/`sent`/`overdue` status that needs cancellation.

1. Admin navigates to invoice detail → Handlinger tab → **Annuller faktura**.
2. `VoidAlertDialog` opens (AlertDialog — destructive variant).
3. Admin selects reason from dropdown (`duplicate`, `fraudulent`, `order_change`, `product_unsatisfactory`, `issued_in_error`, `other`).
4. Admin fills reason detail (≥10 chars, Zod-enforced).
5. Admin **types the exact invoice_number** as confirmation — submit button remains disabled until typed text matches.
6. Admin clicks **Annuller faktura** → calls `voidInvoice` Server Action.
7. Server Action: getSuperAdminId gate → Zod parse → **explicit null-number reject** (null invoice_number means draft, never voidable) → typed_confirmation re-verification → status guard (issued/sent/overdue only) → UPDATE status='void' + voided_at/voided_by/void_reason → emit `invoice voided` → revalidatePath.
8. Client toasts success → dialog closes → status badge shows "Annullert".
9. For refunding the customer: admin goes back to detail → **Utsted kreditnota** path (deferred to B6+ — currently admin must call `issueCreditNote` directly; a dialog wrapper is future work).
10. `issueCreditNote` inserts a NEW invoice row with `invoice_type='credit_note'` and `credits_invoice_id` linking to the voided original. Amount split into excl_vat / vat_amount components **mirroring the original invoice's vat_rate** (not a hardcoded constant — ADR-0120 compliance for historical rate preservation).
11. Emits `invoice credit_note_issued`. Both original and credit note visible in list view with distinct badges.

**Postcondition:** Original invoice `status='void'`, new credit_note invoice in issued state, credits_invoice_id FK traces the link. `prevent_nested_credit_notes` trigger ensures you can't credit a credit note.

**Error paths:**
- Typed confirmation mismatch → `typed_confirmation_mismatch` toast.
- Null invoice_number → `invoice_not_voidable_no_number`.
- Original invoice already credit_note → `cannot_credit_a_credit_note`.

---

## Journey 4: Platform-admin resolves basis drift

**Actor:** Platform admin.

**Precondition:** A `schedule_shift` row was UPDATEd or DELETEd after a `usage_snapshot` was frozen; the `detect_billing_basis_drift` trigger fired and inserted a `basis_drift_event` with `resolution = NULL`.

1. Admin navigates to `/platform-admin/billing/drift`.
2. `DriftPanel` renders each unreviewed row: drift_type label, detected_at timestamp, link to parent invoice, before/after JSON side-by-side, optional shift_id footer.
3. Admin reviews the diff and chooses one of:
   - **Ignorer (ikke vesentlig)** — amount unchanged or below materiality threshold.
   - **Kreditnota utstedt** — separately issued credit note to compensate.
   - **Refakturert** — invoice was voided and regenerated with corrected basis.
4. Click fires `resolveDriftEvent` Server Action.
5. Server Action: Zod enum validation → UPDATE with `.is("resolution", null)` guard and `.select().maybeSingle()` null-check. If another admin resolved the row concurrently, returns `already_resolved_or_missing` and the UI toasts the error.
6. On success, drift row disappears from the list on re-render.

**Postcondition:** `basis_drift_event.resolution` set, `reviewed_by` = admin user_id, `reviewed_at` = now(). Row stays in table (for audit) but excluded from the unreviewed-backlog view.

**Error paths:** Concurrent double-resolve → `already_resolved_or_missing` (first resolver wins, second gets a loud toast — previously silent per B5 council fix).

---

## Journey 5: Workspace-admin views own invoices

**Actor:** Workspace admin / owner (customer-side; `company_member.role IN ('admin', 'owner')`).

**Precondition:** Authenticated user has an active admin/owner membership in at least one company.

1. User navigates to `/dashboard/billing`.
2. Server Component resolves user via cookie-bound `createClient()` → `supabase.auth.getUser()`.
3. `resolveCallerCompany` (Server Action in `_actions/queries.ts`) looks up the user's first active admin/owner `company_member` row. If none, returns empty list.
4. `getMyCompanyInvoices` fetches the company's invoices, ordered newest-first, limit 48.
5. Read-only table renders: invoice_number, period, amount, status badge, due_at.
6. Workers (role = employee/manager) get redirected home — billing is admin/owner only per ADR-0118.

**Postcondition:** Customer sees their own invoices. No mutations possible here (Fase 1 scope — Fase 2 opens self-serve "mark paid" per customer preference).

**Error paths:**
- No active company_member → empty state "Ingen fakturaer enda".
- Query failure → console.error, empty list.

---

## Journey 6: Workspace-admin asks the agent "what's in this invoice?"

**Actor:** Workspace admin via chat interface (Emma / Mr. Botsson).

**Precondition:** User has valid session in chat channel. `engine_authority_config` row exists for the workspace with `capability='billing_query', level='read_only', min_role='admin'`.

1. User types "Explain invoice #1001" in chat.
2. Intent classifier (`packages/ai/src/router/intent-classifier.ts`) routes to `capability='billing_query'` based on the INTENT_DESCRIPTIONS prompt guidance.
3. Tool selector evaluates the 5 tools in `billing-query/tools.ts` + authority config (read_only) + channel allow-list (chat only).
4. Agent invokes `explain_invoice_basis` with `{invoice_id: <resolved from #1001>}`.
5. Tool execution:
   - Channel guard: `ctx.channel === 'chat'` → pass.
   - `resolveCompanyId(ctx)` → user's company_id from workspace lookup.
   - Supabase `invoice` lookup on invoice_id → scope check against resolved company_id. Mismatch → "does not belong to your company".
   - Status check: `status === 'draft'` → "still a draft, no final basis".
   - `supabase.rpc('get_invoice_basis', {p_invoice_id})` → returns jsonb bundle.
   - Tool returns `JSON.stringify(data)` — **never computes amounts**, LLM narrates verbatim.
6. LLM composes natural-language response citing line_items, usage_snapshots, and pricing_terms_at_issue.

**Postcondition:** User gets a human-readable explanation with amounts that match the DB exactly. `billing_activity_log` does NOT receive an entry (reads are not audited; only mutations). PostHog may receive the tool-invocation event if configured.

**Error paths:**
- Voice channel → "billing tools are chat-only, please ask this question via chat".
- Other company's invoice → refusal without leaking data.
- Draft invoice → "still a draft — no final basis to explain yet".
- RPC failure → "Error: <message>" passed through.

---

## Quality gates all green for these journeys

- **db reset:** 13 migrations apply clean.
- **pgTAP:** 21/21 assertions pass (13 RLS + 8 CHECK/trigger/column).
- **Typecheck:** 51/51 packages.
- **Lint:** 0 errors on billing-touched packages.
- **Vitest:** 73/73 AI tests pass (including 7 explain_invoice_basis unit tests).
- **Telemetry contract:** 12 billing events registered; CI asserts all route to `billing_activity_log`, none to `activity_trail`.
