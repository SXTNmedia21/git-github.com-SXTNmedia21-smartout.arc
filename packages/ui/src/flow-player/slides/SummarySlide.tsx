"use client";

import { motion } from "framer-motion";
import { TemplateText } from "../primitives/TemplateText";
import type { SummarySlideConfig, SummaryAction } from "../types";
import { cn } from "../../lib/utils";

interface SummarySlideProps {
  config: SummarySlideConfig;
  context: Record<string, string>;
  answers: Record<string, string | string[]>;
  onAction: (actionKey: string) => void;
}

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.3, delayChildren: 0.35 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.0, ease: [0.16, 1, 0.3, 1] as const },
  },
} as const;

export function SummarySlide({ config, context, onAction }: SummarySlideProps) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute top-1/3 left-1/2 h-[50vh] w-[50vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, oklch(0.80 0.10 50) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      <motion.div
        className="relative z-10 flex w-full max-w-xl flex-col items-center gap-8 text-center"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeUp}>
          <TemplateText
            template={config.title}
            context={context}
            as="h2"
            className="text-4xl leading-[1.1] tracking-tight text-[var(--foreground)] sm:text-5xl"
            style={{ fontFamily: "var(--font-heading, serif)" }}
          />
        </motion.div>

        {config.body && (
          <motion.div variants={fadeUp}>
            <TemplateText
              template={config.body}
              context={context}
              as="p"
              className="max-w-md text-lg leading-relaxed text-[var(--muted-foreground)]"
            />
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          variants={fadeUp}
          className="flex w-full flex-col gap-3 pt-2 sm:flex-row sm:justify-center sm:gap-4"
        >
          {config.actions.map((action: SummaryAction) => (
            <motion.button
              key={action.key}
              type="button"
              onClick={() => onAction(action.key)}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "rounded-xl px-8 py-3.5 text-sm font-semibold transition-all duration-200",
                action.variant === "primary"
                  ? "bg-[var(--brand-orange)] text-white shadow-[0_2px_16px_oklch(0.65_0.22_40/0.3)] hover:shadow-[0_6px_24px_oklch(0.65_0.22_40/0.4)]"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--accent)]",
              )}
            >
              {action.label}
            </motion.button>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
