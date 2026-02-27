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
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-zinc-400">📍</div>
                    <h3 className="text-lg font-semibold text-white">Locations & Zones</h3>
                </div>
                <div className="text-xs font-medium text-zinc-500">
                    State: <span className="text-blue-400">Core Definition</span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {locations.map(loc => (
                    <div
                        key={loc.id}
                        className={`p-4 rounded-xl border flex flex-col gap-2 transition-colors ${loc.isComplete
                                ? "bg-zinc-900 border-zinc-700"
                                : "bg-red-500/5 border-red-500/30 ring-1 ring-inset ring-red-500/10"
                            }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="font-medium text-white">{loc.name}</div>
                            {loc.isComplete ? (
                                <CheckCircle2 size={16} className="text-emerald-500" />
                            ) : (
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                        </div>

                        <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">{loc.type}</div>

                        {!loc.isComplete && (
                            <div className="mt-2 text-xs text-red-400 flex items-start gap-1.5 bg-red-500/10 p-2 rounded-lg">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                <span>Missing context: Primary function and dependencies. The AI needs this to generate policies.</span>
                            </div>
                        )}
                        {loc.isComplete && loc.function && (
                            <div className="text-sm text-zinc-400 line-clamp-2 mt-1">
                                {loc.function}
                            </div>
                        )}
                    </div>
                ))}
                <div className="p-4 rounded-xl border border-dashed border-zinc-700/50 flex items-center justify-center text-zinc-500 hover:bg-zinc-900/50 cursor-pointer transition-colors h-[120px]">
                    <span className="text-sm font-medium">+ Add Location</span>
                </div>
            </div>
        </section>
    );
}
