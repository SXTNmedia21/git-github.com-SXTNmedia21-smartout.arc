"use client";

// PostPaymentCancelled — gentle "try again whenever" surface when the
// workspace-admin lands back from Stripe with ?payment=cancelled.
//
// Spec §3.5: non-event. No animation, no toast, no red. A single calm
// paragraph that the user can dismiss by clicking "Betal nå" again.
//
// After 5s we remove the query param from the URL so a refresh doesn't
// re-render this block. 5s (rather than the 3s success uses) gives the
// user time to read the copy on mobile.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { useTranslation } from "@smartout/i18n";

const DISMISS_DELAY_MS = 5000;

export function PostPaymentCancelled({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const { t } = useTranslation("billing");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(`/dashboard/billing/${invoiceId}`, { scroll: false });
    }, DISMISS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [invoiceId, router]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-border bg-muted/30 flex items-start gap-3 rounded-xl border p-4"
    >
      <Info aria-hidden className="text-muted-foreground mt-0.5 size-5" />
      <p className="text-muted-foreground text-sm">{t("payments.cancelled_gentle")}</p>
    </div>
  );
}
