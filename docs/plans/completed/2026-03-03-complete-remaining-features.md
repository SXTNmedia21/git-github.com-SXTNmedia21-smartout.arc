---
title: "Complete All Remaining Features — Master Plan"
status: approved
updated: 2026-03-03
created: 2026-03-03
module: multi
tags: [plan, landing, journey-portal, communications, entity-detail, master]
---

# Complete All Remaining Features — Master Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close out all 4 remaining in-progress/draft features: Landing Page Builder (5%), Journey Portal (30%), Communications v2 (15-20%), and Entity Detail Pages (100%).

**Architecture:** Each feature is independent — no cross-feature dependencies. Work order is by effort: smallest gaps first (landing, portal), then comms, then entity detail pages which is a full greenfield build. All features use the existing patterns: Next.js App Router, Supabase queries, shadcn/ui, DashboardContext, TanStack Query where applicable.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Tailwind v4, shadcn/ui, Supabase, Tiptap, SendGrid, Framer Motion

---

## Feature A: Landing Page Builder (95% → 100%)

Everything is built — DB schema, 15 block components, BlockRenderer, admin page builder, seed data. The only gap: `apps/landing/src/app/page.tsx` still renders hardcoded variant components instead of using the DB-driven `getVariantWithBlocks()` + `BlockRenderer` pipeline.

---

### Task A1: Wire Landing Root Page to DB Variants

**Files:**

- Modify: `apps/landing/src/app/page.tsx`
- Read: `apps/landing/src/lib/get-variant.ts` (already complete)
- Read: `apps/landing/src/components/blocks/BlockRenderer.tsx` (already complete)

**Step 1: Read current page.tsx to understand structure**

The file is ~1209 lines. Key sections:

- Line 44: `import { useVariant } from "../lib/landing-variant"` (client-side hook)
- Line 149: `const { variant } = useVariant()` reads `?v=` query param
- Lines 151-157: Conditional rendering of 6 legacy variant components

**Step 2: Convert page.tsx from client to server component**

The page must become a Server Component to use `getVariantWithBlocks()` (which uses `unstable_cache`). Replace the entire top-level default export:

```tsx
// page.tsx — Server Component (remove "use client" if present)
import { getVariantWithBlocks } from "@/lib/get-variant";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";

// Keep all existing imports for shared layout components (Navbar, Footer, etc.)
// that are OUTSIDE the variant-specific content area

type Props = {
  searchParams: Promise<{ v?: string; preview?: string }>;
};

export default async function LandingPage({ searchParams }: Props) {
  const params = await searchParams;
  const slug = params.v || undefined;
  const previewId = params.preview || undefined;

  const data = await getVariantWithBlocks(slug, previewId);

  if (!data) {
    // Fallback: render default variant
    const fallback = await getVariantWithBlocks();
    if (!fallback) {
      return <div>Landing page not configured</div>;
    }
    return <BlockRenderer variant={fallback.variant} blocks={fallback.blocks} />;
  }

  return <BlockRenderer variant={data.variant} blocks={data.blocks} />;
}
```

**Important:** The existing page likely wraps variant content in shared layout (Navbar, Footer, analytics scripts). Preserve those wrappers — only replace the variant-switching logic in the middle.

**Step 3: Update landing-variant.ts to use DB slugs**

```tsx
// apps/landing/src/lib/landing-variant.ts
// This file may no longer be needed since page.tsx is now a Server Component
// that reads searchParams directly. If other client components still import it,
// update VALID_VARIANTS to match DB slugs:
export const VALID_VARIANTS = [
  "default",
  "action",
  "ingrid",
  "lars-erik",
  "variant-a",
  "variant-f",
  "variant-k",
] as const;
```

**Step 4: Run typecheck**

```bash
pnpm --filter landing typecheck
```

Expected: 0 errors. If there are errors from removed client-side imports (useVariant, useRouter), fix them.

**Step 5: Commit**

```bash
git add apps/landing/src/app/page.tsx apps/landing/src/lib/landing-variant.ts
git commit -m "feat(landing): wire root page to DB-driven BlockRenderer"
```

---

### Task A2: Clean Up Legacy Variant Components

**Files:**

- Delete: `apps/landing/src/components/landing/Variant*.tsx` (all legacy variant files, ~5700 lines)
- Modify: `apps/landing/src/app/page.tsx` (remove legacy imports if any remain)

**Step 1: Identify all legacy variant files**

```bash
ls apps/landing/src/components/landing/Variant*.tsx
```

These are the ~1000-line hardcoded variant components (VariantELanding, VariantTLanding, etc.).

**Step 2: Verify no other files import them**

```bash
# Search for imports of legacy variants
grep -r "VariantELanding\|VariantTLanding\|VariantKLanding\|VariantALanding\|VariantFLanding\|VariantSLanding" apps/landing/src/ --include="*.tsx" --include="*.ts"
```

Expected: Only `page.tsx` (which we already updated in Task A1). If other files import them, update those too.

**Step 3: Delete legacy files**

```bash
rm apps/landing/src/components/landing/Variant*.tsx
```

**Step 4: Run typecheck**

```bash
pnpm --filter landing typecheck
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add -A apps/landing/src/components/landing/
git commit -m "chore(landing): remove legacy hardcoded variant components"
```

---

### Task A3: Verify End-to-End Landing Page Rendering

**Files:**

- Read: `apps/landing/src/lib/get-variant.ts`

**Step 1: Start local Supabase (if not running)**

```bash
npx supabase status || npx supabase start
```

**Step 2: Start the landing dev server**

```bash
pnpm --filter landing dev
```

**Step 3: Test variant rendering**

Open in browser:

- `http://localhost:3055` → should render default variant (slug "default", Ingrid)
- `http://localhost:3055?v=action` → should render Action variant (Lars Erik)
- `http://localhost:3055?v=nonexistent` → should fall back to default

**Step 4: Verify admin preview works**

- Navigate to admin: `http://localhost:3050/platform-admin/landing/variants`
- Click any variant → "Preview" button
- Confirm preview iframe loads the variant correctly

**Step 5: Commit any fixes needed**

```bash
git add -A && git commit -m "fix(landing): address issues found during e2e verification"
```

---

## Feature B: Journey Portal Polish (70% → 100%)

Core tracking, wizard, editing, and security are all done. 5 small polish tasks remain. All changes are in `apps/web/src/app/platform-admin/journeys/`.

---

### Task B1: Extract Shared Icon Maps

**Files:**

- Create: `apps/web/src/lib/journey/icons.ts`
- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx`
- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`
- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx`

**Step 1: Read the existing duplicated icon maps**

Read `journey-status-changer.tsx` lines 53-67 (STATUS_ICON_MAP), `journey-detail-client.tsx` lines 97-111 (STATUS_ICON_MAP duplicate), lines 116-135 (MODULE_ICON_MAP), lines 140-144 (PLATFORM_ICON_MAP), and `journey-list-client.tsx` lines 42-46 (PLATFORM_ICON_MAP duplicate).

**Step 2: Create the shared icon map file**

```tsx
// apps/web/src/lib/journey/icons.ts
import {
  Lightbulb,
  Wand2,
  ClipboardList,
  FileText,
  Hammer,
  Eye,
  TestTube2,
  FlaskConical,
  CheckCircle2,
  Rocket,
  CircleDot,
  CircleMinus,
  AlertTriangle,
  type LucideIcon,
  // Module icons — import all used by MODULE_META
  BookOpen,
  Shield,
  Users,
  Calendar,
  MapPin,
  Utensils,
  GraduationCap,
  Heart,
  ClipboardCheck,
  Settings,
  Briefcase,
  Building2,
  BarChart3,
  MessageSquare,
  Star,
  Zap,
  Globe,
  Key,
  // Platform icons
  Smartphone,
  Monitor,
  Laptop,
} from "lucide-react";

// Status → icon component mapping (13 statuses)
export const STATUS_ICON_MAP: Record<string, LucideIcon> = {
  idea: Lightbulb,
  drafting: Wand2,
  ready_review: ClipboardList,
  documented: FileText,
  ready_implement: Hammer,
  implemented: Eye,
  ready_test: TestTube2,
  testing: FlaskConical,
  ready_validation: CheckCircle2,
  active: Rocket,
  deprecated: CircleDot,
  archived: CircleMinus,
  blocked: AlertTriangle,
};

// Module → icon component mapping
// Copy the exact mapping from journey-detail-client.tsx lines 116-135
export const MODULE_ICON_MAP: Record<string, LucideIcon> = {
  // ... copy all entries from the source file
};

// Platform → icon component mapping
export const PLATFORM_ICON_MAP: Record<string, LucideIcon> = {
  web: Monitor,
  mobile: Smartphone,
  both: Laptop,
};
```

**Step 3: Update import sites**

In each of the 3 consumer files, replace the local icon map with:

```tsx
import { STATUS_ICON_MAP, MODULE_ICON_MAP, PLATFORM_ICON_MAP } from "@/lib/journey/icons";
```

Remove the local `const STATUS_ICON_MAP = ...` blocks.

**Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/lib/journey/icons.ts apps/web/src/app/platform-admin/journeys/
git commit -m "refactor(journeys): extract shared icon maps to lib/journey/icons.ts"
```

---

### Task B2: Add Pagination Guard to Journey List

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/page.tsx`
- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx`

**Step 1: Read current page.tsx query**

The query at ~line 28-31:

```typescript
const { data: journeys } = await admin
  .from("journey")
  .select("*")
  .order("code", { ascending: true });
```

**Step 2: Add limit + count**

```typescript
const { data: journeys, count } = await admin
  .from("journey")
  .select("*", { count: "exact" })
  .order("code", { ascending: true })
  .limit(500);
```

Pass `totalCount={count}` to `JourneyListClient`.

**Step 3: Add warning in JourneyListClient**

At the top of the list, if `totalCount !== null && totalCount > 500`:

```tsx
{
  totalCount !== null && totalCount > 500 && (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-500">
      Viser 500 av {totalCount} journeys. Bruk filtre for å begrense resultater.
    </div>
  );
}
```

**Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/page.tsx apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx
git commit -m "fix(journeys): add pagination guard with 500-row limit"
```

---

### Task B3: Use Proper DraftJourney Type

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-draft-preview.tsx`
- Read: `packages/types/src/journey.ts` (DraftJourney type at line 175)

**Step 1: Read wizard-draft-preview.tsx**

Find the local type definition at ~line 13:

```typescript
type DraftJourney = Record<string, unknown>;
```

**Step 2: Replace with proper import**

```typescript
import type { DraftJourney } from "@smartout/types";
```

Remove the local `type DraftJourney = Record<string, unknown>;` definition.

**Step 3: Remove type casts**

Find all `as string`, `as string[]` casts that are now redundant because the imported type has proper field types. Replace:

```typescript
// Before:
draft.title as string;
// After:
draft.title;
```

**Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/wizard/
git commit -m "refactor(journeys): use DraftJourney type from @smartout/types"
```

---

### Task B4: Fix Date Formatting Consistency

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

**Step 1: Read journey-detail-client.tsx to find all date formatting**

Search for `toLocaleString()` and `toLocaleDateString()` calls. Inconsistent locations:

- ~Line 493: `new Date(run.created_at).toLocaleString()` (test runs)
- ~Line 966: `new Date(event.created_at).toLocaleString()` (event timeline)

**Step 2: Replace with consistent Norwegian format**

Replace all `toLocaleString()` with:

```typescript
new Date(timestamp).toLocaleDateString("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
```

This matches the pattern already used in `wizard-launcher-client.tsx`.

**Step 3: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx
git commit -m "fix(journeys): consistent nb-NO date formatting in detail view"
```

---

### Task B5: Add Journey Delete Confirmation Dialog

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

**Step 1: Read the file to find the delete button location**

Look for existing delete button or action menu. The DELETE API route already exists at `/api/platform-admin/journeys/[id]`.

**Step 2: Add AlertDialog for delete confirmation**

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// In the actions area:
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-400">
      <Trash2 className="mr-2 h-4 w-4" />
      Slett
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Slett journey?</AlertDialogTitle>
      <AlertDialogDescription>
        Dette vil permanent slette journeyen, alle steg, hendelser og testresultater. Denne
        handlingen kan ikke angres.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Avbryt</AlertDialogCancel>
      <AlertDialogAction
        className="bg-red-600 hover:bg-red-700"
        onClick={async () => {
          const res = await fetch(`/api/platform-admin/journeys/${journeyId}`, {
            method: "DELETE",
          });
          if (res.ok) {
            toast.success("Journey slettet");
            router.push("/platform-admin/journeys");
          } else {
            toast.error("Kunne ikke slette journey");
          }
        }}
      >
        Slett permanent
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>;
```

**Step 3: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx
git commit -m "feat(journeys): add delete confirmation dialog"
```

---

### Task B6: Verify Journey Portal — Typecheck

**Step 1: Run full typecheck**

```bash
pnpm --filter web typecheck
```

**Step 2: Run lint**

```bash
pnpm --filter web lint
```

**Step 3: Fix any errors found**

Address type errors, unused imports, etc.

**Step 4: Commit fixes**

```bash
git add -A apps/web/src/app/platform-admin/journeys/ apps/web/src/lib/journey/
git commit -m "fix(journeys): resolve typecheck and lint issues"
```

---

## Feature C: Communications v2 (80% → 100%)

Core infrastructure is complete: SendGrid integration, Tiptap editor, AI correction/translation, webhook receiver, compose UI, history view. Remaining: template DB integration, recipient locale, webhook signature verification, and engagement reporting.

---

### Task C1: Verify Template Persistence Works

**Files:**

- Read: `apps/web/src/app/platform-admin/communications/templates/[id]/edit/save-action.ts`
- Read: `apps/web/src/app/platform-admin/communications/templates/_components/email-template-editor.tsx`

**Step 1: Read the save-action.ts file**

Check if it properly converts form state to jsonb and persists `sections` and `placeholders` columns to `platform_email_template`.

**Step 2: Test the save flow**

1. Start local dev server: `pnpm --filter web dev`
2. Navigate to `/platform-admin/communications/templates`
3. Click "New Template" or edit existing
4. Add sections, set subject, save
5. Verify the data appears in DB: `SELECT * FROM platform_email_template;`

**Step 3: Fix any issues found**

If the save action doesn't properly serialize sections/placeholders, fix the server action.

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/communications/templates/
git commit -m "fix(comms): verify and fix template persistence"
```

---

### Task C2: Integrate Saved Templates into Compose UI

**Files:**

- Modify: `apps/web/src/app/platform-admin/communications/compose/_components/compose-page-client.tsx`
- Modify: `apps/web/src/app/platform-admin/communications/compose/page.tsx` (server component — fetch templates)

**Step 1: Read compose page server component**

Add a Supabase query to fetch all active templates:

```tsx
// compose/page.tsx (server component)
const { data: savedTemplates } = await admin
  .from("platform_email_template")
  .select("template_id, name, category, subject, sections, placeholders")
  .eq("is_active", true)
  .order("name");
```

Pass `savedTemplates` to the client component.

**Step 2: Add template selector dropdown in compose form**

In `compose-page-client.tsx`, add a section before the manual SendGrid Template ID input:

```tsx
{
  templateMode === "sendgrid-dynamic" && savedTemplates && savedTemplates.length > 0 && (
    <div className="space-y-2">
      <Label>Velg lagret mal</Label>
      <Select
        onValueChange={(id) => {
          const t = savedTemplates.find((t) => t.template_id === id);
          if (t) {
            // Pre-fill form fields from saved template
            form.setValue("subject", t.subject);
            // Map sections to templateData fields...
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Velg en mal..." />
        </SelectTrigger>
        <SelectContent>
          {savedTemplates.map((t) => (
            <SelectItem key={t.template_id} value={t.template_id}>
              {t.name} ({t.category})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">
        Eller skriv inn SendGrid Template ID manuelt nedenfor
      </p>
    </div>
  );
}
```

**Step 3: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/communications/compose/
git commit -m "feat(comms): integrate saved templates into compose form"
```

---

### Task C3: Fix Webhook Signature Verification

**Files:**

- Modify: `supabase/functions/sendgrid-webhook/index.ts`

**Step 1: Read the current webhook handler**

At ~line 23, the signature verification just checks if the header exists but doesn't actually verify it cryptographically.

**Step 2: Implement proper SendGrid webhook signature verification**

SendGrid uses ECDSA signatures. The verification requires:

- The public key from SendGrid's Event Webhook settings
- The `x-twilio-email-event-webhook-signature` header
- The `x-twilio-email-event-webhook-timestamp` header
- The raw request body

```typescript
import { crypto } from "https://deno.land/std/crypto/mod.ts";

async function verifyWebhookSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string,
): Promise<boolean> {
  const payload = timestamp + body;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(publicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const sig = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  const data = new TextEncoder().encode(payload);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, sig, data);
}
```

**Note:** The exact verification method depends on SendGrid's documentation. Read the SendGrid Event Webhook docs for the correct algorithm. If this is complex, an alternative is to use a shared secret token as a simpler auth mechanism.

**Step 3: Test with a mock webhook event**

```bash
curl -X POST http://localhost:54321/functions/v1/sendgrid-webhook \
  -H "Content-Type: application/json" \
  -d '[{"event":"delivered","email":"test@test.com","sg_message_id":"abc123"}]'
```

**Step 4: Commit**

```bash
git add supabase/functions/sendgrid-webhook/
git commit -m "fix(comms): implement proper SendGrid webhook signature verification"
```

---

### Task C4: Add Recipient Locale Tracking

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/communications/send/route.ts`

**Step 1: Read the send route recipient creation**

At ~lines 207-215, recipients are inserted without locale data.

**Step 2: Add locale column to recipient insert**

The `profile` table likely has a `language` or `locale` column. When resolving recipients, include this field and store it:

```typescript
// When creating recipient records, include locale from profile data
const recipientRows = resolvedRecipients.map((r) => ({
  communication_id: jobId,
  email: r.email,
  name: r.name,
  status: "pending",
  // Add locale from profile (defaults to "no" for Norwegian users)
  // This enables multilingual sending in processDynamicTemplateBatches()
}));
```

**Note:** Check if `platform_communication_recipient` already has a locale column. If not, create a migration to add it:

```sql
ALTER TABLE platform_communication_recipient ADD COLUMN locale text DEFAULT 'no';
```

**Step 3: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/api/platform-admin/communications/send/ supabase/migrations/
git commit -m "feat(comms): track recipient locale for multilingual sending"
```

---

### Task C5: Add Basic Engagement Report View

**Files:**

- Create: `apps/web/src/app/platform-admin/communications/_components/engagement-report.tsx`
- Modify: `apps/web/src/app/platform-admin/communications/_components/communications-client.tsx`

**Step 1: Add a "Reports" tab to the communications page**

In `communications-client.tsx`, add a tab alongside the existing list:

```tsx
<Tabs defaultValue="history">
  <TabsList>
    <TabsTrigger value="history">Historikk</TabsTrigger>
    <TabsTrigger value="reports">Rapporter</TabsTrigger>
  </TabsList>
  <TabsContent value="history">{/* existing history table */}</TabsContent>
  <TabsContent value="reports">
    <EngagementReport communications={communications} />
  </TabsContent>
</Tabs>
```

**Step 2: Create EngagementReport component**

Aggregate data from existing communications:

```tsx
// engagement-report.tsx
"use client";

type Props = {
  communications: CommunicationLog[];
};

export function EngagementReport({ communications }: Props) {
  const totals = communications.reduce(
    (acc, c) => ({
      sent: acc.sent + (c.sent_count ?? 0),
      opened: acc.opened + (c.opened_count ?? 0),
      clicked: acc.clicked + (c.clicked_count ?? 0),
      failed: acc.failed + (c.failed_count ?? 0),
    }),
    { sent: 0, opened: 0, clicked: 0, failed: 0 },
  );

  const openRate = totals.sent > 0 ? ((totals.opened / totals.sent) * 100).toFixed(1) : "0";
  const clickRate = totals.opened > 0 ? ((totals.clicked / totals.opened) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total sendt" value={totals.sent} />
        <KpiCard label="Åpningsrate" value={`${openRate}%`} />
        <KpiCard label="Klikkrate" value={`${clickRate}%`} />
        <KpiCard
          label="Feilet"
          value={totals.failed}
          variant={totals.failed > 0 ? "warning" : "default"}
        />
      </div>

      {/* Per-communication breakdown table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Emne</TableHead>
            <TableHead>Dato</TableHead>
            <TableHead>Sendt</TableHead>
            <TableHead>Åpnet</TableHead>
            <TableHead>Klikket</TableHead>
            <TableHead>Åpningsrate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {communications.map((c) => {
            const rate =
              c.sent_count > 0 ? (((c.opened_count ?? 0) / c.sent_count) * 100).toFixed(1) : "—";
            return (
              <TableRow key={c.id}>
                <TableCell>{c.subject}</TableCell>
                <TableCell>{new Date(c.created_at).toLocaleDateString("nb-NO")}</TableCell>
                <TableCell>{c.sent_count}</TableCell>
                <TableCell>{c.opened_count ?? 0}</TableCell>
                <TableCell>{c.clicked_count ?? 0}</TableCell>
                <TableCell>{rate}%</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Step 3: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/communications/_components/
git commit -m "feat(comms): add basic engagement report view"
```

---

### Task C6: Verify Communications — Typecheck

**Step 1: Run full typecheck**

```bash
pnpm --filter web typecheck
```

**Step 2: Run lint**

```bash
pnpm --filter web lint
```

**Step 3: Fix any errors**

**Step 4: Commit**

```bash
git add -A apps/web/src/app/platform-admin/communications/ packages/notifications/
git commit -m "fix(comms): resolve typecheck and lint issues"
```

---

## Feature D: Entity Detail Pages (0% → 100%)

Full greenfield build. Create a shared EntityDetailLayout component and 4 detail pages: departments, locations, teams, and people. Reuse existing dialogs and data patterns from the list pages.

---

### Task D1: Create Shared EntityDetailLayout Component

**Files:**

- Create: `apps/web/src/app/dashboard/_components/EntityDetailLayout.tsx`

**Step 1: Read existing layout patterns**

Read `apps/web/src/app/dashboard/organization/_components/org-tab-nav.tsx` for the tab navigation pattern. Read `apps/web/src/components/dashboard/DashboardShell.tsx` for DashboardContext usage.

**Step 2: Create the shared layout component**

```tsx
// apps/web/src/app/dashboard/_components/EntityDetailLayout.tsx
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

type Tab = {
  id: string;
  label: string;
  icon?: LucideIcon;
};

type EntityDetailLayoutProps = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  accentColor?: string;
  backHref: string;
  backLabel?: string;
  tabs: Tab[];
  defaultTab?: string;
  actions?: ReactNode;
  children: (activeTab: string) => ReactNode;
  isDark: boolean;
};

export function EntityDetailLayout({
  title,
  subtitle,
  icon: Icon,
  accentColor = "#f97316",
  backHref,
  backLabel = "Tilbake",
  tabs,
  defaultTab,
  actions,
  children,
  isDark,
}: EntityDetailLayoutProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? "");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

      {/* Header */}
      <div className={`border-b px-6 py-4 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(backHref)}
            className={`rounded-lg p-2 transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-zinc-100"}`}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center gap-3">
            {Icon && (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accentColor}20` }}
              >
                <Icon className="h-5 w-5" style={{ color: accentColor }} />
              </div>
            )}
            <div>
              <h1 className="text-foreground text-lg font-bold">{title}</h1>
              {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>

        {/* Tab Navigation */}
        <div className="mt-4 flex gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? isDark
                      ? "bg-white/10 text-white"
                      : "bg-zinc-100 text-zinc-900"
                    : isDark
                      ? "text-zinc-400 hover:text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {TabIcon && <TabIcon className="h-4 w-4" />}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">{children(activeTab)}</div>
    </div>
  );
}
```

**Step 3: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/_components/EntityDetailLayout.tsx
git commit -m "feat(dashboard): add shared EntityDetailLayout component"
```

---

### Task D2: Create Department Detail Page

**Files:**

- Create: `apps/web/src/app/dashboard/organization/departments/[id]/page.tsx`
- Modify: `apps/web/src/app/dashboard/organization/_components/departments-tab.tsx` (add navigation)

**Step 1: Read departments-tab.tsx to understand data shape and existing dialogs**

Identify: department query shape, position query, profile query. Note which dialogs are used (CreatePositionDialog, EditPositionDialog, MovePositionDialog, EditDepartmentDialog).

**Step 2: Create the detail page**

```tsx
// apps/web/src/app/dashboard/organization/departments/[id]/page.tsx
"use client";

import { useContext, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { EntityDetailLayout } from "@/app/dashboard/_components/EntityDetailLayout";
import { createClient } from "@smartout/supabase/client";
import { Building2, Users, Briefcase, Shield, Settings } from "lucide-react";
// Import existing dialogs from organization module
import { EditDepartmentDialog } from "../../_components/EditDepartmentDialog";
import { CreatePositionDialog } from "../../_components/CreatePositionDialog";
// ... other imports

const TABS = [
  { id: "overview", label: "Oversikt", icon: Building2 },
  { id: "positions", label: "Stillinger", icon: Briefcase },
  { id: "teams", label: "Team", icon: Users },
  { id: "policies", label: "Retningslinjer", icon: Shield },
  { id: "settings", label: "Innstillinger", icon: Settings },
];

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isDark, workspaceData } = useContext(DashboardContext);
  const [department, setDepartment] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !workspaceData?.workspace_id) return;
    const supabase = createClient();

    async function load() {
      setLoading(true);
      const [deptRes, posRes, profileRes] = await Promise.all([
        supabase.from("department").select("*").eq("department_id", id).single(),
        supabase.from("position").select("*").eq("department_id", id).order("name"),
        supabase
          .from("profile")
          .select("profile_id, display_name, role, status, is_active")
          .eq("workspace_id", workspaceData!.workspace_id)
          .eq("department_id", id)
          .eq("is_active", true),
      ]);
      setDepartment(deptRes.data);
      setPositions(posRes.data ?? []);
      setProfiles(profileRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [id, workspaceData?.workspace_id]);

  if (loading || !department) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">Laster...</div>
    );
  }

  return (
    <EntityDetailLayout
      title={department.name}
      subtitle={`${profiles.length} ansatte · ${positions.length} stillinger`}
      icon={Building2}
      accentColor={department.color ?? "#f97316"}
      backHref="/dashboard/organization"
      backLabel="Organisasjon"
      tabs={TABS}
      isDark={isDark}
    >
      {(activeTab) => (
        <>
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Department overview: manager, description, key stats */}
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Ansatte" value={profiles.length} isDark={isDark} />
                <StatCard label="Stillinger" value={positions.length} isDark={isDark} />
                <StatCard label="Team" value="—" isDark={isDark} />
              </div>
              {/* Employee list */}
              <div className="space-y-2">
                <h3 className="text-foreground text-sm font-bold">Ansatte</h3>
                {profiles.map((p) => (
                  <div
                    key={p.profile_id}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
                  >
                    <div className="text-foreground text-sm font-medium">{p.display_name}</div>
                    <div className="text-muted-foreground text-xs">{p.role}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === "positions" && (
            <div className="space-y-4">
              {/* Reuse position list + create/edit dialogs */}
              {positions.map((pos) => (
                <div
                  key={pos.position_id}
                  className={`rounded-lg border p-4 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
                >
                  <div className="text-foreground font-medium">{pos.name}</div>
                  <div className="text-muted-foreground text-sm">{pos.description}</div>
                </div>
              ))}
            </div>
          )}
          {activeTab === "teams" && (
            <div className="text-muted-foreground text-sm">Team tilknyttet denne avdelingen</div>
          )}
          {activeTab === "policies" && (
            <div className="text-muted-foreground text-sm">Retningslinjer og protokoller</div>
          )}
          {activeTab === "settings" && (
            <div className="text-muted-foreground text-sm">Avdelingsinnstillinger</div>
          )}
        </>
      )}
    </EntityDetailLayout>
  );
}

function StatCard({
  label,
  value,
  isDark,
}: {
  label: string;
  value: string | number;
  isDark: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"}`}
    >
      <div className="text-muted-foreground text-xs font-medium">{label}</div>
      <div className="text-foreground mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
```

**Step 3: Wire navigation from departments-tab.tsx**

Add `useRouter` and make card clickable:

```tsx
import { useRouter } from "next/navigation";
// ...
const router = useRouter();

// On the department card div, add:
onClick={() => router.push(`/dashboard/organization/departments/${dept.department_id}`)}
className="cursor-pointer"
```

**Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/organization/departments/ apps/web/src/app/dashboard/organization/_components/departments-tab.tsx
git commit -m "feat(organization): add department detail page with navigation"
```

---

### Task D3: Create Location Detail Page

**Files:**

- Create: `apps/web/src/app/dashboard/organization/locations/[id]/page.tsx`
- Modify: `apps/web/src/app/dashboard/organization/_components/locations-tab.tsx` (add navigation)

**Step 1: Read locations-tab.tsx**

Identify: location query shape, zone/asset queries, existing dialogs (CreateZoneDialog, EditZoneDialog, CreateAssetDialog, EditAssetDialog, EditLocationDialog).

**Step 2: Create the detail page**

Same pattern as D2 but with location-specific tabs:

- Oversikt (overview with map if coordinates exist)
- Soner (zones list with CRUD dialogs)
- Eiendeler (assets list with CRUD dialogs)
- Innstillinger (edit location metadata)

Use the same EntityDetailLayout. Fetch: location, zones, assets.

**Step 3: Wire navigation from locations-tab.tsx**

```tsx
onClick={() => router.push(`/dashboard/organization/locations/${loc.location_id}`)}
```

**Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/organization/locations/ apps/web/src/app/dashboard/organization/_components/locations-tab.tsx
git commit -m "feat(organization): add location detail page with zones and assets"
```

---

### Task D4: Create Team Detail Page

**Files:**

- Create: `apps/web/src/app/dashboard/organization/teams/[id]/page.tsx`
- Modify: `apps/web/src/app/dashboard/organization/_components/teams-tab.tsx` (change from drawer to navigation)

**Step 1: Read teams-tab.tsx**

Identify: team query shape, TeamMembersSheet usage pattern. The team click currently opens a drawer — we'll change it to navigate to a detail page.

**Step 2: Create the detail page**

Tabs: Oversikt, Medlemmer (lift from TeamMembersSheet logic), Retningslinjer, Innstillinger.

The Medlemmer tab should show the same member management as TeamMembersSheet but inline instead of in a drawer: list members, add member dialog, remove member, set leader.

**Step 3: Wire navigation from teams-tab.tsx**

Replace `setSheetTeam(team)` with `router.push(...)`. Remove `sheetTeam` state and `TeamMembersSheet` render if it's only used from here.

```tsx
onClick={() => router.push(`/dashboard/organization/teams/${team.team_id}`)}
```

**Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/organization/teams/ apps/web/src/app/dashboard/organization/_components/teams-tab.tsx
git commit -m "feat(organization): add team detail page with member management"
```

---

### Task D5: Create Person Detail Page

**Files:**

- Create: `apps/web/src/app/dashboard/people/[id]/page.tsx`
- Modify: `apps/web/src/app/dashboard/people/_components/people-data-table.tsx` (add navigation)

**Step 1: Read EmployeeProfileCard (1289 lines)**

This component has 4 tabs: Overview, Competence, HR & Logs, Settings. The detail page should lift this content into a full-width page using EntityDetailLayout.

**Step 2: Create the detail page**

Fetch: profile (with department, user_identity joins), protocol_assignments, team_members, latest employment_contract.

Tabs match EmployeeProfileCard:

- Oversikt: name, role, department, contact info, avatar
- Kompetanse: protocol assignments, readiness score
- HR & Logger: contract, employment history, logs
- Innstillinger: role changes, status changes, account settings

**Step 3: Wire navigation from people-data-table.tsx**

Change row click from opening sidebar card to navigating:

```tsx
onClick={() => router.push(`/dashboard/people/${emp.profile_id}`)}
```

Keep EmployeeProfileCard as a secondary option (maybe on hover or as a side panel).

**Step 4: Run typecheck**

```bash
pnpm --filter web typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/people/ apps/web/src/app/dashboard/people/_components/people-data-table.tsx
git commit -m "feat(people): add person detail page with full profile view"
```

---

### Task D6: Verify Entity Detail Pages — Full Typecheck

**Step 1: Run full typecheck**

```bash
pnpm turbo typecheck
```

**Step 2: Run lint**

```bash
pnpm lint
```

**Step 3: Fix any errors found**

**Step 4: Commit**

```bash
git add -A
git commit -m "fix(entity-detail): resolve typecheck and lint issues across all detail pages"
```

---

## Execution Order

```
Feature A (Landing — 3 tasks)     ═══════
Feature B (Journey Portal — 6 tasks)  ═══════════
Feature C (Communications — 6 tasks)      ══════════════
Feature D (Entity Details — 6 tasks)           ═══════════════════
```

**Features A, B, C, D are independent** — they can be executed in parallel across worktrees or sequentially in one branch.

**Within each feature, tasks are sequential** (each builds on the previous).

**Total: 21 tasks across 4 features.**
