/**
 * F11 — portal-redirect-workspace-subdomain.spec.ts
 *
 * Locks ADR-0362: every workspace-subdomain auth-route request returns a 307
 * to the portal with `?continue=<slug>` preserved. The middleware lives in
 * `apps/web/src/proxy.ts` §5a (`AUTH_ROUTES_REDIRECT_TO_PORTAL`).
 *
 * Tests run at HTTP-level (no browser), parameterised over the 9 protected
 * paths. If a future refactor drops a path from the set OR breaks the
 * `continue` parameter, this suite catches it before prod surfaces a
 * PKCE-verifier-mismatch `Invalid_link` bounce.
 *
 * Refs: ADR-0362, docs/architecture/SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md §3,
 * docs/superpowers/specs/2026-05-18-e2e-portal-redirect-tests.md (F11).
 */
import { test } from "@playwright/test";
import { expectPortalRedirect } from "../../helpers/portal-redirect";

const WORKSPACE_SLUG = "e2e-acme";

/**
 * Every entry in `AUTH_ROUTES_REDIRECT_TO_PORTAL` (proxy.ts:37-48).
 * Keep this list in sync — if it drifts, the proxy.ts set is the
 * source of truth.
 */
const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/join",
  "/join-complete",
  "/reset-password",
  "/update-password",
  "/invite/test-token-abc123",
  "/confirm-email",
  "/select-workspace",
  "/welcome",
];

test.describe("F11 portal-redirect-workspace-subdomain", () => {
  for (const path of AUTH_ROUTES) {
    test(`workspace subdomain ${path} 307s to portal with continue=`, async ({ request }) => {
      await expectPortalRedirect(request, WORKSPACE_SLUG, path);
    });
  }

  test("query params are preserved through the redirect", async ({ request }) => {
    // /login?invite=abc retains both `invite` AND adds `continue=<slug>`.
    const res = await request.fetch(
      `http://${WORKSPACE_SLUG}.localhost:3060/login?invite=foo-bar`,
      { maxRedirects: 0 },
    );
    const location = res.headers()["location"];
    const target = new URL(location!);
    test.expect(target.searchParams.get("invite")).toBe("foo-bar");
    test.expect(target.searchParams.get("continue")).toBe(WORKSPACE_SLUG);
  });

  test("operator-supplied continue= is preserved (not overwritten)", async ({ request }) => {
    // Edge case: if the request already has ?continue=foo, middleware should
    // not overwrite it with the slug. Lets ops manually steer the post-auth hop.
    const res = await request.fetch(
      `http://${WORKSPACE_SLUG}.localhost:3060/login?continue=other-slug`,
      { maxRedirects: 0 },
    );
    const location = res.headers()["location"];
    const target = new URL(location!);
    test.expect(target.searchParams.get("continue")).toBe("other-slug");
  });
});
