// Suspicious patterns to watch for
const SUSPICIOUS_PATHS = [
  "/wp-admin",
  "/wp-login",
  "/.env",
  "/phpmyadmin",
  "/admin/config",
  "/.git",
  "/actuator",
];

// Note: x-forwarded-host is NOT suspicious — it's always set by reverse proxies
// (Vercel, Cloudflare, nginx, etc.). Only flag truly unusual headers.
const SUSPICIOUS_HEADERS = ["x-original-url"];

const isDev = process.env.NODE_ENV === "development";

export function detectSuspiciousRequest(req: Request): {
  suspicious: boolean;
  reasons: string[];
} {
  const url = new URL(req.url);
  const reasons: string[] = [];

  // Path traversal
  if (url.pathname.includes("..") || url.pathname.includes("//")) {
    reasons.push("path_traversal");
  }

  // Known attack paths
  if (SUSPICIOUS_PATHS.some((p) => url.pathname.toLowerCase().startsWith(p))) {
    reasons.push("known_attack_path");
  }

  // Suspicious headers (host header injection)
  // Skip in dev — Next.js dev server sets x-forwarded-host automatically
  if (!isDev) {
    for (const header of SUSPICIOUS_HEADERS) {
      if (req.headers.get(header)) {
        reasons.push(`suspicious_header:${header}`);
      }
    }
  }

  // Oversized query string (potential injection)
  if (url.search.length > 2048) {
    reasons.push("oversized_query");
  }

  return { suspicious: reasons.length > 0, reasons };
}
