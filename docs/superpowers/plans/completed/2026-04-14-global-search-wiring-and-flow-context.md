# Global Search Wiring + Flow Pages Context Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the GlobalSearchPalette to the real `/api/search` endpoint (replacing mock data) and fix the flow pages to use real workspace/profile context from auth instead of hardcoded null values.

**Architecture:** The search backend is complete — `/api/search` route, orchestrator with 3 parallel search modes (instance, semantic, dependency graph), and Supabase RPCs all exist. The palette just needs a TanStack Query hook that calls the API when the user types, debounced, and maps the response to the existing `SearchGroup[]` shape. The flow pages need to read workspace_id and profile_id from the session/cookie (they're public pages that may or may not have auth context).

**Tech Stack:** TypeScript, React, TanStack Query, Next.js App Router, Supabase client, `@smartout/telemetry` emit

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/lib/search/use-search.ts` | TanStack Query hook: debounced fetch from `/api/search`, maps to SearchGroup[] |
| Modify | `apps/web/src/components/dashboard/GlobalSearchPalette.tsx` | Replace mock `getGroupedResults()` with `useSearch()` hook |
| Modify | `apps/web/src/app/flow/page.tsx` | Replace hardcoded WORKSPACE_ID/ACTOR_ID with auth context |
| Modify | `apps/web/src/app/flow/alkohol/page.tsx` | Same fix as flow/page.tsx |

---

### Task 1: Create `useSearch` Hook

**Files:**
- Create: `apps/web/src/lib/search/use-search.ts`

- [ ] **Step 1: Create the hook file**

```typescript
"use client";

/**
 * TanStack Query hook for the global search palette.
 * Debounces input, calls /api/search, maps response to SearchGroup[].
 * Falls back to static navigation commands when query is empty.
 */

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import type { SearchMode } from "@/lib/search/query-prefix";

export type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  deepLink: string;
  icon: "page" | "person" | "knowledge" | "policy" | "command";
};

export type SearchGroup = {
  label: string;
  results: SearchResult[];
};

/** Map backend group names to Norwegian UI labels */
const GROUP_LABELS: Record<string, string> = {
  people: "Ansatte",
  knowledge: "Kunnskap",
  policies: "Kvalitetsstyring",
};

/** Infer icon type from backend group name */
function iconForGroup(group: string): SearchResult["icon"] {
  switch (group) {
    case "people":
      return "person";
    case "knowledge":
      return "knowledge";
    case "policies":
      return "policy";
    default:
      return "page";
  }
}

type ApiResponse = {
  groups: Array<{
    group: string;
    results: Array<{
      id: string;
      title: string;
      subtitle: string;
      deepLink: string;
      relevance: number;
    }>;
  }>;
  timing_ms: number;
};

export function useSearch(query: string, mode: SearchMode, enabled: boolean) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["global-search", workspaceId, mode, query],
    enabled: enabled && !!workspaceId && query.length > 0,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<SearchGroup[]> => {
      const params = new URLSearchParams({
        workspaceId: workspaceId!,
        q: mode === "all" ? query : `${mode === "knowledge" ? "?" : mode === "people" ? "@" : ">"}${query}`,
      });

      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) return [];

      const data = (await res.json()) as ApiResponse;

      return data.groups.map((g) => ({
        label: GROUP_LABELS[g.group] ?? g.group,
        results: g.results.map((r) => ({
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          deepLink: r.deepLink,
          icon: iconForGroup(g.group),
        })),
      }));
    },
  });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

---

### Task 2: Wire GlobalSearchPalette to Real API

**Files:**
- Modify: `apps/web/src/components/dashboard/GlobalSearchPalette.tsx`

- [ ] **Step 1: Add import for useSearch hook**

At the top imports, add:

```typescript
import { useSearch, type SearchGroup } from "@/lib/search/use-search";
```

- [ ] **Step 2: Replace mock data usage with live hook**

Inside the `GlobalSearchPalette` component (after `const parsed = parseSearchPrefix(rawValue);`), replace:

```typescript
const groups = getGroupedResults(parsed.mode, parsed.query);
```

With:

```typescript
const { data: liveGroups } = useSearch(parsed.query, parsed.mode, open);
const groups = parsed.query.length > 0 && liveGroups
  ? liveGroups
  : getGroupedResults(parsed.mode, parsed.query);
```

This preserves the static navigation commands as fallback when the query is empty (Cmd+K opens with nav shortcuts) and uses the real API when the user types a query.

- [ ] **Step 3: Update the SearchResult type to match**

The component already uses a `SearchResult` type (line 50-57) that matches the hook's export. The `SearchGroup` type (line 59-61) also matches. No type changes needed — the shapes are compatible.

- [ ] **Step 4: Remove the TODO comment**

Remove this line from `getGroupedResults`:

```typescript
// TODO: Replace with /api/search fetch + TanStack Query when API is ready
```

Replace with:

```typescript
// Static navigation + mock results — used as fallback when query is empty
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/search/use-search.ts apps/web/src/components/dashboard/GlobalSearchPalette.tsx
git commit -m "feat(search): wire GlobalSearchPalette to /api/search with TanStack Query

Static navigation commands remain as fallback when query is empty.
Live API results shown when user types a search query."
```

---

### Task 3: Fix Flow Pages Context

**Files:**
- Modify: `apps/web/src/app/flow/page.tsx`
- Modify: `apps/web/src/app/flow/alkohol/page.tsx`

The flow pages are public-facing (no guaranteed auth). They use `emit()` from `@smartout/telemetry` which accepts `null` for workspace_id. The fix is to try reading auth context but gracefully fall back to null/anonymous.

- [ ] **Step 1: Create a shared hook for flow context**

Create `apps/web/src/app/flow/_hooks/use-flow-context.ts`:

```typescript
"use client";

/**
 * Resolves workspace_id and actor_id for flow pages.
 * Flow pages are publicly accessible — auth context may not exist.
 * Returns null/anonymous as fallback when no session is available.
 */

import { useEffect, useState } from "react";
import { createClient } from "@smartout/supabase/client";

type FlowContext = {
  workspaceId: string | null;
  actorId: string;
};

export function useFlowContext(): FlowContext {
  const [ctx, setCtx] = useState<FlowContext>({
    workspaceId: null,
    actorId: "anonymous",
  });

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      void supabase
        .from("profile")
        .select("profile_id, workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single()
        .then(({ data: profile }) => {
          if (profile) {
            setCtx({
              workspaceId: profile.workspace_id,
              actorId: profile.profile_id,
            });
          }
        });
    });
  }, []);

  return ctx;
}
```

- [ ] **Step 2: Update `apps/web/src/app/flow/page.tsx`**

Remove the hardcoded constants:

```typescript
// TODO: Replace with real workspace/profile context
const WORKSPACE_ID = null;
const ACTOR_ID = "anonymous";
```

Add import at the top:

```typescript
import { useFlowContext } from "./_hooks/use-flow-context";
```

Inside the `FlowPage` component, add at the top:

```typescript
const { workspaceId, actorId } = useFlowContext();
```

Then replace all `WORKSPACE_ID` references with `workspaceId` and all `ACTOR_ID` references with `actorId` in the `emitFlowEvent` function. Move `emitFlowEvent` inside the component body so it can access the hook values, or pass them as parameters.

The cleanest approach: make `emitFlowEvent` accept context as a parameter. Replace the function signature:

```typescript
function emitFlowEvent(event: FlowEvent, wsId: string | null, actId: string) {
```

And update the `onEvent` prop:

```typescript
onEvent={(event) => emitFlowEvent(event, workspaceId, actorId)}
```

Update every `emit()` call inside `emitFlowEvent` to use `wsId` and `actId` instead of `WORKSPACE_ID` and `ACTOR_ID`.

- [ ] **Step 3: Update `apps/web/src/app/flow/alkohol/page.tsx`**

Same pattern. Remove hardcoded constants, import hook, wire context.

Remove:

```typescript
// TODO: Replace with real workspace/profile context when integrated
const WORKSPACE_ID = null;
const ACTOR_ID = "anonymous";
```

Add import:

```typescript
import { useFlowContext } from "../_hooks/use-flow-context";
```

Inside `AlkoholFlowPage`, add:

```typescript
const { workspaceId, actorId } = useFlowContext();
```

Update `handleEvent` to use `workspaceId` and `actorId` instead of `WORKSPACE_ID` and `ACTOR_ID`.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/flow/_hooks/use-flow-context.ts apps/web/src/app/flow/page.tsx apps/web/src/app/flow/alkohol/page.tsx
git commit -m "fix(flow): resolve workspace and actor context from auth session

Flow pages now attempt to read real workspace_id and profile_id
from the authenticated session. Falls back to null/anonymous
for unauthenticated visitors."
```

---

### Task 4: Final Typecheck

- [ ] **Step 1: Run full typecheck**

Run: `pnpm turbo typecheck --filter=web`
Expected: 0 errors

---

## Verification Checklist

- [ ] `pnpm turbo typecheck --filter=web` passes with 0 errors
- [ ] GlobalSearchPalette shows static nav commands on Cmd+K open (empty query)
- [ ] Typing a query triggers real `/api/search` call (visible in Network tab)
- [ ] Search results display with correct icons and deep links
- [ ] Flow pages emit events with real workspace_id when user is authenticated
- [ ] Flow pages still work for anonymous visitors (null workspace_id, "anonymous" actor)
- [ ] No hardcoded `WORKSPACE_ID = null` or `ACTOR_ID = "anonymous"` remain in flow pages
- [ ] No TODO comments remain in modified files about replacing mock data
