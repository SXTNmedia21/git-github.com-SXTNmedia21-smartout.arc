"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ArrowRight, Menu, X } from "lucide-react";
import { WEB_APP_LINKS } from "../lib/web-app-url";
import { VariantBadge } from "./variant-badge";

const NAV_LINKS = [
  { href: "/om-oss", label: "Om Oss" },
  { href: "/pricing", label: "Priser" },
  { href: "/blog", label: "Kundehistorier" },
  { href: "/docs", label: "Dokumentasjon" },
  { href: "/#features", label: "Funksjoner" },
];

export default function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 z-40 w-full border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-3xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-orange-500" />
          <span className="text-xl font-black tracking-tighter text-white">SmartOut</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-semibold transition-colors hover:text-white ${
                pathname === link.href ? "text-white" : "text-zinc-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Suspense>
            <VariantBadge />
          </Suspense>
          <Link
            href={WEB_APP_LINKS.onboarding}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-colors hover:bg-zinc-200 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            Kom i gang <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Mobile: CTA + hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <Link
            href={WEB_APP_LINKS.onboarding}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-950"
          >
            Kom i gang <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5"
            aria-label={mobileOpen ? "Lukk meny" : "Åpne meny"}
          >
            {mobileOpen ? (
              <X className="h-5 w-5 text-white" />
            ) : (
              <Menu className="h-5 w-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-white/5 bg-[#0a0a0c]/95 backdrop-blur-3xl md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-6 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/5 ${
                  pathname === link.href ? "text-white" : "text-zinc-400"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
