import { NextResponse, type NextRequest } from "next/server";

/**
 * Hostnames that should resolve directly to the free-forever pricing campaign.
 * Why: the campaign launches on a dedicated public subdomain while keeping the
 * main `/pricing` route intact on the root marketing domain.
 */
const FREE_FOREVER_HOSTNAMES = new Set(["free4ever.smartout.ai", "free4ever.localhost"]);

/**
 * Returns the normalized hostname from the request, without a port suffix.
 * This keeps local development and production host checks consistent.
 */
function getHostname(request: NextRequest): string {
  const hostHeader = request.headers.get("host");
  const host = hostHeader ?? request.nextUrl.host;
  return host.split(":")[0]?.toLowerCase() ?? request.nextUrl.hostname.toLowerCase();
}

export function middleware(request: NextRequest) {
  const hostname = getHostname(request);
  const { pathname } = request.nextUrl;

  // Free-forever subdomain rewrite
  if (pathname === "/" && FREE_FOREVER_HOSTNAMES.has(hostname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/free-forever";
    return NextResponse.rewrite(url);
  }

  // Locale detection: /en/ prefix = English, everything else = Norwegian
  const isEnglish = pathname.startsWith("/en/") || pathname === "/en";
  const locale = isEnglish ? "en" : "nb";

  const response = NextResponse.next();
  response.headers.set("x-locale", locale);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
