/**
 * Subdomain extraction and validation for workspace routing.
 * Spec: docs/architecture/SMARTOUT_Subdomain_Routing_Architecture.md
 */

/**
 * Reserved subdomains that cannot be used as workspace slugs.
 * Must stay in sync with the `reserved_slug` table
 * (migration: 20260228200000_workspace_slug_constraints.sql).
 */
const RESERVED_SUBDOMAINS = new Set([
  // Infrastructure
  "app",
  "api",
  "docs",
  "www",
  "admin",
  "status",
  "voice",
  "staging",
  "dev",
  // Services
  "mail",
  "smtp",
  "ftp",
  "cdn",
  // Content
  "assets",
  "static",
  "media",
  "blog",
  "help",
  "support",
]);

type SubdomainResult =
  | { type: "workspace"; slug: string }
  | { type: "portal" }
  | { type: "reserved"; subdomain: string }
  | { type: "root" };

/**
 * Extract subdomain from the request Host header.
 *
 * Production:
 *   peppes.smartout.ai      → { type: "workspace", slug: "peppes" }
 *   app.smartout.ai         → { type: "portal" }
 *   docs.smartout.ai        → { type: "reserved", subdomain: "docs" }
 *   smartout.ai             → { type: "root" }
 *
 * Development:
 *   peppes.localhost:3050   → { type: "workspace", slug: "peppes" }
 *   app.localhost:3050      → { type: "portal" }
 *   localhost:3050          → { type: "root" }
 */
export function extractSubdomain(host: string): SubdomainResult {
  const hostname = host.split(":")[0]!;

  // Development: *.localhost
  if (hostname.endsWith(".localhost") || hostname === "localhost") {
    const parts = hostname.split(".");
    if (parts.length === 1) return { type: "root" };
    const sub = parts[0]!;
    if (sub === "app") return { type: "portal" };
    if (RESERVED_SUBDOMAINS.has(sub)) return { type: "reserved", subdomain: sub };
    return { type: "workspace", slug: sub };
  }

  // Production: *.smartout.ai (or configured root domain)
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "smartout.ai";
  if (!hostname.endsWith(`.${rootDomain}`) && hostname !== rootDomain) {
    // Unknown domain (e.g., Vercel preview URL) — treat as root
    return { type: "root" };
  }

  if (hostname === rootDomain || hostname === `www.${rootDomain}`) {
    return { type: "root" };
  }

  const sub = hostname.slice(0, -(rootDomain.length + 1));

  if (sub === "app") return { type: "portal" };
  if (RESERVED_SUBDOMAINS.has(sub)) return { type: "reserved", subdomain: sub };
  return { type: "workspace", slug: sub };
}

export { RESERVED_SUBDOMAINS };
