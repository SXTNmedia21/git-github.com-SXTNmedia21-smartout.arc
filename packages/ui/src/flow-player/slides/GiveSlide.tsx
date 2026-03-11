"use client";

import { motion } from "framer-motion";
import { TemplateText } from "../primitives/TemplateText";
import type { GiveSlideConfig } from "../types";

interface GiveSlideProps {
  config: GiveSlideConfig;
  context: Record<string, string>;
  onContinue: () => void;
}

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.3, delayChildren: 0.25 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.0, ease: [0.16, 1, 0.3, 1] },
  },
};

function resolveTemplate(
  template: string,
  ctx: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => ctx[key] ?? "");
}

export function GiveSlide({ config, context, onContinue }: GiveSlideProps) {
  const isSplit = config.layout === "split" && config.media;

  if (isSplit) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex w-full max-w-4xl items-center gap-12 lg:gap-16">
          {/* Media */}
          <motion.div
            className="hidden flex-1 md:block"
            initial={{ opacity: 0, x: -24, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {config.media?.type === "image" && (
              <img
                src={resolveTemplate(config.media.src, context)}
                alt={config.media.alt ?? ""}
                className="w-full rounded-2xl object-cover shadow-[0_8px_40px_-8px_rgba(0,0,0,0.1)]"
              />
            )}
          </motion.div>

          {/* Text */}
          <motion.div
            className="flex flex-1 flex-col gap-5"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeUp}>
              <TemplateText
                template={config.title}
                context={context}
                as="h2"
                className="text-3xl leading-[1.1] tracking-tight text-[var(--foreground)] sm:text-4xl"
                style={{ fontFamily: "var(--font-heading, serif)" }}
              />
            </motion.div>
            <motion.div variants={fadeUp}>
              <TemplateText
                template={config.body}
                context={context}
                as="p"
                className="text-[1.0625rem] leading-[1.7] text-[var(--muted-foreground)]"
              />
            </motion.div>
            <motion.div variants={fadeUp}>
              <motion.button
                type="button"
                onClick={onContinue}
                className="mt-2 w-fit text-sm text-[var(--muted-foreground)]/60 transition-colors hover:text-[var(--muted-foreground)]"
                whileHover={{ x: 4 }}
              >
                Fortsett →
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Center layout
  return (
    <div className="flex h-full items-center justify-center px-6">
      <motion.div
        className="flex max-w-2xl flex-col items-center gap-6 text-center"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {config.media?.type === "image" && (
          <motion.img
            variants={fadeUp}
            src={resolveTemplate(config.media.src, context)}
            alt={config.media.alt ?? ""}
            className="h-40 w-40 rounded-2xl object-cover shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)]"
          />
        )}
        <motion.div variants={fadeUp}>
          <TemplateText
            template={config.title}
            context={context}
            as="h2"
            className="text-3xl leading-[1.1] tracking-tight text-[var(--foreground)] sm:text-5xl"
            style={{ fontFamily: "var(--font-heading, serif)" }}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <TemplateText
            template={config.body}
            context={context}
            as="p"
            className="max-w-lg text-[1.0625rem] leading-[1.7] text-[var(--muted-foreground)]"
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <motion.button
            type="button"
            onClick={onContinue}
            className="mt-4 rounded-full border border-[var(--border)] bg-[var(--card)] px-8 py-3 text-sm font-medium text-[var(--muted-foreground)] shadow-sm transition-all hover:border-[var(--brand-orange)]/30 hover:text-[var(--foreground)] hover:shadow-md"
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Fortsett
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
