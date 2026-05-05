/**
 * CORS policy for Smartout edge functions.
 *
 * Smartout is multi-tenant. Each workspace gets a {slug}.smartout.ai subdomain
 * (see docs/reference/API_ROUTES_REFERENCE.md + CLAUDE.md "Subdomain routing").
 * CORS must accept any origin on our own DNS (smartout.ai + any subdomain) —
 * browsers reject wildcards in Access-Control-Allow-Origin, so we echo the
 * exact requesting origin after suffix-matching.
 *
 * ALLOWED_ORIGINS env var is retained as an additive exact-match list for
 * ad-hoc origins (Vercel previews, staging) — not the primary source.
 *
 * Full architectural rationale: ADR-0171 (follow-up PR).
 */

const DEV_ORIGINS = new Set([
  "http://localhost:3060", // apps/web
  "http://localhost:3055", // apps/landing
]);

const EXTRA_ALLOWED = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

function isSmartoutOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    return url.hostname === "smartout.ai" || url.hostname.endsWith(".smartout.ai");
  } catch {
    return false;
  }
}

export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (isSmartoutOrigin(origin)) return true;
  if (DEV_ORIGINS.has(origin)) return true;
  if (EXTRA_ALLOWED.has(origin)) return true;
  return false;
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = isAllowedOrigin(origin);
  if (origin && !allowed) {
    console.warn(`[cors] rejected origin: ${origin}`);
  }
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-api-key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

/**
 * @deprecated Use getCorsHeaders(req). Full migration of ~49 consumers tracked
 * in follow-up PR. Apex fallback keeps un-migrated functions serving the
 * landing site at minimum; tenant subdomains require getCorsHeaders(req).
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://smartout.ai",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  Vary: "Origin",
};
