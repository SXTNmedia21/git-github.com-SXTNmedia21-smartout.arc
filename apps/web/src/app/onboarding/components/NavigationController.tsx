"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useOnboarding } from "../WizardContext";
import { ONBOARDING_SECTIONS, VISIBLE_SECTIONS, type OnboardingSection } from "../types";

const SECTION_LABELS: Record<OnboardingSection, string> = {
  hero: "Start",
  business: "Bedrift",
  season: "Sesong",
  departments: "Avdelinger",
  locations: "Lokasjoner",
  procedures: "Prosedyrer",
  contract: "Kontrakt",
  welcome: "Velkommen",
};

export function NavigationController() {
  const { activeSection, sectionIndex, scrollToSection } = useOnboarding();

  const isFirst = sectionIndex === 0;
  const isLast = sectionIndex === VISIBLE_SECTIONS.length - 1;

  const goPrev = () => {
    const prev = VISIBLE_SECTIONS[sectionIndex - 1];
    if (prev) scrollToSection(prev);
  };

  const goNext = () => {
    const next = VISIBLE_SECTIONS[sectionIndex + 1];
    if (next) scrollToSection(next);
  };

  return (
    <div className="fixed top-6 left-6 z-50 hidden items-center gap-1 rounded-full border border-white/[0.06] bg-black/60 px-2 py-1.5 shadow-2xl backdrop-blur-xl sm:flex">
      {/* Prev button */}
      <button
        type="button"
        onClick={goPrev}
        disabled={isFirst}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white/90 disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Section label */}
      <span className="min-w-[80px] text-center font-mono text-xs tracking-wide text-white/60 select-none">
        {SECTION_LABELS[activeSection]}{" "}
        <span className="text-white/30">
          {sectionIndex + 1}/{VISIBLE_SECTIONS.length}
        </span>
      </span>

      {/* Next button */}
      <button
        type="button"
        onClick={goNext}
        disabled={isLast}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white/90 disabled:pointer-events-none disabled:opacity-0"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Divider */}
      <div className="mx-1 h-4 w-px bg-white/[0.08]" />

      {/* Exit — always visible */}
      <Link
        href="/dashboard"
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
        title="Gå til dashboard"
      >
        <X className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
