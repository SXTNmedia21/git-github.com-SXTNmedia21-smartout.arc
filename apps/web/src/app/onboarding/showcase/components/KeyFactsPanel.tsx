"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useOnboarding } from "../WizardContext";

const EASE = [0.16, 1, 0.3, 1] as const;

export function KeyFactsPanel() {
  const { activeSection, memories, removeMemory } = useOnboarding();

  const visible = activeSection !== "hero" && memories.length > 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-20 left-6 z-40 hidden max-w-[240px] flex-col gap-2 rounded-2xl border border-white/[0.06] bg-black/60 p-4 shadow-2xl backdrop-blur-xl sm:flex"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className="font-mono text-[10px] tracking-widest text-white/30 uppercase">
            Botsson husker
          </p>

          <AnimatePresence initial={false}>
            {memories.map((memory) => (
              <motion.div
                key={memory.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16, height: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="group flex items-start gap-2"
              >
                <p className="flex-1 text-sm leading-snug text-white/70">{memory.content}</p>
                <button
                  type="button"
                  onClick={() => removeMemory(memory.id)}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white/0 transition-colors group-hover:text-white/40 hover:!text-white/70"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
