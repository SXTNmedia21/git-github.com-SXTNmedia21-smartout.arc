"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { EASE_EXPO } from "../lib/motion";
import { TypewriterText } from "./TypewriterText";

interface DataField {
  icon: string;
  label: string;
  value: string;
}

interface DataMaterializerProps {
  fields: DataField[];
  staggerDelay?: number;
  onComplete?: () => void;
}

export function DataMaterializer({
  fields,
  staggerDelay = 550,
  onComplete,
}: DataMaterializerProps) {
  const prefersReducedMotion = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= fields.length) {
      onComplete?.();
      return;
    }

    const timeout = setTimeout(() => {
      setVisibleCount((c) => c + 1);
    }, staggerDelay);

    return () => clearTimeout(timeout);
  }, [visibleCount, fields.length, staggerDelay, onComplete]);

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {fields.slice(0, visibleCount).map((field, i) => (
          <motion.div
            key={field.label}
            initial={prefersReducedMotion ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.8,
              ease: EASE_EXPO,
            }}
            className="flex items-center gap-3 rounded-lg border border-white/[0.03] bg-white/[0.03] px-4 py-3"
          >
            <span className="text-lg">{field.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] tracking-widest text-white/30 uppercase">
                {field.label}
              </div>
              <div className="font-mono text-sm text-white/90">
                <TypewriterText text={field.value} speed={20} cursor={i === visibleCount - 1} />
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
