"use client";

import { usePathname } from "next/navigation";

/**
 * Language switcher — NO | EN toggle.
 * Sets a cookie so middleware remembers the choice, then navigates.
 *
 * URL mapping:
 * - nb → en: /docs/vaktplan → /en/docs/vaktplan (slug stays same, en/ route resolves)
 * - en → nb: /en/docs/shift-planning → /docs/shift-planning (strip /en prefix)
 */
export function LanguageSwitcher({ locale = "nb" }: { locale?: "nb" | "en" }) {
  const pathname = usePathname();

  function switchTo(target: "nb" | "en") {
    if (target === locale) return;

    // Set cookie for middleware (1 year expiry)
    document.cookie = `smartout-locale=${target};path=/;max-age=31536000;samesite=lax`;

    // Build target URL
    let targetPath: string;
    if (target === "en") {
      // nb → en: add /en prefix
      targetPath = `/en${pathname}`;
    } else {
      // en → nb: strip /en prefix
      targetPath = pathname.replace(/^\/en/, "") || "/";
    }

    window.location.href = targetPath;
  }

  return (
    <div className="flex items-center gap-0.5 text-sm font-semibold">
      <button
        onClick={() => switchTo("nb")}
        className={`rounded-md px-2 py-1 transition-colors ${
          locale === "nb"
            ? "text-foreground bg-foreground/10"
            : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
        }`}
        aria-label="Bytt til norsk"
      >
        NO
      </button>
      <span className="text-border">|</span>
      <button
        onClick={() => switchTo("en")}
        className={`rounded-md px-2 py-1 transition-colors ${
          locale === "en"
            ? "text-foreground bg-foreground/10"
            : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
        }`}
        aria-label="Switch to English"
      >
        EN
      </button>
    </div>
  );
}
