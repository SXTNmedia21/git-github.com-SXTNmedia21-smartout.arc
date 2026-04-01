/**
 * terminal-log.tsx — Collapsible monospace log viewer.
 *
 * Auto-scrolls to the bottom as new lines arrive so the user always sees the
 * latest output without manually scrolling. The clear button empties the local
 * display without affecting the underlying run state.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TerminalLogProps = {
  lines: string[];
};

export function TerminalLog({ lines }: TerminalLogProps) {
  const [open, setOpen] = useState(false);
  // Local cleared-line offset — allows clearing display without mutating parent state
  const [clearedAt, setClearedAt] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleLines = lines.slice(clearedAt);

  // Auto-scroll to bottom whenever new lines arrive (only if panel is open)
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleLines.length, open]);

  return (
    <div className="border-border rounded-lg border">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="text-muted-foreground h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">Output</span>
        {visibleLines.length > 0 && (
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            {visibleLines.length} linjer
          </span>
        )}
      </button>

      {/* Log content — shown only when expanded */}
      {open && (
        <div className="border-border border-t">
          {/* Toolbar */}
          <div className="flex items-center justify-end px-3 py-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClearedAt(lines.length)}
              className="h-6 px-2 text-xs"
              disabled={visibleLines.length === 0}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Tøm
            </Button>
          </div>

          {/* Scrollable log area */}
          <div
            ref={scrollRef}
            className={cn(
              "bg-muted/30 max-h-64 overflow-y-auto px-3 py-2",
              "font-mono text-xs leading-relaxed",
            )}
          >
            {visibleLines.length === 0 ? (
              <p className="text-muted-foreground italic">Ingen output ennå...</p>
            ) : (
              visibleLines.map((line, i) => (
                <div key={i} className="text-foreground/80 break-all whitespace-pre-wrap">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
