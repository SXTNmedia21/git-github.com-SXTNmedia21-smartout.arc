---
title: "Module 4.5: Daily Financial Close Engine"
status: in_progress
updated: 2026-03-22
created: 2026-03-05
module: operations
tags: [settlement, daily-close, ocr, reconciliation, cascade]
---

# Module 4.5: Sättelfunktion — Daily Financial Close Engine

> **Smartout.ai** — Functional documentation for migration
> Version 1.0 | March 2026
>
> **Origin:** Brainstorm session on AI-driven daily reconciliation with image capture from iSettle/POS terminals, OCR extraction, cross-validation, gatekeeper logic, and manager approval.
>
> **Architectural note:** This is NOT a standalone module. It is a **sub-module of Module 4 (Operations)** that extends the Department Session sign-off with a financial close layer. It hooks directly into the session lifecycle, the CLOSE hook, and the accountability system. It gets its own document because of its complexity and the dedicated data model it introduces.

## Doc alignment (runtime source of truth)

For runtime close status and reconciliation, source of truth is current code/runtime data:

- `daily_reconciliation` + `reconciliation_status` for financial reconciliation flow.
- `department_session.status` + current `department_session_status` enum values in code (`upcoming`, `active`, `pending_signoff`, `closed`, `missed`).

Hospitality Operations Cockpit V1 must consume this runtime truth directly and must not introduce parallel workflow state.

---

## 1. The Core Insight

A restaurant doesn't just close operationally — it closes **financially**.

Module 4 already defines session sign-off: tasks completed, deviations documented, handoff notes written. But for the business to actually close the day, someone must reconcile the money. Did what the POS says match what the payment terminal says? Is there a cash difference? Were there returns? Is everything accounted for?

Today this happens on paper, in Excel, or not at all. Staff rush out. Numbers get lost. Managers discover problems days later.

The Sättelfunktion turns this into a **hard-locked, AI-verified, image-based financial close** that is part of the session sign-off flow. Nobody checks out until the money is accounted for. Nobody moves on until the manager has approved.

**This is not "kassaavstämning."**
**This is a behavior-driven financial close engine that enforces operational discipline.**

## Cascade Mapping

> This module's relationship to the Cascade Core Foundation
> (spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)

| Dimension               | Role                                                        |
| ----------------------- | ----------------------------------------------------------- |
| D6 Production & Product | Primary — settlement closes the day's production state      |
| C1 Calibration          | Primary — plan vs actual comparison drives corrections      |
| C3 Commercial & Outcome | Produces — cost attribution for the settled day             |
| D4 Demand Signal        | Consumes — settled actuals refine future demand predictions |

**Implementation notes:** Financial close extends D6 session lifecycle. When close is approved, it should finalize `shift_cost_snapshot` records (C3 Commercial control plane, append-only). Cost data is READ from cascade-computed snapshots, not independently recomputed. See cascade spec Phase A (`shift_cost_snapshot` table) and Section 4.4 (provenance requirements).

---

## 2. How It Fits Into the Session Lifecycle

The Sättelfunktion extends the existing Department Session sign-off (Module 4, Section 14):

```
Department Session lifecycle (existing):
  upcoming → active → pending_signoff → closed

Extended with financial close:
  active
    │
    ▼  (CLOSE hook fires — e.g., 22:00)
  closing_in_progress
    │  ├── Operational close (existing: tasks, checklists, handoff)
    │  └── Financial close (NEW: images, OCR, reconciliation)
    │
    ▼  (all gates passed)
  pending_signoff
    │  ├── Operational sign-off (existing)
    │  └── Financial sign-off (NEW: numbers reviewed, images attached)
    │
    ▼  (authorized person signs)
  awaiting_approval  ← NEW state (financial layer requires manager next-day)
    │
    ▼  (manager approves)
  closed
```

The financial close is a **parallel track** within the closing process, not a sequential addition. The closer works through operational tasks AND financial tasks simultaneously during closing.

---

## 3. Conceptual Model

```
Department Session (Kitchen — Monday Feb 24)
  │
  └── Financial Close (daily_financial_close)
        │
        ├── Image Intake
        │     ├── iSettle Settlement Report (photo)
        │     ├── POS Closing Screen (photo)
        │     └── Optional: Z-report, cash drawer photo
        │
        ├── OCR Pipeline
        │     ├── Image → Supabase Storage
        │     ├── Trigger → Edge Function / n8n
        │     ├── OCR API (Vision) → raw text
        │     └── Financial Parser → structured data
        │
        ├── Validation Engine
        │     ├── Cross-match: POS total vs iSettle total
        │     ├── Tolerance check (configurable per workspace)
        │     └── Deviation auto-flagging
        │
        ├── Gatekeeper
        │     ├── All critical tasks completed?
        │     ├── Both images uploaded and parsed?
        │     ├── Deviations commented?
        │     └── → Unlock checkout
        │
        └── Manager Approval (next day)
              ├── Review: numbers + images + deviations
              ├── Approve → day = CLOSED
              └── Reject → day = REJECTED (rework required)
```

---

## 4. Roles & Responsibilities

| Role            | Responsibility                                                                          | Authority                                                                  |
| --------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Closer**      | Person on closing shift. Executes close tasks, captures images, comments on deviations. | Can initiate and complete financial close. Cannot approve.                 |
| **Manager**     | Approves or rejects the financial close next day. Reviews all data.                     | Can approve, reject, request clarification. Can override OCR with comment. |
| **Admin/Owner** | Configures tolerance thresholds, mandatory image types, critical task definitions.      | Full configuration access. Can approve.                                    |
| **System**      | Performs OCR, parsing, validation, gatekeeper enforcement, audit logging.               | Autonomous on validation. Never approves — only humans approve.            |

### Closer Assignment

The Closer is determined by the session's closing shift template or by explicit assignment:

1. Shift template with `is_closing_shift: true` → person on that shift is Closer by default
2. Team leader on closing shift can reassign Closer role
3. If no explicit Closer, system uses the last person with sign-off authority (existing Module 4 logic)

---

## 5. Data Model

### 5.1 Daily Financial Close (Main Record)

One per department session. Created when the CLOSE hook fires or when the Closer initiates "Start Dagsavstämning."

```
daily_financial_close
  close_id             uuid (PK)
  workspace_id         fk → workspace
  session_id           fk → department_session (1:1)
  department_id        fk → department
  location_id          fk → location
  business_date        date

  -- State Machine
  state                financial_close_state enum

  -- Extracted Financial Data (populated by OCR + parser)
  pos_total            decimal(12,2) | null
  pos_card             decimal(12,2) | null
  pos_cash             decimal(12,2) | null
  pos_vat              decimal(12,2) | null
  pos_transactions     integer | null

  isettle_total        decimal(12,2) | null
  isettle_card         decimal(12,2) | null
  isettle_transactions integer | null

  -- Calculated
  difference           decimal(12,2) | null (pos_total - isettle_total)
  difference_pct       decimal(5,2) | null (difference / pos_total * 100)
  cash_counted         decimal(12,2) | null (manual input from Closer)
  cash_expected        decimal(12,2) | null (pos_cash)
  cash_difference      decimal(12,2) | null

  -- Validation
  validation_status    validation_status enum
  validation_notes     text | null (system-generated explanation)

  -- Tolerance (snapshot from workspace config at close time)
  tolerance_type       'fixed' | 'percentage'
  tolerance_value      decimal(10,2)

  -- Approval
  approved_by          fk → profile | null
  approved_at          timestamp | null
  rejected_by          fk → profile | null
  rejected_at          timestamp | null
  rejection_reason     text | null

  -- Audit
  closed_by            fk → profile (who initiated the close)
  closed_at            timestamp
  created_at           timestamp
  updated_at           timestamp
```

**Enums:**

```typescript
type FinancialCloseState =
  | "not_started" // Session active, close not initiated
  | "closing_in_progress" // Closer is working on it
  | "awaiting_ocr" // Images uploaded, OCR processing
  | "awaiting_validation" // OCR done, validation running
  | "validation_failed" // Mismatch detected, needs comment
  | "awaiting_approval" // All gates passed, waiting for manager
  | "rejected" // Manager rejected, Closer must fix
  | "closed"; // Manager approved, day locked

type ValidationStatus =
  | "pending" // Not yet validated
  | "passed" // Within tolerance
  | "failed" // Outside tolerance
  | "manual_override"; // OCR failed, Closer entered manually
```

### 5.2 Close Images

Each image captured during financial close.

```
close_image
  image_id             uuid (PK)
  close_id             fk → daily_financial_close
  workspace_id         fk → workspace

  -- Image
  image_type           close_image_type enum
  storage_path         string (Supabase Storage path)
  storage_url          string (signed URL or public URL)
  file_size_bytes      integer
  mime_type            string

  -- OCR Output
  ocr_raw_text         text | null
  ocr_confidence       decimal(3,2) | null (0.00–1.00)
  ocr_provider         string | null ('google_vision' | 'azure_cv' | 'openai_vision')
  ocr_processed_at     timestamp | null

  -- Parsed Financial Data
  parsed_data          jsonb | null
  parse_status         'pending' | 'success' | 'failed' | 'manual'
  parse_error          text | null

  -- Metadata
  captured_at          timestamp | null (EXIF or app-provided)
  captured_by          fk → profile
  device_info          jsonb | null (device model, OS, app version)
  gps_lat              decimal(10,7) | null
  gps_lng              decimal(10,7) | null

  -- Fraud Prevention
  image_hash           string | null (perceptual hash for duplicate detection)

  created_at           timestamp
  updated_at           timestamp
```

**Enums:**

```typescript
type CloseImageType =
  | "isettle_settlement" // iSettle/Zettle settlement report
  | "pos_closing_screen" // POS system closing/end-of-day screen
  | "z_report" // Z-rapport (fiscal daily report)
  | "cash_drawer" // Photo of cash drawer / counted cash
  | "receipt_bundle" // Bundle of receipts
  | "other"; // Any other supporting image
```

**Parsed Data Structure (jsonb):**

```typescript
// For isettle_settlement
interface ISettleParsedData {
  total_amount: number;
  card_amount: number;
  transaction_count: number;
  settlement_date: string; // if parseable
  terminal_id: string | null; // if parseable
  currency: string; // NOK, SEK, etc.
}

// For pos_closing_screen
interface POSParsedData {
  total_sales: number;
  card_total: number;
  cash_total: number;
  vat_total: number;
  transaction_count: number;
  report_date: string | null;
  report_type: string | null; // "daily", "shift", "z-report"
}
```

### 5.3 Close Tasks (Financial Close Checklist)

Financial-specific closing tasks that must be completed. These are IN ADDITION to the regular session closing tasks from Module 4.

```
close_task
  task_id              uuid (PK)
  close_id             fk → daily_financial_close
  workspace_id         fk → workspace

  -- Task Definition
  task_code            string (workspace-configurable identifier)
  title                string
  description          string | null

  -- Requirements
  is_required          boolean default true
  is_critical          boolean default false (critical = blocks checkout)
  requires_photo       boolean default false
  requires_comment     boolean default false

  -- Completion
  completed            boolean default false
  completed_by         fk → profile | null
  completed_at         timestamp | null
  comment              text | null
  photo_url            string | null

  -- Ordering
  sort_order           integer

  created_at           timestamp
```

**Default Close Tasks (workspace-configurable):**

| Task Code         | Title                          | Critical     | Requires Photo        |
| ----------------- | ------------------------------ | ------------ | --------------------- |
| `settle_pos`      | Kör dagsstängning i kassan     | Yes          | No                    |
| `settle_terminal` | Kör settlement på kortterminal | Yes          | No                    |
| `photo_pos`       | Ta bild på kassarapport        | Yes          | Yes (→ close_image)   |
| `photo_isettle`   | Ta bild på terminalrapport     | Yes          | Yes (→ close_image)   |
| `count_cash`      | Räkna kontantkassa             | Yes          | No (but input amount) |
| `lock_register`   | Lås kassaregister              | Yes          | No                    |
| `check_temps`     | Kontrollera kyltemperaturer    | Configurable | Configurable          |
| `lock_doors`      | Lås dörrar och fönster         | Yes          | No                    |
| `alarm_on`        | Aktivera larm                  | Yes          | No                    |

### 5.4 Close Deviations

Deviations specific to the financial close. These follow the same pattern as Module 4/5 deviations but are scoped to the financial close record.

```
close_deviation
  deviation_id         uuid (PK)
  close_id             fk → daily_financial_close
  workspace_id         fk → workspace

  -- Classification
  deviation_type       close_deviation_type enum
  severity             'low' | 'medium' | 'high' | 'critical'

  -- Content
  description          text (auto-generated or manual)
  amount               decimal(12,2) | null (if financial difference)

  -- Resolution
  status               'open' | 'commented' | 'resolved' | 'escalated'
  comment              text | null (Closer's explanation)
  resolution_note      text | null (Manager's note on approval)

  -- Who
  flagged_by           'system' | 'closer' | 'manager'
  resolved_by          fk → profile | null
  resolved_at          timestamp | null

  created_at           timestamp
  updated_at           timestamp
```

**Enums:**

```typescript
type CloseDeviationType =
  | "total_mismatch" // POS total ≠ iSettle total
  | "card_mismatch" // Card subtotals don't match
  | "cash_difference" // Counted cash ≠ expected cash
  | "ocr_failed" // OCR couldn't extract data
  | "ocr_low_confidence" // OCR confidence below threshold
  | "image_quality" // Image too blurry/dark for reliable OCR
  | "missing_image" // Required image not uploaded
  | "manual_override" // Closer entered data manually
  | "unusual_amount" // AI: amount significantly outside historical norm
  | "late_close" // Close initiated significantly after scheduled time
  | "return_after_close" // Transaction recorded after close initiated
  | "other"; // Manual deviation
```

### 5.5 Close Configuration (per workspace)

```
financial_close_config
  config_id            uuid (PK)
  workspace_id         fk → workspace (1:1)

  -- Tolerance
  tolerance_type       'fixed' | 'percentage'
  tolerance_value      decimal(10,2) default 50 (50 NOK or 0.5%)

  -- Required Images
  required_image_types close_image_type[] default ['isettle_settlement', 'pos_closing_screen']

  -- OCR Configuration
  ocr_provider         string default 'openai_vision'
  ocr_confidence_threshold decimal(3,2) default 0.80
  auto_retry_on_low_confidence boolean default true

  -- Gatekeeper Rules
  block_checkout_on_failed_validation boolean default true
  allow_manual_override boolean default true
  manual_override_requires_comment boolean default true

  -- Approval Rules
  approval_required    boolean default true
  approval_deadline_hours integer default 24
  auto_escalate_on_deadline boolean default true

  -- Historical AI
  use_historical_baseline boolean default false (v2: compare to typical day)
  anomaly_threshold_pct decimal(5,2) default 20.0 (flag if >20% from baseline)

  -- Cash Handling
  require_cash_count   boolean default true
  cash_tolerance_type  'fixed' | 'percentage'
  cash_tolerance_value decimal(10,2) default 20

  created_at           timestamp
  updated_at           timestamp
```

### 5.6 POS Template (for parser intelligence)

Different POS systems have different report layouts. The parser needs to know what to look for.

```
pos_template
  template_id          uuid (PK)
  workspace_id         fk → workspace

  name                 string (e.g., "iZettle Standard", "Lightspeed X", "Zettle 2024")
  pos_system           string (e.g., "zettle", "lightspeed", "square", "amigo", "custom")
  template_type        'isettle' | 'pos'

  -- Parser Configuration
  parser_rules         jsonb
  -- Example:
  -- {
  --   "total_pattern": "TOTAL[:\\s]*(\\d+[.,]\\d+)",
  --   "card_pattern": "Kort[:\\s]*(\\d+[.,]\\d+)",
  --   "cash_pattern": "Kontant[:\\s]*(\\d+[.,]\\d+)",
  --   "vat_pattern": "MVA[:\\s]*(\\d+[.,]\\d+)",
  --   "tx_count_pattern": "Transaksjoner[:\\s]*(\\d+)",
  --   "decimal_format": "comma",
  --   "currency": "NOK"
  -- }

  -- AI-assisted (v2)
  sample_image_urls    text[] | null (reference images for ML training)
  layout_fingerprint   jsonb | null (structural features for auto-detection)

  is_active            boolean default true
  created_at           timestamp
  updated_at           timestamp
```

---

## 6. State Machine — Complete Flow

```
                    ┌──────────────┐
                    │  NOT_STARTED │ (session active, no close initiated)
                    └──────┬───────┘
                           │  Closer taps "Start Dagsavstämning"
                           │  OR CLOSE hook fires
                           ▼
                    ┌──────────────────────┐
                    │ CLOSING_IN_PROGRESS  │
                    │                      │
                    │ Closer:              │
                    │ • Works through tasks│
                    │ • Takes photos       │
                    │ • Counts cash        │
                    └──────┬───────────────┘
                           │  Both required images uploaded
                           ▼
                    ┌──────────────┐
                    │ AWAITING_OCR │ (system processing)
                    │              │
                    │ Pipeline:    │
                    │ • Store image│
                    │ • Run OCR    │
                    │ • Parse data │
                    └──────┬───────┘
                           │  Both images parsed
                           ▼
                    ┌─────────────────────┐
                    │ AWAITING_VALIDATION │ (system processing)
                    │                     │
                    │ Cross-match:        │
                    │ POS vs iSettle      │
                    │ Cash counted vs POS │
                    └──────┬──────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              Passed ✅     Failed ❌
                    │             │
                    │      ┌──────────────────┐
                    │      │ VALIDATION_FAILED │
                    │      │                   │
                    │      │ Closer must:      │
                    │      │ • Comment on each │
                    │      │   deviation       │
                    │      │ • Re-upload if    │
                    │      │   image quality   │
                    │      │ • Manual override │
                    │      │   if OCR failed   │
                    │      └──────┬────────────┘
                    │             │  All deviations commented
                    │             │
                    └──────┬──────┘
                           │
                    ┌──────▼──────────────┐
                    │ GATEKEEPER CHECK    │ (system)
                    │                     │
                    │ All critical tasks?  │
                    │ All images present?  │
                    │ All deviations       │
                    │   commented?         │
                    │ Cash counted?        │
                    └──────┬──────────────┘
                           │  All gates passed
                           │  → Closer can now check out
                           ▼
                    ┌──────────────────────┐
                    │ AWAITING_APPROVAL    │
                    │                      │
                    │ Manager sees:        │
                    │ • Images             │
                    │ • Extracted numbers  │
                    │ • Differences        │
                    │ • Task completion    │
                    │ • Deviations + notes │
                    │ • Who closed, when   │
                    └──────┬───────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              Approve ✅    Reject ❌
                    │             │
                    │      ┌──────────────┐
                    │      │   REJECTED   │
                    │      │              │
                    │      │ Rejection    │
                    │      │ reason saved │
                    │      │ → Back to    │
                    │      │ CLOSING_IN_  │
                    │      │ PROGRESS     │
                    │      └──────────────┘
                    │
                    ▼
              ┌──────────┐
              │  CLOSED  │
              │          │
              │ Day is   │
              │ sealed.  │
              │ Immutable│
              │ audit    │
              │ record.  │
              └──────────┘
```

### State Rules

| Rule                                             | Enforcement                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Only 1 `daily_financial_close` per `session_id`  | Database UNIQUE constraint                                                       |
| Cannot create new session if previous not CLOSED | Server-side check (configurable: hard block vs warning)                          |
| CLOSED state is immutable                        | RLS + application logic. No UPDATE on closed records except by system for audit. |
| Checkout blocked until AWAITING_APPROVAL         | Checkout guard in Module 4 extended with financial close state check             |
| Manager cannot approve own close                 | `approved_by ≠ closed_by` constraint (configurable)                              |
| Approval deadline triggers escalation            | n8n scheduled job checks for stale AWAITING_APPROVAL records                     |

---

## 7. OCR Pipeline — Technical Architecture

### 7.1 Pipeline Flow

```
CAPTURE                    STORE                      PROCESS
┌──────────┐        ┌──────────────┐        ┌─────────────────┐
│ Mobile   │        │  Supabase    │        │  Edge Function  │
│ Camera   │───────▶│  Storage     │───────▶│  OR n8n         │
│ (Expo)   │        │              │        │                 │
│          │        │ {ws}/{date}/ │        │ 1. Fetch image  │
│ compress │        │ {close_id}/  │        │ 2. Call OCR API │
│ on-device│        │ {type}.jpg   │        │ 3. Parse text   │
└──────────┘        └──────────────┘        │ 4. Save result  │
                                             └─────────────────┘
```

### 7.2 Storage Path Convention

```
{workspace_id}/financial-close/{YYYY-MM}/{business_date}/{close_id}/{image_type}.jpg
```

Example:

```
abc123/financial-close/2026-03/2026-03-03/close-uuid-here/isettle_settlement.jpg
```

### 7.3 OCR Provider Strategy

**Phase 1 (recommended):** OpenAI Vision API (GPT-4o-mini)

Use structured prompting to extract financial data directly — no separate OCR + parser step needed:

```typescript
// Edge Function: process-close-image
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: `You are a financial document parser for Norwegian restaurants. 
        Extract financial totals from POS and payment terminal reports.
        Always respond with ONLY valid JSON. No markdown, no backticks.
        Use Norwegian decimal format (comma as separator) converted to numbers.
        If a value is not visible or unclear, use null.`,
    },
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${base64Image}` },
        },
        {
          type: "text",
          text: `Extract from this ${imageType} report:
            - total_amount (total sales/settlement amount)
            - card_amount (total card payments)
            - cash_amount (total cash payments)  
            - vat_amount (total VAT/MVA)
            - transaction_count (number of transactions)
            - report_date (if visible, ISO format)
            - currency (default NOK)
            - confidence (your confidence 0-1 that extraction is correct)`,
        },
      ],
    },
  ],
  response_format: { type: "json_object" },
  max_tokens: 500,
});
```

**Cost estimate:** ~$0.01-0.02 per image (GPT-4o-mini with image input). At 2 images per close, 30 days: ~$0.60-1.20/month per location. Negligible.

**Phase 2 (if needed):** Google Vision API for raw OCR + custom parser rules per POS template. More reliable for poor image quality but requires maintaining parser rules.

**Phase 3 (premium):** Fine-tuned model that learns each workspace's specific POS layout over time.

### 7.4 Image Quality Handling

Before OCR, evaluate image quality:

```typescript
// Quality checks (can be done client-side or server-side)
interface ImageQualityCheck {
  is_blurry: boolean; // Laplacian variance < threshold
  is_too_dark: boolean; // Average brightness < threshold
  is_too_small: boolean; // Resolution < 800x600
  has_text_regions: boolean; // OCR confidence on any text > 0.5
}
```

If quality fails:

1. Client-side: prompt Closer to retake ("Bilden är för suddig. Försök igen.")
2. Server-side: create deviation with `type: image_quality`, allow manual override

### 7.5 Fallback: Manual Override

When OCR fails completely:

1. Show Closer the extracted raw text (if any)
2. Present manual input fields for all financial values
3. Require comment explaining why manual entry was needed
4. Create deviation: `type: manual_override`
5. State can still progress to AWAITING_APPROVAL

---

## 8. Validation Engine

### 8.1 Cross-Match Logic

```typescript
function validateFinancialClose(close: DailyFinancialClose): ValidationResult {
  const deviations: CloseDeviation[] = [];

  // 1. POS vs iSettle total
  if (close.pos_total != null && close.isettle_total != null) {
    const diff = Math.abs(close.pos_total - close.isettle_total);
    const withinTolerance =
      close.tolerance_type === "fixed"
        ? diff <= close.tolerance_value
        : (diff / close.pos_total) * 100 <= close.tolerance_value;

    if (!withinTolerance) {
      deviations.push({
        type: "total_mismatch",
        severity: diff > close.tolerance_value * 3 ? "critical" : "high",
        description: `POS total (${close.pos_total}) avviker fra iSettle (${close.isettle_total}). Differanse: ${close.difference}`,
        amount: close.difference,
      });
    }
  }

  // 2. Card subtotal match
  if (close.pos_card != null && close.isettle_card != null) {
    const cardDiff = Math.abs(close.pos_card - close.isettle_card);
    if (cardDiff > 10) {
      // Small fixed tolerance for card
      deviations.push({
        type: "card_mismatch",
        severity: "medium",
        description: `Kortbetalningar i POS (${close.pos_card}) matchar inte iSettle (${close.isettle_card})`,
        amount: cardDiff,
      });
    }
  }

  // 3. Cash count
  if (close.cash_counted != null && close.cash_expected != null) {
    const cashDiff = Math.abs(close.cash_counted - close.cash_expected);
    const cashConfig = getWorkspaceConfig(close.workspace_id);
    const cashWithin =
      cashConfig.cash_tolerance_type === "fixed"
        ? cashDiff <= cashConfig.cash_tolerance_value
        : (cashDiff / close.cash_expected) * 100 <= cashConfig.cash_tolerance_value;

    if (!cashWithin) {
      deviations.push({
        type: "cash_difference",
        severity: cashDiff > 200 ? "critical" : "high",
        description: `Kontantkassa räknad (${close.cash_counted}) avviker fra forventet (${close.cash_expected})`,
        amount: cashDiff,
      });
    }
  }

  // 4. Historical baseline (v2)
  // Compare today's total to workspace average for this weekday
  // Flag if > anomaly_threshold_pct deviation

  return {
    status: deviations.length === 0 ? "passed" : "failed",
    deviations,
  };
}
```

### 8.2 Edge Cases

| Edge Case               | Handling                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Returns after close** | If POS allows transactions after close initiated, system detects timestamp mismatch. Deviation flagged. Manager decides.          |
| **Split settlement**    | Some terminals settle multiple times per day. Parser must handle partial settlements. Config: `allow_multiple_settlements: true`. |
| **Offline POS**         | If POS was offline, totals may be delayed. Allow Closer to mark "POS var offline" and enter manual figures.                       |
| **Multiple terminals**  | Some locations have multiple iSettle terminals. Support multiple images of type `isettle_settlement`. Sum totals.                 |
| **Cash-only day**       | If no card transactions, iSettle settlement = 0. System should recognize this pattern.                                            |
| **Void after close**    | Voided transactions post-close create mismatch. Deviation type: `return_after_close`.                                             |

---

## 9. Gatekeeper — Checkout Integration

The Gatekeeper extends Module 4's existing checkout logic. Nobody checks out until:

### 9.1 Gate Conditions

```typescript
interface CheckoutGateResult {
  canCheckout: boolean;
  blockers: CheckoutBlocker[];
}

interface CheckoutBlocker {
  type: string;
  message: string;
  action: string; // what the user needs to do
}

function evaluateCheckoutGate(
  session: DepartmentSession,
  financialClose: DailyFinancialClose,
): CheckoutGateResult {
  const blockers: CheckoutBlocker[] = [];

  // --- Existing Module 4 gates ---
  // 1. All critical session tasks completed
  // 2. Deviations commented
  // 3. ... (existing logic)

  // --- Financial Close gates (NEW) ---

  // 4. Financial close must be initiated
  if (!financialClose || financialClose.state === "not_started") {
    blockers.push({
      type: "financial_close_not_started",
      message: "Dagsavstämning är inte startad",
      action: "Starta dagsavstämning",
    });
  }

  // 5. Required images must be uploaded
  const requiredTypes = getConfig(session.workspace_id).required_image_types;
  const uploadedTypes = getUploadedImageTypes(financialClose.close_id);
  for (const type of requiredTypes) {
    if (!uploadedTypes.includes(type)) {
      blockers.push({
        type: "missing_image",
        message: `Bild saknas: ${imageTypeLabel(type)}`,
        action: `Ta bild på ${imageTypeLabel(type)}`,
      });
    }
  }

  // 6. OCR must be processed (or manually overridden)
  if (["awaiting_ocr"].includes(financialClose.state)) {
    blockers.push({
      type: "ocr_pending",
      message: "Väntar på bildbearbetning",
      action: "Vänta medan systemet läser bilderna",
    });
  }

  // 7. Validation deviations must be commented
  const uncommented = getUncommentedDeviations(financialClose.close_id);
  if (uncommented.length > 0) {
    blockers.push({
      type: "uncommented_deviations",
      message: `${uncommented.length} avvik kräver kommentar`,
      action: "Kommentera alla avvik",
    });
  }

  // 8. All critical close tasks completed
  const incompleteCritical = getIncompleteCriticalTasks(financialClose.close_id);
  if (incompleteCritical.length > 0) {
    blockers.push({
      type: "incomplete_critical_tasks",
      message: `${incompleteCritical.length} kritiska uppgifter ej utförda`,
      action: "Slutför alla kritiska uppgifter",
    });
  }

  // 9. Cash must be counted (if required)
  if (getConfig(session.workspace_id).require_cash_count && financialClose.cash_counted == null) {
    blockers.push({
      type: "cash_not_counted",
      message: "Kontantkassa ej räknad",
      action: "Räkna kontantkassa och ange belopp",
    });
  }

  return {
    canCheckout: blockers.length === 0,
    blockers,
  };
}
```

### 9.2 Server-Side Enforcement

**Critical:** The gatekeeper is enforced server-side, not just in the UI.

```sql
-- RLS or Edge Function check on punch_out
-- Cannot punch out if financial close gates not passed
CREATE OR REPLACE FUNCTION check_financial_close_gate(
  p_session_id uuid,
  p_profile_id uuid
) RETURNS boolean AS $$
DECLARE
  v_close daily_financial_close%ROWTYPE;
  v_config financial_close_config%ROWTYPE;
BEGIN
  -- Get financial close for this session
  SELECT * INTO v_close
  FROM daily_financial_close
  WHERE session_id = p_session_id;

  -- If no financial close exists and config requires it, block
  -- If financial close state not in ('awaiting_approval', 'closed'), block
  -- Full gate logic here...

  RETURN true; -- or false with reason
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 10. Manager Approval Screen

### 10.1 What the Manager Sees

```
┌─────────────────────────────────────────────────────────────────┐
│  DAGSAVSTÄMNING — Kitchen — Måndag 3 mars 2026                  │
│  Status: VÄNTAR GODKÄNNANDE                                     │
│  Stängd av: Ole Nordmann kl. 22:15                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 SIFFROR                                                     │
│  ┌──────────────────┬──────────────┬──────────────┐            │
│  │                  │    POS       │   iSettle    │            │
│  ├──────────────────┼──────────────┼──────────────┤            │
│  │ Total            │  124 530,50  │  120 300,00  │            │
│  │ Kort             │  120 300,00  │  120 300,00  │            │
│  │ Kontant          │    4 230,50  │      —       │            │
│  │ MVA              │   24 890,10  │      —       │            │
│  │ Transaktioner    │     342      │     338      │            │
│  └──────────────────┴──────────────┴──────────────┘            │
│                                                                 │
│  💰 DIFFERENS: 4 230,50 kr                                     │
│  ⚠️ KOMMENTAR (Closer): "Differanse er kontantomsetning.       │
│     iSettle visar bare kort. Alt stemmer."                      │
│                                                                 │
│  💵 KONTANTKASSA                                                │
│  Räknad: 4 250,00  |  Forventet: 4 230,50  |  Diff: +19,50   │
│  ✅ Innenfor toleranse (±50 kr)                                 │
│                                                                 │
│  📷 BILDER                                                      │
│  [POS Stängningsskärm]  [iSettle Settlement]                   │
│  Tappbar for fullskärm                                          │
│                                                                 │
│  ✅ UPPGIFTER (8/8 utförda)                                     │
│  ✅ Kör dagsstängning i kassan — Ole 22:02                      │
│  ✅ Kör settlement på terminal — Ole 22:05                      │
│  ✅ Ta bild på kassarapport — Ole 22:08                         │
│  ✅ Ta bild på terminalrapport — Ole 22:09                      │
│  ✅ Räkna kontantkassa — Ole 22:12                              │
│  ✅ Lås kassaregister — Ole 22:13                               │
│  ✅ Kontrollera kyltemperaturer — Ole 22:14                     │
│  ✅ Lås dörrar och fönster — Ole 22:15                          │
│                                                                 │
│  ⚠️ AVVIKELSER (1)                                              │
│  • Total mismatch (HIGH) — Kommenterad ✅                       │
│                                                                 │
│  ┌────────────────┐  ┌─────────────────────────────┐           │
│  │  ✅ GODKÄNN    │  │  ❌ AVVISA (kräver kommentar)│           │
│  └────────────────┘  └─────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Approval Rules

| Rule                                                | Detail                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Manager can only approve sessions they didn't close | Configurable: `self_approve: false` (default)                                |
| Approval must happen within deadline                | Default: 24 hours. After deadline → escalation to admin.                     |
| Rejection requires reason text                      | Mandatory comment on reject                                                  |
| Rejection resets state to CLOSING_IN_PROGRESS       | Closer is notified to fix issues                                             |
| Approved = immutable                                | No changes after CLOSED. Only new deviation or correction entry on next day. |

---

## 11. Integration Points

| Module                           | Integration                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Module 4: Operations**         | Session sign-off extended. Checkout guard extended. Financial close = parallel close track.               |
| **Module 4: Session Hooks**      | CLOSE hook triggers financial close initiation. Pre-configured close tasks load.                          |
| **Module 5: HACCP**              | Temperature check can be a close_task. Kyltemp verification part of gatekeeper.                           |
| **Module 3: Scheduling**         | Closing shift template flags `is_closing_shift: true`. Determines default Closer.                         |
| **Module 9: Communication**      | Notification to manager when close is AWAITING_APPROVAL. Escalation if overdue.                           |
| **Module 12: AI**                | Mr. Botsson can: remind Closer to start close, guide through process, explain deviations.                 |
| **Module 14: Gamification**      | Points for: on-time close, zero deviations, complete documentation. Penalties for: late close, rejection. |
| **Module 10: Menu & Production** | Food cost data from daily close feeds into production cost analysis (when Module 10 is active).           |
| **Payroll / KPI**                | Revenue per worked hour calculated from close totals + shift hours.                                       |
| **Bokføringsloven**              | 5-year retention on all financial close records. Immutable audit trail.                                   |

---

## 12. Fraud Prevention (v2)

| Mechanism               | How It Works                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Image hash**          | Perceptual hash (`image_hash` on `close_image`). Detect if same image uploaded twice for different days.       |
| **GPS + timestamp**     | Compare `gps_lat/lng` on image to workspace location. Flag if >500m away. Compare `captured_at` to close time. |
| **Pattern analysis**    | AI tracks: deviation frequency per Closer, consistently round numbers, always-exact-match (suspicious).        |
| **Historical baseline** | Day's total compared to workspace average for same weekday. Flag if >20% deviation without explanation.        |
| **Image metadata**      | EXIF data validation: was the photo actually taken now, on this device?                                        |

---

## 13. Implementation Sequence

| Phase                      | Scope                                                                                                                                                  | Duration | Dependencies                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------- |
| **13.1 Data layer**        | All tables: `daily_financial_close`, `close_image`, `close_task`, `close_deviation`, `financial_close_config`, `pos_template`. Migrations. Types. RLS. | Week 1   | Module 4 tables               |
| **13.2 Close flow UI**     | "Start Dagsavstämning" button. Close task checklist. Cash count input. State display.                                                                  | Week 2   | 13.1                          |
| **13.3 Image capture**     | Mobile camera integration. Upload to Supabase Storage. Image quality check (client-side).                                                              | Week 2-3 | 13.1, Supabase Storage        |
| **13.4 OCR pipeline**      | Edge Function or n8n workflow. OpenAI Vision integration. Parse and save results.                                                                      | Week 3-4 | 13.3                          |
| **13.5 Validation engine** | Cross-match logic. Deviation auto-creation. Tolerance config.                                                                                          | Week 4   | 13.4                          |
| **13.6 Gatekeeper**        | Checkout guard extension. Server-side enforcement. Blocker UI.                                                                                         | Week 5   | 13.2, 13.5, Module 4 checkout |
| **13.7 Manager approval**  | Approval screen. Approve/reject flow. State transition. Notification.                                                                                  | Week 5-6 | 13.6                          |
| **13.8 Config UI**         | Admin settings: tolerance, required images, close tasks, POS templates.                                                                                | Week 6   | 13.1                          |
| **13.9 Reporting**         | Financial close history. Deviation trends. Average close time. Revenue integration.                                                                    | Week 7   | 13.7                          |
| **13.10 Fraud layer (v2)** | Image hashing. GPS validation. Historical baseline. Pattern detection.                                                                                 | Week 8+  | 13.9                          |

---

## 14. Risks & Mitigations

| Risk                             | Impact                          | Mitigation                                                                                                               |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **OCR accuracy on poor photos**  | Wrong numbers extracted         | Confidence score threshold. Require retake if below 0.8. Manual override with comment.                                   |
| **Different POS layouts**        | Parser fails on unknown formats | POS template system. Start with 3-4 common Norwegian POS systems. AI Vision handles most layouts without explicit rules. |
| **Low lighting at close**        | Dark, blurry photos             | Client-side quality check before upload. Flash reminder. Image enhancement pipeline (sharp).                             |
| **Staff resistance**             | "This takes too long"           | Streamlined UX. 3-5 minutes total. Show time savings vs manual. Gamification points.                                     |
| **Manager forgets to approve**   | Stale AWAITING_APPROVAL records | Auto-escalation after deadline. Dashboard warning. Push notification.                                                    |
| **Manipulation**                 | Closer uploads fake/old images  | Image hash duplicate detection. GPS validation. EXIF timestamp check.                                                    |
| **Internet outage during close** | Can't upload images             | Offline queue. Images saved locally, auto-upload when connection returns. Close can proceed to local-pending state.      |

---

## 15. Success Criteria

| Metric                | Target                  | Measurement                                        |
| --------------------- | ----------------------- | -------------------------------------------------- |
| Average close time    | <5 minutes              | Time from CLOSING_IN_PROGRESS to AWAITING_APPROVAL |
| OCR accuracy          | >90% correct extraction | Parsed total vs manually verified (sample audit)   |
| Manager approval time | <12 hours               | Time from AWAITING_APPROVAL to CLOSED              |
| Deviation frequency   | Tracked, trending down  | Deviations per 100 closes                          |
| Checkout compliance   | 100%                    | No checkout without financial close completion     |
| Image capture rate    | 100% of required images | close_image count per close                        |
| Manual override rate  | <10%                    | manual_override deviations / total closes          |

---

## 16. Decisions Log

| #   | Decision                | Choice                                                        | Rationale                                                                                                  |
| --- | ----------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Module placement        | Sub-module of Module 4 (4.5), not standalone                  | Financial close is part of the session lifecycle. Same department_session anchor.                          |
| 2   | OCR approach            | OpenAI Vision (structured output) over raw OCR + regex parser | Simpler pipeline. Handles varying layouts. One API call per image. Cheap.                                  |
| 3   | State machine           | 8 states with explicit REJECTED path                          | Need granularity for UX (show exactly where in the process). Rejection allows rework without losing data.  |
| 4   | Gatekeeper enforcement  | Server-side, not UI-only                                      | Security. Can't bypass by using a different client or API call.                                            |
| 5   | Manager approval timing | Next day, not same day                                        | Prevents rush-approval. Forces review with fresh eyes. Aligns with accounting practice.                    |
| 6   | Cash count              | Separate manual input, not OCR                                | Cash drawer photo is for audit evidence, not data extraction. Counted amount entered by hand.              |
| 7   | POS template system     | Configurable per workspace, with AI fallback                  | Different restaurants use different POS systems. AI Vision handles most cases, templates are optimization. |
| 8   | Deviation model         | Separate table, not reusing Module 4 deviations               | Financial deviations have different fields (amount, financial types) and different resolution flow.        |
| 9   | Retention               | 5 years immutable                                             | Norwegian Bokføringsloven requirement for financial records.                                               |
| 10  | Self-approval           | Disabled by default                                           | Separation of duties. Closer ≠ approver. Configurable for small operations.                                |

---

## 17. Glossary

| Norwegian/Swedish   | English                     | In Smartout                            |
| ------------------- | --------------------------- | -------------------------------------- |
| Dagsavstämning      | Daily reconciliation        | `daily_financial_close`                |
| Sättel / Settlement | Payment terminal settlement | `close_image.type: isettle_settlement` |
| Kassarapport        | POS closing report          | `close_image.type: pos_closing_screen` |
| Z-rapport           | Fiscal daily report         | `close_image.type: z_report`           |
| Kassadifferens      | Cash difference             | `cash_difference` field                |
| Avvik               | Deviation                   | `close_deviation` table                |
| Godkännande         | Approval                    | `approved_by/approved_at`              |
| Kontantkassa        | Cash register/drawer        | `cash_counted` field                   |
| Stengingsoppgave    | Close task                  | `close_task` table                     |
| Bokføringsloven     | Norwegian Bookkeeping Act   | 5-year retention policy                |

---

_This sub-module transforms the daily close from a chaotic, paper-based ritual into a locked, verified, AI-assisted process. When combined with Module 4's operational sign-off, Smartout creates a complete accountability loop: every task done, every deviation documented, every krone accounted for, every day approved._
