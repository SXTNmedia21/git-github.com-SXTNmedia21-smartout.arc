// apps/journey-control/src/components/journey-list.tsx
"use client";

import { useEffect, useState } from "react";
import { JourneyCard } from "./journey-card";

type Compiled = { slug: string; title: string; filePath: string; module?: string };
type Draft = { slug: string; title: string; filePath: string };

type Props = {
  selectedSlug: string | null;
  onSelect: (slug: string, kind: "compiled" | "draft") => void;
};

export function JourneyList({ selectedSlug, onSelect }: Props) {
  const [compiled, setCompiled] = useState<Compiled[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/journeys")
      .then((r) => r.json())
      .then((d) => {
        setCompiled(d.compiled);
        setDrafts(d.drafts);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-muted-foreground p-4 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-muted-foreground mb-2 text-xs tracking-wider uppercase">
          Compiled ({compiled.length})
        </h2>
        <div className="space-y-2">
          {compiled.map((j) => (
            <JourneyCard
              key={j.slug}
              slug={j.slug}
              title={j.title}
              kind="compiled"
              module={j.module}
              selected={selectedSlug === j.slug}
              onSelect={() => onSelect(j.slug, "compiled")}
            />
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-muted-foreground mb-2 text-xs tracking-wider uppercase">
          Drafts ({drafts.length})
        </h2>
        <div className="space-y-2">
          {drafts.slice(0, 50).map((j) => (
            <JourneyCard
              key={j.slug}
              slug={j.slug}
              title={j.title}
              kind="draft"
              selected={selectedSlug === j.slug}
              onSelect={() => onSelect(j.slug, "draft")}
            />
          ))}
          {drafts.length > 50 && (
            <p className="text-muted-foreground text-xs">
              + {drafts.length - 50} more (search TBD)
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
