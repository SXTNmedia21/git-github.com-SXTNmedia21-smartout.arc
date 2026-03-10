"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// UI Events:
// - action: finale animation plays (~2s) then triggers onComplete callback
// - No interactive surfaces — purely visual transition

/**
 * FinaleOverlay — celebratory exit animation for onboarding completion.
 *
 * Sequence:
 * 1. (0ms)    Card contracts slightly via parent scale
 * 2. (0ms)    Warm glow pulse expands from center
 * 3. (200ms)  Light streaks converge toward center
 * 4. (800ms)  Full screen fades to warm brand color
 * 5. (2000ms) onComplete fires — parent handles redirect
 *
 * Design: Scandinavian — warm, confident, not flashy.
 * "Closing a book and opening a new chapter."
 */

type FinaleOverlayProps = {
  active: boolean;
  onComplete: () => void;
};

/** 8 light streaks converging from edges toward center */
const STREAK_COUNT = 8;
const streaks = Array.from({ length: STREAK_COUNT }, (_, i) => {
  const angle = (i / STREAK_COUNT) * 360;
  const rad = (angle * Math.PI) / 180;
  // Start far from center, converge to center
  const startX = Math.cos(rad) * 120; // vw-scale offset
  const startY = Math.sin(rad) * 120;
  const height = 40 + Math.random() * 20;
  return { angle, startX, startY, delay: 0.15 + i * 0.04, height };
});

export function FinaleOverlay({ active, onComplete }: FinaleOverlayProps) {
  const [phase, setPhase] = useState<"idle" | "glow" | "streaks" | "fade">("idle");

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      return;
    }

    // Phase 1: Glow expands immediately
    setPhase("glow");

    // Phase 2: Streaks converge
    const streakTimer = setTimeout(() => setPhase("streaks"), 200);

    // Phase 3: Full warm fade
    const fadeTimer = setTimeout(() => setPhase("fade"), 900);

    // Phase 4: Complete — trigger redirect
    const completeTimer = setTimeout(() => onComplete(), 2100);

    return () => {
      clearTimeout(streakTimer);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          aria-hidden="true"
        >
          {/* Central warm glow pulse */}
          <motion.div
            className="absolute top-1/2 left-1/2 rounded-full"
            initial={{
              width: 0,
              height: 0,
              marginLeft: 0,
              marginTop: 0,
              opacity: 0,
            }}
            animate={
              phase !== "idle"
                ? {
                    width: 800,
                    height: 800,
                    marginLeft: -400,
                    marginTop: -400,
                    opacity: [0, 0.4, 0.25],
                  }
                : undefined
            }
            transition={{
              duration: 1.2,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{
              background:
                "radial-gradient(circle, oklch(0.70 0.16 55) 0%, oklch(0.55 0.12 45 / 0.5) 40%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />

          {/* Converging light streaks */}
          {(phase === "streaks" || phase === "fade") &&
            streaks.map((streak, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2"
                initial={{
                  x: streak.startX,
                  y: streak.startY,
                  opacity: 0,
                  scale: 1,
                }}
                animate={{
                  x: 0,
                  y: 0,
                  opacity: [0, 0.6, 0],
                  scale: [1, 0.3],
                }}
                transition={{
                  duration: 0.8,
                  delay: streak.delay,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  width: 3,
                  height: streak.height,
                  marginLeft: -1.5,
                  marginTop: -20,
                  background: "linear-gradient(to bottom, oklch(0.85 0.12 55 / 0.8), transparent)",
                  borderRadius: 2,
                  transform: `rotate(${streak.angle + 90}deg)`,
                  filter: "blur(1px)",
                }}
              />
            ))}

          {/* Full screen warm fade — the "closing the book" moment */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={phase === "fade" ? { opacity: 1 } : { opacity: 0 }}
            transition={{
              duration: 1.0,
              ease: [0.25, 0.1, 0.25, 1.0],
            }}
            style={{
              background:
                "radial-gradient(ellipse at center, oklch(0.18 0.04 55), oklch(0.10 0.02 50))",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
