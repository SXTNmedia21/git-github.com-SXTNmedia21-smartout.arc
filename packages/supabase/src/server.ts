import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type User, type UserResponse } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { assertRootDomain } from "./_assert-root-domain";

// Assert at module load so any cold-start in production fails fast if the env
// var is missing — prevents silent cookie-domain drift (ADR-0363).
assertRootDomain();

function getServerCookieDomain(): string | undefined {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain || rootDomain === "localhost") return undefined;
  return `.${rootDomain}`;
}

// Module-level dedup cache for auth.getUser() results in Server Components
// and Route Handlers. RSC fan-out + parallel API calls in the same request
// trigger many getUser() invocations against /auth/v1/user. Caching by the
// sb-* cookie set collapses those into one. Cookies rotate on token refresh
// (cache miss), so security posture is preserved within TTL_MS.
type SsrAuthCacheEntry = { user: User | null; expiresAt: number };
const ssrAuthCache = new Map<string, SsrAuthCacheEntry>();
const SSR_AUTH_CACHE_TTL_MS = 5_000;
const SSR_AUTH_CACHE_MAX = 1000;

function buildSsrAuthKey(cookies: { name: string; value: string }[]): string | null {
  const sb = cookies.filter((c) => c.name.startsWith("sb-"));
  if (sb.length === 0) return null;
  return sb
    .map((c) => `${c.name}=${c.value}`)
    .sort()
    .join("|");
}

export async function createClient() {
  const cookieStore = await cookies();
  const cookieDomain = getServerCookieDomain();

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(cookieDomain ? { domain: cookieDomain } : {}),
              }),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );

  // Patch auth.getUser to dedupe by sb-cookie hash. Bypass when caller passes
  // an explicit jwt arg (those callers want fresh validation, not cookie state).
  const originalGetUser = client.auth.getUser.bind(client.auth);
  const cachedGetUser = async (jwt?: string): Promise<UserResponse> => {
    if (jwt !== undefined) return originalGetUser(jwt);

    const cacheKey = buildSsrAuthKey(cookieStore.getAll());
    if (cacheKey) {
      const cached = ssrAuthCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          data: { user: cached.user },
          error: null,
        } as UserResponse;
      }
    }

    const result = await originalGetUser();

    // Only cache positive authentications. A null user with no error is
    // the "anonymous / invalid token" path — caching it would freeze a
    // transient state and cause Server Components to redirect to /login
    // even after the cookie is refreshed.
    if (cacheKey && !result.error && result.data.user) {
      if (ssrAuthCache.size >= SSR_AUTH_CACHE_MAX) {
        const firstKey = ssrAuthCache.keys().next().value;
        if (firstKey) ssrAuthCache.delete(firstKey);
      }
      ssrAuthCache.set(cacheKey, {
        user: result.data.user,
        expiresAt: Date.now() + SSR_AUTH_CACHE_TTL_MS,
      });
    }

    return result;
  };
  client.auth.getUser = cachedGetUser as typeof client.auth.getUser;

  return client;
}
