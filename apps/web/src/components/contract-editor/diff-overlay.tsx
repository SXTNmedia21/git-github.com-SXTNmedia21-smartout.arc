"use client";

import { Check, X, CheckCheck, XCircle, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DiffProposal } from "./contract-editor";

/**
 * Action type labels and styling for diff visualization.
 *
 * Architecture spec Section 5.7:
 * - Deletions: Red background + strikethrough
 * - Insertions: Green background
 * - Modifications: Blue background
 * - Each changed section gets [Godta] [Avvis] [Diskuter] buttons
 */
const ACTION_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  insert_section: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    label: "Ny seksjon",
  },
  replace_section: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    label: "Endret seksjon",
  },
  remove_section: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "Fjernet seksjon",
  },
  add_placeholder: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    label: "Nytt felt",
  },
  add_signature_field: {
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    label: "Signaturfelt",
  },
  highlight_text: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    label: "Markering",
  },
  edit_text: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    label: "Tekstendring",
  },
  add_date_field: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    label: "Datofelt",
  },
};

type DiffOverlayProps = {
  diffs: DiffProposal[];
  onAccept: (diffId: string) => void;
  onReject: (diffId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onDismiss: () => void;
};

export function DiffOverlay({
  diffs,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onDismiss,
}: DiffOverlayProps) {
  if (diffs.length === 0) return null;

  return (
    <div className="border-border bg-card/95 absolute right-0 bottom-0 left-0 border-t backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {diffs.length} foreslatte endring{diffs.length > 1 ? "er" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAcceptAll}>
            <CheckCheck className="mr-1 h-3 w-3" />
            Godta alle
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRejectAll}>
            <XCircle className="mr-1 h-3 w-3" />
            Avvis alle
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDismiss}>
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Diff items */}
      <div className="max-h-[200px] overflow-y-auto px-4 pb-3">
        <div className="space-y-2">
          {diffs.map((diff) => {
            const style = ACTION_STYLES[diff.action.type] || {
              bg: "bg-muted",
              border: "border-border",
              label: diff.action.type,
            };

            return (
              <div
                key={diff.id}
                className={cn(
                  "flex items-center justify-between rounded-md border p-2",
                  style.bg,
                  style.border,
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-xs font-medium",
                        style.border,
                      )}
                    >
                      {style.label}
                    </span>
                    <span className="text-sm">
                      {diff.action.target ||
                        (diff.action.data?.title as string) ||
                        (diff.action.data?.key as string) ||
                        ""}
                    </span>
                  </div>
                  {diff.action.content && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {diff.action.content.substring(0, 120)}
                      {diff.action.content.length > 120 ? "..." : ""}
                    </p>
                  )}
                </div>
                <div className="ml-3 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                    onClick={() => onAccept(diff.id)}
                    title="Godta"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                    onClick={() => onReject(diff.id)}
                    title="Avvis"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
