---
title: "Campaign — order-system"
status: active
updated: 2026-05-02
created: 2026-05-02
module: billing
tags: [campaign, roadmap, invoice, order, billing, simplification]
---

# Campaign — order-system

> Branch: `campaign/order-system` | Worktree: /home/sxtnl/dev/smartout.ai-order-system | Module: billing | Started: 2026-05-02

## Vision

Smartout genererer **grunnfakturaer** (base orders) som workspace-admin laster ned og bruker som råstoff for sin egen reelle faktura — i regnskapssystemet sitt, manuelt, eller via egen integrasjon. Smartout er IKKE et fakturasystem. Smartout er et **order-system**: vi måler bruk, beregner grunnlag, leverer ferdig PDF/CSV. Resten eier kunden.

Reframe driver:
- Dagens "invoice"-terminologi feilrepresenterer hva systemet gjør (Smartout sender ikke fakturaer til sluttkunde).
- Worker-UX er for dypt for målbrukerne (dispatch rules, dunning kanban, integrations, EHF-eksport blandes inn i hovedflyt).
- Fase 3B Peppol/Tickstar/OAuth ble droppet av Pontus 2026-05-02 — bekreftet at manuelt regnskapsfører-flyt er kanon.

Sluttilstand: workspace-admin ser én flate — "denne periodens grunnlag → last ned". Platform-admin beholder full audit/dunning/dispatch-overflate. Regnskapsfører får CSV/PDF.

## Scope

### In scope

1. **Reframe "invoice" → "order"** i UI/terminologi/telemetri/copy. Schema-rename gjøres bak VIEW-alias i fase 1, full table-rename i fase 2 (eller utsettes hvis kost > nytte).
2. **Simplify worker-UX** — strip dispatch rules, integrations, dunning fra workspace-admin-flyt. Hovedflyt = generer → last ned → marker betalt manuelt.
3. **Beholde platform-admin-overflate** intakt (alle 26 komponenter, dunning kanban, dispatch rules, payment history). Det er drift-verktøyet vårt.
4. **Definere accountant-rolle** — eget ADR. Egen login eller platform-admin-on-behalf? Blokkerer fase 3B restart.
5. **Rest-fase 3B EHF-eksport** — kun CSV (ingen Peppol/Tickstar). Manuell mark-paid via regnskapsfører-rapport.
6. **ADR-supersession** — 17 invoice-ADRs (0118-0148) får superseding/amendment der "order" ≠ "invoice"-semantikk.

### Out of scope

- Stripe Invoice API-integrasjon (Smartout = grunnfaktura, Stripe = payment, ingen kobling utover dagens delivery_channel='stripe').
- Peppol BIS / Tickstar / Digdir OAuth — droppet 2026-05-02.
- Workspace-rebinding av invoice (ADR-0118 unntak består — company-scoped, ikke workspace-scoped).
- Rene rename-kosmetikk uten simplification (no churn-only PRs).

## Milestones

- [ ] **M1 — Discovery & ADRs** (1 uke)
  - ADR: order vs invoice domain language (supersedes parts of 0118)
  - ADR: accountant role pattern (own login vs delegation)
  - ADR: simplification cut-line (worker vs platform-admin surface)
  - Audit av 17 eksisterende ADRs — flagg supersession-kandidater
  - Acceptance: 3 ADRs accepted, supersession-tabell i decision-log

- [ ] **M2 — Worker simplification (UI-only)** (1 uke)
  - Workspace-admin route `/billing/orders` (alias for invoices) med stripped UI
  - Skjul dispatch rules / integrations / dunning fra workspace-rolle
  - "Generer grunnordre" + "Last ned PDF/CSV" + "Marker mottatt betaling" som primær flyt
  - Acceptance: workspace-admin med company_member-rolle ser kun simplified flate; platform-admin uendret

- [ ] **M3 — Terminology rename (UI/copy/telemetri)** (1 uke)
  - 26 komponentnavn invoice→order
  - 10+ telemetri-events (`invoice generated` → `order generated` osv. — registry-rename, dual-emit i 1 uke for backward compat)
  - i18n-strings, page-titler, breadcrumbs
  - Acceptance: ingen "invoice" i workspace-admin UI; platform-admin beholder "invoice" internt der det refererer faktisk Stripe Invoice / EHF-faktura-format

- [ ] **M4 — Schema VIEW-alias** (3-5 dager)
  - VIEWs: `order`, `order_line_item`, `order_dispatch` over eksisterende invoice-tabeller
  - Capability tools dual-namnet (`listMyOrders` alias for `listMyInvoices`)
  - Acceptance: nye queries kan bruke `order` semantikk uten å bryte eksisterende kode

- [ ] **M5 — EHF/regnskapsfører-flyt restart** (1 uke)
  - CSV export ferdig (rest fra fase 3B)
  - Accountant-rolle implementert per ADR fra M1
  - Manuell mark-paid via accountant
  - Acceptance: regnskapsfører kan eksportere CSV + markere ordre betalt; ingen Peppol-kode levende

- [ ] **M6 — Full schema rename** (vurderes etter M5)
  - Avgjøres når M1-M5 er live og vi vet om VIEW-alias er nok
  - Hvis go: 9 migrasjoner, 18 server actions, capability rename, full tabell+enum rename
  - Hvis no-go: VIEW-alias består permanent, ADR registrerer beslutning

## Active Sub-Sorties

<!-- Updated automatically when /start-feature runs from this worktree. -->

_none_

## Completed Sub-Sorties

<!-- Updated automatically when /close-feature merges a sub-sortie into this campaign. -->

_none_

## Decisions

See `docs/decisions/0000-decision-log.md` (inherited from development at campaign start).

ADRs som forventes skrevet i denne kampanjen:
- ADR-XXXX — Order vs Invoice domain language (M1)
- ADR-XXXX — Accountant role pattern (M1)
- ADR-XXXX — Worker simplification cut-line (M1)
- ADR-XXXX — Schema VIEW-alias strategy (M4)
- ADR-XXXX — Full schema rename go/no-go (M6, post-M5)

ADRs som forventes superseded/amended:
- ADR-0118 (Invoice Engine as C3 Commercial Consumer) — re-frames as Order Engine
- ADR-0127 (Billing Dispatch Rule 2-Level Evaluation) — note: workspace-admin invisible, platform-admin only
- ADR-0146 (Peppol EHF Transport via Tickstar) — superseded (dropped)
- ADR-0148 (EHF Export CSV/PDF Platform-Admin) — extended med accountant-rolle

## Hard Constraints

- ⛔ NEVER bryte ADR-0118 company-scoped RLS — order forblir company-scoped, ikke workspace-scoped.
- ⛔ NEVER drop invoice-tabeller før full M6 go-decision er ADR-registrert.
- ⛔ NEVER fjerne platform-admin-overflate. Det er drift-konsoll, ikke worker-flyt.
- ⛔ NEVER dual-emit telemetri lenger enn 1 uke etter M3 cutover (rotter registry).
- ⛔ NEVER restart Peppol-arbeid uten ny council + ADR-supersession av drop-beslutningen.
- ⛔ NEVER skip `/end-session` mid-milestone — campaign forventes å gå over flere uker.

## Sync Log

<!-- Updated by /sync-campaign when development changes are merged in. -->

| Date | Development HEAD | Merge commit |
|------|------------------|--------------|
