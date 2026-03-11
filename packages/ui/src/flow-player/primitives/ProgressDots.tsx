"use client";

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface ProgressDotsProps {
  total: number;
  current: number;
}

export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-1.5" role="navigation" aria-label="Slide progress">
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === current;
        const isPast = i < current;

        return (
          <motion.div
            key={i}
            className={cn(
              "h-1.5 rounded-full",
              isActive
                ? "bg-[var(--brand-orange)]"
                : isPast
                  ? "bg-[var(--brand-orange)]/25"
                  : "bg-[var(--border)]",
            )}
            animate={{ width: isActive ? 28 : 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            aria-current={isActive ? "step" : undefined}
          />
        );
      })}
    </div>
  );
}
