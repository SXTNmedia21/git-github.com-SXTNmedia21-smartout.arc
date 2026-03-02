"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronUp, Sparkles } from "lucide-react";

const VARIANTS = [
  { key: null, code: "B", label: "Standard", tagline: "AI som gjør teamet klar" },
  { key: "E", code: "E", label: "Action", tagline: "Kutt opplæringstiden i to" },
  { key: "T", code: "T", label: "Enterprise", tagline: "Data, kontroll og compliance" },
  { key: "K", code: "K", label: "Konsulent", tagline: "ROI du kan vise kunden" },
  { key: "A", code: "A", label: "Karriere", tagline: "Fra ny i Norge til nøkkelansatt" },
  { key: "F", code: "F", label: "Tilgjengelig", tagline: "Null tekst, full forståelse" },
  { key: "S", code: "S", label: "Bransjekultur", tagline: "Faget fortjener bedre verktøy" },
] as const;

export function VariantDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const current = searchParams.get("v")?.toUpperCase() ?? null;

  const active = VARIANTS.find((v) => v.key === current) ?? VARIANTS[0];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectVariant(key: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (key) {
      params.set("v", key);
    } else {
      params.delete("v");
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-300"
      >
        <Sparkles className="h-3 w-3 text-orange-500" />
        <span>{active.tagline}</span>
        <ChevronUp className={`h-3 w-3 transition-transform ${open ? "" : "rotate-180"}`} />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-72 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur">
          <div className="border-b border-zinc-800 px-3 py-2">
            <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Utforsk plattformen
            </p>
          </div>
          <div className="py-1">
            {VARIANTS.map((v) => (
              <button
                key={v.code}
                onClick={() => selectVariant(v.key)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-zinc-800/60 ${
                  v.key === current ? "bg-orange-500/10" : ""
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-black ${
                    v.key === current ? "bg-orange-500 text-white" : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {v.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      v.key === current ? "text-orange-400" : "text-zinc-300"
                    }`}
                  >
                    {v.tagline}
                  </p>
                  <p className="text-[11px] text-zinc-500">{v.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
