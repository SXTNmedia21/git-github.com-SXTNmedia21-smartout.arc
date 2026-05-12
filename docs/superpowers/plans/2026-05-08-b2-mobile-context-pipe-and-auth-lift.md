---
title: "B2 — Mobile Context Pipe + resolveAuth Lift"
status: ready
created: 2026-05-08
updated: 2026-05-08
module: MODULE_BOTSSON
tags: [mobile, voice, livekit, adr-0132, adr-0134, botsson, harness]
adr: [ADR-0132, ADR-0134, ADR-0151]
sortie: feat/b2-mobile-context-pipe
sequenced_after: B1
---

# B2 — Mobile Context Pipe + resolveAuth Lift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile LiveKit voice sessions populate `ctx.user` + `ctx.workspace` on the voice-agent worker, ending the silent "brukerdata mangler" failure on every mobile capability call.

**Architecture:** Reuse the proven web Orb publisher pattern (`BotssonOrbVoiceMount.tsx:331-346`). The session-context BFF route currently only accepts cookie auth — lift the existing dual-mode `resolveAuth()` from `/api/emma/voice/transcript/route.ts:80` to a shared util, import in both routes, then add a mobile-side context-publisher hook that fetches with Bearer auth and publishes over the LiveKit data channel topic `"botsson-context"` immediately after Room.connect succeeds.

**Tech Stack:** Next.js Route Handler (Bearer + cookie dual-mode), `@livekit/react-native` for mobile data-channel publish, Vitest (web) + Jest (mobile), Supabase JWT.

**Sequenced after B1:** Both touch `apps/web/src/app/api/wizard/start/` and `services/stage-engine/src/routes/adapters/`. B1 ships first to keep PR diffs surgical. Do not start B2 until B1 is merged to development.

---

## Files

- Create: `apps/web/src/lib/auth/resolve-auth.ts` — lift dual-mode auth resolver
- Create: `apps/web/src/lib/auth/__tests__/resolve-auth.test.ts` — Vitest cases
- Modify: `apps/web/src/app/api/emma/voice/transcript/route.ts` — import lifted helper, drop inline definition
- Modify: `apps/web/src/app/api/botsson/voice/session-context/route.ts` — adopt dual-mode resolveAuth
- Create: `apps/web/src/app/api/botsson/voice/session-context/__tests__/route.test.ts` — Vitest cases for Bearer path
- Create: `apps/mobile/src/hooks/use-botsson-context-publisher.ts` — fetch + publish on Room connect
- Create: `apps/mobile/src/hooks/__tests__/use-botsson-context-publisher.test.ts` — Jest cases
- Modify: `apps/mobile/src/hooks/use-botsson-voice-session.ts` — wire publisher inside `start()`

## Self-Review Notes

`resolveAuth` returns `{ user, accessToken, authMethod }`. Session-context route currently only needs `user.id`. Dropping the cookie-only path is non-breaking because cookie path is preserved inside resolveAuth.

Mobile data-channel publish API matches web (`room.localParticipant.publishData(bytes, { topic })`). LiveKit's typed surface differs slightly between `livekit-client` and `@livekit/react-native` — verify import path matches `apps/mobile`'s existing LiveKit usage in `use-botsson-voice-session.ts`.

Voice-agent context handler at `services/voice-agent/src/agent.ts:78-87` consumes `topic === "botsson-context"`. Same topic on mobile = no voice-agent change needed.

ADR-0134 invariant: mobile mutations resolve `workspace_id` + `actor_id` non-empty before `emit()`. The publisher fetch payload itself is read-only — no `emit()` from the publisher itself, BFF route emits if it chooses to.

---

## Task 1: Lift resolveAuth to shared util (TDD)

**Files:**
- Create: `apps/web/src/lib/auth/resolve-auth.ts`
- Create: `apps/web/src/lib/auth/__tests__/resolve-auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/auth/__tests__/resolve-auth.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAdminGetUser = vi.fn();
const mockServerGetUser = vi.fn();
const mockServerGetSession = vi.fn();

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ auth: { getUser: mockAdminGetUser } })),
}));

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockServerGetUser,
      getSession: mockServerGetSession,
    },
  })),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("resolveAuth — dual-mode (Bearer for mobile, cookie for web)", () => {
  it("returns user from Bearer token when Authorization header is present", async () => {
    mockAdminGetUser.mockResolvedValue({
      data: { user: { id: "user-uuid-aaa" } },
      error: null,
    });
    const { resolveAuth } = await import("../resolve-auth");
    const req = new NextRequest("http://localhost/x", {
      headers: { authorization: "Bearer test-jwt-abc" },
    });
    const result = await resolveAuth(req);
    expect(result).toMatchObject({
      user: { id: "user-uuid-aaa" },
      accessToken: "test-jwt-abc",
      authMethod: "bearer",
    });
    expect(mockAdminGetUser).toHaveBeenCalledWith("test-jwt-abc");
    expect(mockServerGetUser).not.toHaveBeenCalled();
  });

  it("returns null when Bearer token is invalid", async () => {
    mockAdminGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid jwt" },
    });
    const { resolveAuth } = await import("../resolve-auth");
    const req = new NextRequest("http://localhost/x", {
      headers: { authorization: "Bearer bad-jwt" },
    });
    expect(await resolveAuth(req)).toBeNull();
  });

  it("falls back to cookie session when no Authorization header", async () => {
    mockServerGetUser.mockResolvedValue({
      data: { user: { id: "user-uuid-bbb" } },
      error: null,
    });
    mockServerGetSession.mockResolvedValue({
      data: { session: { access_token: "cookie-jwt" } },
      error: null,
    });
    const { resolveAuth } = await import("../resolve-auth");
    const req = new NextRequest("http://localhost/x");
    const result = await resolveAuth(req);
    expect(result).toMatchObject({
      user: { id: "user-uuid-bbb" },
      accessToken: "cookie-jwt",
      authMethod: "cookie",
    });
  });

  it("returns null when cookie session is missing", async () => {
    mockServerGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockServerGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const { resolveAuth } = await import("../resolve-auth");
    const req = new NextRequest("http://localhost/x");
    expect(await resolveAuth(req)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails (module missing)**

Run: `pnpm --filter web vitest run apps/web/src/lib/auth/__tests__/resolve-auth.test.ts`

Expected: FAIL — `Cannot find module '../resolve-auth'`.

- [ ] **Step 3: Implement the lifted helper**

```typescript
// apps/web/src/lib/auth/resolve-auth.ts
import type { NextRequest } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";

export type ResolvedAuth = {
  user: { id: string };
  accessToken: string | undefined;
  authMethod: "bearer" | "cookie";
};

/**
 * Dual-mode auth resolver — Bearer (mobile JWT) and cookie (web session).
 *
 * Lifted from /api/emma/voice/transcript/route.ts on 2026-05-08 so any BFF
 * route reachable from both surfaces can share the contract. ADR-0132 thin
 * client + ADR-0151 server-derived IDs both apply: callers must NOT trust
 * any user-identity claim coming from the request body.
 *
 * Returns null on auth failure. Caller decides response code (typically 401).
 */
export async function resolveAuth(request: NextRequest): Promise<ResolvedAuth | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearerToken) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    return { user: { id: data.user.id }, accessToken: bearerToken, authMethod: "bearer" };
  }

  const supabase = await createClient();
  const [{ data: userData, error: userErr }, { data: sessionData, error: sessionErr }] =
    await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
  if (userErr || sessionErr || !userData.user) return null;
  return {
    user: { id: userData.user.id },
    accessToken: sessionData.session?.access_token,
    authMethod: "cookie",
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter web vitest run apps/web/src/lib/auth/__tests__/resolve-auth.test.ts`

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auth/resolve-auth.ts apps/web/src/lib/auth/__tests__/resolve-auth.test.ts
git commit -m "refactor(auth): lift resolveAuth to shared util (Bearer + cookie dual mode)

Helper was inlined in /api/emma/voice/transcript/route.ts. Moves to
apps/web/src/lib/auth/resolve-auth.ts so any BFF route reachable from both
mobile (Bearer) and web (cookie) surfaces can share the contract.

No behavioural change in this commit — caller migration follows.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Migrate /api/emma/voice/transcript to lifted helper

**Files:**
- Modify: `apps/web/src/app/api/emma/voice/transcript/route.ts:78-103` (delete inline `resolveAuth`, import from new location)

- [ ] **Step 1: Replace inline definition with import**

At top of file, add:
```typescript
import { resolveAuth, type ResolvedAuth } from "@/lib/auth/resolve-auth";
```

Delete the inline `type AuthResult` and `async function resolveAuth(...)` block (lines 78-103 in current file).

Replace any `AuthResult` type reference in the file with `ResolvedAuth`.

- [ ] **Step 2: Run existing transcript tests**

Run: `pnpm --filter web vitest run apps/web/src/app/api/emma/voice/transcript/`

Expected: existing tests still pass (no behavioural change).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/emma/voice/transcript/route.ts
git commit -m "refactor(emma/voice/transcript): import resolveAuth from shared util

Drops 25 lines of inline auth-resolution code, imports from
@/lib/auth/resolve-auth introduced in previous commit. No behavioural change.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add Bearer support to /api/botsson/voice/session-context (TDD)

**Files:**
- Modify: `apps/web/src/app/api/botsson/voice/session-context/route.ts` — adopt resolveAuth
- Create: `apps/web/src/app/api/botsson/voice/session-context/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test for Bearer path**

```typescript
// apps/web/src/app/api/botsson/voice/session-context/__tests__/route.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockResolveAuth = vi.fn();
const mockAdminFromProfile = vi.fn();
const mockAdminFromWorkspace = vi.fn();
const mockAdminFromSeason = vi.fn();
const mockAdminFromBinding = vi.fn();
const mockAdminFromCycle = vi.fn();

vi.mock("@/lib/auth/resolve-auth", () => ({
  resolveAuth: mockResolveAuth,
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      switch (table) {
        case "profile": return mockAdminFromProfile();
        case "workspace": return mockAdminFromWorkspace();
        case "season": return mockAdminFromSeason();
        case "workspace_framework_binding": return mockAdminFromBinding();
        case "planning_cycle": return mockAdminFromCycle();
      }
      throw new Error(`unexpected table ${table}`);
    },
  })),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

function chainable(data: unknown, error: unknown = null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data, error }),
  };
  return builder;
}

const validWorkspaceId = "11111111-1111-1111-1111-111111111111";

describe("GET /api/botsson/voice/session-context — Bearer auth (mobile)", () => {
  it("returns 200 with user + workspace when Bearer token resolves", async () => {
    mockResolveAuth.mockResolvedValue({
      user: { id: "user-uuid-aaa" },
      accessToken: "bearer-jwt",
      authMethod: "bearer",
    });
    mockAdminFromProfile.mockReturnValue(
      chainable({
        profile_id: "p1",
        role: "manager",
        status: "active",
        department_id: "d1",
        display_name: "Test User",
        language_override: null,
      }),
    );
    mockAdminFromWorkspace.mockReturnValue(
      chainable({ workspace_id: validWorkspaceId, name: "Test WS", language: "no" }),
    );
    mockAdminFromSeason.mockReturnValue(chainable(null));
    mockAdminFromBinding.mockReturnValue(chainable(null));
    mockAdminFromCycle.mockReturnValue(chainable(null));

    const { GET } = await import("../route");
    const req = new NextRequest(
      `http://localhost/api/botsson/voice/session-context?workspaceId=${validWorkspaceId}`,
      { headers: { authorization: "Bearer bearer-jwt" } },
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.profile_id).toBe("p1");
    expect(body.workspace.workspace_id).toBe(validWorkspaceId);
  });

  it("returns 401 when resolveAuth returns null", async () => {
    mockResolveAuth.mockResolvedValue(null);
    const { GET } = await import("../route");
    const req = new NextRequest(
      `http://localhost/api/botsson/voice/session-context?workspaceId=${validWorkspaceId}`,
    );
    expect((await GET(req)).status).toBe(401);
  });

  it("returns 403 when profile not found in workspace", async () => {
    mockResolveAuth.mockResolvedValue({
      user: { id: "user-uuid-aaa" },
      accessToken: "j",
      authMethod: "bearer",
    });
    mockAdminFromProfile.mockReturnValue(chainable(null));
    const { GET } = await import("../route");
    const req = new NextRequest(
      `http://localhost/api/botsson/voice/session-context?workspaceId=${validWorkspaceId}`,
      { headers: { authorization: "Bearer j" } },
    );
    expect((await GET(req)).status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter web vitest run apps/web/src/app/api/botsson/voice/session-context/__tests__/route.test.ts`

Expected: FAIL — current route uses cookie path only, no Bearer support.

- [ ] **Step 3: Apply route fix**

In `apps/web/src/app/api/botsson/voice/session-context/route.ts`:

- Remove the cookie-only auth block (`createClient()` + `supabase.auth.getUser()`).
- Add at top: `import { resolveAuth } from "@/lib/auth/resolve-auth";`
- Replace section "1. Cookie auth" with:

```typescript
  // 1. Dual-mode auth — Bearer (mobile) or cookie (web).
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.user.id;
```

Leave the rest of the route unchanged (workspace_id query param handling, profile lookup, cascade-state fan-out, response assembly).

- [ ] **Step 4: Run all session-context tests**

Run: `pnpm --filter web vitest run apps/web/src/app/api/botsson/voice/session-context/__tests__/route.test.ts`

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/botsson/voice/session-context/route.ts apps/web/src/app/api/botsson/voice/session-context/__tests__/route.test.ts
git commit -m "feat(botsson/voice/session-context): accept Bearer auth (mobile)

Replaces cookie-only authentication with dual-mode resolveAuth helper.
Mobile LiveKit voice sessions can now fetch session-context with the
existing Supabase JWT; web continues to use cookie session unchanged.

Unblocks B2 mobile context-pipe — voice-agent receives ctx.user/ctx.workspace
on mobile-initiated rooms, ending the silent 'brukerdata mangler' failure.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Mobile context-publisher hook (TDD)

**Files:**
- Create: `apps/mobile/src/hooks/use-botsson-context-publisher.ts`
- Create: `apps/mobile/src/hooks/__tests__/use-botsson-context-publisher.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/mobile/src/hooks/__tests__/use-botsson-context-publisher.test.ts
import { describe, expect, it, jest } from "@jest/globals";
import { publishContextOnce, type ContextFetcher, type ContextPublisher } from "../use-botsson-context-publisher";

describe("publishContextOnce — context_init publish on Room connect", () => {
  it("publishes context_init when fetch resolves with payload", async () => {
    const fetcher: ContextFetcher = jest.fn(async () => ({
      user: {
        profile_id: "p1",
        role: "manager",
        status: "active",
        department_id: "d1",
        display_name: "Test",
        language: "no",
      },
      workspace: {
        workspace_id: "w1",
        name: "Test WS",
        niche: null,
        active_season_id: null,
        active_framework_id: null,
        planning_cycle_id: null,
      },
    })) as ContextFetcher;
    const publisher: ContextPublisher = jest.fn();

    await publishContextOnce({
      workspaceId: "w1",
      accessToken: "jwt",
      fetcher,
      publisher,
    });

    expect(publisher).toHaveBeenCalledTimes(1);
    const msg = (publisher as jest.Mock).mock.calls[0][0];
    expect(msg.type).toBe("context_init");
    expect(msg.user.profile_id).toBe("p1");
    expect(msg.workspace.workspace_id).toBe("w1");
  });

  it("does not publish when fetch returns null", async () => {
    const fetcher: ContextFetcher = jest.fn(async () => null) as ContextFetcher;
    const publisher: ContextPublisher = jest.fn();
    await publishContextOnce({
      workspaceId: "w1",
      accessToken: "jwt",
      fetcher,
      publisher,
    });
    expect(publisher).not.toHaveBeenCalled();
  });

  it("swallows fetcher errors and skips publish (audit C1: log+continue)", async () => {
    const fetcher: ContextFetcher = jest.fn(async () => {
      throw new Error("network fail");
    }) as ContextFetcher;
    const publisher: ContextPublisher = jest.fn();

    await expect(
      publishContextOnce({
        workspaceId: "w1",
        accessToken: "jwt",
        fetcher,
        publisher,
      }),
    ).resolves.not.toThrow();
    expect(publisher).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm --filter @smartout/mobile test apps/mobile/src/hooks/__tests__/use-botsson-context-publisher.test.ts`

Expected: FAIL — module not present.

- [ ] **Step 3: Implement the hook + pure helper**

```typescript
// apps/mobile/src/hooks/use-botsson-context-publisher.ts
/**
 * Mobile context-publisher — mirrors web BotssonOrbVoiceMount.tsx:331-346.
 *
 * Fetches /api/botsson/voice/session-context with Bearer auth, then publishes
 * the context_init payload over the LiveKit data channel topic="botsson-context".
 * The voice-agent worker (services/voice-agent/src/agent.ts:78-87) consumes
 * this and calls setSessionContext(), unblocking ctx.user / ctx.workspace
 * for every adapter.ask() call from voice tools.
 *
 * Failure mode is degraded — log + continue. Voice-agent treats missing ctx
 * as "brukerdata mangler" and returns a Norwegian fallback string from
 * adapter.ts:67-69. Without this hook, mobile capability calls always hit
 * that fallback.
 *
 * ADR-0132 (thin client, BFF auth boundary) + ADR-0151 (server-derived IDs).
 */

import { useEffect, useRef } from "react";
import type { Room } from "livekit-client";
import { env } from "@/env"; // mobile env (Expo Constants), provides EXPO_PUBLIC_WEB_API_URL

export type UserContextPayload = {
  profile_id: string;
  role: "owner" | "admin" | "manager" | "employee";
  status: "trainee" | "active" | "inactive" | "offboarding";
  department_id: string | null;
  display_name: string;
  language: "no" | "en" | "sv" | "da" | "fi";
};

export type WorkspaceContextPayload = {
  workspace_id: string;
  name: string;
  niche: string | null;
  active_season_id: string | null;
  active_framework_id: string | null;
  planning_cycle_id: string | null;
};

export type SessionContextResponse = {
  user: UserContextPayload;
  workspace: WorkspaceContextPayload;
};

export type ContextInitMessage = {
  type: "context_init";
  user: UserContextPayload;
  workspace: WorkspaceContextPayload;
};

export type ContextFetcher = (args: {
  workspaceId: string;
  accessToken: string;
}) => Promise<SessionContextResponse | null>;

export type ContextPublisher = (msg: ContextInitMessage) => void;

/**
 * Pure orchestrator for jest-node testability — no React, no LiveKit Room.
 * Fetches once, publishes once, swallows errors.
 */
export async function publishContextOnce(args: {
  workspaceId: string;
  accessToken: string;
  fetcher: ContextFetcher;
  publisher: ContextPublisher;
}): Promise<void> {
  let response: SessionContextResponse | null = null;
  try {
    response = await args.fetcher({
      workspaceId: args.workspaceId,
      accessToken: args.accessToken,
    });
  } catch (err) {
    console.warn("[botsson-context-publisher] fetch failed", err);
    return;
  }
  if (!response) return;
  args.publisher({
    type: "context_init",
    user: response.user,
    workspace: response.workspace,
  });
}

/** Default fetcher — calls the BFF with Bearer auth. */
export function defaultContextFetcher(): ContextFetcher {
  return async ({ workspaceId, accessToken }) => {
    const baseUrl = env.EXPO_PUBLIC_WEB_API_URL;
    if (!baseUrl) {
      console.warn("[botsson-context-publisher] EXPO_PUBLIC_WEB_API_URL missing");
      return null;
    }
    const url = `${baseUrl}/api/botsson/voice/session-context?workspaceId=${encodeURIComponent(workspaceId)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.warn("[botsson-context-publisher] BFF rejected", res.status);
      return null;
    }
    return (await res.json()) as SessionContextResponse;
  };
}

/** Default publisher — encodes message + publishes to topic="botsson-context". */
export function makeRoomPublisher(room: Room): ContextPublisher {
  const encoder = new TextEncoder();
  return (msg) => {
    void room.localParticipant?.publishData(encoder.encode(JSON.stringify(msg)), {
      topic: "botsson-context",
      reliable: true,
    });
  };
}

/**
 * Hook variant — fires once per (room, workspaceId, accessToken) tuple.
 * Use inside a connected-Room effect; safe to call when room is null.
 */
export function useBotssonContextPublisher(args: {
  room: Room | null;
  workspaceId: string | null;
  accessToken: string | null;
  fetcher?: ContextFetcher;
}): void {
  const publishedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!args.room || !args.workspaceId || !args.accessToken) return;
    const key = `${args.workspaceId}:${args.accessToken.slice(0, 8)}`;
    if (publishedRef.current === key) return;
    publishedRef.current = key;
    void publishContextOnce({
      workspaceId: args.workspaceId,
      accessToken: args.accessToken,
      fetcher: args.fetcher ?? defaultContextFetcher(),
      publisher: makeRoomPublisher(args.room),
    });
  }, [args.room, args.workspaceId, args.accessToken, args.fetcher]);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm --filter @smartout/mobile test apps/mobile/src/hooks/__tests__/use-botsson-context-publisher.test.ts`

Expected: 3 PASS.

- [ ] **Step 5: Verify env var exists**

Run: `grep "EXPO_PUBLIC_WEB_API_URL" apps/mobile/src/env.ts apps/mobile/.env*  apps/mobile/app.config.* 2>/dev/null`

If missing: add to mobile env schema and .env.template. Reference op:// path per secrets-protocol (`op://smartout_ai/Smartout-Web/url` for dev, prod equivalent).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/hooks/use-botsson-context-publisher.ts apps/mobile/src/hooks/__tests__/use-botsson-context-publisher.test.ts
git commit -m "feat(mobile/botsson): context publisher hook for voice-agent ctx pipe

Mirrors web BotssonOrbVoiceMount.tsx:331-346. Fetches session-context with
Bearer auth, publishes context_init over LiveKit data channel topic
botsson-context. Voice-agent agent.ts:78-87 consumes and populates ctx.user
+ ctx.workspace, ending 'brukerdata mangler' fallback on mobile capability
calls.

Pure orchestrator (publishContextOnce) factored out for jest-node tests;
hook variant (useBotssonContextPublisher) wraps with single-fire semantics
keyed on (workspaceId, accessToken).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire publisher into use-botsson-voice-session

**Files:**
- Modify: `apps/mobile/src/hooks/use-botsson-voice-session.ts:431-487` (around `start()` + `useEffect` for room lifecycle)

- [ ] **Step 1: Import publisher**

At top of file, add:
```typescript
import { useBotssonContextPublisher } from "./use-botsson-context-publisher";
```

- [ ] **Step 2: Capture access token after token mint**

In `performStart` deps' `mintToken` async function (currently around line 448-459 in `use-botsson-voice-session.ts`), expose the Supabase access token alongside the LiveKit token. Add to `MintedToken` type:

```typescript
export type MintedToken = {
  token: string;
  serverUrl: string;
  voiceParticipation: "listen_only" | "interactive" | null;
  supabaseAccessToken: string | null;
};
```

In the hook body's `start()`, after `setStatus("listening")`:

```typescript
const { data: { session: supaSession } } = await supabase.auth.getSession();
setSupabaseAccessToken(supaSession?.access_token ?? null);
```

Add state:
```typescript
const [supabaseAccessToken, setSupabaseAccessToken] = useState<string | null>(null);
```

- [ ] **Step 3: Wire the publisher hook**

Inside `useBotssonVoiceSession`, after `useVoiceTranscripts(...)` block:

```typescript
useBotssonContextPublisher({
  room,
  workspaceId,
  accessToken: supabaseAccessToken,
});
```

- [ ] **Step 4: Reset accessToken on stop**

In `stop()`, after `setStatus("idle")`:
```typescript
setSupabaseAccessToken(null);
```

- [ ] **Step 5: Run all use-botsson-voice-session tests**

Run: `pnpm --filter @smartout/mobile test apps/mobile/src/hooks/__tests__/use-botsson-voice-session.test.ts`

Expected: existing tests pass (publisher hook is no-op when room is null in tests).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/hooks/use-botsson-voice-session.ts
git commit -m "feat(mobile/botsson): wire context publisher in voice session

After Room.connect, captures Supabase access token and triggers
useBotssonContextPublisher with (room, workspaceId, accessToken). Hook
fires once per session tuple; voice-agent receives context_init and
adapter.ask() returns real responses instead of 'brukerdata mangler'.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Manual verification on PWA

- [ ] **Step 1: Start mobile PWA**

Run: `pnpm --filter @smartout/mobile dev`
Open: http://localhost:8083

- [ ] **Step 2: Trigger voice session**

Sign in as authenticated workspace user. Open Botsson voice surface. Speak: "hva er min vakt i morgen".

- [ ] **Step 3: Verify voice-agent log**

In voice-agent terminal output, expect:
```
[botsson-voice] context updated: context_init
```

- [ ] **Step 4: Verify ask() returns non-fallback**

Voice agent response should reference the actual workspace name and answer about scheduling. The fallback `"Botsson er ikke klar ennå — brukerdata mangler"` must not appear.

- [ ] **Step 5: Test failure mode**

Stop the web BFF (`pnpm --filter web` process). Trigger another voice session. Expect:
- Voice connects (LiveKit token mint independent)
- `[botsson-context-publisher] fetch failed` in mobile console
- adapter.ask() falls back to "brukerdata mangler" — pre-fix behaviour, no crash

Restart BFF. New session should publish context successfully.

---

## Task 7: Acceptance gates

- [ ] `pnpm --filter web vitest run apps/web/src/lib/auth/` — 4 PASS
- [ ] `pnpm --filter web vitest run apps/web/src/app/api/botsson/voice/session-context/` — 3 PASS
- [ ] `pnpm --filter web vitest run apps/web/src/app/api/emma/voice/transcript/` — existing tests still PASS
- [ ] `pnpm --filter @smartout/mobile test apps/mobile/src/hooks/__tests__/use-botsson-context-publisher.test.ts` — 3 PASS
- [ ] `pnpm --filter @smartout/mobile test apps/mobile/src/hooks/__tests__/use-botsson-voice-session.test.ts` — existing tests still PASS
- [ ] `pnpm --filter web typecheck` — 0 errors
- [ ] `pnpm --filter @smartout/mobile typecheck` — 0 errors
- [ ] Manual PWA test confirms `context updated: context_init` in voice-agent log
- [ ] adapter.ask() responses on mobile reference real workspace data (no "brukerdata mangler")

## Estimated Time

2-3 hours for an experienced engineer including test scaffolding and manual verification on PWA.

## Rollback

Two layers:
1. **Code rollback** — revert the 5 commits. Mobile reverts to "brukerdata mangler" silent fallback (pre-fix state, no regression beyond status quo).
2. **Auth lift rollback** — if shared util causes import cycle, restore inline `resolveAuth` in `/api/emma/voice/transcript/route.ts` and inline a copy in `/api/botsson/voice/session-context/route.ts`. Less hygienic but functionally equivalent.

## Out of Scope

- E2E test (Detox or PWA-driven Playwright) for mobile voice session — flagged in audit Bolk C #9 as separate work
- Persona consolidation across the three mission prompts — P3 in 2026-05-08 audit
- Any code outside `apps/web/src/{lib/auth,app/api/botsson/voice/session-context,app/api/emma/voice/transcript}/` and `apps/mobile/src/hooks/`
