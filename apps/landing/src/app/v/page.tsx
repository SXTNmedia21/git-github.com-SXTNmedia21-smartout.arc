// ============================================
// v/page.tsx
// Compatibility route for landing admin preview URLs.
// Why: admin currently links to `/v?preview=true&id=...`; this route forwards
// to the same renderer used on `/` so behavior stays consistent.
// ============================================

import LandingPage, { generateMetadata as generateLandingMetadata } from "../page";

type RawSearchParams = Record<string, string | string[] | undefined>;

type VariantRouteProps = {
  searchParams?: Promise<RawSearchParams>;
};

export const generateMetadata = generateLandingMetadata;

/**
 * Compatibility page that renders the shared landing route implementation.
 * Why: keeps preview and live URL paths coherent while avoiding duplicated logic.
 *
 * @returns The shared landing route output.
 */
export default async function LandingVariantCompatibilityRoute(props: VariantRouteProps) {
  return <LandingPage {...props} />;
}
