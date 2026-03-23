"use client";

import { VariantLink as Link } from "./tracking";
import { Building2, ArrowUp } from "lucide-react";
import { Suspense } from "react";
import { VariantDropdown } from "./variant-dropdown";

// UI Events:
// - nav: each footerLinks href (footer link click)
// - nav: /personvern (privacy policy link)
// - nav: /vilkar (terms link)
// - action: scrollToTop() (back-to-top button)

const footerLinks = {
  Produkt: [
    { label: "Funksjoner", href: "/#features" },
    { label: "Priser", href: "/pricing" },
    { label: "Dokumentasjon", href: "/docs" },
  ],
  Selskap: [
    { label: "Om Oss", href: "/om-oss" },
    { label: "Kundehistorier", href: "/blog" },
  ],
  Ressurser: [
    { label: "Kom i gang", href: "/docs/kom-i-gang" },
    { label: "Onboarding", href: "/docs/onboarding" },
    { label: "API", href: "/docs/api" },
  ],
};

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] bg-[#050505]">
      <div className="pointer-events-none absolute top-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-6 pt-12 pb-8 sm:pt-16">
        {/* Top: brand + link columns */}
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div className="shrink-0">
            <Link href="/" className="group mb-4 inline-flex items-center gap-2.5">
              <Building2 className="h-5 w-5 text-orange-500 transition-transform duration-300 group-hover:scale-110" />
              <span className="text-lg font-black tracking-tighter text-white">SmartOut</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-zinc-500">
              {/* CHANGED: More evocative, less corporate */}
              Strukturen bak restauranter som leverer — hver dag.
            </p>
          </div>

          {/* Link columns — 3-col on mobile, side-by-side */}
          <div className="grid grid-cols-3 gap-6 sm:gap-10">
            {Object.entries(footerLinks).map(([heading, links]) => (
              <div key={heading}>
                <h3 className="mb-3 text-[11px] font-bold tracking-widest text-zinc-600 uppercase sm:mb-4 sm:text-xs sm:text-zinc-500">
                  {heading}
                </h3>
                <ul className="space-y-2.5 sm:space-y-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-xs text-zinc-500 transition-colors duration-200 hover:text-white sm:text-sm sm:text-zinc-400"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mt-10 h-px bg-white/[0.06] sm:mt-12" />

        {/* Bottom bar */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-zinc-600 sm:text-sm">
            &copy; {new Date().getFullYear()} SmartOut AS
          </p>
          <div className="flex items-center gap-4 text-xs text-zinc-600 sm:gap-6 sm:text-sm">
            <Suspense>
              <VariantDropdown />
            </Suspense>
            <Link href="/personvern" className="transition-colors duration-200 hover:text-zinc-400">
              Personvern
            </Link>
            <Link href="/vilkar" className="transition-colors duration-200 hover:text-zinc-400">
              Vilkår
            </Link>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="hidden items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-zinc-500 transition-all duration-200 hover:border-white/10 hover:text-zinc-300 sm:flex"
              aria-label="Tilbake til toppen"
            >
              Toppen
              <ArrowUp className="h-3 w-3 transition-transform duration-200 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
