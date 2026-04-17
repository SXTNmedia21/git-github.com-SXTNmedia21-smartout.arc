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

1. **Input deterministisk:** query over `schedule_shift` filtrert på `status = 'completed'` + `workspace_id` + `shift_date BETWEEN period_from AND period_to`. "Completed" er den lifecycle-tilstanden som betyr "vakten ble gjennomført" (enum verdier: `created | assigned | published | active | completed | unpublished` per migration `20260301300000_schedule_shift_table.sql`). Shifts med status `completed` er den strengeste, kunde-vennlige tolkningen av "aktiv bruker" (Blocker 3, beslutning C).
2. **Provenance lagres:** `counted_profile_ids` (jsonb array) + `source_query_hash` (SHA-256 av query + input-parametere)
3. **Materialized view:** `v_invoice_basis` presenterer data deterministisk for både generering og AI-forklaring (LLM leser view, aldri beregner beløp selv)
4. **Re-derivering ved audit:** kjøring av samme query på historisk data må gi samme resultat eller en eksplisitt grunn til avvik (retroaktive shift-endringer → logget som `basis_drift_event`)
5. **Valgfri ekstra stramming:** kryss-referer mot `daily_reconciliation.settled_at IS NOT NULL` for dagen shiften tilhører — sikrer at kun shifts i økonomisk "låst" dag telles. Påkrevd? Avklares i Open Questions §18.

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

-- Trigger: assigns invoice_number from sequence ONLY when invoice transitions
-- draft → issued. Drafts have NULL invoice_number; numbering is reserved until
-- the invoice is committed to bokføringslov-compliant immutability. Sequences
-- advance even on transaction rollback (Postgres default), which is acceptable
-- for bokføring ("gaps are allowed if documented"). Void invoices keep their
-- number; credit notes get a new number.
CREATE OR REPLACE FUNCTION public.assign_invoice_number() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'issued' AND NEW.invoice_number IS NULL THEN
    NEW.invoice_number := nextval('public.invoice_number_seq');
    NEW.issued_at := COALESCE(NEW.issued_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_assign_number
  BEFORE UPDATE OF status ON public.invoice
  FOR EACH ROW
  WHEN (NEW.status = 'issued' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.assign_invoice_number();

-- CHECK: credit note cannot credit another credit note (no nesting)
ALTER TABLE public.invoice
  ADD CONSTRAINT invoice_no_nested_credit_notes
  CHECK (
    credits_invoice_id IS NULL
    OR invoice_type = 'credit_note'
  );

-- CHECK: credit_note must have credits_invoice_id, others must not
ALTER TABLE public.invoice
  ADD CONSTRAINT invoice_credit_note_linkage
  CHECK (
    (invoice_type = 'credit_note' AND credits_invoice_id IS NOT NULL)
    OR (invoice_type <> 'credit_note' AND credits_invoice_id IS NULL)
  );
```

**Nested credit note prohibition:** Enforced via trigger on INSERT/UPDATE — `credits_invoice_id` must reference an invoice where `invoice_type != 'credit_note'`. Implemented as a separate trigger (can't be CHECK constraint since it references another row). See §5.8.

**Legal `status` × `dunning_status` combinations:**

| status | dunning_status allowed | Why |
|---|---|---|
| draft | `none` only | not issued yet |
| issued | `none`, `in_negotiation` | just sent, payment pending |
| sent | `none`, `in_negotiation` | delivery confirmed, payment pending |
| paid | `none` | settled, no dunning |
| overdue | `none`, `in_negotiation`, `reminder_sent`, `escalated` | all dunning states apply |
| void | `none` | cancelled, dunning irrelevant |
| uncollectible | `none` | written off, dunning stopped |

Enforced via CHECK constraint:

```sql
ALTER TABLE public.invoice
  ADD CONSTRAINT invoice_status_dunning_legal
  CHECK (
    (status IN ('draft','paid','void','uncollectible') AND dunning_status IS NULL)
    OR (status IN ('issued','sent') AND dunning_status IN ('none','in_negotiation'))
    OR (status = 'overdue')
  );
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

**Decision (council H6 fix):** `workspace_id` is **NOT NULL**. One row per workspace per period. Company-level aggregate is computed via SUM at read time, not stored as a separate row. This eliminates the unique-constraint NULL ambiguity that existed in v1 of the spec.

```sql
CREATE TABLE public.usage_snapshot (
  usage_snapshot_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.company(company_id),
  workspace_id            uuid NOT NULL REFERENCES public.workspace(workspace_id),
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

### 5.5 Dunning notes — via `activity_trail`, no new table

**Decision (council 2026-04-17):** No dedicated `dunning_note` table. Operator notes are emitted to `activity_trail` via `emit({ event: 'dunning_note.added', invoice_id, note, actor_user_id })`. Single source of truth (cascade invariant preserved). Notes are immutable (activity_trail is append-only) — sufficient for Fase 1 operator workflow (add note + view history). If Fase 2 needs editing/threading/deletion, promote to dedicated table at that time.

UI reads notes via view:

```sql
CREATE VIEW public.v_invoice_dunning_notes AS
SELECT
  at.activity_trail_id,
  at.payload->>'invoice_id' AS invoice_id,
  at.payload->>'note' AS note,
  at.actor_user_id,
  at.created_at
FROM public.activity_trail at
WHERE at.event = 'dunning_note.added';
```

### 5.6 `basis_drift_event` — new table (Fase 1, H8 decision)

Per H8 decision (council): active-user counting uses `shift_status = 'completed'` alone. If a shift is retroactively modified (reassignment, status changed) after the invoice for that period is issued, drift must be logged for platform-admin review. Detection via trigger on `schedule_shift` UPDATE/DELETE when a matching `usage_snapshot` exists for the shift's period.

```sql
CREATE TABLE public.basis_drift_event (
  drift_event_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_snapshot_id    uuid NOT NULL REFERENCES public.usage_snapshot(usage_snapshot_id),
  invoice_id           uuid REFERENCES public.invoice(invoice_id),
  shift_id             uuid,  -- no FK (shift may be deleted)
  drift_type           text NOT NULL CHECK (drift_type IN ('status_reversed','employee_changed','shift_deleted','other')),
  old_value            jsonb,
  new_value            jsonb,
  detected_at          timestamptz NOT NULL DEFAULT now(),
  reviewed_at          timestamptz,
  reviewed_by          uuid REFERENCES public.user_identity(user_id),
  resolution           text CHECK (resolution IN (NULL, 'ignored','credit_note_issued','reinvoiced'))
);

-- Trigger: when schedule_shift UPDATE/DELETE changes status OR employee_id
-- AND a usage_snapshot exists covering that shift_date for that workspace
-- → insert basis_drift_event + emit('invoice.basis_drift_detected')
```

Platform-admin UI surfaces these in a dedicated panel under billing hub.

### 5.7 `v_invoice_basis` — **replaced by two views** (H1 fix)

Original single `v_invoice_basis` view conflated "current plan preview" (for pricing config UI) with "historical invoice basis" (for AI-tool explanation). Replaced by:

**`v_current_plan_preview`** — current month snapshot for pricing config UI:

```sql
-- Non-materialized view: reads live schedule_shift each call.
-- Used only by platform-admin billing config UI to preview "what would next
-- invoice look like" — never by the AI explain_invoice_basis tool.
CREATE VIEW public.v_current_plan_preview AS
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
  -- Uses employee_id (FK to profile.profile_id) — column is named employee_id on schedule_shift
  -- Filters on shift_date (DATE column); start_time + end_time are separate TIME columns
  -- Status 'completed' = shift was performed (per shift_status enum, migration 20260301300000)
  (SELECT count(DISTINCT employee_id)
   FROM public.schedule_shift
   WHERE workspace_id = w.workspace_id
     AND status = 'completed'
     AND employee_id IS NOT NULL
     AND shift_date >= date_trunc('month', now())::date
     AND shift_date < (date_trunc('month', now()) + interval '1 month')::date
  ) AS active_users_current_month
FROM public.company c
JOIN public.workspace w ON w.company_id = c.company_id
LEFT JOIN public.pricing_terms pt ON pt.company_id = c.company_id
  AND (pt.effective_until IS NULL OR pt.effective_until >= CURRENT_DATE)
  AND pt.effective_from <= CURRENT_DATE;
```

**`get_invoice_basis(invoice_id)`** — table-valued function, historical + complete basis for AI-tool explanation:

```sql
-- Table-valued function (not VIEW) because it takes a parameter.
-- Returns EVERYTHING explain_invoice_basis needs in one shape:
-- invoice header + line items + usage snapshot + pricing terms at time of issue.
-- LLM reads this verbatim — never recomputes amounts.
CREATE OR REPLACE FUNCTION public.get_invoice_basis(p_invoice_id uuid)
RETURNS TABLE (
  invoice_id uuid,
  invoice_number int,
  company_id uuid,
  company_name text,
  period_from date,
  period_to date,
  issued_at timestamptz,
  status text,
  amount_excl_vat decimal,
  vat_rate decimal,
  vat_amount decimal,
  amount_incl_vat decimal,
  currency text,
  line_items jsonb,  -- array of {line_type, description, quantity, unit_price, amount_incl_vat, addon_key}
  usage_snapshot jsonb,  -- {period_from, period_to, active_users, free_users_applied, billable_users, counted_profile_ids}
  pricing_terms_at_issue jsonb  -- {monthly_cost, price_per_employee, free_users, overage_price_per_user}
)
LANGUAGE sql STABLE
AS $$
  SELECT
    i.invoice_id,
    i.invoice_number,
    i.company_id,
    c.name,
    i.period_from,
    i.period_to,
    i.issued_at,
    i.status::text,
    i.amount_excl_vat,
    i.vat_rate,
    i.vat_amount,
    i.amount_incl_vat,
    i.currency::text,
    (SELECT jsonb_agg(jsonb_build_object(
      'line_type', li.line_type,
      'description', li.description,
      'quantity', li.quantity,
      'unit_price', li.unit_price,
      'amount_incl_vat', li.amount_incl_vat,
      'addon_key', li.addon_key))
     FROM invoice_line_item li WHERE li.invoice_id = i.invoice_id) AS line_items,
    (SELECT to_jsonb(us.*) FROM usage_snapshot us
     WHERE us.company_id = i.company_id
       AND us.period_from = i.period_from AND us.period_to = i.period_to
     LIMIT 1) AS usage_snapshot,
    (SELECT to_jsonb(pt.*) FROM pricing_terms pt
     WHERE pt.company_id = i.company_id
       AND pt.effective_from <= i.issued_at::date
       AND (pt.effective_until IS NULL OR pt.effective_until >= i.issued_at::date)
     ORDER BY pt.effective_from DESC LIMIT 1) AS pricing_terms_at_issue
  FROM invoice i
  JOIN company c ON c.company_id = i.company_id
  WHERE i.invoice_id = p_invoice_id;
$$;
```

### 5.8 Enums

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

### 5.9 RLS posture

**Prerequisite helper** — does not exist today, must be added in first billing migration:

```sql
-- Mirrors existing is_admin_in_workspace() pattern from supabase/migrations/00004_rls_policies.sql
CREATE OR REPLACE FUNCTION public.is_admin_in_company(p_user_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_member
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND role IN ('admin','owner')
  );
$$;
```

| Table | Platform admin | Company admin | Service role |
|---|---|---|---|
| `invoice` | full | SELECT if `is_admin_in_company(auth.uid(), company_id)` | full |
| `invoice_line_item` | full | SELECT via invoice join | full |
| `usage_snapshot` | full | SELECT if `is_admin_in_company(auth.uid(), company_id)` | full |
| `basis_drift_event` | full | none (platform-admin internal only) | full |
| `pricing_terms` | full (existing, service-role only) | none (existing) | full (existing) |

**Write posture:** platform-admin mutations run via Server Actions with service-role client after `getSuperAdminId()` gate. Workspace-admin-read is via Server Components (no Edge Function — per H7 decision). No direct client mutations from browser.

**Test requirement:** pgTAP tests must verify "company A admin cannot read company B invoice" — added to Definition of Done §17.

---

## 6. Generation flow

### 6.1 Cron scheduling

**Host:** Edge Function `generate-monthly-invoices` + bearer auth via `WATCHDOG_CRON_SECRET` + external trigger (n8n, scheduled). Precedent: `supabase/functions/fire-delayed-triggers`, `daily-session-replenish`. No Vercel Cron, no pg_cron.

**Timing:** Runs on **day 5 of each month at 00:01 CET**. This gives a 4-day settling window for day-31 shifts to transition from `worked` → `settled` (Blocker 3 decision C: only `worked+settled` count; cut-off pushed to day 5 for safety).

### 6.2 Generation as pure transaction

Pseudocode for generator (Deno Edge Function). Note: `emit()` takes a single `SmartoutEvent` object with `event` field per `packages/telemetry/src/emit.ts:12`, not positional args.

```
for each company in active companies:
  pt = get_active_pricing_terms(company_id)
  if pt is null: skip + log

  for each workspace in company.workspaces:
    // compute_usage_snapshot runs:
    //   SELECT count(DISTINCT employee_id) FROM schedule_shift
    //   WHERE workspace_id = $1
    //     AND status = 'completed'
    //     AND employee_id IS NOT NULL
    //     AND shift_date BETWEEN $period_from AND $period_to
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

  await emit({ event: 'usage_snapshot.created', workspace_id, company_id, period_from, period_to, billable_users })
  await emit({ event: 'invoice.generated', invoice_id, company_id, amount_incl_vat })
  await emit({ event: 'invoice.issued', invoice_id, company_id, amount_incl_vat })

  -- Overdue scan (part of same cron run, or separate hourly cron)
  for each invoice where status='issued' and due_at < today:
    update invoice.status = 'overdue'
    await emit({ event: 'invoice.overdue_detected', invoice_id, days_overdue })
```

**Design principles:**
- Generation is a **pure transaction** — no engine_process wrapping, no waits
- Each company's generation is independent (can parallelize later if needed)
- Failures isolate: one company's error doesn't block others
- Idempotency: unique constraint on `(company_id, workspace_id, period_from, period_to)` on `usage_snapshot` prevents double-compute

### 6.3 Lifecycle as `engine_process`

**`invoice_lifecycle` blueprint** (Fase 1): `draft → issued → paid|overdue|void`. Step types: `wait_for_event` (`manual_mark_paid` in Fase 1, `payment_succeeded` in Fase 2), `schedule_control` (overdue check).

**Onboarding invoice:** Deferred from Fase 1 engine_process to **manual platform-admin action** via Server Action `createOnboardingInvoice(company_id, onboarding_package)`. Rationale: spec-level investigation showed `workspace_activation_completed` event does not exist in the codebase (would require creating it + wiring it into the onboarding wizard completion — scope creep). Fase 2 can promote this to an `engine_process` blueprint once the onboarding trigger event exists elsewhere.

Engine processes defined under `supabase/migrations/<date>_billing_engine_processes.sql` as `engine_process` seed rows.

---

## 7. Telemetry registry

Add to `packages/telemetry/src/registry.ts`:

**New category:** `billing`

**New entity types:** `invoice`, `invoice_line_item`, `usage_snapshot`, `billing_agreement`, `dunning_note`

**Call shape:** `emit()` takes a single `SmartoutEvent` object per `packages/telemetry/src/emit.ts:12`. Shape: `emit({ event: 'invoice.issued', invoice_id, company_id, amount_incl_vat, ... })`. Events must be registered in `EVENT_ROUTING` in `packages/telemetry/src/registry.ts` — unregistered events are logged and dropped.

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

**Naming collision note:** `pricing_terms.delivery_channel` (singular, this spec) is distinct from `notification_policy.delivery_channels` (plural array, existing table at migration `20260422300000`). Different domains (billing dispatch vs notification fanout) — no column collision, but reviewers should be aware.

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

**No new Edge Function** (H7 council decision). Workspace-admin reads happen via **Server Components** at `apps/web/src/app/dashboard/billing/page.tsx` + Server Actions at `apps/web/src/app/dashboard/billing/_actions/`:

- `getMyCompanyInvoices()` — Server Action, uses service-role client + `is_admin_in_company(auth.uid(), company_id)` gate, returns own company's invoices
- `getMyInvoiceDetail(invoice_id)` — same pattern, single invoice + line items
- `getMyUsageSnapshots(workspace_id)` — own workspace snapshots

**Rationale:** ADR-0029 (workspace-api gateway) targets workspace-scoped data; billing is company-scoped. Rather than creating a second gateway with its own ADR, reuse Server Components + Server Actions (canonical per ADR-0114). Mobile hooks in `packages/billing/hooks/` call these Server Actions via the shared API surface. No Edge Function deployment needed.

**Cache invalidation:** Every mutation Server Action (§8.1) ends with `revalidatePath('/platform-admin/billing')` and `revalidatePath('/dashboard/billing')` as appropriate.

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
| `explain_invoice_basis` | own company, own invoice | reads `get_invoice_basis(invoice_id)` function (§5.7), explains in NL — **never computes amounts** |
| `list_overdue` | own company | overdue subset |
| `get_usage_snapshot` | own workspace | snapshot for period |

**Context:** existing `AgentToolContext` (workspace-scoped). Company derived via shared helper (no need to widen `AgentToolContext`):

```ts
// packages/ai/src/lib/resolveCompanyId.ts
export async function resolveCompanyId(ctx: AgentToolContext): Promise<string> {
  const { data } = await ctx.supabaseAdmin
    .from('workspace')
    .select('company_id')
    .eq('workspace_id', ctx.workspaceId)
    .single();
  if (!data?.company_id) throw new Error('Workspace not linked to a company');
  return data.company_id;
}
```

All 5 tools call `resolveCompanyId(ctx)` at start. Future refactor (Fase 2) can promote `companyId` to `AgentToolContext` resolved at session creation if perf matters.

**Capability registration checklist** (mechanical — all 4 touchpoints required):
1. Add `"billing_query"` to `CapabilityName` union at `packages/ai/src/capabilities/types.ts`
2. Add entry to `packages/ai/src/capabilities/registry.ts`
3. Add `"billing_query"` enum value + intent description block to `packages/ai/src/router/intent-classifier.ts`
4. Seed authority config rows: `engine_authority_config` row per workspace with `capability='billing_query'`, `level='read_only'`

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

**Prerequisite PR** (must merge before any billing UI code): add these semantic tokens to `packages/design-tokens/src/tokens.ts` + `tokens.css` + `native.ts`. Exact OKLCH values (warm Nordic Split palette, aligned with existing hue 50-60 foundation):

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--success` | `oklch(0.68 0.15 145)` | `oklch(0.72 0.14 145)` | Paid status, "alt er betalt" celebratory states |
| `--success-foreground` | `oklch(0.18 0.04 145)` | `oklch(0.96 0.02 145)` | Text on success backgrounds |
| `--warning` | `oklch(0.75 0.15 75)` | `oklch(0.78 0.14 75)` | Overdue 1-14d, in-negotiation states |
| `--warning-foreground` | `oklch(0.20 0.04 75)` | `oklch(0.96 0.02 75)` | Text on warning |
| `--destructive` | `oklch(0.60 0.20 25)` | `oklch(0.65 0.19 25)` | Warm coral — Void actions, 30+d overdue, uncollectible (NOT pure red) |
| `--destructive-foreground` | `oklch(0.98 0.01 25)` | `oklch(0.98 0.01 25)` | Text on destructive |
| `--info` | `oklch(0.65 0.13 225)` | `oklch(0.70 0.12 225)` | Info callouts, neutral system messages |
| `--info-foreground` | `oklch(0.18 0.04 225)` | `oklch(0.96 0.02 225)` | Text on info |

Use via Tailwind utility classes: `bg-success`, `text-success-foreground`, `border-destructive`, etc. **Never** hardcode OKLCH or use `bg-red-500`.

### 10.2 Component inventory

- **`<InvoiceStatusBadge>`** — lives in `packages/ui/src/InvoiceStatusBadge.tsx`. Props: `{ status: InvoiceStatus, size?: 'sm'|'md', withIcon?: boolean }`. Internally maps status → token (`--success`/`--warning`/`--destructive`/`--muted`) + Lucide icon (`FileText`, `Send`, `CheckCircle2`, `AlertTriangle`, `Ban`). **Enforcement:** ESLint custom rule blocks hex/tailwind color classes inside `apps/web/src/app/platform-admin/billing/**` and `apps/web/src/app/dashboard/billing/**` — must use the badge component or CSS var utilities. Rule added to `packages/eslint-config`.
- **`<DataTable>`** — shadcn `<Table>` + wrapper adding sort/filter/select state via URL params (sort via `?sort=col:asc`, filter via `?status=overdue`). Cmd+K command palette deferred to Fase 2.
- **`<InvoiceDetailSheet>`** + **`<InvoiceDetailPage>`** — same inner component `<InvoiceDetail>`. Query-param contract: list row click opens Sheet via `?preview=<invoice_id>`; direct/bookmark link uses route `/platform-admin/billing/invoices/[id]`. Escape closes Sheet, clicking outside closes, scroll-lock engaged while open.
- **`<InvoiceDetail>` tabs** — three tabs:
  1. **Oversikt** — header (number, company, amount, status), line items table, usage snapshot accordion, metadata sidebar
  2. **Historikk** — vertical timeline of `activity_trail` entries for this invoice (status changes, payments, void, dunning notes). Timestamp + actor + event description + Lucide icon per event type. This is the Q-audit surface.
  3. **Handlinger** — mutation buttons (mark paid, void, credit note, regenerate if draft)
- **`<DunningKanban>`** — 4 age-tier columns (0-7d / 8-14d / 15-29d / 30+d). Column header: count + sum-of-amounts, severity tint (warm amber → warm coral gradient via `--warning` → `--destructive` tokens). Cards: company name (Geist 14 semibold) + invoice number (Geist Mono) + amount (tabular-nums) + days overdue + popover action menu. Empty column: muted "Ingen fakturaer i denne kategorien" centered. 30+d cards pulse opacity (see §10.3). No drag-drop (age is time-driven).
- **`<UsageSnapshotAccordion>`** — collapsed: "N profiler talt". Expanded: table with profile_id, display_name, count of completed shifts in period, link to profile detail.
- **`<BulkActionBar>`** — fixed bottom panel, slides up when table selection > 0. Glassmorphic `bg-background/80 backdrop-blur-xl backdrop-saturate-150`. Actions: "Eksporter valgte til CSV" (always), "Marker betalt" (if all selected are `issued|overdue|sent`), overflow menu for void (requires AlertDialog per-invoice, no bulk void). Slide motion per §10.3.
- **`<BasisDriftPanel>`** — platform-admin-only panel showing pending `basis_drift_event` rows. Shows: invoice affected, shift changed, old → new value diff, actions (Ignore / Issue credit note / Reinvoice). Lives in `/platform-admin/billing/drift`.

### 10.3 Motion tier per surface (Frontend design lock D-1)

Concrete Framer Motion `transition` values per surface. Implementers copy verbatim.

| Surface | Transition spec |
|---|---|
| Page heroes, orbs (first paint) | `{ type: 'spring', stiffness: 35, damping: 22, mass: 2.2 }` |
| Sheet/Drawer slide-in (detail panel) | `{ type: 'spring', stiffness: 45, damping: 24, mass: 1.8 }` |
| AlertDialog (void, uncollectible, credit note) | `{ type: 'spring', stiffness: 45, damping: 24, mass: 1.8, delay: 0.05 }` |
| Dialog (mark paid, filter popovers) | `{ type: 'spring', stiffness: 250, damping: 28, mass: 1 }` |
| Table row hover, sort click, filter apply | `{ type: 'spring', stiffness: 250, damping: 28, mass: 1 }` |
| Status badge morph on state change | `layout + layoutId` with `{ type: 'spring', stiffness: 250, damping: 28 }` |
| Dunning 30+d glow breathing | `animate={{ opacity: [0.5, 0.75, 0.5] }}`, `transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}` — **opacity only, never scale** (avoids layout thrash) |
| Bulk action bar slide-up | `{ type: 'spring', stiffness: 45, damping: 24, mass: 1.8 }`, y: 40 → 0 |
| Toast (sonner default) | sonner defaults — do not override |

**Reduced-motion:** All surfaces wrap animations in `useReducedMotion()` check. If true: disable glow breathing, reduce spring stiffness to 400+ (near-instant), keep layout animations for accessibility.

### 10.4 Destructive actions — explicit enums

**Void** (`<AlertDialog>`, `--destructive` variant):
- Typed confirmation: user must type the invoice's `invoice_number` (e.g., `1042`) to enable submit button
- Reason required, min 10 chars
- Reason enum (matches Stripe void reasons for Fase 2 parity):
  ```ts
  type VoidReason = 'duplicate' | 'fraudulent' | 'order_change' | 'product_unsatisfactory' | 'issued_in_error' | 'other'
  ```
- No undo — once voided, new credit note must be issued to correct

**Mark uncollectible** (`<AlertDialog>`):
- Reason code from enum:
  ```ts
  type UncollectibleReason = 'bankruptcy' | 'disputed_unresolved' | 'statute_of_limitations' | 'customer_ghosted' | 'written_off' | 'other'
  ```
- Free-text note optional for enum=`other`

**Mark paid** (`<Dialog>`, recoverable):
- Reason/channel from enum:
  ```ts
  type PaymentChannel = 'bank_transfer' | 'cash' | 'stripe_manual_capture' | 'out_of_band' | 'partial_write_off' | 'other'
  ```
- Amount field (default full invoice amount, editable for partial)
- Payment reference free-text (bank ref, Stripe capture-id, etc.)
- Payment date (default today)

**Issue credit note** (`<AlertDialog>`):
- Requires original invoice link (auto-populated from context)
- Reason (same enum as Void)
- Amount (default full credit, editable for partial)
- Preview of new credit note before issuing (non-reversible once issued)

### 10.5 Empty / loading / error states (per-surface, mandatory)

| Surface | Empty | Loading | Error |
|---|---|---|---|
| Invoice list | Instrument Serif "Ingen fakturaer enda" (i18n key), muted orb background, no CTA (invoices are generated by cron) | `<Skeleton>` table rows × 7 (new shadcn Skeleton variant matching row height) | `<AlertTriangle>` inline callout, `--warning` token, retry button |
| Invoice detail | N/A (404 route if invoice_id invalid) | Skeleton of full inner shell (header + line-items + snapshot accordion) — NOT a blanking spinner | Inline error inside Sheet/Page, sheet stays open for retry |
| Dunning dashboard (all columns empty) | Instrument Serif "Alt er betalt." + `<CheckCircle2>` + calmer orb — celebratory | 4 column skeletons, 2 card skeletons per column | Full-page callout with retry |
| Dunning column (single column empty) | Muted text "Ingen fakturaer i denne kategorien" centered, no icon | Skeleton cards × 2 | Per-column inline error |
| CSV export | N/A (always form) | Spinner on submit button only; when generating async: progress indicator with job status | Inline form error with specific message |
| Basis drift panel | "Ingen drift-hendelser" muted, small `<CheckCircle2>` | Skeleton rows × 3 | Inline callout with retry |
| Usage snapshot accordion | Never empty if invoice has line items; otherwise "Ingen aktivitet i perioden" | Lazy-loaded on expand with inline spinner | Inline error, collapse-to-retry |

No spinners on list pages. Every error state has retry action — no silent failure on financial data.

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
| **0118** | Invoice engine as C3 Commercial consumer (+ company-scoped workspace_id exception justification + dunning_note-via-activity_trail decision) | To write |
| **0119** | Usage snapshot reproducibility contract: active-user = `shift_status = 'completed'` alone (H8 decision A), `source_query_hash` provenance, `basis_drift_event` trigger on retroactive shift changes | To write |
| **0120** | Invoice immutability + credit note policy (bokføringslov): continuous numbering via sequence on `draft→issued`, no delete, credit notes (no nesting, enforced), invoice identity contract (UUID for system, int for humans), legal `status`×`dunning_status` combinations | To write |
| **0121** | `pricing_terms` extension for billing engine (5 new fields); resolves `agreement_period` vs `effective_from/until` (agreement_period = contract duration for display, effective_from/until = price validity for computation) | To write, amends ADR-0027 |
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

### Prerequisites (must merge first)

- [ ] Semantic tokens (`--success`/`--warning`/`--destructive`/`--info` + foreground variants) added to `packages/design-tokens/src/tokens.ts` + `tokens.css` + `native.ts` with exact OKLCH values per §10.1
- [ ] ADR-0118, 0119, 0120, 0121 written and merged as `accepted`
- [ ] `is_admin_in_company()` RLS helper migration deployed (§5.9)

### Data model

- [ ] Migration: `pricing_terms` + 5 new columns
- [ ] Migrations: `invoice`, `invoice_line_item`, `usage_snapshot`, `basis_drift_event` + enums + sequence + triggers (assign_invoice_number, nested credit note prohibition, state×dunning CHECK)
- [ ] Migration: `v_current_plan_preview` view + `get_invoice_basis(invoice_id)` function + `v_invoice_dunning_notes` view
- [ ] Migration: `basis_drift_event` trigger on `schedule_shift` UPDATE/DELETE for periods with issued invoice
- [ ] Migration: `engine_process` seed row for `invoice_lifecycle` blueprint
- [ ] Migration up/down tested on Supabase Local

### Infrastructure

- [ ] Edge Function `generate-monthly-invoices` deployed with `WATCHDOG_CRON_SECRET` auth
- [ ] n8n workflow `billing-monthly-trigger` configured — POST to `/functions/v1/generate-monthly-invoices` on day 5 at 00:01 CET with bearer header
- [ ] Idempotency proven: re-run on same period skips via `UNIQUE (company_id, workspace_id, period_from, period_to)` on usage_snapshot
- [ ] Rate limiting on destructive Server Actions (`voidInvoice`, `issueCreditNote`) via Upstash Redis — 10/min per user

### Telemetry

- [ ] `EVENT_ROUTING` in `packages/telemetry/src/registry.ts` updated with 10 new events + `billing` category
- [ ] CI assertion (`packages/telemetry/__tests__/billing-emit.spec.ts`) — **Vitest**, mocks `emit()`, asserts each billing mutation site (Edge Function generator + 7 Server Actions from §8.1) calls with expected event shape

### Data layer

- [ ] `packages/billing/` package: types, Zod schemas, Server Action client wrappers, query hooks (`useInvoices`, `useInvoice`, `useUsageSnapshot`)
- [ ] No billing hooks in `apps/web/src/app/billing*` (CI lint rule)

### UI

- [ ] `<InvoiceStatusBadge>` in `packages/ui/src/` with enforced token mapping
- [ ] ESLint rule: hex/tailwind color classes forbidden inside `apps/web/src/app/**/billing/**`
- [ ] Platform-admin routes: `/platform-admin/billing/{invoices,invoices/[id],dunning,export,drift}` + company billing tab at `/platform-admin/companies/[id]?tab=billing`
- [ ] Workspace-admin route: `/dashboard/billing` (Server Component, read-only)
- [ ] All UI strings via i18n keys in `packages/i18n/` — no hardcoded Norwegian (CLAUDE.md rule)
- [ ] Empty/loading/error states per surface (list, detail, dunning, export, drift) per §10.5
- [ ] Accessibility audit: `aria-sort`, tabular-nums on amounts, typed confirmation for void, Lucide icons paired with color, `useReducedMotion()` honored

### AI

- [ ] Capability `billing_query` registered at 4 touchpoints (§9.1): `CapabilityName` union, `registry.ts`, `intent-classifier.ts`, `engine_authority_config` seed
- [ ] `resolveCompanyId(ctx)` helper in `packages/ai/src/lib/`
- [ ] 5 read-only tools, `allowedChannels: ["chat"]`, never compute amounts

### Tests

- [ ] pgTAP tests: company A admin cannot read company B invoice
- [ ] pgTAP tests: nested credit note CHECK rejects
- [ ] pgTAP tests: state × dunning_status CHECK rejects illegal combos
- [ ] Vitest tests: telemetry emit assertions (above)
- [ ] Playwright E2E: one journey per user role (platform-admin mark paid / void / credit note; workspace-admin view own invoices)

### Documentation

- [ ] New module doc `docs/modules/MODULE_BILLING.md` (number TBD — verify free in `docs/INDEX.md`)
- [ ] Norwegian bokføringslov compliance documented in module doc
- [ ] Handoff `docs/HANDOFF-billing-engine-fase-1.md` with decisions + learnings + next steps
- [ ] User journeys `docs/journeys/JOURNEY-billing-engine-fase-1.md` covering platform-admin + workspace-admin flows

---

## 18. Open questions (non-blockers, resolve in implementation plan or ADRs)

**Resolved by council (2026-04-17 round 2):**
- ~~Settle gate~~ → H8 decision A: `completed` alone + `basis_drift_event` trigger. Locked in ADR-0119.
- ~~billing-api gateway~~ → H7 decision C: Server Components + Server Actions, no new Edge Function.
- ~~dunning_note table vs activity_trail~~ → activity_trail only, no dedicated table.
- ~~agreement_period vs effective_from/until~~ → agreement_period = contract duration (display), effective_from/until = price validity (computation). Locked in ADR-0121.
- ~~Onboarding trigger~~ → manual platform-admin Server Action in Fase 1; blueprint deferred to Fase 2.

**Still open (resolve during plan-writing):**

1. **Two-pass generation** — day-5 generate `draft` + day-10 auto-issue (5-day admin review window)? Or single-pass draft→issued immediately? **Recommendation: two-pass**, gives manual correction window before `invoice_number` is assigned (bokføringslov: once numbered, immutable).
2. **Partial payment UX** — allow incremental payments (`paid_at` = running sum, status transitions when full)? Or require single-transaction full settlement? If incremental: need `payment` child table, not just invoice fields.
3. **Credit note amounts** — positive or negative line items? Norwegian accounting convention typically shows credit notes as positive numbers with explicit `credit_note` type; line totals subtract from original. Lock in ADR-0120.
4. **Add-on source** — Fase 1 skeleton only. Actual source (`addon_usage_ledger` table? event stream aggregation?) deferred to Fase 2 when SMS/AI-token usage tracking is wired.
5. **CSV export format** — column names (Norwegian or English?), date format (ISO 8601 or Norwegian `DD.MM.YYYY`?), decimal separator (`,` for Norwegian Excel, `.` for international), encoding (UTF-8 BOM for Excel compat). Decide in plan phase with accountant input.
6. **Dunning age calculation** — from `due_at` directly, or `issued_at + payment_terms_days`? `due_at` is set at generation, so "days overdue = today - due_at" is simplest. Lock in ADR-0120.
7. **Reminder email templates (Fase 2)** — 3 templates (friendly/firm/final) or 5-step escalation curve? Separate Fase 2 spec.
8. **EHF provider selection (Fase 2)** — Sproom / Nets / Pagero / Visma Addo? Separate Fase 2 spec.
9. **Module doc number** — CLAUDE.md references modules 1-15, 17-20, 4.5. Module 13 was historically the billing/multi-tenant module (referenced in stale docs). Recommendation: name new doc `docs/modules/MODULE_BILLING.md` without a number, avoiding collision.

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

---

## 21. DO NOT TOUCH list

Build-agents executing this spec must **not** modify the following files/tables/ADRs:

### Files — extend only, do not replace

- `apps/web/src/app/platform-admin/billing/page.tsx` — **preserve** existing MRR dashboard. Becomes the "Overview" tab of the billing hub. Do not rewrite or replace the MRR query logic.
- `apps/web/src/app/platform-admin/billing/_components/billing-client.tsx` — **preserve**. Add new tab components alongside, don't rewrite this one.
- `apps/landing/src/app/pricing/page.tsx` — **out of scope**. Billing engine does not touch pricing landing page.

### Tables — do not modify schema

- `company` — **do not add `stripe_customer_id`** in Fase 1 (deferred to Fase 2 with ADR-0012 amendment). `subscription_plan`/`subscription_status`/`trial_ends_at`/`billing_email` remain unchanged.
- `pricing_terms` — extend additively only (5 new columns per §5.1). Do not rename, do not drop, do not change existing columns.
- `engine_process`, `engine_state`, `engine_state_step`, `engine_authority_config`, `engine_memory` — seed new rows for `invoice_lifecycle` blueprint and `billing_query` capability; do **not** alter schema.
- `activity_trail` — emit new events (`dunning_note.added`, `invoice.basis_drift_detected`, etc.); do **not** alter schema.
- `schedule_shift`, `daily_reconciliation`, `profile`, `workspace`, `company_member`, `user_identity` — **read-only** from billing engine. No writes, no schema changes.
- `notification_policy` — untouched. `notification_policy.delivery_channels` (plural) is an unrelated column; billing uses `pricing_terms.delivery_channel` (singular).

### ADRs — do not amend

- **ADR-0012** (subscription on company) — defer amendment to Fase 2. Fase 1 does not need `stripe_customer_id`.
- **ADR-0027** (pricing_terms) — preserve via additive extension (ADR-0121 amendment). Do not supersede.
- **ADR-0029** (workspace-api gateway) — billing reads use Server Components instead of creating a second gateway (H7 decision).
- **ADR-0045** (SendGrid canonical) — Fase 1 does not send emails. Fase 2 dunning reminders will go via SendGrid.
- **ADR-0114** (Server Actions canonical) — follow, do not amend.

### Routes — do not occupy

- `/dashboard/billing/*` on mobile — scoped for workspace-admin read-only; do not add mutations.
- `/platform-admin/companies/*` — extend with `?tab=billing` query param; do not replace existing company detail pages.

### Packages — do not restructure

- `packages/ai/src/capabilities/*` — add `billing-query/` subdirectory; do not refactor existing capabilities (`operations`, `guardian`, etc.) even though they have emit() debt (out of scope; separate cleanup task).
- `packages/telemetry/src/*` — add to registry; do not change `emit()` signature or routing logic.
- `packages/ui/src/*` — add `InvoiceStatusBadge.tsx`; do not modify existing exports.

### Out of scope entirely (Fase 2+)

- Stripe Invoice API integration, customer portal, webhooks, `stripe_customer_id` storage
- EHF / PEPPOL BIS Billing 3.0 XML generation, Sproom/Nets/Pagero integration
- PDF invoice generation, hosted invoice URLs
- SendGrid reminder templates, auto-dunning escalation
- Platform-admin cross-workspace AI-tools (blocked on `PlatformAdminToolContext` ADR)
- Bank-feed reconciliation automation
- Multi-currency support beyond NOK column-carry
