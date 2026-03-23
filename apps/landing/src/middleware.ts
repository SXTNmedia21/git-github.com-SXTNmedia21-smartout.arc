import { NextResponse, type NextRequest } from "next/server";

/**
 * Legacy ?v= query parameter redirect.
 * Maps old variant URLs (/?v=E) to new perspective slugs (/drift).
 * 301 permanent redirect for SEO.
 */
const LEGACY_VARIANT_TO_SLUG: Record<string, string> = {
  E: "/drift",
  T: "/tilsyn",
  K: "/vekst",
  A: "/tilhorighet",
  F: "/opplaering",
  S: "/handverk",
  V: "/vaktliste",
  I: "/ai",
  M: "/kommunikasjon",
};

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

  if (request.nextUrl.pathname === "/" && FREE_FOREVER_HOSTNAMES.has(hostname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/free-forever";
    return NextResponse.rewrite(url);
  }

  const { searchParams } = request.nextUrl;
  const v = searchParams.get("v")?.toUpperCase();

  if (v && v in LEGACY_VARIANT_TO_SLUG) {
    const url = request.nextUrl.clone();
    url.pathname = LEGACY_VARIANT_TO_SLUG[v]!;
    url.searchParams.delete("v");
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
