---
title: "Module 6 Training — Sub-project 0: Schema + Data Foundation"
status: draft
updated: 2026-04-14
created: 2026-04-14
module: training
tags: [training, module-6, schema, migration, foundation, council-approved]
---

# Module 6 Training — Sub-project 0: Schema + Data Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the complete database foundation and shared data layer for Module 6 Training, unblocking all subsequent sub-projects (A: Admin CRUD, B: Mobile UI, C: Readiness Dashboard).

**Architecture:** Migration-first approach. Extend `protocol_assignment` with workspace scoping, enriched assignment tracking, and AI-readiness columns. Extract shared training hooks from `apps/web/` to `packages/`. Create a training capability stub in `packages/ai/` so the agent can answer training questions. Mobile hook parity deferred to Sub-project B.

**Tech Stack:** PostgreSQL migrations, TypeScript, TanStack Query, Zod, Supabase RLS, `packages/ai` capability pattern

**Council approved:** 2026-04-14, APPROVE WITH CHANGES. See `docs/council/COUNCIL-LOG.md`.

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/YYYYMMDDHHMMSS_training_add_enum_values.sql` | Separate migration: ADD VALUE to protocol_assignment_status enum (must run outside transaction) |
| `supabase/migrations/YYYYMMDDHHMMSS_training_schema_foundation.sql` | Schema migration: extend `protocol_assignment`, add columns, backfill, rewrite RLS, update trigger + RPC |
| `packages/training/src/index.ts` | Package entry — re-exports hooks and types |
| `packages/training/src/hooks/use-assigned-protocols.ts` | Shared hook: fetch assigned protocols with completion data (moved from web) |
| `packages/training/src/hooks/use-step-completion.ts` | Shared mutations: complete step, submit test, sign confirmation (moved from web) |
| `packages/training/src/hooks/use-readiness-score.ts` | Shared hook: readiness calculation (moved from web) |
| `packages/training/src/hooks/keys.ts` | TanStack Query key factory |
| `packages/training/src/types.ts` | Shared training types (AssignedProtocol, etc.) |
| `packages/training/package.json` | Package config |
| `packages/training/tsconfig.json` | TypeScript config |
| `packages/ai/src/capabilities/training/index.ts` | Training capability definition |
| `packages/ai/src/capabilities/training/tools.ts` | 3 read-only tools: get_my_training_status, get_next_protocol, get_team_readiness |

### Modified files
| File | Change |
|------|--------|
| `apps/web/src/app/dashboard/my-training/_hooks/use-assigned-protocols.ts` | Replace with re-export from `@smartout/training` |
| `apps/web/src/app/dashboard/my-training/_hooks/use-step-completion.ts` | Replace with re-export from `@smartout/training` |
| `apps/web/src/app/dashboard/hms/_hooks/use-readiness-score.ts` | Replace with re-export from `@smartout/training` |
| `apps/web/src/app/dashboard/my-training/_components/ProtocolList.tsx` | Update import paths |
| `apps/web/src/app/dashboard/my-training/_components/ProcedureStepper.tsx` | Update import paths |
| `apps/web/src/app/dashboard/my-training/_components/KnowledgeTestView.tsx` | Update import paths |
| `apps/web/src/app/dashboard/my-training/_components/ConfirmationSign.tsx` | Update import paths |
| `apps/web/src/app/dashboard/hms/_components/CompetenceMatrix.tsx` | Update to use `workspace_id` direct filter |
| `apps/web/src/app/dashboard/hms/_components/OversiktEmployee.tsx` | Verify imports resolve through re-exports |
| `packages/ai/src/capabilities/registry.ts` | Register training capability |
| `packages/ai/src/capabilities/types.ts` | No change needed — `"training"` already in `CapabilityName` |
| `packages/supabase/src/database.types.ts` | Regenerated after migration |
| `pnpm-workspace.yaml` | Add `packages/training` |

---

## Task 1: Database Migration — Extend protocol_assignment

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_training_add_enum_values.sql` (runs first, separate transaction)
- Create: `supabase/migrations/YYYYMMDDHHMMSS_training_schema_foundation.sql` (runs second)

Timestamps must be generated at execution time. The enum file must have an EARLIER timestamp.

**CRITICAL:** PostgreSQL `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block. Supabase runs each migration file as a single transaction. Therefore enum extensions MUST be in a separate file.

- [ ] **Step 1a: Write the enum migration (separate file, runs first)**

```sql
-- Must be a separate migration because ALTER TYPE ADD VALUE
-- cannot run inside a transaction block.
ALTER TYPE protocol_assignment_status ADD VALUE IF NOT EXISTS 'not_started';
ALTER TYPE protocol_assignment_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE protocol_assignment_status ADD VALUE IF NOT EXISTS 'waived';
```

- [ ] **Step 1b: Write the main migration SQL**

```sql
SET search_path TO public, extensions;

-- ============================================
-- Training Schema Foundation (Module 6, Sub-project 0)
-- Council-approved 2026-04-14, plan-reviewed 2026-04-14
--
-- Depends on: _training_add_enum_values migration (must run first)
-- ============================================

-- ── 1. New enum: assignment source ──────────────────────────────
CREATE TYPE assignment_source AS ENUM (
  'workspace', 'department', 'team', 'location', 'position', 'manual', 'season'
);

-- ── 2. Add columns to protocol_assignment ───────────────────────
-- workspace_id (backfilled from profile)
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Assignment source tracking
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS assigned_via assignment_source,
  ADD COLUMN IF NOT EXISTS assigned_ref_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES profile(profile_id);

-- Denormalized progress counts (maintained by trigger or app code)
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS procedures_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS procedures_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tests_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tests_passed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmations_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmations_signed INTEGER NOT NULL DEFAULT 0;

-- Waiver fields
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS waived_by UUID REFERENCES profile(profile_id),
  ADD COLUMN IF NOT EXISTS waived_reason TEXT;

-- Versioning
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS protocol_version TEXT;

-- AI: spaced repetition
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;

-- ── 4. Backfill workspace_id from profile ───────────────────────
UPDATE protocol_assignment pa
SET workspace_id = p.workspace_id
FROM profile p
WHERE pa.profile_id = p.profile_id
  AND pa.workspace_id IS NULL;

-- Now make it NOT NULL with FK
ALTER TABLE protocol_assignment
  ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE protocol_assignment
  ADD CONSTRAINT fk_protocol_assignment_workspace
    FOREIGN KEY (workspace_id)
    REFERENCES workspace(workspace_id) ON DELETE CASCADE;

-- ── 5. Backfill assigned_via from existing trigger logic ────────
-- Existing assignments were auto-created → mark as policy-scope derived
-- We can't determine exact source retroactively, so mark as 'workspace' (safe default)
UPDATE protocol_assignment
SET assigned_via = 'workspace'
WHERE assigned_via IS NULL;

-- Backfill protocol_version from protocol.version
UPDATE protocol_assignment pa
SET protocol_version = pr.version
FROM protocol pr
WHERE pa.protocol_id = pr.protocol_id
  AND pa.protocol_version IS NULL;

-- ── 6. Map 'pending' → 'not_started' for existing data ─────────
-- Safe: enum values were added in the PREVIOUS migration file.
UPDATE protocol_assignment
SET status = 'not_started'
WHERE status = 'pending';

-- Update column default from 'pending' to 'not_started'
ALTER TABLE protocol_assignment
  ALTER COLUMN status SET DEFAULT 'not_started';

-- ── 7. Add indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_protocol_assignment_workspace
  ON protocol_assignment (workspace_id);
CREATE INDEX IF NOT EXISTS idx_protocol_assignment_workspace_status
  ON protocol_assignment (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_protocol_assignment_profile_status
  ON protocol_assignment (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_protocol_assignment_next_review
  ON protocol_assignment (next_review_at)
  WHERE next_review_at IS NOT NULL;

-- ── 8. AI-readiness columns on knowledge_test_attempt ───────────
ALTER TABLE knowledge_test_attempt
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS graded_by TEXT;

COMMENT ON COLUMN knowledge_test_attempt.ai_confidence
  IS 'AI grading confidence 0.00-1.00. NULL = human/automated grading.';
COMMENT ON COLUMN knowledge_test_attempt.graded_by
  IS 'Who graded: "system" (automated), "ai" (LLM), or profile_id (human).';

-- ── 9. Rewrite RLS policies on protocol_assignment ──────────────
-- Old policies used JOIN through protocol for workspace scoping.
-- New policies use direct workspace_id column.

DROP POLICY IF EXISTS "Read protocol_assignment" ON protocol_assignment;
DROP POLICY IF EXISTS "Write protocol_assignment" ON protocol_assignment;

-- Employees can read their own assignments
CREATE POLICY "jwt_read_own_assignments" ON protocol_assignment
FOR SELECT USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- Admins can read all assignments in their workspace
CREATE POLICY "jwt_admin_read_assignments" ON protocol_assignment
FOR SELECT USING (
  is_admin_in_workspace(auth.uid(), workspace_id)
);

-- Admins can write assignments in their workspace
CREATE POLICY "jwt_admin_write_assignments" ON protocol_assignment
FOR ALL USING (
  is_admin_in_workspace(auth.uid(), workspace_id)
);

-- Service role: full access
CREATE POLICY "service_role_protocol_assignment" ON protocol_assignment
FOR ALL USING (auth.role() = 'service_role');

-- ── 10. Update auto-assign trigger ──────────────────────────────
CREATE OR REPLACE FUNCTION auto_assign_protocols_to_new_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- Only assign to trainee or active profiles
  -- Column is 'status' (type profile_status), NOT 'profile_status'
  IF NEW.status NOT IN ('trainee', 'active') THEN
    RETURN NEW;
  END IF;

  INSERT INTO protocol_assignment (
    protocol_id,
    profile_id,
    workspace_id,
    status,
    assigned_at,
    assigned_via,
    assigned_ref_id,
    protocol_version
  )
  SELECT
    p.protocol_id,
    NEW.profile_id,
    NEW.workspace_id,
    'not_started',
    now(),
    CASE pol.policy_scope
      WHEN 'workspace' THEN 'workspace'::assignment_source
      WHEN 'department' THEN 'department'::assignment_source
      WHEN 'team' THEN 'team'::assignment_source
      WHEN 'location' THEN 'location'::assignment_source
    END,
    pol.scope_ref_id,
    p.version
  FROM protocol p
  JOIN policy pol ON p.policy_id = pol.policy_id
  WHERE p.workspace_id = NEW.workspace_id
    AND p.status = 'active'
    AND pol.is_active = true
    AND (
      pol.policy_scope = 'workspace'
      OR (pol.policy_scope = 'department' AND pol.scope_ref_id = NEW.department_id)
      OR (pol.policy_scope = 'team' AND pol.scope_ref_id = ANY(
        SELECT team_id FROM team_member WHERE profile_id = NEW.profile_id
      ))
      OR (pol.policy_scope = 'location' AND pol.scope_ref_id = NEW.location_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM protocol_assignment pa
      WHERE pa.protocol_id = p.protocol_id
        AND pa.profile_id = NEW.profile_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 11. Update get_workspace_readiness RPC ──────────────────────
-- Now uses direct workspace_id instead of JOIN through profile
CREATE OR REPLACE FUNCTION public.get_workspace_readiness(p_workspace_id uuid)
RETURNS TABLE(profile_id uuid, total bigint, completed bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    pa.profile_id,
    COUNT(pa.assignment_id) AS total,
    COUNT(pa.assignment_id) FILTER (WHERE pa.status = 'completed') AS completed
  FROM public.protocol_assignment pa
  WHERE pa.workspace_id = p_workspace_id
  GROUP BY pa.profile_id;
$$;

-- ── 12. Add comments ────────────────────────────────────────────
COMMENT ON COLUMN protocol_assignment.workspace_id
  IS 'Direct workspace scoping. Backfilled from profile.workspace_id.';
COMMENT ON COLUMN protocol_assignment.assigned_via
  IS 'How the protocol was assigned: workspace/department/team/location/position/manual/season.';
COMMENT ON COLUMN protocol_assignment.next_review_at
  IS 'Spaced repetition: when this assignment should be re-reviewed. NULL = no review scheduled.';
```

- [ ] **Step 2: Generate the migration files with timestamps**

Run:
```bash
TS1=$(date +%Y%m%d%H%M%S)
sleep 1
TS2=$(date +%Y%m%d%H%M%S)
# Write the enum SQL to supabase/migrations/${TS1}_training_add_enum_values.sql
# Write the main SQL to supabase/migrations/${TS2}_training_schema_foundation.sql
```

- [ ] **Step 3: Apply migration locally**

Run: `npx supabase db reset`
Expected: Migration applies cleanly. All existing data backfilled.

- [ ] **Step 4: Regenerate TypeScript types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: `protocol_assignment` type now includes `workspace_id`, `assigned_via`, `assigned_ref_id`, `assigned_by`, progress counts, waiver fields, `protocol_version`, `next_review_at`. `knowledge_test_attempt` includes `ai_confidence`, `graded_by`.

- [ ] **Step 5: Verify types compile**

Run: `pnpm turbo typecheck --filter=@smartout/supabase`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/*_training_add_enum_values.sql supabase/migrations/*_training_schema_foundation.sql packages/supabase/src/database.types.ts
git commit -m "feat(training): extend protocol_assignment schema with workspace scoping and AI columns

Adds workspace_id, assigned_via, progress counts, waiver fields,
protocol_version, next_review_at to protocol_assignment. Adds
ai_confidence and graded_by to knowledge_test_attempt. Rewrites
RLS to use direct workspace_id. Updates auto-assign trigger and
readiness RPC. Council-approved 2026-04-14.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create packages/training Package

**Files:**
- Create: `packages/training/package.json`
- Create: `packages/training/tsconfig.json`
- Create: `packages/training/src/index.ts`
- Create: `packages/training/src/types.ts`
- Create: `packages/training/src/hooks/keys.ts`
- Modify: `pnpm-workspace.yaml` (verify `packages/*` glob already covers it)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@smartout/training",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./hooks": "./src/hooks/index.ts",
    "./types": "./src/types.ts"
  },
  "scripts": {
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@smartout/supabase": "workspace:*",
    "@smartout/telemetry": "workspace:*",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@smartout/eslint-config": "workspace:^",
    "@smartout/typescript-config": "workspace:*"
  },
  "peerDependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "@tanstack/react-query": "^5.0.0",
    "react": "^19.0.0",
    "sonner": "^1.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@smartout/typescript-config/react-library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create src/types.ts**

Move the types from `apps/web/src/app/dashboard/my-training/_hooks/use-assigned-protocols.ts` (lines 13-69):

```typescript
// packages/training/src/types.ts
// Shared training types used by web, mobile, and agent capabilities.

export type AssignedProtocol = {
  assignmentId: string;
  protocolId: string;
  protocolName: string;
  protocolDescription: string | null;
  assignmentStatus: "not_started" | "in_progress" | "completed" | "expired" | "waived";
  assignedAt: string;
  completedAt: string | null;
  assignedVia: string | null;
  protocolVersion: string | null;
  procedures: AssignedProcedure[];
  knowledgeTests: AssignedKnowledgeTest[];
  confirmations: AssignedConfirmation[];
  progress: {
    totalSteps: number;
    completedSteps: number;
    percent: number;
  };
};

export type AssignedProcedure = {
  procedureId: string;
  name: string;
  description: string | null;
  sortOrder: number | null;
  steps: ProcedureStepWithStatus[];
};

export type ProcedureStepWithStatus = {
  stepId: string;
  title: string;
  description: string;
  stepOrder: number;
  isRequired: boolean;
  estimatedMinutes: number | null;
  trainingContent: string | null;
  mediaUrls: Array<{ type: string; url: string; caption?: string }> | null;
  isCompleted: boolean;
  completedAt: string | null;
};

export type AssignedKnowledgeTest = {
  testId: string;
  name: string;
  description: string | null;
  passThreshold: number;
  maxAttempts: number | null;
  questions: unknown;
  passed: boolean;
  bestScore: number | null;
  attemptCount: number;
};

export type AssignedConfirmation = {
  confirmationId: string;
  name: string;
  confirmationText: string;
  requiresSignature: boolean;
  isSigned: boolean;
  signedAt: string | null;
};

export type ReadinessScore = {
  percent: number;
  completed: number;
  total: number;
};
```

- [ ] **Step 4: Create src/hooks/keys.ts**

```typescript
// packages/training/src/hooks/keys.ts
// TanStack Query key factory for training data.

export const trainingKeys = {
  assignedProtocols: (profileId: string) =>
    ["training", "assigned-protocols", profileId] as const,
  readiness: (profileId: string) =>
    ["training", "readiness", profileId] as const,
  workspaceReadiness: (workspaceId: string) =>
    ["training", "workspace-readiness", workspaceId] as const,
};
```

- [ ] **Step 5: Create src/index.ts**

```typescript
// packages/training/src/index.ts
export { trainingKeys } from "./hooks/keys.js";
export type {
  AssignedProtocol,
  AssignedProcedure,
  ProcedureStepWithStatus,
  AssignedKnowledgeTest,
  AssignedConfirmation,
  ReadinessScore,
} from "./types.js";
```

- [ ] **Step 6: Install dependencies**

Run: `pnpm install`
Expected: `@smartout/training` package resolves in workspace

- [ ] **Step 7: Verify types compile**

Run: `pnpm turbo typecheck --filter=@smartout/training`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/training/ pnpm-lock.yaml
git commit -m "feat(training): create @smartout/training package with shared types and query keys

Shared training types and TanStack Query key factory for mobile
parity. Hooks will be moved here in the next task.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Move Shared Hooks to packages/training

**Files:**
- Create: `packages/training/src/hooks/use-assigned-protocols.ts`
- Create: `packages/training/src/hooks/use-step-completion.ts`
- Create: `packages/training/src/hooks/use-readiness-score.ts`
- Create: `packages/training/src/hooks/index.ts`
- Modify: `apps/web/src/app/dashboard/my-training/_hooks/use-assigned-protocols.ts` (thin re-export)
- Modify: `apps/web/src/app/dashboard/my-training/_hooks/use-step-completion.ts` (thin re-export)
- Modify: `apps/web/src/app/dashboard/hms/_hooks/use-readiness-score.ts` (thin re-export)

- [ ] **Step 1: Create the shared use-assigned-protocols hook**

Create `packages/training/src/hooks/use-assigned-protocols.ts`. This is a refactored version of `apps/web/src/app/dashboard/my-training/_hooks/use-assigned-protocols.ts` that:
- Uses types from `../types.ts` instead of inline types
- Uses `trainingKeys` from `./keys.ts`
- Accepts `supabaseClient` and `workspaceId` as parameters (dependency injection instead of importing web-specific hooks)
- Maps `training_content` and `media_urls` from procedure steps (now that the columns exist)
- Updates status mapping: `"pending"` → `"not_started"` (matches new enum)

```typescript
// packages/training/src/hooks/use-assigned-protocols.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignedProtocol } from "../types.js";
import { trainingKeys } from "./keys.js";

type UseAssignedProtocolsOptions = {
  profileId: string | null;
  workspaceId: string;
  supabase: SupabaseClient;
};

export function useAssignedProtocols({ profileId, workspaceId, supabase }: UseAssignedProtocolsOptions) {
  return useQuery({
    queryKey: trainingKeys.assignedProtocols(profileId ?? ""),
    enabled: !!profileId,
    staleTime: 3 * 60 * 1000,
    queryFn: async (): Promise<AssignedProtocol[]> => {
      // 1. Fetch assignments for this profile, now scoped by workspace_id directly
      const { data: assignments, error: assignError } = await supabase
        .from("protocol_assignment")
        .select(
          "assignment_id, protocol_id, status, assigned_at, completed_at, assigned_via, protocol_version, protocol:protocol_id(name, description)",
        )
        .eq("profile_id", profileId!)
        .eq("workspace_id", workspaceId);

      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) return [];

      const protocolIds = assignments.map((a) => a.protocol_id);

      // 2-7: Fetch procedures, steps, completions, tests, attempts, confirmations, signatures in parallel
      const [proceduresRes, completionsRes, testsRes, attemptsRes, confirmationsRes, signaturesRes] =
        await Promise.all([
          supabase
            .from("procedure")
            .select(
              "procedure_id, name, description, sort_order, protocol_id, procedure_step(step_id, title, description, step_order, is_required, estimated_minutes, training_content, media_urls)",
            )
            .in("protocol_id", protocolIds)
            .eq("is_active", true)
            .order("sort_order"),
          supabase
            .from("procedure_step_completion")
            .select("procedure_step_id, completed_at, protocol_assignment_id")
            .eq("profile_id", profileId!)
            .eq("workspace_id", workspaceId),
          supabase
            .from("knowledge_test")
            .select(
              "knowledge_test_id, name, description, pass_threshold, max_attempts, questions, protocol_id",
            )
            .in("protocol_id", protocolIds)
            .eq("is_active", true),
          supabase
            .from("knowledge_test_attempt")
            .select("knowledge_test_id, score, passed")
            .eq("profile_id", profileId!)
            .eq("workspace_id", workspaceId),
          supabase
            .from("confirmation")
            .select("confirmation_id, name, confirmation_text, requires_signature, protocol_id")
            .in("protocol_id", protocolIds)
            .eq("is_active", true),
          supabase
            .from("confirmation_signature")
            .select("confirmation_id, signed_at")
            .eq("profile_id", profileId!)
            .eq("workspace_id", workspaceId),
        ]);

      if (proceduresRes.error) throw proceduresRes.error;
      if (completionsRes.error) throw completionsRes.error;
      if (testsRes.error) throw testsRes.error;
      if (attemptsRes.error) throw attemptsRes.error;
      if (confirmationsRes.error) throw confirmationsRes.error;
      if (signaturesRes.error) throw signaturesRes.error;

      // Build lookup maps
      const completionSet = new Set((completionsRes.data ?? []).map((c) => c.procedure_step_id));
      const completionDates = new Map(
        (completionsRes.data ?? []).map((c) => [c.procedure_step_id, c.completed_at]),
      );

      const attemptMap = new Map<string, { passed: boolean; bestScore: number | null; count: number }>();
      for (const a of attemptsRes.data ?? []) {
        const existing = attemptMap.get(a.knowledge_test_id) ?? { passed: false, bestScore: null, count: 0 };
        existing.count++;
        if (a.passed) existing.passed = true;
        if (a.score !== null && (existing.bestScore === null || a.score > existing.bestScore)) {
          existing.bestScore = a.score;
        }
        attemptMap.set(a.knowledge_test_id, existing);
      }

      const signatureMap = new Map(
        (signaturesRes.data ?? []).map((s) => [s.confirmation_id, s.signed_at]),
      );

      // Build result
      return assignments.map((assignment) => {
        const proto = assignment.protocol as unknown as { name: string; description: string | null };

        const procs = (proceduresRes.data ?? [])
          .filter((p) => p.protocol_id === assignment.protocol_id)
          .map((p) => {
            const steps = (
              (p.procedure_step ?? []) as Array<{
                step_id: string;
                title: string;
                description: string;
                step_order: number;
                is_required: boolean;
                estimated_minutes: number | null;
                training_content: string | null;
                media_urls: unknown;
              }>
            )
              .sort((a, b) => a.step_order - b.step_order)
              .map((s) => ({
                stepId: s.step_id,
                title: s.title,
                description: s.description,
                stepOrder: s.step_order,
                isRequired: s.is_required,
                estimatedMinutes: s.estimated_minutes,
                trainingContent: s.training_content,
                mediaUrls: s.media_urls as Array<{ type: string; url: string; caption?: string }> | null,
                isCompleted: completionSet.has(s.step_id),
                completedAt: completionDates.get(s.step_id) ?? null,
              }));

            return {
              procedureId: p.procedure_id,
              name: p.name,
              description: p.description,
              sortOrder: p.sort_order,
              steps,
            };
          });

        const protoTests = (testsRes.data ?? [])
          .filter((t) => t.protocol_id === assignment.protocol_id)
          .map((t) => {
            const att = attemptMap.get(t.knowledge_test_id);
            return {
              testId: t.knowledge_test_id,
              name: t.name,
              description: t.description,
              passThreshold: t.pass_threshold,
              maxAttempts: t.max_attempts,
              questions: t.questions,
              passed: att?.passed ?? false,
              bestScore: att?.bestScore ?? null,
              attemptCount: att?.count ?? 0,
            };
          });

        const protoConfs = (confirmationsRes.data ?? [])
          .filter((c) => c.protocol_id === assignment.protocol_id)
          .map((c) => ({
            confirmationId: c.confirmation_id,
            name: c.name,
            confirmationText: c.confirmation_text,
            requiresSignature: c.requires_signature,
            isSigned: signatureMap.has(c.confirmation_id),
            signedAt: signatureMap.get(c.confirmation_id) ?? null,
          }));

        const totalSteps =
          procs.reduce((sum, p) => sum + p.steps.length, 0) + protoTests.length + protoConfs.length;
        const completedSteps =
          procs.reduce((sum, p) => sum + p.steps.filter((s) => s.isCompleted).length, 0) +
          protoTests.filter((t) => t.passed).length +
          protoConfs.filter((c) => c.isSigned).length;

        return {
          assignmentId: assignment.assignment_id,
          protocolId: assignment.protocol_id,
          protocolName: proto.name,
          protocolDescription: proto.description,
          assignmentStatus: assignment.status as AssignedProtocol["assignmentStatus"],
          assignedAt: assignment.assigned_at,
          completedAt: assignment.completed_at,
          assignedVia: (assignment as Record<string, unknown>).assigned_via as string | null,
          protocolVersion: (assignment as Record<string, unknown>).protocol_version as string | null,
          procedures: procs,
          knowledgeTests: protoTests,
          confirmations: protoConfs,
          progress: {
            totalSteps,
            completedSteps,
            percent: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 100,
          },
        };
      });
    },
  });
}
```

- [ ] **Step 2: Create the shared use-step-completion hooks**

Create `packages/training/src/hooks/use-step-completion.ts`. Refactored from web version:
- Accepts `supabase`, `workspaceId`, `profileId` via options parameter
- Uses `trainingKeys` for invalidation
- Keeps all `emit()` telemetry calls

```typescript
// packages/training/src/hooks/use-step-completion.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import { emit } from "@smartout/telemetry";
import { trainingKeys } from "./keys.js";

type TrainingMutationContext = {
  supabase: SupabaseClient;
  workspaceId: string;
  profileId: string;
};

// ── Complete a procedure step ───────────────────────────────────

type CompleteStepInput = {
  procedureStepId: string;
  protocolAssignmentId: string;
};

export function useCompleteStep(ctx: TrainingMutationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ procedureStepId, protocolAssignmentId }: CompleteStepInput) => {
      const { data, error } = await ctx.supabase
        .from("procedure_step_completion")
        .insert({
          procedure_step_id: procedureStepId,
          profile_id: ctx.profileId,
          protocol_assignment_id: protocolAssignmentId,
          workspace_id: ctx.workspaceId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { procedureStepId }) => {
      void emit({
        event: "protocol step_completed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: { data: { procedure_step_id: procedureStepId, profile_id: ctx.profileId } },
      });
      toast.success("Steg fullført!");
      void queryClient.invalidateQueries({
        queryKey: trainingKeys.assignedProtocols(ctx.profileId),
      });
    },
    onError: () => {
      toast.error("Kunne ikke fullføre steg");
    },
  });
}

// ── Submit a knowledge test ─────────────────────────────────────

type SubmitTestInput = {
  knowledgeTestId: string;
  protocolAssignmentId: string;
  answers: Record<string, string>;
  score: number;
  passed: boolean;
};

export function useSubmitTest(ctx: TrainingMutationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ knowledgeTestId, protocolAssignmentId, answers, score, passed }: SubmitTestInput) => {
      const { data, error } = await ctx.supabase
        .from("knowledge_test_attempt")
        .insert({
          knowledge_test_id: knowledgeTestId,
          profile_id: ctx.profileId,
          protocol_assignment_id: protocolAssignmentId,
          answers: answers as unknown as Json,
          score,
          passed,
          workspace_id: ctx.workspaceId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { knowledgeTestId, passed }) => {
      void emit({
        event: "protocol test_submitted",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: { data: { knowledge_test_id: knowledgeTestId, profile_id: ctx.profileId, passed } },
      });
      if (passed) {
        toast.success("Bestått! Godt jobbet.");
      } else {
        toast.warning("Ikke bestått. Prøv igjen.");
      }
      void queryClient.invalidateQueries({
        queryKey: trainingKeys.assignedProtocols(ctx.profileId),
      });
    },
    onError: () => {
      toast.error("Kunne ikke sende inn test");
    },
  });
}

// ── Sign a confirmation ─────────────────────────────────────────

type SignConfirmationInput = {
  confirmationId: string;
  protocolAssignmentId: string;
  signatureData: Record<string, unknown>;
};

export function useSignConfirmation(ctx: TrainingMutationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ confirmationId, protocolAssignmentId, signatureData }: SignConfirmationInput) => {
      const { data, error } = await ctx.supabase
        .from("confirmation_signature")
        .insert({
          confirmation_id: confirmationId,
          profile_id: ctx.profileId,
          protocol_assignment_id: protocolAssignmentId,
          signature_data: signatureData as unknown as Json,
          workspace_id: ctx.workspaceId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { confirmationId }) => {
      void emit({
        event: "protocol confirmation_signed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: { data: { confirmation_id: confirmationId, profile_id: ctx.profileId } },
      });
      toast.success("Signatur registrert!");
      void queryClient.invalidateQueries({
        queryKey: trainingKeys.assignedProtocols(ctx.profileId),
      });
    },
    onError: () => {
      toast.error("Kunne ikke registrere signatur");
    },
  });
}
```

- [ ] **Step 3: Create the shared use-readiness-score hook**

```typescript
// packages/training/src/hooks/use-readiness-score.ts
"use client";

import { useMemo } from "react";
import type { AssignedProtocol, ReadinessScore } from "../types.js";
import { useAssignedProtocols } from "./use-assigned-protocols.js";
import type { SupabaseClient } from "@supabase/supabase-js";

type UseReadinessScoreOptions = {
  profileId: string | null;
  workspaceId: string;
  supabase: SupabaseClient;
};

export function useReadinessScore({ profileId, workspaceId, supabase }: UseReadinessScoreOptions) {
  const { data: protocols, isLoading } = useAssignedProtocols({ profileId, workspaceId, supabase });

  const score: ReadinessScore = useMemo(() => {
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

- [ ] **Step 4: Create hooks/index.ts barrel**

```typescript
// packages/training/src/hooks/index.ts
export { useAssignedProtocols } from "./use-assigned-protocols.js";
export { useCompleteStep, useSubmitTest, useSignConfirmation } from "./use-step-completion.js";
export { useReadinessScore } from "./use-readiness-score.js";
export { trainingKeys } from "./keys.js";
```

- [ ] **Step 5: Update packages/training/src/index.ts to include hooks**

```typescript
// packages/training/src/index.ts
export { trainingKeys } from "./hooks/keys.js";
export { useAssignedProtocols } from "./hooks/use-assigned-protocols.js";
export { useCompleteStep, useSubmitTest, useSignConfirmation } from "./hooks/use-step-completion.js";
export { useReadinessScore } from "./hooks/use-readiness-score.js";
export type {
  AssignedProtocol,
  AssignedProcedure,
  ProcedureStepWithStatus,
  AssignedKnowledgeTest,
  AssignedConfirmation,
  ReadinessScore,
} from "./types.js";
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/training`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/training/src/hooks/
git commit -m "feat(training): add shared training hooks to @smartout/training package

Moved use-assigned-protocols, use-step-completion, use-readiness-score
to packages/training for mobile parity. Hooks accept supabase client
and workspace context as parameters instead of web-specific imports.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire Web App to Shared Hooks

**Files:**
- Modify: `apps/web/src/app/dashboard/my-training/_hooks/use-assigned-protocols.ts`
- Modify: `apps/web/src/app/dashboard/my-training/_hooks/use-step-completion.ts`
- Modify: `apps/web/src/app/dashboard/hms/_hooks/use-readiness-score.ts`
- Modify: `apps/web/package.json` (add `@smartout/training` dependency)

- [ ] **Step 1: Add dependency**

Run: `pnpm --filter apps/web add @smartout/training@workspace:*`

- [ ] **Step 2: Replace use-assigned-protocols.ts with thin wrapper**

Replace `apps/web/src/app/dashboard/my-training/_hooks/use-assigned-protocols.ts` content:

```typescript
"use client";

// Re-exports from @smartout/training for backwards compatibility.
// Web-specific wrapper provides supabase client and workspace context.

import { useContext } from "react";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  useAssignedProtocols as useAssignedProtocolsShared,
  trainingKeys,
} from "@smartout/training";

export type {
  AssignedProtocol,
  AssignedProcedure,
  ProcedureStepWithStatus,
  AssignedKnowledgeTest,
  AssignedConfirmation,
} from "@smartout/training";

// Re-export for backwards compatibility with existing imports
export const myTrainingKeys = {
  assignedProtocols: trainingKeys.assignedProtocols,
};

export function useAssignedProtocols(profileId: string | null) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useAssignedProtocolsShared({
    profileId,
    workspaceId: workspace.workspace_id,
    supabase,
  });
}
```

- [ ] **Step 3: Replace use-step-completion.ts with thin wrapper**

Replace `apps/web/src/app/dashboard/my-training/_hooks/use-step-completion.ts` content:

```typescript
"use client";

// Re-exports from @smartout/training for backwards compatibility.

import { useContext } from "react";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  useCompleteStep as useCompleteStepShared,
  useSubmitTest as useSubmitTestShared,
  useSignConfirmation as useSignConfirmationShared,
} from "@smartout/training";

function useTrainingContext() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  return { supabase, workspaceId: workspace.workspace_id, profileId: profileId ?? "" };
}

export function useCompleteStep() {
  return useCompleteStepShared(useTrainingContext());
}

export function useSubmitTest() {
  return useSubmitTestShared(useTrainingContext());
}

export function useSignConfirmation() {
  return useSignConfirmationShared(useTrainingContext());
}
```

- [ ] **Step 4: Replace use-readiness-score.ts with thin wrapper**

Replace `apps/web/src/app/dashboard/hms/_hooks/use-readiness-score.ts` content:

```typescript
"use client";

import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useReadinessScore as useReadinessScoreShared } from "@smartout/training";

export function useReadinessScore(profileId: string | null) {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  return useReadinessScoreShared({
    profileId,
    workspaceId: workspace.workspace_id,
    supabase,
  });
}
```

- [ ] **Step 5: Verify full web typecheck**

Run: `pnpm turbo typecheck --filter=apps/web`
Expected: PASS. All existing component imports still resolve through the wrappers.

- [ ] **Step 6: Verify web dev server starts**

Run: `pnpm --filter apps/web dev`
Expected: No errors. Navigate to `/dashboard/my-training` — protocol list loads correctly.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/my-training/_hooks/ apps/web/src/app/dashboard/hms/_hooks/use-readiness-score.ts apps/web/package.json pnpm-lock.yaml
git commit -m "refactor(training): wire web app to shared @smartout/training hooks

Thin wrappers in apps/web delegate to shared hooks in packages/training.
Existing component imports unchanged. Mobile parity foundation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## ~~Task 5: REMOVED~~ (Mobile Bug Fix)

> **Council review 2026-04-14:** `is_active` is a valid column on `profile` — the original code is not a bug. `profile_status` is the enum TYPE name, not a column name. The proposed fix would have broken the query. Task removed.
>
> **Mobile hook parity** (refactoring `use-training-data.ts` to consume `@smartout/training` shared hooks) is **deferred to Sub-project B**.

---

## Task 6: Create Training AI Capability

**Files:**
- Create: `packages/ai/src/capabilities/training/tools.ts`
- Create: `packages/ai/src/capabilities/training/index.ts`
- Modify: `packages/ai/src/capabilities/registry.ts`

- [ ] **Step 1: Create training tools**

```typescript
// packages/ai/src/capabilities/training/tools.ts
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

export const getMyTrainingStatus = defineTool({
  name: "get_my_training_status",
  description:
    "Get the training status for the current employee. Returns total, completed, pending, and expired protocol assignments with overall readiness percentage.",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("protocol_assignment")
      .select("assignment_id, status, protocol:protocol_id(name)")
      .eq("profile_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId);

    if (error) return `Failed to fetch training status: ${error.message}`;
    if (!data || data.length === 0) return "You have no protocol assignments yet.";

    const total = data.length;
    const completed = data.filter((a) => a.status === "completed").length;
    const notStarted = data.filter((a) => a.status === "not_started").length;
    const inProgress = data.filter((a) => a.status === "in_progress").length;
    const expired = data.filter((a) => a.status === "expired").length;
    const readinessPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return [
      `Training Status:`,
      `- Total protocols: ${total}`,
      `- Completed: ${completed}`,
      `- Not started: ${notStarted}`,
      `- In progress: ${inProgress}`,
      `- Expired: ${expired}`,
      `- Readiness: ${readinessPercent}%`,
    ].join("\n");
  },
});

export const getNextProtocol = defineTool({
  name: "get_next_protocol",
  description:
    "Get the next recommended protocol for the employee to work on. Returns the most recently assigned incomplete protocol.",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("protocol_assignment")
      .select("assignment_id, status, assigned_at, protocol:protocol_id(name, description)")
      .eq("profile_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["not_started", "in_progress"])
      .order("assigned_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) return `Failed to fetch next protocol: ${error.message}`;
    if (!data) return "All protocols completed! You are at 100% readiness.";

    const proto = data.protocol as unknown as { name: string; description: string | null };
    return [
      `Next protocol to complete:`,
      `- Name: ${proto.name}`,
      proto.description ? `- Description: ${proto.description}` : null,
      `- Status: ${data.status}`,
      `- Assigned: ${new Date(data.assigned_at).toISOString().slice(0, 10)}`,
    ]
      .filter(Boolean)
      .join("\n");
  },
});

export const getTeamReadiness = defineTool({
  name: "get_team_readiness",
  description:
    "Get the training readiness overview for the workspace. Shows per-employee readiness percentages. Requires manager or admin role.",
  schema: z.object({
    departmentId: z.string().uuid().optional().describe("Filter by department ID"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // Fetch readiness using the RPC function
    const { data, error } = await ctx.supabaseAdmin.rpc("get_workspace_readiness", {
      p_workspace_id: ctx.workspaceId,
    });

    if (error) return `Failed to fetch team readiness: ${error.message}`;
    if (!data || data.length === 0) return "No employees with protocol assignments found.";

    // Fetch profile names
    const profileIds = data.map((r: { profile_id: string }) => r.profile_id);
    const { data: profiles } = await ctx.supabaseAdmin
      .from("profile")
      .select("profile_id, display_name, department_id")
      .in("profile_id", profileIds)
      .eq("workspace_id", ctx.workspaceId);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.profile_id, { name: p.display_name, departmentId: p.department_id }]),
    );

    let rows = data as Array<{ profile_id: string; total: number; completed: number }>;

    // Filter by department if requested
    if (params.departmentId) {
      rows = rows.filter((r) => profileMap.get(r.profile_id)?.departmentId === params.departmentId);
    }

    if (rows.length === 0) return "No employees match the filter.";

    const lines = rows.map((r) => {
      const name = profileMap.get(r.profile_id)?.name ?? "Unknown";
      const pct = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
      return `- ${name}: ${pct}% (${r.completed}/${r.total})`;
    });

    const totalCompleted = rows.reduce((s, r) => s + r.completed, 0);
    const totalAssignments = rows.reduce((s, r) => s + r.total, 0);
    const overallPct = totalAssignments > 0 ? Math.round((totalCompleted / totalAssignments) * 100) : 0;

    return [
      `Team Readiness (${rows.length} employees):`,
      ...lines,
      ``,
      `Overall: ${overallPct}%`,
    ].join("\n");
  },
});
```

- [ ] **Step 2: Create capability index**

```typescript
// packages/ai/src/capabilities/training/index.ts
import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { getMyTrainingStatus, getNextProtocol, getTeamReadiness } from "./tools.js";

// Employee-safe tools (available at read_only authority)
const employeeTools = [
  getMyTrainingStatus,
  getNextProtocol,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// Manager/admin tools (available at suggest authority or higher)
const managerTools = [
  getTeamReadiness,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

// All tools combined (available at confirm/autonomous authority)
const allTools = [
  ...employeeTools,
  ...managerTools,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const trainingCapability: CapabilityDefinition = {
  name: "training",
  description:
    "Employee training and competence: protocol assignments, readiness scores, knowledge test status, and next steps",
  tools: allTools,
  readOnlyTools: employeeTools,
  suggestTools: managerTools,
};
```

- [ ] **Step 3: Register in registry.ts**

In `packages/ai/src/capabilities/registry.ts`, add:

After the existing imports:
```typescript
import { trainingCapability } from "./training/index.js";
```

In the capabilities record, add:
```typescript
  training: trainingCapability,
```

- [ ] **Step 4: Verify AI package typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/ai`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/capabilities/training/ packages/ai/src/capabilities/registry.ts
git commit -m "feat(ai): add training capability with 3 read-only tools

Training intent route was declared but had no capability (ghost).
Now routes to get_my_training_status, get_next_protocol, and
get_team_readiness tools. All read-only. Phase 2 will add
write tools for AI grading and spaced repetition.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Full Typecheck and Verification

**Files:**
- No new files

- [ ] **Step 1: Run full monorepo typecheck**

Run: `pnpm turbo typecheck`
Expected: All packages and apps pass. Zero errors.

- [ ] **Step 2: Fix any import errors**

If any component import paths broke during the hook migration, fix them. Common issues:
- `myTrainingKeys` references — update to `trainingKeys` or verify re-export works
- `AssignedProtocol` type imports — verify web components can still import from local hooks
- `CompetenceMatrix.tsx` — verify it still works with the old `protocol_assignment` query (now has `workspace_id` column, can filter directly)

- [ ] **Step 3: Verify CompetenceMatrix uses workspace_id directly**

Update the query in `CompetenceMatrix.tsx` (line 54) to filter by `workspace_id` directly instead of relying on the protocol join. In `useCompetenceData`:

The existing line:
```typescript
        supabase
          .from("protocol_assignment")
          .select("profile_id, protocol_id, status")
          .eq("workspace_id", workspace.workspace_id),
```

This should already work since we added `workspace_id` to the table. Verify it returns data correctly.

- [ ] **Step 4: Run full typecheck again**

Run: `pnpm turbo typecheck`
Expected: PASS

- [ ] **Step 5: Commit any fixes**

```bash
git add -u
git commit -m "fix(training): resolve import path issues from hook migration

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `npx supabase db reset` succeeds (migration applies cleanly)
- [ ] `protocol_assignment` has `workspace_id` NOT NULL with FK
- [ ] `protocol_assignment` has `assigned_via`, `waived_by`, `protocol_version`, `next_review_at` columns
- [ ] `knowledge_test_attempt` has `ai_confidence`, `graded_by` columns
- [ ] Status enum includes `not_started`, `in_progress`, `waived`
- [ ] Existing `pending` rows mapped to `not_started`
- [ ] RLS allows employees to read own assignments, admins to read/write workspace assignments
- [ ] Auto-assign trigger populates `workspace_id`, `assigned_via`, `protocol_version`
- [ ] `get_workspace_readiness` RPC queries `protocol_assignment.workspace_id` directly
- [ ] `@smartout/training` package exports types and hooks
- [ ] Web app training dashboard loads via shared hooks
- [ ] Mobile hook bug fixed (`profile_status` enum, not `is_active` boolean)
- [ ] Training capability registered in AI capability registry
- [ ] Agent can respond to "what training do I need?" (routes to training capability, not fallback)
- [ ] `OversiktEmployee.tsx` imports resolve through re-exported types
- [ ] Column default for `protocol_assignment.status` is `'not_started'` (not `'pending'`)
- [ ] `getTeamReadiness` is in `suggestTools` (requires suggest authority, not available at read_only)
- [ ] `pnpm turbo typecheck` passes for full monorepo
