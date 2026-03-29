import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

function getMiddlewareCookieDomain(): string | undefined {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain || rootDomain === "localhost") return undefined;
  return `.${rootDomain}`;
}

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const cookieDomain = getMiddlewareCookieDomain();

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

  return { response: supabaseResponse, user };
}
