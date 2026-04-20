---
title: "Plan A — Renholdssjekker"
status: draft
updated: 2026-04-13
created: 2026-04-13
module: operations
tags: [renholdssjekker, hms, cleaning, plan]
---

# Plan A — Renholdssjekker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cleaning checklist UI so employees can execute maintenance procedures as interactive checklists with signing, and admins can create/configure them — using existing governance tables (no new tables).

**Architecture:** procedure (type=maintenance) + procedure_step = checklist definition. routine + session_hook = scheduling. session_task = runtime execution. Deviation on failure. All tables exist — this is pure UI + seed data + telemetry.

**Tech Stack:** Next.js App Router, TanStack Query, shadcn/ui, Supabase, @smartout/telemetry, packages/i18n

**Spec:** `docs/superpowers/specs/2026-04-13-missing-features-renhold-drift-skiftbytte-design.md` § Feature 1

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/i18n/locales/nb/cleaning.json` | Norwegian cleaning labels |
| Create | `packages/i18n/locales/en/cleaning.json` | English cleaning labels |
| Modify | `packages/telemetry/src/registry.ts` | Register 5 checklist events |
| Modify | `supabase/seed.sql` | Seed example maintenance procedure + hook |
| Modify | `apps/web/src/app/dashboard/hms/governance/page.tsx` | Add maintenance procedure filter |
| Create | `apps/web/src/app/dashboard/hms/governance/_components/MaintenanceProcedureForm.tsx` | Admin CRUD for cleaning checklists |
| Create | `apps/web/src/app/dashboard/hms/governance/_hooks/use-maintenance-procedures.ts` | Fetch/mutate maintenance procedures |
| Create | `apps/web/src/app/dashboard/hms/governance/_components/SessionHookConfig.tsx` | Link procedure to session lifecycle |
| Modify | `apps/mobile/src/components/task/TaskFeed.tsx` | Group maintenance tasks as checklist card |
| Create | `apps/mobile/src/components/task/ChecklistView.tsx` | Interactive checklist execution |
| Create | `apps/mobile/src/hooks/mutations/use-checklist.ts` | Complete checkpoint + sign mutations |

---

### Task 1: i18n Labels

**Files:**
- Create: `packages/i18n/locales/nb/cleaning.json`
- Create: `packages/i18n/locales/en/cleaning.json`

- [ ] **Step 1: Create Norwegian cleaning labels**

```json
{
  "cleaning.title": "Renholdssjekk",
  "cleaning.newProcedure": "Ny renholdssjekkliste",
  "cleaning.editProcedure": "Rediger sjekkliste",
  "cleaning.checkpoint": "Sjekkpunkt",
  "cleaning.addCheckpoint": "Legg til sjekkpunkt",
  "cleaning.signAndComplete": "Signer og fullfør",
  "cleaning.signed": "Signert",
  "cleaning.signedBy": "Signert av",
  "cleaning.overdue": "Forfalt",
  "cleaning.completed": "Fullført",
  "cleaning.pending": "Venter",
  "cleaning.progress": "{{done}} av {{total}} fullført",
  "cleaning.deviationFlagged": "Avvik rapportert",
  "cleaning.flagDeviation": "Rapporter avvik",
  "cleaning.takePhoto": "Ta bilde",
  "cleaning.noChecklists": "Ingen sjekklister i dag",
  "cleaning.complianceRequired": "Påkrevd av Mattilsynet",
  "cleaning.hookPreOpen": "Ved åpning",
  "cleaning.hookClose": "Ved stenging",
  "cleaning.selectHookType": "Når skal sjekklisten kjøres?",
  "cleaning.selectDepartment": "Velg avdeling"
}
```

- [ ] **Step 2: Create English cleaning labels**

```json
{
  "cleaning.title": "Cleaning Checklist",
  "cleaning.newProcedure": "New cleaning checklist",
  "cleaning.editProcedure": "Edit checklist",
  "cleaning.checkpoint": "Checkpoint",
  "cleaning.addCheckpoint": "Add checkpoint",
  "cleaning.signAndComplete": "Sign and complete",
  "cleaning.signed": "Signed",
  "cleaning.signedBy": "Signed by",
  "cleaning.overdue": "Overdue",
  "cleaning.completed": "Completed",
  "cleaning.pending": "Pending",
  "cleaning.progress": "{{done}} of {{total}} completed",
  "cleaning.deviationFlagged": "Deviation flagged",
  "cleaning.flagDeviation": "Flag deviation",
  "cleaning.takePhoto": "Take photo",
  "cleaning.noChecklists": "No checklists today",
  "cleaning.complianceRequired": "Required by food safety authority",
  "cleaning.hookPreOpen": "At opening",
  "cleaning.hookClose": "At closing",
  "cleaning.selectHookType": "When should the checklist run?",
  "cleaning.selectDepartment": "Select department"
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/locales/nb/cleaning.json packages/i18n/locales/en/cleaning.json
git commit -m "feat(i18n): add cleaning checklist labels (nb + en)"
```

---

### Task 2: Register Telemetry Events

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Read the existing registry file to find where scheduling events end**

Read `packages/telemetry/src/registry.ts` and locate the EVENT_ROUTING object. Find the last `scheduling` category entry.

- [ ] **Step 2: Add 5 checklist events to the SmartoutEvent type union**

Find the type union that defines valid event strings (format: `"entity action"`) and add:

```typescript
| "checklist started"
| "checklist step_completed"
| "checklist completed"
| "checklist overdue"
| "checklist deviation_flagged"
```

- [ ] **Step 3: Add routing entries to EVENT_ROUTING**

Add after the existing operations or scheduling entries:

```typescript
  "checklist started": {
    destinations: ["posthog", "activity_trail"],
    category: "operations",
  },
  "checklist step_completed": {
    destinations: ["activity_trail"],
    category: "operations",
  },
  "checklist completed": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "operations",
  },
  "checklist overdue": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "operations",
  },
  "checklist deviation_flagged": {
    destinations: ["posthog", "activity_trail", "engine_event"],
    category: "operations",
  },
```

- [ ] **Step 4: Run typecheck to verify**

```bash
pnpm --filter telemetry typecheck
```

Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register 5 checklist events"
```

---

### Task 3: Seed Data

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Read current seed.sql to find the end of governance/procedure inserts**

Look for existing procedure/protocol/policy inserts. The seed uses deterministic UUIDs (`x0000000-...`).

- [ ] **Step 2: Append cleaning seed data**

Add at the end of `supabase/seed.sql` (or after governance inserts):

```sql
-- ── Cleaning Checklist Seed Data ────────────────────────────────────────────

-- Policy for kitchen cleaning
INSERT INTO public.policy (policy_id, workspace_id, policy_type, policy_scope, name, statement, enforcement_status, created_by)
VALUES (
  'f1000000-0000-0000-0000-000000000000',
  'b0000000-0000-0000-0000-000000000000',
  'haccp', 'department',
  'Kjøkkenrenhold',
  'Kjøkkenet skal rengjøres etter Mattilsynets krav ved åpning og stenging.',
  'enforced',
  'e0000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- Protocol for kitchen cleaning
INSERT INTO public.protocol (protocol_id, policy_id, workspace_id, name, description, version, status, owner_profile_id, created_by)
VALUES (
  'f1100000-0000-0000-0000-000000000000',
  'f1000000-0000-0000-0000-000000000000',
  'b0000000-0000-0000-0000-000000000000',
  'Daglig kjøkkenrenhold',
  'Sjekkliste for daglig renhold av kjøkken',
  '1.0', 'active',
  'e0000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- Procedure (the actual checklist)
INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, is_active)
VALUES (
  'f1200000-0000-0000-0000-000000000000',
  'f1100000-0000-0000-0000-000000000000',
  'Morgenrenhold kjøkken',
  'Sjekkliste for renhold før åpning',
  'maintenance', true
) ON CONFLICT DO NOTHING;

-- 5 procedure steps (checkpoints)
INSERT INTO public.procedure_step (step_id, procedure_id, title, description, step_order, is_required) VALUES
  ('f1210000-0000-0000-0000-000000000000', 'f1200000-0000-0000-0000-000000000000', 'Rengjør arbeidsflater', 'Tørk av alle benker og skjærefjøler med desinfiserende middel.', 1, true),
  ('f1210000-0000-0000-0000-000000000001', 'f1200000-0000-0000-0000-000000000000', 'Vask gulv', 'Feie og vaske kjøkkengulvet. Sjekk under utstyr.', 2, true),
  ('f1210000-0000-0000-0000-000000000002', 'f1200000-0000-0000-0000-000000000000', 'Tøm søppel', 'Tøm alle søppelbøtter. Sett inn nye poser.', 3, true),
  ('f1210000-0000-0000-0000-000000000003', 'f1200000-0000-0000-0000-000000000000', 'Sjekk håndvask', 'Kontroller at såpe og papir er fylt opp ved alle håndvasker.', 4, true),
  ('f1210000-0000-0000-0000-000000000004', 'f1200000-0000-0000-0000-000000000000', 'Rengjør kjøleskap utvendig', 'Tørk av håndtak og overflater på kjøleskap og fryser.', 5, false)
ON CONFLICT DO NOTHING;

-- Session hook: fire this procedure at pre_open for Kitchen department
INSERT INTO public.session_hook (id, workspace_id, department_id, hook_type, trigger_offset_min, linked_procedure_id, is_active)
VALUES (
  'f1300000-0000-0000-0000-000000000000',
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000001', -- Kitchen department
  'pre_open', 0,
  'f1200000-0000-0000-0000-000000000000',
  true
) ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Verify seed applies cleanly**

```bash
npx supabase db reset
```

Expected: No errors. Seed data applied.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(seed): add kitchen cleaning checklist with 5 checkpoints and session hook"
```

---

### Task 4: Admin Maintenance Procedure Hooks

**Files:**
- Create: `apps/web/src/app/dashboard/hms/governance/_hooks/use-maintenance-procedures.ts`

- [ ] **Step 1: Create the data hook for fetching maintenance procedures**

```typescript
"use client";

/**
 * Fetches and mutates maintenance-type procedures for the cleaning checklist admin.
 * Queries procedure table filtered by procedure_type = 'maintenance',
 * joined with procedure_step for checkpoint details and session_hook for scheduling.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";

export type MaintenanceProcedure = {
  procedure_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  protocol: { protocol_id: string; name: string } | null;
  steps: Array<{
    step_id: string;
    title: string;
    description: string | null;
    step_order: number;
    is_required: boolean;
  }>;
  hooks: Array<{
    id: string;
    hook_type: string;
    department_id: string;
    trigger_offset_min: number;
    is_active: boolean;
  }>;
};

function maintenanceKey(wsId: string) {
  return ["hms", "maintenance-procedures", wsId] as const;
}

export function useMaintenanceProcedures() {
  const ws = useWorkspaceOptional();
  const wsId = ws?.workspace_id;

  return useQuery({
    queryKey: maintenanceKey(wsId ?? ""),
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("procedure")
        .select(`
          procedure_id, name, description, is_active,
          protocol:protocol_id(protocol_id, name),
          steps:procedure_step(step_id, title, description, step_order, is_required),
          hooks:session_hook!session_hook_linked_procedure_id_fkey(id, hook_type, department_id, trigger_offset_min, is_active)
        `)
        .eq("procedure_type", "maintenance")
        .order("name");

      if (error) throw error;
      return (data ?? []) as unknown as MaintenanceProcedure[];
    },
  });
}

export function useCreateSessionHook() {
  const ws = useWorkspaceOptional();
  const wsId = ws?.workspace_id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      department_id: string;
      hook_type: "pre_open" | "close";
      linked_procedure_id: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("session_hook")
        .insert({
          workspace_id: wsId!,
          department_id: params.department_id,
          hook_type: params.hook_type,
          trigger_offset_min: 0,
          linked_procedure_id: params.linked_procedure_id,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: maintenanceKey(wsId ?? "") });
    },
  });
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/hms/governance/_hooks/use-maintenance-procedures.ts
git commit -m "feat(hms): add maintenance procedure data hooks"
```

---

### Task 5: Admin Maintenance Procedure Form (Web)

**Files:**
- Create: `apps/web/src/app/dashboard/hms/governance/_components/MaintenanceProcedureForm.tsx`

- [ ] **Step 1: Read existing governance components to understand patterns**

Read `apps/web/src/app/dashboard/governance/_components/GovernanceOverview.tsx` to see the component pattern (card layout, data display, action buttons).

- [ ] **Step 2: Create the maintenance procedure admin form**

This component lets admins create and edit maintenance procedures (cleaning checklists). It renders a form with: procedure name, description, draggable checkpoint list, and session hook configuration.

The component should:
- Use shadcn `Dialog`, `Input`, `Textarea`, `Button`, `Switch` components
- Use the `useMaintenanceProcedures()` hook from Task 4
- Show existing procedures as cards with edit/delete actions
- Create/edit dialog with: name, description, checkpoint list (add/remove/reorder), compliance toggle
- Empty state: ghost card with dashed border + `cleaning.noChecklists` i18n label

- [ ] **Step 3: Run typecheck and verify rendering**

```bash
pnpm --filter web typecheck && pnpm --filter web dev
```

Navigate to `/dashboard/hms/governance/` and verify the maintenance section renders.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/hms/governance/_components/MaintenanceProcedureForm.tsx
git commit -m "feat(hms): add maintenance procedure admin form for cleaning checklists"
```

---

### Task 6: Session Hook Configuration Component

**Files:**
- Create: `apps/web/src/app/dashboard/hms/governance/_components/SessionHookConfig.tsx`

- [ ] **Step 1: Create the hook configuration component**

This component lets admins link a maintenance procedure to a department session lifecycle point (pre_open or close). It renders:
- Department selector (from workspace departments)
- Hook type radio: "Ved åpning" (pre_open) / "Ved stenging" (close)
- Save button that calls `useCreateSessionHook()`

Use i18n keys: `cleaning.hookPreOpen`, `cleaning.hookClose`, `cleaning.selectHookType`, `cleaning.selectDepartment`.

- [ ] **Step 2: Wire into MaintenanceProcedureForm**

Add a "Koble til avdeling" section in the procedure edit dialog that renders `SessionHookConfig` with the current procedure_id. Show existing hooks as badges with delete action.

- [ ] **Step 3: Test in browser**

```bash
pnpm --filter web dev
```

Navigate to `/dashboard/hms/governance/`, create a maintenance procedure, add checkpoints, link to Kitchen department at pre_open. Verify the session_hook row appears in the database.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/hms/governance/_components/SessionHookConfig.tsx apps/web/src/app/dashboard/hms/governance/_components/MaintenanceProcedureForm.tsx
git commit -m "feat(hms): add session hook config for linking checklists to departments"
```

---

### Task 7: Governance Page Integration

**Files:**
- Modify: `apps/web/src/app/dashboard/hms/governance/page.tsx`

- [ ] **Step 1: Read the current governance page**

Read `apps/web/src/app/dashboard/hms/governance/page.tsx` (currently 20 lines, renders GovernanceOverview).

- [ ] **Step 2: Add maintenance procedure section below GovernanceOverview**

```typescript
"use client";

import { GovernanceOverview } from "@/app/dashboard/governance/_components/GovernanceOverview";
import { useGovernanceOverview } from "@/app/dashboard/_hooks/use-governance-overview";
import { MaintenanceProcedureForm } from "./_components/MaintenanceProcedureForm";

export default function HmsGovernancePage() {
  const { data: protocols, isLoading } = useGovernanceOverview();

  if (isLoading) {
    return <div className="text-muted-foreground p-6 text-sm">Laster governance-data...</div>;
  }

  return (
    <div className="space-y-8">
      <GovernanceOverview protocols={protocols ?? []} />
      <MaintenanceProcedureForm />
    </div>
  );
}
```

- [ ] **Step 3: Test in browser**

Verify both sections render at `/dashboard/hms/governance/`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/hms/governance/page.tsx
git commit -m "feat(hms): integrate maintenance procedure form into governance page"
```

---

### Task 8: Mobile Checklist Data Hook

**Files:**
- Create: `apps/mobile/src/hooks/mutations/use-checklist.ts`

- [ ] **Step 1: Read existing mobile mutation hooks for patterns**

Read `apps/mobile/src/hooks/mutations/use-punch.ts` (first 50 lines) to see the mutation pattern (supabase client, auth, emit).

- [ ] **Step 2: Create checklist mutation hooks**

```typescript
/**
 * Hooks for cleaning checklist execution on mobile.
 * useCompleteCheckpoint marks a single step done.
 * useSignChecklist marks the full checklist as signed.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { emit } from "@smartout/telemetry";

export function useCompleteCheckpoint() {
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      taskId: string;
      evidence?: Record<string, unknown>;
    }) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("session_task")
        .update({
          status: "completed",
          completed_by: userId,
          completed_at: new Date().toISOString(),
          evidence: params.evidence ?? null,
        })
        .eq("id", params.taskId);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      emit({
        event: "checklist step_completed",
        properties: { task_id: vars.taskId },
      });
      qc.invalidateQueries({ queryKey: ["session-tasks"] });
    },
  });
}

export function useSignChecklist() {
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      taskIds: string[];
    }) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("session_task")
        .update({
          status: "completed",
          completed_by: userId,
          completed_at: now,
        })
        .in("id", params.taskIds)
        .eq("status", "pending");

      if (error) throw error;
    },
    onSuccess: () => {
      emit({
        event: "checklist completed",
        properties: {},
      });
      qc.invalidateQueries({ queryKey: ["session-tasks"] });
    },
  });
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter mobile typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/mutations/use-checklist.ts
git commit -m "feat(mobile): add checklist completion and signing hooks"
```

---

### Task 9: Mobile ChecklistView Component

**Files:**
- Create: `apps/mobile/src/components/task/ChecklistView.tsx`

- [ ] **Step 1: Read existing TaskModal for component patterns**

Read `apps/mobile/src/components/task/TaskModal.tsx` (first 80 lines) to understand the modal/view pattern, styling, and auth context.

- [ ] **Step 2: Create ChecklistView component**

This is the core employee-facing checklist UI. It should:
- Accept props: `tasks: SessionTask[]` (filtered maintenance tasks), `procedureName: string`, `onClose: () => void`
- Render a full-screen view with:
  - Header: procedure name + progress bar (X/Y completed)
  - Scrollable list of checkpoints as large checkboxes (48px touch target)
  - Each row: native `<input type="checkbox">` wrapped in `<label>`, title, optional description
  - Optional photo capture button per row (stores in evidence JSONB)
  - "Signer og fullfør" button at bottom (disabled until all required items checked)
- Use `useCompleteCheckpoint()` for individual items
- Use `useSignChecklist()` for final signing
- Emit `checklist started` on mount
- Use i18n keys from `cleaning.*` namespace
- Accessibility: native checkboxes, `aria-label` on photo button ("Ta bilde")

- [ ] **Step 3: Run on device/simulator**

```bash
pnpm --filter mobile start
```

Navigate to task feed, verify ChecklistView renders when maintenance tasks are present.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/task/ChecklistView.tsx
git commit -m "feat(mobile): add ChecklistView for cleaning checklist execution"
```

---

### Task 10: TaskFeed Checklist Grouping

**Files:**
- Modify: `apps/mobile/src/components/task/TaskFeed.tsx`

- [ ] **Step 1: Read TaskFeed to understand the current rendering logic**

Read `apps/mobile/src/components/task/TaskFeed.tsx` to see how tasks are sorted and rendered (compliance first, then deadline, then general).

- [ ] **Step 2: Group maintenance tasks into a single checklist card**

Add logic to detect tasks that share the same `session_hook_id` with a linked maintenance procedure. Group them into a single expandable card that opens `ChecklistView` instead of individual `TaskModal`.

The grouping logic:
1. Filter tasks with non-null `session_hook_id`
2. Group by `session_hook_id`
3. For each group, render a single "Renholdssjekk: [procedure name]" card with progress indicator
4. Tap opens `ChecklistView` with the grouped tasks
5. Non-grouped tasks render as before (individual TaskModal)

- [ ] **Step 3: Test on device**

Verify: seed data creates session_tasks for Kitchen cleaning. TaskFeed groups them into one checklist card. Tapping opens ChecklistView.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/task/TaskFeed.tsx
git commit -m "feat(mobile): group maintenance tasks into checklist card in TaskFeed"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Run full typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors across all packages.

- [ ] **Step 2: Verify end-to-end flow**

1. Start local Supabase: `npx supabase start`
2. Reset with seed: `npx supabase db reset`
3. Start web: `pnpm --filter web dev`
4. Navigate to `/dashboard/hms/governance/` — verify cleaning checklist section renders with seeded procedure
5. Verify 5 checkpoints visible
6. Verify session hook shows "Kitchen / pre_open"

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix(hms): address checklist integration issues"
```
