---
title: "B2B Contract Onboarding — Implementation Plan"
status: draft
updated: 2026-03-30
created: 2026-03-30
module: contracts
tags: [contracts, onboarding, implementation-plan]
---

# B2B Contract Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Send B2B contracts (SaaS license) directly from the onboarding flow — contract is sent the moment the customer confirms, email plings before they hang up with Lise.

**Architecture:** Customer document filled live during onboarding (scrape + Lise). Fullscreen editable form. On confirm → API route → contract-service → DocuSeal → email. Dashboard shows banner until signed.

**Tech Stack:** Next.js API route, contract-service (Fastify/DocuSeal), Supabase, React (onboarding sections)

**Design doc:** `docs/plans/2026-03-30-b2b-contract-onboarding-design.md`

---

### Task 1: Database migration — clause_library industry_codes

**Files:**

- Create: `supabase/migrations/20260330100000_clause_library_industry_codes.sql`

**Step 1: Write the migration**

```sql
-- Add industry_codes to clause_library for branch-specific clause filtering
ALTER TABLE public.clause_library
  ADD COLUMN IF NOT EXISTS industry_codes text[] DEFAULT '{}';

COMMENT ON COLUMN public.clause_library.industry_codes IS
  'NACE codes this clause applies to. Empty = universal (all industries).';

-- Index for array overlap queries
CREATE INDEX IF NOT EXISTS idx_clause_library_industry_codes
  ON public.clause_library USING GIN (industry_codes);
```

**Step 2: Seed industry codes on existing clauses**

In the same migration file, add UPDATE statements mapping the 24 existing clauses to NACE codes. Check existing clause names first:

```sql
-- Query to find clause IDs: SELECT clause_id, title FROM clause_library;
-- Universal clauses (empty = all industries): GDPR, HMS, arbeidsmiljo
-- 56.x (Servering): HACCP, matallergier, alkoholservering
-- 55.x (Hotell): romsstadning, nattevakt, brannsikkerhet
-- 47.x (Dagligvare): varemottak, kassarutiner
```

Map clauses by reading `supabase/migrations/20260228150000_seed_clause_library.sql` to find exact clause_ids and titles, then write appropriate UPDATE statements.

**Step 3: Run migration locally**

Run: `npx supabase db reset` or `npx supabase migration up`
Expected: Migration applies cleanly

**Step 4: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: `clause_library` type now includes `industry_codes: string[] | null`

**Step 5: Commit**

```bash
git add supabase/migrations/20260330100000_clause_library_industry_codes.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add industry_codes to clause_library for branch-specific filtering"
```

---

### Task 2: API route — send contract from onboarding

**Files:**

- Create: `apps/web/src/app/api/onboarding/send-contract/route.ts`

**Step 1: Write the API route**

This route is called from the onboarding ContractSection when the customer confirms. It:

1. Gets the authenticated user
2. Receives contract data (business info, template_id, etc.)
3. Creates a contract via contract-service POST /contracts
4. Sends it via contract-service POST /contracts/:id/send
5. Returns contract_id and signing_url

```typescript
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { callContractService, isContractServiceConfigured } from "@/lib/contract-service";
import { z } from "zod";

const SendContractSchema = z.object({
  templateId: z.string().uuid(),
  workspaceId: z.string().uuid().optional(), // May not exist yet during onboarding
  recipientName: z.string().min(1),
  recipientEmail: z.string().email(),
  businessData: z.object({
    name: z.string(),
    legalName: z.string().optional(),
    orgNumber: z.string(),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    industry: z.string().optional(),
    industryCode: z.string().optional(),
    departments: z.array(z.string()).optional(),
  }),
});

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  const parsed = SendContractSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!isContractServiceConfigured()) {
    return NextResponse.json({ error: "Contract service not configured" }, { status: 503 });
  }

  const { templateId, workspaceId, recipientName, recipientEmail, businessData } = parsed.data;

  try {
    // 1. Create contract via contract-service
    const createRes = await callContractService("/contracts", {
      method: "POST",
      body: JSON.stringify({
        template_id: templateId,
        workspace_id: workspaceId ?? "00000000-0000-0000-0000-000000000000", // placeholder if no workspace yet
        contract_type: "client",
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        journey_type: "self_service",
        value_overrides: {
          kunde_navn: businessData.legalName || businessData.name,
          kunde_org_nr: businessData.orgNumber,
          kunde_kontakt: recipientName,
          kunde_epost: recipientEmail,
          avdelinger: businessData.departments?.join(", ") ?? "",
          arbeidssted_adresse: [businessData.address, businessData.postalCode, businessData.city]
            .filter(Boolean)
            .join(", "),
        },
        metadata: {
          source: "onboarding",
          user_id: user.id,
          industry_code: businessData.industryCode,
        },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      return NextResponse.json(
        { error: err.error ?? "Failed to create contract" },
        { status: 502 },
      );
    }

    const contract = await createRes.json();

    // 2. Send immediately via contract-service
    const sendRes = await callContractService(`/contracts/${contract.contract_id}/send`, {
      method: "POST",
      headers: { "X-User-Id": user.id },
    });

    if (!sendRes.ok) {
      const err = await sendRes.json();
      return NextResponse.json({ error: err.error ?? "Failed to send contract" }, { status: 502 });
    }

    const sendResult = await sendRes.json();

    return NextResponse.json({
      contractId: contract.contract_id,
      signingUrl: sendResult.signing_url,
      status: "sent",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Contract service error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Verify route compiles**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/app/api/onboarding/send-contract/route.ts
git commit -m "feat(api): add onboarding send-contract route"
```

---

### Task 3: CustomerDocumentView component

**Files:**

- Create: `apps/web/src/app/onboarding/sections/CustomerDocumentView.tsx`

**Step 1: Build the fullscreen editable document**

This is the big wow-moment component. Fullscreen form with three tiers of fields (MÅ HA / SKA HA / VILL HA) that auto-fill from scrape data and Lise.

Read `apps/web/src/app/onboarding/types.ts` for BusinessData interface.
Read `apps/web/src/app/onboarding/WizardContext.tsx` for available state + actions.

The component:

- Uses `useOnboarding()` to read/write business data
- Groups fields into 3 tiers with visual indicators (filled ●, empty ○)
- All fields are editable `<input>` elements
- Progressbar showing % of MÅ HA fields completed
- "Bekreft kontraktet" button enabled when all MÅ HA fields filled
- On confirm: calls `/api/onboarding/send-contract` then `completeSection("contract")`
- Shows success state: "Kontraktet er sendt! Sjekk e-posten din."

Key fields mapped to BusinessData:

- MÅ HA: email (from auth), name (pre-input), business.name, business.orgNumber, contactPerson (= user name)
- SKA HA: business.address, business.postalCode, business.city, business.phone, business.industry, departments
- VILL HA: business.website, business.employeeCount, season.name

Styling: dark theme matching onboarding (bg-zinc-950 / white text / white/[0.07] cards). Use existing `SectionReveal` + `RevealItem` wrappers.

**Step 2: Verify it compiles**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/sections/CustomerDocumentView.tsx
git commit -m "feat(onboarding): add CustomerDocumentView with live auto-fill"
```

---

### Task 4: Wire CustomerDocumentView into onboarding flow

**Files:**

- Modify: `apps/web/src/app/onboarding/sections/ContractSection.tsx`
- Modify: `apps/web/src/app/onboarding/hooks/useOnboardingState.ts`
- Modify: `apps/web/src/app/onboarding/types.ts`

**Step 1: Update ContractData type**

In `types.ts`, expand the `ContractData` interface:

```typescript
export interface ContractData {
  templateGenerated: boolean;
  previewUrl: string | null;
  contractId: string | null; // NEW: ID of sent contract
  contractSent: boolean; // NEW: whether contract has been sent
  signingUrl: string | null; // NEW: signing URL from DocuSeal
}
```

**Step 2: Update useOnboardingState initial contract state**

In `useOnboardingState.ts`, update the initial contract state to include new fields:

```typescript
const [contract, setContract] = useState({
  templateGenerated: false,
  previewUrl: null as string | null,
  contractId: null as string | null,
  contractSent: false,
  signingUrl: null as string | null,
});
```

Add a `updateContract` action and expose it.

**Step 3: Replace ContractSection content**

Replace the static preview in `ContractSection.tsx` with `CustomerDocumentView`:

```tsx
import { CustomerDocumentView } from "./CustomerDocumentView";

export function ContractSection() {
  return <CustomerDocumentView />;
}
```

**Step 4: Verify it compiles**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

**Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/sections/ContractSection.tsx \
        apps/web/src/app/onboarding/hooks/useOnboardingState.ts \
        apps/web/src/app/onboarding/types.ts
git commit -m "feat(onboarding): wire CustomerDocumentView into contract section"
```

---

### Task 5: Fetch branch-specific clauses for preview

**Files:**

- Create: `apps/web/src/app/api/onboarding/clauses/route.ts`

**Step 1: Write the clauses API route**

This route returns clauses matching a given NACE code (for the CustomerDocumentView preview).

```typescript
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";

export async function GET(request: NextRequest) {
  const industryCode = request.nextUrl.searchParams.get("industryCode");

  const admin = createAdminClient();

  let query = admin
    .from("clause_library")
    .select("clause_id, title, category, content_html")
    .eq("is_active", true)
    .order("sort_order");

  if (industryCode) {
    // Universal clauses (empty array) + matching industry
    query = query.or(`industry_codes.eq.{},industry_codes.cs.{${industryCode}}`);
  } else {
    // Only universal clauses
    query = query.eq("industry_codes", "{}");
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
```

**Step 2: Verify route compiles**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

**Step 3: Commit**

```bash
git add apps/web/src/app/api/onboarding/clauses/route.ts
git commit -m "feat(api): add clauses endpoint for branch-specific contract preview"
```

---

### Task 6: Link contract to workspace at finalization

**Files:**

- Modify: `apps/web/src/app/onboarding/hooks/useOnboardingState.ts`
- Modify: `supabase/functions/finalize-workspace/index.ts`

**Step 1: Pass contractId through finalize**

In `useOnboardingState.ts`, include `contract.contractId` in the finalize payload:

```typescript
const workspacePayload = {
  // ... existing fields ...
  contractId: contract.contractId, // Link the already-sent contract
};
```

**Step 2: Update finalize-workspace Edge Function**

In `supabase/functions/finalize-workspace/index.ts`, after workspace is finalized:

```typescript
// Link the onboarding contract to this workspace
if (workspaceData.contractId) {
  await adminClient
    .from("contract")
    .update({
      workspace_id: data, // the finalized workspace_id
      updated_at: new Date().toISOString(),
    })
    .eq("contract_id", workspaceData.contractId);

  // Set workspace contract_status
  await adminClient
    .from("workspace")
    .update({
      contract_status: "pending_contract",
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", data);
}
```

**Step 3: Verify it compiles**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

**Step 4: Commit**

```bash
git add apps/web/src/app/onboarding/hooks/useOnboardingState.ts \
        supabase/functions/finalize-workspace/index.ts
git commit -m "feat(onboarding): link contract to workspace at finalization"
```

---

### Task 7: Dashboard contract pending banner

**Files:**

- Create: `apps/web/src/components/dashboard/ContractPendingBanner.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

**Step 1: Create ContractPendingBanner**

```typescript
"use client";

import { FileText, X } from "lucide-react";
import { useState } from "react";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export function ContractPendingBanner() {
  const ctx = useWorkspaceOptional();
  const [dismissed, setDismissed] = useState(false);

  if (!ctx || ctx.workspace.contract_status !== "pending_contract" || dismissed) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 border-b border-orange-500/20 bg-orange-500/10 px-6 py-3">
      <FileText className="h-4 w-4 shrink-0 text-orange-400" />
      <p className="flex-1 text-sm text-orange-200">
        Du har et usignert kontrakt. Sjekk e-posten din for signeringslenken.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="rounded p-1 text-orange-400/60 transition-colors hover:bg-orange-500/10 hover:text-orange-400"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
```

**Step 2: Add banner to DashboardShell**

In `DashboardShell.tsx`, import and render the banner right after the header:

```tsx
import { ContractPendingBanner } from "./ContractPendingBanner";

// Inside the return, right after the closing </header> tag:
<ContractPendingBanner />;
```

**Step 3: Verify it compiles**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

**Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/ContractPendingBanner.tsx \
        apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(dashboard): add contract pending banner for unsigned contracts"
```

---

### Task 8: Select correct template based on industry

**Files:**

- Modify: `apps/web/src/app/onboarding/sections/CustomerDocumentView.tsx`

**Step 1: Add template selection logic**

The system has 2 templates:

- `c0000001-0000-0000-0000-000000000001` — Onboarding & Drift (implementation agreement)
- `c0000002-0000-0000-0000-000000000002` — SaaS Lisens (license + DPA)

For now, always use the SaaS Lisens template (the standard B2B agreement). Template selection based on sales context is a future enhancement.

Add a constant in CustomerDocumentView:

```typescript
const DEFAULT_B2B_TEMPLATE_ID = "c0000002-0000-0000-0000-000000000002";
```

Use this when calling the send-contract API.

**Step 2: Commit**

```bash
git add apps/web/src/app/onboarding/sections/CustomerDocumentView.tsx
git commit -m "feat(onboarding): use SaaS license template for B2B contracts"
```

---

### Task 9: Final integration test + typecheck

**Files:** None (verification only)

**Step 1: Full typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors across all 18 packages

**Step 2: Build check**

Run: `pnpm turbo build --filter=web`
Expected: Build succeeds

**Step 3: Manual test checklist**

1. Start onboarding → verify CustomerDocumentView renders at contract section
2. Fields auto-fill from scrape data
3. Edit a field manually → verify it persists
4. All MÅ HA fields filled → "Bekreft" button activates
5. Click "Bekreft" → contract sent (check contract-service logs)
6. Continue to done section → finalize workspace
7. Dashboard shows ContractPendingBanner
8. (Simulate webhook) → banner disappears when contract_status = 'active'

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(onboarding): integration fixes for contract flow"
```

---

## Summary

| Task | Component            | New/Modify   | Key file                                                        |
| ---- | -------------------- | ------------ | --------------------------------------------------------------- |
| 1    | DB migration         | New          | `supabase/migrations/20260330100000_*.sql`                      |
| 2    | API route            | New          | `apps/web/src/app/api/onboarding/send-contract/route.ts`        |
| 3    | CustomerDocumentView | New          | `apps/web/src/app/onboarding/sections/CustomerDocumentView.tsx` |
| 4    | Wire into flow       | Modify       | `ContractSection.tsx`, `useOnboardingState.ts`, `types.ts`      |
| 5    | Clauses API          | New          | `apps/web/src/app/api/onboarding/clauses/route.ts`              |
| 6    | Finalize link        | Modify       | `useOnboardingState.ts`, `finalize-workspace/index.ts`          |
| 7    | Dashboard banner     | New + Modify | `ContractPendingBanner.tsx`, `DashboardShell.tsx`               |
| 8    | Template selection   | Modify       | `CustomerDocumentView.tsx`                                      |
| 9    | Integration test     | Verify       | Full typecheck + build + manual test                            |

**Total:** 4 new files, 5 modified files, 1 migration
