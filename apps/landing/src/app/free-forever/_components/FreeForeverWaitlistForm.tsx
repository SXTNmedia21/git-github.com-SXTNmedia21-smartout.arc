"use client";

// ============================================
// FreeForeverWaitlistForm.tsx
// Captures premium waitlist interest for the
// free-forever pricing campaign.
//
// Why: the campaign needs structured lead capture
// instead of anonymous-only CTA tracking so sales
// can follow up on premium interest.
// ============================================

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { getOrCreateVisitorId } from "../../../../lib/visitor-cookie";
import { getCurrentVariant, getOrCreateSessionId, postEvent } from "../../../../hooks/useTracking";

type WaitlistPackage = "free" | "premium" | "pro" | "enterprise";

type WaitlistFormState = {
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  employeeCount: string;
  interestedPackage: WaitlistPackage;
};

const INITIAL_STATE: WaitlistFormState = {
  fullName: "",
  companyName: "",
  email: "",
  phone: "",
  employeeCount: "1-10",
  interestedPackage: "premium",
};

/**
 * Returns a stable tracking context for the current visitor session.
 * Why: form tracking should group all interactions under the same
 * anonymous visitor and session identity as the rest of the landing app.
 */
function getTrackingContext() {
  return {
    variant: getCurrentVariant(),
    visitor_id: getOrCreateVisitorId(),
    session_id: getOrCreateSessionId(),
  };
}

/**
 * FreeForeverWaitlistForm renders the premium reservation waitlist form.
 * Why: the campaign needs a focused conversion form with a success state,
 * structured submit payload, and explicit tracking around intent.
 *
 * @returns Interactive waitlist form or a success confirmation card.
 */
export function FreeForeverWaitlistForm() {
  const [form, setForm] = useState<WaitlistFormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasTrackedStart, setHasTrackedStart] = useState(false);

  const isValid = useMemo(() => {
    return (
      form.fullName.trim() !== "" && form.companyName.trim() !== "" && form.email.trim() !== ""
    );
  }, [form.companyName, form.email, form.fullName]);

  /**
   * Updates a single form field by key.
   * Why: keeping field updates centralized makes the client form easier to
   * reason about and avoids repeating small state spread operations inline.
   *
   * @returns Nothing. React state is updated in place.
   */
  function updateField<Key extends keyof WaitlistFormState>(
    key: Key,
    value: WaitlistFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /**
   * Tracks the moment a visitor starts engaging with the form.
   * Why: marketing wants to distinguish page interest from real form intent.
   *
   * @returns Nothing. Sends a non-blocking analytics event once.
   */
  function trackFormStarted() {
    if (hasTrackedStart) return;
    setHasTrackedStart(true);

    void postEvent({
      event_type: "form_started",
      ...getTrackingContext(),
      details: {
        form: "free_forever_waitlist",
        interested_package: form.interestedPackage,
        premium_reservation_interest: true,
      },
    });
  }

  /**
   * Submits the premium waitlist form to the public waitlist endpoint.
   * Why: this stores structured campaign leads separately from anonymous-only
   * landing analytics and lets the page show a real success state.
   *
   * @returns Nothing. The result updates the local form state.
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!isValid) {
      setErrorMessage("Fyll inn navn, selskap og e-post for å reservere interessen.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignKey: "free-forever",
          fullName: form.fullName,
          companyName: form.companyName,
          email: form.email,
          phone: form.phone || undefined,
          employeeCount: form.employeeCount,
          interestedPackage: form.interestedPackage,
          premiumReservationInterest: true,
          sourcePath: "/free-forever",
          ...getTrackingContext(),
        }),
      });

      if (!response.ok) {
        throw new Error("submit_failed");
      }

      void postEvent({
        event_type: "waitlist_submitted",
        ...getTrackingContext(),
        details: {
          form: "free_forever_waitlist",
          interested_package: form.interestedPackage,
          employee_count: form.employeeCount,
          premium_reservation_interest: true,
        },
      });

      setIsSubmitted(true);
      setForm(INITIAL_STATE);
    } catch {
      void postEvent({
        event_type: "waitlist_failed",
        ...getTrackingContext(),
        details: {
          form: "free_forever_waitlist",
          interested_package: form.interestedPackage,
        },
      });

      setErrorMessage("Noe gikk galt. Prøv igjen om litt, eller kontakt oss direkte.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="border-brand-orange/30 bg-card/90 rounded-[2rem] border p-8 shadow-[0_18px_70px_-40px_color-mix(in_oklab,var(--brand-orange)_55%,transparent)] backdrop-blur">
        <div className="bg-brand-orange/15 text-brand-orange mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="text-foreground text-2xl font-semibold tracking-tight">
          Du står på listen for premium.
        </h3>
        <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6 sm:text-base">
          Vi har registrert interessen din for premiumplassen til <strong>995 NOK</strong>. Vi tar
          kontakt når de begrensede plassene åpner og går gjennom riktig pakke for bedriften din.
        </p>
      </div>
    );
  }

  return (
    <form
      className="border-border bg-card/90 rounded-[2rem] border p-6 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.45)] backdrop-blur sm:p-8"
      onSubmit={handleSubmit}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-brand-orange text-sm font-medium">Begrensede premiumplasser</p>
          <h3 className="text-foreground mt-1 text-2xl font-semibold tracking-tight">
            Reserver interessen din i dag
          </h3>
        </div>
        <div className="border-brand-orange/25 bg-brand-orange/10 text-brand-orange rounded-full border px-3 py-1 text-sm font-semibold">
          995 NOK launchpris
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-foreground flex flex-col gap-2 text-sm font-medium">
          Fullt navn
          <input
            type="text"
            value={form.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
            onFocus={trackFormStarted}
            className="border-border bg-background text-foreground focus:border-brand-orange focus:ring-brand-orange/10 min-h-12 rounded-2xl border px-4 py-3 text-base transition outline-none focus:ring-4"
            placeholder="Pontus Tjernberg"
            autoComplete="name"
            required
          />
        </label>

        <label className="text-foreground flex flex-col gap-2 text-sm font-medium">
          Selskap
          <input
            type="text"
            value={form.companyName}
            onChange={(event) => updateField("companyName", event.target.value)}
            onFocus={trackFormStarted}
            className="border-border bg-background text-foreground focus:border-brand-orange focus:ring-brand-orange/10 min-h-12 rounded-2xl border px-4 py-3 text-base transition outline-none focus:ring-4"
            placeholder="Smartout Restaurant Group"
            autoComplete="organization"
            required
          />
        </label>

        <label className="text-foreground flex flex-col gap-2 text-sm font-medium">
          E-post
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            onFocus={trackFormStarted}
            className="border-border bg-background text-foreground focus:border-brand-orange focus:ring-brand-orange/10 min-h-12 rounded-2xl border px-4 py-3 text-base transition outline-none focus:ring-4"
            placeholder="deg@restaurant.no"
            autoComplete="email"
            required
          />
        </label>

        <label className="text-foreground flex flex-col gap-2 text-sm font-medium">
          Telefon
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            onFocus={trackFormStarted}
            className="border-border bg-background text-foreground focus:border-brand-orange focus:ring-brand-orange/10 min-h-12 rounded-2xl border px-4 py-3 text-base transition outline-none focus:ring-4"
            placeholder="+47 900 00 000"
            autoComplete="tel"
          />
        </label>

        <label className="text-foreground flex flex-col gap-2 text-sm font-medium">
          Antall ansatte
          <select
            value={form.employeeCount}
            onChange={(event) => updateField("employeeCount", event.target.value)}
            onFocus={trackFormStarted}
            className="border-border bg-background text-foreground focus:border-brand-orange focus:ring-brand-orange/10 min-h-12 rounded-2xl border px-4 py-3 text-base transition outline-none focus:ring-4"
          >
            <option value="1-10">1–10 ansatte</option>
            <option value="11-25">11–25 ansatte</option>
            <option value="26-50">26–50 ansatte</option>
            <option value="51-100">51–100 ansatte</option>
            <option value="100+">100+ ansatte</option>
          </select>
        </label>

        <label className="text-foreground flex flex-col gap-2 text-sm font-medium">
          Interessert pakke
          <select
            value={form.interestedPackage}
            onChange={(event) =>
              updateField("interestedPackage", event.target.value as WaitlistPackage)
            }
            onFocus={trackFormStarted}
            className="border-border bg-background text-foreground focus:border-brand-orange focus:ring-brand-orange/10 min-h-12 rounded-2xl border px-4 py-3 text-base transition outline-none focus:ring-4"
          >
            <option value="free">Free</option>
            <option value="premium">Premium</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
      </div>

      <div className="border-brand-orange/20 bg-brand-orange/8 text-muted-foreground mt-5 rounded-2xl border px-4 py-3 text-sm leading-6">
        Du reserverer interesse for en begrenset premiumplass. Ingen betaling skjer i dette steget.
      </div>

      {errorMessage ? (
        <p className="border-destructive/25 bg-destructive/10 text-foreground mt-4 rounded-2xl border px-4 py-3 text-sm">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary text-primary-foreground focus:ring-brand-orange/15 mt-6 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3 text-base font-semibold transition hover:opacity-95 focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Sender inn
          </>
        ) : (
          <>
            Bli med på ventelisten
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
