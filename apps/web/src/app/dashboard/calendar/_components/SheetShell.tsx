"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type SheetShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  body: ReactNode;
  footer?: ReactNode;
};

/**
 * Consistent sheet shell for calendar drawers.
 * - Header sticks to top, footer sticks to bottom, body scrolls.
 * - Body fades in with springSnappy entrance once content mounts.
 */
export function SheetShell({
  open,
  onOpenChange,
  title,
  description,
  body,
  footer,
}: SheetShellProps) {
  const reduce = useReducedMotion();
  const entrance = reduce
    ? { initial: false as const, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { type: "spring" as const, ...motionTokens.springSnappy },
      };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-border bg-card/80 space-y-1 border-b px-6 pt-6 pb-4 text-left backdrop-blur-sm">
          <SheetTitle className="font-heading text-xl">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="text-xs">{description}</SheetDescription>
          ) : null}
        </SheetHeader>

        <motion.div {...entrance} className="flex-1 overflow-y-auto px-6 py-5">
          {body}
        </motion.div>

        {footer ? (
          <div className="border-border bg-card/80 border-t px-6 py-4 backdrop-blur-sm">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
