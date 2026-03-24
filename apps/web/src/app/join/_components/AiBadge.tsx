"use client";

import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface AiBadgeProps {
  onClear?: () => void;
}

export function AiBadge({ onClear }: AiBadgeProps) {
  return (
    <span className="bg-warning/10 text-warning dark:bg-warning/10 dark:text-warning inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium">
      <Sparkles className="h-3 w-3" />
      Generert fra nettsiden din
      {onClear && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-warning hover:text-warning/80 dark:text-warning dark:hover:text-warning/80 ml-1 h-auto p-0 text-xs underline"
          onClick={onClear}
        >
          Skriv på nytt
        </Button>
      )}
    </span>
  );
}
