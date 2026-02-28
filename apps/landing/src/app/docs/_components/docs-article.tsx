import Link from "next/link";
import { ArrowLeft, ArrowRight, type LucideIcon } from "lucide-react";
import { DocsBreadcrumb } from "./docs-breadcrumb";

type DocsArticleProps = {
  children: React.ReactNode;
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
};

export function DocsArticle({ children, prev, next }: DocsArticleProps) {
  return (
    <article className="docs-article">
      <DocsBreadcrumb />
      <div className="prose-docs">{children}</div>

      {(prev || next) && (
        <div className="mt-16 flex items-center justify-between gap-4 border-t border-white/5 pt-8">
          {prev ? (
            <Link
              href={prev.href}
              className="group flex items-center gap-3 text-sm text-zinc-500 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <div>
                <span className="block text-xs text-zinc-600">Forrige</span>
                <span className="font-semibold">{prev.title}</span>
              </div>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={next.href}
              className="group flex items-center gap-3 text-right text-sm text-zinc-500 transition-colors hover:text-white"
            >
              <div>
                <span className="block text-xs text-zinc-600">Neste</span>
                <span className="font-semibold">{next.title}</span>
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

export function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="group mt-14 mb-4 flex scroll-mt-24 items-center gap-3 text-2xl font-bold tracking-tight text-white"
    >
      <a
        href={`#${id}`}
        className="text-zinc-600 opacity-0 transition-all group-hover:opacity-100 hover:text-orange-400"
      >
        #
      </a>
      {children}
    </h2>
  );
}

export function SubHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="mt-8 mb-3 scroll-mt-24 text-lg font-bold tracking-tight text-zinc-200">
      {children}
    </h3>
  );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-relaxed text-zinc-400">{children}</p>;
}

export function StepList({ children }: { children: React.ReactNode }) {
  return <ol className="counter-reset-steps my-6 space-y-6">{children}</ol>;
}

export function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-500/20 bg-orange-500/10 text-sm font-bold text-orange-400">
        {number}
      </div>
      <div className="flex-1 pt-1">
        <h4 className="mb-1 text-sm font-bold text-white">{title}</h4>
        <div className="text-sm leading-relaxed text-zinc-400">{children}</div>
      </div>
    </li>
  );
}

export function InfoBox({
  type = "info",
  title,
  children,
}: {
  type?: "info" | "warning" | "tip";
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-blue-500/5 border-blue-500/20 text-blue-400",
    warning: "bg-amber-500/5 border-amber-500/20 text-amber-400",
    tip: "bg-emerald-500/5 border-emerald-500/20 text-emerald-400",
  };

  const labels = { info: "Info", warning: "Viktig", tip: "Tips" };

  return (
    <div className={`my-6 rounded-xl border p-5 ${styles[type]}`}>
      <p className="mb-2 text-xs font-bold tracking-wider uppercase">{title ?? labels[type]}</p>
      <div className="text-sm leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}

export function FeatureCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-2 rounded-xl border border-white/5 bg-white/[0.02] p-5">
      <div className="mb-2 flex items-center gap-3">
        <Icon className="h-4 w-4 text-orange-400" />
        <h4 className="text-sm font-bold text-white">{title}</h4>
      </div>
      <div className="text-sm leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}
