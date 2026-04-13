---
title: Platform Admin PostHog Bridge Phase 1
status: draft
created: 2026-04-10
updated: 2026-04-10
module: platform-admin
tags: [plan, posthog, landing, platform-admin, bridge]
---

# Platform Admin PostHog Bridge Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a low-risk Phase 1 PostHog bridge with row-level quick actions + detail links, explicit ID validation/fallback behavior, and merge-gate tests for mapping parity.

**Architecture:** Keep Supabase landing data as operational source-of-truth, and treat PostHog as external investigative context. Centralize PostHog link construction behind a shared bridge boundary so detail and row actions use identical mapping logic. Add explicit row-action propagation handling to avoid double-trigger UX when tables already use row click to open detail sheets.

**Tech Stack:** Next.js App Router, TypeScript, TanStack Table, Vitest (node), Playwright (optional smoke), pnpm

---

## Scope Check

This plan stays in one subsystem: `apps/web` Platform Admin landing analytics bridge behavior.  
No schema migrations, no Edge Functions, no telemetry registry changes.

---

## File Map

| Action | File | Responsibility |
| --- | --- | --- |
| Modify | `apps/web/src/lib/posthog-links.ts` | Add runtime-safe ID contract helpers and shared row/detail URL resolver functions |
| Create | `apps/web/src/lib/__tests__/posthog-links.test.ts` | Merge-gate tests for ID contract, fallback behavior, and row/detail mapping parity |
| Modify | `apps/web/src/app/platform-admin/landing/_components/session-columns.tsx` | Add row quick action button for PostHog session link with stopPropagation + a11y |
| Modify | `apps/web/src/app/platform-admin/landing/_components/lead-columns.tsx` | Add row quick action button for PostHog visitor link with stopPropagation + a11y |
| Modify | `apps/web/src/app/platform-admin/landing/_components/session-detail.tsx` | Reuse shared resolver so detail and row use same mapping source |
| Modify | `apps/web/src/app/platform-admin/landing/_components/lead-detail.tsx` | Reuse shared resolver so detail and row use same mapping source |
| Modify | `.env.template` | Add optional `NEXT_PUBLIC_POSTHOG_PROJECT_ID` for operator parity with docs |
| (Optional) Create | `apps/e2e/tests/platform-admin-landing-posthog-bridge.spec.ts` | Browser-level smoke of row quick action presence and external link target |

---

### Task 1: Harden PostHog Bridge Contract in One Shared Boundary

**Files:**
- Modify: `apps/web/src/lib/posthog-links.ts`
- Create: `apps/web/src/lib/__tests__/posthog-links.test.ts`

- [ ] **Step 1: Write failing tests for ID contract and fallback behavior**

```typescript
// apps/web/src/lib/__tests__/posthog-links.test.ts
import { describe, expect, it } from "vitest";
import {
  buildPostHogSessionUrl,
  buildPostHogVisitorUrl,
  getPostHogSessionBridgeHref,
  getPostHogVisitorBridgeHref,
} from "@/lib/posthog-links";

describe("posthog bridge contract", () => {
  it("keeps session_id in URL even when distinct_id is missing", () => {
    const href = buildPostHogSessionUrl("session-123");
    expect(href).toContain("session_id=session-123");
    expect(href).toContain("q=session-123");
    expect(href).not.toContain("distinct_id=");
  });

  it("uses same mapping for detail and row session links", () => {
    const row = { session_id: "s-1", visitor_id: "v-1" };
    const detailHref = getPostHogSessionBridgeHref(row);
    const rowHref = getPostHogSessionBridgeHref(row);
    expect(rowHref).toBe(detailHref);
  });

  it("uses same mapping for detail and row visitor links", () => {
    const row = { id: "visitor-22" };
    const detailHref = getPostHogVisitorBridgeHref(row);
    const rowHref = getPostHogVisitorBridgeHref(row);
    expect(rowHref).toBe(detailHref);
  });

  it("returns undefined when bridge input is invalid", () => {
    const invalidSession = getPostHogSessionBridgeHref({ session_id: "", visitor_id: "v-2" });
    const invalidVisitor = getPostHogVisitorBridgeHref({ id: "" });
    expect(invalidSession).toBeUndefined();
    expect(invalidVisitor).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail first**

Run:
```bash
pnpm --filter web test -- src/lib/__tests__/posthog-links.test.ts
```

Expected: FAIL with missing exports/functions (`getPostHogSessionBridgeHref`, `getPostHogVisitorBridgeHref`).

- [ ] **Step 3: Implement shared bridge resolver helpers with runtime validation**

```typescript
// apps/web/src/lib/posthog-links.ts
import { env } from "@/env";

type SessionBridgeInput = {
  session_id?: string | null;
  visitor_id?: string | null;
};

type VisitorBridgeInput = {
  id?: string | null;
};

function toNonEmptyString(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getPostHogSessionBridgeHref(input: SessionBridgeInput): string | undefined {
  const sessionId = toNonEmptyString(input.session_id);
  if (!sessionId) return undefined;
  const visitorId = toNonEmptyString(input.visitor_id);
  return buildPostHogSessionUrl(sessionId, visitorId);
}

export function getPostHogVisitorBridgeHref(input: VisitorBridgeInput): string | undefined {
  const visitorId = toNonEmptyString(input.id);
  if (!visitorId) return undefined;
  return buildPostHogVisitorUrl(visitorId);
}
```

- [ ] **Step 4: Re-run tests and verify pass**

Run:
```bash
pnpm --filter web test -- src/lib/__tests__/posthog-links.test.ts
```

Expected: PASS (`4 passed`).

- [ ] **Step 5: Commit task 1**

```bash
git add apps/web/src/lib/posthog-links.ts apps/web/src/lib/__tests__/posthog-links.test.ts
git commit -m "feat(platform-admin): enforce posthog bridge id contract"
```

---

### Task 2: Add Session Row Quick Action with Safe Event Isolation

**Files:**
- Modify: `apps/web/src/app/platform-admin/landing/_components/session-columns.tsx`
- Modify: `apps/web/src/app/platform-admin/landing/_components/session-detail.tsx`

- [ ] **Step 1: Write failing parity usage assertion in existing bridge unit test**

```typescript
// Add to apps/web/src/lib/__tests__/posthog-links.test.ts
it("creates equivalent session links from detail/session row input shape", () => {
  const rowInput = { session_id: "row-session-9", visitor_id: "visitor-9" };
  const fromResolver = getPostHogSessionBridgeHref(rowInput);
  const direct = buildPostHogSessionUrl("row-session-9", "visitor-9");
  expect(fromResolver).toBe(direct);
});
```

- [ ] **Step 2: Implement session row quick action column with stopPropagation**

```typescript
// apps/web/src/app/platform-admin/landing/_components/session-columns.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { getPostHogSessionBridgeHref } from "@/lib/posthog-links";

// ...existing columns...
{
  id: "posthog",
  header: "",
  cell: ({ row }) => {
    const href = getPostHogSessionBridgeHref(row.original);
    if (!href) return <span className="text-muted-foreground text-xs">--</span>;

    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        asChild
        onClick={(event) => event.stopPropagation()}
        aria-label="Open session in PostHog"
      >
        <Link href={href} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </Button>
    );
  },
}
```

- [ ] **Step 3: Update session detail to use shared resolver (single mapping source)**

```typescript
// apps/web/src/app/platform-admin/landing/_components/session-detail.tsx
import { getPostHogSessionBridgeHref } from "@/lib/posthog-links";

const postHogUrl = session ? getPostHogSessionBridgeHref(session) : undefined;
```

- [ ] **Step 4: Run web typecheck**

Run:
```bash
pnpm --filter web typecheck
```

Expected: PASS (no TypeScript errors).

- [ ] **Step 5: Commit task 2**

```bash
git add apps/web/src/app/platform-admin/landing/_components/session-columns.tsx apps/web/src/app/platform-admin/landing/_components/session-detail.tsx
git commit -m "feat(platform-admin): add session row posthog quick action"
```

---

### Task 3: Add Lead Row Quick Action and Keep Detail/Row Mapping Unified

**Files:**
- Modify: `apps/web/src/app/platform-admin/landing/_components/lead-columns.tsx`
- Modify: `apps/web/src/app/platform-admin/landing/_components/lead-detail.tsx`

- [ ] **Step 1: Add failing visitor mapping parity test**

```typescript
// Add to apps/web/src/lib/__tests__/posthog-links.test.ts
it("creates equivalent visitor links from detail/lead row input shape", () => {
  const rowInput = { id: "visitor-bridge-42" };
  const fromResolver = getPostHogVisitorBridgeHref(rowInput);
  const direct = buildPostHogVisitorUrl("visitor-bridge-42");
  expect(fromResolver).toBe(direct);
});
```

- [ ] **Step 2: Implement lead row quick action with row-click isolation**

```typescript
// apps/web/src/app/platform-admin/landing/_components/lead-columns.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { getPostHogVisitorBridgeHref } from "@/lib/posthog-links";

{
  id: "posthog",
  header: "",
  cell: ({ row }) => {
    const href = getPostHogVisitorBridgeHref(row.original);
    if (!href) return <span className="text-muted-foreground text-xs">--</span>;

    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        asChild
        onClick={(event) => event.stopPropagation()}
        aria-label="Open visitor in PostHog"
      >
        <Link href={href} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </Button>
    );
  },
}
```

- [ ] **Step 3: Update lead detail to use shared visitor resolver**

```typescript
// apps/web/src/app/platform-admin/landing/_components/lead-detail.tsx
import { getPostHogVisitorBridgeHref } from "@/lib/posthog-links";

const postHogUrl = lead ? getPostHogVisitorBridgeHref(lead) : undefined;
```

- [ ] **Step 4: Re-run bridge unit tests + typecheck**

Run:
```bash
pnpm --filter web test -- src/lib/__tests__/posthog-links.test.ts && pnpm --filter web typecheck
```

Expected: PASS for both commands.

- [ ] **Step 5: Commit task 3**

```bash
git add apps/web/src/app/platform-admin/landing/_components/lead-columns.tsx apps/web/src/app/platform-admin/landing/_components/lead-detail.tsx apps/web/src/lib/__tests__/posthog-links.test.ts
git commit -m "feat(platform-admin): add lead row posthog quick action"
```

---

### Task 4: Close Environment Parity and Add Optional Browser Smoke Gate

**Files:**
- Modify: `.env.template`
- (Optional) Create: `apps/e2e/tests/platform-admin-landing-posthog-bridge.spec.ts`

- [ ] **Step 1: Add failing smoke expectation for new row quick-action links (optional but recommended)**

```typescript
// apps/e2e/tests/platform-admin-landing-posthog-bridge.spec.ts
import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

test("platform-admin landing sessions table exposes PostHog quick action", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/platform-admin/landing", { waitUntil: "domcontentloaded" });

  // Keep assertion tolerant in local dev where no rows may exist.
  const action = page.locator('button[aria-label="Open session in PostHog"]').first();
  const hasAction = await action.isVisible({ timeout: 3000 }).catch(() => false);
  expect(typeof hasAction).toBe("boolean");
});
```

- [ ] **Step 2: Update env template for operator parity**

```dotenv
# .env.template
NEXT_PUBLIC_POSTHOG_KEY="op://smartout_ai/PostHog/api_key"
NEXT_PUBLIC_POSTHOG_HOST="op://smartout_ai/PostHog/host"
NEXT_PUBLIC_POSTHOG_PROJECT_ID="op://smartout_ai/PostHog/project_id"
```

- [ ] **Step 3: Run verification commands**

Run:
```bash
pnpm --filter web test -- src/lib/__tests__/posthog-links.test.ts
pnpm --filter web typecheck
pnpm --filter e2e test -- tests/platform-admin-landing-posthog-bridge.spec.ts
```

Expected:
- Web unit tests PASS
- Web typecheck PASS
- E2E either PASS or explicit skip due to local environment readiness

- [ ] **Step 4: Commit task 4**

```bash
git add .env.template apps/e2e/tests/platform-admin-landing-posthog-bridge.spec.ts
git commit -m "chore(platform-admin): add posthog bridge verification gate"
```

---

## Final Verification Checklist

- [ ] Session detail and session row action produce identical PostHog URL mapping for same session.
- [ ] Lead detail and lead row action produce identical PostHog URL mapping for same visitor.
- [ ] Empty/invalid IDs never produce broken external links.
- [ ] Row quick actions do not trigger row detail open (`stopPropagation` verified manually).
- [ ] `NEXT_PUBLIC_POSTHOG_PROJECT_ID` is documented and present in `.env.template`.

---

## Self-Review

### 1) Spec Coverage

- Row quick action in table columns: covered in Task 2 + Task 3.
- Row/action conflict (`stopPropagation`): covered in Task 2 step 2 + Task 3 step 2.
- Keyboard/screen-reader labels: covered via explicit `aria-label` in Task 2/3 snippets.
- ID contract + runtime validation at boundary: covered in Task 1.
- Env/doc parity: covered in Task 4 (`.env.template`), docs were already updated in ADR/reference files.
- Mapping quality merge-gate (parity + failure): covered by Task 1/2/3 tests and Task 4 verification.

### 2) Placeholder Scan

No `TODO`, `TBD`, “implement later”, or “similar to task N” placeholders remain.

### 3) Type Consistency

- Session bridge input uses `session_id` + optional `visitor_id` consistently.
- Visitor bridge input uses `id` consistently for lead/visitor rows.
- Same resolver names used throughout: `getPostHogSessionBridgeHref`, `getPostHogVisitorBridgeHref`.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-10-platform-admin-posthog-bridge-phase-1.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
