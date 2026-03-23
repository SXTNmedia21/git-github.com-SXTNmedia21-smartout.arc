import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;

  const body = `User-agent: *
Allow: /
Sitemap: https://${host}/sitemap.xml
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
