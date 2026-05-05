"use client";

/**
 * DoneStep.tsx — Step 6
 *
 * Completion screen. Sets profile.is_welcome_complete=true, then
 * auto-advances after 2.5 s or on manual CTA click.
 * Refreshes the page to let the layout re-check is_welcome_complete
 * and unmount the wizard.
 */

import { useEffect, useState, useTransition } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { completeWelcome } from "@/app/dashboard/_actions/welcome-wizard-actions";

const SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 };

export function DoneStep() {
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);

  // Mark welcome complete on mount (fire-and-forget, then refresh)
  useEffect(() => {
    startTransition(async () => {
      await completeWelcome();
      setCompleted(true);
    });
  }, []);

  // Auto-advance after 2.5 s once marked complete
  useEffect(() => {
    if (!completed) return;
    const t = setTimeout(() => {
      window.location.reload();
    }, 2500);
    return () => clearTimeout(t);
  }, [completed]);

  function handleCta() {
    window.location.reload();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-4 text-center">
      {/* Check icon with spring pop */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.75_0.12_50)] to-[oklch(0.60_0.15_40)]"
      >
        <CircleCheck className="h-9 w-9 text-white" strokeWidth={1.5} />
      </motion.div>

      {/* Copy */}
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-foreground text-3xl">Du er klar!</h2>
        <p className="text-muted-foreground text-base leading-relaxed">
          Velkommen til teamet. <span className="text-foreground">Du blir nå sendt til appen.</span>
        </p>
      </div>

      {/* CTA or spinner */}
      <div className="flex flex-col items-center gap-3">
        {isPending ? (
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        ) : (
          <Button
            size="lg"
            onClick={handleCta}
            className="bg-foreground text-background hover:bg-foreground/90 min-w-[160px]"
          >
            Til Smartout →
          </Button>
        )}
      </div>
    </div>
  );
}
