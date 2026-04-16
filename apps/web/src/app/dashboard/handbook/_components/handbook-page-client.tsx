"use client";

import { useContext } from "react";
import { BookOpen } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ChapterReader } from "./ChapterReader";

/**
 * HandbookPageClient — client surface for /dashboard/handbook.
 *
 * Header reads `isDark` from DashboardContext (client-only). ChapterReader
 * pulls hydrated handbook chapters from the TanStack cache populated by
 * `page.tsx` via HydrationBoundary, so the first paint shows real chapter
 * data with no spinner.
 */
export function HandbookPageClient() {
  const { isDark } = useContext(DashboardContext);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-3">
          <h1
            className={`text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
          >
            Personalhandbok
          </h1>
          <BookOpen className={`h-6 w-6 ${isDark ? "text-orange-500" : "text-orange-500"}`} />
        </div>
        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          Les gjennom bedriftens retningslinjer og rutiner.
        </p>
      </div>

      <ChapterReader />
    </div>
  );
}
