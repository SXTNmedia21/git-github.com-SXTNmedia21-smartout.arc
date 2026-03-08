"use client";

import { Lightbulb } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function BotsTip({
  tip,
  extendedTip,
  isDark,
}: {
  tip: string;
  extendedTip?: string;
  isDark: boolean;
}) {
  if (!tip) return null;

  return (
    <div
      className={`mt-8 flex items-start gap-3 rounded-xl border px-4 py-3 ${
        isDark ? "border-amber-500/20 bg-amber-500/5" : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${isDark ? "text-amber-200/80" : "text-amber-800"}`}>
          <span className="font-semibold">Botsson:</span> {tip}
        </p>
        {extendedTip && (
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className={`mt-1 text-xs font-medium transition-colors ${
                  isDark
                    ? "text-amber-400/60 hover:text-amber-400"
                    : "text-amber-600/60 hover:text-amber-600"
                }`}
              >
                Mer &#9656;
              </button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Botsson forklarer</SheetTitle>
              </SheetHeader>
              <p className="mt-4 text-sm leading-relaxed">{extendedTip}</p>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}
