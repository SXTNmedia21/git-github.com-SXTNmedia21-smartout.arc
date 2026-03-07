// ============================================
// page.tsx
// Server-rendered landing entrypoint that resolves a DB variant from query
// params and renders block-based content with tracking context.
// Why: keeps the live path server-first while supporting slug routing and
// admin preview compatibility without relying on client-side variant state.
// ============================================

import type { Metadata } from "next";
import { createHmac, timingSafeEqual } from "node:crypto";
import Navigation from "../components/navigation";
import Footer from "../components/footer";
import { BlockRenderer } from "../components/blocks/BlockRenderer";
import { getVariantWithBlocks, parseTheme, type VariantWithBlocks } from "../lib/get-variant";
import { LandingTracker } from "./tracking-client";

type RawSearchParams = Record<string, string | string[] | undefined>;

type LandingPageProps = {
  searchParams?: Promise<RawSearchParams>;
};

/**
 * Normalizes App Router search params into a plain object.
 * Why: Next.js can provide `searchParams` as either a plain object or Promise.
 *
 * @returns A normalized search param map.
 */
async function resolveSearchParams(
  searchParams?: Promise<RawSearchParams>,
): Promise<RawSearchParams> {
  if (!searchParams) return {};
  return await searchParams;
}

/**
 * Reads a single query param value from a normalized search param map.
 * Why: App Router values can be arrays, and we only need one value.
 *
 * @returns The first query param value, or undefined.
 */
function getSearchParamValue(params: RawSearchParams, key: string): string | undefined {
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/**
 * Validates a signed preview token for draft variant rendering.
 *
 * Why: preview-by-id bypasses published filters and must be gated.
 *
 * @param variantId - Variant UUID from query.
 * @param expiresAt - Expiry timestamp (ms since epoch) from query.
 * @param signature - HMAC hex signature from query.
 * @returns True when signature is valid and not expired.
 */
function isValidPreviewToken(variantId: string, expiresAt: string, signature: string): boolean {
  const secret = process.env.LANDING_PREVIEW_SECRET;
  if (!secret) return false;

  const expiresAtMs = Number(expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${variantId}:${expiresAt}`).digest("hex");
  if (expected.length !== signature.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}

/**
 * Resolves which variant should be loaded for the current request.
 * Why: live visitors use `?v=slug`, while admin preview uses `preview=true&id=uuid`.
 *
 * @returns Variant payload and preview flag.
 */
async function resolveVariantForRequest(
  params: RawSearchParams,
): Promise<{ data: VariantWithBlocks | null; isPreview: boolean }> {
  const slug = getSearchParamValue(params, "v");
  const previewFlag = getSearchParamValue(params, "preview");
  const previewId = getSearchParamValue(params, "id");
  const previewExpiresAt = getSearchParamValue(params, "exp");
  const previewSignature = getSearchParamValue(params, "sig");
  const isPreview =
    previewFlag === "true" &&
    Boolean(previewId) &&
    Boolean(previewExpiresAt) &&
    Boolean(previewSignature) &&
    isValidPreviewToken(
      previewId as string,
      previewExpiresAt as string,
      previewSignature as string,
    );

  const data = isPreview
    ? await getVariantWithBlocks(undefined, previewId)
    : await getVariantWithBlocks(slug);

  return { data, isPreview };
}

/**
 * Generates metadata from the resolved landing variant.
 * Why: published variants can override title/description, while preview should
 * avoid indexing.
 *
 * @returns Metadata for the landing response.
 */
export async function generateMetadata({ searchParams }: LandingPageProps): Promise<Metadata> {
  const params = await resolveSearchParams(searchParams);
  const { data, isPreview } = await resolveVariantForRequest(params);

  const fallbackTitle = "SmartOut - Møt fremtidens workforce management";
  const fallbackDescription = "AI-drevet workforce management for den norske serveringsbransjen.";

  const title = data?.variant.meta_title ?? fallbackTitle;
  const description = data?.variant.meta_description ?? fallbackDescription;

  if (isPreview) {
    return {
      title: `[Preview] ${title}`,
      description,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return { title, description };
}

/**
 * Root landing route that renders the resolved DB variant as blocks.
 * Why: this is the live production path and must be server-first.
 *
 * @returns The landing page markup for the resolved variant.
 */
export default async function LandingPage({ searchParams }: LandingPageProps) {
  const params = await resolveSearchParams(searchParams);
  const { data } = await resolveVariantForRequest(params);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <Navigation />
        <main className="mx-auto flex max-w-5xl items-center justify-center px-6 py-40 text-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Landing variant is unavailable
            </h1>
            <p className="mt-4 text-zinc-400">
              No published default variant was resolved. Publish a default landing variant in admin
              to render this page.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <LandingTracker variant={data.variant.slug} />
      <Navigation />
      <main className="relative z-10">
        <BlockRenderer blocks={data.blocks} theme={parseTheme(data.variant.theme)} />
      </main>
      <Footer />
    </div>
  );
}
