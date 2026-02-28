"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-muted text-muted-foreground",
  parties: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  service: "bg-green-500/10 text-green-400 border-green-500/20",
  payment: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  legal: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  gdpr: "bg-red-500/10 text-red-400 border-red-500/20",
  signature: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  termination: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export function ClauseBlockView({ node, updateAttributes }: NodeViewProps) {
  const { title, category, collapsed } = node.attrs as {
    title: string;
    category: string;
    collapsed: boolean;
  };

  const categoryColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;

  return (
    <NodeViewWrapper className="my-3">
      <div className="border-border bg-card rounded-lg border shadow-sm">
        {/* Header */}
        <div
          className="border-border flex items-center gap-2 border-b px-3 py-2"
          contentEditable={false}
        >
          {/* Drag handle */}
          <div
            className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            data-drag-handle=""
          >
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Collapse toggle */}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => updateAttributes({ collapsed: !collapsed })}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {/* Title */}
          <span className="flex-1 text-sm font-semibold">{title}</span>

          {/* Category badge */}
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
              categoryColor,
            )}
          >
            {category}
          </span>
        </div>

        {/* Body content */}
        <div className={cn("px-4 py-3", collapsed && "hidden")}>
          <NodeViewContent className="clause-block-content" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
