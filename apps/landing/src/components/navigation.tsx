"use client";

import { Suspense, useState, useEffect } from "react";
import { VariantLink as Link } from "./tracking";
import { usePathname } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { Building2, ArrowRight, Menu, X } from "lucide-react";
import { WEB_APP_LINKS } from "../lib/web-app-url";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { createTranslator } from "@smartout/i18n";
import { useLocale } from "../hooks/useLocale";

// UI Events:
// - nav: each NAV_LINKS.href (nav link click)
// - nav: WEB_APP_LINKS.onboarding (CTA button)
// - action: toggleMobileMenu() (hamburger button)

export default function Navigation({ locale: localeProp }: { locale?: "nb" | "en" }) {
  const detectedLocale = useLocale();
  const locale = localeProp ?? detectedLocale;
  const t = createTranslator(locale, "common");
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const prefix = locale === "en" ? "/en" : "";

  const navLinks = [
    { href: `${prefix}/#features`, label: t("nav.features") },
    { href: `${prefix}/pricing`, label: t("nav.pricing") },
    { href: `${prefix}/blog`, label: t("nav.blog") },
    { href: `${prefix}/docs`, label: t("nav.docs") },
    { href: `${prefix}/om-oss`, label: t("nav.about") },
  ];

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
        scrolled ? "border-border bg-background/90 shadow-sm" : "border-transparent bg-transparent"
      } backdrop-blur-3xl`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <Building2 className="text-brand-orange h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
          <span className="text-foreground text-xl font-black tracking-tighter">SmartOut</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-200 ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {link.label}
                {/* Active indicator dot */}
                {active && (
                  <m.span
                    layoutId="nav-active-dot"
                    className="bg-brand-orange absolute bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </Link>
            );
          })}
          <div className="bg-border mx-2 h-5 w-px" />
          <LanguageSwitcher locale={locale} />
          <div className="bg-border mx-2 h-5 w-px" />
          <div className="ml-2">
            <ThemeToggle />
          </div>
          <Link
            href={WEB_APP_LINKS.login}
            className="bg-foreground text-background hover:bg-foreground/90 group ml-2 flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold shadow-[0_0_20px_rgba(255,255,255,0.08)] transition-all duration-300"
          >
            {t("nav.login")}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile: CTA + hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          <LanguageSwitcher locale={locale} />
          <ThemeToggle />
          <Link
            href={WEB_APP_LINKS.login}
            className="bg-foreground text-background flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold"
          >
            {t("nav.login")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="border-border bg-card hover:bg-foreground/5 flex h-11 w-11 items-center justify-center rounded-xl border transition-colors duration-200"
            aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
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
                  <X className="text-foreground h-5 w-5" />
                </m.div>
              ) : (
                <m.div
                  key="open"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.15 }}
                >
                  <Menu className="text-foreground h-5 w-5" />
                </m.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Mobile dropdown — CSS-only animation for performance */}
      <div
        className={`border-border bg-background/95 grid border-t backdrop-blur-3xl transition-[grid-template-rows] duration-200 ease-out md:hidden ${
          mobileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-6 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`hover:bg-foreground/5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                  isActive(link.href) ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {isActive(link.href) && (
                  <span className="bg-brand-orange h-1.5 w-1.5 rounded-full" />
                )}
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
