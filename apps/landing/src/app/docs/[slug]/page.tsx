import { notFound } from "next/navigation";
import Link from "next/link";
import { getUserManualDocBySlug, getUserManualDocs } from "@/lib/user-manual";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DocsBreadcrumb } from "../_components/docs-breadcrumb";
import { MarkdownRenderer } from "../_components/markdown-renderer";

type DocsManualPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getUserManualDocs().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: DocsManualPageProps) {
  const { slug } = await params;
  const doc = getUserManualDocBySlug(slug);
  if (!doc) {
    return { title: "Dokumentasjon" };
  }
  return {
    title: `${doc.title} – SmartOut Docs`,
    description: doc.excerpt,
  };
}

function getAdjacentDocs(slug: string) {
  const docs = getUserManualDocs();
  const idx = docs.findIndex((d) => d.slug === slug);
  return {
    prev: idx > 0 ? docs[idx - 1] : null,
    next: idx < docs.length - 1 ? docs[idx + 1] : null,
  };
}

export default async function DocsManualPage({ params }: DocsManualPageProps) {
  const { slug } = await params;
  const doc = getUserManualDocBySlug(slug);

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
        <div className="mt-16 flex items-stretch justify-between gap-4 border-t border-white/5 pt-8">
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="group flex items-center gap-3 text-sm text-zinc-500 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <div>
                <span className="block text-xs text-zinc-600">Forrige</span>
                <span className="font-semibold text-zinc-300 transition-colors group-hover:text-white">
                  {prev.title}
                </span>
              </div>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/docs/${next.slug}`}
              className="group flex items-center gap-3 text-right text-sm text-zinc-500 transition-colors hover:text-white"
            >
              <div>
                <span className="block text-xs text-zinc-600">Neste</span>
                <span className="font-semibold text-zinc-300 transition-colors group-hover:text-white">
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
