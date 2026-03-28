import { NextResponse, type NextRequest } from "next/server";

/**
 * Hostnames that should resolve directly to the free-forever pricing campaign.
 */
const FREE_FOREVER_HOSTNAMES = new Set(["free4ever.smartout.ai", "free4ever.localhost"]);

const LOCALE_COOKIE = "smartout-locale";

function getHostname(request: NextRequest): string {
  const hostHeader = request.headers.get("host");
  const host = hostHeader ?? request.nextUrl.host;
  return host.split(":")[0]?.toLowerCase() ?? request.nextUrl.hostname.toLowerCase();
}

/**
 * Resolves locale with this priority:
 * 1. Explicit /en/ URL prefix → "en"
 * 2. Cookie override (user clicked language switcher) → cookie value
 * 3. Vercel geo-detection: Norway → "nb", everything else → "en"
 * 4. Fallback → "nb"
 */
function resolveLocale(request: NextRequest): "nb" | "en" {
  const { pathname } = request.nextUrl;

  // URL prefix always wins
  if (pathname.startsWith("/en/") || pathname === "/en") {
    return "en";
  }

  // Cookie override from language switcher
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale === "en" || cookieLocale === "nb") {
    return cookieLocale;
  }

  // Geo-detection: Vercel sets x-vercel-ip-country automatically
  // Norway → Norwegian, everything else → English
  const country = request.headers.get("x-vercel-ip-country");
  if (country && country !== "NO") {
    return "en";
  }

  return "nb";
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

  // Rewrite /en/* to /* so we don't need duplicate page files for every route.
  // /en/docs has its own route files, so skip those.
  if ((pathname.startsWith("/en/") || pathname === "/en") && !pathname.startsWith("/en/docs")) {
    const strippedPath = pathname.replace(/^\/en/, "") || "/";
    const url = request.nextUrl.clone();
    url.pathname = strippedPath;
    const response = NextResponse.rewrite(url);
    response.headers.set("x-locale", "en");
    return response;
  }

  const locale = resolveLocale(request);

  // Cookie says "en" but user navigated to non-/en/ path → redirect to /en/
  if (locale === "en" && !pathname.startsWith("/en") && pathname !== "/en") {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    if (cookieLocale === "en") {
      const url = request.nextUrl.clone();
      url.pathname = `/en${pathname}`;
      return NextResponse.redirect(url, 302);
    }
    // First visit from abroad (no cookie) → redirect to /en/
    if (!cookieLocale) {
      const url = request.nextUrl.clone();
      url.pathname = `/en${pathname}`;
      return NextResponse.redirect(url, 302);
    }
  }

  const response = NextResponse.next();
  response.headers.set("x-locale", locale);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
