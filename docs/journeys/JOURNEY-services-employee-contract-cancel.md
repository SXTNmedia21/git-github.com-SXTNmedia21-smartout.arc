---
title: "Journey — Admin cancels pending contract"
feature: employee-contract
status: superseded
superseded_by: docs/architecture/contract-service/JOURNEY-contract-module.md
updated: 2026-04-29
created: 2026-04-28
module: other
tags: [journey, contracts, admin, destructive]
---

# Journey: Admin cancels pending contract

**Precondition:** Contract exists in `draft`, `pending_signature`, or `viewed` status. Admin has permission. Cancel-confirmation dialog (Fix 4) shipped.

## Happy path

1. Admin opens contracts table → User sees row with status badge.
2. Admin opens row dropdown → clicks "Avbryt" → System opens AlertDialog with destructive variant.
3. User reads dialog: "Avbryt kontrakt for {employee}?" + body explaining consequences (status → cancelled, no further actions, audit-trailed, employee notified if sent).
4. User clicks "Avbryt kontrakt" → AlertDialog destructive button enters pending state ("Avbryter..." + spinner) → backdrop click + Escape disabled while pending.
5. System POSTs to `/api/contracts/[id]/cancel` → contract-service updates `status = 'cancelled'`, `cancelled_at = NOW()`, cancel reminders, calls DocuSeal to revoke submission if pending → emits `contracts.cancel.confirmed` telemetry → activity_trail written.
6. System closes AlertDialog → toast "Kontrakt avbrutt for {employee}" → row in table updates to "Avbrutt" badge.

**Postcondition:** `employment_contract.status = 'cancelled'`, `cancelled_at` set, DocuSeal submission revoked if applicable, audit trail entry, employee notified via DocuSeal cancel email if contract was sent.

## Error paths

- **User clicks "Behold kontrakt":** AlertDialog closes, no mutation, telemetry `contracts.cancel.aborted` emitted with `reason: "user_cancelled"`.
- **User presses Escape before clicking destructive:** Dialog closes (allowed when not pending), telemetry `contracts.cancel.aborted` with `reason: "escape"`.
- **Already-cancelled contract:** dropdown item filtered out by status; if leaked through, API returns 409 → error banner in dialog "Already cancelled".
- **Network failure during cancel:** Dialog stays open with inline error banner "Kunne ikke avbryte kontrakt. {message}". Destructive button returns to idle text. Retry possible.
- **Concurrent click (double-tap):** Mutation key dedupes via TanStack Query, button disabled prevents second click.
- **DocuSeal revoke fails but DB update succeeds:** Status updates locally; background job retries DocuSeal revocation. No user-visible degradation.
- **Permission denied (employee left workspace):** API returns 403 → error banner "You don't have permission to cancel this contract" → dialog stays open until user dismisses.
- **Offline:** Mutation rejects immediately → error banner "Du ser ut til å være offline. Prøv igjen når tilkoblet."
