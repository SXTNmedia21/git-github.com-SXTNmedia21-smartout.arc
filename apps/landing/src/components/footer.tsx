"use client";

import Link from "next/link";
import { Building2, ArrowUp } from "lucide-react";
import { Suspense } from "react";
import { VariantDropdown } from "./variant-dropdown";

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
    <footer className="relative z-10 border-t border-zinc-900 bg-zinc-950 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-orange-500" />
              <span className="text-lg font-black tracking-tighter text-white">SmartOut</span>
            </Link>
            <p className="text-sm leading-relaxed text-zinc-500">
              AI-drevet workforce management for den norske serveringsbransjen.
            </p>
          </div>
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="mb-4 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                {heading}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-900 pt-8 md:flex-row">
          <p className="text-sm text-zinc-600">
            &copy; 2026 SmartOut AS. Helt bygget for fremtiden.
          </p>
          <div className="flex items-center gap-6 text-sm text-zinc-600">
            <Suspense>
              <VariantDropdown />
            </Suspense>
            <Link href="/personvern" className="transition-colors hover:text-zinc-400">
              Personvern
            </Link>
            <Link href="/vilkar" className="transition-colors hover:text-zinc-400">
              Vilkår
            </Link>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-1 transition-colors hover:text-zinc-300"
              aria-label="Tilbake til toppen"
            >
              Toppen <ArrowUp className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
