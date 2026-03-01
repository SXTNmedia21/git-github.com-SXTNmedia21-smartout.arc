"use client";

import { CalendarDays, Filter, Info } from "lucide-react";

type PlannerCommandBarProps = {
  isDark: boolean;
  filterSituation: string;
  setFilterSituation: (value: string) => void;
  showGuide: boolean;
  setShowGuide: (value: boolean) => void;
};

export function PlannerCommandBar({
  isDark,
  filterSituation,
  setFilterSituation,
  showGuide,
  setShowGuide,
}: PlannerCommandBarProps) {
  return (
    <div
      className={`z-20 flex shrink-0 flex-wrap items-center justify-between border-b border-white/[0.04] px-6 py-3 ${isDark ? "bg-[#0a0a0c]/80" : "bg-white/80"} backdrop-blur-md print:hidden`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="flex items-center gap-2 text-sm font-black tracking-tight xl:text-base">
          <CalendarDays className="h-5 w-5 text-orange-500" />
          Operasjonell Vaktplan
        </h1>
        <div className={`hidden h-4 w-px sm:block ${isDark ? "bg-white/10" : "bg-zinc-300"}`} />

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-zinc-500" />
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
            {["Alle", "Selskap", "Krise", "Normal"].map((situation) => (
              <button
                key={situation}
                onClick={() => setFilterSituation(situation)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-all ${
                  filterSituation === situation
                    ? isDark
                      ? "bg-zinc-800/80 text-zinc-200 shadow-sm"
                      : "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {situation}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-2 sm:mt-0">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
            showGuide
              ? "border-blue-500/50 bg-blue-500/20 text-blue-400"
              : isDark
                ? "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
          }`}
        >
          <Info className="h-4 w-4" /> Brukermetode
        </button>

        {showGuide && (
          <div
            className={`absolute top-full right-0 z-[9999] mt-2 w-80 rounded-2xl border border-white/10 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] ${isDark ? "bg-[#111113]/95" : "bg-white/95"} animate-in fade-in slide-in-from-top-2 backdrop-blur-3xl`}
          >
            <h4 className="mb-3 border-b border-orange-500/20 pb-2 text-sm font-black text-orange-400">
              Slik styrer du dagen herfra
            </h4>
            <ul className="space-y-3.5 text-[11px] leading-relaxed text-zinc-300">
              <li className="flex gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/20 font-bold text-blue-400">
                  1
                </span>
                <span>
                  <strong>Pixel-perfekt drag & drop:</strong> Løs fravær umiddelbart ved å dra
                  ansatte eller åpne vakter.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/20 font-bold text-purple-400">
                  2
                </span>
                <span>
                  <strong>Dagsbriefing:</strong> Klikk på en dag for å åpne kontrollsenteret.
                  Opprett gjøremål og se varsler.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 font-bold text-emerald-400">
                  3
                </span>
                <span>
                  <strong>Sanntid Kostnad:</strong> Indikatorer per ansatt og dag sikrer at du
                  lander på budsjett.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/20 font-bold text-rose-400">
                  4
                </span>
                <span>
                  <strong>Situasjonsfiltrering:</strong> Isoler dager med selskap eller
                  fraværskriser via filteret over.
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
