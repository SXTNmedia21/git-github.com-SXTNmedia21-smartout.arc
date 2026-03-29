"use client";

import { VariantLink as Link } from "./tracking";
import { Building2, ArrowUp } from "lucide-react";
import { Suspense } from "react";
import { VariantDropdown } from "./variant-dropdown";
import { createTranslator } from "@smartout/i18n";

// UI Events:
// - nav: each footerLinks href (footer link click)
// - nav: /personvern (privacy policy link)
// - nav: /vilkar (terms link)
// - action: scrollToTop() (back-to-top button)

export default function Footer({ locale = "nb" }: { locale?: "nb" | "en" }) {
  const t = createTranslator(locale, "common");

  const footerLinks = {
    [t("footer.product")]: [
      { label: t("nav.features"), href: "/#features" },
      { label: t("nav.pricing"), href: "/pricing" },
      { label: t("nav.docs"), href: "/docs" },
    ],
    [t("footer.company")]: [
      { label: t("nav.about"), href: "/om-oss" },
      { label: t("nav.blog"), href: "/blog" },
    ],
    [t("footer.resources")]: [
      { label: t("footer.getStarted"), href: "/docs/kom-i-gang" },
      { label: t("footer.onboarding"), href: "/docs/onboarding" },
      { label: "API", href: "/docs/api" },
    ],
  };

  return (
    <footer className="dark-section border-border bg-background relative z-10 border-t">
      <div className="via-brand-orange/20 pointer-events-none absolute top-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent to-transparent" />

      <div className="mx-auto max-w-7xl px-6 pt-12 pb-8 sm:pt-16">
        {/* Top: brand + link columns */}
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div className="shrink-0">
            <Link href="/" className="group mb-4 inline-flex items-center gap-2.5">
              <Building2 className="text-brand-orange h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
              <span className="text-foreground text-lg font-black tracking-tighter">SmartOut</span>
            </Link>
            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Link columns — 3-col on mobile, side-by-side */}
          <div className="grid grid-cols-3 gap-6 sm:gap-10">
            {Object.entries(footerLinks).map(([heading, links]) => (
              <div key={heading}>
                <h3 className="text-muted-foreground/70 sm:text-muted-foreground mb-3 text-[11px] font-bold tracking-widest uppercase sm:mb-4 sm:text-xs">
                  {heading}
                </h3>
                <ul className="space-y-2.5 sm:space-y-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground sm:text-muted-foreground text-xs transition-colors duration-200 sm:text-sm"
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
        <div className="bg-border mt-10 h-px sm:mt-12" />

        {/* Bottom bar */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-muted-foreground/70 text-xs sm:text-sm">
            &copy; {new Date().getFullYear()} SmartOut AS
          </p>
          <div className="text-muted-foreground/70 flex items-center gap-4 text-xs sm:gap-6 sm:text-sm">
            <Suspense>
              <VariantDropdown />
            </Suspense>
            <Link
              href="/personvern"
              className="hover:text-muted-foreground transition-colors duration-200"
            >
              {t("footer.privacy")}
            </Link>
            <Link
              href="/vilkar"
              className="hover:text-muted-foreground transition-colors duration-200"
            >
              {t("footer.terms")}
            </Link>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="border-border bg-foreground/[0.02] text-muted-foreground hover:border-foreground/10 hover:text-foreground hidden items-center gap-1.5 rounded-full border px-3 py-1.5 transition-all duration-200 sm:flex"
              aria-label={t("footer.topLabel")}
            >
              {t("footer.top")}
              <ArrowUp className="h-3 w-3 transition-transform duration-200 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
