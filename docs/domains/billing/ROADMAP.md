---
title: "Billing — Roadmap"
status: draft
mirror: aspirational
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: billing
tags: [domain, billing, roadmap, blueprint]
---

# Billing — Roadmap

> Forward plan + design intent. **Aspirational** — ahead of code. What ships here moves to ARCHITECTURE/DATA-MODEL and out of GAPS.

## Delivered phases (now part of spine)

| Phase | Delivered | Status |
|---|---|---|
| Fase 1 | Schema (5 tables, 4 enums, views, triggers, RLS), generate-monthly-invoices EF, billing_query AI capability (5 tools), platform-admin + workspace-admin UI, telemetry provider | ✅ Merged to development |
| Fase 2 | Dispatch system (`billing_dispatch_rule`, `invoice_dispatch`, 4 adapters), integration framework, invoice editing (add/edit/delete line items), ad-hoc invoices, workspace-admin dispatch rule config, 6th AI tool `list_invoice_dispatches` | ✅ Merged to development |
| Fase 3A | Stripe payments (`payment`, `payment_attempt`, `stripe-webhook` EF, `StripeDispatchAdapter`), automated dunning via `engine_process`, `invoice.delivery_*` columns dropped | ✅ Merged to development |
| Fase 3B | EHF CSV/PDF export (`generateEhfExport`), `company.ehf_enabled` + `peppol_participant_id`, accountant mark-paid flow | ✅ Merged to development |
| Accountant access | `billing.accountant_company_grant`, SECURITY DEFINER helpers, `billing.is_accountant_for_company()` RLS integration, kartotek view | ✅ Merged to development (ADR-0269 proposed) |

## Open phases

### Phase: peppol_ehf adapter (Fase 3B remainder)

**Goal:** Implement `PeppolEhfAdapter` class and register it in `ADAPTER_REGISTRY` for true PEPPOL BIS Billing 3.0 XML dispatch via a certified AP (Sproom / Nets / Pagero).

**Falsifiable acceptance:** `ADAPTER_REGISTRY['peppol_ehf']` is non-null; integration test sends a valid EHF document to a staging AP endpoint.

**Blocked on:** Digdir certification + AP provider selection.

**Governing ADR:** ADR-0129 (adapter absent by design until ready), ADR-0146 (superseded Tickstar — new provider TBD).

### Phase: PlatformAdminToolContext + cross-workspace AI tools

**Goal:** Define `PlatformAdminToolContext` (extends `AgentToolContext` with godmode flag + cross-company scope), write platform-admin AI tools (`list_all_overdue`, `mark_paid_by_natural_language`).

**Blocked on:** New ADR for `PlatformAdminToolContext` authority model.

**Governing spec:** Fase 1 §9.2 — deferred until ADR written.

### Phase: ADR-0269 acceptance + accountant portal hardening

**Goal:** Accept ADR-0269 (currently `proposed`), complete accountant portal UI in `apps/admin/` (`admin.smartout.ai`) — grant management UI, accountant onboarding flow, multi-company dashboard. The surface is already live at `admin.smartout.ai`; this phase fills in the grant management and onboarding screens. Do NOT build these in `apps/web/platform-admin/accountant/` — `apps/admin/` is the correct home.

**Governing ADR:** ADR-0269 (`proposed` → `accepted`).

### Phase: Bidirectional integration sync (Fase 3B remainder)

**Goal:** Real Fiken/Tripletex adapter replacing the `placeholder` adapter. Bidirectional: outbound invoice push + inbound payment reconciliation.

**Governing ADR:** ADR-0129 (is_placeholder gate), ADR-0126 (engine_process orchestration).

### Phase: auto-dunning go-live

**Goal:** `dunning_escalation_scan` engine_process running in production. SendGrid reminder templates (friendly / formal / final). Escalation ladder: +3d `reminder_1`, +7d `reminder_2`, +14d `collection_notice`.

**Governing ADR:** ADR-0143 (dunning via engine_process), ADR-0045 (SendGrid canonical for reminders).

## Governing ADRs (accepted)

- **ADR-0118** — Invoice Engine as C3 Commercial consumer; company_id scope exception
- **ADR-0119** — Usage snapshot reproducibility: `shift_status = 'completed'` predicate + `source_query_hash`
- **ADR-0120** — Invoice immutability + credit note policy (bokføringslov)
- **ADR-0121** — `pricing_terms` extension for billing (5 new columns, amends ADR-0027)
- **ADR-0125** — `billing_activity_log` as platform-scoped audit (ADR-0118 amendment)
- **ADR-0126** — Integration sync as engine_process
- **ADR-0127** — Billing dispatch rule: 2-level evaluation (platform baseline + workspace override)
- **ADR-0128** — `invoice.delivery_*` columns deprecation lifecycle → now fully dropped
- **ADR-0129** — Billing integration adapter pattern; `is_placeholder` audit gate; `peppol_ehf` absent until Fase 3B
- **ADR-0130** — Fase 2 scope exclusion: contract onboarding extracted to separate spec
- **ADR-0131** — Stripe Connect model: Smartout as merchant-of-record; workspace Connect REJECTED
- **ADR-0142** — Invoice refund flow (amends ADR-0120): `charge.refunded` → auto credit-note
- **ADR-0143** — Dunning via engine_process (not n8n)
- **ADR-0144** — `invoice.delivery_*` drop gate (hard deadline enforced)
- **ADR-0384** — Billing gate on signed contract
- **ADR-0385** — Billing collection is manual in V1: generation cron stops at issued
- **ADR-0386** — pg_cron over n8n for monthly invoice generation trigger

## Governing ADRs (proposed)

- **ADR-0269** — Accountant portal data foundation (currently `proposed`)

## Governing specs / plans (reference only — NOT moved here)

- `docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md` — Fase 1 complete spec
- `docs/superpowers/specs/2026-04-17-billing-engine-fase-2-design.md` — Fase 2 dispatch + integration spec
- `docs/superpowers/specs/2026-04-17-billing-engine-fase-3-design.md` — Fase 3A Stripe + dunning spec
- `docs/superpowers/specs/2026-04-17-billing-engine-fase-3b-design.md` — Fase 3B EHF export spec
- `docs/superpowers/specs/2026-05-04-billing-erik-seed.md` — Accountant seed + Erik flow
- `docs/superpowers/plans/2026-04-17-billing-engine-fase-1.md` — Fase 1 implementation plan
- `docs/superpowers/plans/2026-04-17-billing-engine-fase-1-B1-COUNCIL-VERDICT.md` — Council verdict

## Planned journeys

- [JOURNEY-billing-engine-fase-1.md](../../journeys/JOURNEY-billing-engine-fase-1.md) — Fase 1 flows (platform-admin + workspace-admin)
- [JOURNEY-billing-engine-fase-2.md](../../journeys/JOURNEY-billing-engine-fase-2.md) — Fase 2 dispatch flows
- Fase 3A journeys — pending explicit journey file
- Accountant portal journey — pending ADR-0269 acceptance

## Boundary watch

**Settlement overlap — REVISED 2026-05-22 (was: "split recommended"):** After examining `apps/admin/src/lib/avstemming/`, the settlement tables (`billing.settlement_run`, `billing.settlement_artifact`) are confirmed to be **accountant-facing billing reconciliation** (Erik confirms Smartout's invoiced period is squared). They are NOT workspace-internal employee settlement. They remain in the `billing` domain. Only `billing.settlement_period` is a potential future split candidate if workspace-level period-lock management grows independently. See GAPS §5 for full rationale.

**apps/admin is the canonical accountant surface.** Future accountant features (grant management, onboarding, portal expansion) belong in `apps/admin/` — not `apps/web/platform-admin/`. The ADR-0269 acceptance path (accountant portal hardening) should target `apps/admin/` as the home app.
