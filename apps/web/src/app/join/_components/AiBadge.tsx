"use client";

import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface AiBadgeProps {
  onClear?: () => void;
}

export function AiBadge({ onClear }: AiBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
      <Sparkles className="h-3 w-3" />
      Generert fra nettsiden din
      {onClear && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-1 h-auto p-0 text-xs text-amber-600 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
          onClick={onClear}
        >
          Skriv på nytt
        </Button>
      )}
    </span>
  );
}
