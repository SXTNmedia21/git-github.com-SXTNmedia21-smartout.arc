import { updateSession } from "@smartout/supabase/middleware";
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
