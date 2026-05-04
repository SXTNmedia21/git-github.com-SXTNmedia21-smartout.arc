"use client";

import { BookOpen } from "lucide-react";
import { ChapterReader } from "./ChapterReader";

/**
 * HandbookPageClient — client surface for /dashboard/handbook.
 *
 * ChapterReader pulls hydrated handbook chapters from the TanStack cache
 * populated by `page.tsx` via HydrationBoundary, so the first paint shows
 * real chapter data with no spinner.
 */
export function HandbookPageClient() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-3">
          <h1 className="text-foreground text-3xl font-extrabold tracking-tight">
            Personalhandbok
          </h1>
          <BookOpen className="h-6 w-6 text-orange-500" />
        </div>
        <p className="text-muted-foreground text-sm">
          Les gjennom bedriftens retningslinjer og rutiner.
        </p>
      </div>

      <ChapterReader />
    </div>
  );
}
