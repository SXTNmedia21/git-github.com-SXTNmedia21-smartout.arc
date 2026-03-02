"use client";

import {
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  Type,
  AlignLeft,
  ImageIcon,
  List,
  Code,
  Minus,
  MousePointerClick,
  PanelBottom,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { EmailTemplateSection } from "../[id]/edit/save-action";

type SectionBlockProps = {
  section: EmailTemplateSection;
  index: number;
  total: number;
  onUpdate: (updates: Partial<EmailTemplateSection>) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
};

const DEFAULT_META = { label: "Section", icon: Code, color: "bg-muted text-muted-foreground" };

const SECTION_META: Record<string, { label: string; icon: typeof Type; color: string }> = {
  title: { label: "Title", icon: Type, color: "bg-blue-500/10 text-blue-500" },
  message: { label: "Message", icon: AlignLeft, color: "bg-green-500/10 text-green-500" },
  image: { label: "Image", icon: ImageIcon, color: "bg-purple-500/10 text-purple-500" },
  list: { label: "List", icon: List, color: "bg-orange-500/10 text-orange-500" },
  html: { label: "HTML", icon: Code, color: "bg-red-500/10 text-red-500" },
  button: { label: "Button", icon: MousePointerClick, color: "bg-cyan-500/10 text-cyan-500" },
  divider: { label: "Divider", icon: Minus, color: "bg-muted text-muted-foreground" },
  footer: { label: "Footer", icon: PanelBottom, color: "bg-amber-500/10 text-amber-500" },
};

export function SectionBlock({
  section,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: SectionBlockProps) {
  const meta = SECTION_META[section.type] ?? DEFAULT_META;
  const Icon = meta.icon;

  return (
    <div className="border-border bg-card group rounded-md border">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <GripVertical className="text-muted-foreground h-3.5 w-3.5 cursor-grab" />
        <Badge variant="outline" className={`text-xs ${meta.color}`}>
          <Icon className="mr-1 h-3 w-3" />
          {meta.label}
        </Badge>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onMove("up")}
            disabled={index === 0}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onMove("down")}
            disabled={index === total - 1}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-6 w-6 p-0"
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Section content */}
      <div className="px-3 pb-3">
        {section.type === "title" && (
          <Input
            placeholder="Section title..."
            value={section.content ?? ""}
            onChange={(e) => onUpdate({ content: e.target.value })}
            className="text-sm font-medium"
          />
        )}

        {section.type === "message" && (
          <Textarea
            placeholder="Write your message here... Supports HTML and {{placeholders}}"
            value={section.content ?? ""}
            onChange={(e) => onUpdate({ content: e.target.value })}
            rows={4}
            className="font-mono text-xs"
          />
        )}

        {section.type === "image" && (
          <div className="space-y-2">
            <Input
              placeholder="Image URL (e.g., https://...)"
              value={section.imageUrl ?? ""}
              onChange={(e) => onUpdate({ imageUrl: e.target.value })}
              className="text-xs"
            />
            <Input
              placeholder="Alt text (accessibility)"
              value={section.imageAlt ?? ""}
              onChange={(e) => onUpdate({ imageAlt: e.target.value })}
              className="text-xs"
            />
          </div>
        )}

        {section.type === "list" && (
          <div className="space-y-1.5">
            {(section.items ?? []).map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs">{i + 1}.</span>
                <Input
                  value={item}
                  onChange={(e) => {
                    const items = [...(section.items ?? [])];
                    items[i] = e.target.value;
                    onUpdate({ items });
                  }}
                  className="h-7 flex-1 text-xs"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    const items = (section.items ?? []).filter((_, idx) => idx !== i);
                    onUpdate({ items });
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onUpdate({ items: [...(section.items ?? []), ""] })}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add item
            </Button>
          </div>
        )}

        {section.type === "html" && (
          <Textarea
            placeholder="<div>Custom HTML content...</div>"
            value={section.content ?? ""}
            onChange={(e) => onUpdate({ content: e.target.value })}
            rows={5}
            className="font-mono text-xs"
          />
        )}

        {section.type === "button" && (
          <div className="space-y-2">
            <Input
              placeholder="Button text"
              value={section.buttonText ?? ""}
              onChange={(e) => onUpdate({ buttonText: e.target.value })}
              className="text-xs"
            />
            <Input
              placeholder="Button URL (e.g., https://...)"
              value={section.buttonUrl ?? ""}
              onChange={(e) => onUpdate({ buttonUrl: e.target.value })}
              className="text-xs"
            />
          </div>
        )}

        {section.type === "divider" && (
          <div className="border-border border-t py-1">
            <p className="text-muted-foreground text-center text-xs">Horizontal divider</p>
          </div>
        )}

        {section.type === "footer" && (
          <Textarea
            placeholder="Footer content... HTML supported. {{placeholders}} available."
            value={section.content ?? ""}
            onChange={(e) => onUpdate({ content: e.target.value })}
            rows={3}
            className="font-mono text-xs"
          />
        )}
      </div>
    </div>
  );
}
