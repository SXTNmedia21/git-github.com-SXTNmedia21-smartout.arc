import { NextResponse } from "next/server";
import { getPublishedSiteByHost } from "../_data/site-public-repository";

export async function GET(_request: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const snapshot = await getPublishedSiteByHost(host);

  if (!snapshot) {
    return new NextResponse("Site not found", { status: 404 });
  }

  const baseUrl = `https://${host}`;
  const pages = Object.values(snapshot.pages);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${baseUrl}${page.slug === "" ? "/" : `/${page.slug}`}</loc>
    <lastmod>${snapshot.buildMeta.publishedAt}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
