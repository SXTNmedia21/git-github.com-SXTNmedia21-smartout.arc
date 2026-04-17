---
title: "Billing Engine Fase 1 — Internal Invoice Motor (Spec)"
status: draft
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [billing, invoice, faktura, stripe, ehf, platform-admin, cascade-c3]
supersedes: [docs/archive/2026-04-17-invoice-engine-breakdown-v1.md]
---

# Billing Engine Fase 1 — Internal Invoice Motor

> **Status:** Draft spec, council-reviewed 2026-04-17 (APPROVE WITH CHANGES).
> **Authors:** Pontus Lindroth + system council (steward, supervisor, agent-coordinator, frontend-designer).
> **Replaces:** `docs/archive/2026-04-17-invoice-engine-breakdown-v1.md` (archived, Fase-2 language).

---

## 1. Kjerneprinsipp

Smartout har **egen fakturamotor**. Motoren genererer `fakturagrunnlag` per kalendermåned, lagrer det med full sporbarhet, og eksponerer det via platform-admin UI. Den **sender ikke fakturaer** i Fase 1.

Fakturautsendelse (Stripe Invoice API for kort-kunder, EHF for e-faktura-kunder) kommer i Fase 2 som en dispatcher-lag oppå Fase 1-motoren.

**Arkitektonisk plassering:** Fakturamotoren er en **C3 Commercial consumer** i cascade-modellen — den aggregerer `schedule_shift` (D6 Production) og `pricing_terms` (K1b konfigurasjon) til en periodebunden, billable artefakt. Den er ikke en ny cascade-dimensjon.

---

## 2. Fase-scope

### In scope (Fase 1)

1. Månedlig generering av `usage_snapshot` + `invoice` + `invoice_line_item`
2. Platform-admin UI: liste, detaljvisning, per-company konfig, dunning-dashboard, CSV-eksport
3. Per-company konfigurasjon av `delivery_channel` (manual/stripe/ehf), `invoice_format`, `free_users`, `overage_price_per_user`, `agreement_period` — **lagres kun**, ikke utløses
4. Manuell "marker betalt" + "annuller" (via kreditnota, ikke sletting)
5. Telemetry på alle mutasjoner (`emit()` 4-destinasjon kontrakt)
6. Norwegian bokføringslov compliance (kontinuerlig fakturanummer, immutability, credit notes)
7. AI-tools — **read-only, workspace-admin scope** (owner ser egne fakturaer)

### Out of scope (Fase 2+)

1. **Stripe-integrasjon** (Invoice API push, webhook, customer portal)
2. **EHF-integrasjon** (PEPPOL BIS Billing 3.0 XML, tjenesteleverandør — ikke valgt ennå)
3. **Automatisk purring** (SendGrid reminder-maler, eskaleringsstige)
4. **PDF-generering** (hosted invoice PDF)
5. **Platform-admin AI-tools** (cross-workspace) — krever nytt `PlatformAdminToolContext` ADR først
6. **Stripe customer ID på company** — ingen Stripe-kall i Fase 1, ingen grunn til å lagre
7. **Real-time payment reconciliation** fra bank-feed

---

## 3. De fire sentrale spørsmålene (business contract)

Disse fire er Fase 1-motorens eksistensgrunnlag og må kunne besvares når Fase 1 ships:

### Q1. Hvordan sendes fakturaer ut og hvordan vet vi at kunden har mottatt?

**Fase 1 svar:** Fakturaer sendes **ikke automatisk**. Plattform-admin laster ned CSV av månedens fakturagrunnlag og importerer det til det regnskapssystemet som brukes i dag, eller sender manuelt. UI registrerer kvittering: status endres `issued → sent` når admin manuelt bekrefter (med referanse: e-post-ID, EHF doc-id, Stripe invoice-id — fritekst i Fase 1). Kundens mottak bekreftes ved betaling (Q3) eller eksplisitt kundesvar.

**Fase 2 forward path:** `delivery_channel` styrer dispatcher: `stripe` → Stripe Invoice API (mottak via `invoice.sent` webhook), `ehf` → EHF-tjeneste (mottak via PEPPOL MLR), `manual` → som Fase 1.

### Q2. Hvordan sikres korrekt fakturagrunnlag og hvordan kan det kontrolleres?

**Fase 1 svar:** `usage_snapshot` er **reproduserbart og revisjonssikkert**:

1. **Input deterministisk:** query over `schedule_shift` filtrert på `status ∈ {worked, settled}` + `workspace_id` + `period_from/to`
2. **Provenance lagres:** `counted_profile_ids` (jsonb array) + `source_query_hash` (SHA-256 av query + input-parametere)
3. **Materialized view:** `v_invoice_basis` presenterer data deterministisk for både generering og AI-forklaring (LLM leser view, aldri beregner beløp selv)
4. **Re-derivering ved audit:** kjøring av samme query på historisk data må gi samme resultat eller en eksplisitt grunn til avvik (retroaktive shift-endringer → logget som `basis_drift_event`)

Platform-admin UI viser på fakturadetaljer: liste over profiler talt, total antall, `billable_users = max(0, active - free_users)`, `source_query_hash` for reproduksjon.

### Q3. Hvordan registreres innbetalinger?

**Fase 1 svar:** Manuelt via platform-admin UI. Dialog: velg faktura → "Registrer betaling" → skjema med `payment_date` (default i dag), `payment_reference` (bank-ref / Stripe capture-id / fritekst), `payment_channel` (bank_transfer / cash / stripe / other), `amount` (default full, editerbar for delbetaling), `notes`. Resulterer i `invoice.status = paid` + `invoice.paid_at` + `emit('invoice.marked_paid')`.

**Fase 2 forward path:** Stripe webhook `invoice.paid` → auto-registrering. Bank-feed-integrasjon → foreslått match som admin godkjenner.

### Q4. Hvordan følges ubetalte fakturaer opp?

**Fase 1 svar:** Dunning-dashboard grupperer overdue-fakturaer i fire alderskategorier (1-7d, 8-14d, 15-30d, 30+d). Platform-admin kan manuelt:
- `marker in-negotiation` (setter `dunning_status = 'in_negotiation'`, stopper auto-eskalering)
- `marker uncollectible` (setter `status = 'uncollectible'`, krever årsakskode)
- `legg til notat` (`dunning_note`-tabell, audit-trail)
- `eksporter purrekandidater CSV` (for manuell reminder-utsendelse via e-post utenfor Smartout)

**Fase 2 forward path:** SendGrid reminder-maler, automatisk eskaleringsstige (1→3d→7d→14d (read-only) →30d (suspended) →90d (deletion warning) →120d (deleted) per Module 13 ADR).

---

## 4. Cascade placement

| Cascade layer | Rolle |
|---|---|
| **D6 Production** | `schedule_shift` — source for active user count |
| **K1b Workspace** | `pricing_terms` — commercial terms per company |
| **C3 Commercial** | **Invoice engine** — consumes D6 + K1b, produces `invoice` + `usage_snapshot` |
| **C4 Governance** | gates destructive mutations: `void`, `credit_note_issuance`, `adjust_basis` |
| **Telemetry** | `emit()` 4-destinations: PostHog (analytics) / Logger / activity_trail / engine_event |

### C3 invariant

Invoice engine **reads** from D6 + K1b, **writes** to its own `invoice*` tables, **never mutates** cascade sources.

### C4 authority matrix

| Action | Authority | Gate |
|---|---|---|
| `generate draft` | cron / automation | none |
| `issue` | platform_admin / automation | basic |
| `mark_paid` | platform_admin | confirm + reason |
| `void` | platform_admin | AlertDialog + typed confirmation + reason |
| `issue_credit_note` | platform_admin | AlertDialog + reason + original invoice link |
| `adjust_basis` | platform_admin only, before issue | reason + audit |

---

## 5. Data model

All tables live in `public` schema (brainstormed: no dedicated `billing` schema — avoids cross-schema FK complexity with `company`/`workspace`). All tables use `company_id` (invoice is company-scoped, not workspace-scoped).

> **Workspace-id exception:** `invoice`, `invoice_line_item`, `usage_snapshot` do **not** carry `workspace_id`. Billing is company-level (ADR-0012), not workspace-level. Will be justified in new ADR-0118.

### 5.1 `pricing_terms` — extend (ADR-0027 preserved)

Additive migration — 5 new columns:

```sql
ALTER TABLE public.pricing_terms
  ADD COLUMN free_users               int NOT NULL DEFAULT 10,
  ADD COLUMN overage_price_per_user   decimal(12,2),
  ADD COLUMN delivery_channel         text NOT NULL DEFAULT 'manual'
    CHECK (delivery_channel IN ('manual', 'stripe', 'ehf')),
  ADD COLUMN invoice_format           text NOT NULL DEFAULT 'pdf'
    CHECK (invoice_format IN ('pdf', 'ehf')),
  ADD COLUMN agreement_period         daterange;
```

**Semantics:**
- `free_users` = antall brukere inkludert i `monthly_cost` (default 10)
- `overage_price_per_user` = pris per bruker over `free_users` (kan være `NULL`, betyr ingen overage-fakturering)
- `delivery_channel` = hvor faktura skal sendes (lagres i Fase 1, utløses i Fase 2)
- `invoice_format` = PDF eller EHF XML (styrer format ved Fase 2 dispatch)
- `agreement_period` = gyldighetsperiode for avtalen (overlap med `effective_from/until`? — se Open Questions)

### 5.2 `invoice` — new table

```sql
CREATE TABLE public.invoice (
  invoice_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number          int NOT NULL UNIQUE,  -- continuous series, uses sequence
  company_id              uuid NOT NULL REFERENCES public.company(company_id),

  -- Type & status
  invoice_type            invoice_type NOT NULL,  -- enum: recurring|onboarding|credit_note|one_off
  status                  invoice_status NOT NULL DEFAULT 'draft',
                          -- enum: draft|issued|sent|paid|overdue|void|uncollectible
  dunning_status          dunning_status,  -- enum: none|in_negotiation|reminder_sent|escalated

  -- Period
  period_from             date NOT NULL,
  period_to               date NOT NULL,
  issued_at               timestamptz,
  due_at                  date,
  sent_at                 timestamptz,
  paid_at                 timestamptz,
  voided_at               timestamptz,

  -- Amounts (all in NOK øre as bigint, or decimal(12,2))
  amount_excl_vat         decimal(12,2) NOT NULL,
  vat_rate                decimal(5,2) NOT NULL DEFAULT 25.00,
  vat_amount              decimal(12,2) NOT NULL,
  amount_incl_vat         decimal(12,2) NOT NULL,
  currency                currency NOT NULL DEFAULT 'NOK',

  -- Payment
  payment_date            date,
  payment_reference       text,
  payment_channel         text,  -- bank_transfer|cash|stripe|other

  -- Delivery (forward-compat for Fase 2)
  delivery_channel        text NOT NULL DEFAULT 'manual',
  delivery_status         text,  -- null|pending|sent|delivered|bounced|failed
  external_reference      text,  -- Stripe invoice_id, EHF doc_id, etc.

  -- Void / credit
  voided_by               uuid REFERENCES public.user_identity(user_id),
  void_reason             text,
  credits_invoice_id      uuid REFERENCES public.invoice(invoice_id),  -- credit note → original

  -- Audit
  created_by              uuid REFERENCES public.user_identity(user_id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE public.invoice_number_seq START 1001;
-- trigger assigns invoice_number from sequence on INSERT if NULL
```

### 5.3 `invoice_line_item` — new table

```sql
CREATE TYPE public.invoice_line_type AS ENUM (
  'base_plan', 'user_overage', 'addon', 'onboarding', 'adjustment'
);

CREATE TABLE public.invoice_line_item (
  line_item_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              uuid NOT NULL REFERENCES public.invoice(invoice_id) ON DELETE RESTRICT,
  line_type               invoice_line_type NOT NULL,
  addon_key               text,  -- null for non-addon types; e.g. 'sms','ai_tokens','voice_minutes'
  description             text NOT NULL,
  quantity                decimal(12,2) NOT NULL DEFAULT 1,
  unit_price              decimal(12,2) NOT NULL,
  amount_excl_vat         decimal(12,2) NOT NULL,
  vat_rate                decimal(5,2) NOT NULL DEFAULT 25.00,
  vat_amount              decimal(12,2) NOT NULL,
  amount_incl_vat         decimal(12,2) NOT NULL,
  usage_snapshot_id       uuid REFERENCES public.usage_snapshot(usage_snapshot_id),
  period_reference        text,  -- human-readable "March 2026" etc.
  created_at              timestamptz NOT NULL DEFAULT now()
);
```

### 5.4 `usage_snapshot` — new table

```sql
CREATE TABLE public.usage_snapshot (
  usage_snapshot_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.company(company_id),
  workspace_id            uuid REFERENCES public.workspace(workspace_id),  -- nullable: per-company aggregate
  period_from             date NOT NULL,
  period_to               date NOT NULL,

  -- Computed
  active_users            int NOT NULL,
  free_users_applied      int NOT NULL,
  billable_users          int NOT NULL,  -- max(0, active_users - free_users_applied)

  -- Reproducibility
  counted_profile_ids     jsonb NOT NULL,  -- ["uuid1","uuid2",...] — audit trail
  source_query_hash       text NOT NULL,   -- SHA-256 of the query + params

  -- Audit
  computed_at             timestamptz NOT NULL DEFAULT now(),
  computed_by             text,  -- 'cron' or user_id
  UNIQUE (company_id, workspace_id, period_from, period_to)
);
```

### 5.5 `dunning_note` — new table (Fase 1 lightweight audit)

```sql
CREATE TABLE public.dunning_note (
  dunning_note_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              uuid NOT NULL REFERENCES public.invoice(invoice_id),
  note                    text NOT NULL,
  created_by              uuid NOT NULL REFERENCES public.user_identity(user_id),
  created_at              timestamptz NOT NULL DEFAULT now()
);
```

### 5.6 `v_invoice_basis` — materialized view (for AI-tools + audit)

```sql
CREATE VIEW public.v_invoice_basis AS
SELECT
  c.company_id,
  c.name AS company_name,
  w.workspace_id,
  w.name AS workspace_name,
  pt.pricing_terms_id,
  pt.monthly_cost,
  pt.price_per_employee,
  pt.free_users,
  pt.overage_price_per_user,
  pt.billing_interval,
  pt.delivery_channel,
  pt.invoice_format,
  -- Current period active users (for preview)
  (SELECT count(DISTINCT profile_id)
   FROM public.schedule_shift
   WHERE workspace_id = w.workspace_id
     AND status IN ('worked','settled')
     AND shift_start >= date_trunc('month', now())
     AND shift_start < date_trunc('month', now()) + interval '1 month'
  ) AS active_users_current_month
FROM public.company c
JOIN public.workspace w ON w.company_id = c.company_id
LEFT JOIN public.pricing_terms pt ON pt.company_id = c.company_id
  AND (pt.effective_until IS NULL OR pt.effective_until >= CURRENT_DATE)
  AND pt.effective_from <= CURRENT_DATE;
```

### 5.7 Enums

```sql
CREATE TYPE public.invoice_type AS ENUM (
  'recurring', 'onboarding', 'credit_note', 'one_off'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft', 'issued', 'sent', 'paid', 'overdue', 'void', 'uncollectible'
);

CREATE TYPE public.dunning_status AS ENUM (
  'none', 'in_negotiation', 'reminder_sent', 'escalated'
);
```

### 5.8 RLS posture

| Table | Platform admin | Company admin (workspace_admin) | Service role |
|---|---|---|---|
| `invoice` | full | SELECT own company_id | full |
| `invoice_line_item` | full | SELECT via invoice_id join | full |
| `usage_snapshot` | full | SELECT own company_id | full |
| `dunning_note` | full | none | full |
| `pricing_terms` | full (existing) | none (existing) | full (existing) |

Writes always go via Edge Functions / Server Actions with service role. No direct client mutations.

---

## 6. Generation flow

### 6.1 Cron scheduling

**Host:** Edge Function `generate-monthly-invoices` + bearer auth via `WATCHDOG_CRON_SECRET` + external trigger (n8n, scheduled). Precedent: `supabase/functions/fire-delayed-triggers`, `daily-session-replenish`. No Vercel Cron, no pg_cron.

**Timing:** Runs on **day 5 of each month at 00:01 CET**. This gives a 4-day settling window for day-31 shifts to transition from `worked` → `settled` (Blocker 3 decision C: only `worked+settled` count; cut-off pushed to day 5 for safety).

### 6.2 Generation as pure transaction

Pseudocode for generator (Deno Edge Function):

```
for each company in active companies:
  pt = get_active_pricing_terms(company_id)
  if pt is null: skip + log

  for each workspace in company.workspaces:
    snapshot = compute_usage_snapshot(workspace, previous_month)
    usage_snapshot_id = insert snapshot into usage_snapshot

  BEGIN TX:
    invoice = insert invoice row (status=draft, type=recurring)
    insert line_items:
      - base_plan (amount = pt.monthly_cost)
      - for each workspace: user_overage (if billable_users > 0, amount = billable_users * pt.overage_price_per_user)
      - addons (placeholder — Fase 1 skeleton only, actual addon data from separate ledger in Fase 2)
    update invoice amounts (sum line items + VAT 25%)
    update invoice.status = 'issued', invoice.issued_at = now(), invoice.due_at = now() + 14 days
  COMMIT

  emit('usage_snapshot.created', { workspace_id, period, billable_users })
  emit('invoice.generated', { invoice_id, company_id, amount })
  emit('invoice.issued', { invoice_id, company_id, amount })

  -- Overdue scan (part of same cron run, or separate hourly cron)
  for each invoice where status='issued' and due_at < today:
    update invoice.status = 'overdue'
    emit('invoice.overdue_detected', { invoice_id, days_overdue })
```

**Design principles:**
- Generation is a **pure transaction** — no engine_process wrapping, no waits
- Each company's generation is independent (can parallelize later if needed)
- Failures isolate: one company's error doesn't block others
- Idempotency: unique constraint on `(company_id, workspace_id, period_from, period_to)` on `usage_snapshot` prevents double-compute

### 6.3 Lifecycle as `engine_process`

Onboarding invoices (ADR pattern) and future payment-webhook-driven transitions (Fase 2) wrap as `engine_process` blueprints:

- **Blueprint `invoice_lifecycle`:** `draft → issued → paid|overdue|void`. Step types: `wait_for_event` (payment_succeeded/manual_mark_paid), `schedule_control` (overdue check).
- **Blueprint `onboarding_billing`:** triggered by `workspace_activation_completed`. Step types: `assign_task` (platform admin review onboarding package), `update_entity` (insert invoice + line_item).

Both defined under `supabase/migrations/<date>_billing_engine_processes.sql` as `engine_process` seed rows.

---

## 7. Telemetry registry

Add to `packages/telemetry/src/registry.ts`:

**New category:** `billing`

**New entity types:** `invoice`, `invoice_line_item`, `usage_snapshot`, `billing_agreement`, `dunning_note`

**New events:**

| Event | Destinations | Rationale |
|---|---|---|
| `invoice.generated` | posthog, logger, activity_trail, engine_event | Creation analytics + audit |
| `invoice.issued` | posthog, logger, activity_trail, engine_event | Commercial milestone |
| `invoice.sent` | logger, activity_trail, engine_event | Delivery tracking (manual Fase 1) |
| `invoice.marked_paid` | posthog, logger, activity_trail, engine_event | Revenue event |
| `invoice.voided` | logger, activity_trail, engine_event | Not analytics — auditable only |
| `invoice.overdue_detected` | logger, activity_trail, engine_event | Internal operations signal |
| `invoice.credit_note_issued` | logger, activity_trail, engine_event | Accounting-critical audit |
| `usage_snapshot.created` | logger, activity_trail | High volume — no PostHog |
| `pricing_terms.updated` | posthog, logger, activity_trail | Commercial change |
| `dunning_note.added` | logger, activity_trail | Internal trail |

**CI assertion:** new test `packages/telemetry/__tests__/billing-emit.spec.ts` asserts that each billing mutation in the codebase calls `emit()` with the expected event. This is enforcement, not aspiration.

---

## 8. API surfaces

### 8.1 Platform-admin (service-role Server Components + Server Actions)

Existing pattern: `apps/web/src/app/platform-admin/billing/page.tsx` → extends into a billing hub.

```
/platform-admin/billing                         → Overview tab (existing MRR page)
/platform-admin/billing/invoices                → List
/platform-admin/billing/invoices/[id]           → Detail (route-based primary)
/platform-admin/billing/dunning                 → Dunning dashboard
/platform-admin/billing/export                  → CSV export form + history
/platform-admin/companies/[id]?tab=billing      → Per-company config (lives on company page)
```

**Mutations** (Server Actions in `apps/web/src/app/platform-admin/billing/_actions/`):
- `markInvoicePaid(invoice_id, { payment_date, payment_reference, payment_channel, amount, notes })`
- `voidInvoice(invoice_id, { reason, typed_confirmation })` — typed confirmation gate
- `issueCreditNote(original_invoice_id, { reason, amount })` — creates new invoice with `type=credit_note`, links via `credits_invoice_id`
- `addDunningNote(invoice_id, { note })`
- `markInvoiceUncollectible(invoice_id, { reason_code })`
- `updatePricingTerms(company_id, { ...fields })` — updates existing row or creates new effective-dated row
- `regenerateInvoiceDraft(invoice_id)` — only for `draft` status, re-runs usage_snapshot + line items

### 8.2 Workspace-admin (company owner viewing own invoices)

New Edge Function `billing-api` (standalone, not `workspace-api` — different scope model: company-scoped):

```
GET  /billing-api/invoices?company_id=X        → list own company's invoices
GET  /billing-api/invoices/:id                 → own invoice detail
GET  /billing-api/usage-snapshots?workspace_id → own workspace snapshots
```

Auth: JWT from user, verifies `company_member.role IN ('admin','owner') AND company_id = X`.

### 8.3 CSV export

**Route Handler** (NOT Server Action — file download):
```
GET /platform-admin/billing/export/route.ts
```

Accepts query params: `period_from`, `period_to`, `company_ids[]`, `format` (flat|accounting).
Returns `text/csv` with `Content-Disposition: attachment; filename="smartout-invoices-YYYY-MM.csv"`.

---

## 9. AI-tools

### 9.1 Fase 1 scope: workspace-admin read-only

New capability: `billing_query` in `packages/ai/src/capabilities/billing-query/`.

**Tools** (all read-only, `allowedChannels: ["chat"]`, never voice):

| Tool | Scope | Returns |
|---|---|---|
| `list_my_invoices` | own company | last N invoices with status/amount/period |
| `get_my_invoice` | own company | full invoice + line items |
| `explain_invoice_basis` | own company, own invoice | reads `v_invoice_basis`, explains in NL — **never computes amounts** |
| `list_overdue` | own company | overdue subset |
| `get_usage_snapshot` | own workspace | snapshot for period |

**Context:** existing `AgentToolContext` (workspace-scoped). Company derived from `workspace_id → company_id`.

### 9.2 Fase 2 deferral: platform-admin AI-tools

Platform-admin cross-workspace AI tools (`list_all_overdue`, `mark_paid_by_natural_language`, etc.) require new `PlatformAdminToolContext` + authority model. **Blocked on ADR** (see §13). Not in Fase 1.

### 9.3 Hallucination guards

All AI-tools that reference money:
1. **Never compute** — always read from DB/view
2. **Return structured data** — LLM formats, doesn't calculate
3. **Idempotency** — any future mutation tool takes `idempotency_key` UUID
4. **Audit** — every tool call emits `agent_tool.invoked` via existing telemetry

---

## 10. UI specifications (Nordic Split + council locks)

### 10.1 Design system requirements

**Prerequisite** (must exist before implementation):
- `--success` (warm green OKLCH hue 140-160)
- `--warning` (warm amber OKLCH hue 70-80)
- `--destructive` (warm coral OKLCH hue 15-25, NOT red)
- `--info` (warm sky OKLCH hue 220-230)

If absent from `packages/design-tokens/src/tokens.ts`, migration tokens are a blocking prerequisite.

### 10.2 Component inventory

- **`<InvoiceStatusBadge>`** — lives in `packages/ui/`. Props: `status`, `size`, `withIcon`. Enforces token mapping. **Forbids inline color styling across billing UI.**
- **`<DataTable>`** — shadcn Table + custom wrapper for sort/filter/select state.
- **`<InvoiceDetailSheet>`** + **`<InvoiceDetailPage>`** — same `<InvoiceDetail>` inner component, two surfaces.
- **`<DunningKanban>`** — age-tier column layout (1-7d, 8-14d, 15-30d, 30+d).
- **`<UsageSnapshotAccordion>`** — expandable profile list with counted IDs.

### 10.3 Motion tier per surface (Frontend design lock D-1)

| Surface | Tier | Springs (s/d/m) |
|---|---|---|
| Page heroes, orbs | Signature | 35/22/2.2 |
| Sheet/Drawer open | Medium | 45/24/1.8 |
| AlertDialog (void) | Medium + 50ms delay | 45/24/1.8 |
| Dialog (mark paid, filters) | Snap | 250/28/1 |
| Table row hover/sort | Snap | 250/28/1 |
| Status badge morph | `layout` + `layoutId`, Snap | — |
| Dunning 30+d glow breathing | Heavy, 4s cycle | 30/20/2.5 |
| Toast (sonner) | Default | — |

All respect `useReducedMotion()`.

### 10.4 Destructive actions

- **Void** — `<AlertDialog>`, typed confirmation (user types invoice_number), `--destructive` variant, reason required (min 10 chars, enum: Issued in error / Customer disputed / Duplicate / Other). No undo.
- **Mark uncollectible** — `<AlertDialog>`, reason code from enum (Bankruptcy / Disputed-unresolved / Statute-of-limitations / Written-off).
- **Mark paid** — `<Dialog>` (not AlertDialog), soft confirmation, recoverable via void.
- **Issue credit note** — `<AlertDialog>`, requires original invoice link.

### 10.5 Empty / loading / error states (mandatory)

- **Empty list:** Instrument Serif headline "Ingen fakturaer enda", muted orb, outline action if relevant.
- **Empty dunning:** "Alt er betalt." with checkmark — celebratory, NOT alarmist.
- **Loading:** `<Skeleton>` rows × 5-7. No spinners.
- **Error:** inline callout with Lucide `AlertTriangle`, warning token, retry button. Never silent fail.

### 10.6 Accessibility

- All currency: `<span class="tabular-nums font-mono">`
- Sort columns: `<th aria-sort="ascending|descending|none">`
- Selection checkboxes: `aria-label="Select invoice {nr} for {company}"`
- Status: color paired with Lucide icon (`FileText` draft, `Send` issued, `CheckCircle2` paid, `AlertTriangle` overdue, `Ban` void)
- Keyboard: `Tab` into row → `Enter`/`Space` opens action menu

---

## 11. Norwegian legal compliance

### 11.1 Bokføringsloven commitment (Fase 1)

- **No deletion** of issued invoices — ever
- **Credit notes only** for correction (new invoice with `type=credit_note`, `credits_invoice_id` link, negative amounts)
- **Retention:** 5 years minimum (Postgres row retention + backup policy outside scope but documented)
- **Continuous invoice numbering:** `invoice_number` from Postgres sequence, no gaps, no reuse

### 11.2 MVA (VAT)

- **Standard 25%** on all Smartout services (domestic B2B)
- Stored per-line (`invoice_line_item.vat_rate` + `vat_amount`) — future-proof for mixed-rate lines
- `invoice` carries aggregate `amount_excl_vat`, `vat_amount`, `amount_incl_vat`
- Org.nr 929 620 291 (Smartout AS) — must appear on every invoice (template concern, UI/PDF layer Fase 2)

### 11.3 Currency

NOK only in Fase 1. `currency` column carried for Fase 2 expansion (SEK/DKK/EUR).

---

## 12. Mobile parity

- Data layer: new package `packages/billing/` (types, query hooks, Zod schemas)
- Web UI consumes `packages/billing`
- Mobile UI (React Native) is deferred but architecture supports it
- Hooks in `packages/billing/hooks/`: `useInvoices()`, `useInvoice(id)`, `useUsageSnapshot()` (read-only, workspace-admin scope)

No hooks in `apps/web/src/app/` — enforces mobile parity rule.

---

## 13. ADRs required

| ADR | Topic | Status |
|---|---|---|
| **0118** | Invoice engine as C3 Commercial consumer | To write |
| **0119** | Usage snapshot reproducibility contract (active-user = `{worked,settled}`, source_query_hash provenance) | To write |
| **0120** | Invoice immutability + credit note policy (bokføringslov) | To write |
| **0121** | `pricing_terms` extension for billing engine (5 new fields) | To write, amends ADR-0027 |
| **0012** | Amendment deferred to Fase 2 (no `stripe_customer_id` needed yet) | Hold |
| **Future** | `PlatformAdminToolContext` + authority model (blocks Fase 2 AI-tools) | Write before Fase 2 |

---

## 14. Commitlint scope

New scope: **`billing-engine`** (kebab-case to satisfy commitlint hyphen rule).

Examples:
- `feat(billing-engine): add invoice generation cron`
- `fix(billing-engine): correct VAT rounding on overage line`
- `docs(billing-engine): add ADR-0118`

---

## 15. Fase 2 forward compatibility

Fields and patterns reserved in Fase 1 for Fase 2 drop-in:

| Fase 2 need | Fase 1 preparation |
|---|---|
| Stripe dispatch | `invoice.delivery_channel='stripe'`, `external_reference` stores Stripe invoice_id, webhook standalone Edge Function |
| EHF dispatch | `invoice.delivery_channel='ehf'`, `invoice_format='ehf'`, `external_reference` stores EHF doc_id |
| Auto dunning | `dunning_status` column + event stream (`invoice.overdue_detected`) already emit |
| Stripe customer | Added at Fase 2 start via `ALTER TABLE company ADD stripe_customer_id` (ADR-0012 amendment at that time) |
| PDF generation | `invoice_format='pdf'` and template config table (future) |
| Platform-admin AI-tools | Blocked on `PlatformAdminToolContext` ADR |

No schema migration required to enable Fase 2 delivery — only backend wiring.

---

## 16. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `pricing_terms` schema drift — future fields duplicate billing intent | Medium | ADR-0121 sets boundary; all future billing-specific fields go there |
| Active user count timing (day-31 shifts not settled by cron day 1) | High | Cron runs day 5, not day 1 |
| Double-generation (cron retry races) | High | Unique constraint on usage_snapshot + invoice idempotency at application layer |
| LLM hallucinates amounts in `explain_invoice_basis` | High | LLM reads view, never computes; test coverage mandatory |
| Void without audit → regulatory risk | High | Typed confirmation + reason field + `emit()` event |
| Manual payment registration with wrong amount | Medium | Partial-payment field editable, full audit trail |
| Mobile UI gets built before data layer in `packages/` | Medium | CI assertion: no hooks in `apps/web/src/app/billing*` |
| Frontend zinc/gray debt inherited to billing pages | Low | `<InvoiceStatusBadge>` in `packages/ui` with enforced tokens |
| Stripe integration premature (Fase 2 scope creep into Fase 1) | High | `delivery_channel='stripe'` is lagret kun, ingen call-code in Fase 1 |

---

## 17. Definition of Done (Fase 1)

- [ ] Migration: `pricing_terms` + 5 new columns deployed
- [ ] Migrations: `invoice`, `invoice_line_item`, `usage_snapshot`, `dunning_note` + enums + sequence deployed
- [ ] Migration: `v_invoice_basis` view deployed
- [ ] Edge Function `generate-monthly-invoices` deployed with `WATCHDOG_CRON_SECRET`
- [ ] n8n trigger scheduled (day 5 of month, 00:01 CET)
- [ ] Telemetry registry updated with `billing` category + 10 new events
- [ ] CI assertion passing: every billing mutation calls `emit()` with correct event
- [ ] `packages/billing/` package created with types + hooks + Zod schemas
- [ ] Edge Function `billing-api` deployed (workspace-admin read endpoints)
- [ ] Platform-admin UI: `/platform-admin/billing/{invoices,dunning,export}` routes + company billing tab
- [ ] `<InvoiceStatusBadge>` shipped in `packages/ui`
- [ ] Semantic tokens (`--success/--warning/--destructive/--info`) in design-tokens
- [ ] AI capability `billing_query` registered with 5 read-only tools (chat-only)
- [ ] ADR-0118, 0119, 0120, 0121 merged as `accepted`
- [ ] Handoff + user journeys + E2E tests per feature closure protocol
- [ ] Norwegian bokføringslov compliance documented in `docs/modules/MODULE_13_BILLING.md` (new module doc)

---

## 18. Open questions (non-blockers, resolve in implementation plan)

1. **`agreement_period` vs `effective_from/until`** — pricing_terms already has `effective_from/until`. Is `agreement_period` redundant? Or does it represent something different (contract duration vs price validity)?
2. **Two-pass generation** — should day-5 generate `draft` invoices, then day-10 issue them (giving admin 5-day review window)? Or single-pass draft→issued?
3. **Partial payment UX** — allow incremental payments (paid = running sum), or require single-transaction full settlement?
4. **Credit note amounts** — positive or negative line items? (Accounting convention varies.)
5. **Add-on source** — Fase 1 skeleton line type exists (`addon`); what feeds it? Separate `addon_usage_ledger` table Fase 2? Empty in Fase 1?
6. **Onboarding invoice trigger** — workspace activation, DocuSeal signature, or manual platform-admin action?
7. **CSV export format specifics** — column names, date format, decimal separator (Norwegian uses comma), encoding (UTF-8 BOM for Excel compatibility)?
8. **Dunning age calculation** — from `due_at` or from `issued_at + payment_terms_days`?
9. **Reminder email templates (Fase 2)** — 3 templates, 5 templates? Escalation tone curve?
10. **EHF provider selection (Fase 2)** — Sproom / Nets / Pagero / Visma Addo? Separate spec.

---

## 19. Relationships to existing work

- **Supersedes:** `docs/archive/2026-04-17-invoice-engine-breakdown-v1.md`
- **Amends:** ADR-0027 (pricing_terms extension via ADR-0121)
- **Preserves:** ADR-0012 (no stripe_subscription table, deferred Stripe ID storage)
- **Follows:** ADR-0029 (workspace-api gateway pattern — but billing-api is separate), ADR-0045 (SendGrid canonical for Fase 2 dunning), ADR-0077 (PII handling), ADR-0078 (channel restriction — billing chat-only)
- **Uses:** Event Engine (`engine_process` for lifecycle), telemetry `emit()` 4-destinations, cron pattern (`WATCHDOG_CRON_SECRET` + n8n)
- **Related:** `docs/superpowers/specs/2026-04-14-tripletex-external-adapter-design.md` (customer's Tripletex for shift cost — separate from Smartout's billing)

---

## 20. Next steps

1. User reviews this spec
2. If approved: invoke `writing-plans` skill to produce implementation plan with tasks + sequencing
3. Write ADR-0118 through 0121 before first migration
4. Spec any sub-decisions from Open Questions (§18) during plan writing
