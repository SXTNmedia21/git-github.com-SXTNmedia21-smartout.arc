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
  isDark: boolean;
};

export function YearNavigation({ currentYear, onYearChange, isDark }: YearNavigationProps) {
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
        className={`rounded-lg p-2 transition-colors ${
          isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"
        }`}
        aria-label={`Navigate to ${prevYear}`}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex items-baseline gap-4">
        <button
          onClick={() => onYearChange(prevYear)}
          className={`font-heading text-lg transition-colors ${
            isDark ? "text-zinc-600 hover:text-zinc-400" : "text-zinc-400 hover:text-zinc-600"
          }`}
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
            className={`font-heading text-3xl font-semibold ${
              isDark ? "text-white" : "text-zinc-900"
            }`}
            aria-live="polite"
          >
            {currentYear}
          </motion.span>
        </AnimatePresence>

        <button
          onClick={() => onYearChange(nextYear)}
          className={`font-heading text-lg transition-colors ${
            isDark ? "text-zinc-600 hover:text-zinc-400" : "text-zinc-400 hover:text-zinc-600"
          }`}
        >
          {nextYear}
        </button>
      </div>

      <button
        onClick={() => onYearChange(nextYear)}
        className={`rounded-lg p-2 transition-colors ${
          isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"
        }`}
        aria-label={`Navigate to ${nextYear}`}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {currentYear !== todayYear && (
        <button
          onClick={() => onYearChange(todayYear)}
          className={`ml-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            isDark
              ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          I dag
        </button>
      )}
    </nav>
  );
}
