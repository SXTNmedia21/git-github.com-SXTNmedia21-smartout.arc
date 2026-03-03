---
title: Journey Portal Fixes — Code Review Remediation
status: in_progress
updated: 2026-03-03
created: 2026-03-01
module: meta
tags: [journey, code-review, security, quality]
---

# Journey Portal Fixes — Code Review Remediation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 10 issues found in the journey portal code review — from security-critical client-side mutations to code quality improvements.

**Architecture:** Replace client-side Supabase mutations with server-side API routes. Add a shared `requireGodmode()` helper for all platform-admin routes. Extract duplicated icon maps to a shared file. Add server-side state machine validation and pagination.

**Tech Stack:** Next.js App Router API routes, Supabase admin client, Zod validation, TypeScript strict mode, shadcn/ui components, lucide-react icons.

---

## Deep Dive Findings

Before implementing, these facts from the codebase deep dive inform the plan:

| Finding                                                                                       | Impact                                                                                        |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| RLS on `journey` table has `godmode_journey_all` policy — godmode users CAN write from client | Issue #1 technically works but is a pattern violation                                         |
| `UNIQUE(workspace_id, code)` constraint exists on `journey` table                             | Issue #2 won't create duplicates, but concurrent completions get a 500 error instead of retry |
| `getSuperAdminId()` exists in `apps/web/src/lib/platform-admin.ts` — used by 24 routes        | Journey wizard routes (3 files) use inline checks instead — should standardize                |
| `formatNorwegianDate()` exists in `packages/utils/src/dates.ts`                               | Uses `date-fns` with `nb` locale — can reuse for consistent formatting                        |
| `DraftJourney` type exists in `packages/types/src/journey.ts`                                 | `wizard-draft-preview.tsx` uses `Record<string, unknown>` instead                             |
| `logPlatformAction()` exists in `platform-admin.ts`                                           | Journey status changes and wizard completions don't log to audit trail                        |
| No pagination utility exists anywhere                                                         | Will add pagination to journey list only (not a shared util — YAGNI)                          |

---

## Task 1: Extract `requireGodmode()` API Route Helper

**Why first:** Every subsequent API route task needs this helper. Eliminates the duplicated 10-line auth pattern.

**Files:**

- Modify: `apps/web/src/lib/platform-admin.ts`
- Test: Manual — call from Task 2's API route

**Step 1: Read the existing file**

Read `apps/web/src/lib/platform-admin.ts` to confirm current state.

**Step 2: Add `requireGodmode()` helper**

Add this function to `apps/web/src/lib/platform-admin.ts`:

```typescript
import { NextResponse } from "next/server";

/**
 * Validates that the current request comes from a godmode user.
 * Returns the admin user ID and a pre-configured admin Supabase client,
 * or a NextResponse error if unauthorized.
 *
 * Why: Eliminates the repeated 10-line auth+godmode check pattern
 * across 26+ platform-admin API routes.
 *
 * @returns Either { adminId, admin } on success, or { error } response
 */
export async function requireGodmode(): Promise<
  | { adminId: string; admin: ReturnType<typeof createAdminClient>; error?: never }
  | { error: NextResponse; adminId?: never; admin?: never }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();

  if (!data?.is_godmode) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { adminId: user.id, admin };
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/platform-admin.ts
git commit -m "feat(journey): add requireGodmode() API route helper"
```

---

## Task 2: Create Status Transition API Route

**Why:** Replaces client-side Supabase mutation (Issue #1) and adds server-side state machine validation (Issue #4).

**Files:**

- Create: `apps/web/src/app/api/platform-admin/journeys/[id]/status/route.ts`

**Step 1: Create the API route**

```typescript
// ============================================
// route.ts — Journey Status Transition
// PATCH: Validates and applies a status transition using
// the server-side state machine. Logs event and audit trail.
// Connected to: apps/web/src/lib/journey/status-transitions.ts
// Connected to: apps/web/src/lib/platform-admin.ts (requireGodmode)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { JourneyStatusEnum } from "@smartout/types/enums";
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";
import { isValidTransition } from "@/lib/journey/status-transitions";

const PatchSchema = z.object({
  newStatus: JourneyStatusEnum,
});

/**
 * PATCH /api/platform-admin/journeys/[id]/status
 *
 * Validates the status transition against the state machine,
 * updates the journey, logs the event, and logs the audit trail.
 *
 * Why server-side: Prevents bypassing state machine validation.
 * The client-side status changer now calls this instead of
 * writing to Supabase directly.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId, admin } = result;

  // Parse and validate request body
  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request — newStatus required" }, { status: 400 });
  }

  // Load current journey to get its status
  const { data: journey, error: fetchError } = await admin
    .from("journey")
    .select("journey_id, workspace_id, status, code")
    .eq("journey_id", id)
    .single();

  if (fetchError || !journey) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  // Validate state machine transition
  if (!isValidTransition(journey.status, body.newStatus)) {
    return NextResponse.json(
      {
        error: `Invalid transition: ${journey.status} → ${body.newStatus}`,
        valid_transitions: (await import("@/lib/journey/status-transitions")).getValidTransitions(
          journey.status,
        ),
      },
      { status: 422 },
    );
  }

  // Update journey status
  const { error: updateError } = await admin
    .from("journey")
    .update({ status: body.newStatus })
    .eq("journey_id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log status change event
  const { error: eventError } = await admin.from("journey_event").insert({
    journey_id: id,
    workspace_id: journey.workspace_id,
    event_type: "status_change" as const,
    from_status: journey.status,
    to_status: body.newStatus,
    actor_id: adminId,
  });

  // Log to platform audit trail
  await logPlatformAction(adminId, "journey_status_change", "journey", id, {
    code: journey.code,
    from: journey.status,
    to: body.newStatus,
  });

  return NextResponse.json({
    journey_id: id,
    previous_status: journey.status,
    new_status: body.newStatus,
    event_logged: !eventError,
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/api/platform-admin/journeys/\[id\]/status/route.ts
git commit -m "feat(journey): add server-side status transition API route"
```

---

## Task 3: Update Status Changer to Use API Route

**Why:** Completes the fix for Issue #1 (client-side mutation) and Issue #4 (server-side validation).

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx`

**Step 1: Replace Supabase client with fetch call**

Replace the entire `handleTransition` function body. The key changes:

- Remove `import { createClient } from "@smartout/supabase/client"`
- Replace direct Supabase calls with `fetch("/api/platform-admin/journeys/${journeyId}/status")`
- Handle 422 (invalid transition) separately from 500 (server error)

The new `handleTransition` function:

```typescript
async function handleTransition(newStatus: JourneyStatus) {
  setLoading(true);

  try {
    const response = await fetch(`/api/platform-admin/journeys/${journeyId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newStatus }),
    });

    if (!response.ok) {
      const data = await response.json();
      if (response.status === 422) {
        toast.error("Invalid transition", { description: data.error });
      } else {
        toast.error("Failed to update status", { description: data.error });
      }
      return;
    }

    const targetMeta = STATUS_META[newStatus];
    toast.success(`Status changed to ${targetMeta.label}`);
    onStatusChanged(journeyId, newStatus);
    setOpen(false);
  } catch {
    toast.error("Network error — could not reach the server");
  } finally {
    setLoading(false);
  }
}
```

Also remove the unused `workspaceId` prop from the component:

- Remove `workspaceId` from `JourneyStatusChangerProps`
- Remove `workspaceId` from component destructuring
- Update all call sites (2 files: `journey-list-client.tsx` and `journey-detail-client.tsx`) to stop passing `workspaceId`

**Step 2: Remove unused import**

Remove `import { createClient } from "@smartout/supabase/client"` from the file.

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx
git add apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx
git add apps/web/src/app/platform-admin/journeys/\[id\]/_components/journey-detail-client.tsx
git commit -m "fix(journey): move status transition to server-side API route

Replaces direct Supabase client mutation with fetch to
/api/platform-admin/journeys/[id]/status. Server validates
state machine transitions and logs to audit trail."
```

---

## Task 4: Fix Race Condition on Journey Code Generation

**Why:** Issue #2. While `UNIQUE(workspace_id, code)` prevents duplicates, concurrent wizard completions get a cryptic 500 error instead of a retry.

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/complete/route.ts`

**Step 1: Add retry logic for code generation**

Replace lines 69-79 (the code generation block) with a retry loop:

```typescript
// Generate next journey code with retry for concurrent completions.
// The UNIQUE(workspace_id, code) constraint prevents duplicates,
// so on conflict we fetch the latest code and try the next number.
let nextCode: string;
const MAX_RETRIES = 3;

for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  const { data: lastJourney } = await admin
    .from("journey")
    .select("code")
    .eq("workspace_id", session.workspace_id)
    .order("code", { ascending: false })
    .limit(1)
    .single();

  const lastNum = lastJourney ? parseInt(lastJourney.code.replace("J-", ""), 10) : 0;
  nextCode = `J-${String(lastNum + 1).padStart(3, "0")}`;

  // Try to insert — if unique constraint fails, retry with next number
  const { data: journey, error: journeyError } = await admin
    .from("journey")
    .insert({
      workspace_id: session.workspace_id,
      code: nextCode,
      title: String(draft.title),
      slug,
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

  if (!journeyError && journey) {
    // Success — continue with step creation, event logging, session completion
    // (rest of handler uses `journey` and `nextCode` variables)
    // ... see Step 2 for the restructured continuation
  }

  // If error is NOT a unique violation, fail immediately
  if (journeyError && !journeyError.message.includes("duplicate key")) {
    return NextResponse.json({ error: journeyError.message }, { status: 500 });
  }

  // Unique violation — retry loop continues
}

// All retries exhausted
return NextResponse.json(
  { error: "Could not generate unique journey code — try again" },
  { status: 409 },
);
```

**Step 2: Handle step/event insertion errors (Issue #3)**

After the successful journey insert (inside the retry loop), add error handling:

```typescript
// Create journey steps from draft
const draftSteps =
  (draft.steps as Array<{
    title: string;
    action: string;
    expects?: string;
    screen?: string;
    component?: string;
  }>) ?? [];

if (draftSteps.length > 0) {
  const stepRows = draftSteps.map((s, i) => ({
    journey_id: journey.journey_id,
    workspace_id: session.workspace_id,
    step_order: i + 1,
    title: s.title,
    action: s.action,
    expects: s.expects ?? null,
    screen: s.screen ?? null,
    component: s.component ?? null,
  }));

  const { error: stepError } = await admin.from("journey_step").insert(stepRows);
  if (stepError) {
    // Journey exists but steps failed — return success with warning
    console.error("Failed to insert journey steps:", stepError.message);
  }
}

// Log the creation event
const { error: eventError } = await admin.from("journey_event").insert({
  journey_id: journey.journey_id,
  workspace_id: session.workspace_id,
  event_type: "status_change" as never,
  from_status: null,
  to_status: "defined" as never,
  actor_id: user.id,
  metadata: { source: "wizard", session_id: sessionId },
});

if (eventError) {
  console.error("Failed to log journey creation event:", eventError.message);
}

// Mark wizard session as completed
await admin
  .from("wizard_session")
  .update({
    status: "completed" as never,
    journey_id: journey.journey_id,
    completed_at: new Date().toISOString(),
  })
  .eq("wizard_session_id", sessionId);

// Log to platform audit trail
await logPlatformAction(user.id, "journey_created", "journey", journey.journey_id, {
  code: nextCode,
  title: journey.title,
  source: "wizard",
});

return NextResponse.json({
  journey_id: journey.journey_id,
  code: nextCode,
  title: journey.title,
  steps_created: draftSteps.length,
  warnings: [
    ...(stepError ? ["Steps failed to save — add manually"] : []),
    ...(eventError ? ["Event log entry failed"] : []),
  ].filter(Boolean),
});
```

**Step 3: Standardize to `requireGodmode()` (Issue #7)**

Replace the inline godmode check (lines 33-47) with:

```typescript
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";

export async function POST(_request: NextRequest, { params }: Props) {
  const { sessionId } = await params;
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId: userId, admin } = result;

  // ... rest of handler uses `userId` instead of `user.id` and `admin` instead of creating one
}
```

Remove the now-unused imports of `createClient` and `createAdminClient`.

**Step 4: Commit**

```bash
git add apps/web/src/app/api/platform-admin/journeys/wizard/\[sessionId\]/complete/route.ts
git commit -m "fix(journey): add retry for code generation, handle insertion errors

- Retry up to 3 times on unique constraint violation (race condition)
- Log step/event insertion errors instead of silently ignoring
- Use requireGodmode() helper
- Add platform audit trail logging"
```

---

## Task 5: Standardize Remaining Wizard Routes to `requireGodmode()`

**Why:** Issue #7. Three journey API routes use inline godmode checks instead of the shared helper.

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/journeys/wizard/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/journeys/wizard/[sessionId]/route.ts`
- Modify: `apps/web/src/app/api/platform-admin/journeys/[id]/generate/route.ts`

**Step 1: Update wizard create+list route**

In `wizard/route.ts`, replace the inline auth check in both `POST` and `GET` handlers:

```typescript
import { requireGodmode } from "@/lib/platform-admin";

export async function POST(request: NextRequest) {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId, admin } = result;

  // ... rest of handler, using `admin` and `adminId` (for created_by)
}

export async function GET() {
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { admin } = result;

  // ... rest of handler
}
```

Remove imports of `createClient` and `createAdminClient`.

**Step 2: Update wizard session GET route**

In `wizard/[sessionId]/route.ts`, same pattern:

```typescript
import { requireGodmode } from "@/lib/platform-admin";

export async function GET(_request: Request, { params }: Props) {
  const { sessionId } = await params;
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { admin } = result;

  // ... rest of handler
}
```

**Step 3: Update generate route**

In `[id]/generate/route.ts`, same pattern:

```typescript
import { requireGodmode, logPlatformAction } from "@/lib/platform-admin";

export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const result = await requireGodmode();
  if (result.error) return result.error;
  const { adminId, admin } = result;

  // ... rest of handler, add audit logging at the end:
  await logPlatformAction(adminId, "journey_output_generated", "journey", id, {
    output_type: body.type,
  });
}
```

**Step 4: Commit**

```bash
git add apps/web/src/app/api/platform-admin/journeys/wizard/route.ts
git add apps/web/src/app/api/platform-admin/journeys/wizard/\[sessionId\]/route.ts
git add apps/web/src/app/api/platform-admin/journeys/\[id\]/generate/route.ts
git commit -m "refactor(journey): standardize all routes to requireGodmode()

Replaces inline auth checks with shared helper in 3 API routes.
Adds audit trail logging for output generation."
```

---

## Task 6: Extract Shared Icon Maps

**Why:** Issue #6. The same icon-to-component maps are defined 3 times across journey components.

**Files:**

- Create: `apps/web/src/lib/journey/icons.ts`
- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx`
- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx`
- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

**Step 1: Create shared icon map file**

```typescript
// ============================================
// icons.ts — Journey Icon Component Maps
// Maps icon name strings from journey metadata to actual
// lucide-react components. Single source of truth for all
// journey UI components that need to render status, module,
// or platform icons from metadata.
// Connected to: status-transitions.ts (STATUS_META icon names)
// Connected to: module-meta.ts (MODULE_META, PLATFORM_META icon names)
// ============================================

import type { ComponentType } from "react";
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
  Key,
  Building2,
  Calendar,
  Zap,
  Thermometer,
  GraduationCap,
  Palmtree,
  Banknote,
  MessageSquare,
  BarChart3,
  Settings,
  Bot,
  Trophy,
  ScrollText,
  FileSignature,
  Award,
  Target,
  Smartphone,
  Monitor,
  Laptop,
} from "lucide-react";

type IconComponent = ComponentType<{ className?: string }>;

/**
 * Maps STATUS_META icon names to lucide-react components.
 * Used by status badges and the status changer popover.
 */
export const STATUS_ICON_MAP: Record<string, IconComponent> = {
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
};

/**
 * Maps MODULE_META icon names to lucide-react components.
 * Used by module badges in list and detail views.
 */
export const MODULE_ICON_MAP: Record<string, IconComponent> = {
  Key,
  Rocket,
  Building2,
  Calendar,
  Zap,
  Thermometer,
  GraduationCap,
  Palmtree,
  Banknote,
  MessageSquare,
  BarChart3,
  Settings,
  Bot,
  Trophy,
  ScrollText,
  FileSignature,
  Award,
  Target,
};

/**
 * Maps PLATFORM_META icon names to lucide-react components.
 * Used by platform indicators in list and detail views.
 */
export const PLATFORM_ICON_MAP: Record<string, IconComponent> = {
  Smartphone,
  Monitor,
  Laptop,
};
```

**Step 2: Update journey-status-changer.tsx**

Remove all inline icon imports (lines 21-36) and the `ICON_MAP` definition (lines 43-57). Replace with:

```typescript
import { STATUS_ICON_MAP } from "@/lib/journey/icons";
```

Update references: `ICON_MAP[...]` → `STATUS_ICON_MAP[...]` (2 occurrences: lines 89, 171).

**Step 3: Update journey-list-client.tsx**

Remove `Smartphone`, `Monitor`, `Laptop` imports and `PLATFORM_ICON_MAP` definition (lines 42-46). Replace with:

```typescript
import { PLATFORM_ICON_MAP } from "@/lib/journey/icons";
```

**Step 4: Update journey-detail-client.tsx**

Remove all inline icon imports for status/module/platform icons (lines 34-71) and the three `*_ICON_MAP` definitions (lines 77-124). Replace with:

```typescript
import { STATUS_ICON_MAP, MODULE_ICON_MAP, PLATFORM_ICON_MAP } from "@/lib/journey/icons";
```

Keep only the non-icon imports: `ArrowLeft`, `ArrowRight`, `Clock`, `Copy`, `Loader2`, `Play`.

**Step 5: Commit**

```bash
git add apps/web/src/lib/journey/icons.ts
git add apps/web/src/app/platform-admin/journeys/_components/journey-status-changer.tsx
git add apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx
git add apps/web/src/app/platform-admin/journeys/\[id\]/_components/journey-detail-client.tsx
git commit -m "refactor(journey): extract shared icon maps to lib/journey/icons.ts

Removes duplicate icon-to-component maps from 3 components.
Single source of truth for status, module, and platform icons."
```

---

## Task 7: Add Pagination to Journey List

**Why:** Issue #5. The list page fetches ALL journeys with no limit.

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/page.tsx`
- Modify: `apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx`

**Step 1: Add pagination to server page**

The simplest approach: fetch a generous limit (500) to cover realistic growth, add a count query. No cursor-based pagination needed yet — the client already does all filtering/sorting in memory.

In `page.tsx`, update the query:

```typescript
export default async function JourneysPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  // Fetch journeys with a limit and total count
  const [{ data: journeys, count }] = await Promise.all([
    admin
      .from("journey")
      .select("*", { count: "exact" })
      .order("code", { ascending: true })
      .limit(500),
  ]);

  return (
    <JourneyListClient
      initialJourneys={journeys ?? []}
      totalCount={count ?? 0}
    />
  );
}
```

**Step 2: Update client component props**

In `journey-list-client.tsx`, add `totalCount` to props and show a warning if truncated:

```typescript
type JourneyListClientProps = {
  initialJourneys: Journey[];
  totalCount: number;
};

export function JourneyListClient({ initialJourneys, totalCount }: JourneyListClientProps) {
  // ... existing code

  // In the subtitle, show total count:
  // Replace the existing subtitle with:
  <p className="text-muted-foreground text-sm">
    {journeys.length === totalCount
      ? `${totalCount} journeys tracked across ${Object.keys(MODULE_META).length} modules`
      : `Showing ${journeys.length} of ${totalCount} journeys (limit reached)`}
  </p>
```

**Step 3: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/page.tsx
git add apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx
git commit -m "fix(journey): add limit and count to journey list query

Prevents unbounded SELECT * as journey count grows.
Shows warning when limit is reached."
```

---

## Task 8: Use Proper Types in Wizard Draft Preview

**Why:** Issue #9. `wizard-draft-preview.tsx` uses `Record<string, unknown>` when `DraftJourney` exists.

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-draft-preview.tsx`

**Step 1: Import and use `DraftJourney` type**

Replace the local type definition:

```typescript
// Remove this:
type DraftJourney = Record<string, unknown>;

// Add this import:
import type { DraftJourney } from "@smartout/types";
```

Update `WizardDraftPreviewProps`:

```typescript
type WizardDraftPreviewProps = {
  draft: DraftJourney;
};
```

Remove all the `as string` and `as string[]` casts throughout the component since `DraftJourney` already types these fields. The field accesses like `draft.title`, `draft.module`, `draft.tags` are now properly typed.

**Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/wizard/\[sessionId\]/_components/wizard-draft-preview.tsx
git commit -m "refactor(journey): use DraftJourney type in wizard preview

Replaces loose Record<string, unknown> with proper type from @smartout/types.
Removes unnecessary type casts."
```

---

## Task 9: Fix Inconsistent Date Formatting

**Why:** Issue #10. `journey-detail-client.tsx` uses `toLocaleString()` without locale, while the wizard launcher uses `"nb-NO"`.

**Files:**

- Modify: `apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx`

**Step 1: Fix event timestamp formatting**

Replace line 579:

```typescript
// Before:
{
  new Date(event.created_at).toLocaleString();
}

// After:
{
  new Date(event.created_at).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

This matches the pattern used in `wizard-launcher-client.tsx:193-198` (Norwegian locale, short month, time included).

**Step 2: Commit**

```bash
git add apps/web/src/app/platform-admin/journeys/\[id\]/_components/journey-detail-client.tsx
git commit -m "fix(journey): use consistent nb-NO date formatting in event log"
```

---

## Task 10: Typecheck and Verify

**Why:** Final validation that all changes compile and don't break existing functionality.

**Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: All packages pass. If errors, fix them.

**Step 2: Run lint**

```bash
pnpm lint
```

Expected: No new warnings. If errors from changed files, fix them.

**Step 3: Run build**

```bash
pnpm build
```

Expected: Successful build. This catches any runtime import issues.

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(journey): resolve typecheck and lint issues from portal fixes"
```

---

## Summary

| Task | Issue Fixed                               | Priority   | Est. Complexity |
| ---- | ----------------------------------------- | ---------- | --------------- |
| 1    | #7 (duplicated godmode)                   | Foundation | Low             |
| 2    | #1 (client mutation), #4 (no validation)  | High       | Medium          |
| 3    | #1 (client mutation), #4 (no validation)  | High       | Low             |
| 4    | #2 (race condition), #3 (silent failures) | High       | Medium          |
| 5    | #7 (duplicated godmode)                   | Medium     | Low             |
| 6    | #6 (duplicated icons)                     | Low        | Low             |
| 7    | #5 (no pagination)                        | Medium     | Low             |
| 8    | #9 (loose types)                          | Low        | Low             |
| 9    | #10 (date formatting)                     | Low        | Low             |
| 10   | Verification                              | Required   | Low             |

**Total: 10 tasks, 10 commits, all 10 review issues resolved.**
