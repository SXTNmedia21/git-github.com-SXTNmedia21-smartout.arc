/**
 * F12 — callback continue= validation (unit tests).
 *
 * Covers `resolveContinueDestination` behavior inside the callback route
 * handler. F11 (HTTP E2E) proves the middleware-redirect side of ADR-0362;
 * F12 (this) proves the callback-redirect side: after a successful session
 * exchange, the `?continue=<slug>` param is honored ONLY when the user has
 * a profile in the named workspace.
 *
 * Cases:
 *   1. Valid slug + user has profile in workspace → 307 to workspace dashboard
 *   2. Valid slug + workspace exists + user has NO profile → 307 to portal /dashboard
 *   3. Valid slug + workspace does NOT exist → 307 to portal /dashboard
 *   4. Malformed slug (uppercase, special chars, path injection) → 307 to portal /dashboard
 *   5. No `continue` param at all → 307 to portal /dashboard
 *   6. exchangeCodeForSession fails → 307 to /login?error=Invalid_link
 *
 * Refs: ADR-0362, apps/web/src/app/api/auth/callback/route.ts:5-58 (SLUG_PATTERN
 * + resolveContinueDestination), docs/superpowers/specs/2026-05-18-e2e-portal-redirect-tests.md (F12).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExchangeCodeForSession = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockEmit = vi.fn();

// Capture chained query-builder calls. The route does:
//   supabase.from("workspace").select("workspace_id, slug").eq("slug", X).maybeSingle()
//   supabase.from("profile").select("profile_id").eq("user_id", X).eq("workspace_id", Y).maybeSingle()
//   supabase.from("profile").select("profile_id").eq("user_id", X).limit(1)
//   supabase.from("signup_progress").select("completed, current_step").eq("auth_id", X).maybeSingle()
// We model a tiny chainable that records args and returns the configured result.
function makeQueryBuilder(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    // For the `from("profile").select().eq("user_id", X).limit(1)` path that
    // resolves directly without `maybeSingle`, the builder is await-ed. Make
    // it thenable so `await builder` works.
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return builder;
}

vi.mock("@smartout/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

vi.mock("@smartout/telemetry", () => ({
  emit: mockEmit,
  nonEmpty: (v: string | null) => v ?? "anonymous",
}));

// scrubOrphanAuthCookies() calls cookies() from next/headers, which throws
// "called outside a request scope" when GET() is invoked directly in a unit
// test. Stub a minimal cookie store so the scrub loop is a no-op.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

const PROD_ENV = { ...process.env, NEXT_PUBLIC_ROOT_DOMAIN: "smartout.ai" };
const USER_ID = "00000000-0000-0000-0000-000000000abc";

beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "smartout.ai";
  mockEmit.mockResolvedValue(undefined);
  mockExchangeCodeForSession.mockResolvedValue({ error: null });
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
});

/**
 * Helper to drive `from()` with a per-table mock. Route flow:
 *   1. from("profile").select.eq.limit(1)             ← existing-user check (array)
 *   2. from("workspace").select.eq.maybeSingle()      ← slug lookup (inside resolveContinueDestination)
 *   3. from("profile").select.eq.eq.maybeSingle()     ← workspace-scoped profile (inside resolveContinueDestination)
 *   (if no existing profile at #1, falls through to signup_progress instead of 2+3)
 *
 * We disambiguate the two `from("profile")` calls by their position in the
 * overall `from()` call sequence.
 */
function setupFromMock(plan: {
  workspaceRow?: { workspace_id: string; slug: string } | null;
  workspaceProfileRow?: { profile_id: string } | null;
  existingProfilesAny?: Array<{ profile_id: string }>;
  signupProgress?: { completed: boolean; current_step: number } | null;
  signupProgressError?: unknown;
}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "workspace") {
      return makeQueryBuilder({ data: plan.workspaceRow ?? null });
    }
    if (table === "profile") {
      // Count how many times `profile` has been queried so far (including this one).
      const profileCallNumber = mockFrom.mock.calls.filter((args) => args[0] === "profile").length;
      if (profileCallNumber === 1) {
        // First call: existing-user check via `.limit(1)` — returns array
        return makeQueryBuilder({ data: plan.existingProfilesAny ?? [] });
      }
      // Second+ call: workspace-scoped profile check inside resolveContinueDestination
      return makeQueryBuilder({ data: plan.workspaceProfileRow ?? null });
    }
    if (table === "signup_progress") {
      return makeQueryBuilder({
        data: plan.signupProgress ?? null,
        error: plan.signupProgressError ?? null,
      });
    }
    return makeQueryBuilder({ data: null });
  });
}

describe("F12 callback continue= validation", () => {
  it("case 1: valid slug + user has profile → redirects to workspace dashboard", async () => {
    setupFromMock({
      workspaceRow: { workspace_id: "ws-acme", slug: "e2e-acme" },
      workspaceProfileRow: { profile_id: "prof-1" },
      existingProfilesAny: [{ profile_id: "prof-1" }],
    });
    const { GET } = await import("../route");
    const req = new Request(
      "https://app.smartout.ai/api/auth/callback?code=valid-code&continue=e2e-acme&next=/dashboard",
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://e2e-acme.smartout.ai/dashboard");
  });

  it("case 2: valid slug, workspace exists, user has NO profile → portal /dashboard", async () => {
    setupFromMock({
      workspaceRow: { workspace_id: "ws-victim", slug: "victim" },
      workspaceProfileRow: null, // user has no profile in victim
      existingProfilesAny: [{ profile_id: "prof-1" }], // user does have SOME profile elsewhere
    });
    const { GET } = await import("../route");
    const req = new Request(
      "https://app.smartout.ai/api/auth/callback?code=valid-code&continue=victim",
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    // Should land on portal /dashboard, NOT victim.smartout.ai
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("victim.smartout.ai");
    expect(location).toContain("/dashboard");
  });

  it("case 3: valid slug, workspace does NOT exist → portal /dashboard", async () => {
    setupFromMock({
      workspaceRow: null, // ghost slug
      existingProfilesAny: [{ profile_id: "prof-1" }],
    });
    const { GET } = await import("../route");
    const req = new Request(
      "https://app.smartout.ai/api/auth/callback?code=valid-code&continue=ghost",
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("ghost.smartout.ai");
    expect(location).toContain("/dashboard");
  });

  it("case 4: malformed slug (uppercase) → portal /dashboard, no workspace query", async () => {
    setupFromMock({
      existingProfilesAny: [{ profile_id: "prof-1" }],
    });
    const { GET } = await import("../route");
    const req = new Request(
      "https://app.smartout.ai/api/auth/callback?code=valid-code&continue=ACME-UPPER",
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).not.toContain("ACME-UPPER.smartout.ai");
    // SLUG_PATTERN rejects pre-flight; the workspace lookup should never fire.
    const workspaceCalls = mockFrom.mock.calls.filter((args) => args[0] === "workspace");
    expect(workspaceCalls).toHaveLength(0);
  });

  it("case 4b: slug-injection (path-traversal) is rejected", async () => {
    setupFromMock({
      existingProfilesAny: [{ profile_id: "prof-1" }],
    });
    const { GET } = await import("../route");
    const req = new Request(
      "https://app.smartout.ai/api/auth/callback?code=valid-code&continue=foo/bar",
    );
    const res = await GET(req);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("foo/bar.smartout.ai");
    expect(location).not.toContain("/bar");
  });

  it("case 5: no continue param → portal /dashboard (existing behavior)", async () => {
    setupFromMock({
      existingProfilesAny: [{ profile_id: "prof-1" }],
    });
    const { GET } = await import("../route");
    const req = new Request("https://app.smartout.ai/api/auth/callback?code=valid-code");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("case 6: exchangeCodeForSession fails → /login?error=Invalid_link", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: "PKCE verifier missing" },
    });
    setupFromMock({});
    const { GET } = await import("../route");
    const req = new Request(
      "https://app.smartout.ai/api/auth/callback?code=fake&continue=e2e-acme",
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=Invalid_link");
    // Even with continue=e2e-acme, error path overrides — no workspace bounce.
    expect(res.headers.get("location")).not.toContain("e2e-acme.smartout.ai");
  });

  it("case 7: no code param → /login?error=Invalid_link (existing behavior)", async () => {
    const { GET } = await import("../route");
    const req = new Request("https://app.smartout.ai/api/auth/callback");
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=Invalid_link");
  });
});
