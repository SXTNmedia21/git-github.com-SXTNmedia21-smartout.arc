// ============================================
// visitor-cookie.ts
// Persistent visitor identification via cookie.
// Stores a UUIDv4 in the "smo_vid" cookie to track
// returning visitors across sessions. The cookie
// persists for 365 days and is refreshed on every visit.
//
// Two exports:
//   getOrCreateVisitorId() — reads or creates the visitor cookie,
//                            refreshes expiry on every call
//   getVisitorId()         — read-only, returns cookie value or undefined
//
// Uses Web Crypto API for UUID generation — no external deps.
//
// Connected to: apps/landing/src/hooks/useTracking.ts (page_view + cta events)
//               apps/landing/src/hooks/useScrollTracking.ts (scroll depth events)
//               apps/landing/src/hooks/useClickTracking.ts (click events)
//               apps/landing/src/hooks/useSessionLifecycle.ts (heartbeat + session end)
// ============================================

/** Cookie name for the persistent visitor ID. */
const VISITOR_COOKIE_NAME = "smo_vid";

/** Cookie max age: 365 days in seconds. */
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Generates a UUIDv4 using the Web Crypto API.
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * No external dependencies needed.
 */
function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version 4 (0100 in bits 6-7 of byte 6)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant 1 (10xx in bits 6-7 of byte 8)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Reads a cookie value by name.
 * Returns undefined if the cookie is not found or cookies are unavailable.
 */
function readCookie(name: string): string | undefined {
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split("=")[1]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes a cookie with the given name, value, and max age.
 * Uses SameSite=Lax and path=/ for broad compatibility.
 * Returns false if cookies are unavailable.
 */
function writeCookie(name: string, value: string, maxAge: number): boolean {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads or creates the persistent visitor ID cookie.
 *
 * If the cookie exists: refreshes the expiry (365 days from now) and returns the value.
 * If the cookie is missing: generates a UUIDv4, sets the cookie, and returns the new ID.
 * Returns undefined if cookies are unavailable (e.g. SSR, blocked by browser).
 */
export function getOrCreateVisitorId(): string | undefined {
  if (typeof document === "undefined") return undefined;

  const existing = readCookie(VISITOR_COOKIE_NAME);
  if (existing) {
    // Refresh expiry on every visit
    writeCookie(VISITOR_COOKIE_NAME, existing, COOKIE_MAX_AGE);
    return existing;
  }

  const id = generateUUID();
  const success = writeCookie(VISITOR_COOKIE_NAME, id, COOKIE_MAX_AGE);
  return success ? id : undefined;
}

/**
 * Read-only accessor for the visitor ID cookie.
 * Returns the cookie value or undefined if not set / unavailable.
 * Does NOT create or refresh the cookie.
 */
export function getVisitorId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return readCookie(VISITOR_COOKIE_NAME);
}
