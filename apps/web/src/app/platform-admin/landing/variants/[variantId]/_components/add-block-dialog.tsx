// ============================================
// add-block-dialog.tsx — Add Block Type Picker Dialog
// Shows all 15 block types as clickable cards in a dialog.
// Each card shows an icon, name, and short description.
// Clicking a card calls the parent's onAddBlock callback.
//
// Connected to: block-editor-client.tsx (parent state management)
// ============================================

"use client";

import {
  Layout,
  Grid3X3,
  List,
  Shapes,
  MousePointerClick,
  BarChart3,
  Quote,
  FileText,
  Mic,
  Search,
  Type,
  Image,
  CreditCard,
  HelpCircle,
  Building,
} from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Block type metadata ───────────────────────────────────────────

const BLOCK_TYPE_META = [
  {
    type: "hero",
    label: "Hero",
    description: "Hovedoverskrift med CTA-knapper",
    icon: Layout,
  },
  {
    type: "features_grid",
    label: "Features (rutnett)",
    description: "Ikoner med tittel og beskrivelse",
    icon: Grid3X3,
  },
  {
    type: "features_list",
    label: "Features (liste)",
    description: "Vertikal liste med ikoner",
    icon: List,
  },
  {
    type: "features_icons",
    label: "Ikoner",
    description: "Store ikoner med korte etiketter",
    icon: Shapes,
  },
  {
    type: "cta_section",
    label: "CTA",
    description: "Call-to-action med knapper",
    icon: MousePointerClick,
  },
  {
    type: "stats",
    label: "Statistikk",
    description: "Tall og metrikker paa rad",
    icon: BarChart3,
  },
  {
    type: "testimonial",
    label: "Anbefaling",
    description: "Sitat med navn og rolle",
    icon: Quote,
  },
  {
    type: "case_study",
    label: "Kundecase",
    description: "Utvidet anbefaling med resultater",
    icon: FileText,
  },
  {
    type: "voice_widget",
    label: "Stemmeassistent",
    description: "Interaktiv stemmedemo",
    icon: Mic,
  },
  {
    type: "workspace_analyzer",
    label: "Analyse-verktoey",
    description: "URL-analyseverktoy",
    icon: Search,
  },
  {
    type: "text_section",
    label: "Tekstseksjon",
    description: "Overskrift og broedtekst",
    icon: Type,
  },
  {
    type: "image_section",
    label: "Bilde",
    description: "Bilde med bildetekst",
    icon: Image,
  },
  {
    type: "pricing_preview",
    label: "Prisforhaandsvisning",
    description: "Prisinfo med CTA til /pricing",
    icon: CreditCard,
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Ofte stilte spoersmaal",
    icon: HelpCircle,
  },
  {
    type: "logo_strip",
    label: "Logoer",
    description: "Rad med kundelogoer",
    icon: Building,
  },
] as const;

// ── Component ─────────────────────────────────────────────────────

type AddBlockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddBlock: (blockType: string) => void;
};

export function AddBlockDialog({ open, onOpenChange, onAddBlock }: AddBlockDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Legg til blokk</DialogTitle>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BLOCK_TYPE_META.map((meta) => {
            const Icon = meta.icon;
            return (
              <button
                key={meta.type}
                type="button"
                className="hover:bg-muted/50 hover:border-primary/30 flex items-start gap-3 rounded-lg border p-3 text-left transition-colors"
                onClick={() => onAddBlock(meta.type)}
              >
                <div className="bg-muted mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{meta.label}</p>
                  <p className="text-muted-foreground text-xs">{meta.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
