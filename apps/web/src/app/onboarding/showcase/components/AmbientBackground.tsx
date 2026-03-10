"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useOnboarding } from "../WizardContext";
import type { OnboardingSection } from "../types";

// UI Events:
// - color-regime: section-based (each section shifts orb positions, hues, and scale)
// - No interactive surfaces — purely decorative

/**
 * Per-section ambient orb configuration.
 * Each section defines positions, glow colors, and scale for 3 orbs.
 * Colors stay within warm brand OKLCH range (hues 30-280).
 * Transitions are slow (1.5s) to feel like "the room changes mood."
 */
type OrbConfig = {
  x: string;
  y: string;
  scale: number;
  color: string;
  size: number;
  blur: number;
};

type SectionAmbience = {
  orbs: [OrbConfig, OrbConfig, OrbConfig];
};

const SECTION_AMBIENCE: Record<OnboardingSection, SectionAmbience> = {
  hero: {
    orbs: [
      { x: "70%", y: "15%", scale: 1.0, color: "oklch(0.55 0.12 250)", size: 500, blur: 100 },
      { x: "-5%", y: "60%", scale: 0.9, color: "oklch(0.45 0.08 200)", size: 350, blur: 90 },
      { x: "50%", y: "85%", scale: 0.7, color: "oklch(0.50 0.10 280)", size: 300, blur: 80 },
    ],
  },
  business: {
    orbs: [
      { x: "65%", y: "20%", scale: 1.1, color: "oklch(0.60 0.14 55)", size: 550, blur: 110 },
      { x: "-8%", y: "50%", scale: 0.8, color: "oklch(0.50 0.10 40)", size: 400, blur: 95 },
      { x: "40%", y: "80%", scale: 0.6, color: "oklch(0.45 0.08 70)", size: 280, blur: 85 },
    ],
  },
  departments: {
    orbs: [
      { x: "75%", y: "25%", scale: 1.0, color: "oklch(0.55 0.10 150)", size: 480, blur: 100 },
      { x: "-3%", y: "45%", scale: 1.0, color: "oklch(0.48 0.08 160)", size: 380, blur: 90 },
      { x: "35%", y: "90%", scale: 0.7, color: "oklch(0.42 0.06 140)", size: 320, blur: 80 },
    ],
  },
  locations: {
    orbs: [
      { x: "60%", y: "10%", scale: 1.05, color: "oklch(0.52 0.10 180)", size: 520, blur: 105 },
      { x: "-10%", y: "55%", scale: 0.85, color: "oklch(0.46 0.08 190)", size: 370, blur: 90 },
      { x: "45%", y: "75%", scale: 0.75, color: "oklch(0.50 0.09 170)", size: 300, blur: 85 },
    ],
  },
  procedures: {
    orbs: [
      { x: "72%", y: "18%", scale: 0.95, color: "oklch(0.50 0.10 220)", size: 500, blur: 100 },
      { x: "-6%", y: "65%", scale: 0.9, color: "oklch(0.44 0.08 230)", size: 360, blur: 90 },
      { x: "30%", y: "85%", scale: 0.8, color: "oklch(0.48 0.07 210)", size: 340, blur: 85 },
    ],
  },
  season: {
    orbs: [
      { x: "68%", y: "22%", scale: 1.15, color: "oklch(0.62 0.15 35)", size: 560, blur: 115 },
      { x: "-4%", y: "48%", scale: 0.85, color: "oklch(0.52 0.12 45)", size: 400, blur: 95 },
      { x: "42%", y: "78%", scale: 0.65, color: "oklch(0.48 0.10 30)", size: 300, blur: 80 },
    ],
  },
  contract: {
    orbs: [
      { x: "62%", y: "12%", scale: 0.9, color: "oklch(0.48 0.08 280)", size: 460, blur: 100 },
      { x: "-7%", y: "58%", scale: 0.95, color: "oklch(0.42 0.06 260)", size: 340, blur: 85 },
      { x: "48%", y: "82%", scale: 0.7, color: "oklch(0.45 0.07 290)", size: 280, blur: 80 },
    ],
  },
  welcome: {
    orbs: [
      { x: "55%", y: "20%", scale: 1.2, color: "oklch(0.65 0.16 55)", size: 600, blur: 120 },
      { x: "-2%", y: "40%", scale: 1.0, color: "oklch(0.55 0.12 45)", size: 420, blur: 100 },
      { x: "38%", y: "70%", scale: 0.85, color: "oklch(0.58 0.14 65)", size: 360, blur: 90 },
    ],
  },
};

const orbTransition = {
  duration: 1.8,
  ease: [0.25, 0.1, 0.25, 1.0] as const,
};

export function AmbientBackground() {
  const { activeSection } = useOnboarding();

  const ambience = useMemo(() => SECTION_AMBIENCE[activeSection], [activeSection]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ contain: "layout style paint" }}
      aria-hidden="true"
    >
      {/* Noise overlay to prevent color banding (dithering) */}
      <div className="bg-noise pointer-events-none absolute inset-0 z-10 h-full w-full opacity-[0.03] mix-blend-overlay" />

      {ambience.orbs.map((orb, i) => {
        const driftClass = [
          `animate-onboarding-drift-1`,
          `animate-onboarding-drift-2`,
          `animate-onboarding-drift-3`,
        ][i];
        return (
          <div key={i} className={`absolute inset-0 ${driftClass}`}>
            <motion.div
              className="absolute rounded-full"
              animate={{
                left: orb.x,
                top: orb.y,
                scale: orb.scale,
                opacity: 0.12,
              }}
              transition={orbTransition}
              style={{
                width: orb.size,
                height: orb.size,
                background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                filter: `blur(${orb.blur}px)`,
                willChange: "transform, left, top",
                marginLeft: -orb.size / 2,
                marginTop: -orb.size / 2,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
