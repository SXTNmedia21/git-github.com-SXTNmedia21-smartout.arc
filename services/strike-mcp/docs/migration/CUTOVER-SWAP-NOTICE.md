---
title: Cutover Swap Notice — pending shift swaps not migrated
status: draft
updated: 2026-04-16
created: 2026-04-16
module: strike-mcp
tags: [migration, cutover, communication, draft, swaprecords]
audience: employees with pending Bubble shift swaps
---

# Cutover Swap Notice — Pending Shift Swaps

> **Draft — not for sending.** Per Pontus's email policy: drafts only.
> Per council 2026-04-16 (Steward C4 + R3): the 14 pending Bubble swap
> records are dropped at migration. v3 models swaps as engine_process
> instances, not table rows. Affected employees must re-initiate.

---

## Norwegian (default)

**Emne:** Vaktbytte ikke flyttet over — du må starte på nytt i Smartout v3

Hei {initiator_first_name},

Vi flyttet vaktdata over til Smartout v3, men vaktbytte-forespørsler ble dessverre ikke automatisk overført. Du har en forespørsel som var aktiv i gamle systemet:

**Din forespørsel:**
- Vakt: {shift_a_date}, {shift_a_role}
- Vil bytte med: {counterparty_first_name} {counterparty_last_name}
- Deres vakt: {shift_b_date}, {shift_b_role}
- Status i gamle systemet: {bubble_status}

**Hva du må gjøre:**

1. Logg inn på Smartout v3 (se egen e-post om passord-tilbakestilling)
2. Gå til Vaktplan → finn vakten {shift_a_date}
3. Klikk "Be om bytte" og velg {counterparty_first_name}'s vakt {shift_b_date}
4. {counterparty_first_name} godkjenner i sin app
5. Manager godkjenner

**Vi har varslet både deg og {counterparty_first_name}.** Forespørselen må starte fra deg som initierte den i gamle systemet.

Hvis dere allerede har avtalt byttet muntlig og ikke trenger formell bekreftelse — bare la være å re-starte. Vakten gjelder som planlagt.

Spørsmål? {workspace_owner_name}

---

## English

**Subject:** Shift swap not migrated — please re-initiate in Smartout v3

Hi {initiator_first_name},

We migrated shift data to Smartout v3, but shift swap requests couldn't be automatically transferred. You had an active request in the old system:

**Your request:**
- Shift: {shift_a_date}, {shift_a_role}
- Swap with: {counterparty_first_name} {counterparty_last_name}
- Their shift: {shift_b_date}, {shift_b_role}
- Old system status: {bubble_status}

**What you need to do:**

1. Sign in to Smartout v3 (see separate email about password reset)
2. Go to Schedule → find the shift on {shift_a_date}
3. Click "Request swap" and select {counterparty_first_name}'s shift on {shift_b_date}
4. {counterparty_first_name} approves in their app
5. Manager approves

**We've notified both you and {counterparty_first_name}.** The request must come from whoever initiated it in the old system.

If you've already agreed verbally and don't need formal confirmation — just don't re-initiate. The shifts stand as planned.

Questions? {workspace_owner_name}

---

## Variables

| Placeholder | Source |
|---|---|
| `{initiator_first_name}` | swap "Wanted by?" → user → user_identity.first_name |
| `{counterparty_first_name}` | swap "Claimd by" → user → user_identity.first_name |
| `{counterparty_last_name}` | same → last_name |
| `{shift_a_date}`, `{shift_a_role}` | swap.🗓️ Shift → schedule_shift.shift_date + role |
| `{shift_b_date}`, `{shift_b_role}` | swap counterparty's shift if known; else N/A |
| `{bubble_status}` | swap._marketStatus (pending / approved / started) |
| `{workspace_owner_name}` | workspace owner profile.display_name |

## Generation

Use `scripts/gen_pending_swaps_csv.ts` (stub, see file) to produce
`reports/<workspace>-pending-swaps.csv` from Bubble data. Then for each
row, instantiate this template and queue for HR review.

## Send checklist

- [ ] Confirm `reports/wrightegaarden-pending-swaps.csv` is generated (14 rows expected)
- [ ] HR reviews each row with workspace owner
- [ ] For each row: rule out "already verbally agreed" cases — skip those
- [ ] For remaining rows: instantiate this template per affected employee pair
- [ ] Send Norwegian version (Wrightegaarden is Norwegian-speaking)
- [ ] Track replies + escalate stale (>3 days) to manager
