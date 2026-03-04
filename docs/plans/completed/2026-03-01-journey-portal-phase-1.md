# Journey Portal Phase 1 — Foundation & Tracking

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Journey Portal at `/platform-admin/journeys` — a working dashboard where all 68 journeys are visible, filterable, and can be moved through a 13-status lifecycle with validated transitions and event logging.

**Architecture:** Platform-admin page pattern — Server component fetches data via `createAdminClient()`, passes to Client components. 4 new database tables with RLS. Zod-validated types in `packages/types`. Status transition state machine in shared lib. TanStack Table for the journey list. Pipeline kanban header for at-a-glance progress.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 (CSS vars), shadcn/ui (new-york), Supabase PostgreSQL 17, TanStack Table, Zod, Lucide icons.

---

## Task 1: Database Migration — Enums + Tables

**Files:**

- Create: `supabase/migrations/20260301140000_journey_system.sql`

**Step 1: Write the migration SQL**

```sql
-- Journey system enums
CREATE TYPE journey_status AS ENUM (
  'idea', 'wizard', 'defined',
  'ready_impl', 'building', 'review',
  'ready_test', 'testing', 'ready_validation',
  'implemented', 'active', 'inactive', 'broken'
);

CREATE TYPE journey_actor AS ENUM (
  'employee', 'trainee', 'manager', 'admin', 'owner', 'all'
);

CREATE TYPE journey_platform AS ENUM ('mobile', 'desktop', 'both');

CREATE TYPE journey_priority AS ENUM ('P0', 'P1', 'P2', 'P3');

CREATE TYPE journey_module AS ENUM (
  'core', 'onboarding', 'org', 'scheduling', 'operations',
  'haccp', 'training', 'absence', 'payroll', 'communication',
  'reports', 'settings', 'ai', 'season', 'governance',
  'contracts', 'certifications', 'meta'
);

CREATE TYPE journey_event_type AS ENUM (
  'status_change', 'test_run', 'output_generated', 'edit', 'comment'
);

CREATE TYPE journey_test_result AS ENUM ('pass', 'fail', 'skip', 'running');

-- Main journey table
CREATE TABLE journey (
  journey_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  code text NOT NULL,                         -- "J-001"
  title text NOT NULL,                        -- "Sign Up & Create Workspace"
  slug text NOT NULL,                         -- "sign-up-create-workspace"
  module journey_module NOT NULL,
  actor journey_actor NOT NULL,
  platform journey_platform NOT NULL DEFAULT 'both',
  priority journey_priority NOT NULL DEFAULT 'P1',
  status journey_status NOT NULL DEFAULT 'idea',
  tags text[] NOT NULL DEFAULT '{}',
  trigger_description text,                   -- What initiates this journey
  preconditions text[] NOT NULL DEFAULT '{}',
  test_assertion text,                        -- One-line E2E assertion
  doc_title text,                             -- Norwegian doc title
  outcomes_success text,
  outcomes_empty text,
  outcomes_error text,
  related_journeys uuid[] NOT NULL DEFAULT '{}',
  blocked_by uuid[] NOT NULL DEFAULT '{}',
  assignee_id uuid REFERENCES user_identity(user_identity_id),
  linear_issue_id text,
  last_test_result journey_test_result,
  last_test_run_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES user_identity(user_identity_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, slug),
  UNIQUE(workspace_id, code)
);

-- Journey steps
CREATE TABLE journey_step (
  journey_step_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey(journey_id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  title text NOT NULL,
  action text NOT NULL,                       -- What the user does
  expects text,                               -- Expected system response
  screen text,                                -- Route: "/shifts/:id"
  component text,                             -- "ShiftDetailModal"
  data_reads text[] NOT NULL DEFAULT '{}',
  data_writes text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(journey_id, step_order)
);

-- Audit log for status changes and events
CREATE TABLE journey_event (
  journey_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey(journey_id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  event_type journey_event_type NOT NULL,
  from_status journey_status,
  to_status journey_status,
  actor_id uuid REFERENCES user_identity(user_identity_id),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Test run history
CREATE TABLE journey_test_run (
  journey_test_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey(journey_id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  result journey_test_result NOT NULL,
  duration_ms integer,
  error_message text,
  test_output jsonb,
  triggered_by uuid REFERENCES user_identity(user_identity_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_journey_workspace ON journey(workspace_id);
CREATE INDEX idx_journey_module ON journey(module);
CREATE INDEX idx_journey_status ON journey(status);
CREATE INDEX idx_journey_priority ON journey(priority);
CREATE INDEX idx_journey_step_journey ON journey_step(journey_id);
CREATE INDEX idx_journey_event_journey ON journey_event(journey_id);
CREATE INDEX idx_journey_event_created ON journey_event(created_at DESC);
CREATE INDEX idx_journey_test_run_journey ON journey_test_run(journey_id);

-- Updated_at triggers
CREATE TRIGGER set_journey_updated_at
  BEFORE UPDATE ON journey
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_journey_step_updated_at
  BEFORE UPDATE ON journey_step
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE journey ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_test_run ENABLE ROW LEVEL SECURITY;

-- Platform admin (godmode) full access
CREATE POLICY "godmode_journey_all" ON journey
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_identity WHERE user_identity_id = auth.uid() AND is_godmode = true)
  );

CREATE POLICY "godmode_journey_step_all" ON journey_step
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_identity WHERE user_identity_id = auth.uid() AND is_godmode = true)
  );

CREATE POLICY "godmode_journey_event_all" ON journey_event
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_identity WHERE user_identity_id = auth.uid() AND is_godmode = true)
  );

CREATE POLICY "godmode_journey_test_run_all" ON journey_test_run
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_identity WHERE user_identity_id = auth.uid() AND is_godmode = true)
  );

-- Workspace-scoped read access (admins can view)
CREATE POLICY "workspace_journey_read" ON journey
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "workspace_journey_step_read" ON journey_step
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "workspace_journey_event_read" ON journey_event
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "workspace_journey_test_run_read" ON journey_test_run
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
```

**Step 2: Apply the migration**

Run: `npx supabase db reset` (local dev — resets + runs all migrations)

Expected: Tables `journey`, `journey_step`, `journey_event`, `journey_test_run` created with RLS.

**Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

Expected: New tables and enums appear in `database.types.ts`.

**Step 4: Commit**

```bash
git add supabase/migrations/20260301140000_journey_system.sql packages/supabase/src/database.types.ts
git commit -m "feat(journey): add journey system tables, enums, RLS, and indexes"
```

---

## Task 2: TypeScript Types + Zod Schemas

**Files:**

- Create: `packages/types/src/journey.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `packages/types/src/enums.ts`

**Step 1: Write the Zod enums in `packages/types/src/enums.ts`**

Append to existing file:

```typescript
// Journey system enums
export const JourneyStatusEnum = z.enum([
  "idea",
  "wizard",
  "defined",
  "ready_impl",
  "building",
  "review",
  "ready_test",
  "testing",
  "ready_validation",
  "implemented",
  "active",
  "inactive",
  "broken",
]);
export type JourneyStatus = z.infer<typeof JourneyStatusEnum>;

export const JourneyActorEnum = z.enum(["employee", "trainee", "manager", "admin", "owner", "all"]);
export type JourneyActor = z.infer<typeof JourneyActorEnum>;

export const JourneyPlatformEnum = z.enum(["mobile", "desktop", "both"]);
export type JourneyPlatform = z.infer<typeof JourneyPlatformEnum>;

export const JourneyPriorityEnum = z.enum(["P0", "P1", "P2", "P3"]);
export type JourneyPriority = z.infer<typeof JourneyPriorityEnum>;

export const JourneyModuleEnum = z.enum([
  "core",
  "onboarding",
  "org",
  "scheduling",
  "operations",
  "haccp",
  "training",
  "absence",
  "payroll",
  "communication",
  "reports",
  "settings",
  "ai",
  "season",
  "governance",
  "contracts",
  "certifications",
  "meta",
]);
export type JourneyModule = z.infer<typeof JourneyModuleEnum>;

export const JourneyEventTypeEnum = z.enum([
  "status_change",
  "test_run",
  "output_generated",
  "edit",
  "comment",
]);
export type JourneyEventType = z.infer<typeof JourneyEventTypeEnum>;

export const JourneyTestResultEnum = z.enum(["pass", "fail", "skip", "running"]);
export type JourneyTestResult = z.infer<typeof JourneyTestResultEnum>;

export const JourneyPhaseEnum = z.enum(["definition", "planning", "build", "test", "release"]);
export type JourneyPhase = z.infer<typeof JourneyPhaseEnum>;
```

**Step 2: Write the journey types in `packages/types/src/journey.ts`**

```typescript
import { z } from "zod";
import {
  JourneyStatusEnum,
  JourneyActorEnum,
  JourneyPlatformEnum,
  JourneyPriorityEnum,
  JourneyModuleEnum,
  JourneyEventTypeEnum,
  JourneyTestResultEnum,
  JourneyPhaseEnum,
} from "./enums";

// ─── Journey ──────────────────────────────────────────────
export const JourneySchema = z.object({
  journey_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  code: z.string(),
  title: z.string(),
  slug: z.string(),
  module: JourneyModuleEnum,
  actor: JourneyActorEnum,
  platform: JourneyPlatformEnum,
  priority: JourneyPriorityEnum,
  status: JourneyStatusEnum,
  tags: z.array(z.string()),
  trigger_description: z.string().nullable(),
  preconditions: z.array(z.string()),
  test_assertion: z.string().nullable(),
  doc_title: z.string().nullable(),
  outcomes_success: z.string().nullable(),
  outcomes_empty: z.string().nullable(),
  outcomes_error: z.string().nullable(),
  related_journeys: z.array(z.string().uuid()),
  blocked_by: z.array(z.string().uuid()),
  assignee_id: z.string().uuid().nullable(),
  linear_issue_id: z.string().nullable(),
  last_test_result: JourneyTestResultEnum.nullable(),
  last_test_run_at: z.string().nullable(),
  version: z.number().int(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Journey = z.infer<typeof JourneySchema>;

// ─── Journey Step ──────────────────────────────────────────
export const JourneyStepSchema = z.object({
  journey_step_id: z.string().uuid(),
  journey_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  step_order: z.number().int(),
  title: z.string(),
  action: z.string(),
  expects: z.string().nullable(),
  screen: z.string().nullable(),
  component: z.string().nullable(),
  data_reads: z.array(z.string()),
  data_writes: z.array(z.string()),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type JourneyStep = z.infer<typeof JourneyStepSchema>;

// ─── Journey Event ─────────────────────────────────────────
export const JourneyEventSchema = z.object({
  journey_event_id: z.string().uuid(),
  journey_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  event_type: JourneyEventTypeEnum,
  from_status: JourneyStatusEnum.nullable(),
  to_status: JourneyStatusEnum.nullable(),
  actor_id: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()),
  created_at: z.string(),
});
export type JourneyEvent = z.infer<typeof JourneyEventSchema>;

// ─── Journey Test Run ──────────────────────────────────────
export const JourneyTestRunSchema = z.object({
  journey_test_run_id: z.string().uuid(),
  journey_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  result: JourneyTestResultEnum,
  duration_ms: z.number().int().nullable(),
  error_message: z.string().nullable(),
  test_output: z.record(z.unknown()).nullable(),
  triggered_by: z.string().uuid().nullable(),
  created_at: z.string(),
});
export type JourneyTestRun = z.infer<typeof JourneyTestRunSchema>;

// ─── Status Machine ────────────────────────────────────────
export type StatusTransition = {
  from: JourneyStatus;
  to: JourneyStatus[];
};

// ─── Module Metadata ───────────────────────────────────────
export type ModuleMeta = {
  code: JourneyModule;
  name: string;
  icon: string;
  color: string;
};

// ─── Pipeline Stats ────────────────────────────────────────
export type PipelineStats = Record<JourneyStatus, number>;

// ─── Journey with Steps (joined query) ─────────────────────
export type JourneyWithSteps = Journey & {
  steps: JourneyStep[];
};

// ─── Journey with Events (joined query) ────────────────────
export type JourneyWithEvents = Journey & {
  events: JourneyEvent[];
};
```

**Step 3: Export from `packages/types/src/index.ts`**

Add this line:

```typescript
export * from "./journey";
```

**Step 4: Run typecheck to verify**

Run: `pnpm typecheck`

Expected: PASS — no type errors.

**Step 5: Commit**

```bash
git add packages/types/src/enums.ts packages/types/src/journey.ts packages/types/src/index.ts
git commit -m "feat(types): add journey system Zod schemas and TypeScript types"
```

---

## Task 3: Status Transition Machine

**Files:**

- Create: `apps/web/src/lib/journey/status-transitions.ts`
- Create: `apps/web/src/lib/journey/module-meta.ts`

**Step 1: Write the status transition validator**

```typescript
import type { JourneyStatus, JourneyPhase } from "@smartout/types";

const TRANSITIONS: Record<JourneyStatus, JourneyStatus[]> = {
  idea: ["wizard"],
  wizard: ["defined", "idea"],
  defined: ["ready_impl", "idea"],
  ready_impl: ["building"],
  building: ["review", "ready_impl"],
  review: ["ready_test", "building"],
  ready_test: ["testing"],
  testing: ["ready_validation", "building"],
  ready_validation: ["implemented", "testing"],
  implemented: ["active", "inactive"],
  active: ["inactive", "broken"],
  inactive: ["active", "idea"],
  broken: ["testing"],
};

export function getValidTransitions(current: JourneyStatus): JourneyStatus[] {
  return TRANSITIONS[current] ?? [];
}

export function isValidTransition(from: JourneyStatus, to: JourneyStatus): boolean {
  return getValidTransitions(from).includes(to);
}

export function getPhase(status: JourneyStatus): JourneyPhase {
  switch (status) {
    case "idea":
    case "wizard":
    case "defined":
      return "definition";
    case "ready_impl":
      return "planning";
    case "building":
    case "review":
      return "build";
    case "ready_test":
    case "testing":
    case "ready_validation":
      return "test";
    case "implemented":
    case "active":
    case "inactive":
    case "broken":
      return "release";
  }
}

export const STATUS_META: Record<JourneyStatus, { label: string; icon: string; color: string }> = {
  idea: { label: "Idea", icon: "Lightbulb", color: "#e2e8f0" },
  wizard: { label: "Wizard", icon: "Wand2", color: "#c084fc" },
  defined: { label: "Defined", icon: "ClipboardList", color: "#6366f1" },
  ready_impl: { label: "Ready for Impl", icon: "FileText", color: "#2563eb" },
  building: { label: "Building", icon: "Hammer", color: "#f59e0b" },
  review: { label: "In Review", icon: "Eye", color: "#a855f7" },
  ready_test: { label: "Ready for Test", icon: "TestTube2", color: "#7c3aed" },
  testing: { label: "Testing", icon: "FlaskConical", color: "#8b5cf6" },
  ready_validation: { label: "Ready for Validation", icon: "CheckCircle2", color: "#059669" },
  implemented: { label: "Implemented", icon: "Rocket", color: "#0d9488" },
  active: { label: "Active", icon: "CircleDot", color: "#10b981" },
  inactive: { label: "Inactive", icon: "CircleMinus", color: "#6b7280" },
  broken: { label: "Broken", icon: "AlertTriangle", color: "#ef4444" },
};
```

**Step 2: Write the module metadata**

```typescript
import type { JourneyModule, ModuleMeta } from "@smartout/types";

export const MODULE_META: Record<JourneyModule, Omit<ModuleMeta, "code">> = {
  core: { name: "Core", icon: "Key", color: "#6366f1" },
  onboarding: { name: "Onboarding", icon: "Rocket", color: "#14b8a6" },
  org: { name: "Org Structure", icon: "Building2", color: "#06b6d4" },
  scheduling: { name: "Scheduling", icon: "Calendar", color: "#0ea5e9" },
  operations: { name: "Operations", icon: "Zap", color: "#f59e0b" },
  haccp: { name: "HACCP", icon: "Thermometer", color: "#ef4444" },
  training: { name: "Training", icon: "GraduationCap", color: "#8b5cf6" },
  absence: { name: "Absence", icon: "Palmtree", color: "#a855f7" },
  payroll: { name: "Payroll", icon: "Banknote", color: "#f97316" },
  communication: { name: "Communication", icon: "MessageSquare", color: "#10b981" },
  reports: { name: "Reports", icon: "BarChart3", color: "#6366f1" },
  settings: { name: "Settings", icon: "Settings", color: "#64748b" },
  ai: { name: "AI (Botsson)", icon: "Bot", color: "#ec4899" },
  season: { name: "Season", icon: "Trophy", color: "#eab308" },
  governance: { name: "Governance", icon: "ScrollText", color: "#78716c" },
  contracts: { name: "Contracts", icon: "FileSignature", color: "#92400e" },
  certifications: { name: "Certifications", icon: "Award", color: "#0d9488" },
  meta: { name: "Journey Portal", icon: "Target", color: "#1e293b" },
};

export const PRIORITY_META = {
  P0: { label: "P0 Critical", color: "#ef4444", bg: "bg-red-50 dark:bg-red-950/20" },
  P1: { label: "P1 Important", color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/20" },
  P2: { label: "P2 Nice to have", color: "#6b7280", bg: "bg-gray-50 dark:bg-gray-950/20" },
  P3: { label: "P3 Future", color: "#cbd5e1", bg: "bg-slate-50 dark:bg-slate-950/20" },
} as const;

export const ACTOR_META = {
  employee: { label: "Ansatt", color: "#3b82f6" },
  trainee: { label: "Trainee", color: "#14b8a6" },
  manager: { label: "Leder", color: "#f59e0b" },
  admin: { label: "Admin", color: "#f97316" },
  owner: { label: "Eier", color: "#8b5cf6" },
  all: { label: "Alle", color: "#6b7280" },
} as const;

export const PLATFORM_META = {
  mobile: { label: "Mobile", icon: "Smartphone" },
  desktop: { label: "Desktop", icon: "Monitor" },
  both: { label: "Both", icon: "Laptop" },
} as const;
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/journey/
git commit -m "feat(journey): add status transition machine and module metadata"
```

---

## Task 4: Seed Data — All 68 Journeys

**Files:**

- Create: `supabase/migrations/20260301150000_journey_seed_data.sql`

**Step 1: Write the seed migration**

This migration inserts all 68 journeys from the JOURNEY_REGISTRY.md into the database. Uses the first workspace from `seed.sql` (UUID `b0000000-0000-0000-0000-000000000001`).

The seed SQL should insert:

- All 68 journeys with code (J-001 through J-068), title, slug, module, actor, platform, priority, tags, trigger_description, test_assertion, doc_title
- Steps for each journey (from the registry)
- Initial status: `idea` for all journeys (to be updated manually via portal)

**IMPORTANT:** This is a large migration. The agent implementing this task should:

1. Read `docs/modules/journey/SMARTOUT_JOURNEY_REGISTRY.md` (Part II, starting at line ~473) for all 68 journey definitions
2. Generate INSERT statements for each journey with correct field mapping
3. Generate INSERT statements for steps per journey
4. Use the seed workspace ID from `supabase/seed.sql`

The seed data format per journey:

```sql
-- Example: J-001
INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'J-001', 'Sign Up & Create Workspace', 'sign-up-create-workspace',
  'core', 'owner', 'desktop', 'P0', 'idea',
  ARRAY['write', 'ai-assisted', 'stripe'],
  'Landing page → "Start gratis prøveperiode"',
  'signup → workspace exists → setup wizard completes → can invite',
  'Dine første 10 minutter med Smartout'
);

-- Steps for J-001
INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-001' AND workspace_id = 'b0000000-0000-0000-0000-000000000001'),
   'b0000000-0000-0000-0000-000000000001', 1,
   'Create Account', 'Enter email/password or SSO → Create account'),
  -- ... remaining steps
;
```

**Step 2: Apply migration**

Run: `npx supabase db reset`

Expected: 68 journeys + steps seeded in local database.

**Step 3: Verify seed**

Run (via Supabase Studio or psql):

```sql
SELECT module, count(*) FROM journey GROUP BY module ORDER BY module;
```

Expected: 18 modules with correct counts totaling 68.

**Step 4: Commit**

```bash
git add supabase/migrations/20260301150000_journey_seed_data.sql
git commit -m "feat(journey): seed all 68 journeys from registry"
```

---

## Task 5: Sidebar Nav Entry

**Files:**

- Modify: `apps/web/src/components/platform-admin/sidebar-nav.tsx`

**Step 1: Add the journey nav item**

Add `Map` import from lucide-react and add nav item after "Health":

```typescript
// Add to imports:
import { ..., Map } from "lucide-react";

// Add to navItems array (after health entry):
{ href: "/platform-admin/journeys", label: "Journeys", icon: Map },
```

**Step 2: Verify visually**

Run: `pnpm --filter web dev`

Navigate to `/platform-admin` — "Journeys" link should appear in sidebar.

**Step 3: Commit**

```bash
git add apps/web/src/components/platform-admin/sidebar-nav.tsx
git commit -m "feat(journey): add Journeys to platform-admin sidebar"
```

---

## Task 6: Journey List Page — Server Component

**Files:**

- Create: `apps/web/src/app/platform-admin/journeys/page.tsx`
- Create: `apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx`

**Step 1: Write the server page**

```typescript
// apps/web/src/app/platform-admin/journeys/page.tsx
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { JourneyListClient } from "./_components/journey-list-client";

export default async function JourneysPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: journeys } = await admin
    .from("journey")
    .select("*")
    .order("code", { ascending: true });

  return <JourneyListClient journeys={journeys ?? []} />;
}
```

**Step 2: Write the client component shell**

Create `journey-list-client.tsx` with:

- Pipeline header (13 status columns with count badges)
- Filter bar (module, status, actor, priority, search)
- TanStack Table with sortable columns: Code, Title, Module, Actor, Platform, Priority, Status
- Row click → navigate to detail page

The client component should:

- Accept `journeys` prop (array from server)
- Use `useState` for filter state
- Use `useMemo` for filtered journeys
- Use `@tanstack/react-table` for the table (following the pattern in `apps/web/src/components/platform-admin/data-table.tsx`)
- Render Pipeline header above the table
- Render status badges with colors from `STATUS_META`
- Render module badges with colors from `MODULE_META`

**Key UI elements:**

Pipeline header:

```
[Idea: 40] [Wizard: 0] [Defined: 8] [Ready: 5] [Building: 3] [Review: 2] [Ready Test: 1] ...
```

Filter bar:

```
[Module ▾] [Status ▾] [Actor ▾] [Priority ▾] [🔍 Search...]
```

Table columns:

```
Code | Title | Module | Actor | Platform | Priority | Status | Actions
```

**Step 3: Run and verify**

Run: `pnpm --filter web dev`

Navigate to `/platform-admin/journeys` — should see all 68 journeys in a table with pipeline header and working filters.

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/
git commit -m "feat(journey): add journey list page with pipeline, filters, and table"
```

---

## Task 7: Status Change with Validation

**Files:**

- Create: `apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx`
- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx`

**Step 1: Write the status changer component**

```typescript
// journey-status-changer.tsx
"use client";

import { useState } from "react";
import { createBrowserClient } from "@smartout/supabase/client";
import { getValidTransitions, STATUS_META } from "@/lib/journey/status-transitions";
import type { JourneyStatus } from "@smartout/types";

type Props = {
  journeyId: string;
  currentStatus: JourneyStatus;
  onStatusChanged: (newStatus: JourneyStatus) => void;
};
```

Component should:

- Show current status as a badge
- On click, show dropdown with only valid transitions (from `getValidTransitions`)
- On select, call Supabase to update journey status AND insert journey_event
- Use `sonner` toast for success/error feedback
- Call `onStatusChanged` callback to update parent state

Supabase operations on status change:

```typescript
// 1. Update journey status
await supabase.from("journey").update({ status: newStatus }).eq("journey_id", journeyId);

// 2. Log event
await supabase.from("journey_event").insert({
  journey_id: journeyId,
  workspace_id: workspaceId,
  event_type: "status_change",
  from_status: currentStatus,
  to_status: newStatus,
  actor_id: userId,
});
```

**Step 2: Integrate into the table**

Add the status changer to the Status column in the journey table. When status changes, update the local state to reflect the change without a full page reload.

**Step 3: Verify**

1. Navigate to `/platform-admin/journeys`
2. Click a journey's status badge
3. See only valid transitions in dropdown
4. Select new status → journey updates, event logged
5. Pipeline header counts update

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/_components/
git commit -m "feat(journey): add validated status transitions with event logging"
```

---

## Task 8: Journey Detail Page

**Files:**

- Create: `apps/web/src/app/platform-admin/journeys/[id]/page.tsx`
- Create: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

**Step 1: Write the server page**

```typescript
// apps/web/src/app/platform-admin/journeys/[id]/page.tsx
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { JourneyDetailClient } from "./_components/journey-detail-client";

type Props = { params: Promise<{ id: string }> };

export default async function JourneyDetailPage({ params }: Props) {
  const { id } = await params;
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  const [{ data: journey }, { data: steps }, { data: events }] = await Promise.all([
    admin.from("journey").select("*").eq("journey_id", id).single(),
    admin.from("journey_step").select("*").eq("journey_id", id).order("step_order"),
    admin.from("journey_event").select("*").eq("journey_id", id).order("created_at", { ascending: false }).limit(50),
  ]);

  if (!journey) notFound();

  return (
    <JourneyDetailClient
      journey={journey}
      steps={steps ?? []}
      events={events ?? []}
    />
  );
}
```

**Step 2: Write the detail client component**

Layout sections:

1. **Header** — Code, Title, Status badge (with changer), Module badge, Actor badge, Priority badge, Platform badge
2. **Classification** — Tags, trigger, preconditions
3. **Steps** — Visual step flow (numbered, with action and expects for each)
4. **Event Log** — Timeline of status changes with timestamps and actor
5. **Relations** — Related journeys, blocked by (placeholder — links when data exists)
6. **Output Tabs** (placeholder for Phase 2):
   - Journey (steps — active in Phase 1)
   - E2E Test (placeholder)
   - Doc (placeholder)
   - Linear (placeholder)
   - Botsson (placeholder)

Back button: Link to `/platform-admin/journeys`

**Step 3: Verify**

1. Navigate to `/platform-admin/journeys`
2. Click a journey row → navigates to `/platform-admin/journeys/{id}`
3. See full detail: classification, steps, event log
4. Change status from detail page → event appears in log

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/[id]/
git commit -m "feat(journey): add journey detail page with steps and event timeline"
```

---

## Task 9: ADR + Documentation

**Files:**

- Create: `docs/decisions/0031-journey-portal-system.md`
- Modify: `docs/decisions/0000-decision-log.md`
- Modify: `docs/INDEX.md`

**Step 1: Write the ADR**

Use template from `docs/templates/decision.md`. Key content:

- **Context:** Smartout needs a tracking system for its 68 user journeys during migration from Bubble.io. The Journey Portal is the meta-layer that drives the build.
- **Decision:** Build journey system as platform-admin feature with 4 database tables, 13-status lifecycle, and workspace-scoped RLS. Phase 1 = foundation (tables + portal + tracking). Phase 2 = AI wizard. Phase 3 = automation.
- **Consequences:** New enums (7), new tables (4), new admin page section. All journeys seeded from JOURNEY_REGISTRY.md. Status transitions are validated server-side.

**Step 2: Register in decision log**

Add to `0000-decision-log.md`:

```
| ADR-0031 | 01-03-2026 | [Journey Portal System](./0031-journey-portal-system.md) | **Accepted** |
```

**Step 3: Update INDEX.md**

Add journey module entry to the Modules table.

**Step 4: Commit**

```bash
git add docs/decisions/ docs/INDEX.md
git commit -m "docs: add ADR-0031 journey portal system"
```

---

## Task 10: Final Verification

**Step 1: Run full checks**

```bash
pnpm typecheck
pnpm lint
```

Expected: Both pass.

**Step 2: Manual smoke test**

1. `npx supabase db reset` — clean database with seed data
2. `pnpm --filter web dev` — start dashboard
3. Navigate to `/platform-admin/journeys`:
   - 68 journeys visible in table
   - Pipeline header shows counts per status
   - Filters work (module, status, actor, priority, search)
   - Click status → dropdown with valid transitions only
   - Change status → event logged, pipeline updates
4. Click journey row → detail page:
   - Header shows classification
   - Steps displayed in order
   - Event log shows status change history
   - Back button returns to list

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(journey): address Phase 1 verification issues"
```

---

## Summary

| Task | What                                           | Files         | Estimated Complexity |
| :--: | ---------------------------------------------- | ------------- | :------------------: |
|  1   | Database migration (4 tables, 7 enums, RLS)    | 1 migration   |        Medium        |
|  2   | TypeScript types + Zod schemas                 | 3 files       |        Small         |
|  3   | Status transition machine + module metadata    | 2 files       |        Small         |
|  4   | Seed all 68 journeys                           | 1 migration   | Large (data volume)  |
|  5   | Sidebar nav entry                              | 1 file modify |       Trivial        |
|  6   | Journey list page (pipeline + filters + table) | 2 files       |   Large (main UI)    |
|  7   | Status changer with validation                 | 2 files       |        Medium        |
|  8   | Journey detail page (steps + events)           | 2 files       |        Large         |
|  9   | ADR + documentation                            | 3 files       |        Small         |
|  10  | Verification                                   | 0 files       |        Small         |

**Total files:** ~14 new + ~4 modified

**Dependencies:**

- Task 1 (migration) blocks Tasks 2, 4, 6-8
- Task 2 (types) blocks Tasks 3, 6-8
- Task 3 (transitions) blocks Task 7
- Tasks 1-5 can be parallelized with Task 2-3 in some agent teams
- Tasks 6-8 are the main UI work and depend on 1-5

**Agent Team Strategy:**

- **Agent A (DB + Types):** Tasks 1, 2, 4 — database migration, types, seed data
- **Agent B (Lib + Nav):** Tasks 3, 5 — status machine, module meta, sidebar
- **Agent C (UI):** Tasks 6, 7, 8 — list page, status changer, detail page (after A+B done)
- **Lead:** Task 9, 10 — ADR, verification, review
