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
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import SectionPicker from "./SectionPicker";
import SortableSectionItem from "./SortableSectionItem";
import SectionSettingsPanel from "./SectionSettingsPanel";
import type { SectionRow } from "../_actions/section-actions";
import { useSections } from "../_hooks/use-sections";
import type { SectionSettingsFromSchema } from "@smartout/website";
import { defaultSectionSettings } from "@smartout/website";

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

/** Short label shown in mobile tab (truncated to fit). */
function shortSectionLabel(type: string): string {
  const short: Record<string, string> = {
    hero: "Hero",
    rich_text: "Tekst",
    text_image: "Tekst+bilde",
    feature_grid: "Funksjoner",
    gallery: "Galleri",
    testimonials: "Anmeld.",
    cta: "CTA",
    faq: "FAQ",
    map: "Kart",
    footer: "Bunn",
    menu_full: "Meny",
    menu_preview: "Menyvisning",
    hours: "Timer",
    contact: "Kontakt",
    booking_cta: "Bestill",
    pdf_viewer: "PDF",
  };
  return short[type] ?? type.replace(/_/g, " ");
}

type Props = {
  sections: SectionRow[];
  activeSectionId: string | null;
  onSelect: (id: string) => void;
  pageId: string;
  websiteId: string;
};

/**
 * Section list for the editor.
 *
 * Desktop (lg+): Fixed 280px vertical sidebar with drag-to-reorder and settings panel.
 * Mobile (<lg): Horizontal scrollable tab bar at top of editor area.
 */
export default function SectionSidebar({
  sections,
  activeSectionId,
  onSelect,
  pageId,
  websiteId,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { reorder, updateSettings } = useSections(websiteId, pageId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.website_section_id === active.id);
    const newIndex = sections.findIndex((s) => s.website_section_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sections, oldIndex, newIndex);
    reorder.mutate(reordered.map((s) => s.website_section_id));
  }

  const activeSection = activeSectionId
    ? sections.find((s) => s.website_section_id === activeSectionId)
    : null;

  // ── Mobile: horizontal scrollable tab bar ────────────────────────────────

  const mobileTabs = (
    <div className="lg:hidden">
      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {sections.map((section) => {
            const Icon = sectionIconMap[section.section_type] ?? FileText;
            const isActive = section.website_section_id === activeSectionId;
            return (
              <button
                key={section.website_section_id}
                type="button"
                onClick={() => onSelect(section.website_section_id)}
                className={`flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {shortSectionLabel(section.section_type)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 rounded-md border border-dashed px-2.5 py-1.5 text-xs whitespace-nowrap"
          >
            <Plus className="h-3 w-3" />
            Legg til
          </button>
        </div>
      </div>
    </div>
  );

  // ── Desktop: vertical sidebar ─────────────────────────────────────────────

  const desktopSidebar = (
    <div className="bg-background hidden h-full w-[280px] shrink-0 flex-col border-r lg:flex">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Seksjoner</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sections.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Layers className="text-muted-foreground size-8" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Siden er tom</p>
              <p className="text-muted-foreground max-w-[200px] text-xs">
                Start med en hero, tekst, eller annet innhold fra panelet til venstre.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              + Legg til seksjon
            </Button>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sections.map((s) => s.website_section_id)}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => {
              const Icon = sectionIconMap[section.section_type] ?? FileText;
              const isActive = section.website_section_id === activeSectionId;

              return (
                <SortableSectionItem
                  key={section.website_section_id}
                  id={section.website_section_id}
                >
                  <button
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
                </SortableSectionItem>
              );
            })}
          </SortableContext>
        </DndContext>
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

      {/* Section settings panel — shown when a section is active */}
      {activeSection && (
        <SectionSettingsPanel
          settings={
            (activeSection.settings as SectionSettingsFromSchema | null) ?? defaultSectionSettings
          }
          onChange={(settings) =>
            updateSettings.mutate({ sectionId: activeSection.website_section_id, settings })
          }
        />
      )}
    </div>
  );

  return (
    <>
      {mobileTabs}
      {desktopSidebar}
      <SectionPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        pageId={pageId}
        websiteId={websiteId}
      />
    </>
  );
}
