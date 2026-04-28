/**
 * curated-articles.ts — Hand-curated KB article dataset for Tier 3.
 *
 * v1: 5 static articles, frontmatter-driven. No RAG (deferred to v2 per
 * design spec §Phase Plan v2). The `article_id` is the stable key used in
 * `help.article_opened` telemetry so rename = new analytics series; avoid
 * rename after v1 ships to production.
 *
 * Article selection criteria:
 *   - High-frequency lookup topics across hospitality + shift-based businesses
 *   - Serves both employee and manager roles (Tier 3 is role-agnostic)
 *   - Each article maps to an existing governance path in the dashboard so
 *     `href` never points at a dead route
 *
 * v2: replace this static list with a RAG query against `workspace_doc_chunk`
 * (B6 doc-ingest pipeline, see design spec §Phase Plan v2).
 */

export type CuratedArticle = {
  /** Stable ID used in `help.article_opened` telemetry. Never rename. */
  article_id: string;
  /** Norwegian display title (I-4 LIX <50 target). */
  title: string;
  /** One-sentence description shown in the Tier 3 list. */
  description: string;
  /** Relative dashboard path the article links to. */
  href: string;
  /**
   * Topical tag — drives Tier 2 quick-path card navigation (clicking a
   * card filters Tier 3 to the matching tag, if implemented in v1.5).
   */
  tag: "vakter" | "lonn" | "onboarding" | "avvik" | "generelt";
};

/**
 * MEST BRUKT NÅ — 5 hand-curated articles for Tier 3.
 *
 * Order is intentional: most-universal first, most-specific last.
 * Do NOT sort alphabetically — frequency of lookup is the sort key.
 */
export const CURATED_ARTICLES: CuratedArticle[] = [
  {
    article_id: "v1-vaktbytte-guide",
    title: "Slik bytter du vakt",
    description: "Steg for steg: send bytteforespørsel, vent på svar, og se hva som skjer videre.",
    href: "/dashboard/my-schedule",
    tag: "vakter",
  },
  {
    article_id: "v1-lonn-timesoversikt",
    title: "Forstå timene og lønnen din",
    description:
      "Hvor ser du arbeidstimer, overtid og trekk? Hva betyr de forskjellige statussymbolene?",
    href: "/dashboard/my-salary",
    tag: "lonn",
  },
  {
    article_id: "v1-onboarding-status",
    title: "Sjekk din onboarding-fremgang",
    description: "Se hvilke prosedyrer og tester som gjenstår før du er fullt opplært.",
    href: "/dashboard/my-training",
    tag: "onboarding",
  },
  {
    article_id: "v1-avvik-melding",
    title: "Meld avvik eller HMS-hendelse",
    description: "Trinn for trinn: hva som skal meldes, hvem som ser det, og hva som skjer etter.",
    href: "/dashboard/hms",
    tag: "avvik",
  },
  {
    article_id: "v1-profil-og-tilgang",
    title: "Endre profil, passord og tilgang",
    description: "Oppdater kontaktinfo, bytt passord, og forstå hvilke rettigheter du har.",
    href: "/dashboard/my-profile",
    tag: "generelt",
  },
];
