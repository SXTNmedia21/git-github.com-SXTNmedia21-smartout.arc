import { notFound } from "next/navigation";
import Link from "next/link";
import { getUserManualDocBySlug, getUserManualDocs } from "@/lib/user-manual";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DocsBreadcrumb } from "../../../docs/_components/docs-breadcrumb";
import { MarkdownRenderer } from "../../../docs/_components/markdown-renderer";

type DocsManualPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getUserManualDocs("en").map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: DocsManualPageProps) {
  const { slug } = await params;
  const doc = getUserManualDocBySlug(slug, "en");
  if (!doc) {
    return { title: "Documentation" };
  }
  return {
    title: `${doc.title} – SmartOut Docs`,
    description: doc.excerpt,
  };
}

function getAdjacentDocs(slug: string) {
  const docs = getUserManualDocs("en");
  const idx = docs.findIndex((d) => d.slug === slug);
  return {
    prev: idx > 0 ? docs[idx - 1] : null,
    next: idx < docs.length - 1 ? docs[idx + 1] : null,
  };
}

export default async function EnDocsManualPage({ params }: DocsManualPageProps) {
  const { slug } = await params;
  const doc = getUserManualDocBySlug(slug, "en");

  if (!doc) {
    notFound();
  }

  const { prev, next } = getAdjacentDocs(slug);

  return (
    <article>
      <DocsBreadcrumb />

      <div className="docs-prose">
        <MarkdownRenderer content={doc.content} />
      </div>

      {(prev || next) && (
        <div className="border-border/50 mt-16 flex items-stretch justify-between gap-4 border-t pt-8">
          {prev ? (
            <Link
              href={`/en/docs/${prev.slug}`}
              className="group text-muted-foreground hover:text-foreground flex items-center gap-3 text-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <div>
                <span className="block text-xs opacity-60">Previous</span>
                <span className="text-foreground/80 group-hover:text-foreground font-semibold transition-colors">
                  {prev.title}
                </span>
              </div>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/en/docs/${next.slug}`}
              className="group text-muted-foreground hover:text-foreground flex items-center gap-3 text-right text-sm transition-colors"
            >
              <div>
                <span className="block text-xs opacity-60">Next</span>
                <span className="text-foreground/80 group-hover:text-foreground font-semibold transition-colors">
                  {next.title}
                </span>
              </div>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}
    </article>
  );
}
