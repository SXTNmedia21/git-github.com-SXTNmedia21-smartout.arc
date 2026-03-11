"use client";

import { motion } from "framer-motion";
import { ChoiceCard } from "../primitives/ChoiceCard";
import { ContinueButton } from "../primitives/ContinueButton";
import { TemplateText } from "../primitives/TemplateText";
import type { TakeSlideConfig, ChoiceOption } from "../types";

interface TakeSlideProps {
  config: TakeSlideConfig;
  context: Record<string, string>;
  selected: string[];
  onToggle: (optionId: string) => void;
  onContinue: () => void;
  renderIcon?: (iconName: string) => React.ReactNode;
}

const cardStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.4 },
  },
};

const cardFadeUp = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

export function TakeSlide({
  config,
  context,
  selected,
  onToggle,
  onContinue,
  renderIcon,
}: TakeSlideProps) {
  const hasSelection = selected.length > 0;

  // Responsive grid: 2 cols default, 3 for 5-6 options, 4 for 7+
  const colClass =
    config.options.length <= 4
      ? "grid-cols-2"
      : config.options.length <= 6
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="flex w-full max-w-3xl flex-col items-center gap-10">
        {/* Question */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <TemplateText
            template={config.question}
            context={context}
            as="h2"
            className="text-2xl leading-[1.2] tracking-tight text-[var(--foreground)] sm:text-4xl"
            style={{ fontFamily: "var(--font-heading, serif)" }}
          />
          {config.multi && (
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Velg en eller flere
            </p>
          )}
        </motion.div>

        {/* Choice grid */}
        <motion.div
          className={`grid w-full gap-3 ${colClass}`}
          variants={cardStagger}
          initial="hidden"
          animate="visible"
        >
          {config.options.map((option: ChoiceOption) => (
            <motion.div key={option.id} variants={cardFadeUp}>
              <ChoiceCard
                label={option.label}
                icon={
                  option.icon && renderIcon ? renderIcon(option.icon) : undefined
                }
                description={option.description}
                selected={selected.includes(option.id)}
                onSelect={() => onToggle(option.id)}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Continue */}
        <ContinueButton enabled={hasSelection} onClick={onContinue} />
      </div>
    </div>
  );
}
