---
title: Contract Management Workspace Tab — Implementation Plan
status: ready
updated: 2026-04-13
created: 2026-04-13
module: platform-admin
tags: [contracts, pricing, platform-admin, implementation]
---

# Contract Management Workspace Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty "Subscription" tab on the platform-admin workspace detail page with an "Avtaler" tab that shows contract status, editable pricing terms, and a contract list with actions.

**Architecture:** Extract the monolithic 1393-line `workspace-detail-client.tsx` into a thin tab shell + individual tab components. Add server-side fetching for contracts and pricing_terms. Create a new API endpoint for pricing_terms CRUD. Reuse the existing `ContractListClient` component for the contract list. No new database migration — use existing `pricing_terms` columns.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase admin client, shadcn/ui, `@smartout/telemetry`, TanStack Table (via existing DataTable)

**Spec:** [`docs/superpowers/specs/2026-04-13-contract-management-workspace-tab-design.md`](../specs/2026-04-13-contract-management-workspace-tab-design.md)

**Council:** APPROVE WITH CHANGES (2026-04-13). All 4 agents. Key decisions: defer JSONB columns, extract all tabs, tab name "Avtaler", reuse ContractListClient.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/OverviewTab.tsx` | Overview tab content extracted from workspace-detail-client.tsx |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/ChampionsTab.tsx` | Champions tab content |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/IntelligenceTab.tsx` | Intelligence tab content |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/CommunicationTab.tsx` | Communication tab content |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/NotesTab.tsx` | Notes tab content |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/ContractTab.tsx` | New "Avtaler" tab — status row, pricing editor, contract list |
| `apps/web/src/app/api/platform-admin/pricing-terms/route.ts` | GET + POST + PATCH for pricing terms |

### Modified Files

| File | Change |
|------|--------|
| `apps/web/src/app/platform-admin/workspaces/[id]/page.tsx` | Add contracts + pricing_terms + workspace fields to SSR fetch |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/workspace-detail-client.tsx` | Slim to ~200-line tab shell importing tab components |
| `apps/web/src/app/platform-admin/contracts/new/page.tsx` | Read workspace_id + company_id from URL params for pre-fill |
| `packages/telemetry/src/registry.ts` | Register "pricing terms updated" event type + routing |

### Files NOT to Touch

| File | Reason |
|------|--------|
| `supabase/migrations/*` | No new migration — existing pricing_terms columns suffice |
| `packages/ai/*` | No agent capabilities on this tab |
| `services/contract-service/*` | Reuse existing, don't modify |
| `apps/web/src/components/platform-admin/contract-list-client.tsx` | Reuse as-is |
| `apps/web/src/components/platform-admin/contract-columns.tsx` | Reuse as-is |

---

## Phase 1 — Tab Extraction (Tasks 1-6)

This phase has zero functional changes. Every tab renders identically after extraction. Commit after each tab extraction.

### Task 1: Create OverviewTab component

Extract the Overview tab content (lines 525-874 of workspace-detail-client.tsx) into its own component.

**Files:**
- Create: `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/OverviewTab.tsx`

- [ ] **Step 1: Create the tabs directory**

```bash
mkdir -p apps/web/src/app/platform-admin/workspaces/\[id\]/_components/tabs
```

- [ ] **Step 2: Create OverviewTab.tsx**

Extract the Overview TabsContent from `workspace-detail-client.tsx` (the JSX between `{/* ── OVERVIEW TAB */}` and `</TabsContent>` at line 874).

The component needs these props (derived from what the Overview tab uses):

```tsx
"use client";

import {
  Users,
  Building2,
  CreditCard,
  Calendar,
  Pencil,
  Check,
  X,
  Star,
  MapPin,
  Globe,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform-admin/status-badge";

// Import the Field helper and types from the parent — they will be moved to a shared file
// For now, inline the Field helper and types in this file.
```

Move the `Field` helper function (lines 160-199), the `WorkspaceData` type (lines 61-94), the `CompanyData` type (lines 96-115), the edit state (`isEditingInfo`, `editWs`, `editCo`, `startEditInfo`, `saveInfo` — lines 241-391), the stats cards, workspace info grid, and company info card into this component.

Props interface:

```tsx
type OverviewTabProps = {
  workspace: WorkspaceData;
  company: CompanyData | null;
  stats: {
    totalProfiles: number;
    activeProfiles: number;
    traineeProfiles: number;
    departmentCount: number;
  };
};
```

The component manages its own edit state internally — `isEditingInfo`, `editWs`, `editCo` state and the `startEditInfo`/`saveInfo` functions all move here. The save function calls `/api/platform-admin/workspaces/update` (same as today).

Export the `WorkspaceData`, `CompanyData`, and `Field` from this file so other tabs can import them if needed.

- [ ] **Step 3: Verify the file compiles**

```bash
pnpm --filter web typecheck
```

### Task 2: Create ChampionsTab component

**Files:**
- Create: `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/ChampionsTab.tsx`

- [ ] **Step 1: Create ChampionsTab.tsx**

Extract lines 877-964 (the Champions TabsContent). This tab needs:

```tsx
type ChampionsTabProps = {
  profiles: ProfileRow[];
  workspaceId: string;
  workspaceName: string;
  onOpenCompose: (audience?: AudienceFilter) => void;
};
```

Move the `ProfileRow` type, `roleFilter`/`statusFilter` state, `filteredProfiles` logic, and the profile table JSX. The `openCompose` callback stays in the parent shell (since ComposeEmailSheet lives there) — pass it as `onOpenCompose` prop.

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter web typecheck
```

### Task 3: Create IntelligenceTab component

**Files:**
- Create: `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/IntelligenceTab.tsx`

- [ ] **Step 1: Create IntelligenceTab.tsx**

Extract lines 967-1155 (Intelligence TabsContent). This tab needs:

```tsx
type IntelligenceTabProps = {
  intelligence: {
    docChunks: DocChunk[];
    memories: MemoryRow[];
    files: StorageFile[];
  };
  workspaceId: string;
};
```

Move the `DocChunk`, `MemoryRow`, `StorageFile` types, `sourceTypeLabels`, `formatBytes`, `chunksByType`/`memsByType` computed values, and the `DocumentDrop` integration.

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter web typecheck
```

### Task 4: Create CommunicationTab component

**Files:**
- Create: `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/CommunicationTab.tsx`

- [ ] **Step 1: Create CommunicationTab.tsx**

Extract lines 1158-1247 (Communication TabsContent). This tab needs:

```tsx
type CommunicationTabProps = {
  commHistory: Array<Record<string, unknown>>;
  workspaceId: string;
  workspaceName: string;
  onOpenCompose: (audience?: AudienceFilter) => void;
};
```

Move the audience buttons and communication history table.

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter web typecheck
```

### Task 5: Create NotesTab component

**Files:**
- Create: `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/NotesTab.tsx`

- [ ] **Step 1: Create NotesTab.tsx**

Extract lines 1298-1381 (Notes TabsContent). This tab needs:

```tsx
type NotesTabProps = {
  initialNotes: NoteRow[];
  workspaceId: string;
};
```

Move the `NoteRow` type, all notes state (`noteText`, `notes`, `isSavingNote`, `editingNoteId`, `editingText`), and all CRUD functions (`saveNote`, `updateNote`, `deleteNote`) into this component. The notes state is fully self-contained — it only calls `/api/platform-admin/workspace-notes`.

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter web typecheck
```

### Task 6: Slim workspace-detail-client.tsx to tab shell

**Files:**
- Modify: `apps/web/src/app/platform-admin/workspaces/[id]/_components/workspace-detail-client.tsx`

- [ ] **Step 1: Replace all tab content with component imports**

The file should be reduced to approximately 200 lines. It keeps:
- The `Props` type definition (updated to include new props in later tasks)
- The `composeOpen`/`composeAudience` state (shared by Champions and Communication tabs)
- The `trialDaysLeft` calculation
- The `Tabs`/`TabsList`/`TabsTrigger` structure
- Each `TabsContent` renders the imported tab component
- The `ComposeEmailSheet` at the bottom

```tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import { ComposeEmailSheet } from "@/components/platform-admin/compose-email-sheet";
import type { AudienceFilter } from "@/components/platform-admin/audience-selector";

import { OverviewTab } from "./tabs/OverviewTab";
import { ChampionsTab } from "./tabs/ChampionsTab";
import { IntelligenceTab } from "./tabs/IntelligenceTab";
import { CommunicationTab } from "./tabs/CommunicationTab";
import { NotesTab } from "./tabs/NotesTab";

// ... type imports from tab files ...

type Props = {
  workspace: WorkspaceData;
  company: CompanyData | null;
  stats: { totalProfiles: number; activeProfiles: number; traineeProfiles: number; departmentCount: number };
  profiles: ProfileRow[];
  notes: NoteRow[];
  commHistory: Array<Record<string, unknown>>;
  intelligence: { docChunks: DocChunk[]; memories: MemoryRow[]; files: StorageFile[] };
};

export function WorkspaceDetailClient({ workspace, company, stats, profiles, notes, commHistory, intelligence }: Props) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeAudience, setComposeAudience] = useState<AudienceFilter | undefined>();

  const trialDaysLeft = company?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(company.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  function openCompose(audience?: AudienceFilter) {
    setComposeAudience(audience);
    setComposeOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{workspace.name}</h1>
        {company && <StatusBadge status={company.subscriptionStatus} />}
        {!workspace.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="champions">Champions</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="avtaler">Avtaler</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <OverviewTab workspace={workspace} company={company} stats={stats} />
        </TabsContent>
        <TabsContent value="champions" className="mt-4 space-y-4">
          <ChampionsTab profiles={profiles} workspaceId={workspace.workspaceId} workspaceName={workspace.name} onOpenCompose={openCompose} />
        </TabsContent>
        <TabsContent value="intelligence" className="mt-4 space-y-6">
          <IntelligenceTab intelligence={intelligence} workspaceId={workspace.workspaceId} />
        </TabsContent>
        <TabsContent value="communication" className="mt-4 space-y-4">
          <CommunicationTab commHistory={commHistory} workspaceId={workspace.workspaceId} workspaceName={workspace.name} onOpenCompose={openCompose} />
        </TabsContent>
        <TabsContent value="avtaler" className="mt-4 space-y-6">
          {/* ContractTab added in Phase 2 */}
        </TabsContent>
        <TabsContent value="notes" className="mt-4 space-y-4">
          <NotesTab initialNotes={notes} workspaceId={workspace.workspaceId} />
        </TabsContent>
      </Tabs>

      <ComposeEmailSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultAudience={composeAudience}
        workspaceId={workspace.workspaceId}
        workspaceName={workspace.name}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 3: Start dev server and verify all existing tabs render correctly**

```bash
pnpm --filter web dev
```

Navigate to `http://localhost:3060/platform-admin/workspaces/{any-workspace-id}` and verify:
- Overview tab: stats cards, workspace info, company info, edit mode all work
- Champions tab: profile list, role/status filters, compose email button
- Intelligence tab: doc chunks, memories, files, document upload
- Communication tab: audience buttons, history table
- Notes tab: add/edit/delete notes
- Avtaler tab: empty (placeholder for Phase 2)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/workspaces/\[id\]/_components/
git commit -m "refactor(platform-admin): extract workspace detail tabs into separate components

Split the 1393-line workspace-detail-client.tsx into a thin tab shell
(~200 lines) plus 5 individual tab components in tabs/ directory.
No functional changes — all tabs render identically.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Server Data + API (Tasks 7-9)

### Task 7: Add contracts, pricing_terms, and workspace fields to SSR fetch

**Files:**
- Modify: `apps/web/src/app/platform-admin/workspaces/[id]/page.tsx`
- Modify: `apps/web/src/app/platform-admin/workspaces/[id]/_components/workspace-detail-client.tsx` (prop types)

- [ ] **Step 1: Add queries to Promise.all in page.tsx**

In `apps/web/src/app/platform-admin/workspaces/[id]/page.tsx`, add two queries to the existing `Promise.all()` block. Currently there are 10 queries (workspace, totalProfiles, activeProfiles, traineeProfiles, departmentCount, profiles, notes, commHistory, docChunks, memories). Add:

```tsx
// After the existing memories query, add:
admin
  .from("contract")
  .select(
    `contract_id, title, status, contract_type, recipient_name, recipient_email,
     sent_at, signed_at, expires_at, created_at, signed_pdf_url,
     template:template_id (name, contract_type)`,
  )
  .eq("workspace_id", id)
  .order("created_at", { ascending: false })
  .limit(20),
admin
  .from("pricing_terms")
  .select("*")
  .eq("workspace_id", id)
  .is("effective_until", null)
  .order("effective_from", { ascending: false })
  .limit(1)
  .maybeSingle(),
```

Update the destructuring to include the new results:

```tsx
const [
  { data: workspace },
  { count: totalProfiles },
  { count: activeProfiles },
  { count: traineeProfiles },
  { count: departmentCount },
  { data: profiles },
  { data: notes },
  { data: commHistory },
  { data: docChunks },
  { data: memories },
  { data: contracts },
  { data: pricingTerms },
] = await Promise.all([
  // ... existing queries ...
]);
```

- [ ] **Step 2: Add workspace contract fields to the prop mapping**

In the same file, add the missing workspace fields to the workspace prop object passed to `WorkspaceDetailClient`:

```tsx
// Inside the workspace prop, add after the existing fields:
contractStatus: (workspace.contract_status as string) ?? "none",
activeContractId: (workspace.active_contract_id as string) ?? null,
trialStartedAt: (workspace.trial_started_at as string) ?? null,
wsTrialEndsAt: (workspace.trial_ends_at as string) ?? null,
```

- [ ] **Step 3: Add contracts and pricingTerms props**

Pass the fetched data as new props to `WorkspaceDetailClient`:

```tsx
contracts={(contracts ?? []).map((c) => ({
  contract_id: c.contract_id,
  title: c.title,
  status: c.status as string,
  contract_type: c.contract_type as string ?? "custom",
  recipient_name: c.recipient_name,
  recipient_email: c.recipient_email,
  sent_at: c.sent_at,
  signed_at: c.signed_at,
  expires_at: c.expires_at,
  created_at: c.created_at,
  signed_pdf_url: c.signed_pdf_url,
  company: null,
  template: c.template as { name: string; contract_type: string } | null,
  events: [],
}))}
pricingTerms={pricingTerms ? {
  pricingTermsId: pricingTerms.pricing_terms_id,
  companyId: pricingTerms.company_id,
  workspaceId: pricingTerms.workspace_id,
  monthlyCost: pricingTerms.monthly_cost,
  pricePerEmployee: pricingTerms.price_per_employee,
  billingInterval: pricingTerms.billing_interval,
  currency: pricingTerms.currency,
  discountPercent: pricingTerms.discount_percent,
  discountLabel: pricingTerms.discount_label,
  onboardingPackage: pricingTerms.onboarding_package,
  onboardingCost: pricingTerms.onboarding_cost,
  trialDays: pricingTerms.trial_days,
  effectiveFrom: pricingTerms.effective_from,
  effectiveUntil: pricingTerms.effective_until,
  notes: pricingTerms.notes,
  contractId: pricingTerms.contract_id,
  updatedAt: pricingTerms.updated_at,
} : null}
```

- [ ] **Step 4: Update Props type in workspace-detail-client.tsx**

Add `WorkspaceData` fields and new props to the shell component:

```tsx
// In WorkspaceData type, add:
contractStatus: string;
activeContractId: string | null;
trialStartedAt: string | null;
wsTrialEndsAt: string | null;

// Add new prop types after existing types:
type PricingTermsData = {
  pricingTermsId: string;
  companyId: string;
  workspaceId: string | null;
  monthlyCost: number | null;
  pricePerEmployee: number;
  billingInterval: string;
  currency: string;
  discountPercent: number | null;
  discountLabel: string | null;
  onboardingPackage: string | null;
  onboardingCost: number | null;
  trialDays: number | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  notes: string | null;
  contractId: string | null;
  updatedAt: string;
};

// In Props type, add:
contracts: ContractRow[];
pricingTerms: PricingTermsData | null;
```

Import `ContractRow` from `@/components/platform-admin/contract-columns`.

- [ ] **Step 5: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/platform-admin/workspaces/\[id\]/page.tsx apps/web/src/app/platform-admin/workspaces/\[id\]/_components/workspace-detail-client.tsx
git commit -m "feat(platform-admin): fetch contracts and pricing terms for workspace detail

Add contract list and pricing_terms queries to the SSR Promise.all
in workspace detail page. Pass as props to client component.
Add workspace contract_status and active_contract_id fields.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 8: Create pricing-terms API endpoint

**Files:**
- Create: `apps/web/src/app/api/platform-admin/pricing-terms/route.ts`

- [ ] **Step 1: Create the API route**

```tsx
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";
import { emit } from "@smartout/telemetry";

const UpdatePricingSchema = z.object({
  pricing_terms_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  monthly_cost: z.number().min(0).nullable().optional(),
  price_per_employee: z.number().min(0).optional(),
  billing_interval: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  discount_percent: z.number().min(0).max(100).nullable().optional(),
  discount_label: z.string().nullable().optional(),
  onboarding_package: z.string().nullable().optional(),
  onboarding_cost: z.number().min(0).nullable().optional(),
  trial_days: z.number().int().min(0).nullable().optional(),
  effective_from: z.string().optional(),
  effective_until: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const CreatePricingSchema = z.object({
  workspace_id: z.string().uuid(),
  company_id: z.string().uuid(),
  price_per_employee: z.number().min(0),
  monthly_cost: z.number().min(0).nullable().optional(),
  billing_interval: z.enum(["monthly", "quarterly", "yearly"]).default("monthly"),
  currency: z.enum(["NOK", "SEK", "DKK", "EUR"]).default("NOK"),
  discount_percent: z.number().min(0).max(100).nullable().optional(),
  discount_label: z.string().nullable().optional(),
  onboarding_package: z.string().nullable().optional(),
  onboarding_cost: z.number().min(0).nullable().optional(),
  trial_days: z.number().int().min(0).nullable().optional(),
  effective_from: z.string(),
  notes: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { admin } = result;

  const workspaceId = request.nextUrl.searchParams.get("workspace_id");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("pricing_terms")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("effective_until", null)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId, admin } = result;

  const body = CreatePricingSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const { data, error } = await admin
    .from("pricing_terms")
    .insert({
      ...body.data,
      created_by: adminId,
    })
    .select("pricing_terms_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logPlatformAction(adminId, "create_pricing_terms", "pricing_terms", data.pricing_terms_id, {
    workspace_id: body.data.workspace_id,
  });

  void emit({
    event: "pricing terms updated",
    workspace_id: body.data.workspace_id,
    actor_id: adminId,
    properties: {
      entity: {
        entity_type: "pricing_terms",
        entity_id: data.pricing_terms_id,
        entity_label: `Pricing for ${body.data.workspace_id}`,
      },
      data: { action: "created" },
    },
  });

  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId, admin } = result;

  const body = UpdatePricingSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const { pricing_terms_id, workspace_id, ...updates } = body.data;

  const { error } = await admin
    .from("pricing_terms")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("pricing_terms_id", pricing_terms_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logPlatformAction(adminId, "update_pricing_terms", "pricing_terms", pricing_terms_id, {
    workspace_id,
    fields_updated: Object.keys(updates),
  });

  void emit({
    event: "pricing terms updated",
    workspace_id,
    actor_id: adminId,
    properties: {
      entity: {
        entity_type: "pricing_terms",
        entity_id: pricing_terms_id,
        entity_label: `Pricing for ${workspace_id}`,
      },
      data: { action: "updated", fields: Object.keys(updates) },
    },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/platform-admin/pricing-terms/route.ts
git commit -m "feat(platform-admin): add pricing-terms API endpoint

New GET/POST/PATCH endpoint for workspace pricing terms management.
Godmode-gated, Zod-validated, with telemetry emit and audit logging.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 9: Register telemetry event

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add PricingTermsUpdated interface**

In `packages/telemetry/src/registry.ts`, find the contract events section (around line 836). After the last contract event interface, add:

```tsx
// ─── Pricing Terms Events ──────────────────────────
export interface PricingTermsUpdated extends BaseEvent {
  event: "pricing terms updated";
  properties: {
    entity: EntityRef;
    data: {
      action: "created" | "updated";
      fields?: string[];
    };
  };
}
```

- [ ] **Step 2: Add to TelemetryEvent union type**

Find the `TelemetryEvent` union type and add `| PricingTermsUpdated`.

- [ ] **Step 3: Add routing config**

Find the routing config map (around line 3374 where contract events are). Add:

```tsx
"pricing terms updated": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "contracts",
},
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm --filter @smartout/telemetry typecheck
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register pricing terms updated event

New telemetry event for pricing terms mutations, routed to
posthog, logger, and activity_trail.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — ContractTab Component (Tasks 10-11)

### Task 10: Build ContractTab component

**Files:**
- Create: `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/ContractTab.tsx`

- [ ] **Step 1: Create ContractTab.tsx with all three sections**

This is the largest single component. It has three sections: status row, pricing editor, and contract list.

```tsx
"use client";

import { useState } from "react";
import {
  CreditCard,
  FileSignature,
  Clock,
  Pencil,
  Check,
  X,
  Plus,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/platform-admin/status-badge";
import { ContractListClient } from "@/components/platform-admin/contract-list-client";
import type { ContractRow } from "@/components/platform-admin/contract-columns";
import { toast } from "sonner";
import Link from "next/link";

type PricingTermsData = {
  pricingTermsId: string;
  companyId: string;
  workspaceId: string | null;
  monthlyCost: number | null;
  pricePerEmployee: number;
  billingInterval: string;
  currency: string;
  discountPercent: number | null;
  discountLabel: string | null;
  onboardingPackage: string | null;
  onboardingCost: number | null;
  trialDays: number | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  notes: string | null;
  contractId: string | null;
  updatedAt: string;
};

type ContractTabProps = {
  workspaceId: string;
  companyId: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
  contractStatus: string;
  activeContractId: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  contracts: ContractRow[];
  pricingTerms: PricingTermsData | null;
};

const contractStatusColor: Record<string, string> = {
  none: "bg-zinc-500/10 text-zinc-400",
  pending_contract: "bg-yellow-500/10 text-yellow-400",
  active: "bg-green-500/10 text-green-400",
  suspended: "bg-red-500/10 text-red-400",
  deactivated: "bg-zinc-500/10 text-zinc-400",
};

export function ContractTab({
  workspaceId,
  companyId,
  subscriptionPlan,
  subscriptionStatus,
  contractStatus,
  activeContractId,
  trialEndsAt,
  trialDaysLeft,
  contracts,
  pricingTerms: initialPricing,
}: ContractTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pricing, setPricing] = useState(initialPricing);
  const [editForm, setEditForm] = useState({
    monthlyCost: String(initialPricing?.monthlyCost ?? ""),
    pricePerEmployee: String(initialPricing?.pricePerEmployee ?? ""),
    billingInterval: initialPricing?.billingInterval ?? "monthly",
    discountPercent: String(initialPricing?.discountPercent ?? ""),
    discountLabel: initialPricing?.discountLabel ?? "",
    onboardingPackage: initialPricing?.onboardingPackage ?? "",
    onboardingCost: String(initialPricing?.onboardingCost ?? ""),
    trialDays: String(initialPricing?.trialDays ?? ""),
    effectiveFrom: initialPricing?.effectiveFrom ?? new Date().toISOString().split("T")[0],
    notes: initialPricing?.notes ?? "",
  });

  function startEdit() {
    setEditForm({
      monthlyCost: String(pricing?.monthlyCost ?? ""),
      pricePerEmployee: String(pricing?.pricePerEmployee ?? ""),
      billingInterval: pricing?.billingInterval ?? "monthly",
      discountPercent: String(pricing?.discountPercent ?? ""),
      discountLabel: pricing?.discountLabel ?? "",
      onboardingPackage: pricing?.onboardingPackage ?? "",
      onboardingCost: String(pricing?.onboardingCost ?? ""),
      trialDays: String(pricing?.trialDays ?? ""),
      effectiveFrom: pricing?.effectiveFrom ?? new Date().toISOString().split("T")[0],
      notes: pricing?.notes ?? "",
    });
    setIsEditing(true);
  }

  async function savePricing() {
    setIsSaving(true);
    try {
      const payload = {
        monthly_cost: editForm.monthlyCost ? Number(editForm.monthlyCost) : null,
        price_per_employee: Number(editForm.pricePerEmployee) || 0,
        billing_interval: editForm.billingInterval,
        discount_percent: editForm.discountPercent ? Number(editForm.discountPercent) : null,
        discount_label: editForm.discountLabel || null,
        onboarding_package: editForm.onboardingPackage || null,
        onboarding_cost: editForm.onboardingCost ? Number(editForm.onboardingCost) : null,
        trial_days: editForm.trialDays ? Number(editForm.trialDays) : null,
        effective_from: editForm.effectiveFrom,
        notes: editForm.notes || null,
      };

      if (pricing) {
        // Update existing
        const res = await fetch("/api/platform-admin/pricing-terms", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pricing_terms_id: pricing.pricingTermsId,
            workspace_id: workspaceId,
            ...payload,
          }),
        });
        if (!res.ok) throw new Error("Failed to update");
        setPricing({
          ...pricing,
          monthlyCost: payload.monthly_cost,
          pricePerEmployee: payload.price_per_employee,
          billingInterval: payload.billing_interval,
          discountPercent: payload.discount_percent,
          discountLabel: payload.discount_label,
          onboardingPackage: payload.onboarding_package,
          onboardingCost: payload.onboarding_cost,
          trialDays: payload.trial_days,
          effectiveFrom: payload.effective_from,
          notes: payload.notes,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new
        if (!companyId) {
          toast.error("Workspace has no company — cannot create pricing terms");
          return;
        }
        const res = await fetch("/api/platform-admin/pricing-terms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            company_id: companyId,
            ...payload,
          }),
        });
        if (!res.ok) throw new Error("Failed to create");
        const { data } = await res.json();
        setPricing({
          pricingTermsId: data.pricing_terms_id,
          companyId: companyId,
          workspaceId,
          ...payload,
          monthlyCost: payload.monthly_cost,
          currency: "NOK",
          effectiveUntil: null,
          contractId: null,
          updatedAt: new Date().toISOString(),
        });
      }
      setIsEditing(false);
      toast.success("Prisvilkar oppdatert");
    } catch {
      toast.error("Kunne ikke oppdatere prisvilkar");
    } finally {
      setIsSaving(false);
    }
  }

  // Build the "Ny kontrakt" link with pre-filled params
  const newContractHref = `/platform-admin/contracts/new${companyId ? `?company_id=${companyId}&workspace_id=${workspaceId}` : ""}`;

  return (
    <div className="space-y-6">
      {/* ── Section 1: Status Row ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs uppercase">Abonnement</p>
            <p className="mt-2 text-2xl font-semibold capitalize">{subscriptionPlan}</p>
            <div className="mt-2">
              <StatusBadge status={subscriptionStatus} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs uppercase">Kontraktstatus</p>
            <p className="mt-2 text-lg font-semibold capitalize">
              {contractStatus.replace(/_/g, " ")}
            </p>
            <div className="mt-2">
              <Badge variant="outline" className={contractStatusColor[contractStatus] ?? ""}>
                {contractStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>
        {trialDaysLeft !== null && (
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs uppercase">Trial</p>
              <p className={`mt-2 text-2xl font-semibold ${trialDaysLeft <= 3 ? "text-destructive" : ""}`}>
                {trialDaysLeft} dager igjen
              </p>
              {trialEndsAt && (
                <p className="text-muted-foreground text-xs">
                  Utloper {new Date(trialEndsAt).toLocaleDateString("no-NO")}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Section 2: Prisvilkar ──────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Gjeldende vilkar</CardTitle>
            {pricing?.updatedAt && (
              <p className="text-muted-foreground text-xs">
                Sist endret {new Date(pricing.updatedAt).toLocaleDateString("no-NO")}
              </p>
            )}
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Rediger
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                <X className="mr-1 h-3.5 w-3.5" /> Avbryt
              </Button>
              <Button size="sm" onClick={savePricing} disabled={isSaving}>
                <Check className="mr-1 h-3.5 w-3.5" /> {isSaving ? "Lagrer..." : "Lagre"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!pricing && !isEditing ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground text-sm">Ingen prisvilkar registrert</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={startEdit}>
                <Plus className="mr-2 h-3.5 w-3.5" /> Opprett vilkar
              </Button>
            </div>
          ) : isEditing ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Basispris / mnd</Label>
                <Input type="number" value={editForm.monthlyCost} onChange={(e) => setEditForm((p) => ({ ...p, monthlyCost: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Pris per ekstra ansatt</Label>
                <Input type="number" value={editForm.pricePerEmployee} onChange={(e) => setEditForm((p) => ({ ...p, pricePerEmployee: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Faktureringsintervall</Label>
                <Select value={editForm.billingInterval} onValueChange={(v) => setEditForm((p) => ({ ...p, billingInterval: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Manedlig</SelectItem>
                    <SelectItem value="quarterly">Kvartalsvis</SelectItem>
                    <SelectItem value="yearly">Arlig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Rabatt (%)</Label>
                <Input type="number" min={0} max={100} value={editForm.discountPercent} onChange={(e) => setEditForm((p) => ({ ...p, discountPercent: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Rabatt-label</Label>
                <Input value={editForm.discountLabel} onChange={(e) => setEditForm((p) => ({ ...p, discountLabel: e.target.value }))} placeholder="F.eks. Lanseringsrabatt" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Onboarding-pakke</Label>
                <Input value={editForm.onboardingPackage} onChange={(e) => setEditForm((p) => ({ ...p, onboardingPackage: e.target.value }))} placeholder="Standard / Premium / Enterprise" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Onboarding-kostnad</Label>
                <Input type="number" value={editForm.onboardingCost} onChange={(e) => setEditForm((p) => ({ ...p, onboardingCost: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Trial-dager</Label>
                <Input type="number" value={editForm.trialDays} onChange={(e) => setEditForm((p) => ({ ...p, trialDays: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Gyldig fra</Label>
                <Input type="date" value={editForm.effectiveFrom} onChange={(e) => setEditForm((p) => ({ ...p, effectiveFrom: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5 lg:col-span-3">
                <Label className="text-muted-foreground text-xs">Notater</Label>
                <Textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Spesielle avtaler..." />
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-3">
              <div>
                <dt className="text-muted-foreground text-xs">Basispris / mnd</dt>
                <dd className="text-sm font-medium">{pricing!.monthlyCost != null ? `${pricing!.monthlyCost.toLocaleString("no-NO")} ${pricing!.currency}` : "\u2014"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Pris per ekstra ansatt</dt>
                <dd className="text-sm font-medium">{pricing!.pricePerEmployee.toLocaleString("no-NO")} {pricing!.currency}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Faktureringsintervall</dt>
                <dd className="text-sm capitalize">{pricing!.billingInterval}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Valuta</dt>
                <dd className="text-sm">{pricing!.currency}</dd>
              </div>
              {pricing!.discountPercent != null && pricing!.discountPercent > 0 && (
                <div>
                  <dt className="text-muted-foreground text-xs">Rabatt</dt>
                  <dd className="text-sm">{pricing!.discountPercent}%{pricing!.discountLabel ? ` (${pricing!.discountLabel})` : ""}</dd>
                </div>
              )}
              {pricing!.onboardingPackage && (
                <div>
                  <dt className="text-muted-foreground text-xs">Onboarding</dt>
                  <dd className="text-sm">{pricing!.onboardingPackage}{pricing!.onboardingCost != null ? ` — ${pricing!.onboardingCost.toLocaleString("no-NO")} ${pricing!.currency}` : ""}</dd>
                </div>
              )}
              {pricing!.trialDays != null && (
                <div>
                  <dt className="text-muted-foreground text-xs">Trial-dager</dt>
                  <dd className="text-sm">{pricing!.trialDays}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground text-xs">Gyldig fra</dt>
                <dd className="text-sm">{new Date(pricing!.effectiveFrom).toLocaleDateString("no-NO")}</dd>
              </div>
              {pricing!.notes && (
                <div className="col-span-2 lg:col-span-3">
                  <dt className="text-muted-foreground text-xs">Notater</dt>
                  <dd className="text-sm whitespace-pre-wrap">{pricing!.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Kontrakter ──────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Kontrakter</CardTitle>
          <Link href={newContractHref}>
            <Button size="sm">
              <Plus className="mr-2 h-3.5 w-3.5" /> Ny kontrakt
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground text-sm">Ingen kontrakter for denne workspacen</p>
              <Link href={newContractHref}>
                <Button variant="outline" size="sm" className="mt-3">
                  <Plus className="mr-2 h-3.5 w-3.5" /> Opprett forste kontrakt
                </Button>
              </Link>
            </div>
          ) : (
            <ContractListClient data={contracts} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/workspaces/\[id\]/_components/tabs/ContractTab.tsx
git commit -m "feat(platform-admin): add ContractTab component for workspace detail

Three-section tab: status row (subscription + contract status + trial),
editable pricing terms with create/update, and contract list with
actions via ContractListClient reuse.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 11: Wire ContractTab into the tab shell

**Files:**
- Modify: `apps/web/src/app/platform-admin/workspaces/[id]/_components/workspace-detail-client.tsx`

- [ ] **Step 1: Import and render ContractTab**

In workspace-detail-client.tsx, add the import:

```tsx
import { ContractTab } from "./tabs/ContractTab";
```

Replace the placeholder `{/* ContractTab added in Phase 2 */}` comment inside the "avtaler" TabsContent with:

```tsx
<ContractTab
  workspaceId={workspace.workspaceId}
  companyId={company?.companyId ?? null}
  subscriptionPlan={company?.subscriptionPlan ?? "\u2014"}
  subscriptionStatus={company?.subscriptionStatus ?? "unknown"}
  contractStatus={workspace.contractStatus}
  activeContractId={workspace.activeContractId}
  trialEndsAt={company?.trialEndsAt ?? null}
  trialDaysLeft={trialDaysLeft}
  contracts={contracts}
  pricingTerms={pricingTerms}
/>
```

Update the function signature to include the new props:

```tsx
export function WorkspaceDetailClient({
  workspace, company, stats, profiles, notes, commHistory, intelligence,
  contracts, pricingTerms,
}: Props) {
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/workspaces/\[id\]/_components/workspace-detail-client.tsx
git commit -m "feat(platform-admin): wire ContractTab into workspace detail shell

Connect the Avtaler tab to ContractTab component with all required
props from SSR data.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Pre-fill and Polish (Tasks 12-13)

### Task 12: Add URL param pre-fill to new contract page

**Files:**
- Modify: `apps/web/src/app/platform-admin/contracts/new/page.tsx`

- [ ] **Step 1: Read URL params and set initial form state**

In `apps/web/src/app/platform-admin/contracts/new/page.tsx`, add `useSearchParams` to read pre-filled values:

```tsx
import { useRouter, useSearchParams } from "next/navigation";
```

Inside the component, add after `const router = useRouter()`:

```tsx
const searchParams = useSearchParams();
```

Update the initial `formData` state to use URL params:

```tsx
const [formData, setFormData] = useState({
  template_id: "",
  company_id: searchParams.get("company_id") ?? "",
  workspace_id: searchParams.get("workspace_id") ?? "",
  recipient_name: "",
  recipient_email: "",
  title: "",
  notes: "",
});
```

This ensures that when the user clicks "Ny kontrakt" from the workspace detail page, the company and workspace are already selected.

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 3: Test manually**

Start the dev server and navigate to:
`http://localhost:3060/platform-admin/contracts/new?company_id=<some-id>&workspace_id=<some-id>`

Verify that the company dropdown shows the pre-selected company and the workspace is auto-selected.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/contracts/new/page.tsx
git commit -m "feat(platform-admin): pre-fill new contract form from URL params

Read company_id and workspace_id from search params to support
the 'Ny kontrakt' button on the workspace detail page.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 13: Manual verification and final commit

- [ ] **Step 1: Run full typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors across all packages.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 3: Start dev server and test the full flow**

```bash
pnpm --filter web dev
```

Navigate to `http://localhost:3060/platform-admin/workspaces/{workspace-id}` and verify:

1. **All existing tabs** still work (Overview, Champions, Intelligence, Communication, Notes)
2. **Avtaler tab** appears in the tab bar
3. **Status row** shows subscription plan, contract status, and trial (if applicable)
4. **Pricing terms** — if none exist, shows ghost card with "Opprett vilkar" button
5. **Pricing terms** — edit mode: all fields editable, save works, optimistic update
6. **Contract list** — shows contracts filtered to this workspace
7. **Contract actions** — Preview link works, remind/cancel show toasts
8. **"Ny kontrakt" button** — navigates to `/platform-admin/contracts/new` with workspace pre-filled
9. **Responsive** — status row stacks on narrow viewport

- [ ] **Step 4: Push to development**

```bash
git push origin development
```
