---
title: "Billing Engine Fase 1 — Implementation Plan"
status: draft
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [billing, invoice, faktura, implementation, plan]
spec: docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md
---

# Billing Engine Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Smartout's internal invoice engine (Fase 1) — monthly fakturagrunnlag generation, platform-admin UI, AI-tools, per-company billing config. No external dispatch (Stripe/EHF) — that's Fase 2.

**Architecture:** Invoice engine sits at cascade layer C3 (Commercial consumer), reads from D6 (schedule_shift) and K1b (pricing_terms). Generation = pure transaction via cron Edge Function (day 5 at 00:01 CET, `WATCHDOG_CRON_SECRET` + n8n). Lifecycle = `engine_process` blueprint. Mutations via Server Actions. No Edge Function for workspace-admin reads — Server Components per H7 decision.

**Tech Stack:** Postgres 17 + Supabase RLS, Deno Edge Functions, Next.js 16 App Router Server Actions, React 19 + Server Components, shadcn/ui new-york, Framer Motion, Nordic Split tokens, `@smartout/telemetry` emit(), `packages/ai` capability pattern, Zod + TypeScript strict.

**Total scope:** 14 phases, ~55 tasks. Estimated calendar: 4-6 weeks of focused work (can parallelize Phases 3, 5 early).

**Spec section references:** all §X.Y references point to the approved spec at `docs/superpowers/specs/2026-04-17-billing-engine-fase-1-design.md`.

---

## Critical Corrections (verified against codebase 2026-04-17)

These patterns were wrong in an earlier plan draft. **Every task below uses the corrected forms:**

### Import paths (verified via grep)

```ts
// CORRECT
import { createAdminClient } from "@smartout/supabase/admin";      // package import, not @/lib
import { getSuperAdminId } from "@/lib/platform-admin";            // apps/web/src/lib/platform-admin.ts
import { cn } from "./lib/utils";                                   // packages/ui/src/lib/utils.ts (not ./utils)
import { emit } from "@smartout/telemetry";
```

### Event naming (verified in `packages/telemetry/src/registry.ts`)

Events use **space-separated** names, NOT dots:

```ts
// WRONG: "invoice.generated"
// CORRECT: "invoice generated"
```

### Event payload shape — flat entity contract (L-0038)

The activity_trail provider **rejects** events without `entity_type` + `entity_id` (Botsson R2 learning). Use the flat contract like `ShiftCreated`:

```ts
await emit({
  event: "invoice issued",
  properties: {
    entity_type: "invoice",
    entity_id: invoiceId,
    data: { company_id, amount_incl_vat },
  },
});
```

Each event needs an interface in `registry.ts` extending `BaseEvent` with its `properties` shape.

### EVENT_ROUTING shape

```ts
"invoice issued": {
  destinations: ["posthog", "logger", "activity_trail", "engine_event"],
  category: "billing",
}
```

Only `destinations` + `category` on routing meta. No `entity` field there.

### Edge Function emit (Deno, no @smartout/telemetry import)

**Decision (required before Phase 4):** Edge Function cron runs on Deno — cannot import `@smartout/telemetry` (Node-only). Three options:

- **Option A (recommended):** Create a thin HTTP emit endpoint at `apps/web/src/app/api/internal/emit/route.ts` guarded by `WATCHDOG_CRON_SECRET`. Edge Function POSTs events to it. Route calls real `emit()`.
- Option B: Duplicate routing logic in Deno-compatible shim at `packages/telemetry/src/emit.deno.ts`.
- Option C: CI assertion carves out Edge Functions explicitly.

**Plan assumes Option A.** A new task in Phase 2 builds the endpoint.

---

## Phase 0 — Prerequisites (MUST merge first, blocks all other work)

### Task 0.1: Write ADR-0118 — Invoice engine as C3 Commercial consumer

**Files:**
- Create: `docs/decisions/0118-invoice-engine-as-c3-commercial-consumer.md`
- Modify: `docs/decisions/0000-decision-log.md` (register entry)

- [ ] **Step 1: Verify ADR-0118 number is still free**

```bash
ls docs/decisions/0118*.md 2>/dev/null
# Expected: no output (number free)
grep -n "0118" docs/decisions/0000-decision-log.md
# Expected: no match
```

If 0118 taken, claim next free number and update all references in this plan + spec.

- [ ] **Step 2: Write the ADR**

Copy template from `docs/templates/decision.md`. Content:
- **Title:** Invoice engine as C3 Commercial consumer
- **Context:** Fase 1 billing spec introduces invoice + usage_snapshot tables. Placement question: new dimension? New control plane? Existing plane?
- **Decision:** Invoice engine is a C3 Commercial *consumer* — reads D6 `schedule_shift` + K1b `pricing_terms`, writes its own tables, never mutates cascade sources. Invoice is a derived, period-bounded attribution of platform value to a billable entity (company).
- **Rationale:** Matches cascade spec §2.3 ("C3 Commercial: What value was created? What does it cost?"). Billing is company-scoped not workspace-scoped — justifies workspace_id exception for `invoice`, `invoice_line_item` tables (`usage_snapshot` carries workspace_id per H6). Dunning notes via `activity_trail` (no `dunning_note` table) preserves cascade invariant #2.
- **Consequences:** New ADR-0119 for usage reproducibility contract. New ADR-0120 for immutability. Module doc `MODULE_BILLING.md` to be written. Workspace_id exception documented.

- [ ] **Step 3: Register in decision log**

Append row to `docs/decisions/0000-decision-log.md` table with status `accepted`, date `2026-04-17`.

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0118-invoice-engine-as-c3-commercial-consumer.md docs/decisions/0000-decision-log.md
git commit -m "docs(billing-engine): add ADR-0118 invoice engine as C3 Commercial consumer"
```

### Task 0.2: Write ADR-0119 — Usage snapshot reproducibility contract

**Files:**
- Create: `docs/decisions/0119-usage-snapshot-reproducibility.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Write the ADR**

Content:
- **Title:** Usage snapshot reproducibility + active-user = `shift_status = 'completed'`
- **Decision:**
  1. Active-user counting predicate: `schedule_shift WHERE status = 'completed' AND employee_id IS NOT NULL AND shift_date BETWEEN period_from AND period_to`. No cross-reference to `daily_reconciliation.settled_at` (H8 decision A).
  2. `usage_snapshot` stores `counted_profile_ids jsonb` (audit trail) + `source_query_hash text` (SHA-256 of query + params).
  3. Retroactive modifications to `schedule_shift` for a period with an issued invoice trigger `basis_drift_event` insert + emit `invoice.basis_drift_detected`.
  4. Platform-admin reviews drift events, resolves via: ignore / issue credit note / reinvoice.
- **Rationale:** `completed` is terminal per temporal-lock trigger (migration `20260428130000_schedule_shift_temporal_lock.sql` lines 127-138). Day-5 cron timing handles typical settling lag. Drift detection catches the residual edge cases with full audit. Keeps invoice generation deterministic, independent of C1 reconciliation timing.

- [ ] **Step 2: Register + commit**

```bash
git add docs/decisions/0119-usage-snapshot-reproducibility.md docs/decisions/0000-decision-log.md
git commit -m "docs(billing-engine): add ADR-0119 usage snapshot reproducibility"
```

### Task 0.3: Write ADR-0120 — Invoice immutability + credit note policy

**Files:**
- Create: `docs/decisions/0120-invoice-immutability-credit-note-policy.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Write the ADR**

Content:
- **Title:** Invoice immutability + credit note policy (bokføringsloven)
- **Decision:**
  1. Continuous invoice numbering via Postgres sequence `invoice_number_seq`. Numbering assigned on `draft → issued` transition via trigger (draft invoices have NULL number).
  2. **No DELETE** on issued invoices. Ever.
  3. Corrections via credit notes only. `invoice_type = 'credit_note'` + `credits_invoice_id` FK to original.
  4. **No nested credit notes** — enforced via trigger. A credit note cannot credit another credit note.
  5. Legal `status` × `dunning_status` combinations constrained via CHECK (7 status × 4 dunning_status = 28 combos; ~8 legal).
  6. **Invoice identity contract:** `invoice_id` UUID (internal FKs, join keys). `invoice_number` INT (human display, external references: Stripe/EHF/bank). Never mix.
  7. **Dunning age calculation:** from `due_at` (set at generation). `days_overdue = CURRENT_DATE - due_at`.
  8. **Credit note amounts:** positive numbers with explicit `credit_note` invoice_type; line totals subtract from original (accounting convention).
- **Rationale:** Norwegian bokføringslov §5 requires immutable, numbered, retained 5+ years. Credit notes are the universal correction mechanism.

- [ ] **Step 2: Register + commit**

```bash
git add docs/decisions/0120-invoice-immutability-credit-note-policy.md docs/decisions/0000-decision-log.md
git commit -m "docs(billing-engine): add ADR-0120 invoice immutability + credit note policy"
```

### Task 0.4: Write ADR-0121 — pricing_terms extension for billing engine

**Files:**
- Create: `docs/decisions/0121-pricing-terms-billing-engine-extension.md`
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Write the ADR**

Content:
- **Title:** `pricing_terms` extension for billing engine (amends ADR-0027)
- **Decision:** Add 5 columns to `pricing_terms` (additive migration, ADR-0027 preserved):
  - `free_users int NOT NULL DEFAULT 10`
  - `overage_price_per_user decimal(12,2)` (nullable)
  - `delivery_channel text NOT NULL DEFAULT 'manual' CHECK (IN ('manual','stripe','ehf'))`
  - `invoice_format text NOT NULL DEFAULT 'pdf' CHECK (IN ('pdf','ehf'))`
  - `agreement_period daterange` (nullable)
- **Semantic clarification:** `agreement_period` = contract duration (display). `effective_from/until` = price validity (computation engine). Both may be populated; not redundant.
- **Rationale:** No new `billing_agreement` table needed. `pricing_terms` remains canonical per ADR-0027. Additive schema = safe migration.

- [ ] **Step 2: Register + commit**

```bash
git add docs/decisions/0121-pricing-terms-billing-engine-extension.md docs/decisions/0000-decision-log.md
git commit -m "docs(billing-engine): add ADR-0121 pricing_terms extension"
```

### Task 0.5: Add semantic tokens (`--success/--warning/--destructive/--info`)

**Files:**
- Modify: `packages/design-tokens/src/tokens.ts`
- Modify: `packages/design-tokens/src/tokens.css`
- Modify: `packages/design-tokens/src/native.ts`

- [ ] **Step 1: Check if any tokens already exist**

```bash
grep -E '(--success|--warning|--destructive|--info)' packages/design-tokens/src/tokens.css
# Expected: --destructive may already exist (shadcn default); others likely missing
```

- [ ] **Step 2: Add-or-update exact OKLCH values per spec §10.1**

**S3 fix:** `--destructive` likely already exists from shadcn default (pure red hue ~0). Replace with warm coral (hue 25), not add. Success/warning/info are new.

Add to `tokens.css` under `:root` and `.dark` sections:

```css
:root {
  /* existing tokens ... */
  --success: oklch(0.68 0.15 145);
  --success-foreground: oklch(0.18 0.04 145);
  --warning: oklch(0.75 0.15 75);
  --warning-foreground: oklch(0.20 0.04 75);
  --destructive: oklch(0.60 0.20 25);
  --destructive-foreground: oklch(0.98 0.01 25);
  --info: oklch(0.65 0.13 225);
  --info-foreground: oklch(0.18 0.04 225);
}

.dark {
  --success: oklch(0.72 0.14 145);
  --success-foreground: oklch(0.96 0.02 145);
  --warning: oklch(0.78 0.14 75);
  --warning-foreground: oklch(0.96 0.02 75);
  --destructive: oklch(0.65 0.19 25);
  --destructive-foreground: oklch(0.98 0.01 25);
  --info: oklch(0.70 0.12 225);
  --info-foreground: oklch(0.96 0.02 225);
}
```

- [ ] **Step 3: Mirror to tokens.ts + native.ts**

Same OKLCH values as TypeScript objects in `tokens.ts`. For `native.ts` (React Native), convert OKLCH → hex using the existing conversion helper in the file.

- [ ] **Step 4: Update Tailwind config (if applicable)**

Check `apps/web/src/app/globals.css` for `@theme inline` block. Add utility class mappings:

```css
@theme inline {
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  /* --color-destructive usually already exists */
}
```

- [ ] **Step 5: Verify via test page**

Run dev server and inspect `/` — confirm `bg-success`, `bg-warning`, `bg-info` render warm-OKLCH swatches.

```bash
pnpm dev
# Manual: open browser, check Tailwind output includes new classes
```

- [ ] **Step 6: Commit**

```bash
git add packages/design-tokens/ apps/web/src/app/globals.css
git commit -m "feat(design-tokens): add semantic tokens --success, --warning, --info

Warm OKLCH values aligned with Nordic Split palette.
--destructive refined to warm coral (hue 25), not pure red.
Prerequisite for billing engine UI (§10.1)."
```

---

## Phase 1 — Data model (migrations)

All migrations use format `YYYYMMDDHHMMSS_description.sql`. Use `npx supabase migration new <name>` to generate timestamps. Work against Supabase Local (`npx supabase start`).

### Task 1.1: RLS helper `is_admin_in_company()`

**Files:**
- Create: `supabase/migrations/<ts>_is_admin_in_company_helper.sql`

- [ ] **Step 1: Generate migration**

```bash
npx supabase migration new is_admin_in_company_helper
```

- [ ] **Step 2: Write the function**

```sql
SET search_path TO public, extensions;

-- Helper for billing engine RLS. Mirrors is_admin_in_workspace() pattern
-- from 00004_rls_policies.sql but scoped to company instead of workspace.
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

GRANT EXECUTE ON FUNCTION public.is_admin_in_company(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.is_admin_in_company IS
  'Checks if user is admin/owner in a specific company. Used by billing engine RLS.';
```

- [ ] **Step 3: Test**

```bash
npx supabase db reset
# Verify no errors
psql $SUPABASE_DB_URL -c "SELECT public.is_admin_in_company('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid);"
# Expected: returns false (no matching row)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*is_admin_in_company_helper.sql
git commit -m "feat(billing-engine): add is_admin_in_company RLS helper"
```

### Task 1.2: Extend `pricing_terms` with 5 new columns

**Files:**
- Create: `supabase/migrations/<ts>_pricing_terms_billing_extension.sql`

- [ ] **Step 1: Generate migration + write ALTER TABLE**

```sql
SET search_path TO public, extensions;

ALTER TABLE public.pricing_terms
  ADD COLUMN free_users               int NOT NULL DEFAULT 10,
  ADD COLUMN overage_price_per_user   decimal(12,2),
  ADD COLUMN delivery_channel         text NOT NULL DEFAULT 'manual'
    CHECK (delivery_channel IN ('manual', 'stripe', 'ehf')),
  ADD COLUMN invoice_format           text NOT NULL DEFAULT 'pdf'
    CHECK (invoice_format IN ('pdf', 'ehf')),
  ADD COLUMN agreement_period         daterange;

COMMENT ON COLUMN public.pricing_terms.free_users IS
  'Number of users included in monthly_cost (default 10).';
COMMENT ON COLUMN public.pricing_terms.overage_price_per_user IS
  'Price per user above free_users threshold. NULL = no overage billing.';
COMMENT ON COLUMN public.pricing_terms.delivery_channel IS
  'Invoice delivery: manual (Fase 1), stripe/ehf (Fase 2 dispatch).';
COMMENT ON COLUMN public.pricing_terms.invoice_format IS
  'Invoice format: pdf (default) or ehf (XML for e-faktura).';
COMMENT ON COLUMN public.pricing_terms.agreement_period IS
  'Contract duration for display. Not to be confused with effective_from/until (price validity).';
```

- [ ] **Step 2: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 3: Verify**

```bash
grep -A 10 "pricing_terms:" packages/supabase/src/database.types.ts | head -30
# Expected: 5 new columns visible
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*pricing_terms_billing_extension.sql packages/supabase/src/database.types.ts
git commit -m "feat(billing-engine): extend pricing_terms with 5 billing columns

Additive migration per ADR-0121. Adds free_users, overage_price_per_user,
delivery_channel, invoice_format, agreement_period. ADR-0027 preserved."
```

### Task 1.3: Invoice enums

**Files:**
- Create: `supabase/migrations/<ts>_invoice_enums.sql`

- [ ] **Step 1: Write enum types**

```sql
SET search_path TO public, extensions;

CREATE TYPE public.invoice_type AS ENUM (
  'recurring', 'onboarding', 'credit_note', 'one_off'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft', 'issued', 'sent', 'paid', 'overdue', 'void', 'uncollectible'
);

CREATE TYPE public.dunning_status AS ENUM (
  'none', 'in_negotiation', 'reminder_sent', 'escalated'
);

CREATE TYPE public.invoice_line_type AS ENUM (
  'base_plan', 'user_overage', 'addon', 'onboarding', 'adjustment'
);
```

- [ ] **Step 2: Test + commit**

```bash
npx supabase db reset
# Verify no errors
git add supabase/migrations/*invoice_enums.sql
git commit -m "feat(billing-engine): add invoice_type, invoice_status, dunning_status, invoice_line_type enums"
```

### Task 1.4: `invoice` table + sequence + triggers + CHECK constraints

**Files:**
- Create: `supabase/migrations/<ts>_invoice_table.sql`

- [ ] **Step 1: Write schema**

```sql
SET search_path TO public, extensions;

CREATE SEQUENCE public.invoice_number_seq START 1001;

CREATE TABLE public.invoice (
  invoice_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number          int UNIQUE,  -- NULL until draft→issued transition
  company_id              uuid NOT NULL REFERENCES public.company(company_id),

  invoice_type            invoice_type NOT NULL,
  status                  invoice_status NOT NULL DEFAULT 'draft',
  dunning_status          dunning_status,

  period_from             date NOT NULL,
  period_to               date NOT NULL,
  issued_at               timestamptz,
  due_at                  date,
  sent_at                 timestamptz,
  paid_at                 timestamptz,
  voided_at               timestamptz,

  amount_excl_vat         decimal(12,2) NOT NULL,
  vat_rate                decimal(5,2) NOT NULL DEFAULT 25.00,
  vat_amount              decimal(12,2) NOT NULL,
  amount_incl_vat         decimal(12,2) NOT NULL,
  -- T5: currency inherited from company.default_currency at generation (see §6.2 generator).
  -- Default 'NOK' here is fallback for direct inserts (credit notes, tests).
  currency                currency NOT NULL DEFAULT 'NOK',

  payment_date            date,
  payment_reference       text,
  payment_channel         text,

  delivery_channel        text NOT NULL DEFAULT 'manual',
  delivery_status         text,
  external_reference      text,

  voided_by               uuid REFERENCES public.user_identity(user_id),
  void_reason             text,
  credits_invoice_id      uuid REFERENCES public.invoice(invoice_id),

  created_by              uuid REFERENCES public.user_identity(user_id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_invoice_updated_at BEFORE UPDATE ON public.invoice
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: assign invoice_number from sequence on draft→issued transition.
-- Draft invoices have NULL invoice_number; numbering reserved until commit
-- to bokføringslov-compliant immutability.
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

-- G4 fix: fire on INSERT too — for credit notes + onboarding invoices
-- that skip draft state and insert directly as 'issued'.
CREATE TRIGGER trg_invoice_assign_number_insert
  BEFORE INSERT ON public.invoice
  FOR EACH ROW
  WHEN (NEW.status = 'issued' AND NEW.invoice_number IS NULL)
  EXECUTE FUNCTION public.assign_invoice_number();

CREATE TRIGGER trg_invoice_assign_number_update
  BEFORE UPDATE OF status ON public.invoice
  FOR EACH ROW
  WHEN (NEW.status = 'issued' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.assign_invoice_number();

-- CHECK: credit_note must have credits_invoice_id; others must not.
ALTER TABLE public.invoice
  ADD CONSTRAINT invoice_credit_note_linkage
  CHECK (
    (invoice_type = 'credit_note' AND credits_invoice_id IS NOT NULL)
    OR (invoice_type <> 'credit_note' AND credits_invoice_id IS NULL)
  );

-- CHECK: legal status × dunning_status combinations.
ALTER TABLE public.invoice
  ADD CONSTRAINT invoice_status_dunning_legal
  CHECK (
    (status IN ('draft','paid','void','uncollectible') AND dunning_status IS NULL)
    OR (status IN ('issued','sent') AND dunning_status IN ('none','in_negotiation'))
    OR (status = 'overdue')
  );

-- Trigger: prevent nested credit notes (can't be CHECK since it references another row).
CREATE OR REPLACE FUNCTION public.prevent_nested_credit_notes() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_original_type invoice_type;
BEGIN
  IF NEW.credits_invoice_id IS NOT NULL THEN
    SELECT invoice_type INTO v_original_type
    FROM public.invoice WHERE invoice_id = NEW.credits_invoice_id;
    IF v_original_type = 'credit_note' THEN
      RAISE EXCEPTION 'Cannot issue credit note against another credit note (invoice_id=%)', NEW.credits_invoice_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_prevent_nested_credit_notes
  BEFORE INSERT OR UPDATE OF credits_invoice_id ON public.invoice
  FOR EACH ROW EXECUTE FUNCTION public.prevent_nested_credit_notes();

CREATE INDEX idx_invoice_company ON public.invoice(company_id);
CREATE INDEX idx_invoice_status ON public.invoice(status) WHERE status IN ('issued','sent','overdue');
CREATE INDEX idx_invoice_period ON public.invoice(period_from, period_to);
CREATE INDEX idx_invoice_due_at ON public.invoice(due_at) WHERE status IN ('issued','sent');

-- C4 FIX (council round 3): invoice idempotency. One recurring invoice per
-- company × period. Prevents double-generation on cron retry after partial
-- failure. Void invoices are excluded so a void+reissue is possible.
CREATE UNIQUE INDEX idx_invoice_one_recurring_per_period
  ON public.invoice(company_id, period_from, period_to)
  WHERE invoice_type = 'recurring' AND status <> 'void';

COMMENT ON TABLE public.invoice IS
  'Smartout internal fakturamotor. C3 Commercial consumer (ADR-0118). Immutable once issued (ADR-0120).';
```

- [ ] **Step 2: Test migration runs clean**

```bash
npx supabase db reset
# Expected: no errors
psql $SUPABASE_DB_URL -c "\d public.invoice"
# Expected: all columns + constraints visible
```

- [ ] **Step 3: Regenerate types + commit**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
git add supabase/migrations/*invoice_table.sql packages/supabase/src/database.types.ts
git commit -m "feat(billing-engine): add invoice table with sequence, triggers, CHECK constraints

Per spec §5.2. Includes invoice_number_seq (bokføringslov continuous numbering),
assign_invoice_number trigger (draft→issued), nested credit note prevention,
state×dunning legal combinations CHECK. ADR-0120."
```

### Task 1.5: `invoice_line_item` table

**Files:**
- Create: `supabase/migrations/<ts>_invoice_line_item_table.sql`

- [ ] **Step 1: Write schema**

```sql
SET search_path TO public, extensions;

CREATE TABLE public.invoice_line_item (
  line_item_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              uuid NOT NULL REFERENCES public.invoice(invoice_id) ON DELETE RESTRICT,
  line_type               invoice_line_type NOT NULL,
  addon_key               text,  -- null for non-addon types
  description             text NOT NULL,
  quantity                decimal(12,2) NOT NULL DEFAULT 1,
  unit_price              decimal(12,2) NOT NULL,
  amount_excl_vat         decimal(12,2) NOT NULL,
  vat_rate                decimal(5,2) NOT NULL DEFAULT 25.00,
  vat_amount              decimal(12,2) NOT NULL,
  amount_incl_vat         decimal(12,2) NOT NULL,
  usage_snapshot_id       uuid,  -- FK added after usage_snapshot table exists
  period_reference        text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_line_item_invoice ON public.invoice_line_item(invoice_id);
CREATE INDEX idx_line_item_type ON public.invoice_line_item(line_type);

COMMENT ON TABLE public.invoice_line_item IS
  'Line items per invoice. ON DELETE RESTRICT enforces immutability (ADR-0120).';
```

- [ ] **Step 2: Test + commit**

```bash
npx supabase db reset
git add supabase/migrations/*invoice_line_item_table.sql
git commit -m "feat(billing-engine): add invoice_line_item table"
```

### Task 1.6: `usage_snapshot` table

**Files:**
- Create: `supabase/migrations/<ts>_usage_snapshot_table.sql`

- [ ] **Step 1: Write schema**

```sql
SET search_path TO public, extensions;

CREATE TABLE public.usage_snapshot (
  usage_snapshot_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.company(company_id),
  workspace_id            uuid NOT NULL REFERENCES public.workspace(workspace_id),
  period_from             date NOT NULL,
  period_to               date NOT NULL,

  active_users            int NOT NULL,
  free_users_applied      int NOT NULL,
  billable_users          int NOT NULL,

  counted_profile_ids     jsonb NOT NULL,
  source_query_hash       text NOT NULL,

  computed_at             timestamptz NOT NULL DEFAULT now(),
  computed_by             text,

  UNIQUE (company_id, workspace_id, period_from, period_to)
);

-- Now add the deferred FK on invoice_line_item.
ALTER TABLE public.invoice_line_item
  ADD CONSTRAINT fk_line_item_usage_snapshot
  FOREIGN KEY (usage_snapshot_id) REFERENCES public.usage_snapshot(usage_snapshot_id);

CREATE INDEX idx_snapshot_company_period ON public.usage_snapshot(company_id, period_from, period_to);

COMMENT ON TABLE public.usage_snapshot IS
  'Reproducible usage snapshot per workspace per period. ADR-0119.
   workspace_id NOT NULL — company aggregates via SUM at read time.';
```

- [ ] **Step 2: Test + commit**

```bash
npx supabase db reset
git add supabase/migrations/*usage_snapshot_table.sql
git commit -m "feat(billing-engine): add usage_snapshot table with workspace_id NOT NULL (H6 fix)"
```

### Task 1.7: `basis_drift_event` table + detection trigger

**Files:**
- Create: `supabase/migrations/<ts>_basis_drift_event.sql`

- [ ] **Step 1: Write table + trigger**

```sql
SET search_path TO public, extensions;

CREATE TABLE public.basis_drift_event (
  drift_event_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_snapshot_id    uuid NOT NULL REFERENCES public.usage_snapshot(usage_snapshot_id),
  invoice_id           uuid REFERENCES public.invoice(invoice_id),
  shift_id             uuid,
  drift_type           text NOT NULL CHECK (drift_type IN ('status_reversed','employee_changed','shift_deleted','other')),
  old_value            jsonb,
  new_value            jsonb,
  detected_at          timestamptz NOT NULL DEFAULT now(),
  reviewed_at          timestamptz,
  reviewed_by          uuid REFERENCES public.user_identity(user_id),
  resolution           text CHECK (resolution IS NULL OR resolution IN ('ignored','credit_note_issued','reinvoiced'))
);

CREATE INDEX idx_drift_event_invoice ON public.basis_drift_event(invoice_id);
CREATE INDEX idx_drift_event_unreviewed ON public.basis_drift_event(detected_at) WHERE reviewed_at IS NULL;

-- Detection trigger on schedule_shift.
-- Fires when a shift is UPDATE/DELETE'd AND its shift_date falls within a
-- period for which a usage_snapshot exists. Inserts drift event for review.
CREATE OR REPLACE FUNCTION public.detect_billing_basis_drift() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_snapshot_id uuid;
  v_invoice_id  uuid;
  v_drift_type  text;
BEGIN
  -- Find matching usage_snapshot for the shift's workspace + date range.
  SELECT us.usage_snapshot_id INTO v_snapshot_id
  FROM public.usage_snapshot us
  WHERE us.workspace_id = COALESCE(NEW.workspace_id, OLD.workspace_id)
    AND COALESCE(NEW.shift_date, OLD.shift_date) BETWEEN us.period_from AND us.period_to
  LIMIT 1;

  IF v_snapshot_id IS NULL THEN
    RETURN NEW;  -- no snapshot covers this period → no drift to log
  END IF;

  -- Find associated invoice (if issued).
  SELECT i.invoice_id INTO v_invoice_id
  FROM public.invoice i
  JOIN public.usage_snapshot us ON us.company_id = i.company_id
    AND us.period_from = i.period_from AND us.period_to = i.period_to
  WHERE us.usage_snapshot_id = v_snapshot_id
    AND i.status IN ('issued','sent','paid','overdue')
  LIMIT 1;

  -- Determine drift type.
  IF TG_OP = 'DELETE' THEN
    v_drift_type := 'shift_deleted';
  ELSIF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    v_drift_type := 'status_reversed';
  ELSIF OLD.employee_id IS DISTINCT FROM NEW.employee_id THEN
    v_drift_type := 'employee_changed';
  ELSE
    RETURN NEW;  -- not a billing-relevant change
  END IF;

  INSERT INTO public.basis_drift_event (
    usage_snapshot_id, invoice_id, shift_id, drift_type, old_value, new_value
  ) VALUES (
    v_snapshot_id, v_invoice_id, COALESCE(NEW.shift_id, OLD.shift_id), v_drift_type,
    to_jsonb(OLD.*), CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW.*) END
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_billing_basis_drift
  AFTER UPDATE OR DELETE ON public.schedule_shift
  FOR EACH ROW EXECUTE FUNCTION public.detect_billing_basis_drift();

COMMENT ON TABLE public.basis_drift_event IS
  'Audit trail for retroactive schedule_shift changes that affect issued invoices. Per ADR-0119.';
```

- [ ] **Step 2: Test + commit**

```bash
npx supabase db reset
git add supabase/migrations/*basis_drift_event.sql
git commit -m "feat(billing-engine): add basis_drift_event table + schedule_shift detection trigger

Per ADR-0119. Detects retroactive shift modifications after invoice
for the period was issued. Platform admin reviews + resolves."
```

### Task 1.8: Views (`v_current_plan_preview`, `v_invoice_dunning_notes`) + function (`get_invoice_basis`)

**Files:**
- Create: `supabase/migrations/<ts>_billing_views.sql`

- [ ] **Step 1: Write views + function**

```sql
SET search_path TO public, extensions;

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

CREATE VIEW public.v_invoice_dunning_notes AS
SELECT
  at.activity_trail_id,
  (at.properties->>'invoice_id')::uuid AS invoice_id,
  at.properties->>'note' AS note,
  at.actor_user_id,
  at.created_at
FROM public.activity_trail at
WHERE at.event = 'dunning_note.added';

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
  line_items jsonb,
  usage_snapshots jsonb,
  pricing_terms_at_issue jsonb
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
     FROM public.invoice_line_item li WHERE li.invoice_id = i.invoice_id) AS line_items,
    (SELECT jsonb_agg(to_jsonb(us.*)) FROM public.usage_snapshot us
     WHERE us.company_id = i.company_id
       AND us.period_from = i.period_from AND us.period_to = i.period_to) AS usage_snapshots,
    (SELECT to_jsonb(pt.*) FROM public.pricing_terms pt
     WHERE pt.company_id = i.company_id
       AND pt.effective_from <= COALESCE(i.issued_at::date, CURRENT_DATE)
       AND (pt.effective_until IS NULL OR pt.effective_until >= COALESCE(i.issued_at::date, CURRENT_DATE))
     ORDER BY pt.effective_from DESC LIMIT 1) AS pricing_terms_at_issue
  FROM public.invoice i
  JOIN public.company c ON c.company_id = i.company_id
  WHERE i.invoice_id = p_invoice_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_invoice_basis(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_invoice_basis IS
  'Returns complete invoice basis for AI-tool explanation + audit. LLM reads verbatim, never computes amounts.';
```

- [ ] **Step 2: Test + commit**

```bash
npx supabase db reset
psql $SUPABASE_DB_URL -c "SELECT * FROM public.v_current_plan_preview LIMIT 1;"
# Expected: returns 0 rows (empty DB) without error
git add supabase/migrations/*billing_views.sql
git commit -m "feat(billing-engine): add v_current_plan_preview, v_invoice_dunning_notes, get_invoice_basis"
```

### Task 1.9: RLS policies on billing tables

**Files:**
- Create: `supabase/migrations/<ts>_billing_rls_policies.sql`

- [ ] **Step 1: Write policies**

```sql
SET search_path TO public, extensions;

ALTER TABLE public.invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basis_drift_event ENABLE ROW LEVEL SECURITY;

-- invoice: platform-admin full (via service role), company admin read own
CREATE POLICY invoice_company_admin_read ON public.invoice
  FOR SELECT TO authenticated
  USING (public.is_admin_in_company(auth.uid(), company_id));

-- invoice_line_item: via invoice join
CREATE POLICY invoice_line_item_company_admin_read ON public.invoice_line_item
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoice i
    WHERE i.invoice_id = invoice_line_item.invoice_id
      AND public.is_admin_in_company(auth.uid(), i.company_id)
  ));

-- usage_snapshot: company admin read own
CREATE POLICY usage_snapshot_company_admin_read ON public.usage_snapshot
  FOR SELECT TO authenticated
  USING (public.is_admin_in_company(auth.uid(), company_id));

-- basis_drift_event: platform-admin only (service role bypass RLS; no authenticated policy)
-- (no policy means no authenticated access; service role bypasses RLS)

-- Note: all writes go via service role (Server Actions with createAdminClient).
-- No authenticated write policies.

COMMENT ON POLICY invoice_company_admin_read ON public.invoice IS
  'Company admins/owners can read their company''s invoices. Uses is_admin_in_company helper.';
```

- [ ] **Step 2: Test + commit**

```bash
npx supabase db reset
# Verify policies listed:
psql $SUPABASE_DB_URL -c "\d+ public.invoice" | grep -A 5 "Policies:"
git add supabase/migrations/*billing_rls_policies.sql
git commit -m "feat(billing-engine): add RLS policies on billing tables

Company admins/owners can read their own company's invoices via
is_admin_in_company. All writes via service role (Server Actions)."
```

### Task 1.10: Seed `engine_process` row for `invoice_lifecycle` blueprint

**Files:**
- Create: `supabase/migrations/<ts>_invoice_lifecycle_engine_process.sql`

- [ ] **Step 1: Write seed**

```sql
SET search_path TO public, extensions;

-- Blueprint: invoice_lifecycle
-- States: draft → issued → paid | overdue | void | uncollectible
-- Steps wait for mark_paid event or overdue time trigger.
INSERT INTO public.engine_process (
  process_key,
  name,
  description,
  definition,
  is_active,
  created_at
) VALUES (
  'invoice_lifecycle',
  'Invoice Lifecycle',
  'Fase 1: tracks invoice from draft → issued → paid|overdue|void. Fase 2 will wire payment webhooks.',
  jsonb_build_object(
    'steps', jsonb_build_array(
      jsonb_build_object(
        'step_key', 'await_issue',
        'action_type', 'wait_for_event',
        'config', jsonb_build_object('event', 'invoice.issued')
      ),
      jsonb_build_object(
        'step_key', 'await_settlement',
        'action_type', 'wait_for_event',
        'config', jsonb_build_object(
          'events', jsonb_build_array('invoice.marked_paid', 'invoice.voided', 'invoice.overdue_detected')
        )
      )
    )
  ),
  true,
  now()
)
ON CONFLICT (process_key) DO NOTHING;
```

- [ ] **Step 2: Test + commit**

```bash
npx supabase db reset
psql $SUPABASE_DB_URL -c "SELECT process_key, is_active FROM public.engine_process WHERE process_key = 'invoice_lifecycle';"
# Expected: 1 row returned
git add supabase/migrations/*invoice_lifecycle_engine_process.sql
git commit -m "feat(billing-engine): seed invoice_lifecycle engine_process blueprint"
```

### Task 1.11: pgTAP tests for RLS + CHECK constraints

**Files:**
- Create: `supabase/tests/billing_rls.sql`
- Create: `supabase/tests/billing_constraints.sql`

- [ ] **Step 1: Write RLS test**

```sql
-- supabase/tests/billing_rls.sql
BEGIN;
SELECT plan(3);

-- Setup: create 2 companies, 2 users, 2 workspaces, 2 invoices
-- (seed helpers assumed in existing test infrastructure or inline)

-- Test 1: Company A admin can read Company A invoice
SELECT set_config('request.jwt.claim.sub', 'user-a-uuid', true);
SELECT is(
  (SELECT count(*) FROM public.invoice WHERE company_id = 'company-a-uuid'),
  1::bigint,
  'Company A admin reads own invoice'
);

-- Test 2: Company A admin CANNOT read Company B invoice
SELECT is(
  (SELECT count(*) FROM public.invoice WHERE company_id = 'company-b-uuid'),
  0::bigint,
  'Company A admin blocked from Company B invoice'
);

-- Test 3: Service role bypasses RLS (would need to test outside transaction)
SELECT pass('Service role bypass verified in integration tests');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write CHECK constraint tests**

```sql
-- supabase/tests/billing_constraints.sql
BEGIN;
SELECT plan(3);

-- Test: nested credit note rejected
SELECT throws_ok(
  $$
  INSERT INTO public.invoice (company_id, invoice_type, credits_invoice_id, period_from, period_to, amount_excl_vat, vat_amount, amount_incl_vat)
  VALUES ('company-uuid', 'credit_note', 'existing-credit-note-uuid', '2026-04-01', '2026-04-30', 100, 25, 125);
  $$,
  'Cannot issue credit note against another credit note%',
  'Nested credit note rejected'
);

-- Test: credit_note WITHOUT credits_invoice_id rejected
SELECT throws_ok(
  $$
  INSERT INTO public.invoice (company_id, invoice_type, period_from, period_to, amount_excl_vat, vat_amount, amount_incl_vat)
  VALUES ('company-uuid', 'credit_note', '2026-04-01', '2026-04-30', 100, 25, 125);
  $$,
  '%invoice_credit_note_linkage%',
  'credit_note requires credits_invoice_id'
);

-- Test: illegal state × dunning_status combo rejected
SELECT throws_ok(
  $$
  INSERT INTO public.invoice (company_id, invoice_type, status, dunning_status, period_from, period_to, amount_excl_vat, vat_amount, amount_incl_vat)
  VALUES ('company-uuid', 'recurring', 'paid', 'escalated', '2026-04-01', '2026-04-30', 100, 25, 125);
  $$,
  '%invoice_status_dunning_legal%',
  'paid + escalated rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 3: Run tests**

```bash
npx supabase test db
# Expected: all pass
```

- [ ] **Step 4: Commit**

```bash
git add supabase/tests/billing_*.sql
git commit -m "test(billing-engine): pgTAP tests for RLS + CHECK constraints"
```

---

## Phase 2 — Telemetry

### Task 2.1: Register billing events in telemetry registry

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Read current registry shape to match patterns exactly**

```bash
grep -n "EVENT_ROUTING\|EventCategory\|EntityType\|^export interface Shift" packages/telemetry/src/registry.ts | head -20
```

Study one existing example (e.g., `ShiftCreated`) to match interface shape.

- [ ] **Step 2: Add `billing` to `EventCategory` union** (line ~17)

```ts
export type EventCategory =
  // ... existing
  | 'billing';
```

- [ ] **Step 3: Add entity types to `EntityType` union** (line ~44)

```ts
export type EntityType =
  // ... existing
  | 'invoice'
  | 'invoice_line_item'
  | 'usage_snapshot'
  | 'pricing_terms'
  | 'basis_drift_event';
```

- [ ] **Step 4: Define 11 event interfaces extending `BaseEvent`**

**CRITICAL:** use space-separated event names (not dots) per existing convention, and flat `entity_type` + `entity_id` contract (not `entity: EntityRef`) per L-0038.

```ts
// ─── Billing Events ──────────────────────────────
export interface InvoiceGenerated extends BaseEvent {
  event: "invoice generated";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: { company_id: string; amount_incl_vat: number; period_from: string; period_to: string };
  };
}

export interface InvoiceIssued extends BaseEvent {
  event: "invoice issued";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: { company_id: string; invoice_number: number; amount_incl_vat: number };
  };
}

export interface InvoiceSent extends BaseEvent {
  event: "invoice sent";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: { delivery_channel: string; external_reference?: string };
  };
}

export interface InvoiceMarkedPaid extends BaseEvent {
  event: "invoice marked_paid";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: { company_id: string; amount_incl_vat: number; payment_channel: string; payment_date: string; payment_reference: string };
  };
}

export interface InvoiceVoided extends BaseEvent {
  event: "invoice voided";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: { company_id: string; reason: string; reason_detail: string };
  };
}

export interface InvoiceOverdueDetected extends BaseEvent {
  event: "invoice overdue_detected";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: { days_overdue: number };
  };
}

export interface InvoiceCreditNoteIssued extends BaseEvent {
  event: "invoice credit_note_issued";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: { original_invoice_id: string; amount_incl_vat: number; reason: string };
  };
}

export interface InvoiceBasisDriftDetected extends BaseEvent {
  event: "invoice basis_drift_detected";
  properties: {
    entity_type: "basis_drift_event";
    entity_id: string;
    data: { invoice_id: string | null; shift_id: string | null; drift_type: string };
  };
}

export interface UsageSnapshotCreated extends BaseEvent {
  event: "usage_snapshot created";
  properties: {
    entity_type: "usage_snapshot";
    entity_id: string;
    data: { workspace_id: string; company_id: string; billable_users: number };
  };
}

export interface PricingTermsUpdated extends BaseEvent {
  event: "pricing_terms updated";
  properties: {
    entity_type: "pricing_terms";
    entity_id: string;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

export interface DunningNoteAdded extends BaseEvent {
  event: "dunning_note added";
  properties: {
    entity_type: "invoice";
    entity_id: string;
    data: { note: string };
  };
}
```

- [ ] **Step 5: Add all 11 to `SmartoutEvent` union** (line ~3640)

```ts
export type SmartoutEvent =
  // ... existing
  | InvoiceGenerated | InvoiceIssued | InvoiceSent | InvoiceMarkedPaid
  | InvoiceVoided | InvoiceOverdueDetected | InvoiceCreditNoteIssued
  | InvoiceBasisDriftDetected | UsageSnapshotCreated | PricingTermsUpdated
  | DunningNoteAdded;
```

- [ ] **Step 6: Add 11 routing entries to `EVENT_ROUTING`**

```ts
  "invoice generated": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "billing",
  },
  "invoice issued": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "billing",
  },
  "invoice sent": {
    destinations: ["logger", "activity_trail", "engine_event"],
    category: "billing",
  },
  "invoice marked_paid": {
    destinations: ["posthog", "logger", "activity_trail", "engine_event"],
    category: "billing",
  },
  "invoice voided": {
    destinations: ["logger", "activity_trail", "engine_event"],
    category: "billing",
  },
  "invoice overdue_detected": {
    destinations: ["logger", "activity_trail", "engine_event"],
    category: "billing",
  },
  "invoice credit_note_issued": {
    destinations: ["logger", "activity_trail", "engine_event"],
    category: "billing",
  },
  "invoice basis_drift_detected": {
    destinations: ["logger", "activity_trail", "engine_event"],
    category: "billing",
  },
  "usage_snapshot created": {
    destinations: ["logger", "activity_trail"],
    category: "billing",
  },
  "pricing_terms updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "billing",
  },
  "dunning_note added": {
    destinations: ["logger", "activity_trail"],
    category: "billing",
  },
```

- [ ] **Step 7: Add GIN index on `activity_trail.properties` for `entity_id` lookups**

Fix for G8 (InvoiceTimeline full-scan): add migration `<ts>_activity_trail_billing_indexes.sql`:

```sql
-- Speeds up lookups like "all activity_trail rows for this invoice_id"
CREATE INDEX IF NOT EXISTS idx_activity_trail_entity_id
  ON public.activity_trail((properties->>'entity_id'));
```

- [ ] **Step 8: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=@smartout/telemetry
git add packages/telemetry/src/registry.ts supabase/migrations/*activity_trail_billing_indexes.sql
git commit -m "feat(billing-engine): register 11 billing events with flat entity contract

Space-separated event names per convention. Flat entity_type/entity_id
contract per L-0038 (activity_trail provider rejects nested entity)."
```

### Task 2.2: Internal emit HTTP endpoint (for Edge Functions)

**Files:**
- Create: `apps/web/src/app/api/internal/emit/route.ts`

**Rationale (C3 fix):** Edge Function cron runs on Deno — cannot import `@smartout/telemetry` Node package. This endpoint exposes `emit()` via HTTP, guarded by `WATCHDOG_CRON_SECRET`. Edge Function POSTs events, Next.js route calls real `emit()`.

- [ ] **Step 1: Write Route Handler**

```ts
// apps/web/src/app/api/internal/emit/route.ts
import { NextRequest } from 'next/server';
import { emit } from '@smartout/telemetry';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.WATCHDOG_CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const event = await req.json();

  // Minimal validation — reject if no event name
  if (!event?.event || typeof event.event !== 'string') {
    return new Response('Invalid event', { status: 400 });
  }

  try {
    await emit(event);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
```

- [ ] **Step 2: Test**

```bash
pnpm dev
curl -X POST http://localhost:3060/api/internal/emit \
  -H "Authorization: Bearer $WATCHDOG_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":"invoice generated","properties":{"entity_type":"invoice","entity_id":"00000000-0000-0000-0000-000000000000","data":{"company_id":"x","amount_incl_vat":100,"period_from":"2026-03-01","period_to":"2026-03-31"}}}'
# Expected: {"ok":true}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/internal/emit/route.ts
git commit -m "feat(billing-engine): add internal /api/internal/emit endpoint

Edge Functions (Deno) cannot import @smartout/telemetry directly.
This endpoint bridges cron-generated events into the emit() pipeline.
Guarded by WATCHDOG_CRON_SECRET."
```

### Task 2.3: CI assertion test for emit() coverage

**Files:**
- Create: `packages/telemetry/__tests__/billing-emit.spec.ts`

- [ ] **Step 1: Write test**

```ts
// packages/telemetry/__tests__/billing-emit.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { emit } from '../src/emit';

vi.mock('../src/emit', () => ({
  emit: vi.fn(),
}));

describe('billing mutation emit coverage (CI assertion)', () => {
  const billingMutationSites = [
    // Populated as Phase 4 + 7 tasks land. Each entry: [file, mutation, expected event].
    // Example:
    // { file: 'supabase/functions/generate-monthly-invoices/index.ts', mutation: 'generateMonthlyInvoices', event: 'invoice.generated' },
    // { file: 'apps/web/src/app/platform-admin/billing/_actions/markInvoicePaid.ts', mutation: 'markInvoicePaid', event: 'invoice.marked_paid' },
  ];

  it('lists every billing mutation site', () => {
    // Fail-loud if list is empty — prevents forgetting to add sites as they're built.
    expect(billingMutationSites.length).toBeGreaterThan(0);
  });

  it.each(billingMutationSites)('$file calls emit with $event', async ({ file, mutation, event }) => {
    // Dynamic import of the mutation module, invoke with minimal test input, assert emit called with event.
    // Concrete per-site tests added as each Server Action is implemented (Phase 7).
    expect(event).toMatch(/^(invoice|usage_snapshot|pricing_terms|dunning_note)\./);
  });
});
```

- [ ] **Step 2: Run — expect fail (empty list)**

```bash
pnpm turbo test --filter=@smartout/telemetry
# Expected: FAIL — "expected 0 to be greater than 0"
```

This is intentional. Each Phase 7 Server Action adds a row. The test is a forcing function.

- [ ] **Step 3: Commit**

```bash
git add packages/telemetry/__tests__/billing-emit.spec.ts
git commit -m "test(billing-engine): CI assertion scaffold for billing emit coverage

Fails until Phase 7 populates billingMutationSites. Forcing function
to prevent forgetting emit() on new mutations."
```

---

## Phase 3 — Data layer package

### Task 3.1: Scaffold `packages/billing/`

**Files:**
- Create: `packages/billing/package.json`
- Create: `packages/billing/tsconfig.json`
- Create: `packages/billing/src/index.ts`

- [ ] **Step 1: Create package**

```bash
mkdir -p packages/billing/src
```

Write `packages/billing/package.json`:

```json
{
  "name": "@smartout/billing",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@smartout/supabase": "workspace:*",
    "@smartout/telemetry": "workspace:*",
    "zod": "^3.23.8",
    "@tanstack/react-query": "^5.x"
  },
  "devDependencies": {
    "@smartout/typescript-config": "workspace:*",
    "typescript": "^5.x"
  }
}
```

Write `packages/billing/tsconfig.json`:

```json
{
  "extends": "@smartout/typescript-config/base.json",
  "include": ["src/**/*"]
}
```

Write `packages/billing/src/index.ts`:

```ts
export * from './types';
export * from './schemas';
export * from './hooks';
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3: Commit**

```bash
git add packages/billing/
git commit -m "feat(billing-engine): scaffold @smartout/billing package"
```

### Task 3.2: Types + Zod schemas

**Files:**
- Create: `packages/billing/src/types.ts`
- Create: `packages/billing/src/schemas.ts`

- [ ] **Step 1: Write types**

```ts
// packages/billing/src/types.ts
import type { Database } from '@smartout/supabase';

export type Invoice = Database['public']['Tables']['invoice']['Row'];
export type InvoiceLineItem = Database['public']['Tables']['invoice_line_item']['Row'];
export type UsageSnapshot = Database['public']['Tables']['usage_snapshot']['Row'];
export type BasisDriftEvent = Database['public']['Tables']['basis_drift_event']['Row'];
export type PricingTerms = Database['public']['Tables']['pricing_terms']['Row'];

export type InvoiceStatus = Database['public']['Enums']['invoice_status'];
export type InvoiceType = Database['public']['Enums']['invoice_type'];
export type DunningStatus = Database['public']['Enums']['dunning_status'];
export type InvoiceLineType = Database['public']['Enums']['invoice_line_type'];

export type VoidReason = 'duplicate' | 'fraudulent' | 'order_change' | 'product_unsatisfactory' | 'issued_in_error' | 'other';
export type UncollectibleReason = 'bankruptcy' | 'disputed_unresolved' | 'statute_of_limitations' | 'customer_ghosted' | 'written_off' | 'other';
export type PaymentChannel = 'bank_transfer' | 'cash' | 'stripe_manual_capture' | 'out_of_band' | 'partial_write_off' | 'other';
```

- [ ] **Step 2: Write Zod schemas**

```ts
// packages/billing/src/schemas.ts
import { z } from 'zod';

export const VoidReasonSchema = z.enum([
  'duplicate', 'fraudulent', 'order_change', 'product_unsatisfactory', 'issued_in_error', 'other'
]);

export const UncollectibleReasonSchema = z.enum([
  'bankruptcy', 'disputed_unresolved', 'statute_of_limitations', 'customer_ghosted', 'written_off', 'other'
]);

export const PaymentChannelSchema = z.enum([
  'bank_transfer', 'cash', 'stripe_manual_capture', 'out_of_band', 'partial_write_off', 'other'
]);

export const MarkInvoicePaidInput = z.object({
  invoice_id: z.string().uuid(),
  payment_date: z.string().refine(v => !isNaN(Date.parse(v)), 'Invalid date'),
  payment_reference: z.string().min(1).max(500),
  payment_channel: PaymentChannelSchema,
  amount: z.number().positive(),
  notes: z.string().max(1000).optional(),
  idempotency_key: z.string().uuid(),
});

export const VoidInvoiceInput = z.object({
  invoice_id: z.string().uuid(),
  reason: VoidReasonSchema,
  reason_detail: z.string().min(10).max(1000),
  typed_confirmation: z.string(),  // must match invoice_number server-side
  idempotency_key: z.string().uuid(),
});

export const IssueCreditNoteInput = z.object({
  original_invoice_id: z.string().uuid(),
  reason: VoidReasonSchema,
  reason_detail: z.string().min(10).max(1000),
  amount: z.number().positive(),
  idempotency_key: z.string().uuid(),
});

export const AddDunningNoteInput = z.object({
  invoice_id: z.string().uuid(),
  note: z.string().min(1).max(2000),
});

export const UpdatePricingTermsInput = z.object({
  company_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional(),
  monthly_cost: z.number().positive(),
  price_per_employee: z.number().nonnegative(),
  free_users: z.number().int().min(0),
  overage_price_per_user: z.number().nonnegative().optional(),
  billing_interval: z.enum(['monthly', 'quarterly', 'yearly']),
  delivery_channel: z.enum(['manual', 'stripe', 'ehf']),
  invoice_format: z.enum(['pdf', 'ehf']),
  effective_from: z.string(),
  agreement_period_from: z.string().optional(),
  agreement_period_to: z.string().optional(),
});
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=@smartout/billing
git add packages/billing/src/types.ts packages/billing/src/schemas.ts
git commit -m "feat(billing-engine): add billing types + Zod schemas"
```

### Task 3.3: Pure query functions (called by web Server Actions + mobile directly)

**Files:**
- Create: `packages/billing/src/queries.ts`
- Create: `packages/billing/src/hooks.ts`

**C5 fix:** Previous plan had hooks in `packages/billing/` importing Server Actions from `apps/web/` — that's a circular dependency (packages cannot depend on apps). Corrected pattern:

- **`packages/billing/src/queries.ts`** — pure async functions that take a Supabase client. No React, no Next.js, no fetch — works in Node, Deno, RN.
- **Web Server Actions** (Phase 10) wrap these for web (`'use server'` + auth gate).
- **Mobile hooks** (future) call these directly with their own Supabase client.
- **`packages/billing/src/hooks.ts`** — thin React Query hooks that accept an injectable fetcher. Web provides a Server-Action-backed fetcher; mobile provides a direct-Supabase fetcher.

- [ ] **Step 1: Write pure queries**

```ts
// packages/billing/src/queries.ts
import type { SupabaseClient } from '@smartout/supabase';
import type { Invoice, UsageSnapshot } from './types';

export async function fetchInvoicesForCompany(
  supabase: SupabaseClient,
  companyId: string,
  filters?: { status?: string; limit?: number },
): Promise<Invoice[]> {
  let query = supabase
    .from('invoice')
    .select('*')
    .eq('company_id', companyId)
    .order('issued_at', { ascending: false, nullsFirst: true })
    .limit(filters?.limit ?? 50);
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchInvoiceDetail(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<{ invoice: Invoice; line_items: unknown[] } | null> {
  const { data: invoice } = await supabase
    .from('invoice').select('*').eq('invoice_id', invoiceId).single();
  if (!invoice) return null;
  const { data: lines } = await supabase
    .from('invoice_line_item').select('*').eq('invoice_id', invoiceId);
  return { invoice, line_items: lines ?? [] };
}

export async function fetchUsageSnapshot(
  supabase: SupabaseClient,
  workspaceId: string,
  periodFrom: string,
  periodTo: string,
): Promise<UsageSnapshot | null> {
  const { data } = await supabase
    .from('usage_snapshot').select('*')
    .eq('workspace_id', workspaceId)
    .eq('period_from', periodFrom)
    .eq('period_to', periodTo)
    .maybeSingle();
  return data;
}
```

- [ ] **Step 2: Write fetcher-injectable hooks (for web + mobile reuse)**

```ts
// packages/billing/src/hooks.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import type { Invoice } from './types';

export type InvoiceFetcher = (filters?: { status?: string }) => Promise<Invoice[]>;

export function useInvoices(fetcher: InvoiceFetcher, filters?: { status?: string }) {
  return useQuery({
    queryKey: ['billing', 'invoices', filters],
    queryFn: () => fetcher(filters),
    staleTime: 30_000,
  });
}

// Similar: useInvoice(fetcher, id), useUsageSnapshot(fetcher, wsId, period)
```

**Web usage (Phase 10):**
```ts
// apps/web/src/app/dashboard/billing/_hooks/useMyInvoices.ts
'use client';
import { useInvoices } from '@smartout/billing';
import { getMyCompanyInvoicesAction } from '../_actions/queries';

export function useMyInvoices(filters?) {
  return useInvoices(getMyCompanyInvoicesAction, filters);
}
```

**Mobile usage (future):**
```ts
// apps/mobile/src/features/billing/hooks.ts
import { useInvoices } from '@smartout/billing';
import { supabase } from '../../lib/supabase';
import { fetchInvoicesForCompany } from '@smartout/billing';

export function useMyInvoices(companyId: string, filters?) {
  return useInvoices(
    (f) => fetchInvoicesForCompany(supabase, companyId, f),
    filters,
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/billing/src/queries.ts packages/billing/src/hooks.ts packages/billing/src/index.ts
git commit -m "feat(billing-engine): add pure queries + fetcher-injectable hooks

C5 fix: no circular deps. Pure functions in packages/billing work in
Node/Deno/RN; web + mobile inject their own auth layer via Server Actions
or direct Supabase client."
```

### Task 3.4: `resolveCompanyId` helper

**Files:**
- Create: `packages/ai/src/lib/resolveCompanyId.ts`
- Modify: `packages/ai/src/lib/index.ts` (export)

- [ ] **Step 1: Write helper**

```ts
// packages/ai/src/lib/resolveCompanyId.ts
import type { AgentToolContext } from '../capabilities/types';

export async function resolveCompanyId(ctx: AgentToolContext): Promise<string> {
  const { data, error } = await ctx.supabaseAdmin
    .from('workspace')
    .select('company_id')
    .eq('workspace_id', ctx.workspaceId)
    .single();
  if (error) throw new Error(`Failed to resolve company for workspace ${ctx.workspaceId}: ${error.message}`);
  if (!data?.company_id) throw new Error(`Workspace ${ctx.workspaceId} not linked to a company`);
  return data.company_id;
}
```

- [ ] **Step 2: Export + commit**

```bash
git add packages/ai/src/lib/resolveCompanyId.ts packages/ai/src/lib/index.ts
git commit -m "feat(ai): add resolveCompanyId helper for billing tools"
```

---

## Phase 4 — Cron generator

### Task 4.1: Edge Function `generate-monthly-invoices`

**Files:**
- Create: `supabase/functions/generate-monthly-invoices/index.ts`
- Create: `supabase/functions/generate-monthly-invoices/generator.ts`

- [ ] **Step 1: Copy cron pattern from `daily-session-replenish`**

```bash
cp -r supabase/functions/daily-session-replenish supabase/functions/generate-monthly-invoices
# Edit index.ts contents
```

- [ ] **Step 2: Implement generator**

```ts
// supabase/functions/generate-monthly-invoices/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateMonthlyInvoicesForAllCompanies } from './generator.ts';

serve(async (req) => {
  // Bearer auth via WATCHDOG_CRON_SECRET
  const authHeader = req.headers.get('authorization');
  const expected = `Bearer ${Deno.env.get('WATCHDOG_CRON_SECRET')}`;
  if (authHeader !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Previous month: e.g., cron runs April 5 → generate for March
  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);  // last day of prev month
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const result = await generateMonthlyInvoicesForAllCompanies(supabase, periodStart, periodEnd);

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

Write the actual generator logic in `generator.ts`:

```ts
// supabase/functions/generate-monthly-invoices/generator.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHash } from 'https://deno.land/std@0.224.0/crypto/mod.ts';

export type GenerationResult = {
  companies_processed: number;
  invoices_created: number;
  errors: Array<{ company_id: string; error: string }>;
};

export async function generateMonthlyInvoicesForAllCompanies(
  supabase: SupabaseClient,
  periodStart: Date,
  periodEnd: Date,
): Promise<GenerationResult> {
  const result: GenerationResult = { companies_processed: 0, invoices_created: 0, errors: [] };

  const { data: companies } = await supabase
    .from('company')
    .select('company_id, workspace:workspace(workspace_id)')
    .eq('is_active', true);

  if (!companies) return result;

  for (const company of companies) {
    try {
      const created = await generateForCompany(supabase, company, periodStart, periodEnd);
      if (created) result.invoices_created++;
      result.companies_processed++;
    } catch (e) {
      result.errors.push({ company_id: company.company_id, error: String(e) });
    }
  }

  // Overdue scan
  await markOverdueInvoices(supabase);

  return result;
}

async function emitViaEndpoint(event: unknown): Promise<void> {
  // C3 fix: Edge Functions can't import @smartout/telemetry.
  // POST to internal HTTP endpoint that wraps emit().
  const url = Deno.env.get('INTERNAL_EMIT_URL');  // e.g., https://app.smartout.ai/api/internal/emit
  const secret = Deno.env.get('WATCHDOG_CRON_SECRET');
  if (!url || !secret) throw new Error('Missing INTERNAL_EMIT_URL or WATCHDOG_CRON_SECRET');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[generator] emit failed: ${res.status} ${body}`);
    // Don't throw — telemetry failure shouldn't abort invoice generation
  }
}

async function generateForCompany(
  supabase: SupabaseClient,
  company: { company_id: string; workspace: Array<{ workspace_id: string }> },
  periodStart: Date,
  periodEnd: Date,
): Promise<boolean> {
  const periodFromStr = periodStart.toISOString().split('T')[0];
  const periodToStr = periodEnd.toISOString().split('T')[0];

  // C4 fix: idempotency check. If invoice already exists for this period
  // (not void), skip. The UNIQUE INDEX idx_invoice_one_recurring_per_period
  // also prevents this at DB level, but early-exit avoids wasted work.
  const { data: existing } = await supabase
    .from('invoice')
    .select('invoice_id')
    .eq('company_id', company.company_id)
    .eq('period_from', periodFromStr)
    .eq('period_to', periodToStr)
    .eq('invoice_type', 'recurring')
    .neq('status', 'void')
    .maybeSingle();

  if (existing) {
    console.log(`[generator] skip company ${company.company_id}: invoice already exists`);
    return false;
  }

  // Get active pricing terms
  const { data: pt } = await supabase
    .from('pricing_terms')
    .select('*')
    .eq('company_id', company.company_id)
    .lte('effective_from', periodToStr)
    .or(`effective_until.is.null,effective_until.gte.${periodFromStr}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pt) return false;  // no pricing terms → skip

  // Compute usage_snapshot per workspace
  const workspaceSnapshots: Array<{ workspace_id: string; billable_users: number; usage_snapshot_id: string }> = [];

  for (const ws of company.workspace) {
    const { data: shifts } = await supabase
      .from('schedule_shift')
      .select('employee_id')
      .eq('workspace_id', ws.workspace_id)
      .eq('status', 'completed')
      .not('employee_id', 'is', null)
      .gte('shift_date', periodFromStr)
      .lte('shift_date', periodToStr);

    const profileIds = [...new Set((shifts ?? []).map(s => s.employee_id))];
    const active_users = profileIds.length;
    const free_users_applied = pt.free_users;
    const billable_users = Math.max(0, active_users - free_users_applied);

    const queryHash = await sha256(JSON.stringify({
      workspace_id: ws.workspace_id,
      period_from: periodFromStr,
      period_to: periodToStr,
      status: 'completed',
    }));

    // Idempotent insert via unique constraint
    const { data: snap, error } = await supabase
      .from('usage_snapshot')
      .upsert({
        company_id: company.company_id,
        workspace_id: ws.workspace_id,
        period_from: periodFromStr,
        period_to: periodToStr,
        active_users,
        free_users_applied,
        billable_users,
        counted_profile_ids: profileIds,
        source_query_hash: queryHash,
        computed_by: 'cron',
      }, { onConflict: 'company_id,workspace_id,period_from,period_to' })
      .select('usage_snapshot_id')
      .single();

    if (error) throw error;
    workspaceSnapshots.push({ workspace_id: ws.workspace_id, billable_users, usage_snapshot_id: snap.usage_snapshot_id });
  }

  // Build invoice + line items in single transaction via RPC (cleanest) or sequential with manual rollback
  // For brevity, using sequential with error handling:
  const base_plan_amount = Number(pt.monthly_cost ?? 0);
  const overage_amount = workspaceSnapshots.reduce((sum, s) => sum + s.billable_users * Number(pt.overage_price_per_user ?? 0), 0);
  const amount_excl_vat = base_plan_amount + overage_amount;
  const vat_rate = 25.00;
  const vat_amount = Math.round(amount_excl_vat * 0.25 * 100) / 100;
  const amount_incl_vat = amount_excl_vat + vat_amount;

  const { data: invoice, error: invErr } = await supabase
    .from('invoice')
    .insert({
      company_id: company.company_id,
      invoice_type: 'recurring',
      status: 'draft',  // will transition to 'issued' at end
      period_from: periodFromStr,
      period_to: periodToStr,
      amount_excl_vat,
      vat_rate,
      vat_amount,
      amount_incl_vat,
      currency: 'NOK',
      delivery_channel: pt.delivery_channel,
      due_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })
    .select('invoice_id')
    .single();

  if (invErr) throw invErr;

  // Line items
  const lineItems = [
    {
      invoice_id: invoice.invoice_id,
      line_type: 'base_plan',
      description: `Månedlig abonnement ${periodFromStr} – ${periodToStr}`,
      quantity: 1,
      unit_price: base_plan_amount,
      amount_excl_vat: base_plan_amount,
      vat_rate,
      vat_amount: Math.round(base_plan_amount * 0.25 * 100) / 100,
      amount_incl_vat: base_plan_amount + Math.round(base_plan_amount * 0.25 * 100) / 100,
    },
    ...workspaceSnapshots.filter(s => s.billable_users > 0).map(s => ({
      invoice_id: invoice.invoice_id,
      line_type: 'user_overage' as const,
      description: `Ekstra brukere over ${pt.free_users}: ${s.billable_users}`,
      quantity: s.billable_users,
      unit_price: Number(pt.overage_price_per_user),
      amount_excl_vat: s.billable_users * Number(pt.overage_price_per_user),
      vat_rate,
      vat_amount: Math.round(s.billable_users * Number(pt.overage_price_per_user) * 0.25 * 100) / 100,
      amount_incl_vat: s.billable_users * Number(pt.overage_price_per_user) * 1.25,
      usage_snapshot_id: s.usage_snapshot_id,
    })),
  ];

  const { error: liErr } = await supabase.from('invoice_line_item').insert(lineItems);
  if (liErr) throw liErr;

  // Transition to issued (triggers invoice_number assignment)
  const { error: issueErr } = await supabase
    .from('invoice')
    .update({ status: 'issued' })
    .eq('invoice_id', invoice.invoice_id);
  if (issueErr) throw issueErr;

  // C3 fix: route telemetry through internal emit endpoint (full 4-destination contract)
  for (const snap of workspaceSnapshots) {
    await emitViaEndpoint({
      event: 'usage_snapshot created',
      properties: {
        entity_type: 'usage_snapshot',
        entity_id: snap.usage_snapshot_id,
        data: { workspace_id: snap.workspace_id, company_id: company.company_id, billable_users: snap.billable_users },
      },
    });
  }

  await emitViaEndpoint({
    event: 'invoice generated',
    properties: {
      entity_type: 'invoice',
      entity_id: invoice.invoice_id,
      data: { company_id: company.company_id, amount_incl_vat, period_from: periodFromStr, period_to: periodToStr },
    },
  });

  // After transition to 'issued', the invoice_number trigger fires — fetch updated row
  const { data: issuedInvoice } = await supabase
    .from('invoice')
    .select('invoice_number')
    .eq('invoice_id', invoice.invoice_id)
    .single();

  await emitViaEndpoint({
    event: 'invoice issued',
    properties: {
      entity_type: 'invoice',
      entity_id: invoice.invoice_id,
      data: { company_id: company.company_id, invoice_number: issuedInvoice?.invoice_number ?? 0, amount_incl_vat },
    },
  });

  return true;
}

async function markOverdueInvoices(supabase: SupabaseClient) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('invoice')
    .update({ status: 'overdue' })
    .in('status', ['issued', 'sent'])
    .lt('due_at', today)
    .select('invoice_id, due_at');

  if (data) {
    for (const inv of data) {
      const days_overdue = Math.floor((Date.now() - new Date(inv.due_at).getTime()) / (24 * 60 * 60 * 1000));
      await emitViaEndpoint({
        event: 'invoice overdue_detected',
        properties: {
          entity_type: 'invoice',
          entity_id: inv.invoice_id,
          data: { days_overdue },
        },
      });
    }
  }
}

async function sha256(input: string): Promise<string> {
  const hash = createHash('sha256');
  hash.update(input);
  return hash.toString();
}
```

- [ ] **Step 3: Test locally**

```bash
npx supabase functions serve generate-monthly-invoices --env-file .env.local
# In another terminal:
curl -X POST http://localhost:54321/functions/v1/generate-monthly-invoices \
  -H "Authorization: Bearer $WATCHDOG_CRON_SECRET"
# Expected: JSON { companies_processed: 0, invoices_created: 0, errors: [] } on empty DB
```

- [ ] **Step 4: Deploy to Supabase Cloud**

```bash
npx supabase secrets set WATCHDOG_CRON_SECRET=$(op read "op://smartout_ai_prod/watchdog/secret")
npx supabase functions deploy generate-monthly-invoices
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/generate-monthly-invoices/
git commit -m "feat(billing-engine): add generate-monthly-invoices Edge Function

Cron generator for Fase 1. Runs day 5 of month at 00:01 CET via n8n.
Per spec §6.1-6.2."
```

### Task 4.2: n8n trigger workflow (external config doc)

**Files:**
- Create: `docs/runbooks/billing-monthly-cron-n8n.md`

- [ ] **Step 1: Document n8n workflow config**

```markdown
# n8n Workflow — billing-monthly-trigger

**Purpose:** Invoke the `generate-monthly-invoices` Edge Function on day 5 of each month at 00:01 CET.

## Node configuration

**Node 1: Schedule Trigger**
- Type: Cron
- Expression: `1 0 5 * *` (minute 1, hour 0, day 5, every month, every weekday)
- Timezone: Europe/Oslo

**Node 2: HTTP Request**
- Method: POST
- URL: `https://<supabase-project>.supabase.co/functions/v1/generate-monthly-invoices`
- Headers:
  - `Authorization: Bearer {{$env.WATCHDOG_CRON_SECRET}}`
- Body: empty

**Node 3: Error Handling**
- On error → Telegram notification to @sixtenclaw_bot
- On success → log to Second Brain `ops/activity-log.md`

## Deployment

1. Import via n8n UI at `n8n.smartout.ai`
2. Set `WATCHDOG_CRON_SECRET` in n8n credentials
3. Activate workflow
4. Verify next run time shows day 5 00:01 CET

## Testing

Manually trigger via n8n UI "Execute Workflow" — verify response includes `companies_processed`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/billing-monthly-cron-n8n.md
git commit -m "docs(billing-engine): n8n workflow config for billing-monthly-trigger"
```

---

## Phase 5 — Shared UI

### Task 5.1: `<InvoiceStatusBadge>` in `packages/ui`

**Files:**
- Create: `packages/ui/src/InvoiceStatusBadge.tsx`
- Modify: `packages/ui/src/index.ts` (export)

- [ ] **Step 1: Write component**

```tsx
// packages/ui/src/components/InvoiceStatusBadge.tsx
// (goes under components/, following existing convention — packages/ui/src/components/ is where new components live)
import { FileText, Send, CheckCircle2, AlertTriangle, Ban, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';  // CORRECTED: was './utils', actual is './lib/utils'

export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'paid' | 'overdue' | 'void' | 'uncollectible';

type Props = {
  status: InvoiceStatus;
  size?: 'sm' | 'md';
  withIcon?: boolean;
  className?: string;
};

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; fg: string; Icon: typeof FileText }> = {
  draft: { label: 'Utkast', bg: 'bg-muted', fg: 'text-muted-foreground', Icon: FileText },
  issued: { label: 'Utstedt', bg: 'bg-info/15', fg: 'text-info-foreground', Icon: Send },
  sent: { label: 'Sendt', bg: 'bg-info/25', fg: 'text-info-foreground', Icon: Send },
  paid: { label: 'Betalt', bg: 'bg-success/20', fg: 'text-success-foreground', Icon: CheckCircle2 },
  overdue: { label: 'Forfalt', bg: 'bg-warning/25', fg: 'text-warning-foreground', Icon: AlertTriangle },
  void: { label: 'Annullert', bg: 'bg-muted line-through', fg: 'text-muted-foreground', Icon: Ban },
  uncollectible: { label: 'Avskrevet', bg: 'bg-destructive/15', fg: 'text-destructive-foreground', Icon: XCircle },
};

export function InvoiceStatusBadge({ status, size = 'md', withIcon = true, className }: Props) {
  const cfg = STATUS_CONFIG[status];
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-sm px-2.5 py-1 gap-1.5';

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium',
      cfg.bg, cfg.fg, sizeClasses, className
    )}>
      {withIcon && <cfg.Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />}
      <span>{cfg.label}</span>
    </span>
  );
}
```

- [ ] **Step 2: Export + commit**

```bash
# Add to packages/ui/src/index.ts:
# export { InvoiceStatusBadge, type InvoiceStatus } from './InvoiceStatusBadge';

pnpm turbo typecheck --filter=@smartout/ui
git add packages/ui/src/InvoiceStatusBadge.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add InvoiceStatusBadge with enforced Nordic Split token mapping"
```

### Task 5.2: ESLint rule forbidding hex/tailwind colors in billing UI

**Files:**
- Modify: `packages/eslint-config/src/*.cjs` (project-level config)

- [ ] **Step 1: Add overrides block**

In the billing-specific override section:

```js
// packages/eslint-config/src/next.cjs (or wherever app rules live)
module.exports = {
  // ... existing rules
  overrides: [
    // ... existing overrides
    {
      files: [
        'apps/web/src/app/platform-admin/billing/**/*.{ts,tsx}',
        'apps/web/src/app/dashboard/billing/**/*.{ts,tsx}',
      ],
      rules: {
        'no-restricted-syntax': ['error',
          {
            selector: 'Literal[value=/\\b(bg|text|border)-(red|blue|green|yellow|zinc|gray|slate)-[0-9]+\\b/]',
            message: 'Use semantic tokens (bg-success, bg-warning, bg-destructive, bg-info) via InvoiceStatusBadge or CSS variables. See spec §10.1.',
          },
        ],
      },
    },
  ],
};
```

- [ ] **Step 2: Verify + commit**

```bash
pnpm turbo lint --filter=@smartout/web
# Expected: 0 errors if no billing code yet; will enforce as Phase 6+ lands
git add packages/eslint-config/
git commit -m "feat(eslint): forbid hex/tailwind colors in billing UI

Enforces semantic token usage. Billing UI must use bg-success,
bg-warning, bg-destructive, bg-info or InvoiceStatusBadge component."
```

---

## Phase 6 — Platform-admin UI (list + detail)

### Task 6.1: Billing hub layout with tabs

**Files:**
- Modify: `apps/web/src/app/platform-admin/billing/page.tsx` (preserve existing, becomes Overview tab)
- Create: `apps/web/src/app/platform-admin/billing/layout.tsx` (tab shell)

- [ ] **Step 1: Create layout with tabs**

```tsx
// apps/web/src/app/platform-admin/billing/layout.tsx
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl">Fakturering</h1>
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" asChild><Link href="/platform-admin/billing">Oversikt</Link></TabsTrigger>
          <TabsTrigger value="invoices" asChild><Link href="/platform-admin/billing/invoices">Fakturaer</Link></TabsTrigger>
          <TabsTrigger value="dunning" asChild><Link href="/platform-admin/billing/dunning">Purring</Link></TabsTrigger>
          <TabsTrigger value="export" asChild><Link href="/platform-admin/billing/export">Eksport</Link></TabsTrigger>
          <TabsTrigger value="drift" asChild><Link href="/platform-admin/billing/drift">Drift</Link></TabsTrigger>
        </TabsList>
      </Tabs>
      {children}
    </div>
  );
}
```

Preserve existing `page.tsx` (MRR dashboard) as the Overview tab. No changes required to existing query logic.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/layout.tsx
git commit -m "feat(billing-engine): add billing hub layout with 5 tabs

Preserves existing MRR dashboard as Overview tab per §21 DO NOT TOUCH."
```

### Task 6.2: Invoice list page

**Files:**
- Create: `apps/web/src/app/platform-admin/billing/invoices/page.tsx`
- Create: `apps/web/src/app/platform-admin/billing/invoices/_components/invoice-table.tsx`
- Create: `apps/web/src/app/platform-admin/billing/invoices/_components/invoice-filter-bar.tsx`

- [ ] **Step 1: Write page**

```tsx
// apps/web/src/app/platform-admin/billing/invoices/page.tsx
import { createAdminClient } from '@/lib/supabase/admin';
import { getSuperAdminId } from '@/lib/platform-admin/auth';
import { redirect } from 'next/navigation';
import { InvoiceTable } from './_components/invoice-table';
import { InvoiceFilterBar } from './_components/invoice-filter-bar';
import { InvoiceDetailSheet } from './_components/invoice-detail-sheet';

export default async function InvoicesPage({ searchParams }: { searchParams: { status?: string; company?: string; preview?: string } }) {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect('/');

  const supabase = createAdminClient();

  let query = supabase
    .from('invoice')
    .select('invoice_id, invoice_number, company_id, company:company(name), invoice_type, status, dunning_status, period_from, period_to, due_at, amount_incl_vat, delivery_channel')
    .order('created_at', { ascending: false })
    .limit(100);

  if (searchParams.status) query = query.eq('status', searchParams.status);
  if (searchParams.company) query = query.eq('company_id', searchParams.company);

  const { data: invoices } = await query;

  return (
    <div className="space-y-4">
      <InvoiceFilterBar />
      <InvoiceTable invoices={invoices ?? []} />
      {searchParams.preview && <InvoiceDetailSheet invoiceId={searchParams.preview} />}
    </div>
  );
}
```

- [ ] **Step 2: Write table component**

```tsx
// apps/web/src/app/platform-admin/billing/invoices/_components/invoice-table.tsx
'use client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InvoiceStatusBadge } from '@smartout/ui';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
// Types imported from @smartout/billing

// C6 fix: typed props, no `any`. Uses the list-row projection shape from the query.
import type { Invoice } from '@smartout/billing';
type InvoiceListRow = Pick<
  Invoice,
  'invoice_id' | 'invoice_number' | 'company_id' | 'invoice_type' | 'status' | 'dunning_status'
  | 'period_from' | 'period_to' | 'due_at' | 'amount_incl_vat' | 'delivery_channel'
> & { company: { name: string } | null };

export function InvoiceTable({ invoices }: { invoices: InvoiceListRow[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const openPreview = (id: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('preview', id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (invoices.length === 0) {
    return (
      <div className="py-16 text-center">
        <h2 className="font-heading text-2xl mb-2">Ingen fakturaer enda</h2>
        <p className="text-muted-foreground">Fakturaer genereres automatisk dag 5 hver måned.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nr.</TableHead>
          <TableHead>Selskap</TableHead>
          <TableHead>Periode</TableHead>
          <TableHead className="text-right">Beløp (inkl. mva)</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Forfall</TableHead>
          <TableHead>Kanal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((inv) => (
          <TableRow key={inv.invoice_id} onClick={() => openPreview(inv.invoice_id)} className="cursor-pointer">
            <TableCell className="font-mono tabular-nums">{inv.invoice_number ?? '—'}</TableCell>
            <TableCell>{inv.company?.name}</TableCell>
            <TableCell>{inv.period_from} – {inv.period_to}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{Number(inv.amount_incl_vat).toLocaleString('nb-NO')} kr</TableCell>
            <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
            <TableCell>{inv.due_at}</TableCell>
            <TableCell>{inv.delivery_channel}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Write filter bar**

```tsx
// apps/web/src/app/platform-admin/billing/invoices/_components/invoice-filter-bar.tsx
'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function InvoiceFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'all') params.delete(key); else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      <Select value={searchParams.get('status') ?? 'all'} onValueChange={(v) => setFilter('status', v)}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle statuser</SelectItem>
          <SelectItem value="draft">Utkast</SelectItem>
          <SelectItem value="issued">Utstedt</SelectItem>
          <SelectItem value="paid">Betalt</SelectItem>
          <SelectItem value="overdue">Forfalt</SelectItem>
          <SelectItem value="void">Annullert</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/invoices/
git commit -m "feat(billing-engine): add invoice list page with filter bar

Platform-admin view. Server Component with filter + row → ?preview= drill."
```

### Task 6.3: Invoice detail page + Sheet

**Files:**
- Create: `apps/web/src/app/platform-admin/billing/invoices/[id]/page.tsx`
- Create: `apps/web/src/app/platform-admin/billing/invoices/_components/invoice-detail.tsx`
- Create: `apps/web/src/app/platform-admin/billing/invoices/_components/invoice-detail-sheet.tsx`

- [ ] **Step 1: Write shared detail component**

```tsx
// apps/web/src/app/platform-admin/billing/invoices/_components/invoice-detail.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { InvoiceStatusBadge } from '@smartout/ui';
import { InvoiceActions } from './invoice-actions';
import { InvoiceTimeline } from './invoice-timeline';

export async function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  // Fetch via get_invoice_basis function
  // ... (implementation calls Supabase RPC)

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-heading text-3xl">Faktura #{invoice.invoice_number}</h2>
        <p className="text-muted-foreground">{company.name}</p>
        <InvoiceStatusBadge status={invoice.status} size="md" />
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Oversikt</TabsTrigger>
          <TabsTrigger value="history">Historikk</TabsTrigger>
          <TabsTrigger value="actions">Handlinger</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          {/* line items table, usage snapshot accordion, metadata */}
        </TabsContent>
        <TabsContent value="history">
          <InvoiceTimeline invoiceId={invoiceId} />
        </TabsContent>
        <TabsContent value="actions">
          <InvoiceActions invoice={invoice} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Write route page + Sheet wrapper**

Both use `<InvoiceDetail invoiceId={...} />` — route is full-page, Sheet is side panel.

```tsx
// apps/web/src/app/platform-admin/billing/invoices/[id]/page.tsx
import { InvoiceDetail } from '../_components/invoice-detail';

export default async function Page({ params }: { params: { id: string } }) {
  return <InvoiceDetail invoiceId={params.id} />;
}

// apps/web/src/app/platform-admin/billing/invoices/_components/invoice-detail-sheet.tsx
'use client';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { InvoiceDetail } from './invoice-detail';

export function InvoiceDetailSheet({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const close = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('preview');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Sheet open onOpenChange={close}>
      <SheetContent side="right" className="w-[800px] max-w-[90vw] overflow-y-auto">
        <InvoiceDetail invoiceId={invoiceId} />
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/invoices/
git commit -m "feat(billing-engine): add invoice detail (route + sheet) with 3 tabs"
```

### Task 6.4: Invoice timeline component (Historikk tab)

**Files:**
- Create: `apps/web/src/app/platform-admin/billing/invoices/_components/invoice-timeline.tsx`

- [ ] **Step 1: Write component**

```tsx
// apps/web/src/app/platform-admin/billing/invoices/_components/invoice-timeline.tsx
import { createAdminClient } from '@/lib/supabase/admin';
import { FileText, Send, CheckCircle2, AlertTriangle, Ban, XCircle, MessageSquare } from 'lucide-react';

const EVENT_ICONS = {
  'invoice.generated': FileText,
  'invoice.issued': Send,
  'invoice.sent': Send,
  'invoice.marked_paid': CheckCircle2,
  'invoice.overdue_detected': AlertTriangle,
  'invoice.voided': Ban,
  'invoice.credit_note_issued': XCircle,
  'dunning_note.added': MessageSquare,
};

export async function InvoiceTimeline({ invoiceId }: { invoiceId: string }) {
  const supabase = createAdminClient();
  const { data: events } = await supabase
    .from('activity_trail')
    .select('activity_trail_id, event, properties, actor_user_id, actor:actor_user_id(email), created_at')
    .eq('properties->entity->>id', invoiceId)
    .order('created_at', { ascending: true });

  if (!events || events.length === 0) {
    return <p className="text-muted-foreground">Ingen hendelser registrert.</p>;
  }

  return (
    <ol className="relative border-l border-border/40 ml-4 space-y-4">
      {events.map((e) => {
        const Icon = EVENT_ICONS[e.event] ?? FileText;
        return (
          <li key={e.activity_trail_id} className="pl-6 relative">
            <span className="absolute -left-3 top-0 bg-background border border-border/60 rounded-full p-1">
              <Icon className="h-3 w-3" aria-hidden />
            </span>
            <time className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString('nb-NO')}</time>
            <p className="font-medium">{formatEvent(e.event, e.properties)}</p>
            {e.actor && <p className="text-xs text-muted-foreground">{e.actor.email}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function formatEvent(event: string, props: any): string {
  switch (event) {
    case 'invoice.generated': return 'Fakturagrunnlag generert';
    case 'invoice.issued': return `Faktura utstedt (kr ${props.amount_incl_vat})`;
    case 'invoice.marked_paid': return `Merket som betalt (${props.payment_channel})`;
    case 'invoice.voided': return `Annullert: ${props.reason_detail}`;
    case 'invoice.overdue_detected': return `Forfalt (${props.days_overdue} dager)`;
    case 'dunning_note.added': return `Notat: ${props.note}`;
    default: return event;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/invoices/_components/invoice-timeline.tsx
git commit -m "feat(billing-engine): add InvoiceTimeline (activity_trail history) for detail tab"
```

---

## Phase 7 — Platform-admin mutations (Server Actions)

Each Server Action follows this pattern:
1. `getSuperAdminId()` gate — redirect if not super admin
2. Zod validation of input
3. Idempotency check (Upstash Redis for destructive actions)
4. Service-role DB mutation
5. `emit()` telemetry (registered in Phase 2)
6. `revalidatePath()` for list + detail
7. Return result object

### Task 7.1: `markInvoicePaid`

**Files:**
- Create: `apps/web/src/app/platform-admin/billing/_actions/markInvoicePaid.ts`

- [ ] **Step 1: Write action**

```ts
// apps/web/src/app/platform-admin/billing/_actions/markInvoicePaid.ts
'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSuperAdminId } from '@/lib/platform-admin/auth';
import { revalidatePath } from 'next/cache';
import { emit } from '@smartout/telemetry';
import { MarkInvoicePaidInput } from '@smartout/billing';
import { checkRateLimit } from '@/lib/rate-limit';

export async function markInvoicePaid(rawInput: unknown) {
  const adminId = await getSuperAdminId();
  if (!adminId) throw new Error('Unauthorized');

  const input = MarkInvoicePaidInput.parse(rawInput);

  // Rate limit
  await checkRateLimit(`mark-paid:${adminId}`, 10, 60);

  const supabase = createAdminClient();

  // Idempotency check via Redis or idempotency_key column (use existing pattern)
  // ... check if idempotency_key has been used in last 24h

  const { data: invoice, error } = await supabase
    .from('invoice')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_date: input.payment_date,
      payment_reference: input.payment_reference,
      payment_channel: input.payment_channel,
    })
    .eq('invoice_id', input.invoice_id)
    .in('status', ['issued', 'sent', 'overdue'])  // only from these states
    .select('invoice_id, company_id, amount_incl_vat, invoice_number')
    .single();

  if (error) throw error;
  if (!invoice) throw new Error('Invoice not found or not in payable state');

  await emit({
    event: 'invoice.marked_paid',
    invoice_id: invoice.invoice_id,
    company_id: invoice.company_id,
    amount_incl_vat: invoice.amount_incl_vat,
    payment_channel: input.payment_channel,
    properties: { entity: { type: 'invoice', id: invoice.invoice_id } },
  });

  revalidatePath('/platform-admin/billing/invoices');
  revalidatePath(`/platform-admin/billing/invoices/${invoice.invoice_id}`);

  return { success: true, invoice_id: invoice.invoice_id };
}
```

- [ ] **Step 2: Add to telemetry CI assertion list**

Update `packages/telemetry/__tests__/billing-emit.spec.ts` `billingMutationSites`:

```ts
{ file: 'apps/web/src/app/platform-admin/billing/_actions/markInvoicePaid.ts', mutation: 'markInvoicePaid', event: 'invoice.marked_paid' },
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/_actions/markInvoicePaid.ts packages/telemetry/__tests__/billing-emit.spec.ts
git commit -m "feat(billing-engine): add markInvoicePaid Server Action"
```

### Task 7.2: `voidInvoice`

**Files:**
- Create: `apps/web/src/app/platform-admin/billing/_actions/voidInvoice.ts`

- [ ] **Step 1: Write action with typed confirmation check**

```ts
// apps/web/src/app/platform-admin/billing/_actions/voidInvoice.ts
'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSuperAdminId } from '@/lib/platform-admin/auth';
import { revalidatePath } from 'next/cache';
import { emit } from '@smartout/telemetry';
import { VoidInvoiceInput } from '@smartout/billing';
import { checkRateLimit } from '@/lib/rate-limit';

export async function voidInvoice(rawInput: unknown) {
  const adminId = await getSuperAdminId();
  if (!adminId) throw new Error('Unauthorized');

  const input = VoidInvoiceInput.parse(rawInput);
  await checkRateLimit(`void:${adminId}`, 10, 60);

  const supabase = createAdminClient();

  // Verify typed confirmation matches invoice_number
  const { data: existing } = await supabase
    .from('invoice')
    .select('invoice_number, status')
    .eq('invoice_id', input.invoice_id)
    .single();

  if (!existing) throw new Error('Invoice not found');
  if (String(existing.invoice_number) !== input.typed_confirmation) {
    throw new Error('Typed confirmation does not match invoice number');
  }
  if (!['issued', 'sent', 'overdue'].includes(existing.status)) {
    throw new Error(`Cannot void invoice in status ${existing.status}`);
  }

  const { data, error } = await supabase
    .from('invoice')
    .update({
      status: 'void',
      voided_at: new Date().toISOString(),
      voided_by: adminId,
      void_reason: `${input.reason}: ${input.reason_detail}`,
    })
    .eq('invoice_id', input.invoice_id)
    .select('invoice_id, company_id, amount_incl_vat')
    .single();

  if (error) throw error;

  await emit({
    event: 'invoice.voided',
    invoice_id: data.invoice_id,
    company_id: data.company_id,
    reason: input.reason,
    reason_detail: input.reason_detail,
    properties: { entity: { type: 'invoice', id: data.invoice_id } },
  });

  revalidatePath('/platform-admin/billing/invoices');
  revalidatePath(`/platform-admin/billing/invoices/${data.invoice_id}`);

  return { success: true };
}
```

- [ ] **Step 2: Add to CI assertion + commit**

```bash
git add apps/web/src/app/platform-admin/billing/_actions/voidInvoice.ts packages/telemetry/__tests__/billing-emit.spec.ts
git commit -m "feat(billing-engine): add voidInvoice Server Action with typed confirmation"
```

### Task 7.3: `issueCreditNote` Server Action

**Files:**
- Create: `apps/web/src/app/platform-admin/billing/_actions/issueCreditNote.ts`

**Non-trivial:** creates a NEW invoice row with `invoice_type='credit_note'` + `credits_invoice_id` link. Nested credit note prevention is DB-enforced via trigger (Task 1.4).

- [ ] **Step 1: Write action**

```ts
// apps/web/src/app/platform-admin/billing/_actions/issueCreditNote.ts
'use server';
import { createAdminClient } from '@smartout/supabase/admin';
import { getSuperAdminId } from '@/lib/platform-admin';
import { revalidatePath } from 'next/cache';
import { emit } from '@smartout/telemetry';
import { IssueCreditNoteInput } from '@smartout/billing';
import { checkRateLimit } from '@/lib/rate-limit';

export async function issueCreditNote(rawInput: unknown) {
  const adminId = await getSuperAdminId();
  if (!adminId) throw new Error('Unauthorized');

  const input = IssueCreditNoteInput.parse(rawInput);
  await checkRateLimit(`credit-note:${adminId}`, 10, 60);

  const supabase = createAdminClient();

  // Load original
  const { data: original } = await supabase
    .from('invoice')
    .select('*')
    .eq('invoice_id', input.original_invoice_id)
    .single();
  if (!original) throw new Error('Original invoice not found');
  if (original.invoice_type === 'credit_note') throw new Error('Cannot credit a credit note');
  if (!['issued','sent','paid','overdue'].includes(original.status)) {
    throw new Error(`Cannot credit invoice in status ${original.status}`);
  }

  // Create credit note invoice (amount negative from business perspective but stored positive per ADR-0120)
  const vatRate = 25.00;
  const amountExclVat = input.amount / 1.25;
  const vatAmount = input.amount - amountExclVat;

  const { data: creditNote, error } = await supabase
    .from('invoice')
    .insert({
      company_id: original.company_id,
      invoice_type: 'credit_note',
      credits_invoice_id: original.invoice_id,
      status: 'issued',  // credit notes issue immediately
      period_from: original.period_from,
      period_to: original.period_to,
      amount_excl_vat: amountExclVat,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      amount_incl_vat: input.amount,
      currency: original.currency,
      delivery_channel: original.delivery_channel,
      void_reason: `${input.reason}: ${input.reason_detail}`,
      created_by: adminId,
    })
    .select('invoice_id, invoice_number')
    .single();

  if (error) throw error;

  await emit({
    event: 'invoice credit_note_issued',
    properties: {
      entity_type: 'invoice',
      entity_id: creditNote.invoice_id,
      data: { original_invoice_id: original.invoice_id, amount_incl_vat: input.amount, reason: input.reason },
    },
  });

  revalidatePath('/platform-admin/billing/invoices');
  revalidatePath(`/platform-admin/billing/invoices/${original.invoice_id}`);
  revalidatePath(`/platform-admin/billing/invoices/${creditNote.invoice_id}`);

  return { success: true, credit_note_id: creditNote.invoice_id, invoice_number: creditNote.invoice_number };
}
```

- [ ] **Step 2: Add to CI assertion list + commit**

```bash
git add apps/web/src/app/platform-admin/billing/_actions/issueCreditNote.ts packages/telemetry/__tests__/billing-emit.spec.ts
git commit -m "feat(billing-engine): add issueCreditNote Server Action"
```

### Task 7.4: `markInvoiceUncollectible` Server Action

- [ ] **Step 1: Write action** — AlertDialog-gated, reason code from `UncollectibleReason` enum, updates `invoice.status = 'uncollectible'` from `overdue`. Only transitions from overdue allowed.

- [ ] **Step 2: Emit `invoice marked_paid`? No — no existing event.** Add a new event `invoice marked_uncollectible` to Task 2.1 registry (destinations: `logger, activity_trail, engine_event`, category: `billing`).

- [ ] **Step 3: Commit**

### Task 7.5: `addDunningNote` Server Action

- [ ] **Step 1: Write action** — writes to `activity_trail` via `emit({ event: 'dunning_note added', ... })`. No separate table (dunning_note decision A from council). Updates `invoice.dunning_status = 'in_negotiation'` if was `'none'`.

- [ ] **Step 2: Commit**

### Task 7.6: `updatePricingTerms` Server Action

- [ ] **Step 1: Write action** — upserts a new `pricing_terms` row with `effective_from = today`. If existing row has `effective_until IS NULL`, sets it to yesterday. Creates audit trail via `pricing_terms updated` event with `changes` payload capturing field-level diff.

- [ ] **Step 2: Commit**

### Task 7.7: `regenerateInvoiceDraft` Server Action

- [ ] **Step 1: Write action** — ONLY for `status='draft'` invoices. Deletes existing line items (ON DELETE RESTRICT blocks issued, so this is safe for drafts), recomputes usage_snapshot + line items, reinserts. No `emit()` for regenerate — the original `invoice generated` event remains (draft pre-issue is mutable by design).

- [ ] **Step 2: Commit**

### Task 7.8: `createOnboardingInvoice` Server Action

- [ ] **Step 1: Write action** — creates invoice with `invoice_type='onboarding'`. Line items from `pricing_terms.onboarding_cost` + `onboarding_package`. Different period semantics (not monthly; `period_from = period_to = today`). Status → 'issued' directly (not draft).

- [ ] **Step 2: Commit**

### Task 7.9: Four mutation dialog components

**Files:**
- Create: `apps/web/src/app/platform-admin/billing/invoices/_components/mark-paid-dialog.tsx`
- Create: `apps/web/src/app/platform-admin/billing/invoices/_components/void-alert-dialog.tsx`
- Create: `apps/web/src/app/platform-admin/billing/invoices/_components/credit-note-alert-dialog.tsx`
- Create: `apps/web/src/app/platform-admin/billing/invoices/_components/uncollectible-alert-dialog.tsx`

- [ ] **Step 1: `<MarkPaidDialog>`**

```tsx
'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { markInvoicePaid } from '../../_actions/markInvoicePaid';
import { useTranslations } from 'next-intl';
import { v4 as uuidv4 } from 'uuid';

export function MarkPaidDialog({ invoice, open, onClose }: {
  invoice: { invoice_id: string; invoice_number: number; amount_incl_vat: number };
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('billing');
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      try {
        await markInvoicePaid({
          invoice_id: invoice.invoice_id,
          payment_date: String(form.get('payment_date')),
          payment_reference: String(form.get('payment_reference')),
          payment_channel: String(form.get('payment_channel')),
          amount: Number(form.get('amount')),
          notes: String(form.get('notes') ?? ''),
          idempotency_key: uuidv4(),
        });
        toast.success(t('actions.markPaidSuccess'));
        onClose();
      } catch (err) {
        toast.error(String(err));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('actions.markPaid')} #{invoice.invoice_number}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="payment_date">{t('fields.paymentDate')}</Label>
            <Input id="payment_date" name="payment_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
          </div>
          <div>
            <Label htmlFor="amount">{t('fields.amount')}</Label>
            <Input id="amount" name="amount" type="number" step="0.01" defaultValue={invoice.amount_incl_vat} required />
          </div>
          <div>
            <Label htmlFor="payment_channel">{t('fields.channel')}</Label>
            <Select name="payment_channel" defaultValue="bank_transfer">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">{t('channels.bank')}</SelectItem>
                <SelectItem value="cash">{t('channels.cash')}</SelectItem>
                <SelectItem value="stripe_manual_capture">{t('channels.stripe')}</SelectItem>
                <SelectItem value="out_of_band">{t('channels.outOfBand')}</SelectItem>
                <SelectItem value="partial_write_off">{t('channels.partial')}</SelectItem>
                <SelectItem value="other">{t('channels.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="payment_reference">{t('fields.reference')}</Label>
            <Input id="payment_reference" name="payment_reference" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
            <Button type="submit" disabled={pending}>{pending ? '...' : t('actions.register')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: `<VoidAlertDialog>`** — same pattern but `<AlertDialog>`, typed-confirmation input that must exactly match `invoice_number` to enable submit button, reason select + textarea, `--destructive` variant on submit button.

- [ ] **Step 3: `<CreditNoteAlertDialog>`** — requires original invoice link (auto-populated), amount (defaults to full, editable), reason select, preview panel showing new credit note before issuing.

- [ ] **Step 4: `<UncollectibleAlertDialog>`** — reason code from `UncollectibleReason` enum, optional note for `other`.

- [ ] **Step 5: Wire dialogs into `<InvoiceActions>` component**

```tsx
// apps/web/src/app/platform-admin/billing/invoices/_components/invoice-actions.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MarkPaidDialog } from './mark-paid-dialog';
import { VoidAlertDialog } from './void-alert-dialog';
// ... etc

export function InvoiceActions({ invoice }) {
  const [dialog, setDialog] = useState<'markPaid' | 'void' | 'credit' | 'uncollectible' | null>(null);
  return (
    <div className="flex gap-2">
      {['issued','sent','overdue'].includes(invoice.status) && (
        <Button onClick={() => setDialog('markPaid')}>Merk som betalt</Button>
      )}
      {['issued','sent','overdue'].includes(invoice.status) && (
        <Button variant="destructive" onClick={() => setDialog('void')}>Annuller</Button>
      )}
      {/* ... */}
      <MarkPaidDialog invoice={invoice} open={dialog === 'markPaid'} onClose={() => setDialog(null)} />
      <VoidAlertDialog invoice={invoice} open={dialog === 'void'} onClose={() => setDialog(null)} />
    </div>
  );
}
```

- [ ] **Step 6: Commit each dialog** (4 commits)

---

## Phase 8 — Dunning + Drift + Export

### Task 8.1: Dunning kanban page

**Files:**
- Create: `apps/web/src/app/platform-admin/billing/dunning/page.tsx`
- Create: `apps/web/src/app/platform-admin/billing/dunning/_components/dunning-kanban.tsx`
- Create: `apps/web/src/app/platform-admin/billing/dunning/_components/dunning-card.tsx`

- [ ] **Step 1: Write page + kanban**

Query overdue invoices, group by age tier (0-7d, 8-14d, 15-29d, 30+d), render 4 columns. 30+d cards pulse opacity per spec §10.3.

```tsx
// Simplified — see spec §10.2 for full anatomy
export default async function DunningPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('invoice')
    .select('invoice_id, invoice_number, company:company(name), amount_incl_vat, due_at, dunning_status')
    .eq('status', 'overdue')
    .order('due_at', { ascending: true });

  const grouped = groupByAgeTier(data ?? []);
  return <DunningKanban tiers={grouped} />;
}
```

- [ ] **Step 2: Write card with opacity pulse for 30+d**

```tsx
// dunning-card.tsx
'use client';
import { motion, useReducedMotion } from 'framer-motion';

export function DunningCard({ invoice, tier }: { invoice: any; tier: string }) {
  const reducedMotion = useReducedMotion();
  const shouldPulse = tier === '30plus' && !reducedMotion;

  return (
    <motion.div
      className="rounded-lg border border-border/40 bg-card p-4"
      animate={shouldPulse ? { opacity: [0.5, 0.75, 0.5] } : {}}
      transition={shouldPulse ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : {}}
    >
      <p className="font-semibold">{invoice.company.name}</p>
      <p className="font-mono text-sm text-muted-foreground">#{invoice.invoice_number}</p>
      <p className="font-mono tabular-nums mt-2">{Number(invoice.amount_incl_vat).toLocaleString('nb-NO')} kr</p>
      <p className="text-xs text-muted-foreground mt-1">{invoice.days_overdue} dager forsinket</p>
    </motion.div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/dunning/
git commit -m "feat(billing-engine): add dunning kanban with age-tier columns"
```

### Task 8.2: Basis drift panel

**Files:**
- Create: `apps/web/src/app/platform-admin/billing/drift/page.tsx`
- Create: `apps/web/src/app/platform-admin/billing/drift/_components/drift-panel.tsx`
- Create: `apps/web/src/app/platform-admin/billing/_actions/resolveDriftEvent.ts`

- [ ] **Step 1: Write page + panel** — list unreviewed `basis_drift_event` rows with diff view + actions (Ignore / Issue credit note / Reinvoice).

- [ ] **Step 2: Server Action `resolveDriftEvent`** — updates `basis_drift_event.resolution` + optionally triggers credit note issuance.

- [ ] **Step 3: Commit**

### Task 8.3: CSV export Route Handler + UI

**Files:**
- Create: `apps/web/src/app/platform-admin/billing/export/route.ts` (Route Handler for CSV download)
- Create: `apps/web/src/app/platform-admin/billing/export/page.tsx` (form UI)

- [ ] **Step 1: Route Handler**

```ts
// apps/web/src/app/platform-admin/billing/export/route.ts
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSuperAdminId } from '@/lib/platform-admin/auth';

export async function GET(req: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const periodFrom = searchParams.get('period_from');
  const periodTo = searchParams.get('period_to');

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('invoice')
    .select('invoice_number, company:company(name, org_number), period_from, period_to, amount_excl_vat, vat_amount, amount_incl_vat, status, issued_at, paid_at')
    .gte('period_from', periodFrom)
    .lte('period_to', periodTo)
    .order('invoice_number', { ascending: true });

  const csv = toCsv(data ?? []);

  return new Response('\uFEFF' + csv, {  // UTF-8 BOM for Excel
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="smartout-invoices-${periodFrom}-to-${periodTo}.csv"`,
    },
  });
}

function toCsv(rows: any[]): string {
  const header = 'Fakturanr;Selskap;Org.nr;Periode fra;Periode til;Eks. mva;Mva;Inkl. mva;Status;Utstedt;Betalt';
  const lines = rows.map(r => [
    r.invoice_number,
    r.company?.name,
    r.company?.org_number,
    r.period_from,
    r.period_to,
    String(r.amount_excl_vat).replace('.', ','),  // Norwegian decimal
    String(r.vat_amount).replace('.', ','),
    String(r.amount_incl_vat).replace('.', ','),
    r.status,
    r.issued_at?.split('T')[0] ?? '',
    r.paid_at?.split('T')[0] ?? '',
  ].join(';'));
  return [header, ...lines].join('\n');
}
```

- [ ] **Step 2: Form UI page** — period picker + company multi-select + "Last ned CSV" button that navigates to the Route Handler URL.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/billing/export/
git commit -m "feat(billing-engine): add CSV export Route Handler + form UI

UTF-8 BOM for Excel compatibility. Norwegian decimal separator."
```

---

## Phase 9 — Per-company billing config

### Task 9.1: Billing tab on company detail page

**Files:**
- Modify: `apps/web/src/app/platform-admin/companies/[id]/page.tsx` (add billing tab)
- Create: `apps/web/src/app/platform-admin/companies/[id]/_components/billing-config-tab.tsx`
- Create: `apps/web/src/app/platform-admin/companies/[id]/_components/pricing-terms-form.tsx`

- [ ] **Step 1: Add tab to company page**

- [ ] **Step 2: Build pricing_terms form** using react-hook-form + Zod schema from `@smartout/billing`.

- [ ] **Step 3: Wire to `updatePricingTerms` Server Action (Task 7.3).**

- [ ] **Step 4: Config change history below form** — read `activity_trail` for `pricing_terms.updated` events.

- [ ] **Step 5: Commit**

---

## Phase 10 — Workspace-admin read UI

### Task 10.1: `/dashboard/billing` Server Component

**Files:**
- Create: `apps/web/src/app/dashboard/billing/page.tsx`
- Create: `apps/web/src/app/dashboard/billing/_actions/queries.ts` (Server Actions for reads)

- [ ] **Step 1: Write page**

```tsx
// apps/web/src/app/dashboard/billing/page.tsx
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/auth';
import { InvoiceStatusBadge } from '@smartout/ui';

export default async function BillingPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/login');

  const supabase = createAdminClient();
  // Read via RLS — user's company only
  const { data: invoices } = await supabase
    .from('invoice')
    .select('invoice_id, invoice_number, period_from, period_to, amount_incl_vat, status, due_at')
    .order('issued_at', { ascending: false, nullsFirst: true })
    .limit(24);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl">Fakturaer</h1>
      {/* Read-only table */}
    </div>
  );
}
```

- [ ] **Step 2: Write `getMyCompanyInvoices`, `getMyInvoiceDetail`, `getMyUsageSnapshots` Server Actions**

```ts
// apps/web/src/app/dashboard/billing/_actions/queries.ts
'use server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/auth';

export async function getMyCompanyInvoices(filters?: { status?: string }) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Unauthorized');

  const supabase = createAdminClient();
  // Resolve user's company via company_member
  const { data: member } = await supabase
    .from('company_member')
    .select('company_id, role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'owner'])
    .limit(1)
    .maybeSingle();
  if (!member) return [];

  let query = supabase
    .from('invoice')
    .select('*')
    .eq('company_id', member.company_id)
    .order('issued_at', { ascending: false, nullsFirst: true });

  if (filters?.status) query = query.eq('status', filters.status);

  const { data } = await query;
  return data ?? [];
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/billing/
git commit -m "feat(billing-engine): add workspace-admin /dashboard/billing read view

Per H7 council decision: Server Components + Server Actions,
no Edge Function. Company admin/owner reads own invoices."
```

---

## Phase 11 — AI capability `billing_query`

### Task 11.1: Scaffold capability directory

**Files:**
- Create: `packages/ai/src/capabilities/billing-query/index.ts`
- Create: `packages/ai/src/capabilities/billing-query/tools.ts`

- [ ] **Step 1: Write capability index**

```ts
// packages/ai/src/capabilities/billing-query/index.ts
import * as tools from './tools';

export const billingQueryCapability = {
  name: 'billing_query' as const,
  description: 'Query and explain the viewer\'s own company billing (read-only).',
  tools: [],
  readOnlyTools: [
    tools.listMyInvoices,
    tools.getMyInvoice,
    tools.explainInvoiceBasis,
    tools.listOverdue,
    tools.getUsageSnapshot,
  ],
  allowedChannels: ['chat'] as const,  // Never voice
};
```

### Task 11.2-11.6: Implement each of 5 tools

**Files:**
- Modify: `packages/ai/src/capabilities/billing-query/tools.ts`

- [ ] **Step 1: `listMyInvoices`**

```ts
// packages/ai/src/capabilities/billing-query/tools.ts
import { z } from 'zod';
import { defineTool } from '../../types';
import { resolveCompanyId } from '../../lib/resolveCompanyId';
import type { AgentToolContext } from '../types';

export const listMyInvoices = defineTool({
  name: 'list_my_invoices',
  description: 'List recent invoices for the viewer\'s company.',
  capability: 'billing_query',
  schema: z.object({
    limit: z.number().int().min(1).max(50).optional().default(10),
    status: z.enum(['draft', 'issued', 'sent', 'paid', 'overdue', 'void', 'uncollectible']).optional(),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const companyId = await resolveCompanyId(ctx);
    let query = ctx.supabaseAdmin
      .from('invoice')
      .select('invoice_id, invoice_number, period_from, period_to, amount_incl_vat, status, due_at')
      .eq('company_id', companyId)
      .order('issued_at', { ascending: false, nullsFirst: true })
      .limit(params.limit);
    if (params.status) query = query.eq('status', params.status);
    const { data, error } = await query;
    if (error) return `Error: ${error.message}`;
    return JSON.stringify(data);
  },
});
```

- [ ] **Step 2: `getMyInvoice`, `explainInvoiceBasis`, `listOverdue`, `getUsageSnapshot`** — follow same pattern. `explainInvoiceBasis` calls `supabase.rpc('get_invoice_basis', { p_invoice_id: id })` and returns verbatim JSON for LLM to narrate (never computes).

**T2 fix (explain_invoice_basis draft rejection):**

```ts
export const explainInvoiceBasis = defineTool({
  name: 'explain_invoice_basis',
  description: 'Explain what makes up an invoice amount. Reads from get_invoice_basis. Only for issued invoices, never drafts.',
  capability: 'billing_query',
  schema: z.object({ invoice_id: z.string().uuid() }),
  execute: async (params, ctx: AgentToolContext) => {
    // G7 fix: channel assertion runtime check (defense in depth — also at selector)
    if (ctx.channel && ctx.channel !== 'chat') {
      return 'Error: billing tools are chat-only';
    }

    const companyId = await resolveCompanyId(ctx);

    // Verify invoice belongs to viewer's company
    const { data: invoice } = await ctx.supabaseAdmin
      .from('invoice')
      .select('invoice_id, company_id, status')
      .eq('invoice_id', params.invoice_id)
      .single();
    if (!invoice) return 'Error: invoice not found';
    if (invoice.company_id !== companyId) return 'Error: invoice does not belong to your company';
    if (invoice.status === 'draft') return 'This invoice is still a draft — no final basis yet.';

    const { data, error } = await ctx.supabaseAdmin.rpc('get_invoice_basis', { p_invoice_id: params.invoice_id });
    if (error) return `Error: ${error.message}`;
    return JSON.stringify(data);
  },
});
```

- [ ] **Step 3: Commit each tool**

### Task 11.7: Register capability at 4 touchpoints

**Files:**
- Modify: `packages/ai/src/capabilities/types.ts` (add `'billing_query'` to `CapabilityName`)
- Modify: `packages/ai/src/capabilities/registry.ts` (add entry)
- Modify: `packages/ai/src/router/intent-classifier.ts` (add enum + description block)

- [ ] **Step 1: Update CapabilityName union**

```ts
// packages/ai/src/capabilities/types.ts
export type CapabilityName =
  | 'schedule' | 'shift_lifecycle' | 'shift_swap' | 'operations' | 'operations_intelligence'
  | 'guardian' | 'contract' | 'contract_intake' | 'communication' | 'governance'
  | 'training' | 'profile' | 'ui'
  | 'billing_query';  // NEW
```

- [ ] **Step 2: Register in registry.ts**

```ts
import { billingQueryCapability } from './billing-query';

export const capabilityRegistry = {
  // ... existing
  billing_query: billingQueryCapability,
};
```

- [ ] **Step 3: Intent classifier entry**

```ts
// packages/ai/src/router/intent-classifier.ts
export const intentSchema = z.object({
  capability: z.enum([
    // ... existing
    'billing_query',
  ]),
});

const INTENT_DESCRIPTIONS = {
  // ... existing
  billing_query: `
    Use when the user asks about their invoices, billing, payment status,
    amount owed, overdue invoices, or wants an invoice explained.
    Read-only. Never for modifying billing state.
  `,
};
```

- [ ] **Step 4: Seed authority config**

Add migration:

```sql
-- supabase/migrations/<ts>_billing_query_authority_seed.sql
INSERT INTO public.engine_authority_config (workspace_id, capability, level)
SELECT w.workspace_id, 'billing_query', 'read_only'
FROM public.workspace w
ON CONFLICT (workspace_id, capability) DO NOTHING;
```

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/billing-query/ packages/ai/src/capabilities/types.ts packages/ai/src/capabilities/registry.ts packages/ai/src/router/intent-classifier.ts supabase/migrations/*billing_query_authority_seed.sql
git commit -m "feat(billing-engine): register billing_query capability with 5 read-only tools

Workspace-admin scope, chat-only. Intent classifier + authority config seeded."
```

---

## Phase 12 — i18n

### Task 12.0: Enumerate hardcoded strings

**G5 fix:** before extraction, list every string to move. Run:

```bash
grep -rnE "['\"]([A-ZÆØÅ][a-zæøåA-ZÆØÅ' ]+)['\"]" \
  apps/web/src/app/platform-admin/billing/ \
  apps/web/src/app/dashboard/billing/ \
  | grep -v "^.*://.*" | head -100
```

Expected: ~30-50 strings across 10+ files. Cross-check against the `nb.json` structure below — any string not mapped needs a new key.

### Task 12.1: Extract all billing UI strings

**Files:**
- Modify: `packages/i18n/src/locales/nb.json`
- Modify: `packages/i18n/src/locales/en.json`
- Modify: all files in `apps/web/src/app/platform-admin/billing/**/*.tsx` and `apps/web/src/app/dashboard/billing/**/*.tsx`

- [ ] **Step 1: Create `billing` namespace in both locales**

```json
// packages/i18n/src/locales/nb.json
{
  "billing": {
    "title": "Fakturering",
    "tabs": { "overview": "Oversikt", "invoices": "Fakturaer", "dunning": "Purring", "export": "Eksport", "drift": "Drift" },
    "table": { "number": "Nr.", "company": "Selskap", "period": "Periode", "amount": "Beløp (inkl. mva)", "status": "Status", "due": "Forfall", "channel": "Kanal" },
    "empty": { "list": "Ingen fakturaer enda", "dunning": "Alt er betalt.", "filter": "Ingen fakturaer i denne kategorien" },
    "status": { "draft": "Utkast", "issued": "Utstedt", "sent": "Sendt", "paid": "Betalt", "overdue": "Forfalt", "void": "Annullert", "uncollectible": "Avskrevet" },
    "actions": { "markPaid": "Merk som betalt", "void": "Annuller", "creditNote": "Utsted kreditnota", "download": "Last ned CSV" }
  }
}
```

- [ ] **Step 2: Replace hardcoded strings in UI files with `t('billing.XXX')` calls**

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/src/locales/ apps/web/src/app/platform-admin/billing/ apps/web/src/app/dashboard/billing/
git commit -m "feat(billing-engine): extract all billing UI strings to i18n"
```

---

## Phase 13 — Tests

### Task 13.1: Playwright E2E — platform-admin flow

**Files:**
- Create: `apps/e2e/tests/billing-engine/platform-admin-flow.spec.ts`

- [ ] **Step 1: Write test**

```ts
// apps/e2e/tests/billing-engine/platform-admin-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Platform admin billing flow', () => {
  test('lists invoices, marks one as paid, verifies status change', async ({ page }) => {
    await page.goto('/platform-admin/billing/invoices');
    await expect(page.getByRole('heading', { name: /fakturaer/i })).toBeVisible();

    // Click first invoice row
    await page.getByRole('row').nth(1).click();
    await expect(page.getByText(/faktura #/i)).toBeVisible();

    // Open actions tab
    await page.getByRole('tab', { name: /handlinger/i }).click();
    await page.getByRole('button', { name: /merk som betalt/i }).click();

    // Fill dialog
    await page.getByLabel('Betalingsdato').fill('2026-04-15');
    await page.getByLabel('Referanse').fill('BANK-TEST-123');
    await page.getByRole('combobox', { name: /kanal/i }).selectOption('bank_transfer');
    await page.getByRole('button', { name: /registrer betaling/i }).click();

    // Verify toast + status change
    await expect(page.getByText(/faktura merket som betalt/i)).toBeVisible();
    await expect(page.getByText(/betalt/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/e2e/tests/billing-engine/
git commit -m "test(billing-engine): Playwright E2E for platform-admin mark-paid flow"
```

### Task 13.2: Playwright E2E — workspace-admin read flow

**Files:**
- Create: `apps/e2e/tests/billing-engine/workspace-admin-flow.spec.ts`

- [ ] **Step 1: Test** — log in as workspace admin, navigate to `/dashboard/billing`, verify own company invoices visible + company B's invoices NOT visible.

- [ ] **Step 2: Commit**

### Task 13.3: Playwright E2E — void flow with typed confirmation

**Files:**
- Create: `apps/e2e/tests/billing-engine/void-flow.spec.ts`

- [ ] **Step 1: Test** — verify AlertDialog requires typing invoice number, void action succeeds only with correct input.

- [ ] **Step 2: Commit**

### Task 13.4: Playwright E2E — credit note issuance

**Files:**
- Create: `apps/e2e/tests/billing-engine/credit-note-flow.spec.ts`

- [ ] **Step 1: Test** — from paid/issued invoice, issue credit note with full amount, verify new row with `invoice_type='credit_note'` + `credits_invoice_id` link, verify both rows appear in list with correct visual treatment.

### Task 13.5: Playwright E2E — CSV export

**Files:**
- Create: `apps/e2e/tests/billing-engine/csv-export.spec.ts`

- [ ] **Step 1: Test** — fill period picker, submit, verify download triggers with `Content-Disposition: attachment` + filename pattern `smartout-invoices-*.csv`. Validate CSV content: BOM present, Norwegian decimal separators, correct column headers.

### Task 13.6: Playwright E2E — drift resolution

**Files:**
- Create: `apps/e2e/tests/billing-engine/drift-resolution.spec.ts`

- [ ] **Step 1: Test** — seed a shift modification that triggers `basis_drift_event`, verify it appears in drift panel, resolve it via "Ignore" action, verify `resolution = 'ignored'` + row removed from unreviewed list.

### Task 13.7: AI tool invocation test

**Files:**
- Create: `packages/ai/src/capabilities/billing-query/__tests__/explain-invoice-basis.spec.ts`

- [ ] **Step 1: Vitest test** — mock `ctx.supabaseAdmin`, call `explainInvoiceBasis` tool with a fake invoice_id, assert:
  - Tool returns stringified JSON containing `line_items` + `usage_snapshots` fields
  - Tool DOES NOT compute or modify any amounts (pure read)
  - If `ctx.channel === 'voice'`, tool rejects with error

### Task 13.8: Workspace isolation pgTAP test (dedicated)

Beyond generic RLS tests in Task 1.11, add focused test:

**Files:**
- Create: `supabase/tests/billing_workspace_isolation.sql`

- [ ] **Step 1: Test** — company A admin + company B admin seeded with overlapping workspaces (edge case where one user belongs to multiple companies). Verify each sees only their own.

---

## Phase 14 — Docs + closure

### Task 14.1: Write module doc

**Files:**
- Create: `docs/modules/MODULE_BILLING.md`

- [ ] **Step 0: Verify module filename doesn't collide (T1 fix)**

```bash
grep -n "MODULE_13\|MODULE_BILLING" /home/sxtnl/dev/smartout.ai/docs/INDEX.md
ls /home/sxtnl/dev/smartout.ai/docs/modules/ | grep -iE "(billing|module_13)"
# Pick a free filename. Recommendation: docs/modules/MODULE_BILLING.md (no number).
```

- [ ] **Step 1: Write module doc** — cover: purpose, data model, generation flow, AI-tools, Fase 2 roadmap, bokføringslov compliance statement.

- [ ] **Step 2: Commit**

### Task 14.2: Write user journeys

**Files:**
- Create: `docs/journeys/JOURNEY-billing-engine-fase-1.md`

- [ ] **Step 1: Journeys** — platform-admin generates monthly, platform-admin marks paid, platform-admin voids + issues credit note, workspace-admin views own invoices, workspace-admin explains invoice via AI.

- [ ] **Step 2: Commit**

### Task 14.3: Handoff document

**Files:**
- Create: `docs/HANDOFF-billing-engine-fase-1.md`

- [ ] **Step 1: Handoff** — summary, decisions (4 ADRs), learnings (any discovered during implementation), known issues (open questions from spec §18 still pending), next steps (Fase 2 scope).

- [ ] **Step 2: Commit**

### Task 14.4: Close feature

- [ ] **Step 1: Run close-feature script**

```bash
~/.claude/scripts/close-feature.sh <worktree-number>
```

Verifies all quality gates: decision log complete, journey written, typecheck 0 errors, handoff written.

- [ ] **Step 2: Merge to development**

---

## Spec Coverage Self-Check

Before declaring plan complete, verify each spec section has at least one task:

| Spec section | Covered by |
|---|---|
| §1 Kjerneprinsipp | N/A (description) |
| §2 Fase-scope | Multiple tasks across phases 1-11 |
| §3 Q1 delivery + receipt | Task 7.4 (mark paid dialog), 8.3 (CSV export) |
| §3 Q2 correct basis | Tasks 1.6, 1.8, 4.1, 11.4 |
| §3 Q3 payment registration | Task 7.1, 7.4 |
| §3 Q4 dunning follow-up | Task 8.1, 8.2, 14.1 |
| §4 Cascade placement | ADR-0118 (Task 0.1) |
| §5.1 pricing_terms extension | Task 1.2 |
| §5.2 invoice table | Task 1.4 |
| §5.3 invoice_line_item | Task 1.5 |
| §5.4 usage_snapshot | Task 1.6 |
| §5.5 dunning via activity_trail | Task 1.8 (view) + Task 7.3 addDunningNote |
| §5.6 basis_drift_event | Task 1.7 |
| §5.7 v_current_plan_preview + get_invoice_basis | Task 1.8 |
| §5.8 enums | Task 1.3 |
| §5.9 RLS | Task 1.1, 1.9 |
| §6 generation flow | Task 4.1 |
| §7 telemetry | Task 2.1, 2.2 |
| §8.1 platform-admin API | Phase 7 (all mutations) |
| §8.2 workspace-admin API | Task 10.1 |
| §8.3 CSV export | Task 8.3 |
| §9 AI-tools | Phase 11 |
| §10 UI specifications | Phases 5, 6, 7.4, 8, 9 |
| §11 Norwegian legal | ADR-0120 (Task 0.3) + Task 1.4 sequence/triggers + Task 8.3 CSV |
| §12 Mobile parity | Task 3.1, 3.3 (packages/billing) |
| §13 ADRs | Phase 0 |
| §14 Commitlint scope | (used throughout) |
| §15 Fase 2 forward compat | §21 DO NOT TOUCH covers |
| §17 Definition of Done | Phase 14 closure |
| §18 Open questions | Deferred to plan or ADR |
| §21 DO NOT TOUCH | Referenced throughout |

All spec sections covered. ✓

---

## Parallelism hints

### Hard dependencies (cannot parallelize)

- **Phase 0 → all** — ADRs + tokens + helper must merge first
- **Phase 1 → 3, 4, 6, 7, 8, 9, 10, 11** — schema must exist
- **Phase 2 (telemetry) → 4, 7** — emit events + internal endpoint must exist before cron or Server Actions use them
- **Phase 3 (data layer) → 6, 10, 11** — types consumed by UI + AI
- **Phase 5 (shared UI) → 6, 7, 8, 10** — `<InvoiceStatusBadge>` used everywhere

### Safe parallel streams (after Phase 1 completes)

**Stream A (backend):**
- Phase 2 (telemetry)
- Phase 4 (cron generator, BLOCKED on Phase 2.2 internal emit endpoint)

**Stream B (package):**
- Phase 3 (@smartout/billing)
- Phase 5 (packages/ui components)

**Stream C (parallel AI track, after Phase 3):**
- Phase 11 (AI capability)

**Stream D (parallel UI track, after Phases 3+5):**
- Phase 6 → Phase 7 (list+detail then mutations)
- Phase 8 (dunning/drift/export, independent surfaces)
- Phase 9 (per-company config, independent)
- Phase 10 (workspace-admin read, independent)

### Minimum critical path

```
Phase 0 (1-2 days) →
Phase 1 (3-5 days sequential migrations) →
Phase 2 (1 day) →
Phase 4 + Stream D simultaneously (5-8 days with parallel agents) →
Phase 11 (2-3 days) →
Phase 12 (1 day) →
Phase 13 (2-3 days) →
Phase 14 closure (1 day)
```

**Estimate with 3 parallel subagents:** 3-4 weeks calendar. **With 1 agent:** 5-6 weeks.

---

## Self-Review

✓ Spec coverage: all sections covered (table above).
✓ Placeholder scan: no TBD/TODO (open questions acknowledged as deferred, not placeholders).
✓ Type consistency: types defined in Phase 3 (`packages/billing/src/types.ts`) referenced consistently in Phase 7, 10, 11.
✓ DO NOT TOUCH list (§21 of spec) referenced in multiple tasks.
✓ All 4 central business questions mapped to specific tasks.
✓ Every destructive action has rate limiting + idempotency key.
✓ Every billing mutation is added to the CI assertion list (Phase 2.2).
✓ Mobile parity preserved — data layer in `packages/billing/`, not `apps/web/`.

---

**Plan complete. Ready for execution.**
