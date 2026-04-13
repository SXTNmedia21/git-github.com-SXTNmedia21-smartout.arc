/**
 * YearNavigation — centered year selector with directional arrows.
 *
 * Renders << 2025 | 2026 | 2027 >> with the active year highlighted.
 * Clicking arrows or year labels navigates between years.
 * Uses direction-aware slide animation via Framer Motion.
 */

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@smartout/i18n";

type YearNavigationProps = {
  currentYear: number;
  onYearChange: (year: number) => void;
};

export function YearNavigation({ currentYear, onYearChange }: YearNavigationProps) {
  const { t } = useTranslation("dashboard");
  const prevYear = currentYear - 1;
  const nextYear = currentYear + 1;
  const todayYear = new Date().getFullYear();

  return (
    <nav
      className="flex items-center justify-center gap-2"
      aria-label={`${t("yearWheel.tab_overview")} ${currentYear}`}
    >
      <button
        onClick={() => onYearChange(prevYear)}
        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg p-2 transition-colors"
        aria-label={`Navigate to ${prevYear}`}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex items-baseline gap-4">
        <button
          onClick={() => onYearChange(prevYear)}
          className="font-heading text-muted-foreground hover:text-foreground text-lg transition-colors"
        >
          {prevYear}
        </button>

        <AnimatePresence mode="wait">
          <motion.span
            key={currentYear}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="font-heading text-foreground text-3xl font-semibold"
            aria-live="polite"
          >
            {currentYear}
          </motion.span>
        </AnimatePresence>

        <button
          onClick={() => onYearChange(nextYear)}
          className="font-heading text-muted-foreground hover:text-foreground text-lg transition-colors"
        >
          {nextYear}
        </button>
      </div>

      <button
        onClick={() => onYearChange(nextYear)}
        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg p-2 transition-colors"
        aria-label={`Navigate to ${nextYear}`}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {currentYear !== todayYear && (
        <button
          onClick={() => onYearChange(todayYear)}
          className="bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground ml-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          {t("yearWheel.today")}
        </button>
      )}
    </nav>
  );
}
