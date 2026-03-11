"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface ContinueButtonProps {
  enabled: boolean;
  onClick: () => void;
  label?: string;
}

export function ContinueButton({
  enabled,
  onClick,
  label = "Neste",
}: ContinueButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: enabled ? 1 : 0.35,
        y: enabled ? 0 : 12,
      }}
      whileHover={enabled ? { scale: 1.03 } : undefined}
      whileTap={enabled ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-[0.875rem] font-semibold",
        "transition-[background-color,box-shadow] duration-200",
        "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40",
        enabled
          ? "bg-[var(--brand-orange)] text-white shadow-[0_2px_16px_oklch(0.65_0.22_40/0.3)] hover:shadow-[0_6px_24px_oklch(0.65_0.22_40/0.4)]"
          : "cursor-not-allowed bg-[var(--muted)] text-[var(--muted-foreground)]",
      )}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </motion.button>
  );
}
