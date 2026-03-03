"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  staggerDelay = 400,
  onComplete,
}: DataMaterializerProps) {
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
            initial={{ opacity: 0, x: -20, filter: "blur(8px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{
              duration: 0.5,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3"
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
