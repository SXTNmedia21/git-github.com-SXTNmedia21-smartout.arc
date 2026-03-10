---
title: "Journey Portal Hardening Implementation Plan"
status: done
updated: 2026-03-07
created: 2026-03-01
module: journey
tags: [journey, security, hardening, ui, archived]
---

# Journey Portal Hardening — Implementation Plan

> Closed on 2026-03-07.
>
> Audit outcome:
>
> - Track A (Server-Side Status Transitions): Implemented via `/transition` route.
> - Track B (Code Generation Race Condition + Auth Dedup): Implemented (retry logic added, `requireGodmode` deduplicated).
> - Track C (UX Hardening): Implemented (confirm dialogs for status/wizard, markdown rendering).
>   Effectively, this plan is fully represented in the active codebase.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix bugs, close security gaps, and add missing UX guardrails in the Journey Portal (platform-admin).

**Architecture:** Three parallel tracks targeting different layers — API (server-side validation + auth), database (race condition), and UI (confirmation dialogs + markdown rendering). No schema changes needed. All work is within `apps/web/` except one shared helper.

**Tech Stack:** Next.js 16 App Router, Supabase client/admin, Zod, shadcn/ui, react-markdown, sonner toasts.

**Relevant ADRs:** ADR-0031 (Journey Portal System), ADR-0038 (Journey Agent & Output Generators)

**Parallel Execution:** 3 tracks with no cross-dependencies until final verification.

---

## Track A: Server-Side Status Transitions (Security + Bug Fix)

The status transition state machine is currently only enforced in the browser (`journey-status-changer.tsx` calls Supabase directly). A godmode user or crafted request can set any status, bypassing `TRANSITIONS`. This track creates a proper API route and refactors the client component to use it.

### Task A1: Create the status transition API route

**Files:**

- Create: `apps/web/src/app/api/platform-admin/journeys/[id]/transition/route.ts`

**Step 1: Create the API route with full server-side validation**

```typescript
// ============================================
// route.ts — Journey Status Transition
// POST: Validates the status transition against the state machine,
// updates the journey, and logs the event. Replaces direct
// client-side Supabase writes.
// Connected to: apps/web/src/lib/journey/status-transitions.ts (isValidTransition)
// Connected to: apps/web/src/lib/platform-admin.ts (getSuperAdminId)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { isValidTransition } from "@/lib/journey/status-transitions";
import type { JourneyStatus } from "@smartout/types";

const TransitionSchema = z.object({
  newStatus: z.string().min(1),
});

type Props = { params: Promise<{ id: string }> };

/**
 * POST /api/platform-admin/journeys/[id]/transition
 *
 * Performs a validated status transition on a journey.
 * Server-side enforcement of the state machine prevents
 * invalid transitions that the client UI might miss.
 *
 * @param request - POST body with { newStatus: JourneyStatus }
 * @param params - Route params with journey ID
 * @returns Updated journey status or validation error
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;

  // Auth: godmode only
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Parse request
  let body: z.infer<typeof TransitionSchema>;
  try {
    body = TransitionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Load current journey to verify current status
  const { data: journey, error: fetchError } = await admin
    .from("journey")
    .select("journey_id, workspace_id, status")
    .eq("journey_id", id)
    .single();

  if (fetchError || !journey) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  const currentStatus = journey.status as JourneyStatus;
  const newStatus = body.newStatus as JourneyStatus;

  // Validate transition against state machine
  if (!isValidTransition(currentStatus, newStatus)) {
    return NextResponse.json(
      {
        error: `Invalid transition: ${currentStatus} → ${newStatus}`,
        validTransitions: (await import("@/lib/journey/status-transitions")).getValidTransitions(
          currentStatus,
        ),
      },
      { status: 422 },
    );
  }

  // Update journey status
  const { error: updateError } = await admin
    .from("journey")
    .update({ status: newStatus })
    .eq("journey_id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log status change event
  await admin.from("journey_event").insert({
    journey_id: id,
    workspace_id: journey.workspace_id,
    event_type: "status_change" as never,
    from_status: currentStatus as never,
    to_status: newStatus as never,
    actor_id: adminId,
  });

  return NextResponse.json({
    journey_id: id,
    from_status: currentStatus,
    to_status: newStatus,
  });
}
```

**Step 2: Verify the file was created correctly**

Run: `ls -la apps/web/src/app/api/platform-admin/journeys/\[id\]/transition/route.ts`
Expected: File exists

**Step 3: Commit**

```bash
git add apps/web/src/app/api/platform-admin/journeys/\[id\]/transition/route.ts
git commit -m "feat(journey): add server-side status transition API route

Validates transitions against the state machine before updating.
Prevents invalid state changes that bypass the client-side UI.
Logs events with the authenticated user's ID."
```

---

### Task A2: Refactor JourneyStatusChanger to use the API route

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx`

**Step 1: Replace direct Supabase calls with fetch to the new API route**

Replace the `handleTransition` function body (lines 97-138). The key changes:

- Remove `createClient` import and direct Supabase usage
- Call `POST /api/platform-admin/journeys/[id]/transition` instead
- Handle 422 (invalid transition) specifically

```typescript
// Remove this import:
// import { createClient } from "@smartout/supabase/client";

// Replace handleTransition (lines 97-138) with:
async function handleTransition(newStatus: JourneyStatus) {
  setLoading(true);

  try {
    const res = await fetch(`/api/platform-admin/journeys/${journeyId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newStatus }),
    });

    if (!res.ok) {
      const data = await res.json();
      if (res.status === 422) {
        toast.error("Invalid transition", { description: data.error });
      } else {
        toast.error("Failed to update status", { description: data.error });
      }
      return;
    }

    const data = await res.json();
    const targetMeta = STATUS_META[newStatus];
    toast.success(`Status changed to ${targetMeta.label}`);
    onStatusChanged(journeyId, newStatus);
    setOpen(false);
  } catch {
    toast.error("Network error");
  } finally {
    setLoading(false);
  }
}
```

Also remove the `workspaceId` prop since the API route handles workspace lookup:

- Remove `workspaceId` from `JourneyStatusChangerProps` type
- Remove `workspaceId` from the destructured props

**Step 2: Update all usages that pass workspaceId**

In `journey-list-client.tsx` line 426, remove `workspaceId={journey.workspace_id}`:

```tsx
<JourneyStatusChanger
  journeyId={journey.journey_id}
  currentStatus={journey.status}
  onStatusChanged={handleStatusChange}
/>
```

In `journey-detail-client.tsx` line 317, remove `workspaceId={journey.workspace_id}`:

```tsx
<JourneyStatusChanger
  journeyId={journey.journey_id}
  currentStatus={journey.status}
  onStatusChanged={handleStatusChange}
/>
```

**Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to journey-status-changer

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx
git add apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx
git add apps/web/src/app/platform-admin/journeys/\[id\]/_components/journey-detail-client.tsx
git commit -m "refactor(journey): use API route for status transitions

Replaces direct Supabase client writes with server-validated
API call. State machine is now enforced server-side.
Removes workspaceId prop — API route reads it from the DB."
```

---

## Track B: Code Generation Race Condition + Auth Dedup

### Task B1: Fix journey code race condition in wizard complete

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/complete/route.ts`

**Step 1: Replace SELECT-then-INSERT with a retry loop using the UNIQUE constraint**

The current approach reads the highest code, increments, and inserts. Two concurrent requests can get the same code. Fix: attempt insert, catch unique violation, retry with next code.

Replace lines 69-113 (from "Generate next journey code" through the journey insert) with:

```typescript
// Generate journey code with retry — handles concurrent completions
// The UNIQUE constraint on (workspace_id, code) prevents duplicates.
// On conflict, we increment and retry.
const slug = String(draft.title)
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, "")
  .replace(/\s+/g, "-")
  .replace(/-+/g, "-")
  .trim();

let journey: Record<string, unknown> | null = null;
let nextCode = "";
const maxRetries = 3;

for (let attempt = 0; attempt < maxRetries; attempt++) {
  // Find current highest code number (cast to integer for proper ordering)
  const { data: lastJourney } = await admin
    .from("journey")
    .select("code")
    .eq("workspace_id", session.workspace_id)
    .order("code", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastNum = lastJourney ? parseInt(lastJourney.code.replace("J-", ""), 10) : 0;
  nextCode = `J-${String(lastNum + 1 + attempt).padStart(3, "0")}`;

  const { data, error: insertError } = await admin
    .from("journey")
    .insert({
      workspace_id: session.workspace_id,
      code: nextCode,
      title: String(draft.title),
      slug: `${slug}-${nextCode.toLowerCase()}`,
      module: String(draft.module) as never,
      actor: String(draft.actor) as never,
      platform: String(draft.platform ?? "both") as never,
      priority: String(draft.priority ?? "P1") as never,
      status: "defined" as never,
      tags: (draft.tags as string[]) ?? [],
      trigger_description: draft.trigger_description ? String(draft.trigger_description) : null,
      preconditions: (draft.preconditions as string[]) ?? [],
      test_assertion: draft.test_assertion ? String(draft.test_assertion) : null,
      doc_title: draft.doc_title ? String(draft.doc_title) : null,
      outcomes_success: draft.outcomes_success ? String(draft.outcomes_success) : null,
      outcomes_empty: draft.outcomes_empty ? String(draft.outcomes_empty) : null,
      outcomes_error: draft.outcomes_error ? String(draft.outcomes_error) : null,
      created_by: user.id,
    })
    .select()
    .single();

  if (!insertError && data) {
    journey = data as Record<string, unknown>;
    break;
  }

  // If error is a unique violation on code, retry with next number
  if (insertError?.code === "23505" && insertError.message.includes("code")) {
    continue;
  }

  // Any other error — bail out
  return NextResponse.json(
    { error: insertError?.message ?? "Failed to create journey" },
    { status: 500 },
  );
}

if (!journey) {
  return NextResponse.json(
    { error: "Failed to generate unique journey code after retries" },
    { status: 500 },
  );
}
```

Also update the references below this block:

- `journey.journey_id` → `journey.journey_id as string`
- `journey.workspace_id` → `session.workspace_id` (already available)
- `journey.title` → `String(draft.title)`

And fix the slug uniqueness: appending the code to the slug prevents slug conflicts too.

Also replace `.single()` with `.maybeSingle()` on line 76 (the lastJourney query) to avoid errors when there are 0 journeys.

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep "complete/route"`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/app/api/platform-admin/journeys/wizard/\[sessionId\]/complete/route.ts
git commit -m "fix(journey): handle race condition in journey code generation

Uses retry loop with UNIQUE constraint catch instead of
SELECT-then-INSERT. Appends code to slug for slug uniqueness.
Uses maybeSingle() for zero-journey case."
```

---

### Task B2: Deduplicate godmode auth checks across journey API routes

**Files:**

- Modify: `apps/web/src/app/api/journey-agent/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/journeys/wizard/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/complete/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/journeys/[id]/generate/route.ts`

**Step 1: Replace inline auth checks with `getSuperAdminId()`**

In each file, replace the 10-line inline auth pattern:

```typescript
// BEFORE (10 lines, duplicated 5 times):
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const admin = createAdminClient();
const { data: identity } = await admin
  .from("user_identity")
  .select("is_godmode")
  .eq("user_id", user.id)
  .single();
if (!identity?.is_godmode) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

```typescript
// AFTER (2 lines, using existing helper):
import { getSuperAdminId } from "@/lib/platform-admin";

const adminId = await getSuperAdminId();
if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

For `journey-agent/route.ts` specifically, `user.id` is used later for session context. Since `getSuperAdminId()` returns the user ID, use that:

```typescript
const adminId = await getSuperAdminId();
if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

// adminId IS user.id — use it where user.id was used before
```

Remove the now-unused `createClient` import from each file (keep `createAdminClient` where still needed).

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/app/api/journey-agent/route.ts
git add apps/web/src/app/api/platform-admin/journeys/wizard/route.ts
git add apps/web/src/app/api/platform-admin/journeys/wizard/\[sessionId\]/route.ts
git add apps/web/src/app/api/platform-admin/journeys/wizard/\[sessionId\]/complete/route.ts
git add apps/web/src/app/api/platform-admin/journeys/\[id\]/generate/route.ts
git commit -m "refactor(journey): use getSuperAdminId() for auth in all API routes

Replaces 5 copies of inline godmode check with the shared
helper from lib/platform-admin.ts. Matches the pattern used
by keys, workspaces, and other platform-admin routes."
```

---

## Track C: UX Hardening

### Task C1: Add confirmation dialog to status transitions

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx`

**Step 1: Add an AlertDialog confirmation before executing a transition**

Import AlertDialog from shadcn/ui and wrap the transition action:

```typescript
// Add import:
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
```

Add state for the pending transition:

```typescript
const [pendingTransition, setPendingTransition] = useState<JourneyStatus | null>(null);
```

Change the popover buttons to set pendingTransition instead of calling handleTransition directly:

```typescript
// In the popover button onClick:
onClick={() => {
  setPendingTransition(target);
  setOpen(false);
}}
```

Add the AlertDialog after the Popover in the JSX return:

```tsx
<AlertDialog
  open={pendingTransition !== null}
  onOpenChange={(open) => {
    if (!open) setPendingTransition(null);
  }}
>
  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
    <AlertDialogHeader>
      <AlertDialogTitle>Change journey status?</AlertDialogTitle>
      <AlertDialogDescription>
        Move from <span className="font-semibold">{currentMeta.label}</span> to{" "}
        <span className="font-semibold">
          {pendingTransition ? STATUS_META[pendingTransition].label : ""}
        </span>
        . This will be logged in the event trail.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => {
          if (pendingTransition) handleTransition(pendingTransition);
          setPendingTransition(null);
        }}
      >
        Confirm
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 2: Ensure AlertDialog component is installed**

Run: `ls apps/web/src/components/ui/alert-dialog.tsx`
If missing: `cd apps/web && npx shadcn@latest add alert-dialog`

**Step 3: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx
git commit -m "feat(journey): add confirmation dialog before status transitions

Prevents accidental status changes. Shows from/to status
names and requires explicit confirmation."
```

---

### Task C2: Add confirmation dialog to wizard complete

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-chat.tsx`

**Step 1: Add AlertDialog around the complete button**

Import AlertDialog components and wrap the "Complete Journey" button:

```typescript
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
```

Replace the complete button section (lines 199-204) with:

```tsx
{
  isActive && isReviewPhase && (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isCompleting}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          {isCompleting ? "Creating..." : "Complete Journey"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create journey from draft?</AlertDialogTitle>
          <AlertDialogDescription>
            This will create a new journey with code J-XXX and set its status to
            &quot;Defined&quot;. The wizard session will be marked as completed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleComplete} disabled={isCompleting}>
            {isCompleting ? "Creating..." : "Create Journey"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/wizard/\[sessionId\]/_components/wizard-chat.tsx
git commit -m "feat(journey): add confirmation dialog before wizard completion

Prevents accidental journey creation. Shows clear description
of what will happen before the user commits."
```

---

### Task C3: Render markdown in wizard chat messages

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-chat.tsx`

**Step 1: Install react-markdown**

Run: `pnpm --filter web add react-markdown`

**Step 2: Import and use ReactMarkdown for assistant messages**

Add import:

```typescript
import ReactMarkdown from "react-markdown";
```

Replace the message content rendering (line 246) with conditional markdown:

```tsx
{
  /* Replace this line: */
}
{
  /* <div className="whitespace-pre-wrap text-sm">{msg.content}</div> */
}

{
  /* With: */
}
{
  msg.role === "assistant" ? (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown>{msg.content}</ReactMarkdown>
    </div>
  ) : (
    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
  );
}
```

**Step 3: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/wizard/\[sessionId\]/_components/wizard-chat.tsx
git commit -m "feat(journey): render markdown in wizard assistant messages

AI responses now render bold, lists, code blocks, and other
markdown formatting instead of raw text."
```

---

## Final Verification

### Task V1: Full type check and lint

**Step 1: Run typecheck across the workspace**

Run: `pnpm typecheck`
Expected: All packages pass

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No new errors

**Step 3: Verify the app builds**

Run: `pnpm --filter web build 2>&1 | tail -20`
Expected: Build succeeds

---

## Dependency Graph

```
Track A (Status API)         Track B (Code + Auth)       Track C (UX)
  A1: Create API route        B1: Fix race condition      C1: Status confirm dialog
       ↓                      B2: Auth dedup              C2: Wizard confirm dialog
  A2: Refactor client                                     C3: Markdown rendering
       ↓                           ↓                           ↓
       └───────────────────────────┴───────────────────────────┘
                                   ↓
                            V1: Verification
```

Tracks A, B, and C are fully independent and can run in parallel.
V1 runs after all three tracks complete.

---

## Out of Scope (Future)

These were identified but are NOT part of this plan:

- Journey editing (add/edit steps, title, tags) — needs design discussion
- Pagination on journey list and event log — needs UX decision on page size
- Wizard session message cap / archival — needs data retention policy
- Delete/archive journeys — needs business rules
- Responsive table on mobile — needs design spec
