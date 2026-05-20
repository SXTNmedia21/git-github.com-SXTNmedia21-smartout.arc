"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { ChapterReader } from "./ChapterReader";
import { HandbookToolsBridge } from "../_tools/handbook-tools-bridge";
import { useHandbookChapters } from "../_hooks/use-handbook-chapters";
import type { ChapterKey } from "@/app/dashboard/_components/document-mode/chapters";

/**
 * HandbookPageClient — client surface for /dashboard/handbook.
 *
 * ChapterReader pulls hydrated handbook chapters from the TanStack cache
 * populated by `page.tsx` via HydrationBoundary, so the first paint shows
 * real chapter data with no spinner.
 *
 * Active chapter state is lifted here so HandbookToolsBridge can drive
 * navigation via Botsson ("åpne kapittelet om sikkerhet").
 */
export function HandbookPageClient() {
  const [activeChapterKey, setActiveChapterKey] = useState<ChapterKey>("identity-mission");
  const { data: chapters } = useHandbookChapters();

  return (
    <div className="space-y-6">
      <HandbookToolsBridge
        activeChapterKey={activeChapterKey}
        chapters={chapters}
        uiActions={{ setActiveChapterKey }}
      />

      <div>
        <div className="mb-1 flex items-center gap-3">
          <h1 className="text-foreground text-3xl font-extrabold tracking-tight">
            Personalhandbok
          </h1>
          <BookOpen className="text-brand-orange h-6 w-6" />
        </div>
        <p className="text-muted-foreground text-sm">
          Bedriftens retningslinjer, rutiner og kultur — samlet på ett sted.
        </p>
      </div>

      <ChapterReader activeChapterKey={activeChapterKey} onChapterChange={setActiveChapterKey} />
    </div>
  );
}
