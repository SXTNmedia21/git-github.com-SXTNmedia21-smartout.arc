import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/en/docs",
    languages: {
      nb: "/docs",
      en: "/en/docs",
    },
  },
};

/**
 * English docs overview page.
 * Re-exports the shared DocsOverviewPage which reads locale from x-locale header.
 */
export { default } from "../../docs/page";
