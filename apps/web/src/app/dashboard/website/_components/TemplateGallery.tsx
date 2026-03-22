"use client";

/**
 * TemplateGallery — grid of website template cards.
 * Reads template manifests synchronously from @smartout/website (no DB call).
 * Selected template is highlighted with a ring border.
 * Supports category filtering and a full-screen preview overlay.
 */

import { useState } from "react";
import { getAllTemplates } from "@smartout/website";
import type { WebsiteTemplate } from "@smartout/website";
import { Badge } from "@smartout/ui";
import { Globe, Eye } from "lucide-react";
import { cn } from "@smartout/ui";
import TemplatePreview from "./TemplatePreview";

const tierLabels: Record<WebsiteTemplate["tier"], string> = {
  basic: "Gratis",
  pro: "Pro",
  premium: "Premium",
};

const tierClasses: Record<WebsiteTemplate["tier"], string> = {
  basic: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  pro: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  premium: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

type Props = {
  selectedKey: string | null;
  onSelect: (templateKey: string) => void;
};

export default function TemplateGallery({ selectedKey, onSelect }: Props) {
  const allTemplates = getAllTemplates();
  const [activeCategory, setActiveCategory] = useState("Alle");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (allTemplates.length === 0) {
    return <p className="text-foreground/50 py-8 text-center text-sm">Ingen maler tilgjengelig</p>;
  }

  // Build unique category list from templates
  const categories = ["Alle", ...Array.from(new Set(allTemplates.map((t) => t.category)))];

  const filtered =
    activeCategory === "Alle"
      ? allTemplates
      : allTemplates.filter((t) => t.category === activeCategory);

  return (
    <>
      {/* Category filter bar */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-foreground/60 hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template, i) => {
          const isSelected = selectedKey === template.key;
          // Index in allTemplates for preview navigation
          const globalIndex = allTemplates.indexOf(template);

          return (
            <div key={template.key} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(template.key)}
                className={cn(
                  "hover:border-foreground/30 w-full rounded-xl border p-5 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-primary ring-2"
                    : "border-border bg-background",
                )}
              >
                {/* Icon placeholder */}
                <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
                  <Globe className="text-foreground/50 h-5 w-5" />
                </div>

                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-foreground text-sm font-semibold">{template.name}</span>
                  {template.industry && (
                    <Badge variant="secondary" className="text-xs">
                      {template.industry}
                    </Badge>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierClasses[template.tier]}`}
                  >
                    {tierLabels[template.tier]}
                  </span>
                </div>

                <p className="text-foreground/60 text-xs">{template.description}</p>

                {template.defaultPages.length > 0 && (
                  <p className="text-foreground/40 mt-2 text-xs">
                    {template.defaultPages.length} sider
                  </p>
                )}
              </button>

              {/* Preview button — visible on hover */}
              <button
                type="button"
                onClick={() => setPreviewIndex(globalIndex)}
                className="bg-background/90 absolute top-3 right-3 flex items-center gap-1 rounded-md border px-2 py-1 text-xs opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              >
                <Eye className="h-3 w-3" />
                Forhåndsvisning
              </button>
            </div>
          );
        })}
      </div>

      {/* Template preview overlay */}
      {previewIndex !== null && (
        <TemplatePreview
          templates={allTemplates}
          initialIndex={previewIndex}
          onSelect={(key) => {
            onSelect(key);
            setPreviewIndex(null);
          }}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  );
}
