"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface ChoiceCardProps {
  label: string;
  icon?: React.ReactNode;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}

export function ChoiceCard({ label, icon, description, selected, onSelect }: ChoiceCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 500, damping: 30 } }}
      whileTap={{ scale: 0.97 }}
      animate={selected ? { scale: [1, 0.97, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative flex w-full flex-col items-center gap-3 rounded-2xl border-2 px-5 py-7 text-center",
        "transition-[border-color,background-color,box-shadow] duration-300 ease-out",
        "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40",
        selected
          ? "border-[var(--brand-orange)]/50 bg-[var(--brand-orange)]/[0.04] shadow-[0_4px_24px_-4px_oklch(0.65_0.22_40/0.15)]"
          : "border-[var(--border)] bg-[var(--card)] shadow-sm hover:border-[var(--border)]/80 hover:shadow-md",
      )}
    >
      {/* Selection check */}
      <motion.div
        className="absolute top-2.5 right-2.5"
        initial={false}
        animate={selected ? { scale: 1, opacity: 1 } : { scale: 0.3, opacity: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
      >
        <div className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[var(--brand-orange)] shadow-[0_2px_8px_oklch(0.65_0.22_40/0.3)]">
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        </div>
      </motion.div>

      {/* Icon */}
      {icon && (
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300",
            selected
              ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
              : "bg-[var(--muted)] text-[var(--muted-foreground)] group-hover:bg-[var(--muted)]/80",
          )}
        >
          {icon}
        </div>
      )}

      {/* Label */}
      <span
        className={cn(
          "text-[0.8125rem] leading-tight font-semibold transition-colors duration-300",
          selected ? "text-[var(--foreground)]" : "text-[var(--foreground)]/80",
        )}
      >
        {label}
      </span>

      {/* Description */}
      {description && (
        <span className="text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
          {description}
        </span>
      )}
    </motion.button>
  );
}
