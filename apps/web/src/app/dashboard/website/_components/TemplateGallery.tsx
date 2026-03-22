"use client";

/**
 * TemplateGallery — grid of website template cards.
 * Reads template manifests synchronously from @smartout/website (no DB call).
 * Selected template is highlighted with a ring border.
 */

import { getAllTemplates } from "@smartout/website";
import { Badge } from "@smartout/ui";
import { Globe } from "lucide-react";
import { cn } from "@smartout/ui";

type Props = {
  selectedKey: string | null;
  onSelect: (templateKey: string) => void;
};

export default function TemplateGallery({ selectedKey, onSelect }: Props) {
  const templates = getAllTemplates();

  if (templates.length === 0) {
    return <p className="text-foreground/50 py-8 text-center text-sm">Ingen maler tilgjengelig</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => {
        const isSelected = selectedKey === template.key;
        return (
          <button
            key={template.key}
            type="button"
            onClick={() => onSelect(template.key)}
            className={cn(
              "hover:border-foreground/30 rounded-xl border p-5 text-left transition-all",
              isSelected
                ? "border-primary bg-primary/5 ring-primary ring-2"
                : "border-border bg-background",
            )}
          >
            {/* Icon placeholder */}
            <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
              <Globe className="text-foreground/50 h-5 w-5" />
            </div>

            <div className="mb-1 flex items-center gap-2">
              <span className="text-foreground text-sm font-semibold">{template.name}</span>
              {template.industry && (
                <Badge variant="secondary" className="text-xs">
                  {template.industry}
                </Badge>
              )}
            </div>

            <p className="text-foreground/60 text-xs">{template.description}</p>

            {/* Page count hint */}
            {template.defaultPages.length > 0 && (
              <p className="text-foreground/40 mt-2 text-xs">
                {template.defaultPages.length} sider
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
