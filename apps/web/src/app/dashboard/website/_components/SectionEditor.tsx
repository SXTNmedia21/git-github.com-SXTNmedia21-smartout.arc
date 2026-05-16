"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ChevronRight, Eye, MousePointerClick } from "lucide-react";
import { useSections } from "../_hooks/use-sections";
import { usePages } from "../_hooks/use-pages";
import { useWebsite } from "../_hooks/use-website";
import type { SectionRow } from "../_actions/section-actions";
import SectionSidebar from "./SectionSidebar";
import SectionForm from "./SectionForm";
import SaveStatus from "./SaveStatus";
import type { SaveState } from "./SaveStatus";
import { getEditor } from "./editors/editor-registry";
import { WebsitePageEditorToolsBridge } from "../pages/[pageId]/_tools/website-page-editor-tools-bridge";

/**
 * Re-export SectionRow as WebsiteSection for use in sibling components.
 * SectionRow is the canonical type from section-actions; the alias avoids
 * propagating the actions import throughout the component tree.
 */
export type WebsiteSection = SectionRow;

type Props = {
  pageId: string;
  websiteId: string;
  pageTitle: string;
};

/**
 * Section editor layout.
 *
 * Desktop (lg+): SectionSidebar fixed 280px left, SectionForm flex-1 right.
 * Mobile (<lg): SectionSidebar renders as horizontal tab bar on top, form stacks below.
 *
 * The top bar shows a breadcrumb, current save state, and a preview link.
 */
export default function SectionEditor({ pageId, websiteId, pageTitle }: Props) {
  const { sections, isLoading } = useSections(websiteId, pageId);
  const { pages } = usePages(websiteId);
  const { website } = useWebsite();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const activeSection = sections.find((s) => s.website_section_id === activeSectionId) ?? null;
  const EditorComponent = useMemo(
    () => (activeSection ? getEditor(activeSection.section_type) : null),
    [activeSection?.section_type],
  );

  // Resolve page-level visibility from the pages list; defaults to true while the list is loading.
  const currentPage = pages.find((p) => p.website_page_id === pageId);
  // Resolve website live state from visibility enum; defaults to false while loading.
  const websiteIsLive = website?.visibility === "live";

  const sectionToolsInput = useMemo(
    () => ({
      pageId,
      pageTitle,
      isVisible: currentPage?.is_visible ?? true,
      sections: sections.map((s) => ({
        website_section_id: s.website_section_id,
        section_type: s.section_type,
        is_visible: s.is_visible,
        sort_order: s.sort_order,
      })),
      hasUnsavedChanges: saveState === "saving",
      websiteIsLive,
      lastSavedAt: saveState === "saved" ? new Date().toISOString() : null,
    }),
    [pageId, pageTitle, currentPage?.is_visible, sections, saveState, websiteIsLive],
  );

  return (
    <div className="flex h-full flex-col">
      <WebsitePageEditorToolsBridge {...sectionToolsInput} />
      {/* Top bar */}
      <div className="bg-background sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 lg:px-6">
        <nav className="text-muted-foreground flex items-center gap-1 text-sm">
          <Link href="/dashboard/website" className="hover:text-foreground">
            Nettside
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{pageTitle}</span>
        </nav>

        <div className="flex items-center gap-3">
          <SaveStatus state={saveState} />
          <a
            href={`/dashboard/website/preview?pageId=${pageId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-accent inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors"
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Forhåndsvisning</span>
          </a>
        </div>
      </div>

      {/* Page header description */}
      <div className="px-6 pt-2 pb-4">
        <p className="text-muted-foreground text-sm">
          Rediger sider — legg til seksjoner, tilpass innhold, og publiser endringer.
        </p>
      </div>

      {/* Body — SectionSidebar handles responsive layout internally */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {isLoading ? (
          <div className="text-muted-foreground flex w-full items-center justify-center text-sm">
            Laster seksjoner...
          </div>
        ) : (
          <>
            <SectionSidebar
              sections={sections}
              activeSectionId={activeSectionId}
              onSelect={setActiveSectionId}
              pageId={pageId}
              websiteId={websiteId}
            />

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {activeSection ? (
                <SectionForm
                  section={activeSection}
                  websiteId={websiteId}
                  onSaveStateChange={setSaveState}
                  EditorComponent={EditorComponent}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-20 text-center">
                  <MousePointerClick className="text-muted-foreground size-8" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Velg en seksjon</p>
                    <p className="text-muted-foreground text-xs">
                      Klikk på en seksjon i panelet eller legg til ny.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
