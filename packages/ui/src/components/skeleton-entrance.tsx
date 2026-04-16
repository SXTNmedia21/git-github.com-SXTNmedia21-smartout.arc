"use client";

import { AnimatePresence, motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import type { ReactNode } from "react";

/**
 * SkeletonEntrance — wraps the handoff from skeleton to real content with
 * the canonical Nordic Split spring.
 *
 * Uses `springSnappy` from design-tokens (stiffness 45, damping 24, mass 2)
 * — the content-swap spring per docs/design/motion.md. Prevents the abrupt
 * pop-in that `next/dynamic` + Suspense boundaries introduce when the real
 * component's DOM materializes instantly as the JS chunk resolves.
 *
 * Pattern:
 *   <SkeletonEntrance
 *     isLoading={!editor}
 *     skeleton={<ContractEditorSkeleton />}
 *   >
 *     <RichContractEditor />
 *   </SkeletonEntrance>
 *
 * Entrance motion: opacity 0 + y:4 → opacity 1 + y:0.
 * Exit motion: opacity 1 → 0 (skeleton fades as content enters).
 */
export function SkeletonEntrance({
  isLoading,
  skeleton,
  children,
}: {
  isLoading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", ...motionTokens.springSnappy }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
