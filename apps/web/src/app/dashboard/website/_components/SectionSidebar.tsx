"use client";

import { useState } from "react";
import {
  Plus,
  Image,
  Type,
  Columns,
  Grid3x3,
  Images,
  Quote,
  MousePointerClick,
  HelpCircle,
  MapPin,
  PanelBottom,
  UtensilsCrossed,
  Clock,
  FileText,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SectionPicker from "./SectionPicker";
import type { SectionRow } from "../_actions/section-actions";

/** Maps each section_type to a representative lucide icon for the sidebar list. */
const sectionIconMap: Record<string, LucideIcon> = {
  hero: Image,
  rich_text: Type,
  text_image: Columns,
  feature_grid: Grid3x3,
  gallery: Images,
  testimonials: Quote,
  cta: MousePointerClick,
  faq: HelpCircle,
  map: MapPin,
  footer: PanelBottom,
  menu_full: UtensilsCrossed,
  menu_preview: UtensilsCrossed,
  hours: Clock,
  contact: FileText,
  booking_cta: ExternalLink,
  pdf_viewer: BookOpen,
};

/** Human-readable label for each section type shown in the sidebar. */
function sectionLabel(type: string): string {
  const labels: Record<string, string> = {
    hero: "Hero",
    rich_text: "Rik tekst",
    text_image: "Tekst & bilde",
    feature_grid: "Funksjonsrutenett",
    gallery: "Galleri",
    testimonials: "Anmeldelser",
    cta: "Oppfordring",
    faq: "FAQ",
    map: "Kart",
    footer: "Bunntekst",
    menu_full: "Full meny",
    menu_preview: "Menyforhåndsvisning",
    hours: "Åpningstider",
    contact: "Kontakt",
    booking_cta: "Bestillingsknapp",
    pdf_viewer: "PDF-visning",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

type Props = {
  sections: SectionRow[];
  activeSectionId: string | null;
  onSelect: (id: string) => void;
  pageId: string;
  websiteId: string;
};

/**
 * Left column of the section editor — fixed 280px wide.
 * Lists all sections on the page, highlights the active one,
 * and provides a "+" button to open the SectionPicker dialog.
 */
export default function SectionSidebar({
  sections,
  activeSectionId,
  onSelect,
  pageId,
  websiteId,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="bg-background flex h-full w-[280px] shrink-0 flex-col border-r">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Seksjoner</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sections.length === 0 && (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm">
            Ingen seksjoner ennå
          </p>
        )}
        {sections.map((section) => {
          const Icon = sectionIconMap[section.section_type] ?? FileText;
          const isActive = section.website_section_id === activeSectionId;

          return (
            <button
              key={section.website_section_id}
              type="button"
              onClick={() => onSelect(section.website_section_id)}
              className={`hover:bg-accent flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                isActive ? "bg-accent font-medium" : ""
              }`}
            >
              <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate">{sectionLabel(section.section_type)}</p>
                <p className="text-muted-foreground text-xs">#{section.sort_order + 1}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t p-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Legg til seksjon
        </button>
      </div>

      <SectionPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        pageId={pageId}
        websiteId={websiteId}
      />
    </div>
  );
}
