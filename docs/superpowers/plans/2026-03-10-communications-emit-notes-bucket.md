---
title: "Communications: Emit Telemetry + Notes Table + Document Bucket"
status: in_progress
updated: 2026-03-10
created: 2026-03-10
module: communications
tags: [telemetry, notes, storage, plan]
---

# Communications: Emit Telemetry + Notes Table + Document Bucket

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up `emit()` telemetry on all communication mutations, verify `workspace_note` table is usable from communications UI, and create a `workspace-documents` storage bucket with godmode-only policies.

**Architecture:** Three independent tracks that can be parallelized. Track 1 adds 3 new event types to `@smartout/telemetry` registry and wires `emit()` into the send/cancel API routes. Track 2 verifies the existing `workspace_note` table + CRUD route work (migration already exists). Track 3 creates a new Supabase Storage bucket with godmode-only RLS policies.

**Tech Stack:** TypeScript, Supabase (PostgreSQL, Storage), `@smartout/telemetry`, Next.js API routes

---

## Pre-flight

Before starting ANY task, confirm:

```bash
pwd                          # Should be ~/dev/wt-3
git branch --show-current    # Should be feat/fix/adminpage-speed
```

---

## Chunk 1: Telemetry Events for Communications

### Task 1: Register 3 new communication events in telemetry registry

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add event interfaces after the Handbook section (~line 345)**

Add these after `HandbookChapterSaved` (line 345) and before `// ─── Wizard Events`:

```typescript
// ─── Communication ──────────────────────────────
export interface CommunicationSent extends BaseEvent {
  event: "communication sent";
  properties: {
    data: {
      communication_id: string;
      template: string;
      classification: string;
      recipient_count: number;
      sent_count: number;
      failed_count: number;
    };
  };
}

export interface CommunicationCancelled extends BaseEvent {
  event: "communication cancelled";
  properties: {
    data: {
      communication_id: string;
    };
  };
}

export interface CommunicationFailed extends BaseEvent {
  event: "communication failed";
  properties: {
    data: {
      communication_id: string;
      template: string;
      error: string;
    };
  };
}
```

- [ ] **Step 2: Add to SmartoutEvent union (~line 369)**

Add before `| PageViewed`:

```typescript
  | CommunicationSent
  | CommunicationCancelled
  | CommunicationFailed
```

- [ ] **Step 3: Add to EVENT_ROUTING map (~line 401)**

Add after the `"reconciliation admin_action"` entry (line 490):

```typescript
  "communication sent": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "communication",
  },
  "communication cancelled": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "communication",
  },
  "communication failed": {
    destinations: ["posthog", "logger"],
    category: "communication",
  },
```

Note: No `engine_event` destination — communications are platform-admin only, not workspace workflow triggers.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @smartout/telemetry exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): add communication sent/cancelled/failed events"
```

---

### Task 2: Wire emit() into communications send route

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/communications/send/route.ts`

- [ ] **Step 1: Add import**

Add after the existing imports (line 1):

```typescript
import { emit } from "@smartout/telemetry";
```

- [ ] **Step 2: Add emit() on successful send (after logPlatformAction, ~line 255)**

After the `logPlatformAction(...)` call at line 255, add:

```typescript
void emit({
  event: "communication sent",
  workspace_id: audience.type === "workspace" ? audience.workspaceId : "platform",
  actor_id: adminId,
  properties: {
    data: {
      communication_id: jobId,
      template,
      classification,
      recipient_count: activeRecipients.length,
      sent_count: result.sentCount,
      failed_count: result.failedCount,
    },
  },
});
```

- [ ] **Step 3: Add emit() on failed send (in the catch block, ~line 271)**

Inside the catch block, after the DB update and before the return:

```typescript
void emit({
  event: "communication failed",
  workspace_id: audience.type === "workspace" ? audience.workspaceId : "platform",
  actor_id: adminId,
  properties: {
    data: {
      communication_id: jobId,
      template,
      error: err instanceof Error ? err.message : "Unknown error",
    },
  },
});
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/platform-admin/communications/send/route.ts
git commit -m "feat(communications): add emit() telemetry to send route"
```

---

### Task 3: Wire emit() into communications cancel route

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/communications/[jobId]/cancel/route.ts`

- [ ] **Step 1: Read the file first**

Read the full cancel route to understand its structure.

- [ ] **Step 2: Add import**

```typescript
import { emit } from "@smartout/telemetry";
```

- [ ] **Step 3: Add emit() after logPlatformAction (~line 45)**

After `await logPlatformAction(adminId, "cancel_communication", "communication", jobId, {});`:

```typescript
void emit({
  event: "communication cancelled",
  workspace_id: "platform",
  actor_id: adminId,
  properties: {
    data: {
      communication_id: jobId,
    },
  },
});
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/platform-admin/communications/[jobId]/cancel/route.ts
git commit -m "feat(communications): add emit() telemetry to cancel route"
```

---

## Chunk 2: Workspace Notes Table (Verify Existing)

### Task 4: Verify workspace_note migration runs cleanly

The migration `supabase/migrations/20260310150000_workspace_note.sql` and API route `apps/web/src/app/api/platform-admin/workspace-notes/route.ts` already exist. This task verifies they work.

**Files:**

- Verify: `supabase/migrations/20260310150000_workspace_note.sql`
- Verify: `apps/web/src/app/api/platform-admin/workspace-notes/route.ts`

- [ ] **Step 1: Verify migration was applied**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "\d public.workspace_note"
```

Expected: Table exists with columns `note_id`, `workspace_id`, `admin_id`, `content`, `created_at`, `updated_at`.

If table does NOT exist, apply migration:

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260310150000_workspace_note.sql
```

- [ ] **Step 2: Verify types are generated**

```bash
grep -c "workspace_note" packages/supabase/src/database.types.ts
```

Expected: Multiple matches. If 0, regenerate:

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm turbo typecheck`
Expected: 0 errors

- [ ] **Step 4: No commit needed if nothing changed. If types were regenerated:**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore(types): regenerate database types for workspace_note"
```

---

## Chunk 3: Storage Bucket for Workspace Documents

### Task 5: Create workspace-documents bucket migration

**Files:**

- Create: `supabase/migrations/20260310160000_workspace_documents_bucket.sql`

- [ ] **Step 1: Write the migration**

```sql
-- workspace-documents: Private bucket for platform-admin document uploads per workspace.
-- Godmode-only access. Path convention: {workspace_id}/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-documents',
  'workspace-documents',
  false,
  20971520, -- 20 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Only godmode users can upload
CREATE POLICY "godmode_upload_workspace_documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'workspace-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  )
);

-- Only godmode users can read
CREATE POLICY "godmode_read_workspace_documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'workspace-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  )
);

-- Only godmode users can update
CREATE POLICY "godmode_update_workspace_documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'workspace-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  )
);

-- Only godmode users can delete
CREATE POLICY "godmode_delete_workspace_documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'workspace-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  )
);
```

- [ ] **Step 2: Apply migration**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260310160000_workspace_documents_bucket.sql
```

Expected: INSERT 0 1, CREATE POLICY x4

- [ ] **Step 3: Verify bucket exists**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'workspace-documents';"
```

Expected: One row, `public = false`, `file_size_limit = 20971520`

- [ ] **Step 4: Verify policies exist**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%workspace_documents%';"
```

Expected: 4 policies listed

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260310160000_workspace_documents_bucket.sql
git commit -m "feat(storage): add workspace-documents bucket with godmode-only policies"
```

---

## Chunk 4: Final Verification

### Task 6: Full typecheck + verify all changes

- [ ] **Step 1: Run full typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors across all packages

- [ ] **Step 2: Verify all new emit events compile**

```bash
cd packages/telemetry && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Verify git status is clean**

```bash
git status
git log --oneline -5
```

Expected: All changes committed in 3-4 atomic commits

---

## Summary of Changes

| Track     | What                                                | Files                                                                        |
| --------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Telemetry | 3 new events: `communication sent/cancelled/failed` | `packages/telemetry/src/registry.ts`                                         |
| Telemetry | `emit()` on send route (success + failure)          | `apps/web/src/app/api/platform-admin/communications/send/route.ts`           |
| Telemetry | `emit()` on cancel route                            | `apps/web/src/app/api/platform-admin/communications/[jobId]/cancel/route.ts` |
| Notes     | Verify existing `workspace_note` table + API        | `supabase/migrations/20260310150000_workspace_note.sql` (existing)           |
| Bucket    | `workspace-documents` bucket + 4 godmode policies   | `supabase/migrations/20260310160000_workspace_documents_bucket.sql`          |
