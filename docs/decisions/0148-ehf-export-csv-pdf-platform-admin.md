---
title: "EHF-leveranse via månedlig CSV/PDF-eksport fra platform-admin"
id: ADR-0148
status: accepted
layer: decision
module: billing
created: 2026-04-18
updated: 2026-04-18
supersedes: ADR-0145, ADR-0146, ADR-0147
---

# ADR-0148: EHF-leveranse via månedlig CSV/PDF-eksport fra platform-admin

## Context and Problem Statement

Fase 3B's opprinnelige scope (ADR-0145/0146/0147) forutsatte at Smartout selv
genererer og leverer EHF-fakturaer: PeppolEhfAdapter → Tickstar SaaS AP → Peppol-
nettverk, pluss OAuth-integrasjoner mot Fiken/Tripletex for inbound-poll. Ved
rescope 2026-04-18 ble den reelle workflowen konkretisert: Smartout lager
fakturagrunnlaget, en ekstern regnskapsfører genererer EHF-fakturaer fra sitt
eget system, og regnskapsfører markerer betalt i Smartout på melding. Dette
betyr ingen Peppol-transport, ingen OAuth, ingen inbound-poll.

Smartout trenger derimot en strukturert eksport-pakke som regnskapsfører kan
arbeide med: CSV for dataimport til regnskapssystemet + PDF for arkiv eller
rapport. Platform-admin (Smartout-intern) genererer eksporten månedlig.

## Decision Drivers

- **Fit with real workflow:** regnskapsfører har egne verktøy; Smartout skal
  ikke duplisere EHF-transport.
- **Fleksibel utpakking:** noen måneder vil regnskapsfører ha én samlet CSV for
  alle workspaces, andre ganger ønsker han per-workspace-pakker. Samme for PDF.
- **Lav operasjonell kompleksitet:** månedlig click, ingen cron, ingen vendor-
  lock-in, ingen sertifiseringer.
- **Audit-sporing:** hver eksport må logges slik at Smartout kan dokumentere
  "hva ble levert til regnskapsfører i mars" uten manuell bokføring.
- **Gjenbruk av eksisterende PDF-generator:** Fase 1/2 genererer allerede
  per-faktura PDF; eksporten skal samle eksisterende artefakter, ikke
  regenerere fra scratch der det kan unngås.

## Considered Options

1. **Peppol AP + OAuth-integrasjoner (original Fase 3B-scope)** — full
   ende-til-ende, Smartout leverer EHF direkte. *(Avvist — overdimensjonert
   for faktisk bruksmønster; regnskapsfører gjør det uansett.)*
2. **CSV-only, samlet, platform-admin-click** — enkleste form. *(Avvist — for
   lite fleksibel; PDF-arkiv og per-workspace-split kommer opp første måned.)*
3. **CSV + PDF, samlet OG per-workspace, platform-admin kombinerer via
   checkmarks** — matched-pattern for accountant-workflow, fleksibel,
   én side. *(Valgt.)*

## Decision Outcome

Chosen option: **"CSV + PDF, samlet OG per-workspace, platform-admin
kombinerer via checkmarks"**, fordi det leverer akkurat det regnskapsfører
trenger uten å bygge transport-infrastruktur.

**Arkitektur:**

```
/platform-admin/billing/ehf-export
  Periode: [april 2026 ▼]
  Grouping:  [x] Samlet     [x] Per workspace
  Format:    [x] CSV        [x] PDF
  [Generer eksport]

       ↓ Server Action (packages/billing/src/actions/ehf-export/)

  generateEhfExport({period, grouping[], format[]})
    → load eligible invoices (ehf_enabled workspaces, status ∈ {issued, overdue}, not exported)
    → build artifacts per grouping × format
    → emit 'billing ehf_export_generated'
    → stamp invoice.ehf_exported_at = now()
    → return signed URL(s) or zip
```

**Artefakt-matrise:**

| Grouping | Format | Output |
|---|---|---|
| Samlet | CSV | 1 fil, én rad per faktura, workspace-kolonner inkludert |
| Samlet | PDF | 1 fil: oversiktsside + alle faktura-PDFer konkatenert |
| Per workspace | CSV | zip med `<workspace-slug>.csv` per workspace |
| Per workspace | PDF | zip med `<workspace-slug>.pdf` per workspace (workspace-cover + fakturaer) |
| Flere valg | | én zip som bundler alle valgte artefakter |

**CSV-kolonner:**

```
invoice_number, invoice_date, due_date, workspace_name, workspace_org_nr,
peppol_participant_id, amount_ex_vat, vat_amount, amount_incl_vat, currency,
line_items_json
```

`line_items_json` er strukturert JSON slik at regnskapssystemet kan parse
linjene; `,` i feltverdier escapes per RFC-4180.

**Accountant mark-paid:** platform-admin (Smartout-intern) utfører manuell
mark-paid på regnskapsførerens melding. Fase 2's `markInvoicePaid` action
brukes direkte med ny `payment_source = 'accountant_manual'`-verdi på
`payment`-raden. Event `billing accountant_marked_paid` firer i tillegg til
standard `payment succeeded` for eksplisitt audit-sporing.

**Sporing av eksporterte fakturaer:** ny kolonne `invoice.ehf_exported_at
timestamptz NULL`. Default-filter i eksport-UI: "ikke eksportert". Platform-
admin kan overstyre og re-eksportere hvis det trengs (f.eks. tapt fil hos
regnskapsfører).

**Accountant-rolle:** IKKE innført i Fase 3B-v2. Platform-admin dekker
accountant-aksjonene via eksisterende platform-admin-rolle. Eventuell separat
accountant-login flyttes til senere fase ved behov.

## Rules & Consequences

- **Good, because** workflow matcher reell bruk — regnskapsfører bruker sitt
  eget system til EHF.
- **Good, because** ingen sertifisering, ingen vendor-lock-in (Tickstar/Pagero),
  ingen OAuth-vedlikehold.
- **Good, because** fleksibelt for fremtidige format-behov (legge til Excel /
  XBRL blir bare en ny artifact-builder).
- **Good, because** `ehf_exported_at`-stempel gir både default-filter og
  audit-sporing uten egen tabell.
- **Bad, because** ingen automatisering — hver måned krever platform-admin-
  click. Akseptabel kostnad gitt volumet i 2026.
- **Bad, because** Smartout lærer mindre om EHF-leveringsstatus (Tickstar hadde
  gitt webhook for delivery confirm). Hvis det blir viktig senere, kan en
  senere fase bygge det på toppen.
- **Agent Impact:** `generateEhfExport` server-action i
  `packages/billing/src/actions/ehf-export/index.ts`. UI i
  `apps/web/src/app/platform-admin/billing/ehf-export/page.tsx`. PDF-generator
  gjenbruker eksisterende per-faktura PDF (Fase 1) + ny cover/summary-PDF via
  samme generator. Workspace-admin toggler `ehf_enabled` + `peppol_participant_id`
  på company-settings (allerede tilgjengelig felt).

---

> Register in `docs/decisions/0000-decision-log.md`.
