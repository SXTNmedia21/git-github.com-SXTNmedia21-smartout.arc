---
title: "PLAN — Avstemming workflow (M7)"
status: draft
updated: 2026-05-02
created: 2026-05-02
module: billing
campaign: order-system
tags: [plan, avstemming, settlement, accountant, erik]
---

# PLAN — Avstemming workflow (M7)

> Eriks 90%-verdi-flow. Én knapp, én pakke i innboksen, 3 min totalt.

## Eriks 3 sesjoner per måned

| Frekvens | Formål | Tid |
|----------|--------|-----|
| 1×/mnd (slutten) | **Avstemming** — generer faktura-grunnlag for hele perioden | 5-15 min |
| 1×/mnd (midt) | Markér mottatt-betalt på ordre | 2-5 min |
| 0-1×/mnd | Oppdater kunde-info | 1-2 min |

90% av verdien ligger i avstemming. Resten er bi-arbeid.

## Forsiden — action-dashboard

IKKE workspace-liste. Workspace-liste er detaljvisning.

```
┌───────────────────────────────────────────────┐
│  Avstemming — September 2026                  │
│  6 workspaces · 23 ordre · 341 300 NOK        │
│  Periodekutt: 30.09.2026 (om 3 dager)         │
│                                               │
│  [ Kjør avstemming ]                          │
└───────────────────────────────────────────────┘

Hurtigoppgaver
  • 4 ordre venter «mottatt betalt»-markering →
  • 1 kunde har endret org.nr — bekreft →

Forrige periode: August 2026 · ✓ Avstemt 02.09 · [Vis pakke]

─────────────────────────────────────────────
[ Workspaces ] [ Historikk ] [ Innstillinger ]
```

## Datamodell

Tre nye tabeller i `billing` schema:

### `billing.settlement_period`

Én rad per (workspace, måned). Lifecycle: `open → locked → closed`.

```sql
CREATE TABLE billing.settlement_period (
  period_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id),
  period_start DATE NOT NULL,    -- f.eks. 2026-09-01
  period_end DATE NOT NULL,      -- f.eks. 2026-09-30
  status billing.settlement_status NOT NULL DEFAULT 'open',
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES public.user_identity(user_id),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.user_identity(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, period_start, period_end)
);

CREATE TYPE billing.settlement_status AS ENUM ('open', 'locked', 'closed');
```

**State-overganger:**
- `open` → ordre kan endres fritt
- `locked` → snapshot tatt, endringer tillatt men logges som avvik
- `closed` → endelig stengt, ingen endringer uten audit-supersession

### `billing.settlement_run`

Én rad per "Kjør avstemming"-klikk. Ikke nødvendigvis 1:1 med period — kan kjøres flere ganger (preview → final).

```sql
CREATE TABLE billing.settlement_run (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope billing.settlement_scope NOT NULL,
  -- 'single_workspace' eller 'all_workspaces' (cross-company)
  initiated_by UUID NOT NULL REFERENCES public.user_identity(user_id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  workspace_ids UUID[] NOT NULL,    -- workspaces inkludert i denne run
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status billing.settlement_run_status NOT NULL DEFAULT 'running',
  -- 'running' | 'succeeded' | 'failed' | 'cancelled'
  summary JSONB NOT NULL DEFAULT '{}',
  -- aggregate totals: amount_excl_vat, amount_incl_vat, paid, outstanding, vat_breakdown, discrepancies
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE billing.settlement_scope AS ENUM ('single_workspace', 'all_workspaces');
CREATE TYPE billing.settlement_run_status AS ENUM ('running', 'succeeded', 'failed', 'cancelled');
```

### `billing.settlement_artifact`

Filer generert av en run.

```sql
CREATE TABLE billing.settlement_artifact (
  artifact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES billing.settlement_run(run_id) ON DELETE CASCADE,
  artifact_type billing.settlement_artifact_type NOT NULL,
  -- 'summary_pdf' | 'detail_csv' | 'invoice_bundle_pdf' | 'discrepancy_pdf'
  storage_path TEXT NOT NULL,    -- Supabase Storage bucket path
  file_size_bytes INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, artifact_type)
);

CREATE TYPE billing.settlement_artifact_type AS ENUM (
  'summary_pdf', 'detail_csv', 'invoice_bundle_pdf', 'discrepancy_pdf'
);
```

## Server-action: `runSettlement(periodMonth, workspaceScope)`

Pseudo-flow (in `apps/admin/src/lib/avstemming/actions.ts`):

```typescript
"use server";
async function runSettlement(input: {
  period_start: string;       // "2026-09-01"
  period_end: string;          // "2026-09-30"
  workspace_ids: string[];     // alle granted, eller subset
}) {
  const { userId, companyIds } = await requireAccountant();

  // 1. Pre-check: alle workspaces må være granted
  // 2. Opprett settlement_run row, status='running'
  const run = await createSettlementRun({...});

  // 3. For hver workspace, lås periode (idempotent)
  for (const ws of workspace_ids) {
    await lockSettlementPeriod(ws, period_start, period_end);
  }

  // 4. Beregn aggregater
  const summary = await computeSummary(workspace_ids, period_start, period_end);
  // - per workspace: count_orders, sum_excl_vat, sum_incl_vat, paid, outstanding
  // - global: total_excl, total_incl, total_paid, total_outstanding
  // - mva_breakdown: { '0.25': X, '0.15': Y, '0.12': Z }
  // - discrepancies: [{ type, invoice_id, severity, message }]

  // 5. Generer artefakter (parallelt)
  const [summaryPdf, detailCsv, bundlePdf, discrepancyPdf] = await Promise.all([
    generateSummaryPdf(summary),
    generateDetailCsv(summary),
    generateInvoiceBundlePdf(workspace_ids, period),
    generateDiscrepancyPdf(summary.discrepancies),
  ]);

  // 6. Last opp til Supabase Storage
  // 7. Insert settlement_artifact rows
  // 8. Send e-post til Erik (SendGrid)
  // 9. Update run.status='succeeded' + completed_at
  // 10. Emit telemetry: "settlement run_completed"

  return { run_id: run.run_id, artifacts_url: `/avstemming/${run.run_id}` };
}
```

## Artefakt 1: Sammendrag (PDF, 1 side)

```
SMARTOUT AVSTEMMING — September 2026

Pr workspace:
  Strøm Mat & Bar           12 ordre   87 500 NOK   ✓ 100% mottatt
  Villa Mat AS               8 ordre   64 200 NOK   ⚠ 87% (1 forfalt)
  Bårdshaug                  3 ordre   28 100 NOK   ◯ 0% (utstedt 28.09)
  Fjelds mat                 0 ordre        0 NOK   — pause
  Yogurt Heaven              7 ordre   52 800 NOK   ⚠ partial 1
  Smartout AS                3 ordre  108 700 NOK   ✓ 100%

Totalt:
  Fakturert ekskl mva:    273 040 NOK
  MVA (25%):               68 260 NOK
  Fakturert inkl mva:     341 300 NOK
  Mottatt:                291 800 NOK
  Utestående:              49 500 NOK

Avvik (3 stk):
  ⚠ Villa Mat — #1234 forfalt 14 dager
  ⚠ Yogurt Heaven — partial 8 000 av 10 000
  ◯ Bårdshaug — ny faktura, ikke forfalt
```

PDF-generator: bruk eksisterende `@smartout/billing/server/order-export.ts` infrastructure (M3 stub som vi nå wirer).

## Artefakt 2: Detalj-linjer (CSV)

Tripletex / Fiken / Visma-import-klar:

```
date,invoice_number,org_nr,company,workspace,amount_excl_vat,vat_rate,vat,amount_incl_vat,status,paid_at
2026-09-01,1024,912345678,Strøm Mat AS,Strøm Hovedrest,12000,0.25,3000,15000,paid,2026-09-15
2026-09-01,1025,923456789,Villa Mat AS,Villa Sentrum,8000,0.25,2000,10000,issued,
2026-09-15,1026,934567890,Yogurt Heaven AS,YH Storo,9500,0.25,2375,11875,partial,2026-09-25
...
```

Kolonner-rekkefølge matcher Tripletex import-format. Hvis Erik bruker noe annet, justeres senere.

## Artefakt 3: Faktura-bunke (PDF)

Alle grunnfakturaer for perioden samlet i én PDF:
- Header: "Smartout grunnfakturaer — September 2026"
- Side per ordre (PDF-merge fra eksisterende per-faktura-PDF)
- Hver ordre har: org.nr, beløp, dato, MVA, betalingsdetaljer, kontonummer

Erik kan skrive ut hele bunken og sende post hvis kunde ikke har e-post.

## Artefakt 4: Avvik-liste (PDF)

Kun ting Erik må reagere på:
- Forfalte ordre (over 14 dager)
- Partial betalinger (mismatch beløp)
- Ordre uten betaling > 30 dager
- Manglende kunde-info (org.nr blank, etc.)

Format: tabell med radhandling Erik kan ta direkte ("Send purring" / "Marker som tap").

## Telemetri-events (legges til registry)

- `settlement run_initiated` — Erik klikker knappen
- `settlement run_completed` — alle artefakter generert
- `settlement run_failed` — feil under kjøring
- `settlement period_locked` — periode lås satt
- `settlement period_closed` — endelig lukking
- `settlement artifact_downloaded` — Erik laster ned PDF/CSV (per type)

## E-post til Erik

SendGrid template `accountant-settlement-completed`:

```
Subject: Avstemming klar — September 2026 (6 workspaces, 341 300 NOK)

Hei Erik,

Avstemmingen for september er klar.

Kortversjon:
  • 23 ordre fakturert (341 300 NOK inkl mva)
  • 291 800 NOK mottatt
  • 49 500 NOK utestående
  • 3 avvik krever oppmerksomhet

Last ned:
  • [Sammendrag PDF]
  • [Detalj-linjer CSV (Tripletex)]
  • [Faktura-bunke PDF]
  • [Avvik-liste PDF]

Eller åpne i nettleseren: https://admin.smartout.ai/avstemming/<run_id>

— Smartout
```

## Migrations

- `20260522000000_billing_settlement_schema.sql` — 3 tabeller + 3 enums
- `20260522000100_billing_settlement_rls.sql` — accountant RLS (les egne grants, skriv via service-role server action)
- `20260522000200_billing_settlement_helpers.sql` — `lock_settlement_period(uuid, daterange)` + `compute_period_aggregates(uuid, daterange)` SECURITY DEFINER funksjoner

## Pages

- `/` — dashboard (NEW, replaces redirect-to-/workspaces)
- `/avstemming/run` — pre-check + confirm-modal før run
- `/avstemming/[run_id]` — visning av kjørt avstemming, last-ned-knapper
- `/avstemming/historikk` — liste over alle tidligere runs
- `/workspaces` — flyttet til side-tab (uendret innhold)
- `/workspaces/[id]` — uendret detaljvisning

## ADR-E (draft)

Title: **Settlement as immutable snapshot with engine_state-style audit-trail**

Context: Avstemming må være reproducible. Når Erik kjører i oktober for september, må han kunne kjøre IGJEN i november og få EXACT samme resultat (idempotency for compliance/MVA-rapportering).

Decision:
- `settlement_run` row er immutable — ny kjøring = ny run, ikke overskrive
- `settlement_period.status='locked'` fryser ordre-state i perioden
- Ordre-endringer etter `locked_at` flagges som "post-lock change" i avviks-rapporten
- `closed` periode kan ikke unlocked uten ADR-supersession

Consequences:
- Storage cost: hver run lagrer sine egne 4 PDFer/CSV (kan auto-prune etter 7 år GDPR-min)
- Audit-fordel: full historikk, hver kjøring sporbart
- UI-implikasjon: Erik kan kjøre PREVIEW (status='running' + auto-cancel) for å se resultat før lock

## Implementeringsrekkefølge

1. Migrations + RLS + pgTAP
2. Server-action `runSettlement()` + 4 generatorer
3. Storage bucket `settlement-artifacts` + RLS
4. SendGrid template + e-post-trigger
5. `/` dashboard + `/avstemming/[run_id]` page
6. Erik UAT (M8)

## Hard constraints

- ⛔ NEVER bypass `settlement_period.status='closed'` write-lock uten ADR
- ⛔ NEVER fjerne `settlement_run` rows (immutable audit-trail)
- ⛔ NEVER inkluder PII i CSV utover org.nr + beløp (GDPR)
- ⛔ NEVER kjør på prod uten Erik UAT først
- ⛔ NEVER auto-trigger settlement uten Erik klikker — må være eksplisitt
