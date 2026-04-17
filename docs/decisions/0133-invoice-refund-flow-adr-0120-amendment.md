---
title: "Invoice Refund Flow — ADR-0120 Amendment for Stripe Refunds"
id: ADR-0133
status: accepted
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-17
amends: ADR-0120
---

# ADR-0133: Invoice Refund Flow — ADR-0120 Amendment for Stripe Refunds

## Context and Problem Statement

Fase 3A innfører Stripe auto mark-paid via webhook. Stripe kan også sende `charge.refunded`-events (full eller delvis refusjon). ADR-0120 spesifiserer at issued invoices er immutable — korreksjoner skjer kun via credit notes. Men ADR-0120 ble skrevet før Stripe auto-integrasjon; den adresserer ikke automatisk refund-respons. Hvis webhook naivt flipper `invoice.status` fra `paid → issued` ved refund, bryter det ADR-0120.

## Decision Drivers

- **ADR-0120 integritet:** Paid invoices er immutable for status-mutasjoner nedover (kan flipp videre til `void` via credit note, men ikke `paid → issued`).
- **Stripe refund-realitet:** `charge.refunded` events må håndteres. Hvis ignorert, havner invoice.status ute av synk med payment.status.
- **Full vs delvis refund:** Har forskjellig semantikk. Full refund = kunde betalte aldri netto (credit-note balanserer fullt). Delvis = partial credit.
- **Bokføringsloven:** Kontinuerlig fakturanummerering + ingen sletting av issued invoices = credit note er eneste lovlige reversal-mekanisme.

## Considered Options

1. **Naivt status-flip:** `charge.refunded` → invoice.status='issued'. *(Avvist — bryter ADR-0120 + bokføring.)*
2. **Kun logg refund, ikke touch invoice:** oppdater payment.refunded_amount, la invoice.status forbli 'paid'. Regnskapsfører lager credit-note manuelt. *(Avvist — for mye manuelt + inkonsistent bokføring.)*
3. **Auto credit-note:** full refund = auto-opprett credit-note som balanserer. Partial = credit-note for refunded beløp. Invoice.status forblir 'paid'. *(Valgt.)*

## Decision Outcome

Chosen option: **"Auto credit-note"**, fordi det respekterer ADR-0120 immutability + gir korrekt bokføring + automatisk reconciliation.

**Flyt per `charge.refunded` webhook:**

### Full refund (refund.amount == original payment.amount)

1. UPDATE `payment` → `status='refunded'`, `refunded_amount=refund.amount`
2. INSERT ny `invoice` rad:
   - `invoice_type = 'credit_note'`
   - `credits_invoice_id = original_invoice_id` (FK til den refunderte fakturaen)
   - `status = 'issued'` direkte (credit notes får invoice_number via sequence per ADR-0120)
   - `amount_excl_vat = -(original.amount_excl_vat)` (negativt beløp)
   - `vat_amount = -(original.vat_amount)`
   - `amount_incl_vat = -(original.amount_incl_vat)`
   - `period_from / period_to` = originalens
   - `issued_at = now()`, `created_by = NULL` (system)
3. INSERT `invoice_line_item` rader for credit-note (kopierer original's line_items med negative beløp + `usage_snapshot_id = NULL`)
4. **Invoice.status FORBLIR 'paid'** — credit-note balanserer regnskapsmessig; den originale fakturaen er historisk betalt + historisk kreditert.
5. Emit `invoice credit_note_auto_created` event (data.reason='stripe_full_refund', data.original_invoice_id, data.credit_note_invoice_id)

### Partial refund (refund.amount < original payment.amount)

1. UPDATE `payment` → `status='partially_refunded'`, `refunded_amount += refund.amount`
2. INSERT `invoice` med `invoice_type='credit_note'`, beløp = kun refunded amount (ikke full original)
3. `credits_invoice_id = original_invoice_id`
4. Line-items for credit-note: én linje "Delvis refusjon" med negativt beløp = -refund.amount
5. Invoice.status forblir 'paid'
6. Emit samme event med data.reason='stripe_partial_refund', data.refund_amount

### Kjeds-refund (refund of already-refunded)

Stripe kan ikke refunde mer enn opprinnelig beløp. Hver refund er en ny event; håndteres likt partial per event. Aggregert refunded_amount på `payment` tracker sumeroverfor original.

## Rules & Consequences

- **Good, because** ADR-0120 immutability fullt respektert
- **Good, because** bokføringslov (kontinuerlig sekvens + immutability) etterlevd
- **Good, because** auto-generering eliminerer manuell regnskapsfører-intervensjon for refunds
- **Good, because** partial refunds håndtert konsistent med full refunds
- **Bad, because** ekstra credit-note-invoices øker DB-vekst (men audit-verdi er full)
- **Bad, because** credit-note-numrene konsumerer `invoice_number_seq` → invoice-numre hopper (f.eks. 1001, 1002, 1003-credit-note) — dette er faktisk bokføringslovlig og korrekt
- **Agent Impact:** `stripe-webhook` Edge Function MÅ inkludere `charge.refunded`-handler som følger denne flyten. Manuelt credit-note via platform-admin UI bruker samme underlying funksjon (`issueCreditNote(invoice_id, amount, reason)`). ENHVER vei som mutator `invoice.status` på en paid invoice må gå gjennom credit-note-mekanismen. Ingen direct `paid → issued` flip tillatt — pgTAP-test asserter dette.

---

> Register in `docs/decisions/0000-decision-log.md` and update CLAUDE.md's ADR table. Cross-link from ADR-0120.
