/**
 * Asserts NEXT_PUBLIC_ROOT_DOMAIN is set when running in production.
 *
 * Why: cookie-domain drift between createBrowserClient + createServerClient
 * recreates the refresh-token-already-used race ADR-0357 closed. The risk
 * surfaces only when the env var is undefined — locally we tolerate a
 * fallback (localhost). In production a missing var is a deploy bug, not
 * a config preference.
 *
 * In dev/preview: warn once to stderr.
 * In production: throw, blocking module evaluation. Better to fail fast at
 * startup than to ship a silent auth-race regression.
 *
 * See ADR-0375.
 */
let asserted = false;

export function assertRootDomain(): void {
  if (asserted) return;
  asserted = true;

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (rootDomain && rootDomain.length > 0) return;

  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV; // "production" | "preview" | "development" | undefined

  const isProduction = nodeEnv === "production" && vercelEnv === "production";
  if (isProduction) {
    throw new Error(
      "NEXT_PUBLIC_ROOT_DOMAIN is required in production. " +
        "Missing value would cause cookie-domain drift between createBrowserClient " +
        "and createServerClient, recreating the refresh-token rotation race " +
        "ADR-0357 closed. Set the env var in Vercel (production scope) and redeploy.",
    );
  }

  // Dev or preview: log once, don't crash.
  // eslint-disable-next-line no-console
  console.warn(
    "[@smartout/supabase] NEXT_PUBLIC_ROOT_DOMAIN is unset. Cookie domain " +
      "will fall back to host-only, which is OK locally but a deploy bug in prod. " +
      "See ADR-0375.",
  );
}
