// ============================================
// VariantMLanding.tsx
// Landing page variant M — "Slutt å gjenta deg selv"
// Communication & follow-up perspective for tired leaders.
// Persona: Tor, 52, daglig leder, 3 restaurants, 60+ ansatte.
// Sends the same message 5 times and still gets asked about it.
// Design energy: Clean, message-focused — notification feeds,
// read receipts, message threads. Relief, not overwhelm.
// Accent color: amber (amber-400/500).
// Connected to: app/page.tsx (variant switcher)
// ============================================

"use client";

import Link from "next/link";
import { m } from "framer-motion";
import {
  ArrowRight,
  MessageSquare,
  CheckCheck,
  Bell,
  BellOff,
  Send,
  Eye,
  Clock,
  AlertCircle,
  RefreshCw,
  Users,
  MessagesSquare,
  StickyNote,
  Phone,
  Check,
  ChevronRight,
  Megaphone,
  Zap,
  ShieldCheck,
} from "lucide-react";
import Navigation from "../navigation";
import Footer from "../footer";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { usePageTracking, useTrackCta } from "../../hooks/useTracking";
import { useScrollTracking } from "../../hooks/useScrollTracking";
import { useClickTracking } from "../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../hooks/useSessionLifecycle";

// -----------------------------------------------
// Animation variants
// Notification-style: messages slide in from the side,
// sections fade up on scroll.
// -----------------------------------------------

/** Standard fade-up for section wrappers. */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

/** Slide-in from right — notification style. */
const slideInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0 },
};

/** Stagger container for child animations. */
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

/** Faster stagger for notification feed items. */
const staggerFast = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2 } },
};

// -----------------------------------------------
// Data — kept outside the component to avoid
// re-creation on every render.
// -----------------------------------------------

/** Fragmented communication channels that leaders currently juggle. */
const chaosChannels = [
  {
    icon: MessagesSquare,
    label: "WhatsApp-gruppen",
    pain: "Ingen vet hvem som har lest det", // CHANGED: specific pain per channel
  },
  {
    icon: StickyNote,
    label: "Post-it på kjøleskapet",
    pain: "Borte neste dag. Ingen kvittering.", // CHANGED: physical medium = zero traceability
  },
  {
    icon: Phone,
    label: "Muntlig beskjed",
    pain: "«Jeg trodde du sa tirsdag?»", // CHANGED: relatable misunderstanding quote
  },
  {
    icon: Send,
    label: "SMS til noen",
    pain: "Resten av teamet vet ingenting", // CHANGED: partial reach = information silos
  },
];

/** Unified channel feature cards. */
const unifiedFeatures = [
  {
    icon: Megaphone,
    title: "Én melding. Alle får den.",
    description:
      "Send én gang — SmartOut distribuerer til riktig avdeling, team eller hele bedriften. Ingen manuell videreformidling.", // CHANGED: emphasis on "send once" as the core value prop
  },
  {
    icon: CheckCheck,
    title: "Lest-kvittering i sanntid",
    description:
      "Se hvem som har lest, hvem som ikke har det, og når. Slutt å lure på om beskjeden nådde frem.", // CHANGED: removes guesswork — the emotional payoff
  },
  {
    icon: RefreshCw,
    title: "Automatisk purring",
    description:
      "Har ikke lest innen fristen? SmartOut sender påminnelse automatisk. Du slipper å følge opp manuelt.", // CHANGED: leader relief — the system does the nagging
  },
];

/** Notification feed items for the message flow mockup. */
const notificationFeed = [
  {
    title: "Ny rutine: Allergenmerking oppdatert", // CHANGED: specific, relatable restaurant content
    status: "read",
    readCount: 18,
    totalCount: 22,
    timeAgo: "2 timer siden",
    badge: "Rutine",
    badgeColor: "amber",
  },
  {
    title: "Vaktendring lørdag 15. mars", // CHANGED: specific date makes it feel real
    status: "partial",
    readCount: 19,
    totalCount: 22,
    timeAgo: "5 timer siden",
    badge: "Viktig",
    badgeColor: "red",
    reminder: "Purring sendt til 3 personer", // CHANGED: shows the auto-reminder in action
  },
  {
    title: "Ukentlig møtereferat — uke 11", // CHANGED: specific week number adds authenticity
    status: "complete",
    readCount: 22,
    totalCount: 22,
    timeAgo: "I går",
    badge: "Referat",
    badgeColor: "emerald",
  },
  {
    title: "Ny ansatt starter mandag: Ahmed K.", // CHANGED: onboarding-relevant, personal
    status: "read",
    readCount: 8,
    totalCount: 8,
    timeAgo: "I går",
    badge: "Team",
    badgeColor: "blue",
  },
];

/** Follow-up feature cards. */
const followUpFeatures = [
  {
    icon: Bell,
    title: "Auto-purring",
    description:
      "Sett en frist. SmartOut følger opp de som ikke har lest — uten at du løfter en finger.", // CHANGED: deadline-driven, zero effort for the leader
    detail: "Konfigurerbar: 2t, 6t, 24t etter sending",
  },
  {
    icon: Eye,
    title: "Lest-kvittering",
    description: "Ikke bare «levert» — du ser hvem som faktisk har åpnet og lest innholdet.", // CHANGED: distinguishes delivery from actual reading
    detail: "Per person, per melding, med tidsstempel",
  },
  {
    icon: Zap,
    title: "Smart eskalering",
    description:
      "Tre purringer uten respons? SmartOut varsler deg — én gang, med en klar oversikt over hvem som mangler.", // CHANGED: escalation = summary, not spam
    detail: "Eskalerer til leder etter konfigurerbart antall forsøk",
  },
];

/** Soft result metrics. */
const results = [
  {
    metric: "1 gang",
    label: "Si det én gang — ferdig", // CHANGED: the core promise
    description: "Ingen gjentagelser. Ingen «sa du ikke det til meg?»-samtaler.",
  },
  {
    metric: "100%",
    label: "Alle på samme side", // CHANGED: universal awareness
    description: "Lest-kvittering gir deg bevis — ikke bare håp — om at beskjeden nådde frem.",
  },
  {
    metric: "0",
    label: "Misforståelser som skyldes kommunikasjon", // CHANGED: zero miscommunications
    description: "Når alle har lest det samme, forsvinner «jeg visste ikke»-unnskyldningen.",
  },
];

// -----------------------------------------------
// Helper: status badge color mapping
// -----------------------------------------------

function feedBadgeClasses(color: string): string {
  switch (color) {
    case "amber":
      return "border-amber-500/20 bg-amber-500/10 text-amber-400";
    case "red":
      return "border-red-500/20 bg-red-500/10 text-red-400";
    case "emerald":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
    case "blue":
      return "border-blue-500/20 bg-blue-500/10 text-blue-400";
    default:
      return "border-zinc-500/20 bg-zinc-500/10 text-zinc-400";
  }
}

function readStatusIcon(status: string) {
  switch (status) {
    case "complete":
      return <CheckCheck className="h-4 w-4 text-emerald-400" />;
    case "partial":
      return <Clock className="h-4 w-4 text-amber-400" />;
    case "read":
      return <CheckCheck className="h-4 w-4 text-amber-400" />;
    default:
      return <AlertCircle className="h-4 w-4 text-zinc-400" />;
  }
}

// ============================================
// Main component
// ============================================

// UI Events:
// - nav: WEB_APP_LINKS.onboarding (hero CTA, final CTA)
// - action: trackCta("Prøv gratis") (hero button)
// - action: trackCta("Si det én gang. Ferdig.") (final CTA button)
// - scroll-tracking: all 7 sections tracked via useScrollTracking
// - click-tracking: all interactive elements via useClickTracking

/**
 * VariantMLanding — Communication & follow-up variant.
 *
 * Targets tired leaders exhausted from repeating themselves.
 * Heavy emphasis on notification feeds, read receipts, and
 * auto-reminders. Amber accent palette. No voice widget.
 *
 * Seven sections: Hero, The Problem, One Channel,
 * Message Flow Mockup, Follow-up That Works, Results, Final CTA.
 */
export default function VariantMLanding() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const trackCta = useTrackCta();

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white selection:bg-amber-500/30">
      <Navigation />

      <main>
        {/* ============================================
            Section 1 — Hero
            "Slutt å gjenta deg selv."
            Empathetic headline targeting the exhaustion
            of repeating the same info endlessly.
            ============================================ */}
        <section className="relative px-6 pt-32 pb-20 lg:pt-48 lg:pb-32">
          {/* Ambient amber glow */}
          <div className="pointer-events-none absolute top-0 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-amber-500/5 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[400px] w-[400px] rounded-full bg-amber-500/3 blur-3xl" />

          <div className="mx-auto max-w-4xl text-center">
            <m.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ duration: 0.6 }}
            >
              {/* Category badge */}
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1">
                <BellOff className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-bold tracking-wider text-amber-400 uppercase">
                  Kommunikasjon som faktisk fungerer{" "}
                  {/* CHANGED: badge copy — positions the promise */}
                </span>
              </div>

              <h1 className="mb-6 text-5xl leading-[1.08] font-black tracking-tight lg:text-7xl">
                Slutt å gjenta{" "}
                <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                  deg selv.
                </span>
                {/* CHANGED: headline — the core frustration in 4 words */}
              </h1>

              <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400 lg:text-xl">
                Du sender den samme beskjeden fem ganger. Noen leser den. Noen glemmer den. Noen
                hører om den i garderoben.{" "}
                <span className="text-zinc-300">Det finnes en bedre måte.</span>
                {/* CHANGED: subtitle — painfully relatable scenario, then the hope */}
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href={WEB_APP_LINKS.onboarding}
                  onClick={() => trackCta("Prøv gratis")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-4 font-bold text-white shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_0_40px_rgba(245,158,11,0.5)]"
                >
                  Prøv gratis <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="#problemet"
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-8 py-4 text-center font-bold text-white transition-all hover:border-zinc-700 hover:bg-zinc-800"
                >
                  Se problemet
                </Link>
              </div>

              {/* Social proof */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-500">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-500" />
                  <span>
                    <strong className="text-zinc-300">60+</strong> ansatte under kontroll
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                  <span>
                    <strong className="text-zinc-300">1</strong> kanal, ikke 5
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCheck className="h-4 w-4 text-amber-500" />
                  <span>
                    <strong className="text-zinc-300">100%</strong> lesebekreftelse
                  </span>
                </div>
              </div>
            </m.div>
          </div>
        </section>

        {/* ============================================
            Section 2 — The Problem
            "Hvorfor når ikke beskjeden frem?"
            Visual showing message chaos — fragmented
            channels, lost messages, zero traceability.
            ============================================ */}
        <section id="problemet" className="relative px-6 py-24 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
                Hvorfor når ikke beskjeden{" "}
                <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                  frem?
                </span>
                {/* CHANGED: names the problem directly */}
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">
                Fordi du bruker fem kanaler som ingen følger systematisk. Resultatet? Du gjentar deg
                selv — og folk spør likevel.
                {/* CHANGED: explains the root cause, not just the symptom */}
              </p>
            </m.div>

            {/* Fragmented channel cards */}
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {chaosChannels.map((channel) => (
                <m.div
                  key={channel.label}
                  variants={slideInRight}
                  transition={{ duration: 0.5 }}
                  className="group rounded-2xl border border-red-500/10 bg-red-500/5 p-6 transition-all hover:border-red-500/20"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                    <channel.icon className="h-5 w-5 text-red-400" />
                  </div>
                  <h3 className="mb-2 font-bold text-white">{channel.label}</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{channel.pain}</p>
                </m.div>
              ))}
            </m.div>

            {/* Tor's quote — the persona speaking */}
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mx-auto mt-12 max-w-2xl"
            >
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="flex items-start gap-4">
                  <div className="hidden w-1 shrink-0 self-stretch rounded-full bg-amber-500 sm:block" />
                  <div>
                    <p className="text-lg leading-relaxed text-zinc-200 italic">
                      &ldquo;Jeg sender den samme meldingen i WhatsApp-gruppen, på SMS til de som
                      ikke er i gruppen, og sier det muntlig til de som var på jobb. Så ringer noen
                      neste dag og spør: «Hva var det du sa?»&rdquo;
                      {/* CHANGED: Tor's exact frustration — painfully specific */}
                    </p>
                    <p className="mt-3 text-sm text-zinc-500">
                      — Tor, 52, daglig leder, 3 restauranter
                    </p>
                  </div>
                </div>
              </div>
            </m.div>
          </div>
        </section>

        {/* ============================================
            Section 3 — One Channel
            "Erstatt 5 kanaler med én."
            3 feature cards showing unified messaging.
            ============================================ */}
        <section className="relative px-6 py-24 lg:py-32">
          <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/5 blur-3xl" />

          <div className="mx-auto max-w-7xl">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
                Erstatt 5 kanaler med{" "}
                <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                  én.
                </span>
                {/* CHANGED: the value prop in 5 words */}
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">
                Én melding. Alle mottar den. Du ser hvem som har lest. De som ikke har det, får
                påminnelse automatisk.
                {/* CHANGED: the complete flow in one sentence */}
              </p>
            </m.div>

            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid gap-8 md:grid-cols-3"
            >
              {unifiedFeatures.map((feature) => (
                <m.div
                  key={feature.title}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all hover:border-amber-500/30 hover:bg-zinc-900"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 transition-colors group-hover:bg-amber-500/20">
                    <feature.icon className="h-6 w-6 text-amber-400" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-white">{feature.title}</h3>
                  <p className="leading-relaxed text-zinc-400">{feature.description}</p>
                </m.div>
              ))}
            </m.div>
          </div>
        </section>

        {/* ============================================
            Section 4 — Message Flow Mockup
            A notification feed showing real messages
            with read receipts, reminders, and status.
            The KEY visual — this should feel painfully
            relatable to anyone managing staff.
            ============================================ */}
        <section className="relative px-6 py-24 lg:py-32">
          <div className="mx-auto max-w-3xl">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mb-12 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
                Slik ser det ut{" "}
                <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                  i praksis.
                </span>
                {/* CHANGED: grounded, not theoretical */}
              </h2>
              <p className="mx-auto max-w-xl text-lg text-zinc-400">
                Én oversikt. Alle meldinger. Full kontroll over hvem som vet hva.
              </p>
            </m.div>

            {/* Notification feed mockup */}
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerFast}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0e] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            >
              {/* Feed header */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-[#121214] px-6 py-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold text-zinc-300">Meldingsoversikt</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                  Oppdatert nå
                </div>
              </div>

              {/* Feed items */}
              <div className="divide-y divide-zinc-800/50">
                {notificationFeed.map((item, i) => (
                  <m.div
                    key={item.title}
                    variants={slideInRight}
                    transition={{ duration: 0.5 }}
                    className="group flex items-start gap-4 px-6 py-5 transition-colors hover:bg-zinc-900/50"
                  >
                    {/* Status icon */}
                    <div className="mt-1 shrink-0">{readStatusIcon(item.status)}</div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-bold ${feedBadgeClasses(item.badgeColor)}`}
                        >
                          {item.badge}
                        </span>
                        <span className="text-xs text-zinc-600">{item.timeAgo}</span>
                      </div>
                      <h4 className="mb-1 font-semibold text-zinc-200">{item.title}</h4>

                      {/* Read count bar */}
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                          <m.div
                            initial={{ width: 0 }}
                            whileInView={{
                              width: `${(item.readCount / item.totalCount) * 100}%`,
                            }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.0, delay: 0.3 + i * 0.15, ease: "easeOut" }}
                            className={`h-full rounded-full ${
                              item.status === "complete" ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                        </div>
                        <span className="shrink-0 text-xs font-medium text-zinc-400">
                          {item.readCount}/{item.totalCount} lest
                        </span>
                      </div>

                      {/* Auto-reminder badge (if applicable) */}
                      {item.reminder && (
                        <m.div
                          initial={{ opacity: 0, y: 4 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, delay: 0.6 + i * 0.15 }}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-xs text-amber-400"
                        >
                          <RefreshCw className="h-3 w-3" />
                          {item.reminder}
                        </m.div>
                      )}
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-500" />
                  </m.div>
                ))}
              </div>

              {/* Feed footer — summary stats */}
              <div className="flex items-center justify-between border-t border-zinc-800 bg-[#121214] px-6 py-3">
                <span className="text-xs text-zinc-500">4 meldinger denne uken</span>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-400" />1 kvittert av alle
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-400" />1 purring sendt
                  </span>
                </div>
              </div>
            </m.div>
          </div>
        </section>

        {/* ============================================
            Section 5 — Follow-up That Works
            3 features: auto-purring, lest-kvittering,
            smart eskalering. Each with a detail line.
            ============================================ */}
        <section className="relative px-6 py-24 lg:py-32">
          <div className="pointer-events-none absolute top-0 left-0 -z-10 h-[400px] w-[400px] rounded-full bg-amber-500/5 blur-3xl" />

          <div className="mx-auto max-w-7xl">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
                Oppfølging som{" "}
                <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                  faktisk virker.
                </span>
                {/* CHANGED: "faktisk" is the keyword — contrasts with the broken status quo */}
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">
                Du sender. Systemet følger opp. Ingen faller mellom stolene.
                {/* CHANGED: three short sentences = clarity + relief */}
              </p>
            </m.div>

            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid gap-8 md:grid-cols-3"
            >
              {followUpFeatures.map((feature) => (
                <m.div
                  key={feature.title}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all hover:border-amber-500/30 hover:bg-zinc-900"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 transition-colors group-hover:bg-amber-500/20">
                    <feature.icon className="h-6 w-6 text-amber-400" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-white">{feature.title}</h3>
                  <p className="mb-4 leading-relaxed text-zinc-400">{feature.description}</p>
                  <p className="text-xs font-medium text-amber-400/60">{feature.detail}</p>
                </m.div>
              ))}
            </m.div>
          </div>
        </section>

        {/* ============================================
            Section 6 — Results
            Soft metrics: fewer misunderstandings,
            everyone aligned, zero repetition.
            ============================================ */}
        <section className="relative px-6 py-24 lg:py-32">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-amber-500/3 to-transparent" />

          <div className="mx-auto max-w-7xl">
            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mb-16 text-center"
            >
              <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
                Resultatet?{" "}
                <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                  Ro.
                </span>
                {/* CHANGED: one word says it all — the emotional payoff is calm */}
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">
                Ikke flere gjentagelser. Ikke flere «jeg visste ikke». Bare klarhet.
                {/* CHANGED: negation pattern drives the relief feeling */}
              </p>
            </m.div>

            <m.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid gap-8 md:grid-cols-3"
            >
              {results.map((result) => (
                <m.div
                  key={result.label}
                  variants={fadeUp}
                  transition={{ duration: 0.5 }}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center"
                >
                  <p className="mb-2 text-4xl font-black text-amber-400">{result.metric}</p>
                  <h3 className="mb-3 text-lg font-bold text-white">{result.label}</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{result.description}</p>
                </m.div>
              ))}
            </m.div>
          </div>
        </section>

        {/* ============================================
            Section 7 — Final CTA
            "Si det én gang. Ferdig."
            The promise crystallized into 5 words.
            ============================================ */}
        <section className="relative px-6 py-24 lg:py-32">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent" />

          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <MessageSquare className="mx-auto mb-6 h-10 w-10 text-amber-400" />

            <h2 className="mb-6 text-4xl font-bold tracking-tight lg:text-5xl">
              Si det én gang.{" "}
              <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
                Ferdig.
              </span>
              {/* CHANGED: the closing tagline = the core promise */}
            </h2>

            <p className="mb-10 text-lg leading-relaxed text-zinc-400">
              SmartOut samler all kommunikasjon i én kanal med lest-kvittering, automatisk purring
              og full oversikt. Du sier det én gang — alle får det med seg.
              {/* CHANGED: one-sentence product summary with all three pillars */}
            </p>

            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Si det én gang. Ferdig.")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-10 py-5 text-lg font-bold text-white shadow-[0_0_40px_rgba(245,158,11,0.3)] transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-[0_0_50px_rgba(245,158,11,0.5)]"
            >
              Kom i gang — gratis <ArrowRight className="h-5 w-5" />
            </Link>

            {/* Trust signals */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-500" />
                <span>Ingen kredittkort</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-500" />
                <span>Klar på 10 minutter</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-500" />
                <span>Norske data — GDPR-kompatibel</span>
              </div>
            </div>
          </m.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
