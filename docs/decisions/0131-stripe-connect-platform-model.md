---
title: "Stripe Connect Platform Model — Smartout-Owned"
id: ADR-0131
status: accepted
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-17
---

# ADR-0131: Stripe Connect Platform Model — Smartout-Owned

## Context and Problem Statement

Billing Fase 3A introduserer Stripe-basert betaling. To grunnleggende modeller er mulige: (a) Smartout eier Stripe-kontoen og er merchant-of-record; workspaces får aldri direkte payouts. (b) Workspaces har egne Stripe Connect Accounts; Stripe prosesserer direkte til workspace's bank. Valg påvirker `payment`-skjema, KYC-byrde, regulering (PSD2/Finanstilsynet), og hvor pengene lander først.

## Decision Drivers

- **Regulatorisk risiko:** Smartout-eid = ingen money-movement-intermediær-status. Workspace-eid (Connect) = Stripe håndterer KYC per workspace, men Smartout må forholde seg til flere Stripe-objekter.
- **Kompleksitet for workspaces:** Connect-onboarding per workspace = friksjon for salg. Smartout-eid = zero-friction fra workspace-perspektiv.
- **Payout-flyt:** Smartout-eid = Smartout mottar alt, fordeler videre internt (men det skjer ikke i 3A — reneste variant er at Smartout beholder).
- **Cascade-integritet:** Connect-modellen introduserer `workspace_payout` som nytt C3-objekt. Smartout-eid krever ingen ny cascade-entitet.

## Considered Options

1. **Smartout-eid (merchant-of-record)** — Smartout har én Stripe-konto. Penger lander i Smartouts bank. Workspaces får ikke direkte payouts. *(Valgt for Fase 3A.)*
2. **Workspace Connect Accounts** — Hver workspace onboarder Stripe Connect. Penger lander i workspace's bank. Stripe håndterer KYC per workspace. *(Avvist for 3A; revurderes i 3B+ hvis workspaces etterspør.)*
3. **Hybrid** — Smartout-eid for små workspaces, Connect for store. *(Avvist — kompleksitet uten klar gevinst.)*

## Decision Outcome

Chosen option: **"Smartout-eid (merchant-of-record)"** for Fase 3A, fordi det minimerer friksjon + regulatorisk eksponering for 3A-leveranse.

**Konsekvenser for skjema:**
- `payment.company_id` refererer kundens company (ikke Smartouts). Snapshot fra `invoice.company_id`.
- Ingen `workspace_payout`-tabell i 3A.
- `billing_integration.integration_type='stripe'` forblir platform-level (workspace_id NULL).
- Stripe `client_reference_id` settes til `invoice.invoice_id` for sporing.

**Konsekvenser for drift:**
- Smartout må ha egen avtale med Stripe Norge / Stripe Atlas for å motta NOK-betalinger
- Smartouts bokføringssystem (Fiken/Tripletex) må registrere inngående betalinger fra Stripe som commissionable revenue
- Intern payout til workspaces håndteres utenfor 3A (eksisterende manuelle prosess fortsetter)

## Rules & Consequences

- **Good, because** zero workspace-friksjon for self-serve betaling
- **Good, because** én Stripe-konto = enklere reconciliation + audit
- **Good, because** ingen PSD2/KYC-kompleksitet for workspaces i 3A
- **Bad, because** Smartout bærer all cashflow-risiko (chargebacks, disputer) før workspace-payout
- **Bad, because** workspace må vente på intern payout-flyt (ikke direkte fra Stripe)
- **Agent Impact:** Alle Stripe-relaterte Server Actions + webhook-handlers antar Smartout-eid konto. Connect-spesifikk kode (Stripe Accounts API, Express onboarding, Connect payouts) er EKSPLISITT IKKE i 3A scope. Hvis Fase 3B/4 revurderer til Connect: dette er ADR-amendment, ikke spontant pattern-skifte.

---

> Register in `docs/decisions/0000-decision-log.md` and update CLAUDE.md's ADR table.
