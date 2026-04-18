"use client";

// PostPaymentConfirmation — celebratory surface rendered when the
// workspace-admin returns from Stripe Checkout with ?payment=success.
//
// Spec §3.5 + Frontend council R4:
//   Badge morph (issued → paid) is handled server-side via the webhook
//   flipping invoice.status; this component is the *accompanying*
//   surface — a soft halo pulse + a toast + an aria-live announcement.
//   The halo is warm (success tone) not green-bright — Nordic Split
//   signals "done" via stillness and hue shift rather than confetti.
//
// URL hygiene:
//   After 3s we call router.replace to drop ?payment=success from the
//   address bar so a refresh doesn't re-announce. This is idiomatic
//   for Stripe return flows — the query param is a one-shot signal.
//
// Accessibility:
//   role="status" + aria-live="polite" so assistive tech gets exactly
//   one announcement. The toast is a redundant channel for sighted
//   users; screen readers might suppress sonner's portal.

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";

const DISMISS_DELAY_MS = 3000;

export function PostPaymentConfirmation({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const { t } = useTranslation("billing");

  useEffect(() => {
    // One-shot toast on mount.
    toast.success(t("payments.confirmation_thanks"));

    const timer = window.setTimeout(() => {
      // Strip ?payment=success without adding history entry. scroll:
      // false so the user stays where the post-payment panel sits.
      router.replace(`/dashboard/billing/${invoiceId}`, { scroll: false });
    }, DISMISS_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [invoiceId, router, t]);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      className="border-foreground/10 bg-foreground/5 relative overflow-hidden rounded-xl border p-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
    >
      {/* Halo pulse — single-shot, warm amber. Non-interactive. */}
      <motion.span
        aria-hidden
        className="bg-warning/20 absolute -top-6 -left-6 size-24 rounded-full blur-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0] }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />
      <div className="relative flex items-start gap-3">
        <CheckCircle aria-hidden className="text-foreground/70 mt-0.5 size-5" />
        <div className="space-y-1">
          <p className="text-foreground text-sm font-medium">{t("payments.confirmation_thanks")}</p>
          <p className="text-muted-foreground text-xs">{t("payments.confirmation_description")}</p>
        </div>
      </div>
    </motion.div>
  );
}
