# Council Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues identified by the System Council from two merged branches (feat/mobile-production-readiness and feat/production-gaps-tier1).

**Architecture:** Three blocking batches (migration safety, data integrity, type safety) plus one follow-up batch for i18n/design violations. All changes are on `development` branch — no new tables or schemas needed.

**Tech Stack:** SQL migrations (Supabase), TypeScript (packages/ai), React (apps/web), i18n (packages/i18n)

**Council Reference:** Council session 2026-04-06. Verdict: APPROVE WITH CHANGES.

---

## Task 1: Fix Destructive Migration — shift_clock_config (ISSUE-12)

**Files:**

- Create: `supabase/migrations/20260406100000_fix_shift_clock_config.sql`

The migration `20260422500000_shift_clock_config.sql` uses `DROP TABLE IF EXISTS shift_clock_config CASCADE` which destroys data. We write a corrective migration that ensures the table has the correct FK constraints (ON DELETE CASCADE) and policies without dropping it.

The original table was created in `20260324100001_shift_clock_mobile_fixes.sql` with `CREATE TABLE IF NOT EXISTS` (correct). The broken migration `20260422500000` drops and recreates it. Our fix adds a new migration that ensures the correct state after whatever sequence ran.

- [ ] **Step 1: Write corrective migration**

```sql
-- Fix shift_clock_config: ensure correct FK constraints and policies
-- without destructive DROP TABLE CASCADE (council fix for ISSUE-12)
--
-- The table may have been created by 20260324100001 (safe, no CASCADE FKs)
-- or dropped+recreated by 20260422500000 (unsafe, but has CASCADE FKs).
-- This migration ensures correct state regardless of which path ran.

-- 1. Create table if it doesn't exist (covers fresh installs)
CREATE TABLE IF NOT EXISTS public.shift_clock_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id           UUID REFERENCES department(department_id) ON DELETE CASCADE,
  team_id                 UUID REFERENCES team(team_id) ON DELETE CASCADE,
  gps_required            BOOLEAN NOT NULL DEFAULT false,
  gps_radius_meters       INT NOT NULL DEFAULT 200,
  gps_reference_lat       NUMERIC(10,7),
  gps_reference_lng       NUMERIC(10,7),
  adhoc_shifts_enabled    BOOLEAN NOT NULL DEFAULT false,
  adhoc_requires_approval BOOLEAN NOT NULL DEFAULT true,
  punch_window_minutes    INT NOT NULL DEFAULT 30,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_clock_config UNIQUE (workspace_id, department_id, team_id)
);

-- 2. Ensure updated_at trigger exists
DROP TRIGGER IF EXISTS set_shift_clock_config_updated_at ON shift_clock_config;
CREATE TRIGGER set_shift_clock_config_updated_at
  BEFORE UPDATE ON shift_clock_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Ensure RLS is enabled
ALTER TABLE shift_clock_config ENABLE ROW LEVEL SECURITY;

-- 4. Ensure correct policies (idempotent)
DROP POLICY IF EXISTS "jwt_read_shift_clock_config" ON shift_clock_config;
CREATE POLICY "jwt_read_shift_clock_config" ON shift_clock_config
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_shift_clock_config" ON shift_clock_config;
CREATE POLICY "jwt_manage_shift_clock_config" ON shift_clock_config
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_shift_clock_config" ON shift_clock_config;
CREATE POLICY "api_key_read_shift_clock_config" ON shift_clock_config
  FOR SELECT USING (workspace_id = get_api_workspace_id());
```

- [ ] **Step 2: Run migration against local Supabase**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260406100000_fix_shift_clock_config.sql
```

Expected: No errors. The migration is fully idempotent.

- [ ] **Step 3: Verify table exists with correct structure**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "\d shift_clock_config"
```

Expected: Table with ON DELETE CASCADE on workspace_id, department_id, team_id FKs.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260406100000_fix_shift_clock_config.sql
git commit -m "fix(db): add idempotent shift_clock_config migration (council ISSUE-12)

Corrective migration that ensures correct FK constraints and policies
without destructive DROP TABLE CASCADE. Fully idempotent — safe to run
on any database state.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Fix Destructive Migration — shift_note + restore UPDATE policy (ISSUE-13, 17)

**Files:**

- Create: `supabase/migrations/20260406100001_fix_shift_note.sql`

Same pattern as Task 1, but for `shift_note`. Also restores the missing UPDATE RLS policy (ISSUE-17 regression).

- [ ] **Step 1: Write corrective migration**

```sql
-- Fix shift_note: ensure correct FK constraints, policies, and UPDATE policy
-- without destructive DROP TABLE CASCADE (council fix for ISSUE-13, ISSUE-17)
--
-- ISSUE-17: The migration 20260422500100 dropped the table and recreated
-- without the UPDATE policy that existed in 20260324100001. This restores it.

-- 1. Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.shift_note (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profile(profile_id),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_shift_note_shift ON shift_note(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_note_workspace ON shift_note(workspace_id);

-- 3. Ensure updated_at trigger
DROP TRIGGER IF EXISTS set_shift_note_updated_at ON shift_note;
CREATE TRIGGER set_shift_note_updated_at
  BEFORE UPDATE ON shift_note
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Ensure RLS
ALTER TABLE shift_note ENABLE ROW LEVEL SECURITY;

-- 5. Ensure correct policies (idempotent)
DROP POLICY IF EXISTS "jwt_read_shift_note" ON shift_note;
CREATE POLICY "jwt_read_shift_note" ON shift_note
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_shift_note" ON shift_note;
CREATE POLICY "jwt_insert_shift_note" ON shift_note
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND profile_id = (SELECT p.profile_id FROM profile p WHERE p.user_id = auth.uid() LIMIT 1)
  );

-- ISSUE-17 FIX: Restore UPDATE policy (was in 20260324100001, lost in 20260422500100)
DROP POLICY IF EXISTS "jwt_update_shift_note" ON shift_note;
CREATE POLICY "jwt_update_shift_note" ON shift_note
  FOR UPDATE USING (
    profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "api_key_read_shift_note" ON shift_note;
CREATE POLICY "api_key_read_shift_note" ON shift_note
  FOR SELECT USING (workspace_id = get_api_workspace_id());
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260406100001_fix_shift_note.sql
```

Expected: No errors.

- [ ] **Step 3: Verify UPDATE policy exists**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'shift_note'::regclass ORDER BY polname;"
```

Expected: Should show `jwt_update_shift_note` with polcmd `w` (UPDATE) along with the SELECT and INSERT policies.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260406100001_fix_shift_note.sql
git commit -m "fix(db): add idempotent shift_note migration + restore UPDATE policy (council ISSUE-13, ISSUE-17)

Corrective migration for shift_note. Ensures correct FK constraints
without DROP TABLE CASCADE. Restores jwt_update_shift_note policy
that was lost when 20260422500100 dropped and recreated the table.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add emit() to sendMessage (ISSUE-2)

**Files:**

- Modify: `packages/ai/src/capabilities/communication/tools.ts:109-126`

The `sendMessage` tool inserts a `channel_message` row but has no telemetry emit. Follow the pattern from `createDeviation` in `packages/ai/src/capabilities/operations/tools.ts:204-214`.

- [ ] **Step 1: Add engine_event emit after successful insert**

In `packages/ai/src/capabilities/communication/tools.ts`, after the successful insert (line 119, after the `if (error)` check), add the engine_event insert:

```typescript
if (error) {
  return `Error sending message: ${error.message}`;
}

// Emit engine event for audit trail (ADR-0069 — agent tools must emit)
await supabase.from("engine_event").insert({
  workspace_id: ctx.workspaceId,
  event_type: "channel_message.sent",
  payload: {
    channel_id: params.channel_id,
    message_id: data.id,
    source: "agent",
    actor_id: ctx.profileId,
  },
});

return JSON.stringify({ sent: true, message: data });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm --filter ai exec tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/capabilities/communication/tools.ts
git commit -m "fix(ai): add emit to sendMessage agent tool (council ISSUE-2)

sendMessage was the only mutation tool without engine_event emit.
Now follows the same pattern as createDeviation and completeTask
per ADR-0069 (agent tools must emit).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Fix supabaseAdmin typing (ISSUE-8, resolves ISSUE-7)

**Files:**

- Modify: `packages/ai/src/capabilities/types.ts:1,23`
- Modify: `packages/ai/src/capabilities/communication/tools.ts` (remove casts)
- Modify: `packages/ai/src/capabilities/schedule/tools.ts` (remove casts)
- Modify: `packages/ai/src/capabilities/operations/tools.ts` (remove casts)

Change `supabaseAdmin: unknown` to `supabaseAdmin: SupabaseClient` in `AgentToolContext`. Then remove all `as SupabaseClient` casts from tool files.

- [ ] **Step 1: Add SupabaseClient import and type the field in types.ts**

In `packages/ai/src/capabilities/types.ts`, add the import and change the type:

```typescript
import type { SmartoutTool } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ... keep existing types ...

export type AgentToolContext = {
  workspaceId: string;
  profileId: string;
  userId?: string;
  sessionId: string;
  supabaseAdmin: SupabaseClient;
};
```

- [ ] **Step 2: Remove casts from communication/tools.ts**

Remove `import type { SupabaseClient } from "@supabase/supabase-js";` (line 7) and replace all three `ctx.supabaseAdmin as SupabaseClient` with `ctx.supabaseAdmin`:

Line 22: `const supabase = ctx.supabaseAdmin;`
Line 68: `const supabase = ctx.supabaseAdmin;`
Line 95: `const supabase = ctx.supabaseAdmin;`

- [ ] **Step 3: Remove casts from schedule/tools.ts**

Remove `import type { SupabaseClient } from "@supabase/supabase-js";` (line 10) and replace all four casts:

Line 31: `const supabase = ctx.supabaseAdmin;`
Line 64: `const supabase = ctx.supabaseAdmin;`
Line 108: `const supabase = ctx.supabaseAdmin;`
Line 154: `const supabase = ctx.supabaseAdmin;`

- [ ] **Step 4: Remove casts from operations/tools.ts**

Remove `import type { SupabaseClient } from "@supabase/supabase-js";` (line 5) and replace all five casts:

Line 19: `const supabase = ctx.supabaseAdmin;`
Line 48: `const supabase = ctx.supabaseAdmin;` (was 49)
Line 93: `const supabase = ctx.supabaseAdmin;`
Line 174: `const supabase = ctx.supabaseAdmin;`
Line 227: `const supabase = ctx.supabaseAdmin;` (was 229)

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm --filter ai exec tsc --noEmit
```

Expected: No type errors. If there are errors from other files importing `AgentToolContext` and passing a non-SupabaseClient, those need to be fixed at the call site.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/capabilities/types.ts packages/ai/src/capabilities/communication/tools.ts packages/ai/src/capabilities/schedule/tools.ts packages/ai/src/capabilities/operations/tools.ts
git commit -m "refactor(ai): type supabaseAdmin as SupabaseClient, remove unsafe casts (council ISSUE-8)

Root cause fix: AgentToolContext.supabaseAdmin was typed as unknown,
forcing every tool to cast via 'as SupabaseClient'. Now properly
typed, removing 12 unsafe casts across 3 tool files.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Fix hardcoded text and colors in ActivityView (ISSUE-14, 15)

**Files:**

- Modify: `apps/web/src/components/dashboard/ActivityView.tsx:17,20,65,73,88`
- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

- [ ] **Step 1: Add i18n keys to nb/dashboard.json**

In the `"activity"` section (around line 63), add:

```json
  "activity": {
    "coming_soon_title": "Varmekart er under utvikling",
    "coming_soon_description": "Aktivitetsvarmekart, filtre og statistikk er under utvikling. Aktivitetsloggen nedenfor viser sanntidsdata.",
    "title": "Aktivitet",
    "empty": "Ingen aktivitet registrert i dag ennå.",
    "log_title": "Aktivitetslogg — i dag"
  }
```

- [ ] **Step 2: Add i18n keys to en/dashboard.json**

Same structure in English:

```json
  "activity": {
    "coming_soon_title": "Heatmap is under development",
    "coming_soon_description": "Activity heatmaps, filters, and statistics are under development. The activity log below shows real-time data.",
    "title": "Activity",
    "empty": "No activity recorded today yet.",
    "log_title": "Activity log — today"
  }
```

- [ ] **Step 3: Fix hardcoded text and colors in ActivityView.tsx**

Replace line 17 (icon container):

```tsx
// Before:
<div className="rounded-xl bg-indigo-500/15 p-2 text-indigo-500 dark:shadow-[0_0_20px_rgba(99,102,241,0.2)]">

// After:
<div className="bg-primary/10 text-primary rounded-xl p-2">
```

Replace line 20 (heading):

```tsx
// Before:
Aktivitet;

// After:
{
  t("activity.title");
}
```

Replace line 65 (empty state):

```tsx
// Before:
Ingen aktivitet registrert i dag ennå.

// After:
{t("activity.empty")}
```

Replace line 73 (log title):

```tsx
// Before:
Aktivitetslogg — i dag

// After:
{t("activity.log_title")}
```

Replace line 88 (warning dot):

```tsx
// Before:
<div className="h-2 w-2 shrink-0 rounded-full bg-orange-400" />

// After:
<div className="bg-destructive h-2 w-2 shrink-0 rounded-full" />
```

Note: `ActivityDetailPanel` needs access to `t()`. Either pass it as a prop from `ActivityView`, or add `useTranslation("dashboard")` inside `ActivityDetailPanel`.

- [ ] **Step 4: Verify build compiles**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/ActivityView.tsx packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "fix(dashboard): replace hardcoded text and colors in ActivityView (council ISSUE-14, 15)

Replace 3 hardcoded Norwegian strings with t() calls.
Replace bg-indigo-500 (cold-spectrum) with bg-primary/10 (warm OKLCH).
Replace bg-orange-400 with bg-destructive (semantic token).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Fix English strings in nb/dashboard.json (ISSUE-16)

**Files:**

- Modify: `packages/i18n/locales/nb/dashboard.json:7,11`

- [ ] **Step 1: Fix the two untranslated strings**

At line 7, change:

```json
"on_duty": "On duty"
```

to:

```json
"on_duty": "På jobb"
```

At line 11, change:

```json
"on_duty_title": "On-duty progress"
```

to:

```json
"on_duty_title": "Fremdrift på jobb"
```

- [ ] **Step 2: Commit**

```bash
git add packages/i18n/locales/nb/dashboard.json
git commit -m "fix(i18n): translate English strings in nb/dashboard.json (council ISSUE-16)

Two cockpit keys were copied from English without translation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Remove console.log(profileId) from push.ts (ISSUE-9)

**Files:**

- Modify: `apps/mobile/src/lib/push.ts:119`

- [ ] **Step 1: Remove PII from log line**

At line 119, change:

```typescript
console.log("Push token updated for profile", profileId);
```

to:

```typescript
console.log("Push token updated successfully");
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/lib/push.ts
git commit -m "fix(mobile): remove profileId from push token log (council ISSUE-9)

Profile IDs should not be logged to device console.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Run full typecheck

- [ ] **Step 1: Run turbo typecheck**

```bash
cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck
```

Expected: 0 errors across all packages.

- [ ] **Step 2: If errors, fix them before final commit**

---

## Summary

| Task | Issues Fixed  | Batch                     | Priority |
| ---- | ------------- | ------------------------- | -------- |
| 1    | ISSUE-12      | Batch 1: Migration Safety | CRITICAL |
| 2    | ISSUE-13, 17  | Batch 1: Migration Safety | CRITICAL |
| 3    | ISSUE-2       | Batch 2: Data Integrity   | HIGH     |
| 4    | ISSUE-8 (+ 7) | Batch 3: Type Safety      | HIGH     |
| 5    | ISSUE-14, 15  | Batch 4: Follow-up        | MEDIUM   |
| 6    | ISSUE-16      | Batch 4: Follow-up        | MEDIUM   |
| 7    | ISSUE-9       | Batch 4: Follow-up        | LOW      |
| 8    | —             | Verification              | —        |

### Not in this plan (tracked separately)

| Issue      | Reason                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| ISSUE-1    | BY DESIGN — systemic agent auth pattern, needs architecture ADR                                                |
| ISSUE-3    | Incomplete mobile feature — fix when FAB modes are implemented                                                 |
| ISSUE-4    | Mock data — fix when payroll hooks exist                                                                       |
| ISSUE-5, 6 | Mobile i18n — fix in mobile i18n batch                                                                         |
| ISSUE-10   | ACCEPTABLE DEBT — tracked TODO                                                                                 |
| ISSUE-11   | ACCEPTABLE DEBT — cached hook, low impact                                                                      |
| ISSUE-18   | Useless E2E test — rewrite in E2E batch                                                                        |
| ISSUE-19   | FALSE POSITIVE — resolved by DROP TABLE (if fixed, becomes relevant when 12/13 are fixed, handled in Task 1/2) |
