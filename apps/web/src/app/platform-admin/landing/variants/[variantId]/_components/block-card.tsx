// ============================================
// block-card.tsx — Sortable Block Card
// Renders a single block in the block editor list with drag handle,
// type icon, visibility toggle, delete button, and expandable area.
//
// Uses @dnd-kit/sortable for drag-and-drop reordering.
//
// Connected to: block-editor-client.tsx (parent state management)
//               Task 19 will add block-specific edit forms inside the expanded area
// ============================================

"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronRight,
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

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { BlockData } from "../page";

// ── Block type metadata ───────────────────────────────────────────

const BLOCK_TYPE_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  hero: { label: "Hero", icon: Layout },
  features_grid: { label: "Features (rutnett)", icon: Grid3X3 },
  features_list: { label: "Features (liste)", icon: List },
  features_icons: { label: "Ikoner", icon: Shapes },
  cta_section: { label: "CTA", icon: MousePointerClick },
  stats: { label: "Statistikk", icon: BarChart3 },
  testimonial: { label: "Anbefaling", icon: Quote },
  case_study: { label: "Kundecase", icon: FileText },
  voice_widget: { label: "Stemmeassistent", icon: Mic },
  workspace_analyzer: { label: "Analyse-verktoey", icon: Search },
  text_section: { label: "Tekstseksjon", icon: Type },
  image_section: { label: "Bilde", icon: Image },
  pricing_preview: { label: "Prisforhaandsvisning", icon: CreditCard },
  faq: { label: "FAQ", icon: HelpCircle },
  logo_strip: { label: "Logoer", icon: Building },
};

function getBlockMeta(blockType: string) {
  return (
    BLOCK_TYPE_META[blockType] ?? {
      label: blockType.replace(/_/g, " "),
      icon: Layout,
    }
  );
}

/** Extract a short preview string from block content. */
function getContentPreview(content: Record<string, unknown>): string {
  const heading =
    (content.heading as string) ?? (content.title as string) ?? (content.text as string) ?? "";
  if (!heading) return "No content yet";
  return heading.length > 50 ? `${heading.slice(0, 50)}...` : heading;
}

// ── Component ─────────────────────────────────────────────────────

type BlockCardProps = {
  block: BlockData;
  isExpanded: boolean;
  onToggleExpand: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  onToggleVisibility: (blockId: string, isVisible: boolean) => void;
};

export function BlockCard({
  block,
  isExpanded,
  onToggleExpand,
  onDelete,
  onToggleVisibility,
}: BlockCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = getBlockMeta(block.block_type);
  const Icon = meta.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border ${
        isDragging ? "border-primary/50 bg-muted/80 z-50 shadow-lg" : "bg-card"
      } ${!block.is_visible ? "opacity-50" : ""}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle */}
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Block type icon + label */}
        <div
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
          onClick={() => onToggleExpand(block.id)}
        >
          <Badge variant="outline" className="shrink-0 gap-1 text-xs">
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
          <span className="text-muted-foreground truncate text-xs">
            {getContentPreview(block.content)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Visibility toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onToggleVisibility(block.id, !block.is_visible)}
            title={block.is_visible ? "Skjul blokk" : "Vis blokk"}
          >
            {block.is_visible ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </Button>

          {/* Delete button */}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-7 w-7 p-0"
            onClick={() => onDelete(block.id)}
            title="Slett blokk"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          {/* Expand/collapse */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onToggleExpand(block.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded area — placeholder for block-specific forms (Task 19) */}
      {isExpanded && (
        <div className="border-t px-4 py-4">
          <p className="text-muted-foreground text-xs">
            {/* TODO: Task 19 — Add block-specific edit forms here */}
            Redigering av innhold for {meta.label}-blokker kommer i neste oppgave.
          </p>
          <pre className="bg-muted mt-2 max-h-40 overflow-auto rounded p-2 text-xs">
            {JSON.stringify(block.content, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
