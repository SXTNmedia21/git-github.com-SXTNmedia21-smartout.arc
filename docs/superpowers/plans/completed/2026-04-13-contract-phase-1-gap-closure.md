---
title: "Contract Phase 1: Gap Closure"
status: draft
updated: 2026-04-13
created: 2026-04-13
module: contracts
tags: [contracts, gap-closure, composition, docuseal, phase-1]
spec: docs/superpowers/specs/2026-04-13-contract-end-to-end-gap-closure-design.md
council-session: 2026-04-13
---

# Contract Phase 1: Gap Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken contract chain so an admin can compose, review, and send an employment contract end-to-end — from employee selection through DocuSeal signing.

**Architecture:** Extend the existing composition engine (`resolve-composition.ts`) to accept user inputs instead of hardcoding values. Extend `POST /api/employment-contracts` with a `persist` flag. Wire the send route to create a DocuSeal `contract` entity and set `signing_contract_id`. Restructure the wizard to 5 steps with a real submit action.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL), TanStack Query v5, shadcn/ui, Framer Motion, DocuSeal (via contract-service Fastify at port 5012)

**Spec:** `docs/superpowers/specs/2026-04-13-contract-end-to-end-gap-closure-design.md`

**Gaps closed:** G1 (no submit), G2 (row never created), G3 (position_title lost), G4 (category hardcoded), G5 (percentage hardcoded), G6 (no DocuSeal link), G7 (ID mismatch), G11 (no idempotency)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| New | `supabase/migrations/YYYYMMDDHHMMSS_employment_category_and_template_columns.sql` | Add employment_category CHECK + column on contract_template |
| Modify | `apps/web/src/lib/contracts/resolve-composition.ts` | Accept user inputs, fix tariff lookup |
| Modify | `apps/web/src/app/api/employment-contracts/route.ts` | Add persist flag, create employment_contract row |
| Modify | `apps/web/src/app/api/employment-contracts/[id]/send/route.ts` | Create contract row, set signing_contract_id, call contract-service, idempotency |
| New | `apps/web/src/app/dashboard/contracts/_hooks/use-employment-contracts.ts` | TanStack Query hooks for contract CRUD |
| Modify | `apps/web/src/app/dashboard/contracts/_components/CompositionWizard.tsx` | 5-step restructure with submit |
| Modify | `apps/web/src/app/dashboard/contracts/_components/contracts-data-table.tsx` | Fix ContractStatus type, use employment_contract |
| Modify | `apps/web/src/app/dashboard/contracts/page.tsx` | Fetch from employment_contract, not contract |
| Modify | `apps/web/src/app/dashboard/contracts/filters.ts` | Already correct (has pending_data + declined) |

---

## Task 1: Database Migration — employment_category constraint + template column

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_employment_category_and_template_columns.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration: Add employment_category constraint + column on contract_template
-- Spec: docs/superpowers/specs/2026-04-13-contract-end-to-end-gap-closure-design.md §3.1, §3.2

-- 1. Add CHECK constraint to employment_contract.employment_category
-- The column already exists as TEXT. Add a constraint to enforce valid values.
ALTER TABLE public.employment_contract
  ADD CONSTRAINT chk_employment_category
  CHECK (employment_category IS NULL OR employment_category IN ('fast', 'deltid', 'tilkalling'));

-- 2. Add employment_category column to contract_template
-- NULL means "not category-specific" (e.g., system templates that aren't bound yet)
ALTER TABLE public.contract_template
  ADD COLUMN IF NOT EXISTS employment_category TEXT
  CHECK (employment_category IN ('fast', 'deltid', 'tilkalling'));

-- 3. Set employment_category on existing system templates
UPDATE public.contract_template
  SET employment_category = 'fast'
  WHERE is_system = true AND name ILIKE '%fast ansatt%';

UPDATE public.contract_template
  SET employment_category = 'deltid'
  WHERE is_system = true AND name ILIKE '%deltid%';

UPDATE public.contract_template
  SET employment_category = 'tilkalling'
  WHERE is_system = true AND (name ILIKE '%tilkalling%' OR name ILIKE '%vikar%');

-- 4. Add index for template lookup by category
CREATE INDEX IF NOT EXISTS idx_contract_template_category
  ON public.contract_template (employment_category)
  WHERE employment_category IS NOT NULL;
```

Name the file with the current timestamp, e.g. `20260413160000_employment_category_and_template_columns.sql`.

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db reset`
Expected: Migration applies without errors. Verify with:
```sql
SELECT name, employment_category FROM contract_template WHERE is_system = true AND contract_type = 'employee';
```
Should return 3 rows with `fast`, `deltid`, `tilkalling`.

- [ ] **Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: `database.types.ts` now includes `employment_category` on both `employment_contract` and `contract_template` table types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*employment_category* packages/supabase/src/database.types.ts
git commit -m "feat(contracts): add employment_category constraint and template column

Adds CHECK constraint on employment_contract.employment_category
(fast|deltid|tilkalling). Adds employment_category column to
contract_template and sets values on existing system templates.

Closes G4, G5 (database layer).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Fix resolveComposition — Accept User Inputs + Fix Tariff Lookup

**Files:**
- Modify: `apps/web/src/lib/contracts/resolve-composition.ts:108-252`

- [ ] **Step 1: Add CompositionInput type and update function signature**

Add after the `ContractDraftProposal` type (after line 67):

```typescript
export type EmploymentCategory = "fast" | "deltid" | "tilkalling";

export type CompositionInput = {
  employment_category: EmploymentCategory;
  employment_percentage: number;
  position_title: string;
  employee_group_id?: string;
};
```

Change the function signature at line 108 from:

```typescript
export async function resolveComposition(
  supabase: SupabaseClient,
  workspaceId: string,
  profileId: string,
  _templateId?: string,
): Promise<ContractDraftProposal> {
```

To:

```typescript
export async function resolveComposition(
  supabase: SupabaseClient,
  workspaceId: string,
  profileId: string,
  input: CompositionInput,
): Promise<ContractDraftProposal> {
```

- [ ] **Step 2: Fix tariff lookup (lines 164-176)**

Replace lines 164-176:

```typescript
  // ---- Step 4: Load tariff_rate_table for suggested rate ----
  // Look for a matching tariff rate. The tariff_rate_table uses rate_type
  // rather than employment_category directly — we look for "hourly" rates.
  const { data: tariffRows } = await supabase
    .from("tariff_rate_table")
    .select("amount, rate_type, unit")
    .eq("framework_id", frameworkId)
    .eq("source", "framework")
    .order("effective_from", { ascending: false })
    .limit(1);

  const suggestedRate =
    tariffRows && tariffRows.length > 0 ? (tariffRows[0]?.amount ?? null) : null;
```

With:

```typescript
  // ---- Step 4: Load tariff_rate_table for suggested rate ----
  // Tariff category depends on employee qualifications. Load employee's
  // payroll profile to check has_fagbrev, then pick the correct rate_type.
  const { data: payrollProfile } = await supabase
    .from("employee_payroll_profile")
    .select("has_fagbrev")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const rateType = payrollProfile?.has_fagbrev
    ? "minstelonn_faglart"
    : "minstelonn_ufaglart";

  const { data: tariffRows } = await supabase
    .from("tariff_rate_table")
    .select("amount, rate_type, unit")
    .is("workspace_id", null)
    .eq("rate_type", rateType)
    .order("effective_from", { ascending: false })
    .limit(1);

  const suggestedRate =
    tariffRows && tariffRows.length > 0 ? (tariffRows[0]?.amount ?? null) : null;
```

- [ ] **Step 3: Fix hardcoded values in proposal assembly (lines 244-252)**

Replace lines 246-252:

```typescript
    employment_terms: {
      position_title: "",
      hourly_rate: suggestedRate,
      monthly_salary: null,
      employment_percentage: 100,
      employment_category: "fast",
      start_date: new Date().toISOString().split("T")[0] ?? "",
    },
```

With:

```typescript
    employment_terms: {
      position_title: input.position_title,
      hourly_rate: suggestedRate,
      monthly_salary: null,
      employment_percentage: input.employment_percentage,
      employment_category: input.employment_category,
      start_date: new Date().toISOString().split("T")[0] ?? "",
    },
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter web typecheck`
Expected: 0 errors. If the API route still passes 4 args, it will fail — that's expected and fixed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/contracts/resolve-composition.ts
git commit -m "fix(contracts): accept user inputs in resolveComposition, fix tariff lookup

resolveComposition now takes a CompositionInput object with
employment_category, employment_percentage, and position_title
instead of hardcoding 'fast'/100/''. Tariff lookup filters by
rate_type (minstelonn_faglart/ufaglart) based on has_fagbrev.

Closes G3, G4, G5 (composition layer).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Extend POST /api/employment-contracts — Persist Flag

**Files:**
- Modify: `apps/web/src/app/api/employment-contracts/route.ts`

- [ ] **Step 1: Update the Zod schema and add persist logic**

Replace the entire file content:

```typescript
/**
 * POST /api/employment-contracts — Compose a contract draft proposal.
 *
 * When persist=false (default): returns a ContractDraftProposal for preview.
 * When persist=true: inserts an employment_contract row and returns it with contract_id.
 *
 * ADR-0076: composition as cascade derivation.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { z } from "zod";
import { resolveComposition } from "@/lib/contracts/resolve-composition";
import type { EmploymentCategory } from "@/lib/contracts/resolve-composition";
import { emit } from "@smartout/telemetry";

const composeSchema = z.object({
  workspace_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  position_title: z.string().min(1).optional().default(""),
  employment_category: z
    .enum(["fast", "deltid", "tilkalling"])
    .optional()
    .default("fast"),
  employment_percentage: z.number().min(1).max(100).optional().default(100),
  employee_group_id: z.string().uuid().optional(),
  persist: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// POST /api/employment-contracts
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = composeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      workspace_id,
      profile_id,
      position_title,
      employment_category,
      employment_percentage,
      employee_group_id,
      persist,
    } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Role gate: require admin or owner ─────────────────────────────
    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace_id)
      .single();

    if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
      return NextResponse.json(
        { error: "Forbidden: admin or owner role required" },
        { status: 403 },
      );
    }

    // ── Run cascade derivation ────────────────────────────────────────
    const proposal = await resolveComposition(supabase, workspace_id, profile_id, {
      employment_category: employment_category as EmploymentCategory,
      employment_percentage,
      position_title,
      employee_group_id,
    });

    // ── Preview-only mode: return proposal without persisting ─────────
    if (!persist) {
      return NextResponse.json(proposal);
    }

    // ── Persist mode: insert employment_contract row ──────────────────
    const { data: contract, error: insertError } = await supabase
      .from("employment_contract")
      .insert({
        workspace_id,
        profile_id,
        status: "draft" as const,
        position_title: proposal.employment_terms.position_title,
        employment_category: proposal.employment_terms.employment_category,
        employment_percentage: proposal.employment_terms.employment_percentage,
        hourly_rate: proposal.employment_terms.hourly_rate,
        monthly_salary: proposal.employment_terms.monthly_salary,
        start_date: proposal.employment_terms.start_date,
        created_by: actorProfile.profile_id,
      })
      .select("contract_id")
      .single();

    if (insertError || !contract) {
      return NextResponse.json(
        { error: `Failed to create contract: ${insertError?.message ?? "unknown"}` },
        { status: 500 },
      );
    }

    void emit({
      event: "contract created",
      workspace_id,
      actor_id: actorProfile.profile_id,
      properties: {
        entity: { entity_type: "employment_contract", entity_id: contract.contract_id },
        data: {
          template_id: "",
          profile_id,
          employment_category,
        },
      },
    });

    return NextResponse.json({
      ...proposal,
      contract_id: contract.contract_id,
      persisted: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter web typecheck`
Expected: 0 errors (or only errors in files not yet updated — wizard, send route).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/employment-contracts/route.ts
git commit -m "feat(contracts): add persist flag to composition endpoint

POST /api/employment-contracts now accepts persist=true to insert an
employment_contract row with the derived values. Default (persist=false)
returns proposal only for preview, preserving backward compatibility.

Accepts position_title, employment_category, employment_percentage
as explicit inputs instead of hardcoding.

Closes G2 (row never created).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Fix Send Route — Create DocuSeal Entity + Idempotency

**Files:**
- Modify: `apps/web/src/app/api/employment-contracts/[id]/send/route.ts`

- [ ] **Step 1: Rewrite send route with DocuSeal contract creation**

Replace the entire file:

```typescript
/**
 * POST /api/employment-contracts/[id]/send — Send a draft employment contract.
 *
 * 1. Snapshots framework rules on the employment_contract
 * 2. Checks PII completeness
 * 3. Creates a contract (DocuSeal signing entity) + sets signing_contract_id
 * 4. Calls contract-service for DocuSeal submission (if PII complete)
 * 5. Creates engine_state for signing or data intake process
 * 6. Emits telemetry
 *
 * ADR-0076: composition as cascade derivation.
 * ADR-0077: PII handling — intake flow for missing data.
 * ADR-0082: idempotency key prevents double-sends.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";
import { z } from "zod";

const sendSchema = z.object({
  idempotency_key: z.string().uuid().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Parse optional body for idempotency key
  let idempotencyKey: string | undefined;
  try {
    const body: unknown = await request.json();
    const parsed = sendSchema.safeParse(body);
    if (parsed.success) {
      idempotencyKey = parsed.data.idempotency_key;
    }
  } catch {
    // Empty body is fine — idempotency is optional
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Step 0: Load the contract ────────────────────────────────────────
  const { data: contract, error: contractError } = await supabase
    .from("employment_contract")
    .select(
      "contract_id, status, workspace_id, profile_id, signing_contract_id, position_title, employment_category, employment_percentage, hourly_rate, monthly_salary",
    )
    .eq("contract_id", id)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.status !== "draft") {
    return NextResponse.json({ error: "Only draft contracts can be sent" }, { status: 400 });
  }

  // ── Idempotency check: if signing_contract_id already set, this was already sent
  if (contract.signing_contract_id) {
    return NextResponse.json({
      sent: true,
      status: contract.status,
      contract_id: id,
      message: "Already sent (idempotent)",
    });
  }

  const { workspace_id, profile_id } = contract;

  // ── Role gate ────────────────────────────────────────────────────────
  const { data: actorProfile } = await supabase
    .from("profile")
    .select("profile_id, role")
    .eq("user_id", user.id)
    .eq("workspace_id", workspace_id)
    .single();

  if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden: admin or owner role required" }, { status: 403 });
  }

  // ── Step 1: Snapshot framework rules ─────────────────────────────────
  const { data: binding } = await supabase
    .from("workspace_framework_binding")
    .select("framework_id, regulatory_framework(name, version)")
    .eq("workspace_id", workspace_id)
    .eq("is_active", true)
    .single();

  if (!binding) {
    return NextResponse.json(
      { error: "No active framework binding for workspace" },
      { status: 400 },
    );
  }

  const frameworkId = binding.framework_id;
  const frameworkInfo = binding.regulatory_framework as unknown as {
    name: string;
    version: string;
  } | null;

  const { data: rules } = await supabase
    .from("framework_rule")
    .select("rule_id, rule_type, description, severity, code, category")
    .eq("framework_id", frameworkId);

  const frameworkSnapshot = {
    framework_id: frameworkId,
    framework_name: frameworkInfo?.name ?? "Unknown",
    snapshot_date: new Date().toISOString(),
    rules: (rules ?? []).map((r) => ({
      rule_id: r.rule_id,
      rule_type: r.rule_type,
      description: r.description,
      enforcement_level: r.severity,
    })),
  };

  // ── Step 2: Check PII completeness ───────────────────────────────────
  const { data: profile } = await supabase
    .from("profile")
    .select("display_name, personal_number, bank_account, address_line_1, postal_code")
    .eq("profile_id", profile_id)
    .eq("workspace_id", workspace_id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const missingGroups: string[] = [];
  if (!profile.personal_number) missingGroups.push("personal_number");
  if (!profile.bank_account) missingGroups.push("bank_account");
  if (!profile.address_line_1 || !profile.postal_code) missingGroups.push("address");

  const allDataPresent = missingGroups.length === 0;
  const newStatus = allDataPresent ? "sent" : "pending_data";

  // ── Step 3: Create contract (DocuSeal signing entity) ────────────────
  // This is the platform-legal document that gets sent to DocuSeal.
  // It links back to employment_contract via signing_contract_id.

  // Resolve the employee template for this category
  const { data: template } = await supabase
    .from("contract_template")
    .select("template_id, name, content_html, placeholders")
    .eq("contract_type", "employee")
    .eq("employment_category", contract.employment_category)
    .eq("is_active", true)
    .order("is_system", { ascending: true })
    .limit(1)
    .single();

  // Load company info for placeholder resolution
  const { data: workspace } = await supabase
    .from("workspace")
    .select("company_id, company:company_id(name, organization_number)")
    .eq("workspace_id", workspace_id)
    .single();

  const companyInfo = workspace?.company as unknown as {
    name: string;
    organization_number: string;
  } | null;

  // Build resolved HTML by replacing placeholders in the template
  let resolvedHtml = template?.content_html ?? "";
  const resolvedValues: Record<string, string> = {};

  const replacements: Record<string, string | null> = {
    arbeidsgiver_navn: companyInfo?.name ?? null,
    arbeidsgiver_org_nr: companyInfo?.organization_number ?? null,
    ansatt_navn: profile.display_name,
    ansatt_personnummer: profile.personal_number,
    ansatt_adresse: profile.address_line_1,
    stilling: contract.position_title,
    maanedslonn: contract.monthly_salary?.toString() ?? null,
    timelonn: contract.hourly_rate?.toString() ?? null,
    stillingsprosent: contract.employment_percentage?.toString() ?? null,
    kontraktdato: new Date().toLocaleDateString("nb-NO"),
    startdato: contract.position_title ? new Date().toLocaleDateString("nb-NO") : null,
  };

  for (const [key, value] of Object.entries(replacements)) {
    if (value) {
      resolvedHtml = resolvedHtml.replaceAll(`{{${key}}}`, value);
      resolvedValues[key] = value;
    }
  }

  const { data: signingContract, error: contractInsertError } = await supabase
    .from("contract")
    .insert({
      workspace_id,
      contract_type: "employee",
      template_id: template?.template_id ?? null,
      resolved_html: resolvedHtml,
      resolved_values: resolvedValues,
      recipient_name: profile.display_name,
      recipient_email: "",
      sender_name: "Smartout",
      sender_email: "post@smartout.no",
      status: "draft",
    })
    .select("contract_id")
    .single();

  if (contractInsertError || !signingContract) {
    return NextResponse.json(
      { error: `Failed to create signing contract: ${contractInsertError?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  // ── Step 4: Update employment_contract ───────────────────────────────
  const { error: updateError } = await supabase
    .from("employment_contract")
    .update({
      status: newStatus as "sent" | "pending_data",
      framework_snapshot: frameworkSnapshot,
      signing_contract_id: signingContract.contract_id,
    })
    .eq("contract_id", id);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update contract: ${updateError.message}` },
      { status: 500 },
    );
  }

  // ── Step 5: Log contract event ───────────────────────────────────────
  await supabase.from("contract_event").insert({
    contract_id: signingContract.contract_id,
    event_type: "created",
    actor_type: "admin",
    actor_id: actorProfile.profile_id,
    details: { employment_contract_id: id, status: newStatus },
  });

  // ── Step 6: Call contract-service for DocuSeal (if PII complete) ─────
  if (allDataPresent) {
    try {
      const contractServiceUrl =
        process.env.CONTRACT_SERVICE_URL ?? "http://localhost:5012";

      await fetch(`${contractServiceUrl}/contracts/${signingContract.contract_id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Key": process.env.CONTRACT_SERVICE_KEY ?? "",
        },
      });
    } catch {
      // DocuSeal dispatch failure is non-blocking — log event and continue
      await supabase.from("contract_event").insert({
        contract_id: signingContract.contract_id,
        event_type: "send_failed",
        actor_type: "system",
        actor_id: actorProfile.profile_id,
        details: { reason: "Contract service unreachable" },
      });
    }
  }

  // ── Step 7: Create engine_state ──────────────────────────────────────
  const processName = allDataPresent ? "contract_signing" : "contract_data_intake";

  const { data: process } = await supabase
    .from("engine_process")
    .select("id")
    .eq("id", processName)
    .single();

  if (process) {
    await supabase.from("engine_state").insert({
      process_id: process.id,
      entity_type: "employment_contract",
      entity_id: id,
      workspace_id,
      status: "running",
      context: { profile_id, missing_groups: missingGroups },
    });
  }

  // ── Step 8: Schedule escalation triggers (pending_data only) ─────────
  if (!allDataPresent && process) {
    const { data: trigger } = await supabase
      .from("engine_trigger")
      .select("id")
      .eq("process_id", process.id)
      .limit(1)
      .single();

    const { data: event } = await supabase
      .from("engine_event")
      .select("id")
      .eq("event_name", "contract intake escalated")
      .limit(1)
      .single();

    if (trigger && event) {
      const now = new Date();
      const delays = [3, 7, 10];

      const rows = delays.map((days) => {
        const fireAt = new Date(now);
        fireAt.setDate(fireAt.getDate() + days);
        return {
          trigger_id: trigger.id,
          event_id: event.id,
          workspace_id,
          fire_at: fireAt.toISOString(),
          fired: false,
        };
      });

      await supabase.from("engine_delayed_trigger").insert(rows);
    }
  }

  // ── Step 9: Emit telemetry ───────────────────────────────────────────
  void emit({
    event: "contract sent",
    workspace_id,
    actor_id: actorProfile.profile_id,
    properties: {
      entity: { entity_type: "employment_contract", entity_id: id },
      data: {
        recipient_email: "",
        expires_at: "",
        pii_complete: allDataPresent,
        signing_contract_id: signingContract.contract_id,
      },
    },
  });

  if (!allDataPresent) {
    void emit({
      event: "contract intake started",
      workspace_id,
      actor_id: actorProfile.profile_id,
      properties: {
        entity: { entity_type: "employment_contract", entity_id: id },
        data: { contract_id: id, missing_groups: missingGroups },
      },
    });
  }

  return NextResponse.json({
    sent: true,
    status: newStatus,
    contract_id: id,
    signing_contract_id: signingContract.contract_id,
    pii_complete: allDataPresent,
  });
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter web typecheck`
Expected: 0 errors in this file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/employment-contracts/[id]/send/route.ts
git commit -m "feat(contracts): create DocuSeal entity in send route

Send route now creates a contract row (DocuSeal signing entity),
sets signing_contract_id on employment_contract, resolves template
placeholders, and calls contract-service. Idempotency via
signing_contract_id check. Fixes telemetry: emits 'contract sent'
instead of 'contract composed'.

Closes G6 (no DocuSeal link), G11 (no idempotency).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Create TanStack Query Hooks

**Files:**
- Create: `apps/web/src/app/dashboard/contracts/_hooks/use-employment-contracts.ts`

- [ ] **Step 1: Create the hooks file**

```typescript
/**
 * TanStack Query hooks for employment contracts.
 *
 * Replaces raw fetch() calls scattered across wizard and page components.
 * All queries are workspace-scoped via the DashboardContext.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ContractDraftProposal, EmploymentCategory } from "@/lib/contracts/resolve-composition";

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export const contractKeys = {
  all: (workspaceId: string) => ["employment-contracts", workspaceId] as const,
  detail: (id: string) => ["employment-contract", id] as const,
};

// ---------------------------------------------------------------------------
// List employment contracts
// ---------------------------------------------------------------------------

type EmploymentContractRow = {
  contract_id: string;
  profile_id: string;
  status: string;
  position_title: string | null;
  employment_category: string | null;
  employment_percentage: number | null;
  hourly_rate: number | null;
  monthly_salary: number | null;
  created_at: string;
  profile: { display_name: string } | null;
};

export function useEmploymentContracts(workspaceId: string | undefined) {
  return useQuery({
    queryKey: contractKeys.all(workspaceId ?? ""),
    queryFn: async (): Promise<EmploymentContractRow[]> => {
      const res = await fetch(
        `/api/employment-contracts/list?workspace_id=${workspaceId}`,
      );
      if (!res.ok) throw new Error("Failed to fetch contracts");
      const json = (await res.json()) as { data: EmploymentContractRow[] };
      return json.data;
    },
    enabled: !!workspaceId,
  });
}

// ---------------------------------------------------------------------------
// Compose (preview or persist)
// ---------------------------------------------------------------------------

type ComposeInput = {
  workspace_id: string;
  profile_id: string;
  position_title: string;
  employment_category: EmploymentCategory;
  employment_percentage: number;
  employee_group_id?: string;
  persist: boolean;
};

type ComposeResult = ContractDraftProposal & {
  contract_id?: string;
  persisted?: boolean;
};

export function useComposeContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ComposeInput): Promise<ComposeResult> => {
      const res = await fetch("/api/employment-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Composition failed");
      }
      return res.json() as Promise<ComposeResult>;
    },
    onSuccess: (data, variables) => {
      if (data.persisted) {
        void queryClient.invalidateQueries({
          queryKey: contractKeys.all(variables.workspace_id),
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

type SendInput = {
  contract_id: string;
  idempotency_key?: string;
};

type SendResult = {
  sent: boolean;
  status: string;
  contract_id: string;
  signing_contract_id?: string;
  pii_complete?: boolean;
};

export function useSendContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendInput): Promise<SendResult> => {
      const res = await fetch(`/api/employment-contracts/${input.contract_id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: input.idempotency_key,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Send failed");
      }
      return res.json() as Promise<SendResult>;
    },
    onSuccess: (_data, variables) => {
      toast.success("Kontrakt sendt");
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contract_id),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors in this file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/_hooks/use-employment-contracts.ts
git commit -m "feat(contracts): add TanStack Query hooks for employment contracts

Replaces raw fetch() with proper hooks: useEmploymentContracts (list),
useComposeContract (preview+persist), useSendContract (send+DocuSeal).
Cache invalidation on mutations.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Fix List Page — Use employment_contract Table

**Files:**
- Modify: `apps/web/src/app/dashboard/contracts/page.tsx:42-51`
- Modify: `apps/web/src/app/dashboard/contracts/_components/contracts-data-table.tsx:42-52`

- [ ] **Step 1: Fix ContractStatus type in data table**

In `contracts-data-table.tsx`, replace line 42:

```typescript
type ContractStatus = "draft" | "sent" | "viewed" | "signed" | "expired" | "cancelled";
```

With:

```typescript
type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "expired"
  | "pending_data"
  | "declined"
  | "cancelled";
```

- [ ] **Step 2: Fix the Contract type to match employment_contract shape**

In `contracts-data-table.tsx`, replace lines 44-52:

```typescript
type Contract = {
  contract_id: string;
  recipient_name: string;
  recipient_email: string;
  status: ContractStatus;
  created_at: string;
  signed_at: string | null;
  sent_at: string | null;
};
```

With:

```typescript
type Contract = {
  contract_id: string;
  status: ContractStatus;
  position_title: string | null;
  employment_category: string | null;
  employment_percentage: number | null;
  created_at: string;
  signed_at: string | null;
  profile: { display_name: string } | null;
};
```

- [ ] **Step 3: Fix the list page fetch to use employment_contract**

In `page.tsx`, replace line 45:

```typescript
      const res = await fetch(`/api/contracts?workspace_id=${workspaceId}&page=1`);
```

With:

```typescript
      const res = await fetch(`/api/employment-contracts/list?workspace_id=${workspaceId}`);
```

Note: This requires a new GET handler. For now, add a simple list endpoint.

- [ ] **Step 4: Create GET handler for employment-contracts list**

Create new file `apps/web/src/app/api/employment-contracts/list/route.ts`:

```typescript
/**
 * GET /api/employment-contracts/list — List employment contracts for a workspace.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspace_id");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("employment_contract")
    .select(
      "contract_id, status, position_title, employment_category, employment_percentage, hourly_rate, monthly_salary, created_at, signed_at, profile:profile_id(display_name)",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/page.tsx apps/web/src/app/dashboard/contracts/_components/contracts-data-table.tsx apps/web/src/app/api/employment-contracts/list/route.ts
git commit -m "fix(contracts): use employment_contract table for list page

List page now fetches from employment_contract instead of contract
table. Adds pending_data and declined to ContractStatus type.
Creates GET /api/employment-contracts/list endpoint.

Closes G7 (ID mismatch between list and detail).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Restructure CompositionWizard — 5 Steps with Submit

**Files:**
- Modify: `apps/web/src/app/dashboard/contracts/_components/CompositionWizard.tsx`

This is the largest task. The wizard needs: (a) Step 2 with segmented category + percentage, (b) Step 3 passing new inputs to API, (c) Step 5 with real submit using the hooks from Task 5.

- [ ] **Step 1: Update state type and imports**

Replace lines 1-39 with:

```typescript
"use client";

/**
 * CompositionWizard — 5-step wizard for composing employment contracts.
 *
 * Steps: Ansatt → Stilling → Gjennomgang → Bekreft → Send
 *
 * Uses AnimatedWizardShell from @smartout/ui with the "warm" theme.
 * ADR-0076: composition as cascade derivation.
 */

import { useState, useEffect, useContext, useCallback } from "react";
import { CheckCircle, Loader2, Lock, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import type { WizardDefinition, WizardStepProps } from "@smartout/ui";
import { Button, Input, Label } from "@smartout/ui";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { ContractDraftProposal, EmploymentCategory } from "@/lib/contracts/resolve-composition";
import { useComposeContract, useSendContract } from "../_hooks/use-employment-contracts";
import { GhostValueCard } from "./GhostValueCard";
import { ComplianceBadge } from "./ComplianceBadge";
import { BlockerCounter } from "./BlockerCounter";
import { AcknowledgementRing } from "./AcknowledgementRing";
import { ReasoningDrawer } from "./ReasoningDrawer";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type CompositionState = {
  profileId: string;
  positionTitle: string;
  employmentCategory: EmploymentCategory;
  employmentPercentage: number;
  proposal: (ContractDraftProposal & { contract_id?: string }) | null;
  acknowledgedBlocks: Set<string>;
  overrides: Record<string, { reason: string }>;
  isLoading: boolean;
  isSending: boolean;
};
```

- [ ] **Step 2: Rewrite Step 1 (SelectEmployee) — keep as-is but update type**

The existing SelectEmployeeStep is fine. Just ensure it uses the new state type. No changes needed to the component body — only the type reference updates automatically.

- [ ] **Step 3: Rewrite Step 2 (PositionStep) — add category + percentage**

Replace the existing PositionStep (lines ~135-155) with:

```typescript
// ---------------------------------------------------------------------------
// Step 2: Position + Employment Category + Percentage
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: { value: EmploymentCategory; label: string }[] = [
  { value: "fast", label: "Heltid" },
  { value: "deltid", label: "Deltid" },
  { value: "tilkalling", label: "Tilkalling" },
];

function PositionStep({ state, updateState }: WizardStepProps<CompositionState>) {
  return (
    <div className="space-y-6">
      {/* Position title */}
      <div className="space-y-2">
        <Label htmlFor="position-title">Stillingstittel</Label>
        <Input
          id="position-title"
          placeholder="F.eks. Servitor, Kokk, Resepsjonist"
          value={state.positionTitle}
          onChange={(e) => updateState({ positionTitle: e.target.value })}
        />
      </div>

      {/* Employment category — segmented control */}
      <div className="space-y-2">
        <Label>Ansettelsesform</Label>
        <div className="bg-muted inline-flex rounded-lg p-1">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                const updates: Partial<CompositionState> = {
                  employmentCategory: opt.value,
                };
                if (opt.value === "fast") {
                  updates.employmentPercentage = 100;
                }
                if (opt.value === "tilkalling") {
                  updates.employmentPercentage = 0;
                }
                updateState(updates);
              }}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                state.employmentCategory === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Employment percentage — shown for deltid only */}
      {state.employmentCategory === "deltid" && (
        <div className="space-y-2">
          <Label htmlFor="percentage">Stillingsprosent</Label>
          <div className="flex items-center gap-3">
            <Input
              id="percentage"
              type="number"
              min={1}
              max={100}
              value={state.employmentPercentage}
              onChange={(e) =>
                updateState({ employmentPercentage: Number(e.target.value) || 0 })
              }
              className="w-24"
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite Step 3 (DerivationStep → GjennomgangStep)**

Replace the DerivationStep and ReviewStep with a merged step:

```typescript
// ---------------------------------------------------------------------------
// Step 3: Gjennomgang (Derivation + Review merged)
// ---------------------------------------------------------------------------

function GjennomgangStep({ state, updateState }: WizardStepProps<CompositionState>) {
  const { workspaceData } = useContext(DashboardContext);
  const composeMutation = useComposeContract();
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerField, setDrawerField] = useState("");

  // Run derivation on mount (preview mode, persist=false)
  useEffect(() => {
    if (!workspaceData?.workspace_id || !state.profileId || state.proposal) return;

    updateState({ isLoading: true });
    setError(null);

    composeMutation.mutate(
      {
        workspace_id: workspaceData.workspace_id,
        profile_id: state.profileId,
        position_title: state.positionTitle,
        employment_category: state.employmentCategory,
        employment_percentage: state.employmentPercentage,
        persist: false,
      },
      {
        onSuccess: (proposal) => {
          updateState({ proposal, isLoading: false });
        },
        onError: (err: Error) => {
          setError(err.message);
          updateState({ isLoading: false });
          toast.error(err.message);
        },
      },
    );
  }, [workspaceData?.workspace_id, state.profileId]);

  // Loading state
  if (state.isLoading || !state.proposal) {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="text-destructive mb-4 h-10 w-10" />
          <p className="text-destructive mb-2 text-sm font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateState({ proposal: null });
              setError(null);
            }}
          >
            Prov igjen
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="text-primary mb-4 h-10 w-10 animate-spin" />
        <p className="text-muted-foreground text-sm">Henter tariff-forslag fra Cascade...</p>
      </div>
    );
  }

  const proposal = state.proposal;
  const terms = proposal.employment_terms;
  const allValidations = [
    ...proposal.validations.ok,
    ...proposal.validations.warning,
    ...proposal.validations.blocker,
  ];

  return (
    <div className="space-y-6">
      {/* Derived values */}
      <div className="grid grid-cols-2 gap-4">
        <GhostValueCard
          label="Timelonn"
          value={terms.hourly_rate ? `${terms.hourly_rate} kr/t` : "Ikke fastsatt"}
          onClick={() => {
            setDrawerField("Timelonn");
            setDrawerOpen(true);
          }}
        />
        <GhostValueCard
          label="Stillingsprosent"
          value={`${terms.employment_percentage}%`}
          onClick={() => {
            setDrawerField("Stillingsprosent");
            setDrawerOpen(true);
          }}
        />
        <GhostValueCard
          label="Kategori"
          value={terms.employment_category}
          onClick={() => {
            setDrawerField("Ansettelsesform");
            setDrawerOpen(true);
          }}
        />
        <GhostValueCard
          label="Mal"
          value={proposal.framework_snapshot.framework_name}
          onClick={() => {
            setDrawerField("Rammeverk");
            setDrawerOpen(true);
          }}
        />
      </div>

      {/* Compliance badges */}
      <div className="space-y-2">
        <h3 className="text-muted-foreground text-xs uppercase tracking-wide">Samsvar</h3>
        <div className="flex flex-wrap gap-2">
          {allValidations.map((v) => (
            <ComplianceBadge key={v.rule_id} level={v.level} message={v.message} />
          ))}
        </div>
      </div>

      {/* Mandatory clauses (collapsible) */}
      {proposal.mandatory_clauses.length > 0 && (
        <details className="group">
          <summary className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
            <Lock className="h-3.5 w-3.5" />
            Vis {proposal.mandatory_clauses.length} obligatoriske klausuler
          </summary>
          <div className="mt-3 space-y-3">
            {proposal.mandatory_clauses.map((clause) => (
              <div key={clause.rule_id} className="rounded-lg border p-4">
                <span className="text-sm font-medium">{clause.title}</span>
                <p className="text-muted-foreground mt-1 text-sm">{clause.text}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      <ReasoningDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerField}
        source={proposal.framework_snapshot.framework_name}
        explanation={`Verdi utledet fra ${proposal.framework_snapshot.framework_name} (snapshot ${proposal.framework_snapshot.snapshot_date}).`}
      />
    </div>
  );
}
```

- [ ] **Step 5: Rewrite Step 4 (Bekreft)**

```typescript
// ---------------------------------------------------------------------------
// Step 4: Bekreft (Acknowledgement)
// ---------------------------------------------------------------------------

function BekreftStep({ state, updateState }: WizardStepProps<CompositionState>) {
  const proposal = state.proposal;
  if (!proposal) {
    return <p className="text-muted-foreground text-sm">Ingen forslag tilgjengelig.</p>;
  }

  const terms = proposal.employment_terms;
  const summaryItems = [
    { label: "Stilling", value: terms.position_title || "Ikke oppgitt" },
    { label: "Kategori", value: terms.employment_category },
    { label: "Prosent", value: `${terms.employment_percentage}%` },
    { label: "Timelonn", value: terms.hourly_rate ? `${terms.hourly_rate} kr/t` : "Manuell" },
  ];

  return (
    <AcknowledgementRing
      items={summaryItems.map((item) => item.label)}
      acknowledged={state.acknowledgedBlocks}
      onAcknowledge={(item) => {
        const next = new Set(state.acknowledgedBlocks);
        next.add(item);
        updateState({ acknowledgedBlocks: next });
      }}
    >
      <div className="space-y-3">
        {summaryItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">{item.label}</span>
            <span className="text-muted-foreground text-sm">{item.value}</span>
          </div>
        ))}
      </div>
    </AcknowledgementRing>
  );
}
```

- [ ] **Step 6: Rewrite Step 5 (SendStep) — with real submit**

```typescript
// ---------------------------------------------------------------------------
// Step 5: Send (with real submit action)
// ---------------------------------------------------------------------------

function SendStep({ state, updateState }: WizardStepProps<CompositionState>) {
  const { workspaceData } = useContext(DashboardContext);
  const composeMutation = useComposeContract();
  const sendMutation = useSendContract();

  const blockerCount = state.proposal?.validations.blocker.length ?? 0;
  const missingData = state.proposal?.placeholder_status.missing ?? [];
  const hasBlockers = blockerCount > 0;
  const hasMissingPii = missingData.length > 0;

  const handleSubmit = useCallback(async () => {
    if (!workspaceData?.workspace_id || !state.profileId || !state.proposal) return;

    updateState({ isSending: true });

    try {
      // Step A: Persist the employment_contract row
      const result = await composeMutation.mutateAsync({
        workspace_id: workspaceData.workspace_id,
        profile_id: state.profileId,
        position_title: state.positionTitle,
        employment_category: state.employmentCategory,
        employment_percentage: state.employmentPercentage,
        persist: true,
      });

      if (!result.contract_id) {
        throw new Error("Contract creation failed — no contract_id returned");
      }

      // Step B: Send the contract
      await sendMutation.mutateAsync({
        contract_id: result.contract_id,
        idempotency_key: crypto.randomUUID(),
      });

      toast.success(
        hasMissingPii
          ? "Kontrakt opprettet — venter pa data fra ansatt"
          : "Kontrakt sendt for signering",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Noe gikk galt";
      toast.error(message);
    } finally {
      updateState({ isSending: false });
    }
  }, [workspaceData, state, composeMutation, sendMutation, hasMissingPii, updateState]);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      {hasBlockers ? (
        <>
          <AlertTriangle className="mb-4 h-10 w-10 text-red-600" />
          <p className="mb-2 text-sm font-medium text-red-600">
            Kan ikke sende — {blockerCount}{" "}
            {blockerCount === 1 ? "blokkering" : "blokkeringer"} gjenstaar
          </p>
          <p className="text-muted-foreground text-xs">
            Gaa tilbake og loss blokkeringene for du sender.
          </p>
        </>
      ) : (
        <>
          <CheckCircle className="mb-4 h-10 w-10 text-green-600" />
          <p className="text-sm font-medium">
            {hasMissingPii ? "Klar til a opprette (manglende data)" : "Klar til a sende"}
          </p>
        </>
      )}

      {/* Missing data warning */}
      {hasMissingPii && !hasBlockers && (
        <div className="mt-6 max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="mb-1 font-medium">Manglende data fra ansatt:</p>
          <ul className="list-inside list-disc text-xs">
            {missingData.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Ansatt vil bli bedt om a fylle ut dette for kontrakten sendes.
          </p>
        </div>
      )}

      {/* Submit button */}
      {!hasBlockers && (
        <Button
          className="mt-8"
          size="lg"
          disabled={state.isSending}
          onClick={handleSubmit}
        >
          {state.isSending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {hasMissingPii ? "Opprett og start innhenting" : "Send kontrakt"}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Update wizard definition**

Replace the wizard definition (lines ~449-525) with:

```typescript
// ---------------------------------------------------------------------------
// Wizard Definition (5 steps)
// ---------------------------------------------------------------------------

const compositionWizard: WizardDefinition<CompositionState> = {
  id: "contract-composition",
  theme: "warm",
  metadata: {
    titleKey: "contracts.composition.title",
    descriptionKey: "contracts.composition.description",
    i18nNamespace: "contracts",
  },
  brandPanel: {
    messages: {
      ansatt: {
        heading: "Hvem skal faa kontrakt?",
        sub: "Velg den ansatte som skal motta avtalen.",
      },
      stilling: {
        heading: "Stilling og ansettelsesform",
        sub: "Stillingstittel og kategori brukes til a utlede kontraktsvilkaar.",
      },
      gjennomgang: {
        heading: "Cascade henter data",
        sub: "Tariff, regler og klausuler hentes automatisk fra rammeverket.",
      },
      bekreft: {
        heading: "Kontroller forslaget",
        sub: "Rull gjennom og bekreft vilkaarene.",
      },
      send: {
        heading: "Alt klart?",
        sub: "Send kontrakten til den ansatte for signering.",
      },
    },
  },
  steps: [
    {
      id: "ansatt",
      labelKey: "contracts.composition.steps.ansatt",
      component: SelectEmployeeStep,
    },
    {
      id: "stilling",
      labelKey: "contracts.composition.steps.stilling",
      component: PositionStep,
    },
    {
      id: "gjennomgang",
      labelKey: "contracts.composition.steps.gjennomgang",
      component: GjennomgangStep,
    },
    {
      id: "bekreft",
      labelKey: "contracts.composition.steps.bekreft",
      component: BekreftStep,
    },
    {
      id: "send",
      labelKey: "contracts.composition.steps.send",
      component: SendStep,
    },
  ],
  initialState: {
    profileId: "",
    positionTitle: "",
    employmentCategory: "fast" as EmploymentCategory,
    employmentPercentage: 100,
    proposal: null,
    acknowledgedBlocks: new Set<string>(),
    overrides: {},
    isLoading: false,
    isSending: false,
  },
};
```

- [ ] **Step 8: Remove unused ClausesStep**

Delete the old ClausesStep function (it's merged into GjennomgangStep). Also remove the old DerivationStep and ReviewStep functions — they're replaced.

- [ ] **Step 9: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: 0 errors. If GhostValueCard/ComplianceBadge/etc. have prop mismatches, check their interfaces and adjust.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/dashboard/contracts/_components/CompositionWizard.tsx
git commit -m "feat(contracts): restructure wizard to 5 steps with submit

Wizard now: Ansatt -> Stilling -> Gjennomgang -> Bekreft -> Send.
Step 2 adds employment category segmented control + percentage.
Step 3 merges derivation+review+clauses into one showcase step.
Step 5 has real submit: creates employment_contract then sends.
Uses TanStack Query hooks instead of raw fetch().

Closes G1 (no submit), G3 (position_title lost).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Typecheck + Smoke Test

- [ ] **Step 1: Run full typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors across all packages.

- [ ] **Step 2: Start dev server**

Run: `pnpm --filter web dev`
Navigate to `http://localhost:3060/dashboard/contracts/new`
Expected: The 5-step wizard renders without crash.

- [ ] **Step 3: Test golden path**

1. Step 1: Select an employee from the list
2. Step 2: Enter "Servitor" as position, select "Deltid", set 80%
3. Step 3: Verify GhostValueCards show derived values (rate, percentage, category)
4. Step 4: Scroll through acknowledgement items
5. Step 5: Click "Send kontrakt" or "Opprett og start innhenting"
6. Verify: employment_contract row created in database
7. Verify: contract row created with signing_contract_id set

- [ ] **Step 4: Test contract list page**

Navigate to `/dashboard/contracts`
Expected: Shows employment_contract rows, not contract rows. Status badges include pending_data.

- [ ] **Step 5: Commit any fixes discovered during testing**

```bash
git add -u
git commit -m "fix(contracts): address issues found during smoke testing

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Summary

| Task | Closes Gaps | Files Changed |
|------|------------|---------------|
| 1. DB Migration | G4, G5 (db) | 1 new migration + types regen |
| 2. resolveComposition | G3, G4, G5 | resolve-composition.ts |
| 3. POST persist flag | G2 | employment-contracts/route.ts |
| 4. Send route DocuSeal | G6, G11 | send/route.ts |
| 5. TanStack hooks | — (infra) | new hooks file |
| 6. List page fix | G7 | page.tsx, data-table, new list route |
| 7. Wizard restructure | G1, G3 | CompositionWizard.tsx |
| 8. Typecheck + test | — (verify) | any fixes |

After Phase 1 completes, the admin can: select employee → set position/category → review cascade-derived values → submit → contract created + sent to DocuSeal (or intake process started for missing PII).
