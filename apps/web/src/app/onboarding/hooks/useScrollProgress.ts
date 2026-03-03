"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const [progress, setProgress] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sectionIndex = ONBOARDING_SECTIONS.indexOf(activeSection);
  const totalProgress = (sectionIndex + progress) / ONBOARDING_SECTIONS.length;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    observerRef.current = new IntersectionObserver(
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
    sections.forEach((section) => observerRef.current?.observe(section));

    return () => observerRef.current?.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, clientHeight } = container;
      const sectionHeight = clientHeight;
      const currentOffset = scrollTop % sectionHeight;
      setProgress(Math.min(currentOffset / sectionHeight, 1));
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
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
    progress,
    totalProgress,
    scrollToSection,
  };
}
