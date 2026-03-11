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

export function middleware(request: NextRequest) {
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
