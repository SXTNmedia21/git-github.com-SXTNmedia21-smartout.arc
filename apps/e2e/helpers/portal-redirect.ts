/**
 * portal-redirect.ts — E2E helpers for ADR-0362 (workspace → portal auth redirect).
 *
 * The portal-redirect lives in `apps/web/src/proxy.ts` §5a. Hitting any auth
 * route on a workspace subdomain (`<slug>.<root>/<auth-path>`) returns a 307
 * with `Location: <portal>/<auth-path>?continue=<slug>`. These helpers cover
 * the three modes the middleware supports (prod, subdomain-dev, single-host-dev)
 * so the same spec file works in CI + locally.
 *
 * The helpers operate at HTTP level via `request.fetch()` — no browser context
 * needed. This means F11–F13 are cheap (<1s per assertion) and run in parallel.
 */

import type { APIRequestContext, APIResponse } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Local dev portal base — matches `auth-invitation.ts` PORTAL_BASE.
 * Override via E2E_PORTAL_BASE for non-default ports.
 */
const LOCAL_PORTAL_BASE = process.env.E2E_PORTAL_BASE ?? "http://app.localhost:3060";

/**
 * The root domain we're testing against. In local dev this is "localhost".
 * In CI against a deployed env this is "smartout.ai" (or a preview equivalent).
 */
export const ROOT_DOMAIN = process.env.E2E_ROOT_DOMAIN ?? "localhost";

/**
 * The port suffix to append to local hosts. Empty for prod/preview.
 */
const LOCAL_PORT = (() => {
  if (ROOT_DOMAIN !== "localhost") return "";
  // Derive from PORTAL_BASE which already encodes the right port.
  const match = LOCAL_PORTAL_BASE.match(/:(\d+)/);
  return match ? `:${match[1]}` : ":3060";
})();

/**
 * Build a URL that targets a workspace subdomain. In dev, this maps to
 * `http://<slug>.localhost:3060/<path>`. In CI it would be
 * `https://<slug>.smartout.ai/<path>`.
 */
export function workspaceUrl(slug: string, path: string): string {
  const scheme = ROOT_DOMAIN === "localhost" ? "http" : "https";
  return `${scheme}://${slug}.${ROOT_DOMAIN}${LOCAL_PORT}${path}`;
}

/**
 * Build the expected portal URL for a given path. Strips any continue param
 * (assertions add it back as needed).
 */
export function portalUrl(path: string): string {
  const scheme = ROOT_DOMAIN === "localhost" ? "http" : "https";
  return `${scheme}://app.${ROOT_DOMAIN}${LOCAL_PORT}${path}`;
}

/**
 * Fetch a URL without following redirects. Playwright's `APIRequestContext.fetch`
 * follows redirects by default — `maxRedirects: 0` forces the raw 307.
 */
export async function fetchNoFollow(request: APIRequestContext, url: string): Promise<APIResponse> {
  return request.fetch(url, { maxRedirects: 0 });
}

/**
 * Assert a workspace-host request 307s to the portal with `continue=<slug>`.
 * Used by F11 across the 9 auth routes.
 */
export async function expectPortalRedirect(
  request: APIRequestContext,
  slug: string,
  path: string,
): Promise<void> {
  const url = workspaceUrl(slug, path);
  const res = await fetchNoFollow(request, url);
  expect(res.status(), `${url} should 307`).toBe(307);
  const location = res.headers()["location"];
  expect(location, `${url} should have Location header`).toBeDefined();
  // Strip query for path-comparison, then re-verify continue param.
  const target = new URL(location!);
  const expected = new URL(portalUrl(path));
  expect(target.origin, `${url}: portal origin`).toBe(expected.origin);
  expect(target.pathname, `${url}: portal path`).toBe(expected.pathname);
  expect(target.searchParams.get("continue"), `${url}: continue param`).toBe(slug);
}

/**
 * Assert a request does NOT redirect (status 2xx or 3xx-but-not-307-to-portal).
 * Used by F13 to guard against over-eager redirects.
 */
export async function expectNoPortalRedirect(
  request: APIRequestContext,
  url: string,
): Promise<void> {
  const res = await fetchNoFollow(request, url);
  const location = res.headers()["location"];
  if (!location) return; // 2xx — fine
  // If there IS a redirect, assert it doesn't go to the portal with continue=
  const target = new URL(location);
  const portalHost = new URL(portalUrl("/")).host;
  if (target.host === portalHost && target.searchParams.has("continue")) {
    throw new Error(
      `${url}: should NOT redirect to portal but got ${location} (status ${res.status()})`,
    );
  }
}
