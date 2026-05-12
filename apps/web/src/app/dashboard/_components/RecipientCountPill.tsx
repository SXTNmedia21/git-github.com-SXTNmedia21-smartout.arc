"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { motion, useReducedMotion } from "framer-motion";

type RecipientCountPillProps = {
  count: number;
};

const BUMP_SPRING = { type: "spring" as const, stiffness: 45, damping: 24, mass: 2 };

/**
 * RecipientCountPill — shared count pill with springSnappy bump on count change.
 *
 * Used inside compose flows that resolve an audience to a recipient list.
 * aria-live="polite" so screen readers announce count changes when the user
 * switches audience selection. Respects prefers-reduced-motion.
 *
 * Element is a <span> (inline) so it composes inside label rows without
 * breaking text-flow.
 *
 * i18n: uses flat _one/_other keys — @smartout/i18n translator does NOT
 * support ICU {count, plural}. Branch is handled in this component.
 */
export function RecipientCountPill({ count }: RecipientCountPillProps) {
  const { t } = useTranslation("komm");
  const reduce = useReducedMotion();
  const [bump, setBump] = useState(false);
  const lastN = useRef(count);

  useEffect(() => {
    if (reduce) return;
    if (lastN.current !== count) {
      lastN.current = count;
      setBump(true);
      const id = setTimeout(() => setBump(false), 420);
      return () => clearTimeout(id);
    }
  }, [count, reduce]);

  // @smartout/i18n single-brace; pick singular/plural key in code
  const labelKey =
    count === 1 ? "nyheter.recipient_count_pill_one" : "nyheter.recipient_count_pill_other";

  return (
    <span
      data-tone={count === 0 ? "muted" : "brand"}
      data-bump={bump}
      aria-live="polite"
      aria-atomic="true"
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 transition-colors ${
        count === 0 ? "bg-muted border-border" : "bg-primary/10 border-primary/20"
      }`}
    >
      <Users className="text-muted-foreground h-4 w-4" aria-hidden="true" />
      <motion.span
        animate={bump && !reduce ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={reduce ? { duration: 0 } : BUMP_SPRING}
        className="font-mono text-base font-black tabular-nums"
        aria-hidden="true"
      >
        {count}
      </motion.span>
      <span className="text-foreground/80 text-sm">{t(labelKey, { count })}</span>
    </span>
  );
}
