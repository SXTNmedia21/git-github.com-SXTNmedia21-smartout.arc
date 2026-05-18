/**
 * F13 — portal-redirect-negative.spec.ts
 *
 * Guards against over-eager portal-redirect. These paths MUST NOT 307 to the
 * portal:
 *   - `/api/auth/callback` on workspace subdomain (PKCE verifier cookie is
 *     host-scoped; re-hopping would orphan it — see proxy.ts comment §5a)
 *   - `/dashboard/*` on workspace subdomain (workspace's own app surface)
 *   - `/login` on the PORTAL host (no self-redirect infinite loop)
 *   - Reserved subdomains (`docs.localhost`, etc.) — pass through, not portal-redirected
 *
 * Refs: ADR-0362, docs/architecture/SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md §6,
 * docs/superpowers/specs/2026-05-18-e2e-portal-redirect-tests.md (F13).
 */
import { test } from "@playwright/test";
import { expectNoPortalRedirect } from "../../helpers/portal-redirect";

test.describe("F13 portal-redirect-negative", () => {
  test("workspace /api/auth/callback?code=... does NOT redirect to portal", async ({ request }) => {
    // Critical: PKCE verifier cookie is set on whichever host initiated OAuth.
    // If a legacy email link points at the workspace host, the callback must
    // run in place so the verifier (in the workspace-host cookie jar) can be
    // read by exchangeCodeForSession. Re-hopping orphans the verifier.
    await expectNoPortalRedirect(
      request,
      "http://e2e-acme.localhost:3060/api/auth/callback?code=fake-code",
    );
  });

  test("workspace /dashboard/* does NOT redirect to portal", async ({ request }) => {
    // The whole point of workspace subdomains is that /dashboard/* lives there.
    // Auth-redirect must scope to AUTH_ROUTES_REDIRECT_TO_PORTAL exactly.
    await expectNoPortalRedirect(request, "http://e2e-acme.localhost:3060/dashboard/schedule");
  });

  test("workspace root (/) does NOT redirect to portal", async ({ request }) => {
    // proxy.ts §5 redirects `/` on workspace to `/dashboard` — same host.
    // That is NOT a portal-redirect.
    await expectNoPortalRedirect(request, "http://e2e-acme.localhost:3060/");
  });

  test("portal /login does NOT self-redirect to portal", async ({ request }) => {
    // Sanity: hitting the portal directly on an auth route is a no-op for
    // the redirect logic. Page renders. No infinite loop.
    await expectNoPortalRedirect(request, "http://app.localhost:3060/login");
  });

  test("reserved subdomain (docs) passes through, not portal-redirected", async ({ request }) => {
    // `docs.localhost:3060/login` — middleware classifies docs as reserved
    // (per subdomain.ts RESERVED_SUBDOMAINS). Reserved hosts go through the
    // `subdomain.type === "reserved"` branch, NOT the workspace handler.
    // No portal-redirect, no x-workspace-slug header.
    await expectNoPortalRedirect(request, "http://docs.localhost:3060/login");
  });
});
