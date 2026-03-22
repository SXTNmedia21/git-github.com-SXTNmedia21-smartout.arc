"use client";

import { Suspense, useCallback, useEffect, useMemo } from "react";
import { getEditor } from "./editors/editor-registry";
import { updateSectionContent } from "../_actions/section-actions";
import { useAutosave } from "../_hooks/use-autosave";
import { toast } from "sonner";
import type { SaveState } from "./SaveStatus";
import type { WebsiteSection } from "./SectionEditor";

type Props = {
  section: WebsiteSection;
  websiteId: string;
  onSaveStateChange: (state: SaveState) => void;
};

/**
 * Right column of the section editor — renders the appropriate form for the active section type.
 * Wires react-hook-form content changes to the autosave hook and explicit Cmd+S keyboard shortcut.
 *
 * Editor components are lazy-loaded from the editor registry to keep the initial bundle small.
 */
export default function SectionForm({ section, websiteId, onSaveStateChange }: Props) {
  // Memoize so the lazy component identity stays stable across renders.
  // getEditor() calls React.lazy() each time, so we must only call it once per section type.
  const EditorComponent = useMemo(() => getEditor(section.section_type), [section.section_type]);

  const handleSave = useCallback(
    async (content: Record<string, unknown>) => {
      onSaveStateChange("saving");
      const result = await updateSectionContent(
        websiteId,
        section.website_section_id,
        content,
        "autosave",
      );
      if (result.success) {
        onSaveStateChange("saved");
      } else {
        toast.error(result.error);
        onSaveStateChange("dirty");
      }
    },
    [websiteId, section.website_section_id, onSaveStateChange],
  );

  const { markDirty, markClean } = useAutosave({ onSave: handleSave });

  const handleManualSave = useCallback(async () => {
    const content = section.content;
    onSaveStateChange("saving");
    const result = await updateSectionContent(
      websiteId,
      section.website_section_id,
      content,
      "manual",
    );
    if (result.success) {
      markClean();
      onSaveStateChange("saved");
      toast.success("Lagret");
    } else {
      toast.error(result.error);
      onSaveStateChange("dirty");
    }
  }, [websiteId, section.website_section_id, section.content, onSaveStateChange, markClean]);

  // Cmd/Ctrl+S triggers an immediate manual save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleManualSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleManualSave]);

  const handleContentChange = useCallback(
    (newContent: Record<string, unknown>) => {
      markDirty(newContent);
      onSaveStateChange("dirty");
    },
    [markDirty, onSaveStateChange],
  );

  if (!EditorComponent) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">
          Ingen editor tilgjengelig for seksjonstype:{" "}
          <code className="bg-muted rounded px-1 py-0.5">{section.section_type}</code>
        </p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center p-8">
          <p className="text-muted-foreground text-sm">Laster editor...</p>
        </div>
      }
    >
      <EditorComponent
        content={section.content}
        onChange={handleContentChange}
        websiteId={websiteId}
        sectionId={section.website_section_id}
      />
    </Suspense>
  );
}
