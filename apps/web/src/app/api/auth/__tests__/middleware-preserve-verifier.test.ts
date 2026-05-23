/**
 * Regression: middleware must NOT nuke the PKCE code-verifier cookie.
 *
 * Bug (2026-05-21, hotfix/auth-verifier-nuke): `updateSession` cleared ALL `sb-*`
 * cookies when `getUser()` errored. An unauthenticated user mid-OAuth /
 * mid-password-reset carries only `sb-*-code-verifier` and no session, so
 * getUser() legitimately errors on a stray pass (e.g. a `<Link>` prefetch of
 * /dashboard). Nuking the verifier orphaned the in-flight flow → the callback
 * exchange failed with "both auth code and code verifier should be non-empty"
 * → Google login, password reset, and email-OTP magic-link ALL bounced to /login.
 *
 * Reproduced live against a prod-build on localhost wired to live Supabase:
 * seed a verifier-only jar → GET /dashboard → verifier len went 24 → 0.
 * Fix: the error-branch clear-loop skips names ending in `-code-verifier`,
 * mirroring scrubOrphanAuthCookies in api/auth/callback/route.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));

import { updateSession } from "@smartout/supabase/middleware";

const REF = "sb-yljaglomadbhyqpcigff-auth-token";
const VERIFIER = `${REF}-code-verifier`;

function reqWithAuthCookies(): NextRequest {
  return new NextRequest("https://app.smartout.ai/dashboard", {
    headers: { cookie: `${REF}=session-token; ${VERIFIER}=verifier-value; other=keep` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://yljaglomadbhyqpcigff.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "smartout.ai";
});

describe("updateSession — PKCE verifier preservation", () => {
  it("clears session sb-* cookies but PRESERVES -code-verifier when getUser errors", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth session missing!" },
    });

    const { response, user } = await updateSession(reqWithAuthCookies());

    expect(user).toBeNull();
    // session token cookie is cleared (deletion writes empty value)
    expect(response.cookies.get(REF)?.value).toBe("");
    // the verifier is NOT among the deleted cookies — never written to the response
    expect(response.cookies.get(VERIFIER)).toBeUndefined();
  });

  it("does not clear any cookie when getUser succeeds", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const { user } = await updateSession(reqWithAuthCookies());

    expect(user).toEqual({ id: "user-1" });
  });
});
