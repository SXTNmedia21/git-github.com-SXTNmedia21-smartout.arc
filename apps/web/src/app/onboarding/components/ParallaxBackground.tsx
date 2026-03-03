"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import type { OnboardingSection } from "../types";

const SECTION_COLORS: Record<OnboardingSection, string> = {
  hero: "var(--color-onboarding-hero)",
  business: "var(--color-onboarding-business)",
  season: "var(--color-onboarding-season)",
  departments: "var(--color-onboarding-departments)",
  contract: "var(--color-onboarding-contract)",
  done: "var(--color-onboarding-done)",
};

interface ParallaxBackgroundProps {
  section: OnboardingSection;
  containerRef: React.RefObject<HTMLElement | null>;
}

export function ParallaxBackground({ section, containerRef }: ParallaxBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    container: containerRef,
    offset: ["start end", "end start"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"]);
  const y2 = useTransform(scrollYProgress, [0, 1], ["0%", "-35%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        backgroundColor: SECTION_COLORS[section],
        contain: "layout style paint",
      }}
    >
      <motion.div
        className="absolute h-[600px] w-[600px] rounded-full"
        style={{
          y: y1,
          opacity,
          background: "radial-gradient(circle, var(--color-onboarding-glow) 0%, transparent 70%)",
          filter: "blur(80px)",
          top: "10%",
          right: "-10%",
          willChange: "transform",
        }}
      />
      <motion.div
        className="absolute h-[400px] w-[400px] rounded-full"
        style={{
          y: y2,
          opacity,
          background: "radial-gradient(circle, oklch(0.6 0.1 200) 0%, transparent 70%)",
          filter: "blur(90px)",
          bottom: "20%",
          left: "-5%",
          willChange: "transform",
        }}
      />
      {/* Noise texture removed — feTurbulence SVG filter costs ~2ms/frame per section */}
    </div>
  );
}
