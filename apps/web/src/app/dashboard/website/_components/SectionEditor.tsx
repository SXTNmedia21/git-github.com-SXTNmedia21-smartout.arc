"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye } from "lucide-react";
import { useSections } from "../_hooks/use-sections";
import type { SectionRow } from "../_actions/section-actions";
import SectionSidebar from "./SectionSidebar";
import SectionForm from "./SectionForm";
import SaveStatus from "./SaveStatus";
import type { SaveState } from "./SaveStatus";

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
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");

  const activeSection = sections.find((s) => s.website_section_id === activeSectionId) ?? null;

  return (
    <div className="flex h-full flex-col">
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
                />
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-center text-sm">
                  Velg en seksjon <span className="lg:hidden">&nbsp;fra fanene ovenfor</span>
                  <span className="hidden lg:inline">&nbsp;fra sidepanelet</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
