"use client";

/**
 * ReasoningDrawer — Right-side panel showing cascade derivation reasoning.
 *
 * Explains WHY a ghost value was resolved the way it was:
 * source, explanation text, and any override history.
 */

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@smartout/ui";

type OverrideEntry = {
  date: string;
  by: string;
  reason: string;
};

type ReasoningDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  source: string;
  explanation: string;
  overrideHistory?: OverrideEntry[];
};

export function ReasoningDrawer({
  open,
  onClose,
  title,
  source,
  explanation,
  overrideHistory,
}: ReasoningDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="bg-card fixed inset-y-0 right-0 z-50 w-96 border-l shadow-lg">
      <div className="flex h-full flex-col overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Kilde (Source) */}
        <section className="mb-6">
          <h4 className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">Kilde</h4>
          <p className="text-sm">{source}</p>
        </section>

        {/* Begrunnelse (Explanation) */}
        <section className="mb-6">
          <h4 className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
            Begrunnelse
          </h4>
          <p className="text-sm leading-relaxed">{explanation}</p>
        </section>

        {/* Override-historikk */}
        {overrideHistory && overrideHistory.length > 0 && (
          <section>
            <h4 className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
              Override-historikk
            </h4>
            <div className="space-y-3">
              {overrideHistory.map((entry, idx) => (
                <div key={idx} className="rounded-md border p-3 text-sm">
                  <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
                    <span>{entry.by}</span>
                    <span>{entry.date}</span>
                  </div>
                  <p>{entry.reason}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
