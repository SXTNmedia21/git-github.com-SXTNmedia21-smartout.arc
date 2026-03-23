// ============================================
// page.tsx
// Marketing campaign landing page for the
// free-forever pricing story.
//
// Why: this page reframes Smartout as a free
// core product with optional paid upgrades,
// then converts premium demand into a waitlist.
// ============================================

import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  Layers3,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { FullTracker, TrackedCta } from "../../components/tracking";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { FreeForeverWaitlistForm } from "./_components/FreeForeverWaitlistForm";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const packageCards = [
  {
    name: "Free",
    price: "0 NOK",
    period: "alltid",
    description: "Smartout Core for drift, vaktlister og grunnleggende personalarbeid.",
    highlighted: false,
    ctaLabel: "Start gratis",
    ctaHref: WEB_APP_LINKS.login,
    badge: "Core",
    features: [
      "Vaktlister og manuell planlegging",
      "Punch clock og grunnleggende lønnsgrunnlag",
      "Ansattoversikt og enkel kontraktsflyt",
      "Basic website",
    ],
  },
  {
    name: "Premium",
    price: "995 NOK",
    period: "launchpris",
    description: "Kapasitetstak for en normal restaurant med omtrent ti ansatte.",
    highlighted: true,
    ctaLabel: "Reserver premium",
    ctaHref: "#waitlist",
    badge: "Mest aktuell",
    features: [
      "14 dager premium inkludert fra start",
      "Typisk nok for ca. 10 ansatte",
      "300 AI-genererte vaktforslag / mnd",
      "400 AI-sammendrag / mnd",
      "Betalfunksjoner kan slås av og på med ett klikk",
      "Fortsatt kun Basic website",
    ],
  },
  {
    name: "Pro",
    price: "2 500 NOK",
    period: "per måned",
    description: "For drift med høyere tempo, mer automatisering og større ambisjon.",
    highlighted: false,
    ctaLabel: "Se Pro",
    ctaHref: "#waitlist",
    badge: "Skaler",
    features: [
      "Høyere usage-tak for AI og automasjon",
      "Standard website inkludert",
      "Flere operative workflows",
      "Sterkere rapport- og sammendragsmotor",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "kontakt oss",
    description: "Fri flyt, SAML og tilpasning for kjeder, multi-location og spesialbehov.",
    highlighted: false,
    ctaLabel: "Snakk med oss",
    ctaHref: "#waitlist",
    badge: "Custom",
    features: [
      "Advanced website og spesialmoduler",
      "SAML / enterprise auth",
      "Tilpasset onboarding og rollout",
      "Forhandlede grenser og avtalt support",
    ],
  },
] as const;

const websiteTiers = [
  {
    name: "Basic",
    description: "En enkel landingsside med tydelig budskap, bilder og grunnleggende struktur.",
    packages: "Free + Premium",
  },
  {
    name: "Standard",
    description: "En mer ambisiøs nettside med rikere presentasjon og bedre historiefortelling.",
    packages: "Pro",
  },
  {
    name: "Advanced",
    description: "Flersidig nettsted med frie moduler, spesialmoduler og mer lagdelt struktur.",
    packages: "Enterprise",
  },
] as const;

const freeHighlights = [
  "Smartout Core er gratis.",
  "Du kan skru betalfunksjoner av og på med ett klikk.",
  "Du betaler først når du vil ha AI, automasjon eller nettsideoppgradering.",
] as const;

const faqs = [
  {
    question: "Er Smartout virkelig gratis?",
    answer:
      "Ja. Smartout Core kan brukes gratis. Betalte funksjoner legges til når du vil ha mer AI, automasjon, signering eller bedre nettside.",
  },
  {
    question: "Hva betyr premiumplassen til 995 NOK?",
    answer:
      "Du reserverer interesse for en begrenset launchpris. I denne første versjonen samler vi ventelisten, og tar kontakt før noe aktiveres eller faktureres.",
  },
  {
    question: "Hva skjer etter de 14 dagene med premium?",
    answer:
      "Du fortsetter gratis i Core, eller slår på Premium, Pro eller Enterprise når du vil. Målet er at kunden skal styre kostnaden selv.",
  },
  {
    question: "Hvordan fungerer nettside-nivåene?",
    answer:
      "Basic er enkel og tydelig. Standard gir en mer ambisiøs presentasjon. Advanced åpner for multipage og frie moduler.",
  },
] as const;

/**
 * SectionLabel renders the small uppercase label used above major sections.
 * Why: repeating the same treatment as a component keeps the page consistent
 * without leaking old variant-specific styling into this campaign.
 *
 * @returns Styled section label text.
 */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-brand-orange text-sm font-semibold tracking-[0.18em] uppercase">
      {children}
    </p>
  );
}

/**
 * FreeForeverPage renders the dedicated pricing and waitlist campaign.
 * Why: the page needs a greenfield layout on shared design tokens, separate
 * from the old pricing route and older landing variants.
 *
 * @returns The full campaign page for free4ever.smartout.ai.
 */
export default function FreeForeverPage() {
  return (
    <div className="bg-background text-foreground relative min-h-screen overflow-x-hidden">
      <FullTracker />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(1_0_0/0.06),transparent_40%)]" />
        <div className="bg-brand-orange/10 absolute top-0 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="absolute top-40 right-[-10rem] h-[20rem] w-[20rem] rounded-full bg-white/6 blur-3xl" />
        <div className="bg-brand-orange/12 absolute bottom-10 left-[-8rem] h-[18rem] w-[18rem] rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div className="relative z-10">
        <header className="border-border/80 bg-background/80 sticky top-0 z-20 border-b backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-foreground flex items-center gap-3">
              <div className="border-border bg-card flex h-10 w-10 items-center justify-center rounded-2xl border">
                <Building2 className="text-brand-orange h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight">Smartout</p>
                <p className="text-muted-foreground text-xs">free4ever.smartout.ai</p>
              </div>
            </Link>

            <div className="hidden items-center gap-3 sm:flex">
              <TrackedCta
                label="Open app"
                href={WEB_APP_LINKS.login}
                className="border-border text-muted-foreground hover:border-brand-orange/40 hover:text-foreground rounded-full border px-4 py-2 text-sm font-medium transition"
              >
                Åpne Smartout
              </TrackedCta>
              <TrackedCta
                label="Reserve premium"
                href="#waitlist"
                className="bg-primary text-primary-foreground rounded-full px-5 py-2 text-sm font-semibold transition hover:opacity-95"
              >
                Bli med på ventelisten
              </TrackedCta>
            </div>
          </div>
        </header>

        <main>
          <section className="mx-auto max-w-7xl px-6 pt-16 pb-20 sm:pt-24">
            <div className="grid gap-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <div className="border-brand-orange/20 bg-brand-orange/10 text-brand-orange inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  14 dager med premium inkludert
                </div>

                <h1
                  className={`${instrumentSerif.className} text-foreground mt-6 max-w-5xl text-5xl leading-[0.95] tracking-tight sm:text-6xl lg:text-8xl`}
                >
                  Smartout er gratis. Betal bare når du vil slå på mer.
                </h1>

                <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8 sm:text-xl">
                  Core-produktet er gratis for alltid. Når du vil ha AI-vakter, AI-sammendrag,
                  premium nettside eller enterprise-flyt, slår du det på med ett klikk.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <TrackedCta
                    label="Join waitlist hero"
                    href="#waitlist"
                    className="bg-primary text-primary-foreground inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition hover:opacity-95"
                  >
                    Reserver premiuminteresse
                    <ArrowRight className="h-4 w-4" />
                  </TrackedCta>

                  <TrackedCta
                    label="See pricing hero"
                    href="#pricing"
                    className="border-border text-foreground hover:border-brand-orange/30 hover:text-brand-orange inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 py-3 text-base font-semibold transition"
                  >
                    Se pakkene
                    <ChevronRight className="h-4 w-4" />
                  </TrackedCta>
                </div>

                <ul className="mt-10 grid gap-3 text-sm sm:grid-cols-3">
                  {freeHighlights.map((item) => (
                    <li
                      key={item}
                      className="border-border/90 bg-card/80 text-muted-foreground flex min-h-12 items-start gap-3 rounded-3xl border px-4 py-4"
                    >
                      <BadgeCheck className="text-brand-orange mt-0.5 h-4 w-4 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-border bg-card/90 rounded-[2rem] border p-6 shadow-[0_20px_80px_-45px_rgba(0,0,0,0.55)] backdrop-blur sm:p-8">
                <SectionLabel>Launch offer</SectionLabel>
                <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight">
                  Begrensede premiumplasser til 995 NOK
                </h2>
                <p className="text-muted-foreground mt-4 text-base leading-7">
                  Premium er laget for normal bruk i en mindre restaurant. Du får et tydelig tak,
                  tydelig pris og null lisenskaos.
                </p>

                <div className="mt-8 space-y-4">
                  <div className="border-border bg-background/70 flex items-start gap-4 rounded-3xl border px-4 py-4">
                    <Clock3 className="text-brand-orange mt-1 h-5 w-5" />
                    <div>
                      <p className="text-foreground font-medium">Bygget for hverdagsbruk</p>
                      <p className="text-muted-foreground text-sm leading-6">
                        Tenk normal drift for en restaurant med omtrent ti ansatte.
                      </p>
                    </div>
                  </div>
                  <div className="border-border bg-background/70 flex items-start gap-4 rounded-3xl border px-4 py-4">
                    <Layers3 className="text-brand-orange mt-1 h-5 w-5" />
                    <div>
                      <p className="text-foreground font-medium">Betalfunksjoner er valgfrie</p>
                      <p className="text-muted-foreground text-sm leading-6">
                        Slå av og på AI, signering og nettsideoppgraderinger uten å røre
                        gratisdelen.
                      </p>
                    </div>
                  </div>
                  <div className="border-border bg-background/70 flex items-start gap-4 rounded-3xl border px-4 py-4">
                    <LockKeyhole className="text-brand-orange mt-1 h-5 w-5" />
                    <div>
                      <p className="text-foreground font-medium">Ingen betaling i dette steget</p>
                      <p className="text-muted-foreground text-sm leading-6">
                        Ventelisten sikrer at vi kan kontakte deg før plassene åpner og riktig pakke
                        aktiveres.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="pricing" className="mx-auto max-w-7xl px-6 py-20">
            <div className="max-w-3xl">
              <SectionLabel>Pricing model</SectionLabel>
              <h2 className="text-foreground mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Ett gratis system. Fire tydelige nivåer.
              </h2>
              <p className="text-muted-foreground mt-5 text-lg leading-8">
                Vi selger ikke låst lisens. Vi selger kapasitet, automasjon og ambisjon. Derfor er
                Free alltid der, mens Premium, Pro og Enterprise bygges rundt hvor mye du faktisk
                vil slå på.
              </p>
            </div>

            <div className="mt-12 grid gap-6 xl:grid-cols-4">
              {packageCards.map((card) => (
                <article
                  key={card.name}
                  className={`flex h-full flex-col rounded-[2rem] border p-6 shadow-[0_18px_80px_-50px_rgba(0,0,0,0.5)] backdrop-blur sm:p-7 ${
                    card.highlighted
                      ? "border-brand-orange/40 bg-brand-orange/10"
                      : "border-border bg-card/90"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-muted-foreground text-sm font-semibold tracking-[0.16em] uppercase">
                        {card.badge}
                      </p>
                      <h3 className="text-foreground mt-3 text-2xl font-semibold tracking-tight">
                        {card.name}
                      </h3>
                    </div>
                    {card.highlighted ? (
                      <span className="border-brand-orange/20 bg-background/80 text-brand-orange rounded-full border px-3 py-1 text-xs font-semibold">
                        Best fit
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-6">
                    <p className="text-foreground text-4xl font-semibold tracking-tight">
                      {card.price}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">{card.period}</p>
                  </div>

                  <p className="text-muted-foreground mt-5 text-sm leading-7">{card.description}</p>

                  <ul className="text-muted-foreground mt-6 space-y-3 text-sm">
                    {card.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <span className="bg-background text-brand-orange mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <TrackedCta
                    label={`${card.name} card CTA`}
                    href={card.ctaHref}
                    className={`mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                      card.highlighted
                        ? "bg-primary text-primary-foreground hover:opacity-95"
                        : "border-border text-foreground hover:border-brand-orange/30 hover:text-brand-orange border"
                    }`}
                  >
                    {card.ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </TrackedCta>
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="max-w-2xl">
              <SectionLabel>Website ladder</SectionLabel>
              <h2 className="text-foreground mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Nettsiden vokser med pakken din.
              </h2>
              <p className="text-muted-foreground mt-5 text-lg leading-8">
                Basic er enkel og effektiv. Standard løfter presentasjonen. Advanced er for dem som
                vil ha friere moduler, multipage-struktur og mer spesialbygget uttrykk.
              </p>
            </div>

            <div className="grid gap-5">
              {websiteTiers.map((tier) => (
                <article
                  key={tier.name}
                  className="border-border bg-card/90 rounded-[2rem] border p-6 shadow-[0_18px_70px_-50px_rgba(0,0,0,0.45)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-foreground text-2xl font-semibold tracking-tight">
                      {tier.name}
                    </h3>
                    <span className="border-brand-orange/20 bg-brand-orange/10 text-brand-orange rounded-full border px-3 py-1 text-sm font-medium">
                      {tier.packages}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-7">
                    {tier.description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-20">
            <div className="border-border bg-card/85 grid gap-8 rounded-[2.25rem] border p-8 shadow-[0_24px_90px_-55px_rgba(0,0,0,0.55)] lg:grid-cols-3">
              <div>
                <SectionLabel>Usage logic</SectionLabel>
                <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Premium er tak med mening.
                </h2>
              </div>
              <div className="border-border bg-background/80 rounded-[1.75rem] border p-5">
                <p className="text-foreground text-lg font-semibold">Premium</p>
                <p className="text-muted-foreground mt-3 text-sm leading-7">
                  Nok AI og automasjon til at en mindre restaurant kan jobbe smart uten å gå rett
                  til enterprise-prising.
                </p>
              </div>
              <div className="border-border bg-background/80 rounded-[1.75rem] border p-5">
                <p className="text-foreground text-lg font-semibold">Pro</p>
                <p className="text-muted-foreground mt-3 text-sm leading-7">
                  Når bruken, ambisjonen eller nettsiden blir større, går du opp til Pro i stedet
                  for å bli straffet i Free eller Premium.
                </p>
              </div>
            </div>
          </section>

          <section id="waitlist" className="mx-auto max-w-7xl px-6 py-20">
            <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <div className="max-w-xl">
                <SectionLabel>Venteliste</SectionLabel>
                <h2 className="text-foreground mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                  Sikre deg tidlig tilgang før plassene fylles.
                </h2>
                <p className="text-muted-foreground mt-5 text-lg leading-8">
                  Dette er siden for deg som vil teste en smartere prismodell først. Legg inn
                  bedriften din, så følger vi opp med riktig nivå og riktig launch-vindu.
                </p>
                <ul className="text-muted-foreground mt-8 space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <Check className="text-brand-orange mt-1 h-4 w-4 shrink-0" />
                    <span>Venteliste for begrensede premiumplasser</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="text-brand-orange mt-1 h-4 w-4 shrink-0" />
                    <span>Ingen betaling i første steg</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="text-brand-orange mt-1 h-4 w-4 shrink-0" />
                    <span>Tydelig overgang fra Free til Premium, Pro eller Enterprise</span>
                  </li>
                </ul>
              </div>

              <FreeForeverWaitlistForm />
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 pt-12 pb-24">
            <div className="grid gap-5 lg:grid-cols-2">
              {faqs.map((faq) => (
                <article
                  key={faq.question}
                  className="border-border bg-card/90 rounded-[2rem] border p-6 shadow-[0_18px_70px_-55px_rgba(0,0,0,0.45)]"
                >
                  <h3 className="text-foreground text-xl font-semibold tracking-tight">
                    {faq.question}
                  </h3>
                  <p className="text-muted-foreground mt-4 text-base leading-7">{faq.answer}</p>
                </article>
              ))}
            </div>
          </section>
        </main>

        <footer className="border-border/80 bg-background/90 border-t">
          <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-foreground font-medium">Smartout er alltid gratis i Core.</p>
              <p className="mt-1">Slå på mer når du vil ha AI, nettside eller enterprise-flyt.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/personvern" className="hover:text-foreground transition">
                Personvern
              </Link>
              <Link href="/vilkar" className="hover:text-foreground transition">
                Vilkår
              </Link>
              <TrackedCta
                label="Footer waitlist"
                href="#waitlist"
                className="border-border text-foreground hover:border-brand-orange/30 hover:text-brand-orange rounded-full border px-4 py-2 font-medium transition"
              >
                Bli med på ventelisten
              </TrackedCta>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
