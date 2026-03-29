"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TransitionType } from "../types";

interface SlideTransitionProps {
  slideKey: string | number;
  transition?: TransitionType;
  direction?: 1 | -1;
  children: React.ReactNode;
}

const VARIANTS = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  push: {
    initial: (d: number) => ({ opacity: 0, x: d * 60 }),
    animate: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -60 }),
  },
  reveal: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.04 },
  },
  morph: {
    initial: { opacity: 0, scale: 0.98, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: -8 },
  },
} as const;

export function SlideTransition({
  slideKey,
  transition = "fade",
  direction = 1,
  children,
}: SlideTransitionProps) {
  const v = VARIANTS[transition];

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={slideKey}
        custom={direction}
        initial={typeof v.initial === "function" ? v.initial(direction) : v.initial}
        animate={v.animate}
        exit={typeof v.exit === "function" ? v.exit(direction) : v.exit}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
