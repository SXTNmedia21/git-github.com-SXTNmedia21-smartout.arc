/**
 * Unified post-onboarding redirect.
 *
 * Handles subdomain routing (slug.domain/dashboard) for production
 * and simple /dashboard for localhost. Uses window.location.href
 * for hard navigation to the correct subdomain.
 */
export function redirectToDashboard(slug?: string | null, path = "/dashboard"): void {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const isLocalhost = !rootDomain || rootDomain === "localhost";

  if (!isLocalhost && slug) {
    window.location.href = `https://${slug}.${rootDomain}${path}`;
  } else {
    window.location.href = path;
  }
}
