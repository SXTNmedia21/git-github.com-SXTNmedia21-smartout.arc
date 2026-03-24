"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, ChevronDown, ChevronUp } from "lucide-react";
import { createTranslator } from "@smartout/i18n";

/**
 * Cookie consent categories.
 * - necessary: always on (locale, theme) — cannot be disabled
 * - analytics: PostHog, Vercel Analytics, Speed Insights, scroll/click tracking
 */
type ConsentCategories = {
  necessary: true;
  analytics: boolean;
};

type ConsentState = {
  categories: ConsentCategories;
  hasConsented: boolean;
};

const CONSENT_COOKIE = "smartout-consent";
const CONSENT_VERSION = 1;

type StoredConsent = {
  version: number;
  categories: ConsentCategories;
  timestamp: string;
};

function readConsent(): ConsentState {
  if (typeof window === "undefined") {
    return { categories: { necessary: true, analytics: false }, hasConsented: false };
  }

  try {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
      ?.split("=")
      .slice(1)
      .join("=");

    if (!raw) return { categories: { necessary: true, analytics: false }, hasConsented: false };

    const stored: StoredConsent = JSON.parse(decodeURIComponent(raw));
    if (stored.version !== CONSENT_VERSION) {
      return { categories: { necessary: true, analytics: false }, hasConsented: false };
    }

    return { categories: stored.categories, hasConsented: true };
  } catch {
    return { categories: { necessary: true, analytics: false }, hasConsented: false };
  }
}

function writeConsent(categories: ConsentCategories) {
  const stored: StoredConsent = {
    version: CONSENT_VERSION,
    categories,
    timestamp: new Date().toISOString(),
  };
  const value = encodeURIComponent(JSON.stringify(stored));
  document.cookie = `${CONSENT_COOKIE}=${value};path=/;max-age=31536000;samesite=lax`;
}

/* ─── Context ─────────────────────────────────── */

const ConsentContext = createContext<ConsentState>({
  categories: { necessary: true, analytics: false },
  hasConsented: false,
});

export function useConsent() {
  return useContext(ConsentContext);
}

/* ─── Provider ────────────────────────────────── */

export function ConsentProvider({
  locale = "nb",
  children,
}: {
  locale?: "nb" | "en";
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ConsentState>(() => readConsent());

  // Re-read on mount (SSR safety)
  useEffect(() => {
    setState(readConsent());
  }, []);

  const accept = useCallback((categories: ConsentCategories) => {
    writeConsent(categories);
    setState({ categories, hasConsented: true });
  }, []);

  return (
    <ConsentContext.Provider value={state}>
      {children}
      <AnimatePresence>
        {!state.hasConsented && <ConsentBanner locale={locale} onAccept={accept} />}
      </AnimatePresence>
    </ConsentContext.Provider>
  );
}

/* ─── Conditional Analytics ───────────────────── */

/**
 * Wrap analytics components with this. Only renders children
 * when the user has consented to the analytics category.
 */
export function AnalyticsGate({ children }: { children: React.ReactNode }) {
  const { categories, hasConsented } = useConsent();

  if (!hasConsented || !categories.analytics) return null;
  return <>{children}</>;
}

/* ─── Banner ──────────────────────────────────── */

function ConsentBanner({
  locale,
  onAccept,
}: {
  locale: "nb" | "en";
  onAccept: (categories: ConsentCategories) => void;
}) {
  const t = createTranslator(locale, "common");
  const [showDetails, setShowDetails] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  function acceptAll() {
    onAccept({ necessary: true, analytics: true });
  }

  function acceptSelected() {
    onAccept({ necessary: true, analytics: analyticsChecked });
  }

  function rejectOptional() {
    onAccept({ necessary: true, analytics: false });
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", stiffness: 35, damping: 20, mass: 2 }}
      className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6"
    >
      <div className="border-border bg-card mx-auto max-w-2xl rounded-2xl border p-5 shadow-lg sm:p-6">
        {/* Header */}
        <div className="mb-3 flex items-start gap-3">
          <Cookie className="text-brand-orange mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-foreground text-sm font-bold">{t("consent.title")}</h3>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {t("consent.description")}
            </p>
          </div>
        </div>

        {/* Details toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1.5 text-xs font-semibold transition-colors"
        >
          {showDetails ? t("consent.hideDetails") : t("consent.showDetails")}
          {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {/* Category details */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-4 overflow-hidden"
            >
              <div className="space-y-3">
                {/* Necessary */}
                <div className="border-border rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-sm font-semibold">
                      {t("consent.necessary.title")}
                    </span>
                    <span className="text-muted-foreground text-xs">{t("consent.alwaysOn")}</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {t("consent.necessary.description")}
                  </p>
                </div>

                {/* Analytics */}
                <div className="border-border rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-sm font-semibold">
                      {t("consent.analytics.title")}
                    </span>
                    <button
                      onClick={() => setAnalyticsChecked(!analyticsChecked)}
                      className={`h-5 w-9 rounded-full transition-colors ${
                        analyticsChecked ? "bg-brand-orange" : "bg-border"
                      }`}
                      role="switch"
                      aria-checked={analyticsChecked}
                    >
                      <span
                        className={`bg-background block h-4 w-4 rounded-full transition-transform ${
                          analyticsChecked ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                    {t("consent.analytics.description")}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={acceptAll}
            className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-5 py-2 text-sm font-bold transition-colors"
          >
            {t("consent.acceptAll")}
          </button>
          {showDetails && (
            <button
              onClick={acceptSelected}
              className="border-border hover:bg-foreground/5 text-foreground rounded-full border px-5 py-2 text-sm font-semibold transition-colors"
            >
              {t("consent.acceptSelected")}
            </button>
          )}
          <button
            onClick={rejectOptional}
            className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm font-semibold transition-colors"
          >
            {t("consent.rejectOptional")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
