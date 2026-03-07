"use client";

import { useContext } from "react";
import { BookOpen } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ChapterReader } from "./_components/ChapterReader";

// UI Events:
// - nav: /dashboard/handbook (sidebar link)
// - nav: chapter selection in sidebar

export default function HandbookPage() {
  const { isDark } = useContext(DashboardContext);

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Chapter reader */}
      <ChapterReader />
    </div>
  );
}
