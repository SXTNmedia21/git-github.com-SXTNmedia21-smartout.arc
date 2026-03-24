import { updateSession } from "@smartout/supabase/middleware";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { detectSuspiciousRequest } from "@/lib/security";
import { extractSubdomain } from "@/lib/subdomain";

// Routes that never require authentication — skip updateSession() entirely
// to avoid triggering token refresh (and 429 storms) on unauthenticated hits.
// /login is the auth entrypoint; /api/* health routes must be reachable without sessions.
const PUBLIC_ROUTES = new Set(["/login", "/api/smoke", "/api/health", "/api/auth/callback"]);

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  for (const route of PUBLIC_ROUTES) {
    if (pathname.startsWith(route + "/")) return true;
  }
  return false;
}

type GodmodeCacheEntry = {
  isGodmode: boolean;
  expiresAt: number;
};

const GODMODE_CACHE_TTL_MS = 30_000;
const godmodeCache = new Map<string, GodmodeCacheEntry>();
const SHOWCASE_COOKIE = "smartout_showcase";
const SHOWCASE_COOKIE_AGE_SECONDS = 4 * 60 * 60;

/**
 * Copy auth cookies from the session response onto a redirect response.
 * Required because redirect responses are new objects that don't carry
 * cookies set by updateSession(). See Learning-0002.
 *
 * Uses structural typing to avoid the dual next@16 pnpm instance conflict
 * where NextResponse[INTERNALS] symbols differ between resolved packages.
 */
function copySessionCookies(
  source: { cookies: { getAll(): Array<{ name: string; value: string }> } },
  target: { cookies: { set(name: string, value: string): void } },
): void {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value);
  });
}

/**
 * Returns cached godmode state for a user, refreshing from database on miss/expiry.
 * This removes repeated is_godmode lookups during quick route-to-route navigation.
 */
async function getCachedGodmodeStatus(
  adminClient: { from: (table: string) => ReturnType<ReturnType<typeof createClient>["from"]> },
  userId: string,
): Promise<boolean> {
  const now = Date.now();
  const cached = godmodeCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.isGodmode;
  }

  const { data } = await adminClient
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", userId)
    .single();

  const isGodmode = Boolean(data?.is_godmode);
  godmodeCache.set(userId, { isGodmode, expiresAt: now + GODMODE_CACHE_TTL_MS });
  return isGodmode;
}

/**
 * Applies showcase mode toggle from query/cookie and emits a request-scoped header
 * that server components can read to bypass onboarding redirects during demos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dual next package resolution causes NextResponse type mismatch
function applyShowcaseMode(request: NextRequest, response: any): void {
  const showcaseQuery = request.nextUrl.searchParams.get("showcase");
  const hasShowcaseCookie = request.cookies.get(SHOWCASE_COOKIE)?.value === "1";

  let showcaseEnabled = hasShowcaseCookie;

  if (showcaseQuery === "1") {
    showcaseEnabled = true;
    response.cookies.set(SHOWCASE_COOKIE, "1", {
      path: "/",
      maxAge: SHOWCASE_COOKIE_AGE_SECONDS,
      sameSite: "lax",
    });
  } else if (showcaseQuery === "0") {
    showcaseEnabled = false;
    response.cookies.delete(SHOWCASE_COOKIE);
  }

  if (showcaseEnabled && request.nextUrl.pathname.startsWith("/dashboard")) {
    response.headers.set("x-showcase-mode", "1");
  }
}

export async function middleware(request: NextRequest): Promise<Response> {
  // ── 1. Security — block suspicious requests ──
  const { suspicious, reasons } = detectSuspiciousRequest(request);
  if (suspicious) {
    console.warn(
      JSON.stringify({
        level: "warn",
        action: "suspicious_request_blocked",
        category: "security",
        path: request.nextUrl.pathname,
        reasons,
        ip: request.headers.get("x-forwarded-for") ?? "unknown",
        timestamp: new Date().toISOString(),
      }),
    );
    return new NextResponse("Bad Request", { status: 400 });
  }

  // ── 2. Subdomain detection ──
  const host = request.headers.get("host") ?? "localhost";
  const subdomain = extractSubdomain(host);

  // Public site (*.smartout.info) — rewrite to /public-site/{host}/...
  if (subdomain.type === "public-site") {
    const url = request.nextUrl.clone();
    const pathSegments = url.pathname.split("/").filter(Boolean);
    url.pathname = `/public-site/${subdomain.host}/${pathSegments.join("/")}`;
    const response = NextResponse.rewrite(url);
    response.headers.set("x-site-host", subdomain.host);
    return response;
  }

  // Root domain (smartout.ai) — should be handled by landing Vercel project.
  // If it hits this app, redirect to landing.
  if (subdomain.type === "root") {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    // In dev without subdomains: fall through to existing behavior
    if (!rootDomain || rootDomain === "localhost") {
      return handleLegacyRouting(request);
    }
    return NextResponse.redirect(new URL("/", `https://${rootDomain}`));
  }

  // Reserved subdomains — pass through (handled by other Vercel projects)
  if (subdomain.type === "reserved") {
    return NextResponse.next();
  }

  // ── 3. Public routes — skip auth entirely to prevent token refresh storms ──
  const pathname = request.nextUrl.pathname;
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next({ request });
    applyShowcaseMode(request, response);
    return response;
  }

  // ── 4. Update Supabase auth session ──
  const { response, user: sessionUser } = await updateSession(
    request as unknown as Parameters<typeof updateSession>[0],
  );

  // ── 5. Portal (app.smartout.ai) ──
  if (subdomain.type === "portal") {
    const showcaseRequested =
      request.nextUrl.searchParams.get("showcase") === "1" ||
      request.cookies.get(SHOWCASE_COOKIE)?.value === "1";

    // /join is always open — anyone can start creating a workspace

    // Portal root → workspace selector
    if (pathname === "/") {
      const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
      copySessionCookies(response, redir);
      applyShowcaseMode(request, redir);
      return redir;
    }

    // Portal /dashboard* → redirect to workspace selector
    // (user hit /dashboard on the portal subdomain — no workspace context available)
    if (pathname.startsWith("/dashboard") && !showcaseRequested) {
      const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
      copySessionCookies(response, redir);
      applyShowcaseMode(request, redir);
      return redir;
    }

    // Platform-admin route protection
    if (pathname.startsWith("/platform-admin")) {
      if (!sessionUser) {
        const redir = NextResponse.redirect(new URL("/login", request.url));
        copySessionCookies(response, redir);
        applyShowcaseMode(request, redir);
        return redir;
      }

      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
        copySessionCookies(response, redir);
        applyShowcaseMode(request, redir);
        return redir;
      }

      const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
      const isGodmode = await getCachedGodmodeStatus(adminClient, sessionUser.id);
      if (!isGodmode) {
        const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
        copySessionCookies(response, redir);
        applyShowcaseMode(request, redir);
        return redir;
      }
    }
    applyShowcaseMode(request, response);
    return response;
  }

  // ── 5. Workspace subdomain ({slug}.smartout.ai) ──
  if (subdomain.type === "workspace") {
    const slug = subdomain.slug;

    // Set workspace slug header for downstream consumption
    response.headers.set("x-workspace-slug", slug);

    // Root of workspace subdomain → redirect to dashboard
    if (request.nextUrl.pathname === "/") {
      const redir = NextResponse.redirect(new URL("/dashboard", request.url));
      copySessionCookies(response, redir);
      redir.headers.set("x-workspace-slug", slug);
      applyShowcaseMode(request, redir);
      return redir;
    }
    applyShowcaseMode(request, response);
    return response;
  }
  applyShowcaseMode(request, response);
  return response;
}

/**
 * Legacy routing for local development without subdomains.
 * When running on plain localhost:3050, behave like the old middleware.
 */
async function handleLegacyRouting(request: NextRequest): Promise<Response> {
  if (request.nextUrl.pathname === "/") {
    const redir = NextResponse.redirect(new URL("/dashboard", request.url));
    applyShowcaseMode(request, redir);
    return redir;
  }

  // Skip auth for public routes — avoids token refresh on unauthenticated hits
  if (isPublicRoute(request.nextUrl.pathname)) {
    const response = NextResponse.next({ request });
    applyShowcaseMode(request, response);
    return response;
  }

  const { response, user: sessionUser } = await updateSession(
    request as unknown as Parameters<typeof updateSession>[0],
  );
  applyShowcaseMode(request, response);

  const pathname = request.nextUrl.pathname;
  const needsDashboardGate = pathname.startsWith("/dashboard");
  const needsAdminGate = pathname.startsWith("/platform-admin");

  // Pass ?ws= query param as header for local dev workspace selection
  const wsParam = request.nextUrl.searchParams.get("ws");
  if (wsParam && needsDashboardGate) {
    response.headers.set("x-workspace-id-param", wsParam);
  }

  // /join is always open — anyone can start creating a workspace

  // Early exit for routes that need no extra queries
  if (!needsDashboardGate && !needsAdminGate) return response;
  if (!sessionUser) {
    if (needsAdminGate) {
      const redir = NextResponse.redirect(new URL("/login", request.url));
      copySessionCookies(response, redir);
      applyShowcaseMode(request, redir);
      return redir;
    }
    return response;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    if (needsAdminGate) {
      const redir = NextResponse.redirect(new URL("/dashboard", request.url));
      copySessionCookies(response, redir);
      applyShowcaseMode(request, redir);
      return redir;
    }
    return response;
  }

  // Single admin client
  const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
  // Platform-admin protection
  if (needsAdminGate) {
    const isGodmode = await getCachedGodmodeStatus(adminClient, sessionUser.id);
    if (!isGodmode) {
      const redir = NextResponse.redirect(new URL("/dashboard", request.url));
      copySessionCookies(response, redir);
      applyShowcaseMode(request, redir);
      return redir;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
