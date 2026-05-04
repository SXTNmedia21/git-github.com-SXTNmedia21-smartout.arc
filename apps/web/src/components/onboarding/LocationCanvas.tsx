"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface CoreLocation {
  id: string;
  name: string;
  type: string;
  function: string;
  isComplete: boolean;
}

interface LocationCanvasProps {
  locations: CoreLocation[];
}

export function LocationCanvas({ locations }: LocationCanvasProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded">
            📍
          </div>
          <h3 className="text-lg font-semibold text-white">Locations & Zones</h3>
        </div>
        <div className="text-muted-foreground text-xs font-medium">
          State: <span className="text-blue-400">Core Definition</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {locations.map((loc) => (
          <div
            key={loc.id}
            className={`flex flex-col gap-2 rounded-xl border p-4 transition-colors ${
              loc.isComplete
                ? "border-border bg-card"
                : "border-red-500/30 bg-red-500/5 ring-1 ring-red-500/10 ring-inset"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="font-medium text-white">{loc.name}</div>
              {loc.isComplete ? (
                <CheckCircle2 size={16} className="text-emerald-500" />
              ) : (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
              )}
            </div>

            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {loc.type}
            </div>

            {!loc.isComplete && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-500/10 p-2 text-xs text-red-400">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>
                  Missing context: Primary function and dependencies. The AI needs this to generate
                  policies.
                </span>
              </div>
            )}
            {loc.isComplete && loc.function && (
              <div className="text-muted-foreground mt-1 line-clamp-2 text-sm">{loc.function}</div>
            )}
          </div>
        ))}
        <div className="border-border/50 text-muted-foreground hover:bg-muted/50 flex h-[120px] cursor-pointer items-center justify-center rounded-xl border border-dashed p-4 transition-colors">
          <span className="text-sm font-medium">+ Add Location</span>
        </div>
      </div>
    </section>
  );
}
