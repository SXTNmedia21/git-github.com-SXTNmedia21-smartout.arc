"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronUp, Sparkles } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";

const PERSPECTIVES = [
  { slug: "/", code: "B", tagline: "AI som gjør teamet klar", label: "Plattform" },
  { slug: "/drift", code: "E", tagline: "Kaos koster mer enn du tror", label: "Drift" },
  { slug: "/tilsyn", code: "T", tagline: "Alltid klar for tilsyn", label: "Compliance" },
  { slug: "/vekst", code: "K", tagline: "Voks uten å miste kvalitet", label: "Vekst" },
  { slug: "/tilhorighet", code: "A", tagline: "Du hører til fra dag én", label: "Tilhørighet" },
  { slug: "/opplaering", code: "F", tagline: "Ingen starter uforberedt", label: "Opplæring" },
  { slug: "/handverk", code: "S", tagline: "Håndverket fortjener bedre", label: "Håndverk" },
  { slug: "/vaktliste", code: "V", tagline: "Riktig person, riktig tid", label: "Vaktliste" },
  { slug: "/ai", code: "I", tagline: "En kollega som aldri glemmer", label: "AI" },
  { slug: "/kommunikasjon", code: "M", tagline: "Slutt å gjenta deg selv", label: "Kommunikasjon" },
] as const;

export function VariantDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const active = PERSPECTIVES.find((p) => p.slug === pathname) ?? PERSPECTIVES[0];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function navigate(slug: string) {
    router.push(slug, { scroll: true });
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-muted-foreground/70 hover:text-foreground flex items-center gap-1.5 text-sm transition-colors duration-150"
      >
        <Sparkles className="text-brand-orange h-3 w-3" />
        <span className="hidden sm:inline">{active.tagline}</span>
        <span className="sm:hidden">{active.label}</span>
        <ChevronUp
          className={`h-3 w-3 transition-transform duration-200 ${open ? "" : "rotate-180"}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="border-border bg-background/95 absolute right-0 bottom-full mb-2 w-80 overflow-hidden rounded-xl border shadow-2xl backdrop-blur"
          >
            <div className="border-border border-b px-3 py-2">
              <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                10 perspektiver på SmartOut
              </p>
            </div>
            <div className="max-h-[400px] overflow-y-auto py-1">
              {PERSPECTIVES.map((p, i) => (
                <m.button
                  key={p.code}
                  onClick={() => navigate(p.slug)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 400, damping: 25 }}
                  className={`hover:bg-muted/60 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-100 ${
                    p.slug === pathname ? "bg-brand-orange/10" : ""
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${
                      p.slug === pathname
                        ? "bg-brand-orange text-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold ${
                        p.slug === pathname ? "text-brand-orange" : "text-foreground"
                      }`}
                    >
                      {p.tagline}
                    </p>
                    <p className="text-muted-foreground text-[11px]">{p.label}</p>
                  </div>
                </m.button>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
