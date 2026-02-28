"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";
import type { PlaceholderType } from "./placeholder-field";

/**
 * Placeholder chip color mapping per architecture spec Section 5.8:
 * - Auto-populated (workspace data): Green
 * - Manual input: Orange
 * - Auto-generated: Blue
 * - Signature fields: Purple
 */
const PLACEHOLDER_COLORS: Record<PlaceholderType, string> = {
  auto: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  manual: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  generated: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  signature: "bg-violet-500/15 text-violet-400 border-violet-500/30",
};

const PLACEHOLDER_DOTS: Record<PlaceholderType, string> = {
  auto: "bg-emerald-400",
  manual: "bg-amber-400",
  generated: "bg-blue-400",
  signature: "bg-violet-400",
};

export function PlaceholderFieldView({ node }: NodeViewProps) {
  const { key, label, placeholderType } = node.attrs as {
    key: string;
    label: string;
    placeholderType: PlaceholderType;
  };

  const color = PLACEHOLDER_COLORS[placeholderType] || PLACEHOLDER_COLORS.manual;
  const dotColor = PLACEHOLDER_DOTS[placeholderType] || PLACEHOLDER_DOTS.manual;

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
          color,
        )}
        contentEditable={false}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
        {label || key}
      </span>
    </NodeViewWrapper>
  );
}
