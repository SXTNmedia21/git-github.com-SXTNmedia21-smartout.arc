"use client";

// StripeRedirectInterstitial — 600ms trust-anchor overlay shown between
// "Betal nå" click and the Stripe Checkout page load.
//
// Why this exists (Frontend council R4 + spec §3.5):
//   Clicking "Betal nå" kicks off a Server Action that hits Stripe's
//   checkout.sessions.create API. That call takes 300-900ms depending
//   on network. Without an explicit interstitial the user sees a brief
//   freeze and a full-page white flash before Stripe's domain paints,
//   which reads as "the site broke" on mobile. The 600ms intentional
//   pause after the Server Action resolves gives the page time to paint
//   the transfer message BEFORE the redirect fires — this is UX, not
//   lag, and it also anchors trust ("leaving Smartout for Stripe").
//
// Design:
//   Full-viewport glass overlay (Nordic Split recipe: bg-background/80
//   + backdrop-blur-xl + 1px border accent). Card in the centre with
//   Instrument Serif italic heading, Lucide Lock icon, and a hairline
//   progress bar. Noise texture lives inside the card via a linear
//   gradient overlay — cheaper than an SVG and good enough for 600ms.
//
// Accessibility:
//   role="status" on the heading + aria-live="polite" so screen readers
//   announce the redirect. The Lock icon is decorative (aria-hidden);
//   the copy carries meaning.
//
// Motion (Nordic Split Frontend council R4):
//   Entry: opacity + y spring (stiffness 35, damping 22, mass 2.2,
//   500ms). No exit animation — the redirect replaces the page.

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

type StripeRedirectInterstitialProps = {
  /** Controls visibility. Parent flips this after initiatePaymentAction resolves. */
  open: boolean;
  /** The Stripe Checkout Session URL (session.url from initiatePayment). */
  checkoutUrl: string;
  /** Headline copy — i18n-resolved by the caller. */
  heading: string;
  /** Sub-heading / secondary copy. */
  description?: string;
  /**
   * Delay before window.location.href fires. Defaults to 600ms per
   * Frontend R4. Caller can override for E2E tests.
   */
  delayMs?: number;
};

export function StripeRedirectInterstitial({
  open,
  checkoutUrl,
  heading,
  description,
  delayMs = 600,
}: StripeRedirectInterstitialProps) {
  useEffect(() => {
    if (!open) return;
    if (!checkoutUrl) return;
    const timer = window.setTimeout(() => {
      // Hard redirect — we leave the SPA. Router.push would keep the
      // Next.js history intact, which is wrong: the Stripe domain is
      // not part of the app shell.
      window.location.href = checkoutUrl;
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [open, checkoutUrl, delayMs]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="stripe-interstitial"
          className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center p-6",
            "bg-background/80 backdrop-blur-xl",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
          aria-hidden={!open}
        >
          <motion.div
            className={cn(
              "border-border/40 bg-background/60 relative w-full max-w-md overflow-hidden",
              "rounded-2xl border px-8 py-10 text-center",
              // Subtle glow rather than a drop shadow — keeps the
              // "atmospheric, not chunky" Nordic Split feel.
              "shadow-[0_0_80px_-20px_hsl(var(--foreground)/0.25)]",
            )}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2, delay: 0.05 }}
          >
            {/* Noise overlay — subtle grain so the glass card doesn't
                feel like a flat rectangle. Pointer-events-none so it
                doesn't intercept the redirect. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "3px 3px",
              }}
            />

            <div className="relative flex flex-col items-center gap-5">
              <Lock aria-hidden className="text-muted-foreground size-8" />

              <div className="space-y-2">
                <h2
                  role="status"
                  aria-live="polite"
                  className="font-heading text-2xl tracking-tight italic"
                >
                  {heading}
                </h2>
                {description ? (
                  <p className="text-muted-foreground text-sm">{description}</p>
                ) : null}
              </div>

              {/* Hairline progress bar — intentionally slim so it reads
                  as "we're already moving" instead of "please wait". */}
              <div className="bg-muted/40 relative mt-3 h-[2px] w-48 overflow-hidden rounded-full">
                <motion.div
                  className="bg-foreground/70 absolute inset-y-0 left-0"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: delayMs / 1000, ease: "easeInOut" }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
