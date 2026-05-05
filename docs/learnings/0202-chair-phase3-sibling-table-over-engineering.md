---
title: "Chair Phase 3 over-engineering reversal — sibling-table beats ADD COLUMN only when lifecycle independence exists"
id: LEARNING_0202
status: canonical
layer: learning
created: 2026-05-04
updated: 2026-05-04
tags: [council, chair-self-reversal, ontology, schema-design, code-trace]
---

# Learning-0202: Chair Phase 3 over-engineering reversal — sibling-table beats ADD COLUMN only when lifecycle independence exists

## Context

Council Round Castle 2026-05-04 (billing-erik-seed). Chair (system-steward) Phase 3 anbefalte ny sibling-tabell `billing.company_payment_provider_link` for Stripe customer-ID storage (Q1). Begrunnelse var ontology-prinsipp: "stripe customer ID er sidecar, ikke property of company; multi-provider-fremtid (Peppol senere)".

Phase 3 fra Supervisor + System-Agent-Coordinator (code-tracers) leverte falsifiserende evidens:
- **Coordinator code-trace:** `public.company` har ingen FK/trigger som ville bryte ved `ADD COLUMN stripe_customer_id text`. Additivt og trygt.
- **Supervisor existence proof:** `invoice.external_reference` finnes allerede og dekker per-invoice Stripe-ID; eliminerer halvparten av storage-behovet Chair antok.
- **Realitet på data:** ÉN Stripe customer-ID per company i 95% av tilfeller (Yogurt unntak håndteres som "primær + sekundær logget"). Lifecycle-uavhengighet finnes ikke — customer-ID er en property, ikke en uavhengig entitet.

Phase 5 self-reversal: Chair valgte **ADD COLUMN** etter to-reviewer code-trace.

## Discovery

**Sibling-table beats ADD COLUMN kun når lifecycle-uavhengighet eksisterer.** Lifecycle-uavhengighet betyr:

1. Entiteten har egne lifecycle-events (created, updated, archived) som ikke er bundet til parent
2. Entiteten har relasjoner til andre tabeller utenfor parent-kontekst
3. Entiteten kan eksistere uten parent (eller flere instances per parent med equal status)

Hvis ingen av disse trigger, er ADD COLUMN korrekt — sibling-tabell er over-engineering.

**Pattern-signature (5. forekomst per L-0098):**
- Chair operates on incomplete scope (ontology-prinsipp uten data-grounding)
- Reviewer code-trace expands scope (data-realitet, lifecycle-faktum, kost-estimat)
- Chair must reverse, not rationalize

Tre tidligere precedenter (per skill-protocol):
- Year Wheel Redesign 2026-04-20 (Trust Gate Phase 3 PASS → Phase 5 FAIL etter Agent-coord code-trace)
- /dashboard/help 2026-04-28 (Phase 3 REJECT → Phase 5 APPROVE-as-tier etter frontend layout)
- ADR-0216 2026-04-28 (Phase 3 Option A2 → Phase 5 Option B etter Supervisor 139-site blast-radius scan)

Nå 4. eksplisitt forekomst (5. inkl. unnamed): billing-erik-seed sibling-table reversal.

## Impact

**Council-protocol skjerpelse (per Phase 9 self-improvement):**

1. **Chair Phase 3 må code-trace egne ontology-claims før de framsettes** — ikke bare resoner fra prinsipp. Trekkpolitikk: før Chair anbefaler ny tabell/kolonne/struktur, må Chair åpne minst 2 relevante migrasjoner + 1 RLS-policy + sjekke `database.types.ts` for eksisterende kandidat-kolonner.
2. **Default bias formalisert:** `ADD COLUMN` slår `new sibling table` for 1:1-attributter uten lifecycle-uavhengighet. Sibling-table krever positiv begrunnelse.
3. **Promovert til skill (5. forekomst):** SKILL.md Chair Self-Reversal Protocol nå hard rule. ADD COLUMN-defaulten er ny "Common Mistakes" rad.

**Klasse-relasjon:** Sibling til L-0036 (4-layer review enforcement) — concept-level reviewers (chair) misser implementation-bugs uten code-tracers. Phase 3-rollen til chair må enten code-trace selv eller eksplisitt vente på Phase 5 før kommitting til strukturelle anbefalinger.

## References

- ADR-0269 — Accountant Portal Data Foundation (Q1 sub-decision; sibling-table rejected, ADD COLUMN chosen)
- L-0098 — Chair generalizes, code-tracer falsifies (parent pattern)
- L-0036 — 4-layer review enforcement
- L-0147 — Outsider-renumbers convention (related: post-merge correction)
- Council Round Castle 2026-04-20 (Year Wheel — Trust Gate Phase 3 → 5 reversal)
- Council 2026-04-28 ADR-0216 (Option A2 → Option B reversal)
- skill: `~/.claude/skills/run-council/SKILL.md` Phase 5 §1.5 Chair Self-Reversal Protocol
