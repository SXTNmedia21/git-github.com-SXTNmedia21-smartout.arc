"use client";

/**
 * Read-only handbook chapter reader.
 * Renders Tiptap JSON content as static HTML using generateHTML().
 * Side navigation for 10 chapters.
 * Connected to: use-handbook-chapters.ts, chapters.ts (CHAPTERS definition)
 *
 * UI Events:
 * - nav: click chapter in sidebar to navigate
 * - color-regime: orange (active chapter), zinc (inactive)
 */

import { useContext, useMemo, useState } from "react";
import { Loader2, FileText } from "lucide-react";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import type { JSONContent } from "@tiptap/core";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { CHAPTERS, type ChapterKey } from "@/app/dashboard/_components/document-mode/chapters";
import { useHandbookChapters, type HandbookChapter } from "../_hooks/use-handbook-chapters";

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Highlight,
];

function renderContent(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  try {
    return generateHTML(content as JSONContent, extensions);
  } catch {
    return "<p>Kunne ikke vise innhold.</p>";
  }
}

export function ChapterReader() {
  const { isDark } = useContext(DashboardContext);
  const [activeChapterKey, setActiveChapterKey] = useState<ChapterKey>("identity-mission");
  const { data: chapters, isLoading } = useHandbookChapters();

  // Map chapter data by key
  const chapterMap = useMemo(() => {
    const map = new Map<string, HandbookChapter>();
    for (const ch of chapters ?? []) {
      map.set(ch.chapterKey, ch);
    }
    return map;
  }, [chapters]);

  const activeChapterDef = CHAPTERS.find((c) => c.key === activeChapterKey);
  const activeChapterData = chapterMap.get(activeChapterKey);
  const html = useMemo(
    () => (activeChapterData ? renderContent(activeChapterData.content) : ""),
    [activeChapterData],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className={`h-6 w-6 animate-spin ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
        <span className={`ml-3 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          Laster handbok...
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar navigation */}
      <nav className={`hidden w-64 shrink-0 space-y-1 md:block`}>
        {CHAPTERS.map((chapter) => {
          const isActive = activeChapterKey === chapter.key;
          const hasContent = chapterMap.has(chapter.key);

          return (
            <button
              key={chapter.key}
              onClick={() => setActiveChapterKey(chapter.key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                isActive
                  ? isDark
                    ? "bg-orange-500/10 text-orange-400"
                    : "bg-orange-50 text-orange-600"
                  : isDark
                    ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-black ${
                  isActive
                    ? isDark
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-orange-100 text-orange-600"
                    : isDark
                      ? "bg-zinc-800 text-zinc-500"
                      : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {chapter.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{chapter.title}</p>
              </div>
              {!hasContent && (
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-bold ${
                    isDark ? "bg-zinc-800 text-zinc-600" : "bg-zinc-100 text-zinc-400"
                  }`}
                >
                  Tom
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile chapter selector */}
      <div className="mb-4 md:hidden">
        <select
          value={activeChapterKey}
          onChange={(e) => setActiveChapterKey(e.target.value as ChapterKey)}
          className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold ${
            isDark
              ? "border-zinc-800 bg-zinc-900 text-zinc-200"
              : "border-zinc-200 bg-white text-zinc-800"
          }`}
        >
          {CHAPTERS.map((ch) => (
            <option key={ch.key} value={ch.key}>
              {ch.number}. {ch.title}
            </option>
          ))}
        </select>
      </div>

      {/* Content area */}
      <div className="min-w-0 flex-1">
        {activeChapterDef && (
          <div
            className={`rounded-xl border p-6 ${
              isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"
            }`}
          >
            {/* Chapter header */}
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-3">
                {activeChapterDef.icon && (
                  <div
                    className={`rounded-lg border p-2 ${
                      isDark
                        ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
                        : "border-orange-200 bg-orange-50 text-orange-600"
                    }`}
                  >
                    <activeChapterDef.icon className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <span
                    className={`text-xs font-bold tracking-widest uppercase ${
                      isDark ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    Kapittel {activeChapterDef.number}
                  </span>
                  <h2
                    className={`text-xl font-extrabold ${isDark ? "text-white" : "text-zinc-900"}`}
                  >
                    {activeChapterData?.title ?? activeChapterDef.title}
                  </h2>
                </div>
              </div>
              <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                {activeChapterDef.description}
              </p>
              {activeChapterData?.updatedAt && (
                <p
                  className={`mt-1 text-[10px] font-medium ${
                    isDark ? "text-zinc-600" : "text-zinc-400"
                  }`}
                >
                  Sist oppdatert:{" "}
                  {new Date(activeChapterData.updatedAt).toLocaleDateString("nb-NO")}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className={`mb-6 h-px w-full ${isDark ? "bg-zinc-800/50" : "bg-zinc-200"}`} />

            {/* Content */}
            {html ? (
              <div
                className={`prose max-w-none ${
                  isDark
                    ? "prose-invert prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-strong:text-zinc-200 prose-li:text-zinc-300"
                    : "prose-zinc"
                }`}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <div
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 ${
                  isDark ? "border-zinc-800" : "border-zinc-200"
                }`}
              >
                <FileText
                  className={`mb-3 h-8 w-8 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}
                />
                <p className={`text-sm font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                  Dette kapittelet har ikke blitt skrevet enna.
                </p>
                <p className={`mt-1 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                  Kontakt din leder for mer informasjon.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
