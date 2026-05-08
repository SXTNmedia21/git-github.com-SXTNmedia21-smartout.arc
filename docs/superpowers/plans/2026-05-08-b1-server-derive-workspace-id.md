---
title: "B1 — Server-Derive workspace_id (Forgery Fix)"
status: ready
created: 2026-05-08
updated: 2026-05-08
module: MODULE_BOTSSON
tags: [security, adr-0151, botsson, harness]
adr: [ADR-0151]
sortie: feat/b1-server-derive-workspace-id
---

# B1 — Server-Derive workspace_id Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate forgeable `workspace_id` on the Ultravox voice path. Server derives `workspaceId` from JWT-resolved profile only. Mismatched `body.workspace_id` returns 403.

**Architecture:** Two callsites, defence-in-depth. Primary fix at BFF entry (`/api/wizard/start`) where authenticated cookie session resolves profile → workspaceId. Secondary fix at stage-engine adapter where BFF-supplied workspace_id is ignored when an authoritative `auth.workspaceId` exists on the API-key auth context. Onboarding path (no authenticated user) unaffected.

**Tech Stack:** Next.js App Router (Route Handlers), Hono on stage-engine, Supabase server client, Vitest.

---

## Files

- Modify: `apps/web/src/app/api/wizard/start/route.ts:80` — drop body fallback, reject mismatch with 403
- Modify: `services/stage-engine/src/routes/adapters/ultravox.ts:56` — prefer `auth.workspaceId`, reject body mismatch
- Create: `apps/web/src/app/api/wizard/start/__tests__/route.test.ts` — Vitest cases
- Create: `services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts` — Vitest cases

## Self-Review Notes

Onboarding path: when `user === null` AND `missionId === "onboarding-interview"`, no profile exists yet. `workspaceId` stays undefined and the existing `if (!workspaceId && missionId !== "onboarding-interview")` branch already passes through. Don't break this path.

ADR-0151 Invariant I4 (server-derived IDs) covers `workspace_id`, `profile_id`, and `user_id` for authenticated calls. This plan touches `workspace_id`. `profile_id` is already derived from `user.id` lookup (line 81). `user_id` is already taken from `user.id` (line 91 of route).

---

## Task 1: Failing test — wizard/start rejects body workspace_id mismatch

**Files:**
- Create: `apps/web/src/app/api/wizard/start/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/app/api/wizard/start/__tests__/route.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockFromProfile = vi.fn();
const mockFetch = vi.fn();

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "profile") return mockFromProfile();
      throw new Error(`unexpected table: ${table}`);
    },
  })),
}));

beforeEach(() => {
  vi.resetAllMocks();
  // @ts-expect-error process.env mutation in test
  process.env.STAGE_ENGINE_URL = "http://stage-engine.test";
  // @ts-expect-error process.env mutation in test
  process.env.STAGE_ENGINE_API_KEY = "test-key";
  vi.stubGlobal("fetch", mockFetch);
});

describe("POST /api/wizard/start — workspace_id forgery rejection (ADR-0151)", () => {
  it("returns 403 when body.workspace_id differs from JWT-resolved profile.workspace_id", async () => {
    const realWorkspaceId = "11111111-1111-1111-1111-111111111111";
    const forgedWorkspaceId = "22222222-2222-2222-2222-222222222222";

    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-uuid-aaa" } },
    });
    mockFromProfile.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => ({
            single: async () => ({
              data: { profile_id: "profile-uuid-bbb", workspace_id: realWorkspaceId },
            }),
          }),
        }),
      }),
    });

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/wizard/start", {
      method: "POST",
      body: JSON.stringify({
        mission_id: "mr-botsson",
        workspace_id: forgedWorkspaceId,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/FORBIDDEN|workspace/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web vitest run apps/web/src/app/api/wizard/start/__tests__/route.test.ts`

Expected: FAIL — current line 80 `body.workspace_id ?? profile?.workspace_id` accepts forged value, returns 200 with stage-engine fetch.

- [ ] **Step 3: Commit failing test**

```bash
git add apps/web/src/app/api/wizard/start/__tests__/route.test.ts
git commit -m "test(wizard/start): failing case for body workspace_id forgery (ADR-0151)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Fix wizard/start — server-derive workspace_id

**Files:**
- Modify: `apps/web/src/app/api/wizard/start/route.ts:73-82`

- [ ] **Step 1: Apply fix**

Replace existing block:

```typescript
    // Look up profile — may not exist yet during onboarding
    let workspaceId: string | undefined;
    let profileId: string | undefined;
    if (user) {
      const { data: profile } = await supabase
        .from("profile")
        .select("profile_id, workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      workspaceId = body.workspace_id ?? profile?.workspace_id;
      profileId = profile?.profile_id;
    }
```

With:

```typescript
    // Look up profile — may not exist yet during onboarding.
    // ADR-0151 — workspace_id is derived server-side from JWT-resolved profile.
    // body.workspace_id is rejected if it disagrees with the authoritative value.
    let workspaceId: string | undefined;
    let profileId: string | undefined;
    if (user) {
      const { data: profile } = await supabase
        .from("profile")
        .select("profile_id, workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      const resolvedWorkspaceId = profile?.workspace_id;
      if (
        typeof body.workspace_id === "string" &&
        body.workspace_id.length > 0 &&
        body.workspace_id !== resolvedWorkspaceId
      ) {
        console.warn("[wizard/start] workspace_id_mismatch", {
          request_id: requestId,
          body_workspace_id: body.workspace_id,
          resolved_workspace_id: resolvedWorkspaceId ?? null,
          user_id: user.id,
        });
        return NextResponse.json(
          { error: "FORBIDDEN", message: "workspace_id mismatch" },
          { status: 403 },
        );
      }
      workspaceId = resolvedWorkspaceId;
      profileId = profile?.profile_id;
    }
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter web vitest run apps/web/src/app/api/wizard/start/__tests__/route.test.ts`

Expected: PASS — 403 returned, fetch not called.

- [ ] **Step 3: Add happy-path test**

Append to test file:

```typescript
  it("returns 200 when body.workspace_id matches profile.workspace_id", async () => {
    const realWorkspaceId = "11111111-1111-1111-1111-111111111111";

    mockGetUser.mockResolvedValue({ data: { user: { id: "user-uuid-aaa" } } });
    mockFromProfile.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => ({
            single: async () => ({
              data: { profile_id: "profile-uuid-bbb", workspace_id: realWorkspaceId },
            }),
          }),
        }),
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        session_id: "sess-1",
        join_url: "wss://test",
        call_id: "call-1",
      }),
    });

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/wizard/start", {
      method: "POST",
      body: JSON.stringify({
        mission_id: "mr-botsson",
        workspace_id: realWorkspaceId,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(fetchBody.workspace_id).toBe(realWorkspaceId);
  });

  it("returns 200 with no workspaceId when body omits workspace_id (server-derives)", async () => {
    const realWorkspaceId = "11111111-1111-1111-1111-111111111111";

    mockGetUser.mockResolvedValue({ data: { user: { id: "user-uuid-aaa" } } });
    mockFromProfile.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => ({
            single: async () => ({
              data: { profile_id: "profile-uuid-bbb", workspace_id: realWorkspaceId },
            }),
          }),
        }),
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: "s", join_url: "u", call_id: "c" }),
    });

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/wizard/start", {
      method: "POST",
      body: JSON.stringify({ mission_id: "mr-botsson" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(fetchBody.workspace_id).toBe(realWorkspaceId);
  });

  it("returns 200 for onboarding-interview when no user is authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: "s", join_url: "u", call_id: "c" }),
    });

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/wizard/start", {
      method: "POST",
      body: JSON.stringify({ mission_id: "onboarding-interview" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockFromProfile).not.toHaveBeenCalled();
  });
```

- [ ] **Step 4: Run all wizard/start tests**

Run: `pnpm --filter web vitest run apps/web/src/app/api/wizard/start/__tests__/route.test.ts`

Expected: 4 PASS (forge-rejected, match-accepted, omit-derives, onboarding-passthrough).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/wizard/start/route.ts apps/web/src/app/api/wizard/start/__tests__/route.test.ts
git commit -m "fix(wizard/start): reject forged workspace_id (ADR-0151)

body.workspace_id no longer overrides JWT-resolved profile.workspace_id.
A non-matching value returns 403 with structured warning log. Onboarding
path (no user) and matching/omitted body unaffected.

Closes B1 callsite 1 of 2 from 2026-05-08 botsson harness audit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Failing test — stage-engine ultravox adapter rejects body workspace_id mismatch

**Files:**
- Create: `services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts`

- [ ] **Step 1: Inspect existing auth context structure**

Read: `services/stage-engine/src/types/auth.ts` and `services/stage-engine/src/middleware/auth.ts` to confirm `AuthContext` exposes `workspaceId?: string` and how `c.get("auth")` is populated. Adapt mock pattern below to match.

- [ ] **Step 2: Write the failing test**

```typescript
// services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("../../../core/session-manager.js", () => ({
  createSession: vi.fn(),
  loadAuthorizedSession: vi.fn(),
  loadMission: vi.fn(),
}));
vi.mock("../../../lib/ultravox.js", () => ({
  createUltravoxCall: vi.fn(),
  buildUltravoxTools: vi.fn(() => []),
}));

import { ultravox } from "../ultravox.js";
import { createSession } from "../../../core/session-manager.js";
import { createUltravoxCall } from "../../../lib/ultravox.js";

beforeEach(() => {
  vi.resetAllMocks();
});

function buildAppWithAuth(auth: { workspaceId?: string; userId?: string } | null) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    await next();
  });
  app.route("/", ultravox);
  return app;
}

describe("POST /adapters/ultravox/create-call — workspace_id forgery rejection (ADR-0151)", () => {
  it("returns 403 when body.workspace_id mismatches auth.workspaceId", async () => {
    const realWorkspaceId = "11111111-1111-1111-1111-111111111111";
    const forgedWorkspaceId = "22222222-2222-2222-2222-222222222222";
    const app = buildAppWithAuth({ workspaceId: realWorkspaceId, userId: "u" });

    const res = await app.request("/adapters/ultravox/create-call", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        mission_id: "mr-botsson",
        workspace_id: forgedWorkspaceId,
      }),
    });

    expect(res.status).toBe(403);
    expect(createSession).not.toHaveBeenCalled();
    expect(createUltravoxCall).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @smartout/stage-engine vitest run services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts`

Expected: FAIL — current line 56 silently uses body value.

- [ ] **Step 4: Commit failing test**

```bash
git add services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts
git commit -m "test(stage-engine/ultravox): failing case for body workspace_id forgery

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Fix stage-engine ultravox adapter — prefer auth.workspaceId

**Files:**
- Modify: `services/stage-engine/src/routes/adapters/ultravox.ts:48-63`

- [ ] **Step 1: Apply fix**

Replace existing handler block (immediately after `const auth = c.get("auth");`):

```typescript
ultravox.post("/adapters/ultravox/create-call", zValidator("json", createCallSchema), async (c) => {
  const body = c.req.valid("json");
  const auth = c.get("auth");

  // ADR-0151 — workspace_id is server-derived. When auth carries an
  // authoritative workspaceId (JWT-backed BFF call), body.workspace_id is
  // rejected unless it matches. When auth is API-key-only without a pinned
  // workspaceId (legacy onboarding path), the body value is accepted because
  // the BFF is the trust boundary upstream.
  const authWorkspaceId =
    typeof auth === "object" && auth !== null && "workspaceId" in auth
      ? (auth as { workspaceId?: string }).workspaceId
      : undefined;
  if (
    authWorkspaceId &&
    typeof body.workspace_id === "string" &&
    body.workspace_id.length > 0 &&
    body.workspace_id !== authWorkspaceId
  ) {
    return c.json(
      { error: "FORBIDDEN", message: "workspace_id mismatch", status: 403 },
      403,
    );
  }
  const effectiveWorkspaceId = authWorkspaceId ?? body.workspace_id ?? undefined;

  // Start engine session
  const session = await createSession(
    {
      mission_id: body.mission_id,
      workspace_id: effectiveWorkspaceId,
      user_id: body.user_id,
      profile_id: body.profile_id,
      context: body.context,
      channel: "voice",
    },
    auth,
  );
```

- [ ] **Step 2: Run failing-case test**

Run: `pnpm --filter @smartout/stage-engine vitest run services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts`

Expected: PASS.

- [ ] **Step 3: Add happy-path tests**

Append to test file:

```typescript
  it("accepts body.workspace_id when it matches auth.workspaceId", async () => {
    const realWorkspaceId = "11111111-1111-1111-1111-111111111111";
    const app = buildAppWithAuth({ workspaceId: realWorkspaceId, userId: "u" });

    vi.mocked(createSession).mockResolvedValue({
      session_id: "s",
      workspace_id: realWorkspaceId,
      mission_id: "mr-botsson",
      status: "active",
      current_stage_id: null,
      system_prompt: "x",
    } as never);
    vi.mocked(createUltravoxCall).mockResolvedValue({
      ok: true,
      data: { callId: "c", joinUrl: "u" },
    } as never);

    const res = await app.request("/adapters/ultravox/create-call", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        mission_id: "mr-botsson",
        workspace_id: realWorkspaceId,
      }),
    });

    expect(res.status).toBe(200);
    const sessionArg = vi.mocked(createSession).mock.calls[0][0];
    expect(sessionArg.workspace_id).toBe(realWorkspaceId);
  });

  it("falls back to body.workspace_id when auth has no workspaceId (onboarding path)", async () => {
    const onboardingWorkspaceId = "33333333-3333-3333-3333-333333333333";
    const app = buildAppWithAuth({ userId: "u" });

    vi.mocked(createSession).mockResolvedValue({
      session_id: "s",
      workspace_id: onboardingWorkspaceId,
      mission_id: "onboarding-interview",
      status: "active",
      current_stage_id: null,
      system_prompt: "x",
    } as never);
    vi.mocked(createUltravoxCall).mockResolvedValue({
      ok: true,
      data: { callId: "c", joinUrl: "u" },
    } as never);

    const res = await app.request("/adapters/ultravox/create-call", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: JSON.stringify({
        mission_id: "onboarding-interview",
        workspace_id: onboardingWorkspaceId,
      }),
    });

    expect(res.status).toBe(200);
    const sessionArg = vi.mocked(createSession).mock.calls[0][0];
    expect(sessionArg.workspace_id).toBe(onboardingWorkspaceId);
  });
```

- [ ] **Step 4: Run all ultravox adapter tests**

Run: `pnpm --filter @smartout/stage-engine vitest run services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts`

Expected: 3 PASS (forge-rejected, match-accepted, onboarding-fallback).

- [ ] **Step 5: Commit**

```bash
git add services/stage-engine/src/routes/adapters/ultravox.ts services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts
git commit -m "fix(stage-engine/ultravox): prefer auth.workspaceId over body (ADR-0151)

When the BFF passes an authenticated auth context with a pinned workspaceId,
body.workspace_id is rejected unless it matches. Onboarding path (no auth
workspaceId) keeps body fallback because the BFF is upstream trust boundary.

Closes B1 callsite 2 of 2 from 2026-05-08 botsson harness audit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Verification — typecheck + full vitest suites

- [ ] **Step 1: Typecheck both touched packages**

Run: `pnpm --filter web typecheck && pnpm --filter @smartout/stage-engine typecheck`

Expected: 0 errors.

- [ ] **Step 2: Run wizard/start + ultravox vitest suites**

Run:
```
pnpm --filter web vitest run apps/web/src/app/api/wizard/start/
pnpm --filter @smartout/stage-engine vitest run services/stage-engine/src/routes/adapters/
```

Expected: all green.

- [ ] **Step 3: Manual probe (curl) — optional belt-and-suspenders**

Reproduce 403 against locally running stack (`pnpm dev`):

```bash
# Forge attempt — should return 403
curl -i -X POST http://localhost:3060/api/wizard/start \
  -H "Content-Type: application/json" \
  -H "Cookie: <authenticated session cookie>" \
  -d '{"mission_id":"mr-botsson","workspace_id":"00000000-0000-0000-0000-000000000000"}'

# Expected: HTTP/1.1 403 Forbidden
# Body: {"error":"FORBIDDEN","message":"workspace_id mismatch"}
```

Authoritative version (matching workspace_id) returns 200 + joinUrl.

---

## Task 6: Decision-log entry

**Files:**
- Modify: `docs/decisions/0000-decision-log.md` — add reference to ADR-0151 reaffirmation if ADR-0151 still says `proposed` in the row table; otherwise no new ADR needed (this is enforcement of an accepted ADR).

- [ ] **Step 1: Verify ADR-0151 status**

Run: `grep -A 1 "ADR_0151\|0151-" docs/decisions/*.md | head -20`

If `status: accepted` → no new ADR, this is implementation. Skip to Step 2.
If `status: proposed` → write a 1-paragraph note in handoff that B1 enforces ADR-0151 invariant I4 on the Ultravox path, and request council to flip ADR-0151 to `accepted` in the same window as ADR-0276/0284/0282.

- [ ] **Step 2: Append handoff note**

Append to bottom of plan execution: `docs/HANDOFF-b1-server-derive-workspace-id.md` summarizing 2 callsites fixed, 7 tests added, ADR-0151 invariant I4 enforced.

---

## Acceptance Criteria

- [ ] `pnpm --filter web vitest run apps/web/src/app/api/wizard/start/__tests__/route.test.ts` — 4 PASS
- [ ] `pnpm --filter @smartout/stage-engine vitest run services/stage-engine/src/routes/adapters/__tests__/ultravox.test.ts` — 3 PASS
- [ ] `pnpm --filter web typecheck` — 0 errors
- [ ] `pnpm --filter @smartout/stage-engine typecheck` — 0 errors
- [ ] Manual curl probe: forged workspace_id → 403; matching workspace_id → 200
- [ ] No commit touches `services/voice-agent/`, `apps/mobile/`, `packages/ai/`, or any path outside the two named files + their `__tests__/` siblings (scope guard — anything else is scope creep, blocks merge)

## Estimated Time

30 minutes for an experienced engineer. 60 minutes including review.

## Rollback

Pure code change in two files. Revert the two commits, no migration to undo. Forgery surface returns to pre-fix state.
