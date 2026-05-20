/**
 * Validates a redirect path against an allowlist to prevent open-redirect
 * vulnerabilities when honoring a user-supplied `return_to` query param.
 *
 * Rules: path must be a non-empty string starting with `/`, must NOT start
 * with `//` (protocol-relative), must NOT contain `://` (absolute URL) or
 * backslash. When `allowedPrefixes` is provided, path must start with one
 * of them. Returns null on any failure — caller decides the default.
 */
export function validateReturnTo(
  raw: string | null | undefined,
  opts?: { allowedPrefixes?: string[] },
): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("://")) return null;
  if (raw.includes("\\")) return null;
  if (opts?.allowedPrefixes && opts.allowedPrefixes.length > 0) {
    const matched = opts.allowedPrefixes.some(
      (p) => raw === p || raw.startsWith(`${p}?`) || raw.startsWith(`${p}/`),
    );
    if (!matched) return null;
  }
  return raw;
}
