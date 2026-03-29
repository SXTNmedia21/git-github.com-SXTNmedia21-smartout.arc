import type { MetadataRoute } from "next";
import { getUserManualDocs } from "@/lib/user-manual";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://smartout.ai";
  const nbDocs = getUserManualDocs("nb");
  const enDocs = getUserManualDocs("en");

  const staticPages = [
    { path: "/", enPath: "/en/", priority: 1.0, freq: "weekly" as const },
    { path: "/pricing", enPath: "/en/pricing", priority: 0.9, freq: "monthly" as const },
    { path: "/docs", enPath: "/en/docs", priority: 0.8, freq: "weekly" as const },
  ];

  const entries: MetadataRoute.Sitemap = [];

  // Static pages with hreflang alternates
  for (const page of staticPages) {
    entries.push({
      url: `${base}${page.path}`,
      changeFrequency: page.freq,
      priority: page.priority,
      alternates: {
        languages: {
          nb: `${base}${page.path}`,
          en: `${base}${page.enPath}`,
        },
      },
    });
  }

  // Norwegian docs with English alternates
  for (const doc of nbDocs) {
    const enDoc = enDocs.find((d) => d.fileName === doc.fileName);
    entries.push({
      url: `${base}/docs/${doc.slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: {
        languages: {
          nb: `${base}/docs/${doc.slug}`,
          en: `${base}/en/docs/${enDoc?.slug ?? doc.slugEn ?? doc.slug}`,
        },
      },
    });
  }

  return entries;
}
