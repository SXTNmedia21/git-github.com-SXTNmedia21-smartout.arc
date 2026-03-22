"use client";

import { useState, useEffect, useCallback } from "react";
import type { WebsiteTemplate } from "@smartout/website";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Monitor, Tablet, Smartphone } from "lucide-react";

type DeviceMode = "desktop" | "tablet" | "mobile";

const deviceWidths: Record<DeviceMode, string> = {
  desktop: "w-full",
  tablet: "w-[768px]",
  mobile: "w-[375px]",
};

const tierLabels: Record<WebsiteTemplate["tier"], string> = {
  basic: "Gratis",
  pro: "Pro",
  premium: "Premium",
};

const tierVariants: Record<WebsiteTemplate["tier"], string> = {
  basic: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  pro: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  premium: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

type Props = {
  templates: WebsiteTemplate[];
  initialIndex: number;
  onSelect: (key: string) => void;
  onClose: () => void;
};

export default function TemplatePreview({ templates, initialIndex, onSelect, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [device, setDevice] = useState<DeviceMode>("desktop");

  const template = templates[index];
  if (!template) return null;

  const hasPrev = index > 0;
  const hasNext = index < templates.length - 1;

  const goNext = useCallback(() => {
    if (hasNext) setIndex((i) => i + 1);
  }, [hasNext]);

  const goPrev = useCallback(() => {
    if (hasPrev) setIndex((i) => i - 1);
  }, [hasPrev]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  return (
    <div className="bg-background/95 fixed inset-0 z-50 flex flex-col backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Tilbake til maler
          </Button>
          <span className="text-foreground font-medium">{template.name}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierVariants[template.tier]}`}
          >
            {tierLabels[template.tier]}
          </span>
          <Badge variant="outline" className="text-xs">
            {index + 1} / {templates.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            {(
              [
                ["desktop", Monitor],
                ["tablet", Tablet],
                ["mobile", Smartphone],
              ] as const
            ).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setDevice(mode)}
                className={`rounded-md p-1.5 transition-colors ${device === mode ? "bg-accent" : "hover:bg-accent/50"}`}
                aria-label={mode}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <Button onClick={() => onSelect(template.key)}>Velg denne malen</Button>
        </div>
      </div>

      {/* Preview area */}
      <div className="relative flex-1 overflow-y-auto">
        {hasPrev && (
          <button
            onClick={goPrev}
            className="bg-background/80 hover:bg-accent absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-full border p-2 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={goNext}
            className="bg-background/80 hover:bg-accent absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full border p-2 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div className={`mx-auto ${deviceWidths[device]} border-x transition-all`}>
          {/* Placeholder preview — renders section types as colored blocks */}
          <div className="space-y-0">
            {template.defaultPages[0]?.sections.map((sectionType, i) => (
              <div
                key={i}
                className="bg-muted/50 text-muted-foreground flex items-center justify-center border-b py-16 text-sm"
              >
                {sectionType}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
