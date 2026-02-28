import { updateSession } from "@smartout/supabase/middleware";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { detectSuspiciousRequest } from "@/lib/security";

export async function middleware(request: NextRequest): Promise<Response> {
  // Security check — block suspicious requests early
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

  // Redirect root to dashboard before session update (no auth needed)
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Update the session (refreshes Supabase auth cookies)
  // Cast needed: pnpm resolves two next@16 instances (web vs @smartout/supabase)
  // with incompatible NextURL[Internal] symbols. Structurally identical at runtime.
  const response = await updateSession(request as unknown as Parameters<typeof updateSession>[0]);

  // Workspace contract_status access control for dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const supabaseForDash = createServerClient(
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
            },
          },
        },
      );

      const {
        data: { user: dashUser },
      } = await supabaseForDash.auth.getUser();

      if (dashUser) {
        const dashAdminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

        // Get the user's first workspace via profile -> workspace
        const { data: profile } = await dashAdminClient
          .from("profile")
          .select("workspace_id")
          .eq("user_id", dashUser.id)
          .limit(1)
          .single();

        if (profile?.workspace_id) {
          const { data: workspace } = await dashAdminClient
            .from("workspace")
            .select("contract_status, trial_ends_at")
            .eq("workspace_id", profile.workspace_id)
            .single();

          if (workspace?.contract_status) {
            const status = workspace.contract_status;

            // setup -> redirect to onboarding wizard
            if (status === "setup") {
              const setupRedirect = NextResponse.redirect(new URL("/onboarding", request.url));
              response.cookies.getAll().forEach((cookie) => {
                setupRedirect.cookies.set(cookie.name, cookie.value);
              });
              return setupRedirect;
            }

            // deactivated -> redirect to blocked page
            if (status === "deactivated") {
              const blockedRedirect = NextResponse.redirect(new URL("/blocked", request.url));
              response.cookies.getAll().forEach((cookie) => {
                blockedRedirect.cookies.set(cookie.name, cookie.value);
              });
              return blockedRedirect;
            }

            // pending_contract / trial -> set header for trial banner
            if (status === "pending_contract" || status === "trial") {
              response.headers.set("x-contract-status", status);
              if (workspace.trial_ends_at) {
                response.headers.set("x-trial-ends-at", workspace.trial_ends_at);
              }
            }

            // suspended -> set header for read-only mode
            if (status === "suspended") {
              response.headers.set("x-contract-status", "suspended");
            }

            // active -> full access, no special headers needed
          }
        }
      }
    }
  }

  // Platform-admin route protection
  if (request.nextUrl.pathname.startsWith("/platform-admin")) {
    const supabase = createServerClient(
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
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginRedirect = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.getAll().forEach((cookie) => {
        loginRedirect.cookies.set(cookie.name, cookie.value);
      });
      return loginRedirect;
    }

    // Check super-admin flag via service role (bypasses RLS)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      const fallback = NextResponse.redirect(new URL("/dashboard", request.url));
      response.cookies.getAll().forEach((cookie) => {
        fallback.cookies.set(cookie.name, cookie.value);
      });
      return fallback;
    }

    const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);

    const { data: identity } = await adminClient
      .from("user_identity")
      .select("is_super_admin")
      .eq("user_id", user.id)
      .single();

    if (!identity?.is_super_admin) {
      const dashRedirect = NextResponse.redirect(new URL("/dashboard", request.url));
      response.cookies.getAll().forEach((cookie) => {
        dashRedirect.cookies.set(cookie.name, cookie.value);
      });
      return dashRedirect;
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
