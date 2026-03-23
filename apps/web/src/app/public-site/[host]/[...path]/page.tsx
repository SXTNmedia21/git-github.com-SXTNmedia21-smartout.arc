import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedSiteByHost, getPreviewSiteByToken } from "../_data/site-public-repository";
import { SiteThemeProvider } from "../_components/SiteThemeProvider";
import { SiteNavigation } from "../_components/SiteNavigation";
import { SiteFooter } from "../_components/SiteFooter";
import { SitePageRenderer } from "../_components/SitePageRenderer";

type Props = {
  params: Promise<{ host: string; path: string[] }>;
  searchParams: Promise<{ preview?: string }>;
};

async function getSnapshot(host: string, previewToken?: string) {
  if (previewToken) {
    return getPreviewSiteByToken(previewToken);
  }
  return getPublishedSiteByHost(host);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { host, path } = await params;
  const { preview } = await searchParams;
  const snapshot = await getSnapshot(host, preview);
  if (!snapshot) return { title: "Site not found" };

  const slug = path.join("/");
  const page = snapshot.pages[slug];
  const meta = page?.meta ?? snapshot.seoDefaults;

  return {
    title: meta.title || snapshot.site.name,
    description: meta.description || snapshot.site.tagline,
    openGraph: {
      title: meta.title || snapshot.site.name,
      description: meta.description || snapshot.site.tagline,
      images: meta.ogImage ? [meta.ogImage] : [],
    },
  };
}

export default async function PublicSiteDynamicPage({ params, searchParams }: Props) {
  const { host, path } = await params;
  const { preview } = await searchParams;
  const snapshot = await getSnapshot(host, preview);
  if (!snapshot) notFound();

  const slug = path.join("/");
  const page = snapshot.pages[slug];
  if (!page) notFound();

  const logoAsset = snapshot.assets.byId["logo"];

  return (
    <SiteThemeProvider theme={snapshot.theme}>
      <SiteNavigation
        siteName={snapshot.site.name}
        pages={snapshot.navigation.pages}
        logoAsset={logoAsset}
        storageBaseUrl={snapshot.assets.storageBaseUrl}
      />
      <SitePageRenderer page={page} theme={snapshot.theme} assets={snapshot.assets} />
      <SiteFooter site={snapshot.site} />
    </SiteThemeProvider>
  );
}
