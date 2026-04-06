# Setup Guide Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cascade-task-driven setup redirect with an explicit `setup_guide_completed` flag so the dashboard setup guide only redirects on page load when the flag is false, and can be dismissed per session.

**Architecture:** Add a boolean column to `workspace`, wire it into the existing workspace data pipeline (`WORKSPACE_SELECT` → `WorkspaceData` → `DashboardShell`), replace the `useCascadeTasks`-driven redirect with a flag-driven one, and set the flag true on wizard completion.

**Tech Stack:** PostgreSQL migration, TypeScript, Next.js App Router, Supabase client, TanStack Query

**Spec:** `docs/superpowers/specs/2026-03-27-setup-guide-navigation-design.md`

---

### Task 1: Add `setup_guide_completed` column to workspace table

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_setup_guide_completed.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add explicit flag for dashboard setup guide completion.
-- Separate from onboarding_completed (which controls /onboarding → /dashboard).
-- When false + not dismissed in sessionStorage → redirect to /dashboard/setup on page load.
ALTER TABLE public.workspace
  ADD COLUMN IF NOT EXISTS setup_guide_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workspace.setup_guide_completed IS
  'Whether the post-bootstrap setup guide has been completed. Separate from onboarding_completed.';
```

- [ ] **Step 2: Run migration**

Run:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/YYYYMMDDHHMMSS_add_setup_guide_completed.sql
```

Expected: `ALTER TABLE`

- [ ] **Step 3: Regenerate types**

Run:

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

Expected: `database.types.ts` updated, `workspace` type now includes `setup_guide_completed: boolean`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/YYYYMMDDHHMMSS_add_setup_guide_completed.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add workspace.setup_guide_completed column"
```

---

### Task 2: Wire `setup_guide_completed` through the workspace data pipeline

**Files:**

- Modify: `apps/web/src/app/dashboard/_data/queries.ts:10` (WORKSPACE_SELECT)
- Modify: `apps/web/src/lib/workspace-context.tsx:5-17` (WorkspaceData type)
- Modify: `apps/web/src/app/dashboard/layout.tsx:25` (default workspace data)

- [ ] **Step 1: Add to WORKSPACE_SELECT**

In `apps/web/src/app/dashboard/_data/queries.ts` line 10, add `setup_guide_completed` to the select string:

```typescript
const WORKSPACE_SELECT =
  "workspace_id, company_id, name, slug, logo_url, currency, language, country, timezone, contract_status, onboarding_completed, setup_guide_completed" as const;
```

- [ ] **Step 2: Add to WorkspaceData type**

In `apps/web/src/lib/workspace-context.tsx`, add to the `WorkspaceData` type:

```typescript
export type WorkspaceData = {
  workspace_id: string;
  company_id: string | null;
  name: string;
  slug: string;
  logo_url: string | null;
  currency: string;
  language: string;
  country: string;
  timezone: string;
  contract_status: string | null;
  onboarding_completed: boolean;
  setup_guide_completed: boolean;
};
```

- [ ] **Step 3: Add defaults in layout.tsx**

In `apps/web/src/app/dashboard/layout.tsx`:

- `SHOWCASE_WORKSPACE` constant (line ~14): add `setup_guide_completed: true` (demo workspace should not redirect to setup)
- Any other default workspace construction: add `setup_guide_completed: false`

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter web typecheck 2>&1 | tail -20
```

Expected: 0 errors (or only pre-existing ones unrelated to this change).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/_data/queries.ts apps/web/src/lib/workspace-context.tsx apps/web/src/app/dashboard/layout.tsx
git commit -m "feat(dashboard): wire setup_guide_completed through workspace data pipeline"
```

---

### Task 3: Replace redirect logic in DashboardShell

**Files:**

- Modify: `apps/web/src/components/dashboard/DashboardShell.tsx`

This task replaces the `useCascadeTasks`-driven `isSetupMode` redirect with a `setup_guide_completed`-driven redirect that only fires on page load.

- [ ] **Step 1: Replace setup state derivation**

In DashboardShell.tsx, find the current setup state block (around line 373-382):

```typescript
// CURRENT CODE — replace this:
const [setupDismissed, setSetupDismissed] = useState(() => {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("setup_dismissed") === "1";
});
const { data: cascadeData, isLoading: isSetupLoading } = useCascadeTasks();
const isSetupMode = !isSetupLoading && !setupDismissed && (cascadeData?.critical_count ?? 0) > 0;
const dismissSetup = useCallback(() => {
  setSetupDismissed(true);
  sessionStorage.setItem("setup_dismissed", "1");
}, []);
```

Replace with:

```typescript
const setupGuideCompleted = workspaceCtx?.workspace.setup_guide_completed ?? true;
const [setupDismissed, setSetupDismissed] = useState(() => {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("setup_dismissed") === "1";
});
const isSetupMode = !setupGuideCompleted && !setupDismissed;
const dismissSetup = useCallback(() => {
  setSetupDismissed(true);
  sessionStorage.setItem("setup_dismissed", "1");
}, []);
```

**Cleanup checklist:**

- Remove `useCascadeTasks()` call from DashboardShell if it was only used for `isSetupMode`. TodoTaskView has its own hook call.
- Audit `isSetupLoading` consumers in DashboardContext. If nothing external reads it, remove it entirely from the context type and value. If something does, keep it as `false` with a comment.
- `useOnboardingGuide` hook continues to derive from cascade tasks for in-wizard step tracking. It is no longer involved in routing — document this in a code comment.

- [ ] **Step 2: Add redirect useEffect**

Find the current comment block (around line 961) that replaced the old redirect and add:

```typescript
const isSetupPage = pathname === "/dashboard/setup";

// Redirect to setup guide on page load when setup is incomplete.
// Only fires once (not on in-app navigation) because it checks the
// ref to avoid re-triggering after the initial mount.
const setupRedirectFired = useRef(false);
useEffect(() => {
  if (setupRedirectFired.current) return;
  if (isSetupPage || setupGuideCompleted || setupDismissed) return;
  setupRedirectFired.current = true;
  window.location.href = "/dashboard/setup";
}, [isSetupPage, setupGuideCompleted, setupDismissed]);
```

- [ ] **Step 3: Keep full-screen setup render for /dashboard/setup**

Verify the `isSetupPage` full-screen render block is still present (it should be from our earlier edit):

```typescript
if (isSetupPage) {
  return (
    <DashboardContext.Provider value={dashboardContextValue}>
      <div
        className={`flex h-screen flex-col overflow-hidden font-sans transition-colors duration-300 selection:bg-orange-500/30 ${
          isDark ? "dark" : ""
        } bg-background text-foreground`}
      >
        {children}
      </div>
    </DashboardContext.Provider>
  );
}
```

- [ ] **Step 4: Build and verify**

Run:

```bash
pnpm --filter web build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardShell.tsx
git commit -m "feat(dashboard): replace cascade-driven setup redirect with flag-driven redirect"
```

---

### Task 4: Set flag on wizard completion

**Files:**

- Modify: `apps/web/src/app/dashboard/setup/page.tsx`

- [ ] **Step 1: Update onComplete to set the flag**

Replace the current `DashboardSetupPage`:

```typescript
"use client";

import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";
import { WorkspaceSetupWizard } from "@/components/dashboard/WorkspaceSetupWizard";

export default function DashboardSetupPage() {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  const handleComplete = async () => {
    await supabase
      .from("workspace")
      .update({ setup_guide_completed: true })
      .eq("workspace_id", workspace.workspace_id);

    void emit({
      event: "setup_guide completed",
      workspace_id: workspace.workspace_id,
      actor_id: "",
      properties: {},
    });

    // Clear session dismiss since setup is now permanently done
    sessionStorage.removeItem("setup_dismissed");

    // Hard navigation forces server layout to re-fetch workspace data
    // (workspace context is server-set, not client-queryable)
    window.location.href = "/dashboard";
  };

  return <WorkspaceSetupWizard onComplete={() => void handleComplete()} force />;
}
```

- [ ] **Step 2: Register telemetry event**

Add `"setup_guide completed"` to `packages/telemetry/src/registry.ts` with destinations: `[posthog, logger, activity_trail]`.

- [ ] **Step 3: Build and verify**

Run:

```bash
pnpm --filter web build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/setup/page.tsx packages/telemetry/src/registry.ts
git commit -m "feat(dashboard): set setup_guide_completed on wizard completion"
```

---

### Task 5: Set flag for existing seed workspace

**Files:**

- Modify: `supabase/seed.sql` (if it creates the test workspace)
  OR create a small fixup migration

The seed workspace (`b0000000-...`) should have `setup_guide_completed = true` so developers aren't trapped in setup mode during local development.

- [ ] **Step 1: Check seed.sql for the workspace insert**

Find the workspace insert in `supabase/seed.sql` and add `setup_guide_completed = true`.

If seed.sql doesn't insert the workspace directly (it may be created by a migration or function), run a fixup:

```sql
UPDATE public.workspace
SET setup_guide_completed = true
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
```

- [ ] **Step 2: Apply locally**

Run:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "UPDATE public.workspace SET setup_guide_completed = true WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';"
```

Expected: `UPDATE 1`

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql  # or the fixup migration
git commit -m "fix(seed): set setup_guide_completed for dev workspace"
```

---

### Task 6: Update e2e tests

**Files:**

- Modify: `apps/e2e/tests/signup-flow.spec.ts` (line 78 area)
- Modify: `apps/e2e/tests/workspace-setup-flow.spec.ts` (line 158 area)

These two tests explicitly expect the old cascade-driven setup redirect behavior. Update them to match the new flag-driven behavior.

- [ ] **Step 1: Read both test files**

Read the full test context around the failing assertions to understand what they expect.

- [ ] **Step 2: Update signup-flow.spec.ts**

The test "dashboard shows setup wizard instead of StrategicView" expects the dashboard to show the wizard fullscreen. Update it to expect the normal dashboard (tactical view) when `setup_guide_completed = true` (which is set for the test workspace), OR if the test creates a fresh workspace with `setup_guide_completed = false`, verify it redirects to `/dashboard/setup`.

- [ ] **Step 3: Update workspace-setup-flow.spec.ts**

The test "shows wizard for workspace needing setup" needs to verify that a workspace with `setup_guide_completed = false` gets redirected to `/dashboard/setup` on page load. Ensure the test workspace has this flag set to false.

- [ ] **Step 4: Run affected e2e tests**

Run:

```bash
cd apps/e2e && pnpm test:e2e -- --grep "setup wizard|setup flow" 2>&1 | tail -30
```

Expected: Tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/tests/signup-flow.spec.ts apps/e2e/tests/workspace-setup-flow.spec.ts
git commit -m "test(e2e): update setup tests for flag-driven redirect"
```

---

### Task 7: Update architecture doc

**Files:**

- Modify: `docs/specs/SETUP_WIZARD_ARCHITECTURE.md`

- [ ] **Step 1: Update section 5 (Dashboard Setup Guide)**

Add `setup_guide_completed` to the trigger description and canonical meanings table:

In section 5 "Trigger", replace the current content with:

```markdown
### Trigger

The guide routes from an explicit database flag:

- `workspace.setup_guide_completed = false` → redirect to `/dashboard/setup` on page load
- Dismiss via sessionStorage allows free navigation for the session
- Manual access to `/dashboard/setup` is always available regardless of flag

The guide does NOT route from `workspace.onboarding_completed` or cascade task counts.
```

In section 6 "Canonical Meanings", add:

```markdown
| `workspace.setup_guide_completed` | Dashboard setup-guide completion flag (explicit, never auto-reverted) |
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/SETUP_WIZARD_ARCHITECTURE.md
git commit -m "docs: update setup architecture with setup_guide_completed flag"
```
