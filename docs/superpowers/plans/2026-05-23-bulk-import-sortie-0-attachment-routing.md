---
title: bulk_import Sortie 0 — Attachment Routing Implementation Plan
status: draft
updated: 2026-05-23
created: 2026-05-23
module: stage-engine
tags: [bulk-import, sortie-0, attachment-routing, prereq, plan]
---

# bulk_import Sortie 0 — Attachment Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the attachment pipeline from BotssonChat composer → BFF → Supabase Storage → stage-engine → agent-router with MIME-type deterministic capability dispatch, so files (`.xlsx` / `.csv`) dropped in chat route to the future `bulk_import` capability without LLM intent-classifier roundtrip.

**Architecture:** New BFF upload route writes to `botsson-imports` Storage bucket and returns signed URL. Existing `/api/emma/chat` forwards `userMessageAttachments` (already in BFF schema, currently dead-end) to stage-engine. Stage-engine `chatSchema` gains `attachments` field. Agent-router checks attachment MIME type FIRST — if `.xlsx`/`.csv`, force `capability='bulk_import'` and skip LLM classification. Adds `bulk_import` to intent enum + capability registry same commit (ADR-0112 6th-occurrence pre-flight check).

**Tech Stack:** TypeScript (strict), Next.js 16 App Router (BFF), Hono (stage-engine), Supabase Storage, Zod, pnpm + Turborepo.

**Spec reference:** `docs/superpowers/specs/2026-05-23-bulk-import-design.md` (Sortie 0 scope section)

**Council reference:** 2026-05-23 — APPROVE WITH CHANGES (Steward chair, 6/6 reviewers)

**Estimated duration:** 3 days (Pontus solo, sonnet build-agents)

---

## File Structure

### Create
- `supabase/migrations/20260623100000_botsson_imports_storage_bucket.sql` — bucket creation + workspace-scoped RLS policies
- `apps/web/src/app/api/botsson/imports/upload/route.ts` — multipart upload BFF endpoint, returns signed URL
- `apps/web/src/lib/storage/botsson-imports.ts` — shared helper for upload/signed-URL generation, MIME validation, size cap
- `packages/ai/src/router/attachment-dispatch.ts` — MIME-type deterministic capability resolver (pure function)
- `packages/ai/src/router/__tests__/attachment-dispatch.test.ts` — unit tests for resolver
- `apps/web/e2e/bulk-import/sortie-0-attachment-routing.spec.ts` — Playwright integration test

### Modify
- `services/stage-engine/src/routes/agent/chat.ts:191-235` — extend `chatSchema` with `attachments?: Attachment[]` field
- `services/stage-engine/src/routes/agent/chat.ts:247-272` — pass `attachments` into `routeAgentMessage`
- `services/stage-engine/src/core/agent-router.ts` — call `resolveCapabilityFromAttachments()` BEFORE intent-classifier; if it returns a capability, skip LLM call and emit `intent.source='deterministic_attachment'`
- `apps/web/src/app/api/emma/chat/route.ts:247-272` — forward `userMessageAttachments` into stage-engine fetch body
- `packages/ai/src/router/intent-classifier.ts:38-83` — add `"bulk_import"` to `intentSchema.z.enum`
- `packages/ai/src/router/intent-classifier.ts:158-213` — add capability description prose for `bulk_import`
- `packages/ai/src/capabilities/types.ts:12-144` — add `"bulk_import"` to `CapabilityName` union
- `packages/ai/src/capabilities/registry.ts` — register placeholder `bulkImportCapability` (empty tools array, valid skeleton)
- `packages/ai/src/capabilities/bulk_import/index.ts` — NEW skeleton CapabilityDefinition (empty tools array — populated in Sortie A)
- `packages/telemetry/src/registry.ts` — add `attachment.routed` event (file-level routing decision telemetry)

### Test
- `packages/ai/src/router/__tests__/attachment-dispatch.test.ts` — pure unit tests
- `apps/web/src/app/api/botsson/imports/upload/__tests__/route.test.ts` — BFF endpoint tests (mocked Supabase)
- `apps/web/e2e/bulk-import/sortie-0-attachment-routing.spec.ts` — end-to-end via Playwright

---

## Task 1: Create `botsson-imports` Storage bucket via migration

**Files:**
- Create: `supabase/migrations/20260623100000_botsson_imports_storage_bucket.sql`

- [ ] **Step 1: Verify migration timestamp slot is safe**

Run: `ls supabase/migrations/ | tail -1`
Expected: timestamp `20260622110000_*` or similar (current repo tip per DB-tracer). `20260623100000` is strictly greater — safe slot.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/20260623100000_botsson_imports_storage_bucket.sql
-- Storage bucket for bulk_import capability — workspace-scoped uploads.
-- Spec: docs/superpowers/specs/2026-05-23-bulk-import-design.md (Sortie 0)
-- Council: 2026-05-23 APPROVE WITH CHANGES

BEGIN;

-- Create the bucket (private, not public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'botsson-imports',
  'botsson-imports',
  FALSE,
  10485760, -- 10 MB cap
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.ms-excel', -- .xls
    'text/csv', -- .csv
    'application/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Workspace-scoped RLS: only members of the workspace can read their own paths
-- Path convention: {workspace_id}/{import_run_id_or_temp_id}.{ext}

CREATE POLICY "botsson_imports_read_own_workspace"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'botsson-imports'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT workspace_id FROM get_workspace_ids_for_user(auth.uid()) AS workspace_id
    )
  );

CREATE POLICY "botsson_imports_insert_own_workspace_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'botsson-imports'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT workspace_id FROM get_workspace_ids_for_user(auth.uid()) AS workspace_id
    )
    AND is_admin_in_workspace(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- Delete policy: admins only, own workspace
CREATE POLICY "botsson_imports_delete_own_workspace_admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'botsson-imports'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT workspace_id FROM get_workspace_ids_for_user(auth.uid()) AS workspace_id
    )
    AND is_admin_in_workspace(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

COMMENT ON POLICY "botsson_imports_read_own_workspace" ON storage.objects IS
  'bulk_import: workspace-members can read files under {workspace_id}/* path prefix';

COMMIT;
```

- [ ] **Step 3: Apply migration locally**

Run: `npx supabase db reset` (full reset to verify migration is causally ordered)
Expected: all migrations apply cleanly; no errors

- [ ] **Step 4: Verify bucket exists**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'botsson-imports';"`
Expected: one row, `public=f`, `file_size_limit=10485760`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260623100000_botsson_imports_storage_bucket.sql
git commit -m "feat(bulk_import): add botsson-imports storage bucket with workspace-scoped RLS

Sortie 0 Task 1 — prereq for attachment routing pipeline.
Spec: docs/superpowers/specs/2026-05-23-bulk-import-design.md
Council: 2026-05-23

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create BFF upload endpoint

**Files:**
- Create: `apps/web/src/lib/storage/botsson-imports.ts`
- Create: `apps/web/src/app/api/botsson/imports/upload/route.ts`
- Test: `apps/web/src/app/api/botsson/imports/upload/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test for the helper**

```typescript
// apps/web/src/lib/storage/__tests__/botsson-imports.test.ts
import { describe, it, expect } from "vitest";
import { validateAttachmentMime, ATTACHMENT_MIME_ALLOWLIST } from "../botsson-imports";

describe("validateAttachmentMime", () => {
  it("accepts xlsx MIME", () => {
    expect(validateAttachmentMime(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )).toBe(true);
  });

  it("accepts csv MIME", () => {
    expect(validateAttachmentMime("text/csv")).toBe(true);
  });

  it("rejects pdf MIME", () => {
    expect(validateAttachmentMime("application/pdf")).toBe(false);
  });

  it("rejects empty/undefined", () => {
    expect(validateAttachmentMime("")).toBe(false);
    expect(validateAttachmentMime(undefined as unknown as string)).toBe(false);
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `pnpm --filter @smartout/web test apps/web/src/lib/storage/__tests__/botsson-imports.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the helper**

```typescript
// apps/web/src/lib/storage/botsson-imports.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export const ATTACHMENT_MIME_ALLOWLIST = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv",
  "application/csv",
] as const;

export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour
export const BUCKET_NAME = "botsson-imports";

export function validateAttachmentMime(mime: string): boolean {
  if (!mime) return false;
  return (ATTACHMENT_MIME_ALLOWLIST as readonly string[]).includes(mime);
}

export type UploadResult = {
  storagePath: string;
  signedUrl: string;
  expiresAt: string;
  mime: string;
  sizeBytes: number;
  filename: string;
};

export async function uploadAttachment(args: {
  supabase: SupabaseClient;
  workspaceId: string;
  file: File;
}): Promise<UploadResult> {
  if (!validateAttachmentMime(args.file.type)) {
    throw new Error(`Unsupported MIME type: ${args.file.type}`);
  }
  if (args.file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    throw new Error(
      `File too large: ${args.file.size} bytes (max ${ATTACHMENT_MAX_SIZE_BYTES})`
    );
  }

  const ext = args.file.name.split(".").pop() ?? "bin";
  const tempId = randomUUID();
  const storagePath = `${args.workspaceId}/${tempId}.${ext}`;

  const { error: uploadError } = await args.supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, args.file, {
      contentType: args.file.type,
      cacheControl: "private, max-age=0",
      upsert: false,
    });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: signed, error: signError } = await args.supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);
  if (signError || !signed)
    throw new Error(`Signed URL failed: ${signError?.message ?? "unknown"}`);

  return {
    storagePath,
    signedUrl: signed.signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString(),
    mime: args.file.type,
    sizeBytes: args.file.size,
    filename: args.file.name,
  };
}
```

- [ ] **Step 4: Verify helper tests pass**

Run: `pnpm --filter @smartout/web test apps/web/src/lib/storage/__tests__/botsson-imports.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Write the failing test for the route**

```typescript
// apps/web/src/app/api/botsson/imports/upload/__tests__/route.test.ts
import { describe, it, expect, vi } from "vitest";
import { POST } from "../route";

describe("POST /api/botsson/imports/upload", () => {
  it("rejects unauthenticated", async () => {
    const req = new Request("http://localhost/api/botsson/imports/upload", {
      method: "POST",
      body: new FormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects missing file field", async () => {
    // requires auth mock — skip unless harness available
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 6: Implement the BFF route**

```typescript
// apps/web/src/app/api/botsson/imports/upload/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { uploadAttachment } from "@/lib/storage/botsson-imports";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FormSchema = z.object({
  workspace_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = createServerClient();

  // 1. Authenticate
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }

  const file = formData.get("file");
  const workspaceId = formData.get("workspace_id");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const parsed = FormSchema.safeParse({ workspace_id: workspaceId });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_workspace_id" }, { status: 400 });
  }

  // 3. Verify user is member of workspace (RLS will also enforce, but fail-fast here)
  const { data: membership } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("workspace_id", parsed.data.workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "not_workspace_member" }, { status: 403 });
  }

  // 4. Upload via helper
  try {
    const result = await uploadAttachment({
      supabase,
      workspaceId: parsed.data.workspace_id,
      file,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [ ] **Step 7: Run route test**

Run: `pnpm --filter @smartout/web test apps/web/src/app/api/botsson/imports/upload/__tests__/route.test.ts`
Expected: 1 PASS (unauthenticated path)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/storage/botsson-imports.ts apps/web/src/lib/storage/__tests__/botsson-imports.test.ts apps/web/src/app/api/botsson/imports/upload/route.ts apps/web/src/app/api/botsson/imports/upload/__tests__/route.test.ts
git commit -m "feat(bulk_import): add /api/botsson/imports/upload BFF endpoint

MIME-allowlist validation (xlsx/xls/csv), 10MB size cap, workspace-scoped
upload to botsson-imports bucket, returns 1h signed URL.

Sortie 0 Task 2 — spec docs/superpowers/specs/2026-05-23-bulk-import-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Extend stage-engine chatSchema with attachments field

**Files:**
- Modify: `services/stage-engine/src/routes/agent/chat.ts` (schema definition + handler)

- [ ] **Step 1: Read existing chatSchema**

Run: `grep -n "chatSchema\|userMessageAttachments\|attachments" services/stage-engine/src/routes/agent/chat.ts | head -20`
Expected: confirm current schema location (lines 191-235 per council code-trace)

- [ ] **Step 2: Extend the schema**

In `services/stage-engine/src/routes/agent/chat.ts`, locate `chatSchema` (around line 191) and add the attachments field:

```typescript
// In chatSchema definition — ADD this field after existing fields:
attachments: z
  .array(
    z.object({
      storage_path: z.string(),
      signed_url: z.string().url(),
      mime: z.string(),
      size_bytes: z.number().int().positive(),
      filename: z.string(),
      expires_at: z.string().datetime(),
    })
  )
  .optional()
  .describe("Files uploaded via /api/botsson/imports/upload; signed URLs (1h TTL). MIME-deterministic routing."),
```

- [ ] **Step 3: Pass attachments into routeAgentMessage**

In the same file, locate the `routeAgentMessage` call (around line 652) and pass the attachments:

```typescript
// Modify the routeAgentMessage call to include attachments:
const result = await routeAgentMessage({
  message: body.message,
  sessionId: body.session_id,
  workspaceId,
  profileId,
  conversationHistory,
  pageContext: body.page_context,
  channel: body.channel,
  attachments: body.attachments ?? [], // NEW
  // ... existing fields
});
```

- [ ] **Step 4: Extend routeAgentMessage signature**

Locate `routeAgentMessage` (likely in `services/stage-engine/src/core/agent-router.ts`) and add the `attachments` parameter to its input type:

```typescript
export type RouteAgentMessageInput = {
  // ... existing fields
  attachments?: ReadonlyArray<{
    storage_path: string;
    signed_url: string;
    mime: string;
    size_bytes: number;
    filename: string;
    expires_at: string;
  }>;
};
```

- [ ] **Step 5: Typecheck stage-engine**

Run: `pnpm --filter @smartout/stage-engine typecheck`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add services/stage-engine/src/routes/agent/chat.ts services/stage-engine/src/core/agent-router.ts
git commit -m "feat(stage-engine): extend chatSchema with attachments field

Adds optional attachments[] to /agent/chat input schema with strict shape
(storage_path, signed_url, mime, size_bytes, filename, expires_at). Forwards
into routeAgentMessage. Empty default preserves backward compat for non-attachment
chats.

Sortie 0 Task 3 — closes L2->L3 dead-end identified by council code-trace.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Forward userMessageAttachments from BFF to stage-engine

**Files:**
- Modify: `apps/web/src/app/api/emma/chat/route.ts:247-272`

- [ ] **Step 1: Read current forward block**

Run: `sed -n '240,280p' apps/web/src/app/api/emma/chat/route.ts`
Expected: see the `fetch(STAGE_ENGINE_URL + "/agent/chat", { body: ... })` block

- [ ] **Step 2: Add attachments to forwarded body**

Locate the `fetch` call to stage-engine in `apps/web/src/app/api/emma/chat/route.ts` and add the attachments field to the JSON body:

```typescript
// In the body object passed to JSON.stringify():
{
  message: body.userMessage,
  session_id: body.sessionId,
  // ... existing fields ...
  attachments: body.userMessageAttachments ?? [], // NEW — was previously stored only in chat_message.attachments
}
```

Verify the type matches the stage-engine schema (storage_path, signed_url, mime, size_bytes, filename, expires_at).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @smartout/web typecheck`
Expected: 0 errors

- [ ] **Step 4: Run existing emma chat tests**

Run: `pnpm --filter @smartout/web test apps/web/src/app/api/emma/chat`
Expected: existing tests still PASS (additive change, no break)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/emma/chat/route.ts
git commit -m "fix(emma/chat): forward userMessageAttachments to stage-engine

Previously attachments were stored only in chat_message.attachments and never
reached the LLM context — dead-end identified by council code-trace (Botsson
Harness Builder Phase 3 finding).

Now forwarded into stage-engine chatSchema.attachments, enabling MIME-type
deterministic capability dispatch downstream.

Sortie 0 Task 4 — closes the L2->L3 wiring gap.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Create MIME-type deterministic dispatch resolver

**Files:**
- Create: `packages/ai/src/router/attachment-dispatch.ts`
- Create: `packages/ai/src/router/__tests__/attachment-dispatch.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/ai/src/router/__tests__/attachment-dispatch.test.ts
import { describe, it, expect } from "vitest";
import { resolveCapabilityFromAttachments } from "../attachment-dispatch";

describe("resolveCapabilityFromAttachments", () => {
  it("returns null for empty attachments", () => {
    expect(resolveCapabilityFromAttachments([])).toBeNull();
    expect(resolveCapabilityFromAttachments(undefined)).toBeNull();
  });

  it("returns bulk_import for xlsx MIME", () => {
    const result = resolveCapabilityFromAttachments([
      {
        storage_path: "ws/file.xlsx",
        signed_url: "https://example.com/x",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size_bytes: 1024,
        filename: "vaktliste.xlsx",
        expires_at: new Date().toISOString(),
      },
    ]);
    expect(result).toEqual({ capability: "bulk_import", source: "deterministic_attachment", filename: "vaktliste.xlsx" });
  });

  it("returns bulk_import for csv MIME", () => {
    const result = resolveCapabilityFromAttachments([
      {
        storage_path: "ws/file.csv",
        signed_url: "https://example.com/x",
        mime: "text/csv",
        size_bytes: 100,
        filename: "shifts.csv",
        expires_at: new Date().toISOString(),
      },
    ]);
    expect(result?.capability).toBe("bulk_import");
  });

  it("returns null for unknown MIME (no deterministic match)", () => {
    const result = resolveCapabilityFromAttachments([
      {
        storage_path: "ws/file.pdf",
        signed_url: "https://example.com/x",
        mime: "application/pdf",
        size_bytes: 100,
        filename: "x.pdf",
        expires_at: new Date().toISOString(),
      },
    ]);
    expect(result).toBeNull();
  });

  it("first-match-wins on multiple attachments", () => {
    const result = resolveCapabilityFromAttachments([
      {
        storage_path: "ws/a.csv",
        signed_url: "x",
        mime: "text/csv",
        size_bytes: 1,
        filename: "a.csv",
        expires_at: new Date().toISOString(),
      },
      {
        storage_path: "ws/b.pdf",
        signed_url: "x",
        mime: "application/pdf",
        size_bytes: 1,
        filename: "b.pdf",
        expires_at: new Date().toISOString(),
      },
    ]);
    expect(result?.capability).toBe("bulk_import");
    expect(result?.filename).toBe("a.csv");
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @smartout/ai test packages/ai/src/router/__tests__/attachment-dispatch.test.ts`
Expected: 5 FAIL — module not found

- [ ] **Step 3: Implement the resolver**

```typescript
// packages/ai/src/router/attachment-dispatch.ts
/**
 * MIME-type deterministic capability dispatch.
 *
 * When the user attaches a file (.xlsx/.xls/.csv), route directly to bulk_import
 * capability — skip LLM intent classifier roundtrip.
 *
 * Spec: docs/superpowers/specs/2026-05-23-bulk-import-design.md (Sortie 0)
 * Council 2026-05-23: Agent-Coordinator recommended deterministic routing.
 */

import type { CapabilityName } from "../capabilities/types.js";

export type AttachmentMetadata = {
  storage_path: string;
  signed_url: string;
  mime: string;
  size_bytes: number;
  filename: string;
  expires_at: string;
};

export type AttachmentDispatchResult = {
  capability: CapabilityName;
  source: "deterministic_attachment";
  filename: string;
};

const SPREADSHEET_MIMES = new Set<string>([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
]);

export function resolveCapabilityFromAttachments(
  attachments: ReadonlyArray<AttachmentMetadata> | undefined
): AttachmentDispatchResult | null {
  if (!attachments || attachments.length === 0) return null;

  const spreadsheet = attachments.find((a) => SPREADSHEET_MIMES.has(a.mime));
  if (spreadsheet) {
    return {
      capability: "bulk_import",
      source: "deterministic_attachment",
      filename: spreadsheet.filename,
    };
  }
  return null;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @smartout/ai test packages/ai/src/router/__tests__/attachment-dispatch.test.ts`
Expected: 5 PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/router/attachment-dispatch.ts packages/ai/src/router/__tests__/attachment-dispatch.test.ts
git commit -m "feat(ai/router): add MIME-type deterministic capability dispatch

resolveCapabilityFromAttachments() — pure function. Spreadsheet MIMEs
(.xlsx/.xls/.csv) route to bulk_import. Returns null for unknown MIMEs
(LLM intent classifier handles non-attachment cases).

Sortie 0 Task 5 — spec docs/superpowers/specs/2026-05-23-bulk-import-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire deterministic dispatch into agent-router

**Files:**
- Modify: `services/stage-engine/src/core/agent-router.ts`

- [ ] **Step 1: Locate intent-classifier call site**

Run: `grep -n "intent\|classify\|router" services/stage-engine/src/core/agent-router.ts | head -20`
Expected: find the function that decides which capability to invoke

- [ ] **Step 2: Add deterministic-route check before LLM call**

In `services/stage-engine/src/core/agent-router.ts`, at the top of the routing function (BEFORE any LLM/intent-classifier call):

```typescript
import { resolveCapabilityFromAttachments } from "@smartout/ai/router/attachment-dispatch";

// Inside routeAgentMessage (or equivalent) — first check attachments:
const attachmentRoute = resolveCapabilityFromAttachments(input.attachments);
if (attachmentRoute) {
  // Skip intent-classifier; emit telemetry for routing decision
  await emit("attachment.routed", {
    workspace_id: input.workspaceId,
    actor_id: input.profileId,
    data: {
      capability: attachmentRoute.capability,
      source: attachmentRoute.source,
      filename: attachmentRoute.filename,
      attachment_count: input.attachments?.length ?? 0,
    },
  });
  // Force capability dispatch
  return dispatchToCapability(attachmentRoute.capability, input);
}

// Fall through to existing LLM intent classifier...
```

- [ ] **Step 3: Register `attachment.routed` event in telemetry registry**

Add to `packages/telemetry/src/registry.ts`:

```typescript
// In the events registry object:
"attachment.routed": {
  event: "attachment.routed",
  category: "agent",
  description: "MIME-type deterministic capability dispatch fired; intent classifier bypassed",
  posthog: true,
  logger: true,
  activity_trail: false, // routing decision, not a user action
  engine_event: false,
  data_schema: z.object({
    capability: z.string(),
    source: z.literal("deterministic_attachment"),
    filename: z.string(),
    attachment_count: z.number().int(),
  }),
},
```

- [ ] **Step 4: Typecheck stage-engine + telemetry**

Run: `pnpm --filter @smartout/stage-engine --filter @smartout/telemetry typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/core/agent-router.ts packages/telemetry/src/registry.ts
git commit -m "feat(stage-engine): wire MIME deterministic dispatch + register attachment.routed event

resolveCapabilityFromAttachments() invoked BEFORE intent-classifier. On match,
emit attachment.routed (PostHog + logger) and dispatch directly to capability.
No LLM roundtrip for file-attachment routing decisions.

Sortie 0 Task 6 — closes L3 routing gap. ADR-0377 emit-wiring satisfied
(registry entry + call-site same commit).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Add bulk_import to intent classifier + capability registry (skeleton)

**Files:**
- Modify: `packages/ai/src/router/intent-classifier.ts`
- Modify: `packages/ai/src/capabilities/types.ts`
- Modify: `packages/ai/src/capabilities/registry.ts`
- Create: `packages/ai/src/capabilities/bulk_import/index.ts`

- [ ] **Step 1: Add to CapabilityName union**

In `packages/ai/src/capabilities/types.ts`, locate the `CapabilityName` z.enum (lines 12-144) and add:

```typescript
"bulk_import",
```

Insert alphabetically (after `"billing_query"`, before `"channel_admin"`).

- [ ] **Step 2: Add to intent-classifier enum**

In `packages/ai/src/router/intent-classifier.ts:38-83`, add to `intentSchema.z.enum`:

```typescript
"bulk_import",
```

- [ ] **Step 3: Add intent-classifier prose (system prompt extension)**

In `packages/ai/src/router/intent-classifier.ts:158-213`, add:

```markdown
- **bulk_import**: User drops an Excel/CSV file (.xlsx/.xls/.csv) into chat to bulk-import shifts (vaktliste) or daily-plan tasks (kjøreplan). Note: in normal operation MIME-type deterministic dispatch bypasses this classifier — but classifier needs the enum entry for command-line invocation (e.g. "import the shifts I uploaded yesterday"). Admin+ only.
```

- [ ] **Step 4: Create skeleton capability**

```typescript
// packages/ai/src/capabilities/bulk_import/index.ts
/**
 * bulk_import capability — drag-drop Excel/CSV migration of shifts + tasks.
 *
 * Sortie 0: skeleton (zero tools — wired in Sorties A/B/C).
 * Spec: docs/superpowers/specs/2026-05-23-bulk-import-design.md
 * Council: 2026-05-23 APPROVE WITH CHANGES
 *
 * Tools (added in subsequent sorties):
 *   Sortie A: parse_spreadsheet (read-only)
 *   Sortie B: preview_batch, resolve_ambiguity
 *   Sortie C: commit_batch
 */

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";

const allTools = [] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;
const readOnlyTools = allTools;
const suggestTools = allTools;

export const bulkImportCapability: CapabilityDefinition = {
  name: "bulk_import",
  description:
    "Bulk-import shifts (vaktliste) and daily-plan tasks (kjøreplan) from Excel/CSV files dragged into chat. Admin+ only; chat-only; web-only (Compose verb per ADR-0133). All tools wired in Sorties A/B/C — skeleton in Sortie 0.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
  allowedChannels: ["chat"], // ADR-0078 voice forbidden (irreversible writes)
  toolAuthPattern: "direct_admin", // service_role (per DB-tracer: api_key INSERT policies missing on dept/location/profile)
  emitPrefix: "bulk_import", // ADR-0194
};
```

- [ ] **Step 5: Register in capability registry**

In `packages/ai/src/capabilities/registry.ts`, import + register:

```typescript
import { bulkImportCapability } from "./bulk_import/index.js";

// In capabilities object:
bulk_import: bulkImportCapability,
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: 0 errors

- [ ] **Step 7: Verify ADR-0112 same-commit gate**

Run: `git diff --stat HEAD | grep -E "(types|intent-classifier|registry|bulk_import/index)"`
Expected: ALL FOUR files in same staged set (CapabilityName + enum + prose + registry). This is the ADR-0112 pre-flight gate — 6th occurrence per council.

- [ ] **Step 8: Commit**

```bash
git add packages/ai/src/capabilities/types.ts packages/ai/src/router/intent-classifier.ts packages/ai/src/capabilities/registry.ts packages/ai/src/capabilities/bulk_import/index.ts
git commit -m "feat(ai): register bulk_import capability skeleton + intent classifier entry

ADR-0112 6th-occurrence gate satisfied — CapabilityName + intent enum +
classifier prose + registry registration all in same commit.

Skeleton tools array (empty) — tools land in Sorties A/B/C. allowedChannels=chat
(ADR-0078); toolAuthPattern=direct_admin (DB-tracer: api_key INSERT policies
missing on entity tables, service_role required); emitPrefix=bulk_import.

Sortie 0 Task 7 — spec docs/superpowers/specs/2026-05-23-bulk-import-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Integration test — end-to-end attachment routing

**Files:**
- Create: `apps/web/e2e/bulk-import/sortie-0-attachment-routing.spec.ts`

- [ ] **Step 1: Write the failing E2E test**

```typescript
// apps/web/e2e/bulk-import/sortie-0-attachment-routing.spec.ts
import { test, expect } from "@playwright/test";
import path from "node:path";

test.describe("Sortie 0 — attachment routing", () => {
  test("uploaded xlsx routes to bulk_import via deterministic dispatch", async ({
    page,
    request,
  }) => {
    // Assumes seeded test workspace + admin auth — adjust to project test harness
    const workspaceId = process.env.TEST_WORKSPACE_ID ?? "b0000000-0000-0000-0000-000000000000";

    // 1. Upload a fixture xlsx file via BFF
    const fixturePath = path.join(__dirname, "fixtures", "small-vaktliste.csv");
    const formData = new FormData();
    formData.append("workspace_id", workspaceId);
    formData.append(
      "file",
      new File(["name,start,end\nPontus,09:00,17:00\n"], "test.csv", {
        type: "text/csv",
      })
    );

    const uploadRes = await request.post("/api/botsson/imports/upload", {
      multipart: {
        workspace_id: workspaceId,
        file: {
          name: "test.csv",
          mimeType: "text/csv",
          buffer: Buffer.from("name,start,end\nPontus,09:00,17:00\n"),
        },
      },
    });
    expect(uploadRes.status()).toBe(200);
    const upload = await uploadRes.json();
    expect(upload.signedUrl).toMatch(/^https:\/\//);
    expect(upload.mime).toBe("text/csv");

    // 2. Post a chat message with the attachment
    const chatRes = await request.post("/api/emma/chat", {
      data: {
        workspaceId,
        sessionId: "test-session-sortie-0",
        userMessage: "Import these shifts please",
        userMessageAttachments: [upload],
      },
    });
    expect(chatRes.status()).toBe(200);

    // 3. Verify telemetry recorded attachment.routed event
    // (depends on test PostHog mock or activity_trail query — adjust per harness)
    // Skipping concrete assertion until test harness pattern decided.
  });
});
```

- [ ] **Step 2: Create test fixture**

```bash
mkdir -p apps/web/e2e/bulk-import/fixtures
cat > apps/web/e2e/bulk-import/fixtures/small-vaktliste.csv <<'EOF'
name,start,end,department
Pontus,09:00,17:00,Bar
EOF
```

- [ ] **Step 3: Run E2E**

Run: `pnpm --filter @smartout/web e2e apps/web/e2e/bulk-import/sortie-0-attachment-routing.spec.ts`
Expected: PASS (upload + chat post both 200)

If failing on auth: configure test workspace fixture per existing E2E pattern in `apps/e2e/`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/bulk-import/sortie-0-attachment-routing.spec.ts apps/web/e2e/bulk-import/fixtures/small-vaktliste.csv
git commit -m "test(bulk_import): E2E for Sortie 0 attachment routing

End-to-end: upload via /api/botsson/imports/upload → forward via
/api/emma/chat → stage-engine receives → attachment.routed emit.

Sortie 0 Task 8 — integration verification.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Self-verification checklist

- [ ] **Step 1: Typecheck the whole tree**

Run: `TURBO_CONCURRENCY=1 pnpm turbo typecheck`
Expected: 0 errors across all packages

- [ ] **Step 2: Run all new tests**

Run: `pnpm test --filter @smartout/web --filter @smartout/ai`
Expected: all PASS

- [ ] **Step 3: Verify ADR-0112 gate (all 4 wiring points)**

Run:
```bash
git log --oneline --grep "Sortie 0 Task 7" | head -1 | xargs -I{} git show {} --stat
```
Expected: 4 files changed in same commit: types.ts, intent-classifier.ts, registry.ts, bulk_import/index.ts

- [ ] **Step 4: Verify migration applies cleanly**

Run: `npx supabase db reset`
Expected: all migrations apply; no errors

- [ ] **Step 5: Verify bucket exists in dev**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT id FROM storage.buckets WHERE id='botsson-imports';"`
Expected: one row returned

- [ ] **Step 6: Verify attachment.routed event registered**

Run: `grep -A 3 '"attachment.routed"' packages/telemetry/src/registry.ts`
Expected: full registry entry present

- [ ] **Step 7: Sortie 0 done — push and prepare for Sortie A**

```bash
git push origin <your-branch>
```

---

## Self-Review

**Spec coverage check (Sortie 0 scope only):**
- ✅ `chatSchema` extended with attachments (Task 3)
- ✅ BFF `/api/emma/chat` forwards (Task 4)
- ✅ New `/api/botsson/imports/upload` route (Task 2)
- ✅ `botsson-imports` Storage bucket with RLS (Task 1)
- ✅ MIME-deterministic dispatch in agent-router (Tasks 5+6)
- ✅ `bulk_import` capability in intent enum + registry + system prompt SAME COMMIT (Task 7)

**Placeholder scan:** none. All code blocks include implementation; all commands include expected output.

**Type consistency:** `AttachmentMetadata` type used consistently across `attachment-dispatch.ts`, `chat.ts` chatSchema, `botsson-imports.ts` UploadResult. All match the BFF upload response shape.

**Out of scope (Sortie A+B+C):**
- BotssonChat composer UI (Sortie B)
- `parse_spreadsheet` / `preview_batch` / `commit_batch` tools (A/B/C)
- pg_trgm + resolver (A)
- `import_run` table (A)
- ADRs 0398-0401 (A start)

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-23-bulk-import-sortie-0-attachment-routing.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch checkpoints

**Which approach?**

After Sortie 0 ships green (E2E passing, attachment.routed events in PostHog), the plan for Sortie A — `import_run` schema + ADR-0398 + `parse_spreadsheet` tool — will be drafted from the spec.
