// ============================================
// VariantILanding.tsx
// Landing page variant I — "En kollega som aldri glemmer" (AI colleague perspective).
// Persona: Marte, 38, restaurantsjef, tech-curious but needs concrete daily value.
// AI is framed as a helpful colleague, not scary tech. Warm, human, specific to hospitality.
// Design energy: Conversation bubbles, gentle glow effects, human-AI interaction mockups.
// Accent color: violet (violet-400/500).
// Connected to: app/page.tsx (variant switcher)
// ============================================

"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { usePageTracking, useTrackCta } from "../../hooks/useTracking";
import { useScrollTracking } from "../../hooks/useScrollTracking";
import { useClickTracking } from "../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../hooks/useSessionLifecycle";
import {
  ArrowRight,
  CheckCircle2,
  X,
  MessageCircle,
  Eye,
  Brain,
  Lightbulb,
  Shield,
  Lock,
  Server,
  Heart,
} from "lucide-react";
import Navigation from "../navigation";
import Footer from "../footer";
import { WEB_APP_LINKS } from "../../lib/web-app-url";

// -----------------------------------------------
// Shared animation variants for scroll-reveal.
// -----------------------------------------------

/** Standard fade-up animation used by most section wrappers. */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

/** Stagger container — children animate one after another. */
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

/** Conversation bubble pop-in — gentle scale + opacity for chat mockups. */
const bubblePop = {
  hidden: { opacity: 0, scale: 0.92, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

/** Stagger container with slower spacing — for conversation flow. */
const conversationStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.3 } },
};

// -----------------------------------------------
// Data arrays — kept outside the component to
// avoid re-creating on every render.
// -----------------------------------------------

/** Conversation scenarios — the heart of this variant. */
const conversations = [
  {
    id: "allergy",
    // CHANGED: specific hospitality scenario — allergy documentation expiring
    liseMessage:
      "Hei Marte, husker du at allergidokumentasjonen utløper fredag? Tre ansatte mangler oppdatering.",
    marteReply: "Oi, det hadde jeg glemt. Send dem en påminnelse?",
    liseFollowup: "Allerede sendt. De får en lenke til e-læringen nå.",
    icon: MessageCircle,
    label: "Compliance-varsling",
  },
  {
    id: "fire-drill",
    // CHANGED: proactive safety compliance — fire drill certificates
    liseMessage:
      "3 ansatte mangler brannøvelse-sertifikat. Neste tilsyn er om 6 uker. Skal jeg sende påminnelse?",
    marteReply: "Ja, og legg det inn i vaktplanen så de rekker det.",
    liseFollowup: "Fikset. Brannøvelse er lagt inn tirsdag 14:00 for alle tre.",
    icon: Shield,
    label: "Sikkerhet",
  },
  {
    id: "staffing",
    // CHANGED: intelligent staffing suggestion based on bookings
    liseMessage:
      "Basert på bookingene i kveld foreslår jeg at du kaller inn én ekstra servitør. Sist fredag med samme belegg ble det overtid.",
    marteReply: "Godt poeng. Hvem er tilgjengelig?",
    liseFollowup: "Jonas og Thea har begge sagt de kan ta ekstra. Skal jeg spørre Jonas først?",
    icon: Lightbulb,
    label: "Bemanningsforslag",
  },
];

/** Before/After comparison items. */
const beforeItems = [
  "Glemmer å fornye sertifikater — oppdager det ved tilsyn", // CHANGED: consequence-driven, real scenario
  "Husker ikke hvem som kan hva av de nye", // CHANGED: relatable — competence gaps in new hires
  "Ringer rundt for å finne noen som kan ta ekstra vakt", // CHANGED: manual process pain
  "Post-it-lapper med ting som «må fikses snart»", // CHANGED: vivid, recognisable chaos
  "Bruker kvelden på admin i stedet for gjestene", // CHANGED: opportunity cost — time away from service
];

const afterItems = [
  "Automatisk varsling før sertifikater utløper", // CHANGED: maps to before pain #1
  "Kompetanseoversikt oppdatert i sanntid", // CHANGED: maps to before pain #2
  "Lise foreslår tilgjengelige ansatte basert på data", // CHANGED: maps to before pain #3
  "Strukturerte oppgaver med automatisk oppfølging", // CHANGED: maps to before pain #4
  "Mer tid på gulvet, mindre tid foran skjermen", // CHANGED: the ultimate benefit
];

/** How Lise learns — three-step process. */
const learningSteps = [
  {
    icon: Eye,
    step: "01",
    title: "Observerer",
    // CHANGED: specific to daily restaurant operations
    description:
      "Lise følger med på vaktplaner, bookinger, sertifikatfrister og HMS-krav. Hun ser mønstrene du ikke rekker å se.",
  },
  {
    icon: Brain,
    step: "02",
    title: "Husker",
    // CHANGED: memory as the superpower — the "aldri glemmer" promise
    description:
      "Alt som skjer lagres og kobles sammen. Hvem tok brannøvelse. Når allergidokumentasjonen utløper. Hva som skjedde forrige fredag.",
  },
  {
    icon: Lightbulb,
    step: "03",
    title: "Foreslår",
    // CHANGED: proactive, not reactive — this is the key differentiator
    description:
      "Basert på det hun vet, kommer Lise med konkrete forslag — før du rekker å tenke på det selv. Du bestemmer alltid.",
  },
];

/** Trust points — data sovereignty and control. */
const trustPoints = [
  {
    icon: Server,
    title: "Dataene dine blir i Norge",
    // CHANGED: specific data sovereignty — important for Norwegian businesses
    description:
      "All data lagres på norske servere. Ingen tredjeparter ser informasjonen din uten ditt samtykke.",
  },
  {
    icon: Lock,
    title: "Du bestemmer hva Lise ser",
    // CHANGED: control narrative — you're in charge, not the AI
    description:
      "Du velger hvilke systemer Lise har tilgang til. Vaktplan, bookinger, HMS — du styrer grensene.",
  },
  {
    icon: Heart,
    title: "Bygget for å hjelpe, ikke overvåke",
    // CHANGED: trust framing — AI as support, not surveillance
    description:
      "Lise gir deg oversikt og forslag. Hun rapporterer ikke til noen over deg. Dette er ditt verktøy.",
  },
];

// -----------------------------------------------
// Subcomponents
// -----------------------------------------------

/**
 * ConversationBubble — renders a single message in the chat mockup.
 * Lise messages are left-aligned with violet accent. Marte messages
 * are right-aligned with a neutral dark background.
 */
function ConversationBubble({
  sender,
  message,
  isLise,
}: {
  sender: string;
  message: string;
  isLise: boolean;
}) {
  return (
    <m.div
      variants={bubblePop}
      transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
      className={`flex ${isLise ? "justify-start" : "justify-end"}`}
    >
      <div className={`max-w-[85%] ${isLise ? "" : "text-right"}`}>
        <p className={`mb-1 text-xs font-semibold ${isLise ? "text-violet-400" : "text-zinc-500"}`}>
          {sender}
        </p>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isLise
              ? "rounded-tl-sm border border-violet-500/20 bg-violet-500/10 text-zinc-200"
              : "rounded-tr-sm border border-zinc-700/50 bg-zinc-800/80 text-zinc-300"
          }`}
        >
          {message}
        </div>
      </div>
    </m.div>
  );
}

// UI Events:
// - nav: WEB_APP_LINKS.onboarding (hero CTA, final CTA)
// - action: trackCta("Møt Lise") (hero button)
// - action: trackCta("Prøv gratis") (hero secondary)
// - action: trackCta("Møt din nye kollega") (final CTA)
// - scroll-tracking: automatic via useScrollTracking
// - click-tracking: automatic via useClickTracking
// - color-regime: violet accent throughout

/**
 * VariantILanding — AI Colleague perspective variant.
 *
 * Targets tech-curious restaurant managers who want to understand
 * what AI actually DOES in their daily work. Framing: AI as a warm,
 * helpful colleague with perfect memory — not a scary robot.
 *
 * Six sections: Hero, What Lise Does (conversation mockups),
 * Before/After, How She Learns, Trust & Privacy, Final CTA.
 *
 * @returns The full Variant I landing page component.
 */
export default function VariantILanding() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const trackCta = useTrackCta();

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white selection:bg-violet-500/30">
      {/* Shared Navigation */}
      <Navigation />

      {/* ============================================
          Section 1 — Hero
          Centered layout. The headline is the promise:
          "En kollega som aldri glemmer." Warm, human,
          with a violet glow and a small conversational
          teaser below the subtitle.
          ============================================ */}
      <section className="relative px-6 pt-32 pb-20 lg:pt-48 lg:pb-32">
        {/* Violet glow orbs */}
        <div className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-500/5 blur-3xl" />
        <div className="pointer-events-none absolute top-20 right-0 -z-10 h-[300px] w-[300px] rounded-full bg-violet-400/5 blur-3xl" />

        <m.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          {/* Category badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1">
            <MessageCircle className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-xs font-bold tracking-wider text-violet-400 uppercase">
              {/* CHANGED: frames AI as colleague, not technology */}
              Din AI-kollega
            </span>
          </div>

          <h1 className="mb-6 text-5xl leading-[1.08] font-black tracking-tight lg:text-7xl">
            En kollega som{" "}
            <span className="bg-gradient-to-r from-violet-400 to-violet-600 bg-clip-text text-transparent">
              {/* CHANGED: the core promise — perfect memory, human helpfulness */}
              aldri glemmer.
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400 lg:text-xl">
            {/* CHANGED: grounds the AI promise in daily restaurant reality */}
            Lise husker hvem som mangler sertifikater, når bookingene tilsier ekstra bemanning, og
            hva som gikk galt forrige fredag. Hun er ikke en robot — hun er en kollega med perfekt
            hukommelse.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Møt Lise")}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-8 py-4 font-bold text-white shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-all hover:bg-violet-400 hover:shadow-[0_0_40px_rgba(139,92,246,0.5)]"
            >
              Møt Lise <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Prøv gratis")}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-8 py-4 text-center font-bold text-white transition-all hover:border-zinc-700 hover:bg-zinc-800"
            >
              Prøv gratis — ingen kortinfo
            </Link>
          </div>

          {/* Mini conversation teaser — a taste of what's coming */}
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mx-auto mt-16 max-w-md"
          >
            <div className="rounded-2xl border border-zinc-800/50 bg-[#0c0c0e] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15">
                  <MessageCircle className="h-4 w-4 text-violet-400" />
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-semibold text-violet-400">Lise</p>
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {/* CHANGED: warm, specific opening line — sets the tone for the whole page */}
                    God morgen, Marte! Tre ting å vite før vakten starter...
                  </p>
                </div>
              </div>
            </div>
          </m.div>
        </m.div>
      </section>

      {/* ============================================
          Section 2 — What Lise Does
          Three concrete daily scenarios shown as mini
          conversation mockups. This is the KEY section
          — it makes AI tangible through real dialogue.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        {/* Subtle violet glow */}
        <div className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[400px] w-[400px] rounded-full bg-violet-500/5 blur-3xl" />

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
              {/* CHANGED: frames it as daily value, not feature list */}
              Slik hjelper Lise deg{" "}
              <span className="bg-gradient-to-r from-violet-400 to-violet-600 bg-clip-text text-transparent">
                hver dag.
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400">
              {/* CHANGED: sets up the conversation mockups with context */}
              Tre situasjoner fra en vanlig uke. Marte er restaurantsjef. Lise er AI-kollegaen
              hennes.
            </p>
          </m.div>

          <div className="grid gap-10 lg:grid-cols-3">
            {conversations.map((convo, index) => (
              <m.div
                key={convo.id}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="group"
              >
                {/* Scenario label */}
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                    <convo.icon className="h-[18px] w-[18px] text-violet-400" />
                  </div>
                  <span className="text-xs font-bold tracking-wider text-violet-400 uppercase">
                    {convo.label}
                  </span>
                </div>

                {/* Conversation card */}
                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0e] transition-all group-hover:border-violet-500/20">
                  <m.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={conversationStagger}
                    className="space-y-3 p-5"
                  >
                    <ConversationBubble sender="Lise" message={convo.liseMessage} isLise />
                    <ConversationBubble sender="Marte" message={convo.marteReply} isLise={false} />
                    <ConversationBubble sender="Lise" message={convo.liseFollowup} isLise />
                  </m.div>

                  {/* Status indicator */}
                  <div className="border-t border-zinc-800/50 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
                      </span>
                      <span className="text-xs text-zinc-500">Lise er aktiv</span>
                    </div>
                  </div>
                </div>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          Section 3 — Before / After
          Split view: left = "Uten AI" (chaos),
          right = "Med Lise" (calm). Uses rose/red for
          the pain side, violet/green for the solved side.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        <div className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-violet-500/5 blur-3xl" />

        <div className="mx-auto max-w-5xl">
          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
              {/* CHANGED: personal framing — your day, your reality */}
              Martes hverdag —{" "}
              <span className="bg-gradient-to-r from-violet-400 to-violet-600 bg-clip-text text-transparent">
                før og etter.
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400">
              {/* CHANGED: empathetic framing — we know the chaos */}
              Ikke fordi hun gjør noe feil. Men fordi det er umulig å huske alt selv.
            </p>
          </m.div>

          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-8 md:grid-cols-2"
          >
            {/* Before panel */}
            <m.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8"
            >
              <h3 className="mb-6 text-lg font-bold text-rose-400">Uten AI-kollega</h3>
              <ul className="space-y-4">
                {beforeItems.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
                      <X className="h-4 w-4 text-rose-400" />
                    </div>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            </m.div>

            {/* After panel */}
            <m.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-8"
            >
              <h3 className="mb-6 text-lg font-bold text-violet-400">Med Lise</h3>
              <ul className="space-y-4">
                {afterItems.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                      <CheckCircle2 className="h-4 w-4 text-violet-400" />
                    </div>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            </m.div>
          </m.div>
        </div>
      </section>

      {/* ============================================
          Section 4 — How She Learns
          Three steps: observerer → husker → foreslår.
          Connected with a subtle line, each step fading
          in with a slight delay for sequential reading.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        <div className="pointer-events-none absolute top-1/2 right-0 -z-10 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-violet-500/5 blur-3xl" />

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
              {/* CHANGED: demystifies AI — shows the process, not the magic */}
              Hvordan Lise{" "}
              <span className="bg-gradient-to-r from-violet-400 to-violet-600 bg-clip-text text-transparent">
                lærer.
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400">
              {/* CHANGED: no black box — transparent process */}
              Ingen magi. Ingen mystikk. Bare tre steg som gjør hverdagen din lettere.
            </p>
          </m.div>

          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-8 md:grid-cols-3"
          >
            {learningSteps.map((step, index) => (
              <m.div
                key={step.title}
                variants={fadeUp}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all hover:border-violet-500/30 hover:bg-zinc-900"
              >
                {/* Step number */}
                <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 transition-colors group-hover:bg-violet-500/20">
                    <step.icon className="h-6 w-6 text-violet-400" />
                  </div>
                  <span className="text-3xl font-black text-violet-500/20">{step.step}</span>
                </div>

                <h3 className="mb-3 text-xl font-bold text-white">{step.title}</h3>
                <p className="leading-relaxed text-zinc-400">{step.description}</p>

                {/* Connector line between cards (hidden on mobile, shown on md+) */}
                {index < learningSteps.length - 1 && (
                  <div className="absolute top-1/2 -right-4 hidden h-px w-8 bg-gradient-to-r from-violet-500/30 to-transparent md:block" />
                )}
              </m.div>
            ))}
          </m.div>
        </div>
      </section>

      {/* ============================================
          Section 5 — Trust & Privacy
          "Lise jobber for deg, ikke omvendt."
          Three trust points covering data sovereignty,
          user control, and AI ethics. Warm, reassuring.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-violet-500/[0.03] to-transparent" />

        <div className="mx-auto max-w-5xl">
          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-4xl font-bold tracking-tight lg:text-5xl">
              {/* CHANGED: trust headline — AI serves you, not the other way around */}
              Lise jobber for deg.{" "}
              <span className="bg-gradient-to-r from-violet-400 to-violet-600 bg-clip-text text-transparent">
                Ikke omvendt.
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400">
              {/* CHANGED: addresses the real concern — AI surveillance/control */}
              Vi vet at AI kan føles skummelt. Derfor har vi bygget Lise med én regel: du har alltid
              kontrollen.
            </p>
          </m.div>

          <m.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid gap-8 md:grid-cols-3"
          >
            {trustPoints.map((point) => (
              <m.div
                key={point.title}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-all hover:border-violet-500/30 hover:bg-zinc-900"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 transition-colors group-hover:bg-violet-500/20">
                  <point.icon className="h-6 w-6 text-violet-400" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-white">{point.title}</h3>
                <p className="leading-relaxed text-zinc-400">{point.description}</p>
              </m.div>
            ))}
          </m.div>
        </div>
      </section>

      {/* ============================================
          Section 6 — Final CTA
          Warm close: "Møt din nye kollega." Personal,
          inviting, low-pressure. The feeling should be
          "I want to try this" not "I need to buy this."
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent" />

        <m.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          {/* Lise avatar — a warm, human touch before the CTA */}
          <m.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
            className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10"
          >
            <MessageCircle className="h-9 w-9 text-violet-400" />
          </m.div>

          <h2 className="mb-6 text-4xl font-bold tracking-tight lg:text-5xl">
            {/* CHANGED: warm, personal CTA — meeting a colleague, not buying software */}
            Møt din{" "}
            <span className="bg-gradient-to-r from-violet-400 to-violet-600 bg-clip-text text-transparent">
              nye kollega.
            </span>
          </h2>
          <p className="mb-10 text-lg leading-relaxed text-zinc-400">
            {/* CHANGED: low-pressure, conversational close */}
            Lise er klar til å hjelpe. Ingen kredittkort, ingen bindingstid — bare en kollega som
            husker alt du ikke rekker.
          </p>

          <Link
            href={WEB_APP_LINKS.onboarding}
            onClick={() => trackCta("Møt din nye kollega")}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-10 py-5 text-lg font-bold text-white shadow-[0_0_40px_rgba(139,92,246,0.3)] transition-all hover:bg-violet-400 hover:shadow-[0_0_50px_rgba(139,92,246,0.5)]"
          >
            Møt din nye kollega <ArrowRight className="h-5 w-5" />
          </Link>

          {/* Trust signals */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-500" />
              <span>Gratis å prøve</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-500" />
              <span>Oppsett på 10 minutter</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-500" />
              <span>Norske servere</span>
            </div>
          </div>
        </m.div>
      </section>

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}
