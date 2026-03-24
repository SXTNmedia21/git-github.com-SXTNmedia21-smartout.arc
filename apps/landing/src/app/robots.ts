import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/v/"] },
    sitemap: "https://smartout.ai/sitemap.xml",
  };
}
