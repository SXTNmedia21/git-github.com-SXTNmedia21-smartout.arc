import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

function getMiddlewareCookieDomain(host: string | null): string | undefined {
  // Vercel preview deploys (*.vercel.app) cannot share cookies with the
  // production root domain (`.smartout.ai`) — browsers reject the mismatch
  // and the auth session never persists across requests. Fall back to the
  // current host (Set-Cookie without explicit domain).
  if (host && host.endsWith(".vercel.app")) return undefined;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain || rootDomain === "localhost") return undefined;
  return `.${rootDomain}`;
}

// Module-level cache for auth.getUser() results, keyed on the sb-* cookie set.
// RSC fan-out + dashboard polling can produce 10+ middleware runs per page load,
// each calling /auth/v1/user. Caching by cookie value cuts duplicate auth calls
// without weakening security: cookies rotate on token refresh (cache miss),
// and revocation propagates within TTL_MS.
type AuthCacheEntry = { user: User | null; expiresAt: number };
const authCache = new Map<string, AuthCacheEntry>();
const AUTH_CACHE_TTL_MS = 5_000;
const AUTH_CACHE_MAX_ENTRIES = 1000;

function buildAuthCacheKey(cookies: { name: string; value: string }[]): string | null {
  const sb = cookies.filter((c) => c.name.startsWith("sb-"));
  if (sb.length === 0) return null;
  return sb
    .map((c) => `${c.name}=${c.value}`)
    .sort()
    .join("|");
}

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const cookieDomain = getMiddlewareCookieDomain(request.headers.get("host"));

  const cacheKey = buildAuthCacheKey(request.cookies.getAll());
  if (cacheKey) {
    const cached = authCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { response: supabaseResponse, user: cached.user };
    }
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            }),
          );
        },
      },
    },
  );

  let user: User | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Auth failed (stale token, revoked session, rate-limited).
      // Clear auth cookies to break retry loops — the browser will stop
      // sending the dead refresh token on subsequent requests.
      const authCookies = request.cookies.getAll().filter((c) => c.name.startsWith("sb-"));
      if (authCookies.length > 0) {
        supabaseResponse = NextResponse.next({ request });
        for (const cookie of authCookies) {
          supabaseResponse.cookies.set(cookie.name, "", {
            maxAge: 0,
            path: "/",
            ...(cookieDomain ? { domain: cookieDomain } : {}),
          });
        }
        console.warn(
          `[middleware] auth.getUser error: ${error.message} — cleared ${authCookies.length} auth cookies`,
        );
      }
    } else {
      user = data.user;
    }
  } catch (err) {
    console.error("[middleware] auth.getUser threw:", err);
  }

  // Only cache positive authentications. Null user with sb-* cookies present
  // means the token failed (caller cleared the cookies above) — caching null
  // would keep redirecting subsequent requests with the stale cookie set.
  if (cacheKey && user) {
    if (authCache.size >= AUTH_CACHE_MAX_ENTRIES) {
      const firstKey = authCache.keys().next().value;
      if (firstKey) authCache.delete(firstKey);
    }
    authCache.set(cacheKey, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  }

  return { response: supabaseResponse, user };
}
