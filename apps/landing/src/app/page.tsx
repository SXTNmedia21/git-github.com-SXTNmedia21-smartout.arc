// ============================================
// page.tsx
// DB-driven landing page (root route).
// Renders a landing variant fetched from Supabase:
//   /               → default published variant (is_default=true)
//   /?v=slug        → published variant by slug
//   /?preview=true&id=uuid → draft preview (any status)
//
// Connected to: lib/get-variant.ts (data fetching)
//               components/blocks/BlockRenderer.tsx (rendering)
//               components/navigation.tsx, footer.tsx, tracking.tsx
// ============================================

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVariantWithBlocks, parseTheme } from "../lib/get-variant";
import Navigation from "../components/navigation";
import Footer from "../components/footer";
import { PageTracker } from "../components/tracking";
import { BlockRenderer } from "../components/blocks";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const slug = getString(params.v);
  const isPreview = getString(params.preview) === "true";
  const previewId = isPreview ? getString(params.id) : undefined;

  const result = await getVariantWithBlocks(slug, previewId);

  if (!result) {
    return {
      title: "Smartout - Personalklarhet fra dag 1",
      description: "AI-drevet opplaring og daglig drift for skiftbaserte virksomheter.",
    };
  }

  const { variant } = result;

  return {
    title: variant.meta_title ?? `${variant.name} | Smartout`,
    description:
      variant.meta_description ??
      "AI-drevet opplaring og daglig drift for skiftbaserte virksomheter.",
    ...(variant.og_image_path
      ? {
          openGraph: {
            images: [{ url: variant.og_image_path }],
          },
        }
      : {}),
    ...(isPreview ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function VariantPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const slug = getString(params.v);
  const isPreview = getString(params.preview) === "true";
  const previewId = isPreview ? getString(params.id) : undefined;

  const result = await getVariantWithBlocks(slug, previewId);

  if (!result) {
    redirect("/legacy");
  }

  const { variant, blocks } = result;
  const theme = parseTheme(variant.theme);

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-[#0a0a0c] pt-16">
        {isPreview && (
          <div className="bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white">
            Forhandsvisning &mdash; dette er ikke publisert enna
          </div>
        )}
        <BlockRenderer blocks={blocks} theme={theme} />
      </main>
      <Footer />
      <PageTracker />
    </>
  );
}
