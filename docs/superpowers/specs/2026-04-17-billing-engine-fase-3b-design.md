---
title: "Billing Engine Fase 3B — EHF CSV/PDF-eksport (Spec v2)"
status: draft
updated: 2026-04-18
created: 2026-04-17
module: billing
tags: [billing, ehf, csv, pdf, platform-admin, cascade-c3]
depends_on:
  - docs/superpowers/specs/2026-04-17-billing-engine-fase-3-design.md
related:
  - docs/superpowers/specs/2026-04-17-billing-engine-fase-2-design.md
  - docs/decisions/0148-ehf-export-csv-pdf-platform-admin.md
supersedes:
  - docs/decisions/0145-workspace-oauth-token-storage-supabase-vault.md
  - docs/decisions/0146-peppol-ehf-transport-via-tickstar.md
  - docs/decisions/0147-integration-poll-payments-separate-engine-process.md
---

# Billing Engine Fase 3B — EHF CSV/PDF-eksport (Spec v2)

> **Status:** Draft spec (v2, rescoped 2026-04-18).
> **Bygger på:** Fase 3A (`feat/billing-engine-fase-3`) og Fase 2.
> **Supersederer:** ADR-0145 Vault OAuth, ADR-0146 Tickstar Peppol, ADR-0147 poll.

## 0. Bakgrunn + rescope

Den opprinnelige Fase 3B-speccen (v1, 2026-04-17) forutsatte at Smartout selv leverer
EHF via Peppol (Tickstar) + workspace-OAuth mot Fiken/Tripletex. Ved rescope
2026-04-18 ble det klart at den reelle workflowen er: Smartout produserer
fakturagrunnlaget, en ekstern **regnskapsfører** lager EHF fra sitt eget system
basert på månedlig eksport, og regnskapsfører markerer fakturaer betalt i
Smartout på melding.

Denne speccen v2 fjerner alt Peppol/Tickstar/OAuth/poll-scope og beskriver kun
den enkle eksport-pakken + accountant-mark-paid-flyten.

## 1. Scope

**Inne:**

1. `company.ehf_enabled` + `company.peppol_participant_id` (begge fra B1-
   revert-commit, allerede i branchen).
2. Workspace-admin kan toggle `ehf_enabled` + sette `peppol_participant_id` i
   workspace-settings.
3. Platform-admin EHF-eksport-side som genererer CSV og/eller PDF, samlet
   eller per workspace.
4. `invoice.ehf_exported_at timestamptz NULL`-kolonne for å spore hva som er
   eksportert + støtte default-filter i UI.
5. Accountant-manual mark-paid: platform-admin utfører Fase 2
   `markInvoicePaid` med `payment_source = 'accountant_manual'`; nytt
   telemetry-event `billing accountant_marked_paid`.
6. 2 nye telemetry-events: `billing ehf_export_generated` +
   `billing accountant_marked_paid` (allerede i B1-revert-commit).

**Utenfor:**

- Peppol-transport (vi sender ingenting)
- OAuth mot Fiken/Tripletex
- Automatisk poll av eksterne betalingssystemer
- Accountant-rolle / egen innlogging for regnskapsfører

## 2. Eksport-UI

Rute: `/platform-admin/billing/ehf-export`

```
┌─ EHF-eksport ──────────────────────────────────────────────┐
│ Periode:      [april 2026 ▼]                               │
│                                                            │
│ Grouping:     [x] Samlet                                   │
│               [x] Per workspace                            │
│                                                            │
│ Format:       [x] CSV                                      │
│               [x] PDF                                      │
│                                                            │
│ Filter:       [x] Ikke allerede eksportert                 │
│                                                            │
│ Fakturaer funnet: 47 (9 workspaces)                        │
│ Sum inkl. MVA:    123 450 kr                               │
│                                                            │
│                         [Generer eksport]                  │
└────────────────────────────────────────────────────────────┘
```

Ved generering returneres én signed-URL per artefakt. Hvis flere valg er
aktive, bundles alt som én zip med cover-manifest.

## 3. Artefakt-matrise

| Grouping | Format | Filnavn | Innhold |
|---|---|---|---|
| Samlet | CSV | `ehf-eksport-2026-04.csv` | 1 rad per faktura, workspace-kolonner |
| Samlet | PDF | `ehf-eksport-2026-04.pdf` | oversiktsside + alle faktura-PDFer konkatenert |
| Per workspace | CSV | zip: `<workspace-slug>-2026-04.csv` per workspace | |
| Per workspace | PDF | zip: `<workspace-slug>-2026-04.pdf` per workspace | workspace-cover + fakturaer |
| Flere valg | | `ehf-eksport-2026-04.zip` | bundler alle valgte artefakter |

## 4. CSV-format

Kolonner (RFC-4180, UTF-8 med BOM for Excel-kompatibilitet):

```
invoice_number, invoice_date, due_date, workspace_name, workspace_org_nr,
peppol_participant_id, amount_ex_vat, vat_amount, amount_incl_vat, currency,
line_items_json
```

`line_items_json` escapes `,` og `"` per RFC-4180. Regnskapsfører kan parse
feltet som JSON for detaljerte linjer.

## 5. Filtrering av fakturaer

Eligible hvis alle gjelder:

- `invoice.status IN ('issued', 'overdue')`
- `workspace.company.ehf_enabled = true`
- `workspace.company.peppol_participant_id IS NOT NULL`
- `invoice.invoice_date` faller innenfor valgt periode
- Hvis "Ikke allerede eksportert"-toggle er på: `invoice.ehf_exported_at IS NULL`

## 6. Migrasjon (ny, tillegg til B1-commit)

```
supabase/migrations/20260513000001_invoice_ehf_exported_at.sql
```

```sql
ALTER TABLE public.invoice
  ADD COLUMN ehf_exported_at timestamptz NULL;

CREATE INDEX invoice_ehf_exported_at_idx
  ON public.invoice(ehf_exported_at)
  WHERE ehf_exported_at IS NOT NULL;
```

## 7. Server Action

Fil: `packages/billing/src/actions/ehf-export/generateEhfExport.ts`

```ts
export type GenerateEhfExportInput = {
  period: { from: string; to: string }; // ISO dates
  grouping: ReadonlyArray<"bundled" | "per_workspace">;
  format: ReadonlyArray<"csv" | "pdf">;
  excludeAlreadyExported: boolean;
};

export type EhfExportArtifact = {
  filename: string;
  content_type: string;
  signed_url: string; // storage bucket: ehf-exports
};

export type GenerateEhfExportResult =
  | { status: "ok"; artifacts: EhfExportArtifact[]; invoice_count: number; workspace_count: number }
  | { status: "no_invoices"; message: string }
  | { status: "error"; message: string };
```

Action emitter `billing ehf_export_generated` på success + oppdaterer
`invoice.ehf_exported_at` for alle inkluderte fakturaer (batch UPDATE).

## 8. Accountant mark-paid

Bruker eksisterende Fase 2 `markInvoicePaid` server-action. Legger til én
ny `payment.payment_source` ENUM-verdi: `'accountant_manual'`.

```sql
ALTER TYPE payment_source ADD VALUE IF NOT EXISTS 'accountant_manual';
```

Etter mark-paid emittes:

1. `payment succeeded` (standard Fase 3A)
2. `billing accountant_marked_paid` (nytt, for eksplisitt audit)

Begge hentes av billing_activity_log + engine_event for reconcile-workflows.

## 9. Telemetry

Events (allerede commited i B1-revert):

- `billing ehf_export_generated` → logger + billing_activity_log
- `billing accountant_marked_paid` → logger + billing_activity_log + engine_event

## 10. Test-matrise

| Testnivå | Filer | Scenarier |
|---|---|---|
| Vitest (pakke) | `packages/billing/src/actions/ehf-export/__tests__/generateEhfExport.spec.ts` | 4: happy path (CSV+PDF samlet), no invoices, filter excludes exported, format validation |
| pgTAP | `supabase/tests/migrations/20260513000001_invoice_ehf_exported_at.spec.sql` | invoice.ehf_exported_at kolonne + index eksisterer |
| Journey | `docs/journeys/JOURNEY-billing-engine-fase-3b.md` | 4 journeys: (1) workspace-admin toggler EHF, (2) platform-admin genererer månedlig eksport, (3) regnskapsfører-melding → platform-admin mark-paid, (4) re-eksport av tapt fil |

## 11. Build-rekkefølge (rest av Fase 3B)

B1 er allerede commitet (company-kolonner + revert + 2 telemetry-events +
ADR-0148).

- **B2:** Migrasjon `invoice.ehf_exported_at` + `payment_source` enum-tillegg + pgTAP.
- **B3:** `generateEhfExport` server-action (CSV-builder først).
- **B4:** PDF-builder (gjenbruker eksisterende per-faktura PDF +
  samle/cover-sider via samme generator).
- **B5:** Platform-admin UI (`/platform-admin/billing/ehf-export/page.tsx`).
- **B6:** Workspace-admin toggle EHF (workspace-settings-page).
- **B7:** Accountant-mark-paid-sporing: `payment_source = 'accountant_manual'`
  + emit `billing accountant_marked_paid`.
- **B8:** Journey + handoff + gate-run.

## 12. Ute-av-scope (for Fase 4+)

- Accountant-rolle / egen innlogging
- Automatisk levering til regnskapsfører (SFTP, epost-vedlegg)
- Excel/XBRL-format
- Peppol-transport direkte fra Smartout
- OAuth-integrasjoner mot regnskapssystemer

Flagges her for å unngå fremtidig scope-krip.
