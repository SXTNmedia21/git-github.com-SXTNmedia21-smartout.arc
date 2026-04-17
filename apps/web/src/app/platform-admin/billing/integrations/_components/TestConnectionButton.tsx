"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Check, HelpCircle, Loader2, TimerOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { testConnectionActionServer } from "../../_actions/integrations/testConnectionActionServer";

// TestConnectionButton — full Fase 2 micro-interaction from spec §13.
//
// 4 outcomes × 3 visual affordances (icon, ring pulse, message line).
// Spring values match the Nordic Split motion rule (stiffness 35,
// damping 22, mass 2.2). Reduced-motion users get no ring animation
// but keep the icon transition + message.
//
//   ok        → ring expand + Check + toast "Tilkobling OK"
//   error     → amber flash + AlertCircle + inline message
//   ambiguous → neutral ring + HelpCircle + "Uklart resultat — sjekk manuelt"
//   timeout   → neutral ring + TimerOff + "Timeout — prøv igjen"
//
// ADR-0129: placeholder adapters return ok+is_placeholder=true; the
// ok branch surfaces that distinction as a dedicated toast so operators
// don't confuse a mocked probe with a real remote handshake.

type Outcome = "idle" | "pending" | "ok" | "error" | "ambiguous" | "timeout";

type Props = {
  integrationId: string;
};

export function TestConnectionButton({ integrationId }: Props) {
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const prefersReducedMotion = useReducedMotion();

  const reset = () => {
    setOutcome("idle");
    setMessage(null);
  };

  const onClick = () => {
    setOutcome("pending");
    setMessage(null);

    startTransition(async () => {
      const response = await testConnectionActionServer({ integration_id: integrationId });

      if (!response.ok) {
        setOutcome("error");
        setMessage(response.error);
        toast.error(`Tilkobling feilet: ${response.error}`);
        return;
      }

      const probe = response.result;
      switch (probe.status) {
        case "ok":
          setOutcome("ok");
          setMessage(null);
          toast.success(
            probe.is_placeholder
              ? "Tilkobling OK — placeholder (ingen ekstern handling utført)"
              : "Tilkobling OK",
          );
          break;
        case "error":
          setOutcome("error");
          setMessage(probe.message);
          toast.error(`Tilkobling feilet: ${probe.message}`);
          break;
        case "ambiguous":
          setOutcome("ambiguous");
          setMessage(probe.message);
          toast.message("Uklart resultat — sjekk manuelt");
          break;
        case "timeout":
          setOutcome("timeout");
          setMessage("Timeout — prøv igjen");
          toast.error("Timeout — prøv igjen");
          break;
      }

      // Auto-clear the inline message after a beat so repeated clicks
      // aren't stuck in the old-result visual.
      window.setTimeout(reset, 4000);
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClick}
          disabled={pending}
          className={cn(
            "relative z-10 transition-colors",
            outcome === "ok" && "border-primary/50 text-primary",
            outcome === "error" && "border-destructive/50 text-destructive",
          )}
        >
          <OutcomeIcon outcome={outcome} pending={pending} />
          <span className="ml-2">{labelFor(outcome, pending)}</span>
        </Button>

        <AnimatePresence>
          {outcome === "ok" && !prefersReducedMotion ? (
            <motion.span
              aria-hidden
              key="ring-ok"
              className="border-primary pointer-events-none absolute inset-0 rounded-md border"
              initial={{ opacity: 0.8, scale: 1 }}
              animate={{ opacity: 0, scale: 1.25 }}
              transition={{
                type: "spring",
                stiffness: 35,
                damping: 22,
                mass: 2.2,
              }}
            />
          ) : null}
          {outcome === "error" && !prefersReducedMotion ? (
            <motion.span
              aria-hidden
              key="ring-error"
              className="border-destructive pointer-events-none absolute inset-0 rounded-md border"
              initial={{ opacity: 0.7 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            />
          ) : null}
          {outcome === "pending" && !prefersReducedMotion ? (
            <motion.span
              aria-hidden
              key="ring-pending"
              className="border-border pointer-events-none absolute inset-0 rounded-md border"
              initial={{ opacity: 0.4, scale: 1 }}
              animate={{
                opacity: [0.4, 0.8, 0.4],
                scale: [1, 1.03, 1],
              }}
              transition={{
                type: "spring",
                stiffness: 35,
                damping: 22,
                mass: 2.2,
                repeat: Infinity,
                duration: 2.2,
              }}
            />
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {message ? (
          <motion.p
            key={message}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
            className={cn(
              "text-xs",
              outcome === "error" ? "text-destructive" : "text-muted-foreground",
            )}
            role="status"
            aria-live="polite"
          >
            {message}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function OutcomeIcon({ outcome, pending }: { outcome: Outcome; pending: boolean }) {
  if (pending || outcome === "pending") return <Loader2 className="size-4 animate-spin" />;
  switch (outcome) {
    case "ok":
      return <Check className="size-4" />;
    case "error":
      return <AlertCircle className="size-4" />;
    case "ambiguous":
      return <HelpCircle className="size-4" />;
    case "timeout":
      return <TimerOff className="size-4" />;
    default:
      return <Check className="size-4 opacity-0" />;
  }
}

function labelFor(outcome: Outcome, pending: boolean): string {
  if (pending || outcome === "pending") return "Tester…";
  switch (outcome) {
    case "ok":
      return "OK";
    case "error":
      return "Feil";
    case "ambiguous":
      return "Uklart";
    case "timeout":
      return "Timeout";
    default:
      return "Test tilkobling";
  }
}
