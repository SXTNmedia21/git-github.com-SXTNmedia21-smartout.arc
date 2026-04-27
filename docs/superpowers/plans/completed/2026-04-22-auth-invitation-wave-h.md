# Auth & Invitation Wave H — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate browser → Edge Function cross-origin invocation pattern. Delete `create-invitation` Edge Function, inline into Next.js route handler `apps/web/src/app/api/admin/invite/route.ts`. Migrate 5 other browser-side invoke sites to same-origin proxy routes. Land 5 ADRs + 4 learnings + 1 handoff. Close prior council's `/update-password` ghost-route precondition.

**Architecture:** Browser → Next.js Node route handler (same-origin, no CORS) → server-to-server with `withWorkspaceAdmin` auth, `@smartout/notifications` dispatch, `@smartout/telemetry` `emit()` (all 4 destinations). `accept-invitation` stays Edge (mobile dependency, pre-auth). 4 sequenced PRs (H.0 → H.1 → H.2 → H.3).

**Tech Stack:** Next.js 14 App Router (route handlers), TypeScript, `@smartout/supabase/server` (SSR client), `@smartout/notifications` (SendGrid + Twilio), `@smartout/telemetry` (`emit()` server), `withWorkspaceAdmin` from `apps/web/src/lib/billing/withAdmin.ts`, Zod validation, vitest for parity test.

**Spec:** `docs/superpowers/specs/2026-04-22-auth-invitation-wave-h-amendment.md`

**Pre-flight (DO BEFORE TASK 1):**
- [ ] Confirm working directory = `/home/sxtnl/dev/smartout.ai` AND branch = `development` (not `campaign/daily-operation`).
- [ ] If on campaign worktree, abort and either commit on `development` directly (small) OR spawn sortie: `~/.claude/scripts/new-feature.sh wave-h-browser-invoke-cleanup <N>`.
- [ ] `git pull origin development` to ensure clean state.

---

## PR H.0 — ADR Alignment (4 tasks, ~1 hour)

### Task 1: Amend ADR-0029 with Mutation Surface Selection table

**Files:**
- Modify: `docs/decisions/0029-workspace-api-gateway.md`

- [ ] **Step 1: Read current ADR-0029 full file**

Run: `cat docs/decisions/0029-workspace-api-gateway.md`

- [ ] **Step 2: Append new section after current "Decision Outcome" section**

Add this section verbatim BEFORE the "Key Decisions" header:

```markdown
## Mutation Surface Selection (Amendment 2026-04-22)

| Caller | Auth surface | Canonical path |
|---|---|---|
| Browser, in workspace context | JWT cookie + `x-workspace-slug` header | `apps/web/src/app/api/**/route.ts` (Next.js Node route handler) |
| Browser, no workspace context (signup, invite accept) | URL token / no session | Next.js route handler if session-bootstrap; Edge Function if token-as-auth |
| External integration (POS, booking, HACCP) | API key (`smo_sk_*`) | `workspace-api` Edge Function (this ADR) |
| Webhook callback (Stripe, SendGrid, Twilio, DocuSeal) | Provider signature | Standalone Edge Function with `verify_jwt=false` |
| Server-internal scheduled work | Service role | Edge Function or pg_cron |

**Forbidden:** Browser → `supabase.functions.invoke()` for workspace-scoped mutations. Use a Next.js route handler instead. Reason: Edge Functions (Deno) cannot import `packages/notifications`, `packages/telemetry`, or any internal package — every browser-originated mutation that hits an Edge Function risks ADR-0045 silent violations and telemetry parity gaps. See ADR-0179 for the canonical decision.
```

- [ ] **Step 3: Update frontmatter `updated:` to `2026-04-22`**

Modify the frontmatter date.

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0029-workspace-api-gateway.md
git commit -m "docs(adr): amend ADR-0029 with Mutation Surface Selection table

Forbids browser → supabase.functions.invoke() for workspace-scoped
mutations. Codifies the route-handler pattern that already exists in
30+ files. References ADR-0179 (Wave H)."
```

### Task 2: Amend ADR-0123 — remove create-invitation, lower tripwire 3→2

**Files:**
- Modify: `docs/decisions/0123-adr-0029-amendment-pre-workspace-exceptions.md`

- [ ] **Step 1: Read current ADR-0123**

Run: `cat docs/decisions/0123-adr-0029-amendment-pre-workspace-exceptions.md`

- [ ] **Step 2: Add Amendment 2026-04-22 section near top of file**

Append this section AFTER the existing exception table (the table that lists `accept-invitation` and `create-invitation`):

```markdown
## Amendment 2026-04-22

`create-invitation` removed from the pre-workspace exception list. Rationale: it is JWT-authenticated (workspace context resolvable), and Edge runtime imposed an artificial dispatch barrier (cannot import `packages/notifications`). Migrated to `apps/web/src/app/api/admin/invite/route.ts` (Node runtime) per ADR-0179.

`accept-invitation` retains its exception (token-as-auth, no JWT, no workspace context, mobile dependency at `apps/mobile/app/(auth)/verify.tsx:289`).

**Tripwire updated:** Threshold lowered from 3 to 2. When a 2nd pre-workspace Edge Function is proposed (in addition to `accept-invitation`), open a new ADR before adding it. Threshold lowered because the canonical answer for any new pre-workspace flow is now: prefer Next.js route handler unless token-as-auth without session is required.
```

- [ ] **Step 3: Update the exceptions table to show only `accept-invitation`**

In the existing table that lists both endpoints, remove the `create-invitation` row. The table now has only one data row.

- [ ] **Step 4: Update frontmatter `updated:` to `2026-04-22`**

- [ ] **Step 5: Commit**

```bash
git add docs/decisions/0123-adr-0029-amendment-pre-workspace-exceptions.md
git commit -m "docs(adr): amend ADR-0123 — remove create-invitation, tripwire 3→2

create-invitation moves to Next.js route handler per ADR-0179.
accept-invitation retains its pre-workspace exception (mobile +
token-as-auth). Threshold lowered: next proposal triggers identity-api
ADR."
```

### Task 3: Add ADR-0045 clarification (one-line)

**Files:**
- Modify: `docs/decisions/0045-sendgrid-transactional-email.md`

- [ ] **Step 1: Read current ADR-0045**

Run: `cat docs/decisions/0045-sendgrid-transactional-email.md`

- [ ] **Step 2: Insert clarification block AFTER the frontmatter, BEFORE the H1 heading**

Add this block:

```markdown
> **Clarification 2026-04-22 (ADR-0179 / Wave H):** `packages/notifications` is the single dispatch surface for all transactional email and SMS. Browser-originated dispatch routes through Next.js route handlers (Node runtime) which import `@smartout/notifications` directly. Edge Functions (Deno) MUST route dispatch through a Next.js route handler or a server-internal callback rather than re-implementing dispatch in Deno. The previous `create-invitation` Edge Function silently violated this by hand-rolling `fetch` to SendGrid — fixed by Wave H deletion.
```

- [ ] **Step 3: Update frontmatter `updated:` to `2026-04-22`**

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0045-sendgrid-transactional-email.md
git commit -m "docs(adr): clarify ADR-0045 — single dispatch surface

packages/notifications is the only dispatch surface. Browser flows
route through Next.js route handlers (Node). Edge Functions delegate.
Wave H deletes create-invitation which silently violated this."
```

### Task 4: Register all 5 ADR changes in decision log + commit

**Files:**
- Modify: `docs/decisions/0000-decision-log.md`

- [ ] **Step 1: Read current decision log**

Run: `head -100 docs/decisions/0000-decision-log.md`

- [ ] **Step 2: Add 2 new ADR rows + 3 amendment rows**

Add to the registered ADRs list (preserve existing format):

```markdown
| ADR-0179 | Browser-Originated Mutations Route Through Next.js Route Handlers | accepted | 2026-04-22 |
| ADR-0180 | Engine Event Parity Contract for Telemetry | accepted | 2026-04-22 |
```

If the log has an "Amendments" section, add:

```markdown
| 2026-04-22 | ADR-0029 | Amendment: Mutation Surface Selection table |
| 2026-04-22 | ADR-0123 | Amendment: create-invitation removed, tripwire 3→2 |
| 2026-04-22 | ADR-0045 | Clarification: single dispatch surface |
```

- [ ] **Step 3: Verify ADR-0179 + ADR-0180 files exist (already created in Phase 8 of council)**

Run: `ls docs/decisions/0179-browser-mutations-via-nextjs-route-handlers.md docs/decisions/0180-engine-event-parity-contract.md`
Expected: both files exist.

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0000-decision-log.md
git commit -m "docs(adr): register ADR-0179 + ADR-0180 + 3 amendments (Wave H)"
```

- [ ] **Step 5: Push H.0 to origin**

```bash
git push origin development
```

H.0 complete. Trust Gate conditions 1, 2, 3 satisfied (ADRs land BEFORE refactor).

---

## PR H.1 — Easy Proxies (5 tasks, ~2 hours)

### Task 5: Update `useReconciliation.ts` to use existing `/api/engine-dispatch` route

**Files:**
- Modify: `apps/web/src/app/dashboard/reconciliation/_hooks/useReconciliation.ts:132, :193`

- [ ] **Step 1: Read both call sites**

Run: `sed -n '120,200p' apps/web/src/app/dashboard/reconciliation/_hooks/useReconciliation.ts`

- [ ] **Step 2: Replace `supabase.functions.invoke("engine-dispatch", { body })` with `fetch("/api/engine-dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })`**

Both lines (132 and 193). The route at `apps/web/src/app/api/engine-dispatch/route.ts` already exists and validates with Zod schema `{ event_type, workspace_id, payload, idempotency_key? }`. Map the existing body to that shape.

- [ ] **Step 3: Handle response — route returns `{ ok: true }` on success or `{ error: "..." }` with non-2xx on failure**

Replace the existing error-handling pattern. Pattern:

```ts
const response = await fetch("/api/engine-dispatch", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    event_type: "...",
    workspace_id,
    payload: { ... },
  }),
});
if (!response.ok) {
  const { error } = await response.json();
  throw new Error(error || "Dispatch failed");
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/reconciliation/_hooks/useReconciliation.ts
git commit -m "refactor(reconciliation): use /api/engine-dispatch instead of direct Edge invoke

Same-origin route eliminates CORS preflight. Per ADR-0179."
```

### Task 6: Create `/api/admin/change-proposals/[id]/apply/route.ts` proxy + update caller

**Files:**
- Create: `apps/web/src/app/api/admin/change-proposals/[id]/apply/route.ts`
- Modify: `apps/web/src/app/dashboard/settings/_hooks/use-change-proposals.ts:140`

- [ ] **Step 1: Read current call site**

Run: `sed -n '130,160p' apps/web/src/app/dashboard/settings/_hooks/use-change-proposals.ts`

- [ ] **Step 2: Read template `apps/web/src/app/api/engine-dispatch/route.ts`**

Run: `cat apps/web/src/app/api/engine-dispatch/route.ts`

- [ ] **Step 3: Create new route handler**

Create `apps/web/src/app/api/admin/change-proposals/[id]/apply/route.ts` with this content:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

let _serviceClient: ReturnType<typeof createServiceClient> | null = null;

function getServiceClient() {
  if (_serviceClient) return _serviceClient;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  _serviceClient = createServiceClient(url, key);
  return _serviceClient;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const service = getServiceClient();
    const { data, error } = await service.functions.invoke("apply-change-proposal", {
      body: { proposal_id: id, ...body },
    });

    if (error) {
      console.error("[api/admin/change-proposals/apply] Edge error:", error);
      return NextResponse.json({ error: "Apply failed" }, { status: 502 });
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (err) {
    console.error("[api/admin/change-proposals/apply] Exception:", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
```

- [ ] **Step 4: Update caller**

In `use-change-proposals.ts:140`, replace `supabase.functions.invoke("apply-change-proposal", { body: { proposal_id, ...rest } })` with:

```ts
const response = await fetch(`/api/admin/change-proposals/${proposal_id}/apply`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(rest),
});
if (!response.ok) {
  const { error } = await response.json();
  throw new Error(error || "Apply failed");
}
const data = await response.json();
```

- [ ] **Step 5: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/admin/change-proposals/[id]/apply/route.ts apps/web/src/app/dashboard/settings/_hooks/use-change-proposals.ts
git commit -m "feat(api): same-origin proxy for apply-change-proposal

Per ADR-0179. Eliminates CORS preflight."
```

### Task 7: Create reconciliation settlement-image + validate proxies + update `useCloseOut.ts`

**Files:**
- Create: `apps/web/src/app/api/reconciliation/settlement-image/process/route.ts`
- Create: `apps/web/src/app/api/reconciliation/validate/route.ts`
- Modify: `apps/web/src/app/dashboard/close/_hooks/useCloseOut.ts:103, :131`

- [ ] **Step 1: Read both call sites**

Run: `sed -n '95,145p' apps/web/src/app/dashboard/close/_hooks/useCloseOut.ts`

- [ ] **Step 2: Create `process/route.ts`**

Create `apps/web/src/app/api/reconciliation/settlement-image/process/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

let _serviceClient: ReturnType<typeof createServiceClient> | null = null;
function getServiceClient() {
  if (_serviceClient) return _serviceClient;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  _serviceClient = createServiceClient(url, key);
  return _serviceClient;
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const service = getServiceClient();
    const { data, error } = await service.functions.invoke("process-settlement-image", { body });

    if (error) {
      console.error("[api/reconciliation/settlement-image/process] Edge error:", error);
      return NextResponse.json({ error: "Processing failed" }, { status: 502 });
    }
    return NextResponse.json(data ?? { ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
```

- [ ] **Step 3: Create `validate/route.ts`**

Create `apps/web/src/app/api/reconciliation/validate/route.ts` with the SAME structure as `process/route.ts` but invoking `validate-settlement` instead of `process-settlement-image`. Same `runtime: "nodejs"` + `maxDuration: 60`.

- [ ] **Step 4: Update `useCloseOut.ts:103`**

Replace `supabase.functions.invoke("process-settlement-image", { body })` with:

```ts
const response = await fetch("/api/reconciliation/settlement-image/process", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
if (!response.ok) {
  const { error } = await response.json();
  throw new Error(error || "Processing failed");
}
const data = await response.json();
```

- [ ] **Step 5: Update `useCloseOut.ts:131` similarly for validate-settlement**

Same pattern, target `/api/reconciliation/validate`.

- [ ] **Step 6: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/reconciliation/ apps/web/src/app/dashboard/close/_hooks/useCloseOut.ts
git commit -m "feat(api): same-origin proxies for settlement processing

Per ADR-0179. process-settlement-image + validate-settlement now
proxied via /api/reconciliation/*."
```

### Task 8: Create shift-clock compliance proxy + update `useShiftClock.ts`

**Files:**
- Create: `apps/web/src/app/api/shift-clock/compliance/route.ts`
- Modify: `apps/web/src/hooks/shift-clock/useShiftClock.ts:185`

- [ ] **Step 1: Read call site**

Run: `sed -n '175,210p' apps/web/src/hooks/shift-clock/useShiftClock.ts`

- [ ] **Step 2: Create route**

Create `apps/web/src/app/api/shift-clock/compliance/route.ts` with same structure as Task 7 routes, invoking `shift-clock-compliance`. Use `runtime: "nodejs"`, `maxDuration: 30` (compliance check is shorter than image processing).

- [ ] **Step 3: Update caller**

Replace the `supabase.functions.invoke("shift-clock-compliance", ...)` call with same `fetch("/api/shift-clock/compliance", ...)` pattern.

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: 0 errors.

- [ ] **Step 5: Commit + push H.1**

```bash
git add apps/web/src/app/api/shift-clock/ apps/web/src/hooks/shift-clock/useShiftClock.ts
git commit -m "feat(api): same-origin proxy for shift-clock-compliance

Per ADR-0179. Closes H.1 — all 5 easy proxies done."
git push origin development
```

H.1 complete. 5 browser invoke sites migrated. Now CORS only affects `create-invitation` (handled by H.2).

---

## PR H.2 — Invite Refactor (the big one, 8 tasks, 1-2 days)

### Task 9: Write engine_event parity test (TDD — RED first)

**Files:**
- Create: `packages/telemetry/__tests__/parity.test.ts`

- [ ] **Step 1: Read registry to understand routing structure**

Run: `grep -nA3 "EVENT_ROUTING" packages/telemetry/src/registry.ts | head -30`
Run: `sed -n '5320,5360p' packages/telemetry/src/registry.ts`

- [ ] **Step 2: Check if test infra exists**

Run: `ls packages/telemetry/__tests__/ packages/telemetry/vitest.config.ts packages/telemetry/package.json 2>/dev/null`

If `__tests__/` doesn't exist, create it. If no vitest config, check if root has it (`cat vitest.config.ts vitest.workspace.ts 2>/dev/null`).

- [ ] **Step 3: Write failing test**

Create `packages/telemetry/__tests__/parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { EVENT_ROUTING } from "../src/registry";

const REPO_ROOT = join(__dirname, "../../..");
const EDGE_FUNCTIONS_DIR = join(REPO_ROOT, "supabase/functions");

function findEdgeFunctionFiles(dir: string): string[] {
  const result: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry.startsWith("_") || entry.startsWith(".")) continue;
      result.push(...findEdgeFunctionFiles(path));
    } else if (entry === "index.ts") {
      result.push(path);
    }
  }
  return result;
}

describe("Engine Event Parity Contract (ADR-0180)", () => {
  it("every event with dual activity_trail+engine_event routing has parity", () => {
    const dualRouted = Object.entries(EVENT_ROUTING).filter(
      ([, routing]) =>
        routing.destinations.includes("activity_trail") &&
        routing.destinations.includes("engine_event"),
    );

    expect(dualRouted.length).toBeGreaterThan(0);
  });

  it("Edge Function direct-insert sites that write activity_trail also write engine_event for the same event_type", () => {
    const files = findEdgeFunctionFiles(EDGE_FUNCTIONS_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const activityMatches = [
        ...content.matchAll(/from\(["']activity_trail["']\)\.insert\(\s*\{[^}]*event_type:\s*["']([^"']+)["']/g),
      ];
      const engineMatches = [
        ...content.matchAll(/from\(["']engine_event["']\)\.insert\(\s*\{[^}]*event_type:\s*["']([^"']+)["']/g),
      ];

      const activityTypes = new Set(activityMatches.map((m) => m[1]));
      const engineTypes = new Set(engineMatches.map((m) => m[1]));

      for (const eventType of activityTypes) {
        // Find the matching registry routing by checking event-name conventions
        // Edge convention: dot-separated (`invitation.created`)
        // Registry convention: space-separated (`invitation created`)
        const registryName = eventType.replace(/\./g, " ");
        const routing = EVENT_ROUTING[registryName as keyof typeof EVENT_ROUTING];
        if (!routing) continue; // unregistered event — separate concern (L-0083)
        if (!routing.destinations.includes("engine_event")) continue; // exclusion documented in registry
        if (!engineTypes.has(eventType)) {
          violations.push(`${file}: writes activity_trail "${eventType}" but missing engine_event row`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(`Engine_event parity violations:\n${violations.join("\n")}`);
    }
  });
});
```

- [ ] **Step 4: Run test — expect FAIL on the parity violation test**

Run: `pnpm --filter @smartout/telemetry test parity` (or `pnpm test parity` if filter unavailable)
Expected: FAIL on second test with violations including `create-invitation/index.ts: writes activity_trail "invitation.dispatched" but missing engine_event row` (and similar for cancelled/expired/resent).

This is correct. The test now proves the gap. We will fix it by deleting the Edge Function in Task 17.

- [ ] **Step 5: Commit (test in failing state — TDD RED)**

```bash
git add packages/telemetry/__tests__/parity.test.ts
git commit -m "test(telemetry): add engine_event parity test (ADR-0180) - RED

Test currently fails for create-invitation Edge Function (5 events
write activity_trail without engine_event mirror). Will pass after
H.2 refactor deletes the Edge Function."
```

### Task 10: Create shared invitations library

**Files:**
- Create: `apps/web/src/lib/invitations.ts`

- [ ] **Step 1: Read current Edge Function to extract logic**

Run: `cat supabase/functions/create-invitation/index.ts`

Note these key sections:
- `censorToken()` (lines 27-29) — token censoring per ADR-0167
- `handleSingleInvite` (around line 290+)
- `handleBatchInvites` (around line 175+)
- `resolveInviterProfile` (around line 449)
- `sendEmailInvite` (around line 474) — replace with `@smartout/notifications`
- `sendSmsInvite` (around line 550) — replace with `@smartout/notifications`

- [ ] **Step 2: Read `@smartout/notifications` exports**

Run: `cat packages/notifications/src/index.ts`

Confirm `sendEmailBatch`, `sendDynamicTemplateBatch`, `sendSms` are exported.

- [ ] **Step 3: Read `@smartout/telemetry` emit signature**

Run: `head -60 packages/telemetry/src/emit.ts`

Confirm `emit({event, workspace_id, actor_id, ...})` is the signature.

- [ ] **Step 4: Create `apps/web/src/lib/invitations.ts`**

```ts
/**
 * Shared invitation creation logic.
 *
 * Used by:
 * - apps/web/src/app/api/admin/invite/route.ts (browser BFF)
 * - apps/web/src/app/dashboard/people/_actions/people-actions.ts (Server Action `resendInvitation`)
 * - Future agent capability "resend stale invite" (do NOT re-roll dispatch — call createInvitation)
 *
 * Replaces the deleted supabase/functions/create-invitation/ Edge Function.
 * Per ADR-0179 (browser → route handler) + ADR-0045 clarification (single dispatch surface).
 */

import { createAdminClient } from "@smartout/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmailBatch, sendSms } from "@smartout/notifications";
import { emit } from "@smartout/telemetry";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────

export const InviteChannelSchema = z.enum(["email", "sms", "link"]);
export type InviteChannel = z.infer<typeof InviteChannelSchema>;

export const SingleInviteSchema = z.object({
  workspace_id: z.string().uuid(),
  invite_type: z.literal("link"),
  channels: z.array(InviteChannelSchema).min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(["admin", "manager", "employee", "guest"]),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  department_ids: z.array(z.string().uuid()).optional(),
  team_ids: z.array(z.string().uuid()).optional(),
  invite_employment_type: z.enum(["employee", "guest"]).default("employee"),
  metadata: z.record(z.unknown()).optional(),
});
export type SingleInviteInput = z.infer<typeof SingleInviteSchema>;

export const BatchInviteSchema = z.object({
  workspace_id: z.string().uuid(),
  company_id: z.string().uuid(),
  invites: z.array(SingleInviteSchema.omit({ channels: true, invite_type: true, workspace_id: true })),
  skip_dispatch: z.boolean().default(false),
});
export type BatchInviteInput = z.infer<typeof BatchInviteSchema>;

export type DispatchOutcome = {
  channel: "email" | "sms" | "link_only";
  outcome: "sent" | "failed" | "skipped";
  reason?: string;
};

export type InvitationResult = {
  invitation_id: string;
  token: string;
  invite_url: string;
  outcomes: DispatchOutcome[];
};

// ── Helpers ───────────────────────────────────────────────

/**
 * Censor an invitation token for telemetry payloads per ADR-0167.
 * Tokens are credentials; never log the full value.
 */
export function censorToken(token: string): string {
  return token.substring(0, 8) + "...";
}

function getInviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.smartout.ai";
  return `${base}/invite/${token}`;
}

// ── Main entry ────────────────────────────────────────────

export async function createInvitation(
  input: SingleInviteInput,
  invitedByProfileId: string,
  client?: SupabaseClient,
): Promise<InvitationResult> {
  const admin = client ?? createAdminClient();

  // 1. Resolve workspace + company for telemetry context
  const { data: workspace, error: wsError } = await admin
    .from("workspace")
    .select("workspace_id, company_id, name")
    .eq("workspace_id", input.workspace_id)
    .single();
  if (wsError || !workspace) throw new Error(`Workspace not found: ${input.workspace_id}`);

  // 2. INSERT invitation row (RLS applies via JWT client when caller passes one)
  const { data: invitation, error: insertError } = await admin
    .from("invitation")
    .insert({
      workspace_id: input.workspace_id,
      company_id: workspace.company_id,
      invite_type: "link",
      email: input.email,
      phone: input.phone,
      role: input.role,
      first_name: input.first_name,
      last_name: input.last_name,
      department_ids: input.department_ids ?? [],
      team_ids: input.team_ids ?? [],
      invite_employment_type: input.invite_employment_type,
      metadata: { ...(input.metadata ?? {}), channels: input.channels },
      status: "pending",
      invited_by: invitedByProfileId,
    })
    .select("invitation_id, token")
    .single();
  if (insertError || !invitation) throw new Error(`Failed to create invitation: ${insertError?.message}`);

  // 3. Emit invitation.created (all 4 destinations via emit())
  await emit({
    event: "invitation created",
    workspace_id: input.workspace_id,
    actor_id: invitedByProfileId,
    invitation_id: invitation.invitation_id,
    token_preview: censorToken(invitation.token),
    channels: input.channels,
    role: input.role,
  } as never);

  // 4. Dispatch per channel
  const inviteUrl = getInviteUrl(invitation.token);
  const outcomes: DispatchOutcome[] = [];

  for (const channel of input.channels) {
    if (channel === "link") {
      outcomes.push({ channel: "link_only", outcome: "sent" });
      continue;
    }
    if (channel === "email" && input.email) {
      try {
        await sendEmailBatch([{
          to: input.email,
          subject: `Invitasjon til ${workspace.name}`,
          html: renderInvitationEmail({ inviteUrl, workspace: workspace.name, firstName: input.first_name }),
          classification: "transactional",
        }]);
        outcomes.push({ channel: "email", outcome: "sent" });
      } catch (err) {
        outcomes.push({ channel: "email", outcome: "failed", reason: String(err) });
      }
    }
    if (channel === "sms" && input.phone) {
      try {
        await sendSms(input.phone, `Du er invitert til ${workspace.name}: ${inviteUrl}`);
        outcomes.push({ channel: "sms", outcome: "sent" });
      } catch (err) {
        outcomes.push({ channel: "sms", outcome: "failed", reason: String(err) });
      }
    }
  }

  // 5. Emit invitation.dispatched once per channel attempted (parity with engine_event per ADR-0180)
  for (const outcome of outcomes) {
    await emit({
      event: "invitation dispatched",
      workspace_id: input.workspace_id,
      actor_id: invitedByProfileId,
      invitation_id: invitation.invitation_id,
      token_preview: censorToken(invitation.token),
      channel: outcome.channel,
      outcome: outcome.outcome,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
    } as never);
  }

  return {
    invitation_id: invitation.invitation_id,
    token: invitation.token,
    invite_url: inviteUrl,
    outcomes,
  };
}

function renderInvitationEmail(opts: { inviteUrl: string; workspace: string; firstName: string }): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2>Hei ${opts.firstName}!</h2>
  <p>Du er invitert til å bli med i <strong>${opts.workspace}</strong> på Smartout.</p>
  <p style="margin: 32px 0;">
    <a href="${opts.inviteUrl}" style="background: #0a0a0a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
      Aksepter invitasjon
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">Lenken er gyldig i 7 dager.</p>
</body>
</html>
  `.trim();
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: 0 errors. If `as never` casts complain, swap for explicit type narrowing (the registry has typed event payloads — use the precise shape from `packages/telemetry/src/registry.ts`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/invitations.ts
git commit -m "feat(invitations): shared library for createInvitation

Single chokepoint for invite creation: route handler, Server Action,
and future agent capabilities all call this. Uses @smartout/notifications
(SendGrid/Twilio) and @smartout/telemetry emit() (all 4 destinations).
Closes ADR-0045 silent violation. Per ADR-0179."
```

### Task 11: Create `/api/admin/invite/route.ts` route handler

**Files:**
- Create: `apps/web/src/app/api/admin/invite/route.ts`

- [ ] **Step 1: Read `withWorkspaceAdmin` signature**

Run: `sed -n '85,125p' apps/web/src/lib/billing/withAdmin.ts`

Confirm signature: `withWorkspaceAdmin<T>(workspace_id: string, fn: (userId: string, client: BillingClient) => Promise<AdminActionResult<T>>): Promise<AdminActionResult<T>>`

- [ ] **Step 2: Create the route handler**

Create `apps/web/src/app/api/admin/invite/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { withWorkspaceAdmin } from "@/lib/billing/withAdmin";
import { createInvitation, SingleInviteSchema, BatchInviteSchema } from "@/lib/invitations";
import { z } from "zod";

// Per ADR-0179 + ADR-0180. Vercel default 10s would truncate batch invites.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Detect mode (batch vs single) — preserves Edge Function's contract
    const isBatch = Array.isArray(body.invites);
    const schema = isBatch ? BatchInviteSchema : SingleInviteSchema;
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const workspaceId = parsed.data.workspace_id;

    const result = await withWorkspaceAdmin(workspaceId, async (userId, client) => {
      // Resolve inviter profile_id from user_id (canonical pattern)
      const { data: profile, error: profileError } = await client
        .from("profile")
        .select("profile_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .single();
      if (profileError || !profile) {
        return { ok: false as const, error: "Profile not found", code: "not_workspace_admin" as const };
      }

      if (isBatch) {
        const batchData = parsed.data as z.infer<typeof BatchInviteSchema>;
        const results = [];
        for (const invite of batchData.invites) {
          const r = await createInvitation(
            {
              ...invite,
              workspace_id: workspaceId,
              invite_type: "link",
              channels: batchData.skip_dispatch ? ["link"] : ["email"],
            },
            profile.profile_id,
            client,
          );
          results.push(r);
        }
        return { ok: true as const, data: { invitations: results } };
      } else {
        const single = parsed.data as z.infer<typeof SingleInviteSchema>;
        const r = await createInvitation(single, profile.profile_id, client);
        return { ok: true as const, data: r };
      }
    });

    if (!result.ok) {
      const status = result.code === "not_workspace_admin" ? 403 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result.data);
  } catch (err) {
    console.error("[api/admin/invite] Exception:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/admin/invite/route.ts
git commit -m "feat(api): add /api/admin/invite route handler

Same-origin BFF for invitation creation. withWorkspaceAdmin gate
(SECURITY DEFINER is_admin_in_workspace RPC). runtime=nodejs +
maxDuration=60. Replaces create-invitation Edge Function. Per ADR-0179."
```

### Task 12: Update `invite-member-dialog.tsx` to call route handler

**Files:**
- Modify: `apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx:434, :482`

- [ ] **Step 1: Read both call sites in context**

Run: `sed -n '425,500p' apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx`

- [ ] **Step 2: Replace single-mode invoke (line ~434)**

Replace:

```ts
response = await supabase.functions.invoke("create-invitation", { body: { ... } });
```

With:

```ts
const httpResponse = await fetch("/api/admin/invite", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    workspace_id: workspaceData.workspace_id,
    invite_type: "link",
    channels: channelList,
    email: channelList.includes("email") ? r.email.trim() : undefined,
    phone: channelList.includes("sms") ? r.phone.trim() : undefined,
    // ...preserve all existing body fields
  }),
});
if (!httpResponse.ok) {
  const errBody = await httpResponse.json().catch(() => ({ error: "Network error" }));
  response = { data: null, error: errBody };
} else {
  const data = await httpResponse.json();
  response = { data, error: null };
}
```

- [ ] **Step 3: Replace batch-mode invoke (line ~482)**

Same pattern — fetch `/api/admin/invite` with body containing `invites: [...]` array (the route detects batch mode).

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/invite-member-dialog.tsx
git commit -m "refactor(people): invite-dialog uses /api/admin/invite

Replaces direct Edge Function invoke. Same-origin = no CORS. Per ADR-0179."
```

### Task 13: Update `people-actions.ts:413` (`resendInvitation`) to call shared lib

**Files:**
- Modify: `apps/web/src/app/dashboard/people/_actions/people-actions.ts:413`

- [ ] **Step 1: Read context**

Run: `sed -n '380,440p' apps/web/src/app/dashboard/people/_actions/people-actions.ts`

- [ ] **Step 2: Replace `supabase.functions.invoke("create-invitation", ...)` with direct call to `createInvitation()`**

Pattern:

```ts
import { createInvitation } from "@/lib/invitations";

// Inside resendInvitation Server Action:
const result = await createInvitation(
  {
    workspace_id: invitation.workspace_id,
    invite_type: "link",
    channels: ["email"],
    email: invitation.email,
    role: invitation.role,
    first_name: invitation.first_name,
    last_name: invitation.last_name,
    department_ids: invitation.department_ids,
    invite_employment_type: invitation.invite_employment_type,
  },
  inviter_profile_id,
);
```

Server Action runs on server, no `fetch()` needed — direct function call.

- [ ] **Step 3: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/people/_actions/people-actions.ts
git commit -m "refactor(people): resendInvitation calls shared createInvitation lib

Server Action no longer invokes Edge. Same chokepoint as /api/admin/invite.
Per ADR-0179."
```

### Task 14: Update E2E test to hit new route

**Files:**
- Modify: `apps/e2e/tests/journey-employee-invitation.spec.ts:83`

- [ ] **Step 1: Read context**

Run: `sed -n '70,140p' apps/e2e/tests/journey-employee-invitation.spec.ts`

- [ ] **Step 2: Replace direct Edge invocation**

Find:

```ts
const response = await fetch(`${SUPABASE_URL}/functions/v1/create-invitation`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ ... }),
});
```

Replace with:

```ts
const response = await fetch(`${WEB_URL}/api/admin/invite`, {
  method: "POST",
  headers: {
    "Cookie": cookieHeader, // session cookie, not Bearer
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ ... }),
});
```

`WEB_URL` should be defined as `process.env.E2E_WEB_URL ?? "http://localhost:3050"` at top of file. `cookieHeader` is the Playwright session cookie — confirm Playwright auth fixture exposes this.

- [ ] **Step 3: Run E2E locally to verify**

Run: `pnpm --filter @smartout/e2e exec playwright test journey-employee-invitation`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/tests/journey-employee-invitation.spec.ts
git commit -m "test(e2e): journey-employee-invitation uses /api/admin/invite

Auth header changes from Bearer to Cookie (Next session). Per ADR-0179."
```

### Task 15: Update health registry + Delete create-invitation Edge Function

**Files:**
- Modify: `apps/web/src/app/platform-admin/health/_components/api-registry.ts:329`
- Delete: `supabase/functions/create-invitation/`
- Modify: `supabase/config.toml` (remove `[functions.create-invitation]` block)

- [ ] **Step 1: Update health registry**

Read `apps/web/src/app/platform-admin/health/_components/api-registry.ts:325-340`. Find the entry for `create-invitation` (path = `/functions/v1/create-invitation`, category = `edge-function`). Update:
- `path` → `/api/admin/invite`
- `category` → `route-handler`
- Description → "Browser BFF for invitation creation (replaces Edge Function per ADR-0179)"

- [ ] **Step 2: Delete Edge Function directory**

Run: `git rm -r supabase/functions/create-invitation/`

- [ ] **Step 3: Remove `[functions.create-invitation]` block from config.toml**

Run: `sed -n '420,440p' supabase/config.toml`

Find the block (looks like `[functions.create-invitation]` followed by `verify_jwt = ...` and possibly other settings). Delete the entire block including header.

- [ ] **Step 4: Run parity test — should now PASS**

Run: `pnpm --filter @smartout/telemetry test parity`
Expected: PASS. The deletion eliminates the 5 Edge direct-insert sites that violated parity.

- [ ] **Step 5: Run full E2E one more time**

Run: `pnpm --filter @smartout/e2e exec playwright test journey-employee-invitation`
Expected: PASS — full path (invite → dispatch → opened → accepted).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/platform-admin/health/_components/api-registry.ts supabase/config.toml supabase/functions/create-invitation/
git commit -m "refactor(invitations): delete create-invitation Edge Function

Replaced by /api/admin/invite route handler (Wave H). Closes ADR-0045
silent violation, engine_event parity gap, and CORS pain. Trust Gate
condition 4 satisfied (parity test now green). Per ADR-0179 + ADR-0180."
```

### Task 16: Create `/platform-admin/dev-outbox` stub utility page

**Files:**
- Create: `apps/web/src/app/platform-admin/dev-outbox/page.tsx`

- [ ] **Step 1: Read sibling platform-admin page for layout pattern**

Run: `cat apps/web/src/app/platform-admin/users/page.tsx | head -60`

- [ ] **Step 2: Create page**

Create `apps/web/src/app/platform-admin/dev-outbox/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";

export const metadata = { title: "dev_outbox — Smartout" };

export default async function DevOutboxPage() {
  // Hard prod gate (defense-in-depth — diagonal stripe + banner + mono title)
  if (process.env.NODE_ENV === "production") notFound();

  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  // Note: no actual outbox table query yet — Wave H ships the gate + UI scaffold.
  // Future Wave I will wire to notification_outbox extension with dispatch_mode='inbucket'.
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(0,0,0,0.02) 12px, rgba(0,0,0,0.02) 24px)",
      }}
    >
      <div className="sticky top-0 z-10 bg-[oklch(0.78_0.18_60)] text-black px-4 py-2 text-center text-sm font-mono border-b border-border">
        ⚠ DEV ENVIRONMENT — these messages were captured locally and never delivered.
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="font-mono text-2xl text-foreground mb-2">dev_outbox</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Locally-intercepted email + SMS dispatch. Production builds 404 this route.
        </p>

        <div className="border border-border rounded-md p-12 text-center text-muted-foreground">
          <p>No messages captured yet.</p>
          <p className="mt-2 text-xs">
            Wire-up to <code className="font-mono">notification_outbox</code> table with{" "}
            <code className="font-mono">dispatch_mode='inbucket'</code> ships in Wave I.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: 0 errors.

- [ ] **Step 4: Verify route renders in dev**

Run: `pnpm --filter @smartout/web dev` (background, port 3050)
Open: `http://localhost:3050/platform-admin/dev-outbox`
Expected: page renders with banner, mono title, diagonal stripe, "no messages" panel.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/platform-admin/dev-outbox/page.tsx
git commit -m "feat(platform-admin): add dev-outbox stub utility page

3 affordances (banner + mono title + diagonal stripe) + notFound() in
prod. UI scaffold for Wave I notification_outbox extension."
```

### Task 17: Close `/update-password` ghost route (carry from prior council precondition #3)

**Files:**
- Check: `apps/web/src/app/update-password/page.tsx` exists?

- [ ] **Step 1: Verify ghost route status**

Run: `ls apps/web/src/app/update-password/page.tsx 2>/dev/null && echo EXISTS || echo MISSING`

If the file exists, confirm it's not a stub (open and verify it has a real password-update form). If real, the ghost-route precondition is already closed — skip this task.

- [ ] **Step 2: If MISSING, check if it's referenced from PUBLIC_ROUTES or middleware**

Run: `grep -rn "update-password" apps/web/src/middleware.ts apps/web/src/lib/ 2>/dev/null | head -10`

- [ ] **Step 3: If missing AND referenced, create the page**

Create `apps/web/src/app/update-password/page.tsx`:

```tsx
import { Suspense } from "react";
import { UpdatePasswordClient } from "./_client";

export const metadata = { title: "Oppdater passord — Smartout" };

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Laster...</div>}>
      <UpdatePasswordClient />
    </Suspense>
  );
}
```

Create `apps/web/src/app/update-password/_client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry/client";

export function UpdatePasswordClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passordene matcher ikke"); return; }
    if (password.length < 8) { setError("Minst 8 tegn"); return; }
    setSubmitting(true);
    const supabase = createClient();
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) { setError(updErr.message); setSubmitting(false); return; }

    await emit({
      event: "auth password_reset_completed",
      workspace_id: null,
      actor_id: "self",
    } as never);

    router.push("/dashboard");
  }

  return (
    <div className="max-w-md mx-auto pt-16 px-6">
      <h1 className="font-heading text-2xl mb-6">Oppdater passord</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nytt passord"
          required
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Bekreft passord"
          required
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 bg-foreground text-background rounded-md disabled:opacity-50"
        >
          {submitting ? "Oppdaterer..." : "Oppdater passord"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: 0 errors.

- [ ] **Step 5: Commit + push H.2**

```bash
git add apps/web/src/app/update-password/
git commit -m "feat(auth): close /update-password ghost route

Carry from 2026-04-20 council precondition #3 (L-0089). Real form,
emits 'auth password_reset_completed', redirects to dashboard."
git push origin development
```

H.2 complete. Trust Gate conditions 4 + 5 satisfied (parity test green, route handler has runtime+maxDuration).

---

## PR H.3 — Cleanup (2 tasks, ~20 min)

### Task 18: Delete dead `supabase-edge-invoke.ts` wrapper

**Files:**
- Delete: `apps/web/src/lib/supabase-edge-invoke.ts`

- [ ] **Step 1: Verify zero call sites**

Run: `grep -rn "invokeEdgeFunction\|supabase-edge-invoke" apps/web/src/ 2>/dev/null`
Expected: 0 results.

- [ ] **Step 2: Delete file**

Run: `git rm apps/web/src/lib/supabase-edge-invoke.ts`

- [ ] **Step 3: Typecheck**

Run: `pnpm turbo typecheck --filter=@smartout/web`
Expected: 0 errors (no callers).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove unused supabase-edge-invoke wrapper

Zero call sites — was 503-detection shim for browser → Edge invokes.
Wave H removed all browser invokes. Wrapper has no purpose."
```

### Task 19: Write Wave H handoff doc + Council log entry + push H.3

**Files:**
- Create: `docs/HANDOFF-wave-h.md`
- Modify: `docs/council/COUNCIL-LOG.md`

- [ ] **Step 1: Write handoff**

Create `docs/HANDOFF-wave-h.md`:

```markdown
---
title: Wave H — Auth & Invitation Refactor Handoff
status: complete
updated: 2026-04-22
created: 2026-04-22
module: auth
tags: [handoff, wave-h, browser-bff, route-handlers]
---

# Wave H Handoff

## Summary

Eliminated browser → Edge Function cross-origin pattern for invitation creation. Deleted `create-invitation` Edge Function (~600 lines), replaced with `/api/admin/invite` route handler (~120 lines + shared lib). Migrated 5 other browser-side `supabase.functions.invoke()` sites to same-origin proxy routes. Closed prior council's `/update-password` ghost-route precondition. Landed 2 new ADRs + 3 amendments + 1 clarification + parity test.

## Decisions

- ADR-0179 NEW — Browser-Originated Mutations Route Through Next.js Route Handlers
- ADR-0180 NEW — Engine Event Parity Contract for Telemetry
- ADR-0029 amendment — Mutation Surface Selection table
- ADR-0123 amendment — `create-invitation` removed, tripwire 3→2
- ADR-0045 clarification — single dispatch surface

## Learnings

- L-0099 — phantom-emit briefing-staleness: Edge direct-inserts invisible to grep `emit\(`. Phase 2.5 fact-check must scan `supabase/functions/**/index.ts` for `from("activity_trail").insert` patterns.
- L-0100 — audit-inflation 4th occurrence (Web Perf, Gate Migration, Year Wheel, Auth-Invitation Wave H). Briefings without code-trace verification inflate scope.
- L-0101 — `supabase.functions.invoke()` from browser is anti-pattern (CORS + ADR-0045 silent violation + telemetry parity gap). Codified as ADR-0179.
- L-0102 — ADR-0123 tripwire fired in reverse direction. Counter went DOWN via migration (3→2 endpoints), threshold lowered. Tripwires can ratchet either direction.

## Known issues / debt

- Wave I scope (separate sortie): apply Hybrid C fail-fast pattern to remaining Edge Functions (push-dispatch, process-notifications, fire-delayed-triggers).
- 21 remaining Edge Functions still use `*` wildcard CORS (security smell, not breaking).
- `notification_outbox` extension with `dispatch_mode='inbucket'` (for actual local mail capture) deferred to Wave I.
- `dev-outbox` page is UI scaffold only — wires to extended `notification_outbox` in Wave I.

## Next steps

- Wave I: 5 remaining browser invoke sites already proxied (H.1) — review for inline opportunities.
- Wave I: `notification_outbox` extension migration + `_shared/dispatch.ts` Deno helper (for remaining Edge Functions that still dispatch).
- Mobile parity check: `accept-invitation` stays Edge per ADR-0123 (pre-auth, mobile dependency at `apps/mobile/app/(auth)/verify.tsx:289`).
```

- [ ] **Step 2: Append council log entry to `docs/council/COUNCIL-LOG.md`**

Find the table section (likely starts with `| Date | Topic |` header). Add row:

```markdown
| 2026-04-22 | Auth & Invitation Wave H Amendment (`2026-04-22-auth-invitation-wave-h-amendment.md`) | architecture (continuation) | **APPROVE WITH CHANGES → strengthened by re-review** (Trust Gate CONDITIONAL PASS, 5 conditions) | steward (chair, Phase 3 + Phase 5 + re-review), supervisor (re-review with full call-site audit), system-agent-coordinator (re-review with Trust Gate + ADR-0029 interaction), frontend-designer (Phase 3 only — re-review skipped, server-side refactor) + general-purpose (Phase 2.5 fact-check, 2 false briefing claims caught: "0 emit sites" → 13 emit sites; "auth/ test directory missing" → exists as auth-invitation/) | Yes — 2026-04-20 Auth & Invitation Spec Scope Council (APPROVE WITH CHANGES) held. Wave H closes preconditions #1, #2, #3 (engine_event parity + emit fix + ghost-route). Mid-council premise change: Pontus rejected CORS-sweep approach in favor of Option 2 (delete Edge, inline into Next.js route handler). | ADR-0179 NEW (browser-originated mutations via Next.js route handlers), ADR-0180 NEW (engine_event parity contract), ADR-0029 amendment (Mutation Surface Selection table), ADR-0123 amendment (create-invitation removed, tripwire 3→2), ADR-0045 clarification (single dispatch surface). | L-0099 (phantom-emit briefing-staleness for Edge direct-inserts), L-0100 (audit-inflation 4th occurrence), L-0101 (browser invoke anti-pattern), L-0102 (tripwire fired in reverse direction). **Semantic conflict resolution**: 8 pairs classified same/different/partial in Phase 5 synthesis. Critical reframe mid-council: briefing's L-0083 4th-occurrence claim falsified by code-trace; real issues are engine_event parity gap + fail-open emit + ADR-0045 silent violation. **Trust Gate**: CONDITIONAL PASS, 5 conditions (ADRs land before refactor, parity test green before merge, runtime=nodejs+maxDuration=60). **Implementation**: 4 PRs (H.0 ADRs → H.1 5 proxies → H.2 invite refactor → H.3 cleanup). Plan at `docs/superpowers/plans/2026-04-22-auth-invitation-wave-h.md`. User approved verdict. |
```

- [ ] **Step 3: Commit + push**

```bash
git add docs/HANDOFF-wave-h.md docs/council/COUNCIL-LOG.md
git commit -m "docs(wave-h): handoff + council log entry

Wave H complete. 4 PRs landed. 2 ADRs + 3 amendments + 1 clarification.
Trust Gate satisfied (5 conditions). Next: Wave I (remaining Edge
Functions audit, notification_outbox extension)."
git push origin development
```

H.3 complete. Wave H closed.

---

## Verification (run after all 19 tasks)

- [ ] `pnpm turbo typecheck` passes globally (0 errors)
- [ ] `pnpm --filter @smartout/telemetry test parity` passes (parity test GREEN)
- [ ] `pnpm --filter @smartout/e2e exec playwright test journey-employee-invitation` passes
- [ ] `grep -rn "supabase.functions.invoke.*create-invitation" apps/` returns 0 results
- [ ] `ls supabase/functions/create-invitation/ 2>/dev/null` returns "No such file or directory"
- [ ] `grep "create-invitation" supabase/config.toml` returns 0 results
- [ ] `ls apps/web/src/lib/supabase-edge-invoke.ts 2>/dev/null` returns "No such file or directory"
- [ ] Browser test: open `http://acme.localhost:3050/dashboard/people` (with `/etc/hosts` entry for `acme.localhost`), invite a user, verify it arrives (Inbucket if configured) and creates `invitation` row with correct status

---

## Trust Gate Verification

- [ ] Trust Gate #1: ADR-0179 status `accepted`, dated 2026-04-22, exists at `docs/decisions/0179-browser-mutations-via-nextjs-route-handlers.md`
- [ ] Trust Gate #2: ADR-0029 contains "Mutation Surface Selection (Amendment 2026-04-22)" section
- [ ] Trust Gate #3: ADR-0123 contains "Amendment 2026-04-22" with tripwire 3→2
- [ ] Trust Gate #4: `packages/telemetry/__tests__/parity.test.ts` exists, runs in CI, currently GREEN
- [ ] Trust Gate #5: `apps/web/src/app/api/admin/invite/route.ts` contains `export const runtime = "nodejs"` AND `export const maxDuration = 60`

All 5 must pass before merging Wave H to `preview` (which Pontus does manually).
