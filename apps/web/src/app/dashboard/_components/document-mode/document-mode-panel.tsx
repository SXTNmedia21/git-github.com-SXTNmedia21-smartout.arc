"use client";

import { useState, useCallback, useEffect } from "react";
import { Save, Loader2, Type } from "lucide-react";
import { useDocumentMode } from "./document-mode-context";
import { useHandbookContent, useHandbookSave } from "./use-handbook-content";
import { TemplatePicker } from "./template-picker";
import type { JSONContent } from "@tiptap/core";

// UI Events:
// - action: handleSave() (saves chapter content to handbook_chapter)
// - action: handleApplyTemplate() (applies template content to editor)
// - action: setPanelTab() (switches between tools/actions/settings tabs)
// - action: setFontSize() (changes editor font size via CSS variable)

const TAB_LABELS = { tools: "Verktoy", actions: "Handling", settings: "Innst." } as const;

export function DocumentModePanel({ isDark }: { isDark: boolean }) {
  const { activeChapterKey, panelTab, setPanelTab, isDirty, setIsDirty, editorRef } =
    useDocumentMode();
  const { data } = useHandbookContent(activeChapterKey);
  const saveMutation = useHandbookSave();
  const [fontSize, setFontSize] = useState(16);

  const handleSave = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const content = editor.getJSON();
    await saveMutation.mutateAsync({
      chapterKey: activeChapterKey,
      content,
      title: data?.title ?? activeChapterKey,
    });
    setIsDirty(false);
  }, [activeChapterKey, data?.title, saveMutation, setIsDirty, editorRef]);

  const handleApplyTemplate = useCallback(
    (content: JSONContent) => {
      const editor = editorRef.current;
      if (!editor) return;
      const hasContent = editor.getText().trim().length > 0;
      if (hasContent) {
        const ok = window.confirm("Dette vil erstatte eksisterende innhold. Fortsett?");
        if (!ok) return;
      }
      editor.commands.setContent(content);
      setIsDirty(true);
    },
    [setIsDirty, editorRef],
  );

  return (
    <div
      className={`flex w-80 flex-shrink-0 flex-col border-l ${
        isDark
          ? "border-zinc-800 bg-[#0c0c0e]"
          : "border-[oklch(0.90_0.006_55)] bg-[oklch(0.97_0.003_55)]"
      }`}
    >
      {/* Tab bar */}
      <div
        className={`flex border-b ${isDark ? "border-zinc-800" : "border-[oklch(0.90_0.006_55)]"}`}
      >
        {(Object.keys(TAB_LABELS) as Array<keyof typeof TAB_LABELS>).map((tab) => (
          <button
            key={tab}
            onClick={() => setPanelTab(tab)}
            className={`flex-1 px-3 py-2.5 text-xs font-bold transition-colors ${
              panelTab === tab
                ? isDark
                  ? "border-b-2 border-orange-500 text-orange-400"
                  : "border-b-2 border-orange-500 text-orange-600"
                : isDark
                  ? "text-zinc-500 hover:text-zinc-300"
                  : "text-[oklch(0.55_0.015_50)] hover:text-[oklch(0.30_0.02_50)]"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="scroll-overlay flex-1 p-4">
        {panelTab === "tools" && (
          <div className="space-y-6">
            <div>
              <h3
                className={`mb-3 text-xs font-bold tracking-wider uppercase ${
                  isDark ? "text-zinc-400" : "text-[oklch(0.50_0.015_50)]"
                }`}
              >
                Fyll fra template
              </h3>
              <TemplatePicker
                chapterKey={activeChapterKey}
                isDark={isDark}
                onApply={handleApplyTemplate}
              />
            </div>

            <div>
              <h3
                className={`mb-2 text-xs font-bold tracking-wider uppercase ${
                  isDark ? "text-zinc-400" : "text-[oklch(0.50_0.015_50)]"
                }`}
              >
                Statistikk
              </h3>
              <WordCountDisplay isDark={isDark} />
            </div>
          </div>
        )}

        {panelTab === "actions" && (
          <div className="space-y-4">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending || !isDirty}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                isDirty
                  ? isDark
                    ? "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
                    : "bg-orange-500 text-white hover:bg-orange-600"
                  : isDark
                    ? "bg-zinc-800 text-zinc-500"
                    : "bg-zinc-100 text-zinc-400"
              }`}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveMutation.isPending
                ? "Lagrer..."
                : isDirty
                  ? "Lagre endringer"
                  : "Ingen endringer"}
            </button>

            {saveMutation.isSuccess && (
              <p
                className={`text-center text-xs ${
                  isDark ? "text-emerald-400" : "text-emerald-600"
                }`}
              >
                Lagret!
              </p>
            )}
          </div>
        )}

        {panelTab === "settings" && (
          <div className="space-y-4">
            <div>
              <h3
                className={`mb-2 text-xs font-bold tracking-wider uppercase ${
                  isDark ? "text-zinc-400" : "text-[oklch(0.50_0.015_50)]"
                }`}
              >
                Skriftstorrelse
              </h3>
              <div className="flex items-center gap-3">
                <Type
                  className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-[oklch(0.55_0.015_50)]"}`}
                />
                <input
                  type="range"
                  min={14}
                  max={20}
                  value={fontSize}
                  onChange={(e) => {
                    const size = Number(e.target.value);
                    setFontSize(size);
                    document.documentElement.style.setProperty("--doc-font-size", `${size}px`);
                  }}
                  className="flex-1"
                />
                <span
                  className={`w-8 text-right font-mono text-xs ${
                    isDark ? "text-zinc-400" : "text-[oklch(0.50_0.015_50)]"
                  }`}
                >
                  {fontSize}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WordCountDisplay({ isDark }: { isDark: boolean }) {
  const { editorRef } = useDocumentMode();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const text = editor.getText();
      setCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [editorRef]);

  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        isDark ? "border-zinc-800 bg-zinc-900" : "border-[oklch(0.90_0.006_55)] bg-white"
      }`}
    >
      <span
        className={`text-2xl font-bold tabular-nums ${
          isDark ? "text-zinc-200" : "text-[oklch(0.25_0.015_45)]"
        }`}
      >
        {count}
      </span>
      <span className={`ml-2 text-xs ${isDark ? "text-zinc-500" : "text-[oklch(0.55_0.015_50)]"}`}>
        ord
      </span>
    </div>
  );
}
