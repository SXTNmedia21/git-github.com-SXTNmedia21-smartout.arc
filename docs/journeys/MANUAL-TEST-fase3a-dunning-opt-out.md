---
title: "Manual Test — Fase 3A Workspace Dunning Opt-Out"
status: draft
updated: 2026-04-17
created: 2026-04-17
module: billing-engine
tags: [testing, billing, dunning, workspace-admin]
---

# Manual Test — Workspace Dunning Opt-Out (Fase 3A B5)

> Verifies that the workspace-admin toggle on `/dashboard/billing/settings` creates/deletes the correct `billing_dispatch_rule` suppress row and that B4's `scan_overdue_invoices` handler respects it.

---

## Preconditions

1. Supabase Local running (`npx supabase start`).
2. Web dev server running (`pnpm dev:web`).
3. A workspace-admin user seeded with at least one active invoice that is ≥3 days past its due_date and has `dunning_status='active'` (or NULL).
4. Fase 3A migrations applied (B1 blueprint seeded, B4 handler + `dunning_escalation_log` table).

---

## Journey 1 — Toggle OFF creates a suppress rule

**Precondition:** No `billing_dispatch_rule` row exists for this workspace with `(channel='email_customer', trigger_event='invoice dunning_escalated', action='suppress', is_enabled=true)`.

1. Login as workspace-admin.
2. Navigate to `/dashboard/billing/settings`.
3. Scroll to "Automatiske påminnelser" section.
4. Verify toggle shows **ON** (default state).
5. Verify helper text reads: _"Smartout sender automatisk påminnelse."_
6. Click the toggle → switch to **OFF**.
7. System does: calls `createDispatchRuleAction` with `workspace_id`, `channel='email_customer'`, `trigger_event='invoice dunning_escalated'`, `target={}`, `action='suppress'`, `is_enabled=true`.
8. User sees: toast _"Innstillingen er lagret"_.
9. Helper text updates to: _"Du må sende påminnelser manuelt."_

**Postcondition:** A row exists in `billing_dispatch_rule` matching the above. Query to verify:

```sql
SELECT dispatch_rule_id, workspace_id, channel, trigger_event, action, is_enabled
FROM billing_dispatch_rule
WHERE workspace_id = '<your-workspace-id>'
  AND channel = 'email_customer'
  AND trigger_event = 'invoice dunning_escalated'
  AND action = 'suppress';
```

---

## Journey 2 — Toggle ON deletes the suppress rule

**Precondition:** Journey 1 completed; suppress row exists.

1. Still on `/dashboard/billing/settings`.
2. Click the toggle → switch back to **ON**.
3. System does: calls `deleteDispatchRuleAction` with the suppress row's `dispatch_rule_id`.
4. User sees: toast _"Innstillingen er lagret"_.
5. Helper text reverts to: _"Smartout sender automatisk påminnelse."_

**Postcondition:** The suppress row has been deleted. The query from Journey 1 returns zero rows.

---

## Journey 3 — B4 handler respects suppress rule (no email sent)

**Precondition:**

- Workspace opted out (toggle OFF, suppress row exists).
- At least one invoice in this workspace is ≥3 days past due_date with `dunning_status` in (`active`, NULL).

1. Trigger the `scan_overdue_invoices` engine action manually (invoke via `engine-dispatch` Edge Function, or wait for the 08:00 Oslo pg_cron/`engine_delayed_trigger` once Phase 3A B5 cron lands).
2. Handler runs per invoice:
   - Reads `effective_dispatch_rules(invoice_id, 'invoice dunning_escalated')` — returns zero rows for `email_customer` channel because the workspace suppress rule wins per ADR-0127.
   - Advances `dunning_status` on the invoice (e.g. NULL → `reminder_1`).
   - Inserts into `dunning_escalation_log` (idempotency key).
   - Emits `invoice dunning_escalated` event with `data.suppressed=true`.
   - Does **NOT** insert into `invoice_dispatch` (email is suppressed).
3. Verify:
   - `dunning_escalation_log` has a new row for this invoice.
   - `invoice.dunning_status` advanced.
   - No `invoice_dispatch` row was created with `channel='email_customer'` and `template_id` matching `dunning_*` for this invoice.
   - No customer email was sent.

**Postcondition:** Internal audit trail is intact; customer was not emailed.

---

## Journey 4 — Re-enable and verify email is sent

**Precondition:** Journey 3 completed; workspace opted out.

1. Navigate to `/dashboard/billing/settings`.
2. Toggle **ON** to delete the suppress rule.
3. Fast-forward clock (or wait a day) and trigger `scan_overdue_invoices` again for an invoice that has advanced to the next stage (e.g. `reminder_1` → `reminder_2` when 7 days past due).
4. Verify:
   - `invoice_dispatch` row is inserted with `channel='email_customer'` and the correct `dunning_*` template.
   - `dunning_escalation_log` has a row for the new stage.
   - SendGrid (or local email sink) receives the email.

**Postcondition:** Emails resume flowing after opt-in.

---

## Error paths

| Scenario                                                             | Expected behavior                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Toggle click while server action pending                             | Switch is disabled; label pulses; second click is no-op.                        |
| createDispatchRuleAction returns `{ ok: false, error: 'forbidden_workspace_scope' }` | Toggle rolls back to previous state; error toast shows the error message.       |
| deleteDispatchRuleAction returns `{ ok: false }`                     | Toggle rolls back; error toast shown.                                           |
| Suppress row exists but `is_enabled=false`                           | UI treats as ON (auto-dunning active). Re-enabling flips the existing row off. |
| Company has multiple workspaces                                      | One toggle per workspace, each with a workspace-name heading.                   |

---

## Multi-workspace scenario

**Precondition:** Caller's company has ≥2 workspaces (A, B).

1. Navigate to `/dashboard/billing/settings`.
2. "Automatiske påminnelser" section shows two toggle cards, one per workspace.
3. Each card has a small heading with the workspace name (uppercase-tracked label).
4. Toggling workspace A to OFF does not affect workspace B's state.
5. Verify B4 handler processes workspace B invoices normally while workspace A's are suppressed.

---

## Follow-up items

- Playwright E2E in `apps/web/e2e/billing-fase3a/` once the billing seed harness is ready (tracked by B6 pre-flight).
- Fast-forward clock harness for `scan_overdue_invoices` — document how to shift `invoice.due_date` vs handler `now()` for deterministic local testing.
- pg_cron schedule verification — confirmed once 3A B5 cron migration lands.
