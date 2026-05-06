---
title: Payroll Exports — CSV, PDF, A-melding, Tripletex
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [payroll, exports, csv, pdf, a-melding, tripletex, lønnsslipp]
---

# Payroll Exports

> Four export formats. Each has a `payroll_export_event` row + per-line `payroll_export_line` rows. Audit-emit on initiate + complete + fail.

## 1. Export Pattern (Common to All)

```
1. Admin clicks "Export" → modal w/ format choices.
2. Server Action exportPeriod(periodId, format) called via gateAction.
3. capability.export_period executes:
   - Verify period.status === 'approved' (cannot export draft)
   - Insert payroll_export_event (status=processing, format, initiated_by, initiated_at)
   - Insert payroll_export_line per applicable calculation_line (status=pending)
   - emit('payroll.export_initiated', {...})
4. Async work depending on format:
   - CSV: synchronous, returns blob URL
   - PDF: parallel render per profile, writes to Storage bucket, returns folder URL
   - A-melding: async, hands to Tripletex (or Altinn direct in future)
   - Tripletex: async, REST calls per line, idempotency via stored external_id
5. On per-line completion: payroll_export_line.sync_status updates (synced/failed)
6. On overall completion:
   - payroll_export_event.status = 'completed' or 'failed'
   - payroll_export_event.completed_at, error_message if applicable
   - period.status = 'exported' (on first successful export)
   - emit('payroll.export_completed' or 'payroll.export_failed')
```

---

## 2. CSV Export

### 2.1 Two formats

**A. Aggregate (admin daily-driver)**
- One row per profile per period
- Columns: `employee_name`, `personnummer (masked)`, `period`, `gross_minutes`, `regular_hours`, `overtime_hours`, `night_hours`, `holiday_hours`, `weekend_hours`, `kveldstillegg_amount`, `helgetillegg_amount`, `helligdagstillegg_amount`, `manual_supplements_total`, `holiday_pay_accrued`, `total_deductions`, `gross`, `tax`, `net`, `account_number (masked)`
- Use case: spot-check, hand to regnskapsfører as fallback

**B. Audit (bokføringslov-grade)**
- One row per `payroll_calculation_line`
- Columns: `period`, `profile_id`, `employee_name`, `shift_id`, `shift_date`, `salary_code`, `description`, `hours`, `rate`, `amount`, `applied_rule_id`, `applied_tariff_id`, `tariff_version`, `framework_rule_paragraf`, `derivation_version`, `created_at`
- Use case: audit, dispute resolution, reconciliation against Tripletex

### 2.2 Implementation

```typescript
// packages/payroll-export/src/csv.ts
import { unparse } from 'papaparse';

export async function exportPayrollCsv(
  periodId: string,
  variant: 'aggregate' | 'audit',
  ctx: ExportContext,
): Promise<Buffer> {
  const rows = variant === 'aggregate'
    ? await fetchAggregateRows(periodId, ctx)
    : await fetchAuditRows(periodId, ctx);

  const csv = unparse(rows, {
    delimiter: ';',         // Norwegian Excel default
    newline: '\r\n',
    header: true,
  });

  // BOM for Excel UTF-8 detection
  return Buffer.concat([Buffer.from('﻿', 'utf8'), Buffer.from(csv, 'utf8')]);
}
```

### 2.3 Norwegian formatting

- Currency: `Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` — shows as `1 234,56`.
- Dates: `dd.mm.yyyy` (Norwegian convention).
- Decimal separator: comma (matches Excel nb-NO locale).
- Field separator: semicolon `;` (avoids comma collision).
- Encoding: UTF-8 with BOM.

### 2.4 Delivery

- Server Action returns Blob → client triggers download.
- Filename: `payroll-{workspace_slug}-{period}-{variant}-{timestamp}.csv`
- `payroll_export_event.artifact_url` NULL for CSV (not stored long-term; client-only).

---

## 3. PDF Lønnsslipp

### 3.1 Library decision (ADR PENDING)

Two candidates, ADR required before Phase 4:

| Option | Pros | Cons |
|---|---|---|
| `@react-pdf/renderer` | TS-first, server-renderable, ~1MB bundle, deterministic | Custom rendering (not HTML/CSS), limited table primitives |
| `puppeteer` (with Chromium) | HTML/CSS rendering, matches web 1:1 | ~150MB bundle, requires Chromium binary, slower per-render |

**Recommendation:** `@react-pdf/renderer`. PDF is purposeful, not visual-design-heavy. Smaller bundle, simpler ops.

### 3.2 Layout

```
┌─────────────────────────────────────────────────────┐
│ Workspace logo            Lønnsslipp                │
│ Workspace name            Periode: 2026-04          │
│ Workspace orgnr                                     │
├─────────────────────────────────────────────────────┤
│ Ansatt:        Anna Andersen (anna@...)             │
│ Personnummer:  •••••••89 (revealed via tap)         │
│ Ansatt-ID:     A-0042                               │
│ Stilling:      Servitør                             │
│ Bankkonto:     ••••••••2345 (revealed via tap)      │
├─────────────────────────────────────────────────────┤
│ LØNN                                                │
│   Lønnsart   Beskrivelse        Antall  Sats   Sum │
│   020        Timelønn            142,5  198,50 ... │
│   110        Overtidstillegg 50%  12,0   99,25 ... │
│   130        Kveldstillegg        25,5   15,65 ... │
│   140        Helgetillegg         16,0   29,74 ... │
│   ...                                               │
│   ───────────────────────────────────────────────   │
│   Brutto                                kr 32 450,00│
├─────────────────────────────────────────────────────┤
│ TREKK                                               │
│   Tabelltrekk (skattetabell 7100)        kr -8 200 │
│   OTP egeninnskudd                       kr   -649 │
│   ───────────────────────────────────────────────   │
│   Netto                                 kr 23 601,00│
├─────────────────────────────────────────────────────┤
│ FERIEPENGER                                         │
│   Opptjent denne måneden                  kr  3 894 │
│   Saldo                                   kr 12 567 │
├─────────────────────────────────────────────────────┤
│ Generert 2026-05-06 14:23 av Smartout v3            │
│ Verifisering: SHA-256 (siste 8 tegn)                │
└─────────────────────────────────────────────────────┘
```

### 3.3 Implementation

```typescript
// packages/payroll-export/src/pdf.ts
import { renderToBuffer } from '@react-pdf/renderer';
import { Payslip } from './pdf/Payslip';

export async function renderPayslipPdf(
  calculationId: string,
  ctx: ExportContext,
): Promise<Buffer> {
  const payslipData = await fetchPayslipData(calculationId, ctx);
  return await renderToBuffer(<Payslip data={payslipData} />);
}
```

### 3.4 Storage

- Bucket: `payroll-payslips/`
- Path: `{workspace_id}/{period_id}/{profile_id}.pdf`
- Access: signed URL only.
  - Admin: 24h URL on demand.
  - Employee: 1h URL via `/dashboard/my-salary` or mobile.
- Audit-emit on each URL grant (`payroll.payslip_url_granted`).

### 3.5 PII handling on PDF

Personnummer + bankkonto are visible by default on the PDF (it IS lønnsslipp content). However:
- PDF generation requires `view_personal_number` + `view_bank_account` capability resolution.
- Audit-emit (`payroll.personal_number_revealed`, `payroll.bank_account_revealed`) on PDF generation.
- Mobile + web view of PDF goes through signed URL — no further reveal needed.
- Email delivery (optional per workspace): SendGrid attachment, password-protected ZIP option (Phase 4+).

---

## 4. A-melding XML

### 4.1 Strategy

Per ADR-0250 §Open Questions #2: **A-melding submission delegated to Tripletex**. Smartout produces the data; Tripletex generates and submits the XML on its monthly schedule.

If/when Smartout submits direct to Altinn (future), a separate ADR is required (cert management, partner agreement).

### 4.2 Smartout's responsibility

For each `payroll_calculation_line`, ensure Tripletex has:
- Correct `salaryType.id` (mapped from `payroll_salary_code.code`)
- `a_melding_code` set on the salary code
- All A-melding-required metadata: opptjeningsperiode, antall, fordel, etc.

This means: **A-melding correctness is achieved by correct Tripletex sync** (Phase 7).

### 4.3 Local A-melding XML (export-only, no submission)

For workspaces that want to verify or hand A-melding XML to their accountant manually:

```typescript
// packages/payroll-export/src/amelding.ts
import { create } from 'xmlbuilder2';

export async function generateAmeldingXml(
  periodId: string,
  ctx: ExportContext,
): Promise<string> {
  const data = await fetchAmeldingData(periodId, ctx);
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('a-melding', { xmlns: 'http://skatteetaten.no/registreringsenheten/...' })
      .ele('virksomhet', { virksomhetsnummer: data.workspace.orgnr })
        // ... iterate inntektsmottaker → arbeidsforhold → inntekter
      .up()
    .up();

  return doc.end({ prettyPrint: true });
}
```

Validation against Skatteetaten XSD: separate test step (Phase 6 acceptance).

### 4.4 Phase 6 deliverable

- `packages/payroll-export/src/amelding.ts` produces XML.
- Manual button "Last ned A-melding XML" in export modal.
- No automatic submission. Admin downloads + uploads to Altinn manually OR relies on Tripletex sync.

---

## 5. Tripletex Push-Sync

> Full Tripletex API reference: see [TRIPLETEX-INTEGRATION.md](./TRIPLETEX-INTEGRATION.md) for auth, entities, salary types, gotchas.

### 5.1 What gets pushed

For each `payroll_calculation_line` in an approved period:
- One `salaryTransaction` line in Tripletex
- Mapped via `payroll_salary_code.external_code` → Tripletex `salaryType.id`
- Hours → `count`, rate → `rate`, amount → `amount`
- `generateTaxDeduction: true` (Tripletex computes withholding)

### 5.2 Idempotency

Tripletex has no native idempotency header. Smartout enforces:
- Before POST: check `payroll_export_line.external_id IS NOT NULL` → already synced, skip.
- After POST: store returned Tripletex `transactionId` in `payroll_export_line.external_id`.
- Retry on 5xx with backoff; do NOT retry on 4xx (will duplicate).

### 5.3 Conflict resolution

| Resource | Authority |
|---|---|
| Salary transactions for current period | Smartout authoritative — push, overwrite Tripletex per line |
| Past closed period | Tripletex authoritative — Smartout never overwrites |
| Tax card | Skatteetaten authoritative; Smartout fetches direct, syncs to Tripletex |
| Employee master data | Smartout pushes on change; Tripletex receives |
| Salary type catalog | Tripletex authoritative (workspace-configured GUI); Smartout reads + caches |

### 5.4 Implementation

```typescript
// packages/payroll-export/src/tripletex.ts
import { TripletexClient } from './tripletex/client';

export async function syncPeriodToTripletex(
  periodId: string,
  ctx: ExportContext,
): Promise<TripletexSyncResult> {
  const client = await TripletexClient.fromWorkspace(ctx.workspaceId);
  const lines = await fetchSyncableLines(periodId, ctx);

  const results = await Promise.all(lines.map(line => syncLine(client, line, ctx)));

  return {
    success: results.filter(r => r.status === 'synced').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
  };
}
```

Edge Function: `supabase/functions/tripletex-sync/index.ts`
- service_role + workspace-scoped
- Internal trigger only (called from `export_period` capability)
- Token chain stored in 1Password `smartout_ai_prod` vault

### 5.5 Webhook handling (Phase 7+)

Tripletex sends webhook on `employee.create/update/delete` only — no payroll-specific webhooks. Smartout's payroll sync is one-way (push). Tripletex-side changes (e.g. accountant edits salary line) NOT auto-pulled.

If conflict detected (post-export Tripletex value differs from Smartout): emit `payroll.tripletex_drift_detected`, alert admin.

---

## 6. Export Status UX

In `/dashboard/payroll/[periodId]` Export tab:

```
┌─────────────────────────────────────────────────────────┐
│ Periode april 2026 — eksport                            │
│                                                         │
│ Format             Status        Sist eksportert  [▼]  │
│ ──────────────────────────────────────────────────────  │
│ CSV (aggregat)     ✓ Eksportert  2026-05-02 14:23  [⬇] │
│ CSV (audit)        — Ikke eksportert                [→] │
│ PDF lønnsslipp     ✓ 12/12       2026-05-02 14:25  [⬇] │
│ A-melding XML      — Ikke eksportert                [→] │
│ Tripletex          ⚠ 11/12 ok    2026-05-02 14:30  [⟳] │
│   ↳ Anna Andersen — failed: 401 Unauthorized       [⟳] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- `[⬇]` download artifact / signed URL
- `[→]` initiate export
- `[⟳]` retry failed lines
- Per-line failure expandable for diagnosis

---

## 7. Acceptance per Format

| Format | Phase | Acceptance |
|---|---|---|
| CSV (aggregate) | 3 | Open in Excel nb-NO, all numbers match UI, BOM present, semicolon delimiter |
| CSV (audit) | 3 | Each calculation_line round-trips: re-import via re-derivation produces same calculation |
| PDF | 4 | Renders for 12-employee workspace in <5s. PII shown. Signature block present. |
| A-melding XML | 6 | Validates against Skatteetaten XSD; field count matches Tripletex-generated XML for same period |
| Tripletex | 7 | 12-employee workspace round-trips: push → fetch → values match within 0.01 NOK |

---

## 8. Failure Modes

| Failure | Detection | UX |
|---|---|---|
| CSV generation OOM (large workspace) | Server timeout | Stream-based unparse, chunked write |
| PDF render fails per profile | Per-render exception | Other PDFs continue; failed profile shown w/ retry button |
| Storage bucket write fails | Supabase Storage 5xx | Retry 3× w/ backoff; if all fail, payroll_export_event.status='failed' |
| Tripletex sessionToken expired mid-sync | 401 on subsequent line | Auto-refresh token (create new); resume from failed line |
| Tripletex 4xx on line | Per-line | Mark line failed, continue rest of batch, report to admin |
| Tripletex period locked (Tripletex-side) | API error code | Halt sync; alert admin; no auto-retry |
| A-melding XML invalid (XSD validation fail) | Local pre-flight check | Block export; show validation errors |

---

## 9. Files (NEW package)

```
packages/payroll-export/
├── package.json
├── src/
│   ├── index.ts            — public exports
│   ├── types.ts            — shared types
│   ├── csv.ts              — Phase 3
│   ├── pdf.ts              — Phase 4
│   ├── pdf/
│   │   ├── Payslip.tsx
│   │   ├── PayslipHeader.tsx
│   │   ├── PayslipLines.tsx
│   │   └── PayslipFooter.tsx
│   ├── amelding.ts         — Phase 6
│   ├── amelding/
│   │   ├── xml-builder.ts
│   │   └── codes.ts        — A-melding inntektskoder mapping
│   ├── tripletex.ts        — Phase 7
│   ├── tripletex/
│   │   ├── client.ts       — auth chain + REST client
│   │   ├── sync-line.ts
│   │   └── retry.ts
│   └── shared/
│       ├── format.ts       — Norwegian number/date formatting
│       └── fetch.ts        — common fetch from payroll.* schema
└── __tests__/
    ├── csv.test.ts
    ├── pdf.test.ts
    └── amelding.test.ts
```

Edge Functions:

```
supabase/functions/
├── tripletex-sync/index.ts        — Phase 7
├── amelding-export/index.ts       — Phase 6 (optional; only if Smartout submits direct)
└── skatteetaten-fetch/index.ts    — already specced in ADR-0250
```
