import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedSiteByHost, getPreviewSiteByToken } from "./_data/site-public-repository";
import { SiteThemeProvider } from "./_components/SiteThemeProvider";
import { SiteNavigation } from "./_components/SiteNavigation";
import { SiteFooter } from "./_components/SiteFooter";
import { SitePageRenderer } from "./_components/SitePageRenderer";

type Props = {
  params: Promise<{ host: string }>;
  searchParams: Promise<{ preview?: string }>;
};

async function getSnapshot(host: string, previewToken?: string) {
  if (previewToken) {
    return getPreviewSiteByToken(previewToken);
  }
  return getPublishedSiteByHost(host);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { host } = await params;
  const { preview } = await searchParams;
  const snapshot = await getSnapshot(host, preview);
  if (!snapshot) return { title: "Site not found" };

  const homePage = snapshot.pages[""] ?? snapshot.pages["home"];
  const meta = homePage?.meta ?? snapshot.seoDefaults;

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

export default async function PublicSiteHomePage({ params, searchParams }: Props) {
  const { host } = await params;
  const { preview } = await searchParams;
  const snapshot = await getSnapshot(host, preview);
  if (!snapshot) notFound();

  const homePage = snapshot.pages[""] ?? snapshot.pages["home"];
  if (!homePage) notFound();

  const logoAsset = snapshot.assets.byId["logo"];

  return (
    <SiteThemeProvider theme={snapshot.theme}>
      <SiteNavigation
        siteName={snapshot.site.name}
        pages={snapshot.navigation.pages}
        logoAsset={logoAsset}
        storageBaseUrl={snapshot.assets.storageBaseUrl}
      />
      <SitePageRenderer page={homePage} theme={snapshot.theme} assets={snapshot.assets} />
      <SiteFooter site={snapshot.site} />
    </SiteThemeProvider>
  );
}
