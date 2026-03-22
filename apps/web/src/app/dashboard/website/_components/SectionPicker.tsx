"use client";

import { useState, useMemo } from "react";
import { getAllSectionDefs } from "@smartout/website";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
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
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createSection } from "../_actions/section-actions";
import { toast } from "sonner";

/** Lucide icon for each section type shown in the picker grid. */
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

/**
 * System sections are auto-populated from live Smartout data (hours, menus).
 * They are marked with a blue "System" badge in the picker.
 */
const SYSTEM_SECTION_TYPES = new Set(["hours", "menu_full", "menu_preview"]);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  websiteId: string;
};

/**
 * Modal dialog for adding a new section to the current page.
 * Shows all registered section types in a 3-column card grid with search filtering.
 * Clicking a card calls the createSection server action and closes the dialog.
 */
export default function SectionPicker({ open, onOpenChange, pageId, websiteId }: Props) {
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const allDefs = useMemo(() => getAllSectionDefs(), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allDefs;
    return allDefs.filter(
      (def) => def.name.toLowerCase().includes(q) || def.description.toLowerCase().includes(q),
    );
  }, [allDefs, search]);

  const handleAdd = async (sectionType: string) => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      await createSection(websiteId, pageId, sectionType);
      toast.success("Seksjon lagt til");
      onOpenChange(false);
      setSearch("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke legge til seksjon");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Velg seksjonstype</DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Søk i seksjoner..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid max-h-[400px] grid-cols-3 gap-3 overflow-y-auto pr-1 pb-1">
          {filtered.map((def) => {
            const Icon = sectionIconMap[def.type] ?? FileText;
            const isSystem = SYSTEM_SECTION_TYPES.has(def.type);

            return (
              <button
                key={def.type}
                type="button"
                disabled={isAdding}
                onClick={() => handleAdd(def.type)}
                className="group hover:bg-accent relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors disabled:opacity-50"
              >
                {isSystem && (
                  <Badge className="absolute top-2 right-2 bg-blue-500 text-xs text-white hover:bg-blue-500">
                    System
                  </Badge>
                )}
                <Icon className="text-muted-foreground group-hover:text-foreground h-6 w-6" />
                <div>
                  <p className="text-sm font-medium">{def.name}</p>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{def.description}</p>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-muted-foreground col-span-3 py-8 text-center text-sm">
              Ingen seksjoner funnet
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
