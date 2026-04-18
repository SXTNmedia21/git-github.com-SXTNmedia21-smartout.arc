"use client";

// PayNowButton — workspace-admin "Betal nå" CTA on invoice detail.
//
// CTA hierarchy (spec §3.5, Frontend council R1):
//   Rendered only when invoice.status ∈ {issued, sent, overdue}. The
//   overdue variant adds a warning halo — subtle amber glow that reads
//   as "attention" without shouting. No destructive red on overdue;
//   that's reserved for refusal states.
//
// Flow:
//   1. User clicks → calls initiatePaymentAction (Server Action)
//   2. Action returns { checkout_url } + pending toast
//   3. Interstitial opens → 600ms trust-anchor animation
//   4. Interstitial's useEffect fires window.location.href = checkout_url
//
// Mobile parity (spec §8):
//   52px min height on all breakpoints, full-width on sm breakpoint.
//   Thumb-friendly. aria-describedby points to an amount-span so the
//   label is "Betal 1 500 kr nå" for screen readers and voice-control.

import { useState, useTransition } from "react";
import { ArrowUpRight, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";

import { cn } from "@/lib/utils";
import { StripeRedirectInterstitial } from "@/components/billing/StripeRedirectInterstitial";
import { initiatePaymentAction } from "../_actions/initiatePaymentAction";

type PayNowButtonInvoice = {
  invoice_id: string;
  status: string;
  amount_incl_vat: number | string;
  currency: string;
};

// Narrow the free-form string status to the three payable states.
// Anything else = no CTA (spec §3.5 matrix).
const PAYABLE_STATUSES = new Set(["issued", "sent", "overdue"]);

function formatAmount(amount: number | string, currency: string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  return `${n.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} ${currency}`;
}

export function PayNowButton({ invoice }: { invoice: PayNowButtonInvoice }) {
  const { t } = useTranslation("billing");
  const [pending, startTransition] = useTransition();
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  if (!PAYABLE_STATUSES.has(invoice.status)) return null;

  const isOverdue = invoice.status === "overdue";
  const amountLabel = formatAmount(invoice.amount_incl_vat, invoice.currency);
  const amountDescId = `pay-now-amount-${invoice.invoice_id}`;

  const label = isOverdue ? t("payments.pay_now_overdue") : t("payments.pay_now");

  const handleClick = () => {
    startTransition(async () => {
      const result = await initiatePaymentAction({ invoice_id: invoice.invoice_id });
      if (!result.ok) {
        toast.error(t("payments.initiate_error", { error: result.error }));
        return;
      }
      setCheckoutUrl(result.data.checkout_url);
    });
  };

  return (
    <>
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={pending || checkoutUrl !== null}
          aria-describedby={amountDescId}
          className={cn(
            // Base — Nordic Split "glow CTA" recipe. Foreground-on-background
            // inversion + hairline ring + hover halo.
            "bg-foreground text-background relative inline-flex w-full items-center justify-center",
            "gap-2 rounded-lg px-5 py-3.5 text-sm font-medium",
            "shadow-[0_0_0_1px_var(--border)] transition-all",
            "hover:shadow-[0_0_40px_-10px_hsl(var(--foreground)/0.4)]",
            "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
            "disabled:pointer-events-none disabled:opacity-50",
            // Mobile: 52px thumb zone + full width.
            "h-[52px] sm:h-[52px]",
            // Overdue warning halo — soft amber glow. No destructive red.
            isOverdue &&
              "shadow-[0_0_0_1px_var(--border),0_0_30px_-5px_hsl(var(--warning)/0.45)] hover:shadow-[0_0_0_1px_var(--border),0_0_50px_-8px_hsl(var(--warning)/0.6)]",
          )}
        >
          <CreditCard aria-hidden className="size-4" />
          <span>
            {label} · <span className="tabular-nums">{amountLabel}</span>
          </span>
          <ArrowUpRight aria-hidden className="size-4 opacity-70" />
        </button>
        {/* Screen-reader-only expansion so aria-describedby resolves to
            the exact amount + currency. Frontend R1 calls this out as
            non-optional for financial CTAs. */}
        <span id={amountDescId} className="sr-only">
          {t("payments.pay_now_aria_amount", { amount: amountLabel })}
        </span>
        {isOverdue ? (
          <p className="text-muted-foreground text-xs">{t("payments.overdue_hint")}</p>
        ) : null}
      </div>

      <StripeRedirectInterstitial
        open={checkoutUrl !== null}
        checkoutUrl={checkoutUrl ?? ""}
        heading={t("payments.interstitial_heading")}
        description={t("payments.interstitial_description")}
      />
    </>
  );
}
