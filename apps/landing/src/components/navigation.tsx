"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
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

// UI Events:
// - nav: each NAV_LINKS.href (nav link click)
// - nav: WEB_APP_LINKS.onboarding (CTA button)
// - action: toggleMobileMenu() (hamburger button)

export default function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  // Track scroll position for nav background intensity
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string): boolean {
    // Hash links like /#features only match on the homepage
    if (href.startsWith("/#")) {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav
      className={`fixed top-0 left-0 z-40 w-full border-b transition-all duration-300 ${
        scrolled
          ? "border-white/10 bg-[#0a0a0c]/90 shadow-[0_1px_20px_rgba(0,0,0,0.5)]"
          : "border-white/5 bg-[#0a0a0c]/80"
      } backdrop-blur-3xl`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <Building2 className="h-5 w-5 text-orange-500 transition-transform duration-300 group-hover:scale-110" />
          <span className="text-xl font-black tracking-tighter text-white">SmartOut</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-200 ${
                  active ? "text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
                {/* Active indicator dot */}
                {active && (
                  <m.span
                    layoutId="nav-active-dot"
                    className="absolute bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-orange-500"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </Link>
            );
          })}
          <div className="mx-2 h-5 w-px bg-white/10" />
          <Suspense>
            <VariantBadge />
          </Suspense>
          <Link
            href={WEB_APP_LINKS.onboarding}
            className="group ml-2 flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.08)] transition-all duration-300 hover:bg-zinc-100 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]"
          >
            Kom i gang
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile: CTA + hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <Link
            href={WEB_APP_LINKS.onboarding}
            className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-zinc-950"
          >
            Kom i gang <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-colors duration-200 hover:bg-white/10"
            aria-label={mobileOpen ? "Lukk meny" : "Åpne meny"}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen ? (
                <m.div
                  key="close"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="h-5 w-5 text-white" />
                </m.div>
              ) : (
                <m.div
                  key="open"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.15 }}
                >
                  <Menu className="h-5 w-5 text-white" />
                </m.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Mobile dropdown with animation */}
      <AnimatePresence>
        {mobileOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden border-t border-white/5 bg-[#0a0a0c]/95 backdrop-blur-3xl md:hidden"
          >
            <div className="mx-auto max-w-7xl space-y-1 px-6 py-4">
              {NAV_LINKS.map((link, i) => (
                <m.div
                  key={link.href}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/5 ${
                      isActive(link.href) ? "text-white" : "text-zinc-400"
                    }`}
                  >
                    {isActive(link.href) && (
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    )}
                    {link.label}
                  </Link>
                </m.div>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
