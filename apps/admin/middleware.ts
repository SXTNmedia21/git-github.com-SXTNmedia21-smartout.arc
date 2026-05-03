/**
 * middleware.ts — apps/admin
 *
 * Auth gate for admin.smartout.ai. Ensures a Supabase session exists before
 * reaching any protected route. The accountant-role check (grant lookup) is
 * intentionally deferred to (admin)/layout.tsx to avoid a DB round-trip on
 * every request — the layout pulls grants once via React.cache and gates the
 * entire route group.
 *
 * Public paths: /auth/login, /auth/callback, /auth/logout, /api/health
 * Everything else requires an authenticated session.
 */
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@smartout/supabase/middleware";

const PUBLIC_PATHS = new Set(["/auth/login", "/auth/callback", "/auth/logout", "/api/health"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/health")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always run updateSession so cookies are refreshed / rotated as needed.
  const { response, user } = await updateSession(request);

  if (isPublic(pathname)) return response;

  // No session → redirect to login, preserving the intended destination.
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session exists. Accountant-role check happens in (admin)/layout.tsx.
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
