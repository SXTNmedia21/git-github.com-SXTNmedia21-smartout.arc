/**
 * CuratedArticlesList.tsx — Tier 3: "Mest brukt nå" KB article list.
 *
 * Server component. Renders a plain divide-y list of hand-curated KB
 * articles — no card chrome (40% chrome reduction principle from design
 * spec §Tier 3). Each row is a full-bleed link with a TtsButton to read
 * the title + description aloud (browser-native SpeechSynthesis, nb-NO).
 *
 * Design decisions:
 *   - No card wrappers, no border boxes, no shadows — only a subtle
 *     divide-y separator to group items without adding visual weight.
 *   - Full row is the click target (padding on <a>, not on an inner div).
 *   - TtsButton floats right inside the row and is excluded from the
 *     link's click area so TTS and navigation are independent actions.
 *   - v2: replace static articles prop with RAG query against
 *     workspace_doc_chunk (see design spec §Phase Plan v2).
 *
 * ADR-0219, ADR-0220 (no card chrome rule)
 */

import Link from "next/link";
import type { CuratedArticle } from "../_data/curated-articles";
import { TtsButton } from "./TtsButton";

interface CuratedArticlesListProps {
  articles: CuratedArticle[];
}

export function CuratedArticlesList({ articles }: CuratedArticlesListProps) {
  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="curated-articles-heading">
      <h2
        id="curated-articles-heading"
        className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Mest brukt nå
      </h2>

      {/* Plain divide-y list — zero card chrome per design spec §Tier 3. */}
      <ul className="divide-y divide-border" role="list">
        {articles.map((article) => (
          <li key={article.article_id} className="flex items-center gap-2">
            {/*
             * Full-row link: padding is on the <a> so the entire row area
             * (minus the TtsButton) is a valid click target for navigation.
             */}
            <Link
              href={article.href}
              className="flex-1 py-3 group"
              aria-label={article.title}
            >
              <p className="text-sm font-medium text-foreground group-hover:underline">
                {article.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {article.description}
              </p>
            </Link>

            {/*
             * TtsButton is outside the <Link> so clicking "hør" does not
             * trigger navigation. SpeechSynthesis reads title + description.
             */}
            <TtsButton
              text={`${article.title}. ${article.description}`}
              label={`Hør: ${article.title}`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
