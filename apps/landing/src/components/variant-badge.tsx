"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";

const VARIANTS = [
  { key: null, label: "Utforsk plattformen", tagline: "AI som gjør teamet klar" },
  { key: "E", label: "Rett på sak", tagline: "Kutt opplæringstiden i to" },
  { key: "T", label: "Enterprise-klar", tagline: "Data, kontroll og compliance" },
  { key: "K", label: "Konsulent-bevist", tagline: "ROI du kan vise kunden" },
  { key: "A", label: "Karrierevei", tagline: "Fra ny i Norge til nøkkelansatt" },
  { key: "F", label: "Alle forstår", tagline: "Null tekst, full forståelse" },
  { key: "S", label: "Bransjekultur", tagline: "Faget fortjener bedre verktøy" },
] as const;

export function VariantBadge() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const current = searchParams.get("v")?.toUpperCase() ?? null;

  const currentIndex = VARIANTS.findIndex((v) => v.key === current);
  const active = VARIANTS[currentIndex >= 0 ? currentIndex : 0]!;

  function cycleVariant() {
    const nextIndex = (currentIndex + 1) % VARIANTS.length;
    const next = VARIANTS[nextIndex]!;
    const params = new URLSearchParams(searchParams.toString());
    if (next.key) {
      params.set("v", next.key);
    } else {
      params.delete("v");
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });
  }

  return (
    <button
      onClick={cycleVariant}
      className="group flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs backdrop-blur transition-all hover:border-orange-500/40 hover:bg-zinc-800/80"
    >
      <Sparkles className="h-3 w-3 text-orange-500 transition-transform group-hover:rotate-12" />
      <span className="font-medium text-zinc-400 transition-colors group-hover:text-zinc-200">
        {active.tagline}
      </span>
      <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-400">
        {active.key ?? "B"}
      </span>
    </button>
  );
}
