import { updateSession } from "@smartout/supabase/middleware";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { detectSuspiciousRequest } from "@/lib/security";
import { extractSubdomain } from "@/lib/subdomain";

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

  // ── 3. Update Supabase auth session ──
  const { response, user: sessionUser } = await updateSession(
    request as unknown as Parameters<typeof updateSession>[0],
  );

  // ── 4. Portal (app.smartout.ai) ──
  if (subdomain.type === "portal") {
    const pathname = request.nextUrl.pathname;

    // Portal root → workspace selector
    if (pathname === "/") {
      const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
      copySessionCookies(response, redir);
      return redir;
    }

    // Portal /dashboard* → redirect to workspace selector
    // (user hit /dashboard on the portal subdomain — no workspace context available)
    if (pathname.startsWith("/dashboard")) {
      const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
      copySessionCookies(response, redir);
      return redir;
    }

    // Platform-admin route protection
    if (pathname.startsWith("/platform-admin")) {
      if (!sessionUser) {
        const redir = NextResponse.redirect(new URL("/login", request.url));
        copySessionCookies(response, redir);
        return redir;
      }

      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
        copySessionCookies(response, redir);
        return redir;
      }

      const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
      const { data: identity } = await adminClient
        .from("user_identity")
        .select("is_super_admin")
        .eq("user_id", sessionUser.id)
        .single();

      if (!identity?.is_super_admin) {
        const redir = NextResponse.redirect(new URL("/select-workspace", request.url));
        copySessionCookies(response, redir);
        return redir;
      }
    }

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
      return redir;
    }

    // Contract status gating for dashboard routes
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey && sessionUser) {
        const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

        const { data: profile } = await adminClient
          .from("profile")
          .select("workspace_id, workspace:workspace_id(contract_status, trial_ends_at)")
          .eq("user_id", sessionUser.id)
          .limit(1)
          .single();

        const workspace = profile?.workspace as unknown as {
          contract_status: string | null;
          trial_ends_at: string | null;
        } | null;

        if (workspace?.contract_status) {
          const status = workspace.contract_status;

          if (status === "setup") {
            const redir = NextResponse.redirect(new URL("/onboarding", request.url));
            copySessionCookies(response, redir);
            return redir;
          }

          if (status === "deactivated") {
            const redir = NextResponse.redirect(new URL("/blocked", request.url));
            copySessionCookies(response, redir);
            return redir;
          }

          if (status === "pending_contract" || status === "trial") {
            response.headers.set("x-contract-status", status);
            if (workspace.trial_ends_at) {
              response.headers.set("x-trial-ends-at", workspace.trial_ends_at);
            }
          }

          if (status === "suspended") {
            response.headers.set("x-contract-status", "suspended");
          }
        }
      }
    }

    return response;
  }

  return response;
}

/**
 * Legacy routing for local development without subdomains.
 * When running on plain localhost:3050, behave like the old middleware.
 */
async function handleLegacyRouting(request: NextRequest): Promise<Response> {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const { response, user: sessionUser } = await updateSession(
    request as unknown as Parameters<typeof updateSession>[0],
  );

  // Dashboard contract_status gating (same as workspace subdomain)
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey && sessionUser) {
      const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

      const { data: profile } = await adminClient
        .from("profile")
        .select("workspace_id, workspace:workspace_id(contract_status, trial_ends_at)")
        .eq("user_id", sessionUser.id)
        .limit(1)
        .single();

      const workspace = profile?.workspace as unknown as {
        contract_status: string | null;
        trial_ends_at: string | null;
      } | null;

      if (workspace?.contract_status) {
        const status = workspace.contract_status;

        if (status === "setup") {
          const redir = NextResponse.redirect(new URL("/onboarding", request.url));
          copySessionCookies(response, redir);
          return redir;
        }

        if (status === "deactivated") {
          const redir = NextResponse.redirect(new URL("/blocked", request.url));
          copySessionCookies(response, redir);
          return redir;
        }

        if (status === "pending_contract" || status === "trial") {
          response.headers.set("x-contract-status", status);
          if (workspace.trial_ends_at) {
            response.headers.set("x-trial-ends-at", workspace.trial_ends_at);
          }
        }

        if (status === "suspended") {
          response.headers.set("x-contract-status", "suspended");
        }
      }
    }
  }

  // Platform-admin protection
  if (request.nextUrl.pathname.startsWith("/platform-admin")) {
    if (!sessionUser) {
      const redir = NextResponse.redirect(new URL("/login", request.url));
      copySessionCookies(response, redir);
      return redir;
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      const redir = NextResponse.redirect(new URL("/dashboard", request.url));
      copySessionCookies(response, redir);
      return redir;
    }

    const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
    const { data: identity } = await adminClient
      .from("user_identity")
      .select("is_super_admin")
      .eq("user_id", sessionUser.id)
      .single();

    if (!identity?.is_super_admin) {
      const redir = NextResponse.redirect(new URL("/dashboard", request.url));
      copySessionCookies(response, redir);
      return redir;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
