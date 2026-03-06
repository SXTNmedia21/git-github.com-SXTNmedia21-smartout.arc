"use client";

import { useState, useEffect, useCallback } from "react";
import type { OnboardingSection } from "../types";
import { ONBOARDING_SECTIONS } from "../types";

interface ScrollProgress {
  activeSection: OnboardingSection;
  sectionIndex: number;
  progress: number;
  totalProgress: number;
  scrollToSection: (section: OnboardingSection) => void;
}

export function useScrollProgress(
  containerRef: React.RefObject<HTMLElement | null>,
): ScrollProgress {
  const [activeSection, setActiveSection] = useState<OnboardingSection>("hero");

  const sectionIndex = ONBOARDING_SECTIONS.indexOf(activeSection);
  const totalProgress = Math.min(1, (sectionIndex + 1) / ONBOARDING_SECTIONS.length);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const sectionId = entry.target.getAttribute("data-section") as OnboardingSection;
            if (sectionId && ONBOARDING_SECTIONS.includes(sectionId)) {
              setActiveSection(sectionId);
            }
          }
        }
      },
      {
        root: container,
        threshold: [0.5],
      },
    );

    const sections = container.querySelectorAll("[data-section]");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [containerRef]);

  const scrollToSection = useCallback(
    (section: OnboardingSection) => {
      const container = containerRef.current;
      if (!container) return;
      const target = container.querySelector(`[data-section="${section}"]`);
      target?.scrollIntoView({ behavior: "smooth" });
    },
    [containerRef],
  );

  return {
    activeSection,
    sectionIndex,
    progress: 0,
    totalProgress,
    scrollToSection,
  };
}
