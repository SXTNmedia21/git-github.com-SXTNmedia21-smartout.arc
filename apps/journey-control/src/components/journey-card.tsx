// apps/journey-control/src/components/journey-card.tsx
"use client";

import { FileCode, FileText } from "lucide-react";
import type { SpeedProfile } from "@smartout/journey-ir";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  title: string;
  kind: "compiled" | "draft";
  module?: string;
  selected: boolean;
  onSelect: () => void;
  onRun?: (speed: SpeedProfile) => void;
  onCompile?: () => void;
};

export function JourneyCard({
  slug,
  title,
  kind,
  module,
  selected,
  onSelect,
  onRun,
  onCompile,
}: Props) {
  const Icon = kind === "compiled" ? FileCode : FileText;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "border-border bg-card text-card-foreground hover:bg-muted/50 flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        selected && "ring-foreground/20 ring-2",
      )}
    >
      <Icon className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs">{slug}</span>
          {module && <span className="text-muted-foreground text-xs">{module}</span>}
        </div>
        <div className="mt-1 truncate text-sm">{title}</div>
        <div className="text-muted-foreground mt-1 text-xs tracking-wide uppercase">{kind}</div>
      </div>
    </button>
  );
}
