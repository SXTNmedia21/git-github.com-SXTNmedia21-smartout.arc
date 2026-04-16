"use client";

import { motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import type { ComponentType, ReactNode } from "react";

/**
 * Entrance — wraps any element with the canonical Nordic Split content-swap
 * spring. Use to soften the abrupt swap that `next/dynamic` performs when a
 * deferred chunk resolves and the real component takes over from its skeleton.
 *
 * Spring: `springSnappy` (stiffness 45, damping 24, mass 2) per
 * docs/design/motion.md. Same spring as SkeletonEntrance content phase.
 */
export function Entrance({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", ...motionTokens.springSnappy }}
    >
      {children}
    </motion.div>
  );
}

/**
 * withEntrance — HOC that wraps a component in `<Entrance>`. Apply at the
 * `next/dynamic` resolution boundary so the real component animates in
 * instead of snapping when its chunk lands.
 *
 * Pattern:
 *   const HeavyEditor = dynamic(
 *     () => import("./heavy-editor").then((m) => ({
 *       default: withEntrance(m.HeavyEditor),
 *     })),
 *     { ssr: false, loading: () => <EditorSkeleton /> },
 *   );
 */
export function withEntrance<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  function EntranceWrapped(props: P) {
    return (
      <Entrance>
        <Component {...props} />
      </Entrance>
    );
  }
  EntranceWrapped.displayName = `withEntrance(${Component.displayName ?? Component.name ?? "Component"})`;
  return EntranceWrapped;
}
