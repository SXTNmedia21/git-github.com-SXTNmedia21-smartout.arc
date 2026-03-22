---
title: "HMS Phase 1: Legibility — Implementation Plan"
status: draft
created: 2026-03-22
updated: 2026-03-22
module: hms
tags: [hms, governance, implementation, phase-1]
---

# HMS Phase 1: Legibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the governance dashboard into five intent-driven HMS surfaces, making the system coherent and navigable for the first time.

**Architecture:** One procedure engine exposed through five UX lenses (Oversikt, Drift, Opplaering, Dokumenter, Avvik). Phase 1 builds the routing shell, Oversikt (attention system), Documents (action-linked), improved Training (5-stage flow + competence matrix), and the unified Procedure Detail Page. Drift and Avvik are placeholder tabs pointing to Phase 2.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 (CSS config), shadcn/ui (new-york), TanStack Query v5, Tiptap (generateHTML for document rendering), Supabase PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-03-22-hms-governance-redesign-design.md`

**Branch:** `feat/hms-phase-1`

---

## File Structure

### New files

| File                                                                 | Responsibility                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `supabase/migrations/YYYYMMDDHHMMSS_hms_procedure_step_training.sql` | Add `training_content` + `media_urls` to procedure_step                   |
| `apps/web/src/app/dashboard/hms/layout.tsx`                          | HMS layout with sub-nav tabs                                              |
| `apps/web/src/app/dashboard/hms/page.tsx`                            | Oversikt — attention system                                               |
| `apps/web/src/app/dashboard/hms/drift/page.tsx`                      | Drift placeholder (Phase 2)                                               |
| `apps/web/src/app/dashboard/hms/training/page.tsx`                   | Opplaering — capability system                                            |
| `apps/web/src/app/dashboard/hms/documents/page.tsx`                  | Dokumenter — source-of-truth                                              |
| `apps/web/src/app/dashboard/hms/deviations/page.tsx`                 | Avvik placeholder (Phase 2)                                               |
| `apps/web/src/app/dashboard/hms/procedure/[id]/page.tsx`             | Procedure Detail Page                                                     |
| `apps/web/src/app/dashboard/hms/_components/HmsSubNav.tsx`           | Horizontal tab navigation                                                 |
| `apps/web/src/app/dashboard/hms/_components/OversiktDashboard.tsx`   | Oversikt: admin view with status/attention/action blocks                  |
| `apps/web/src/app/dashboard/hms/_components/OversiktEmployee.tsx`    | Oversikt: employee view with readiness ring + next action                 |
| `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx`    | Person x Protocol matrix for admin                                        |
| `apps/web/src/app/dashboard/hms/_components/LearnFlow.tsx`           | 5-stage employee learning experience                                      |
| `apps/web/src/app/dashboard/hms/_components/DocumentBrowser.tsx`     | Left panel tree + search for documents                                    |
| `apps/web/src/app/dashboard/hms/_components/DocumentViewer.tsx`      | Right panel: rendered document with action bar                            |
| `apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx` | Tab container for procedure detail (admin)                                |
| `apps/web/src/app/dashboard/hms/_components/ProcedureExperience.tsx` | Staged flow wrapper (employee)                                            |
| `packages/hms/src/hooks/use-procedure-steps.ts`                      | Fetch procedure steps with training_content (shared for mobile parity)    |
| `packages/hms/src/hooks/use-readiness-score.ts`                      | Calculate readiness from assignments (shared for mobile parity)           |
| `packages/hms/src/hooks/use-governance-filtered.ts`                  | Governance overview with domain filter support (shared for mobile parity) |
| `packages/hms/src/index.ts`                                          | Barrel export for all HMS shared hooks                                    |
| `packages/hms/package.json`                                          | Package config                                                            |
| `packages/hms/tsconfig.json`                                         | TypeScript config extending base                                          |

### Modified files

| File                                                   | Change                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `apps/web/src/components/dashboard/DashboardShell.tsx` | Sidebar: change governance href to `/dashboard/hms`, update mobile nav |
| `apps/web/src/app/dashboard/governance/page.tsx`       | Redirect to `/dashboard/hms`                                           |
| `packages/supabase/src/database.types.ts`              | Regenerate after migration                                             |

### Reused (no changes needed)

| File                                                                       | Reused for                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------ |
| `apps/web/src/app/dashboard/handbook/_components/ChapterReader.tsx`        | Pattern reference for document rendering               |
| `apps/web/src/app/dashboard/my-training/_hooks/use-assigned-protocols.ts`  | Data source for training tab                           |
| `apps/web/src/app/dashboard/my-training/_components/KnowledgeTestView.tsx` | Quiz UI inside LearnFlow                               |
| `apps/web/src/app/dashboard/my-training/_components/ConfirmationSign.tsx`  | Confirmation UI inside LearnFlow                       |
| `apps/web/src/app/dashboard/my-training/_components/ProcedureStepper.tsx`  | Step UI reference (Drift will need its own in Phase 2) |
| `apps/web/src/app/dashboard/_hooks/use-governance-overview.ts`             | Base hook for Oversikt (refactored with filter)        |

---

## Task 1: Database Migration — procedure_step training columns

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_hms_procedure_step_training.sql`
- Modify: `packages/supabase/src/database.types.ts` (regenerate)

- [ ] **Step 1: Create migration file**

```sql
-- Add training content columns to procedure_step
-- Required for HMS Phase 1: Opplaering 5-stage learning flow
-- These columns enable rich learning content per step (video, images, extended explanations)
-- while keeping the compact `description` for operational task view (Drift)

ALTER TABLE procedure_step ADD COLUMN training_content text;
ALTER TABLE procedure_step ADD COLUMN media_urls jsonb;

COMMENT ON COLUMN procedure_step.training_content IS 'Extended learning material shown in training mode. Markdown supported.';
COMMENT ON COLUMN procedure_step.media_urls IS 'Array of {type: "image"|"video", url: string, caption: string} for training media.';
```

Use timestamp format: `YYYYMMDDHHMMSS` (check latest migration number and increment).

- [ ] **Step 2: Apply migration locally**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<filename>.sql`
Expected: `ALTER TABLE` x2, no errors.

- [ ] **Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

- [ ] **Step 4: Verify new columns in types**

Run: `grep -A 5 'training_content' packages/supabase/src/database.types.ts`
Expected: `training_content: string | null` in procedure_step Row type.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<filename>.sql packages/supabase/src/database.types.ts
git commit -m "feat(hms): add training_content and media_urls to procedure_step

Required for Phase 1 Opplaering: rich learning content per step.
description = compact (Drift). training_content = rich (Opplaering).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: HMS Layout + Sub-Nav + Route Shell

**Files:**

- Create: `apps/web/src/app/dashboard/hms/layout.tsx`
- Create: `apps/web/src/app/dashboard/hms/_components/HmsSubNav.tsx`
- Create: `apps/web/src/app/dashboard/hms/page.tsx` (minimal placeholder)
- Create: `apps/web/src/app/dashboard/hms/drift/page.tsx` (placeholder)
- Create: `apps/web/src/app/dashboard/hms/training/page.tsx` (placeholder)
- Create: `apps/web/src/app/dashboard/hms/documents/page.tsx` (placeholder)
- Create: `apps/web/src/app/dashboard/hms/deviations/page.tsx` (placeholder)
- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`
- Modify: `apps/web/src/app/dashboard/governance/page.tsx`

- [ ] **Step 1: Create HmsSubNav component**

Follow the exact tab pattern from `apps/web/src/app/dashboard/season/page.tsx:101-138`. The tabs are: Oversikt, Drift, Opplaering, Dokumenter, Avvik.

Key differences from season tabs:

- These use Next.js `usePathname()` + `Link` for URL-based navigation (not local state)
- Each tab maps to a sub-route, not a client-side state toggle

```typescript
// apps/web/src/app/dashboard/hms/_components/HmsSubNav.tsx
"use client";

import { useContext } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardCheck,
  GraduationCap,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

const HMS_TABS = [
  { id: "oversikt", href: "/dashboard/hms", label: "Oversikt", icon: LayoutDashboard },
  { id: "drift", href: "/dashboard/hms/drift", label: "Drift", icon: ClipboardCheck },
  { id: "training", href: "/dashboard/hms/training", label: "Opplaering", icon: GraduationCap },
  { id: "documents", href: "/dashboard/hms/documents", label: "Dokumenter", icon: FileText },
  { id: "deviations", href: "/dashboard/hms/deviations", label: "Avvik", icon: AlertTriangle },
] as const;

export function HmsSubNav() {
  const { isDark } = useContext(DashboardContext);
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard/hms") return pathname === "/dashboard/hms";
    return pathname.startsWith(href);
  }

  return (
    <div className="bg-muted/50 border-border mb-6 flex gap-1 rounded-xl border p-1">
      {HMS_TABS.map((tab) => {
        const active = isActive(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              active
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create HMS layout**

```typescript
// apps/web/src/app/dashboard/hms/layout.tsx
import { HmsSubNav } from "./_components/HmsSubNav";

export default function HmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="z-10 flex-1 overflow-y-auto px-10 pt-8 pb-20">
      <HmsSubNav />
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create placeholder pages**

Each placeholder page should show the tab name and a "Coming in Phase X" message. Oversikt page.tsx is the default landing (will be fleshed out in Task 3).

Create minimal placeholder for each: `drift/page.tsx`, `training/page.tsx`, `documents/page.tsx`, `deviations/page.tsx`, and `hms/page.tsx`.

**i18n rule:** All Norwegian text MUST use i18n keys via `@smartout/i18n`. No hardcoded Norwegian strings. If the i18n package does not yet have HMS keys, add them to the Norwegian locale file and reference them. For Phase 1, acceptable fallback is to define string constants at the top of the file with `// TODO: move to i18n` comments, but NEVER inline Norwegian strings in JSX.

Placeholder pattern (uses CSS variable classes, not hardcoded zinc colors):

```typescript
// apps/web/src/app/dashboard/hms/drift/page.tsx
"use client";

import { ClipboardCheck } from "lucide-react";

// TODO: move to i18n
const STRINGS = {
  title: "Drift",
  description: "Daglige oppgaver, sjekklister og rutinelogging. Kommer i Phase 2.",
} as const;

export default function DriftPage() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/50 p-16">
      <ClipboardCheck className="text-muted-foreground mb-4 h-12 w-12" />
      <h2 className="text-foreground text-xl font-bold">{STRINGS.title}</h2>
      <p className="text-muted-foreground mt-2 text-sm">{STRINGS.description}</p>
    </div>
  );
}
```

Repeat for deviations with `AlertTriangle` icon and appropriate text. Use `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card` CSS variable classes throughout — never hardcoded `zinc-*` values.

- [ ] **Step 4: Update DashboardShell sidebar**

In `apps/web/src/components/dashboard/DashboardShell.tsx`, find the NavItem for governance (around line 1318) and change `href="/dashboard/governance"` to `href="/dashboard/hms"`. The label is already "HMS". Also update the `isActive` check and the `data-autoplay` selector.

Find all references to `/dashboard/governance` in DashboardShell and update to `/dashboard/hms`.

- [ ] **Step 5: Add redirect from old governance route**

```typescript
// apps/web/src/app/dashboard/governance/page.tsx
import { redirect } from "next/navigation";

export default function GovernancePage() {
  redirect("/dashboard/hms");
}
```

Replace the entire existing file content. The old governance components stay in place — they are still accessible at `/dashboard/hms` for admin CRUD operations. Specifically: PolicyForm, ProtocolForm, ProcedureBuilder, KnowledgeTestBuilder, and ConfirmationForm will be integrated into the Procedure Detail Page admin view. Until then, admin users access CRUD via the Oversikt admin view which will render these forms inline (or via a temporary "Administrer" button linking to the old component set).

- [ ] **Step 6: Verify routing works**

Run: `pnpm --filter web dev`
Navigate to: `http://localhost:3060/dashboard/hms`
Expected: See sub-nav with 5 tabs, Oversikt tab active, placeholder content.
Navigate to: `http://localhost:3060/dashboard/governance`
Expected: Redirects to `/dashboard/hms`.
Navigate to: `http://localhost:3060/dashboard/hms/drift`
Expected: Drift placeholder with Phase 2 message.

- [ ] **Step 7: Run typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/dashboard/hms/ apps/web/src/components/dashboard/DashboardShell.tsx apps/web/src/app/dashboard/governance/page.tsx
git commit -m "feat(hms): route shell with sub-nav and 5 tab placeholders

/dashboard/hms with Oversikt, Drift, Opplaering, Dokumenter, Avvik tabs.
Governance page redirects to /dashboard/hms.
Sidebar updated. Season tab pattern reused for sub-nav.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Oversikt — Attention System

**Files:**

- Create: `packages/hms/package.json`
- Create: `packages/hms/tsconfig.json`
- Create: `packages/hms/src/index.ts`
- Create: `packages/hms/src/hooks/use-readiness-score.ts`
- Create: `packages/hms/src/hooks/use-governance-filtered.ts`
- Create: `apps/web/src/app/dashboard/hms/_components/OversiktDashboard.tsx`
- Create: `apps/web/src/app/dashboard/hms/_components/OversiktEmployee.tsx`
- Modify: `apps/web/src/app/dashboard/hms/page.tsx`

- [ ] **Step 0: Create packages/hms package**

Create `packages/hms/package.json` following the pattern of existing packages (e.g., `packages/utils/`):

```json
{
  "name": "@smartout/hms",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@smartout/supabase": "workspace:*",
    "@tanstack/react-query": "catalog:"
  },
  "devDependencies": {
    "@smartout/typescript-config": "workspace:*"
  }
}
```

Create `packages/hms/tsconfig.json` extending base config. Create `packages/hms/src/index.ts` as barrel export. Run `pnpm install` from root to wire up the workspace.

All new HMS data hooks go in this package. Web app imports via `@smartout/hms`. Mobile app can import the same hooks later.

- [ ] **Step 1: Create use-readiness-score hook**

This hook calculates readiness from existing `useAssignedProtocols` data. Pure computation, no new DB queries.

```typescript
// packages/hms/src/hooks/use-readiness-score.ts
"use client";

import { useMemo } from "react";
import { useAssignedProtocols } from "@/app/dashboard/my-training/_hooks/use-assigned-protocols";

export function useReadinessScore(profileId: string | null) {
  const { data: protocols, isLoading } = useAssignedProtocols(profileId);

  const score = useMemo(() => {
    if (!protocols || protocols.length === 0) return { percent: 0, completed: 0, total: 0 };
    const completed = protocols.filter((p) => p.assignmentStatus === "completed").length;
    return {
      percent: Math.round((completed / protocols.length) * 100),
      completed,
      total: protocols.length,
    };
  }, [protocols]);

  return { score, isLoading };
}
```

- [ ] **Step 2: Create use-governance-filtered hook**

Extends `useGovernanceOverview` with optional `policyType` filter for IK-Mat scoping.

```typescript
// packages/hms/src/hooks/use-governance-filtered.ts
"use client";

import { useMemo } from "react";
import { useGovernanceOverview } from "@/app/dashboard/_hooks";
import type { ProtocolOverviewItem } from "@/app/dashboard/_hooks";

type Domain = "all" | "haccp" | "safety" | "hr" | "operational";

export function useGovernanceFiltered(domain: Domain = "all") {
  const { data: protocols, isLoading, error } = useGovernanceOverview();

  const filtered = useMemo(() => {
    if (!protocols || domain === "all") return protocols ?? [];
    const domainTypes: Record<Domain, string[]> = {
      all: [],
      haccp: ["haccp"],
      safety: ["haccp", "safety"],
      hr: ["hr"],
      operational: ["operational"],
    };
    const types = domainTypes[domain];
    return protocols.filter((p) => types.includes(p.policyType));
  }, [protocols, domain]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const overdue = filtered.filter((p) => p.expiredCount > 0).length;
    const avgCompletion =
      total > 0 ? Math.round(filtered.reduce((s, p) => s + p.completionPercent, 0) / total) : 0;
    return { total, overdue, avgCompletion };
  }, [filtered]);

  return { protocols: filtered, stats, isLoading, error };
}
```

- [ ] **Step 3: Create OversiktDashboard (admin view)**

Three blocks: Status, Attention, Action. Follow the spec section 3 exactly.

Uses `useGovernanceFiltered` for protocol data and renders:

- Status block: readiness %, open deviations (placeholder count), overdue items, critical controls
- Attention block: protocols with low completion, employees with expired assignments
- Action block: buttons for assign training, review deviation, log control, inspection pack

Reference the existing card patterns from `apps/web/src/app/dashboard/reports/_components/OverviewSection.tsx` for KPI card styling.

This is a substantial component (~200 lines). Key sections:

- Readiness ring (use a simple SVG circle with stroke-dasharray)
- KPI cards grid (4 cards)
- Attention list (protocols sorted by worst completion)
- Action buttons row

- [ ] **Step 4: Create OversiktEmployee (employee view)**

Simpler view: readiness ring, "X ting gjenstar" text, next-action card.

Uses `useReadinessScore` and `useAssignedProtocols` to show:

- Large readiness percentage with ring
- Count of remaining protocols
- Next recommended protocol with "Fortsett" button linking to `/dashboard/hms/training`

- [ ] **Step 5: Wire up Oversikt page**

```typescript
// apps/web/src/app/dashboard/hms/page.tsx
"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { OversiktDashboard } from "./_components/OversiktDashboard";
import { OversiktEmployee } from "./_components/OversiktEmployee";

export default function HmsOversiktPage() {
  const { isAdminMode } = useContext(DashboardContext);

  return isAdminMode ? <OversiktDashboard /> : <OversiktEmployee />;
}
```

- [ ] **Step 6: Verify**

Run: `pnpm --filter web dev`
Toggle admin mode on/off in dashboard — verify two different views render.
Run: `pnpm turbo typecheck`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/hms/
git commit -m "feat(hms): Oversikt attention system with admin + employee views

Admin: status/attention/action blocks with readiness %, overdue, alerts.
Employee: readiness ring + next action card.
Strict rule: only what requires attention now.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Documents — Source-of-Truth System

**Files:**

- Create: `apps/web/src/app/dashboard/hms/_components/DocumentBrowser.tsx`
- Create: `apps/web/src/app/dashboard/hms/_components/DocumentViewer.tsx`
- Modify: `apps/web/src/app/dashboard/hms/documents/page.tsx`

- [ ] **Step 1: Create DocumentBrowser (left panel)**

Tree navigation with max 3 levels: Policy -> Protocol -> Procedure.

Fetches all policies + protocols + procedures for the workspace. Renders as a collapsible tree with search bar at top.

Data: Query `policy` -> for each, query `protocol` -> for each, query `procedure`. Use existing Supabase client patterns.

Key features:

- Search input (filters tree by title match)
- Collapsible sections per policy
- Protocol items show procedure count badge
- Procedure items are clickable (set selectedProcedureId)
- Handbook chapters section at top (from `handbook_chapter` table)

- [ ] **Step 2: Create DocumentViewer (right panel)**

Renders the selected document with metadata header and action bar.

For handbook chapters: use `generateHTML()` pattern from `ChapterReader.tsx`.
For procedures: programmatic rendering of steps as ordered list.
For policies/protocols: render statement/description as prose.

Action bar (top-right): Start opplaering, Ta quiz, Signer, Meld avvik, Spor AI.

- "Start opplaering" links to `/dashboard/hms/training` with `?procedure=<id>` param
- "Meld avvik" links to `/dashboard/hms/deviations` (placeholder in Phase 1)
- "Spor AI" is disabled with tooltip "Kommer i Phase 4"
- Visibility gated by `isAdminMode` for admin-only actions (Rediger)

Metadata header shows: status badge, policy type, last updated, owner, assignment count.

- [ ] **Step 3: Wire up Documents page**

Two-panel layout: DocumentBrowser (left, ~300px) + DocumentViewer (right, flex-1).

```typescript
// apps/web/src/app/dashboard/hms/documents/page.tsx
"use client";

import { useState } from "react";
import { DocumentBrowser } from "../_components/DocumentBrowser";
import { DocumentViewer } from "../_components/DocumentViewer";

type DocumentSelection = {
  type: "handbook" | "policy" | "protocol" | "procedure";
  id: string;
};

export default function DocumentsPage() {
  const [selection, setSelection] = useState<DocumentSelection | null>(null);

  return (
    <div className="flex min-h-[600px] gap-0 overflow-hidden rounded-xl border border-border">
      <DocumentBrowser onSelect={setSelection} selected={selection} />
      <DocumentViewer selection={selection} />
    </div>
  );
}
```

- [ ] **Step 4: Verify browse + context modes**

Browse mode: navigate to `/dashboard/hms/documents` — see tree, click items, see rendered content.
Context mode: navigate to `/dashboard/hms/documents?type=procedure&id=<uuid>` — document auto-opens.

- [ ] **Step 5: Run typecheck**

Run: `pnpm turbo typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/hms/
git commit -m "feat(hms): Documents source-of-truth with browse + context modes

Two-panel layout: tree browser (left) + document viewer (right).
Action bar on every document: start training, take quiz, sign, report.
Renders handbook chapters (Tiptap), procedures (steps), policies (prose).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Training — 5-Stage Learn Flow + Competence Matrix

**Files:**

- Create: `apps/web/src/app/dashboard/hms/_components/LearnFlow.tsx`
- Create: `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx`
- Create: `packages/hms/src/hooks/use-procedure-steps.ts`
- Modify: `apps/web/src/app/dashboard/hms/training/page.tsx`

- [ ] **Step 1: Create use-procedure-steps hook**

Fetches procedure steps including new `training_content` and `media_urls` columns.

```typescript
// packages/hms/src/hooks/use-procedure-steps.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type ProcedureStepWithTraining = {
  stepId: string;
  title: string;
  description: string;
  trainingContent: string | null;
  mediaUrls: Array<{ type: "image" | "video"; url: string; caption: string }> | null;
  estimatedMinutes: number | null;
  isRequired: boolean;
  stepOrder: number;
};

export function useProcedureSteps(procedureId: string | undefined) {
  return useQuery({
    queryKey: ["procedure-steps", procedureId],
    enabled: !!procedureId,
    queryFn: async (): Promise<ProcedureStepWithTraining[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("procedure_step")
        .select(
          "step_id, title, description, training_content, media_urls, estimated_minutes, is_required, step_order",
        )
        .eq("procedure_id", procedureId!)
        .order("step_order");

      if (error) throw error;

      return (data ?? []).map((s) => ({
        stepId: s.step_id,
        title: s.title,
        description: s.description,
        trainingContent: s.training_content,
        mediaUrls: s.media_urls as ProcedureStepWithTraining["mediaUrls"],
        estimatedMinutes: s.estimated_minutes,
        isRequired: s.is_required,
        stepOrder: s.step_order,
      }));
    },
  });
}
```

- [ ] **Step 2: Create LearnFlow component**

The 5-stage learning experience for employees. This is a NEW component that does NOT reuse ProcedureStepper (different interaction contract — learn vs do).

Stages: Understand -> Practice -> Test -> Confirm -> Done.

Key differences from existing my-training components:

- Shows `training_content` (rich text) not just `description`
- Shows `media_urls` (images/videos) inline
- Has AI placeholder button ("Forklar dette enklere" — disabled in Phase 1)
- Progress is staged (not just step checkmarks)
- Completion triggers readiness score update

Reuse `KnowledgeTestView` and `ConfirmationSign` from my-training for stages 3 and 4 — import them directly.

- [ ] **Step 3: Create CompetenceMatrix component**

Admin view: table with employees as rows, protocols as columns, completion status in cells.

Data source: fetch all `protocol_assignment` for the workspace, group by profile_id and protocol_id.

Cell states: OK (completed), percentage (in_progress), -- (not_started), Forfalt (expired).
Row summary: readiness % per employee.
Column summary: compliance % per protocol.

Department/team filter at top.

- [ ] **Step 4: Wire up Training page**

```typescript
// apps/web/src/app/dashboard/hms/training/page.tsx
"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { CompetenceMatrix } from "../_components/CompetenceMatrix";
import { ProtocolList } from "@/app/dashboard/my-training/_components/ProtocolList";

export default function TrainingPage() {
  const { isAdminMode } = useContext(DashboardContext);

  // Admin sees competence matrix. Employee sees their protocol list.
  // Note: Employee view reuses existing ProtocolList from my-training.
  // In a future iteration, ProtocolList will be replaced with LearnFlow
  // as the primary employee experience once training_content is populated.
  return isAdminMode ? <CompetenceMatrix /> : <ProtocolList />;
}
```

Note: The full LearnFlow integration requires training_content data to be populated in procedures. For Phase 1, employee view reuses existing ProtocolList. LearnFlow is created and accessible via `/dashboard/hms/procedure/[id]` but is not the default training page yet.

- [ ] **Step 5: Verify**

Admin mode: see competence matrix with real protocol data.
Employee mode: see existing protocol list (same as my-training).

- [ ] **Step 6: Run typecheck**

Run: `pnpm turbo typecheck`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/hms/
git commit -m "feat(hms): Training tab with competence matrix + learn flow

Admin: competence matrix (person x protocol) with readiness %.
Employee: reuses existing ProtocolList (LearnFlow created for procedure detail).
New hook: useProcedureSteps with training_content + media_urls.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Procedure Detail Page — Canonical Control Plane

**Files:**

- Create: `apps/web/src/app/dashboard/hms/procedure/[id]/page.tsx`
- Create: `apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx`
- Create: `apps/web/src/app/dashboard/hms/_components/ProcedureExperience.tsx`

- [ ] **Step 1: Create ProcedureDetailTabs (admin view)**

Tabs: Oversikt, Steg, Quiz, Bekreftelse. (Logg, Avvik, Historikk are Phase 2/3.)

Each tab renders the appropriate content for the procedure.

- Oversikt: metadata, status, assignment count, completion rate, related policy
- Steg: procedure steps with training_content and media (uses useProcedureSteps)
- Quiz: list of knowledge tests for this protocol (link to KnowledgeTestView)
- Bekreftelse: list of confirmations (link to ConfirmationSign)

- [ ] **Step 2: Create ProcedureExperience (employee view)**

Wraps LearnFlow for the specific procedure. Shows the 5-stage flow.

If the employee has an assignment for this procedure's protocol, resume at current stage.
If no assignment exists, show read-only view (document mode).

- [ ] **Step 3: Create procedure detail page**

```typescript
// apps/web/src/app/dashboard/hms/procedure/[id]/page.tsx
"use client";

import { useContext } from "react";
import { useParams } from "next/navigation";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ProcedureDetailTabs } from "../../_components/ProcedureDetailTabs";
import { ProcedureExperience } from "../../_components/ProcedureExperience";

export default function ProcedureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdminMode } = useContext(DashboardContext);

  return isAdminMode
    ? <ProcedureDetailTabs procedureId={id} />
    : <ProcedureExperience procedureId={id} />;
}
```

- [ ] **Step 4: Verify**

Navigate to `/dashboard/hms/procedure/<real-procedure-id>`.
Admin mode: see tabs with procedure data.
Employee mode: see staged learn flow (or read-only if no assignment).

- [ ] **Step 5: Run typecheck**

Run: `pnpm turbo typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/hms/procedure/ apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx apps/web/src/app/dashboard/hms/_components/ProcedureExperience.tsx
git commit -m "feat(hms): Procedure Detail Page — canonical control plane

Admin: tabbed view (Oversikt, Steg, Quiz, Bekreftelse).
Employee: 5-stage learn flow wrapper.
Procedure Detail = master page. Procedure Experience = role wrapper.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Final Verification + Cleanup

- [ ] **Step 1: Full typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 0 errors (warnings acceptable).

- [ ] **Step 3: Visual verification**

Navigate through all 5 tabs. Verify:

- Oversikt shows real data (or graceful empty states)
- Documents tree loads policies/protocols/procedures
- Training shows competence matrix (admin) or protocol list (employee)
- Drift and Avvik show Phase 2 placeholders
- Procedure detail page renders for a real procedure ID
- Old `/dashboard/governance` redirects correctly
- Sidebar "HMS" link works

- [ ] **Step 4: Update DashboardShell walkthrough**

In DashboardShell.tsx, update the autoplay/walkthrough step that references governance:

- Change `id: "governance"` to `id: "hms"`
- Change `selector` to `'[data-autoplay="nav-/dashboard/hms"]'`
- Change `expectedPathname` to `"/dashboard/hms"`

- [ ] **Step 5: Commit cleanup**

```bash
git add -A
git commit -m "chore(hms): Phase 1 cleanup — typecheck, lint, walkthrough update

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Summary

| Task                | What it delivers                                       | Estimated complexity               |
| ------------------- | ------------------------------------------------------ | ---------------------------------- |
| 1. Migration        | training_content + media_urls on procedure_step        | Small (2 ALTER TABLE)              |
| 2. Route Shell      | /dashboard/hms/\* with 5 tabs + sidebar update         | Medium (layout + nav + redirect)   |
| 3. Oversikt         | Attention system: admin dashboard + employee readiness | Large (2 views + 2 hooks)          |
| 4. Documents        | Browse + context document viewer with action bar       | Large (2 panels + data queries)    |
| 5. Training         | Competence matrix + learn flow + procedure steps hook  | Large (2 views + 1 hook)           |
| 6. Procedure Detail | Canonical control plane with admin/employee views      | Medium (tabs + experience wrapper) |
| 7. Verification     | Typecheck, lint, visual QA, walkthrough update         | Small                              |

**Total new files:** ~17
**Total modified files:** ~3
**Migration:** 1 (procedure_step training columns)
