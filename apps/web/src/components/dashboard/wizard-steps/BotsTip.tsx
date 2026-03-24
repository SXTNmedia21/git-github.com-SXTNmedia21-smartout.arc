"use client";

import { Lightbulb } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function BotsTip({ tip, extendedTip }: { tip: string; extendedTip?: string }) {
  if (!tip) return null;

  return (
    <div
      className={`mt-8 flex items-start gap-3 rounded-xl border px-4 py-3 ${"border-warning bg-warning/50"}`}
    >
      <Lightbulb className="text-warning mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${"text-warning"}`}>
          <span className="font-semibold">Botsson:</span> {tip}
        </p>
        {extendedTip && (
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className={`mt-1 text-xs font-medium transition-colors ${"text-warning/60 hover:text-amber-600"}`}
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
