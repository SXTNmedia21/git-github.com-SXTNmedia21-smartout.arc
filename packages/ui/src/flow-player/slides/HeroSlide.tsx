"use client";

import { motion } from "framer-motion";
import { TemplateText } from "../primitives/TemplateText";
import type { HeroSlideConfig } from "../types";

interface HeroSlideProps {
  config: HeroSlideConfig;
  context: Record<string, string>;
  onContinue: () => void;
}

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.35, delayChildren: 0.4 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] as const },
  },
} as const;

function resolveTemplate(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => ctx[key] ?? "");
}

export function HeroSlide({ config, context, onContinue }: HeroSlideProps) {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden px-6">
      {/* Ambient warm orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-[30%] left-1/2 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full opacity-40"
          style={{
            background: "radial-gradient(circle, oklch(0.85 0.08 55) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute -right-[15%] bottom-[10%] h-[40vh] w-[40vh] rounded-full opacity-25"
          style={{
            background: "radial-gradient(circle, oklch(0.80 0.06 40) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* Background image */}
      {config.background?.type === "image" && (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.08]"
          style={{
            backgroundImage: `url(${resolveTemplate(config.background.src, context)})`,
          }}
        />
      )}

      {/* Background gradient */}
      {config.background?.type === "gradient" && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: config.background.src }}
        />
      )}

      <motion.div
        className="relative z-10 flex max-w-2xl flex-col items-center gap-5 text-center"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeUp}>
          <TemplateText
            template={config.title}
            context={context}
            as="h1"
            className="text-4xl leading-[1.12] tracking-tight text-[var(--foreground)] sm:text-6xl"
            style={{ fontFamily: "var(--font-heading, serif)" }}
          />
        </motion.div>

        {config.subtitle && (
          <motion.div variants={fadeUp}>
            <TemplateText
              template={config.subtitle}
              context={context}
              as="p"
              className="max-w-md text-lg leading-relaxed text-[var(--muted-foreground)]"
            />
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <motion.button
            type="button"
            onClick={onContinue}
            className="mt-6 rounded-full border border-[var(--border)] bg-[var(--card)] px-8 py-3 text-sm font-medium text-[var(--muted-foreground)] shadow-sm transition-all hover:border-[var(--brand-orange)]/30 hover:text-[var(--foreground)] hover:shadow-md"
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Trykk for å fortsette
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
