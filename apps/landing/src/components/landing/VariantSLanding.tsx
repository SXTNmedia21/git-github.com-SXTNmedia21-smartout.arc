"use client";

// ============================================
// VariantSLanding.tsx
// Landing page Variant S — Signe (Sommelier / Editorial Elegance).
//
// Persona: A legendary sommelier at 60. 40 trained students.
// Judges software like wine — complexity, balance, elegance.
// Zero tolerance for poor UX.
//
// Design energy: Magazine elegance — serif headings (Playfair Display),
// generous white space, and deliberate restraint. No glow effects,
// no pinging dots, no gradients. Slow, elegant fade-in animations only.
// Rose-gold/burgundy accent palette.
//
// This is the ONLY variant with serif typography — that is its
// key differentiator. Everything should feel like a luxury magazine,
// not a SaaS page.
//
// Connected to:
//   - components/navigation.tsx (shared nav bar)
//   - components/footer.tsx (shared footer)
//   - lib/web-app-url.ts (CTA link destinations)
// ============================================

import Link from "next/link";
import { motion } from "framer-motion";
import { Playfair_Display } from "next/font/google";
import { Wine, BookOpen, Award, Star, Utensils, GlassWater } from "lucide-react";
import Navigation from "../navigation";
import Footer from "../footer";
import VoiceDemoWidget from "./VoiceDemoWidget";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { VARIANT_VOICE_CONFIG, VARIANT_AI_SECTION } from "../../lib/variant-voice-config";
import { usePageTracking, useTrackCta } from "../../hooks/useTracking";

/**
 * Playfair Display — the serif typeface that defines Variant S.
 * Loaded via next/font/google for automatic optimization.
 * Applied as a CSS variable so Tailwind utility classes can reference it.
 */
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

// -----------------------------------------------
// Animation presets
// Restrained, slow fades only. No bouncing, no spring physics.
// Duration 0.8-1.2s with gentle ease. Respects prefers-reduced-motion
// via the global CSS media query in globals.css.
// -----------------------------------------------

/** Gentle cubic-bezier easing used across all variant S animations */
const elegantEase = [0.25, 0.1, 0.25, 1] as const;

/** Standard fade-up for content sections */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: elegantEase },
  },
};

/** Slower fade for hero elements — more dramatic entrance */
const fadeUpSlow = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1.2, ease: elegantEase },
  },
};

/** Simple opacity fade — no vertical movement */
const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 1.0, ease: elegantEase },
  },
};

/**
 * Stagger container — children animate in sequence.
 * Delay between children is intentionally long (0.15s) for an
 * unhurried, editorial reveal.
 */
const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

// -----------------------------------------------
// Data
// Norwegian text uses Unicode escapes to preserve special characters
// through any file-encoding pipeline.
// \u00e5 = å, \u00f8 = ø, \u00e6 = æ, \u00c5 = Å, \u00d8 = Ø
// \u2014 = em dash, \u201C/\u201D = smart quotes, \u2019 = right quote
// -----------------------------------------------

/** Philosophy principles displayed in the editorial pull-quote section */
const PHILOSOPHY_PRINCIPLES = [
  "Presisjon i hvert steg",
  "Respekt for h\u00e5ndverket",
  "S\u00f8ml\u00f8s teknologi",
  "Kontinuerlig forbedring",
] as const;

/** Training features for section 3 */
const TRAINING_FEATURES = [
  {
    icon: Wine,
    title: "Skreddersydde oppl\u00e6ringsprogrammer",
    description: "Tilpasset din bedrifts unike behov, tradisjoner og kvalitetsstandarder.",
  },
  {
    icon: BookOpen,
    title: "Bransjespesifikt innhold",
    description: "Faglig innhold utviklet i samarbeid med bransjens fremste eksperter.",
  },
  {
    icon: Award,
    title: "Praktisk kompetansebygging",
    description: "Fra teori til mestring \u2014 hands-on l\u00e6ring som sitter.",
  },
] as const;

/** Progressive learning timeline stages */
const LEARNING_STAGES = [
  { label: "Ny ansatt", active: false },
  { label: "Grunnkompetanse", active: false },
  { label: "Spesialisering", active: false },
  { label: "Ekspert", active: true },
] as const;

/** Detail cards for section 5 */
const DETAIL_CARDS = [
  {
    icon: GlassWater,
    title: "Sensorisk evaluering",
    description:
      "Strukturert oppl\u00e6ring i smak, aroma og presentasjon \u2014 fra grunnleggende til avansert niv\u00e5.",
  },
  {
    icon: Wine,
    title: "Vinprogrammer",
    description: "Skreddersydde programmer for vinkart, anbefaling og salg tilpasset din meny.",
  },
  {
    icon: Utensils,
    title: "Servicestandarder",
    description:
      "Definer og vedlikehold serviceniv\u00e5et som gjestene dine fortjener \u2014 hver eneste dag.",
  },
] as const;

/** Professional network badges */
const NETWORK_BADGES = [
  "Norsk Vinkelnerforening",
  "NHO Reiseliv",
  "Bocuse d\u2019Or Norge",
] as const;

// -----------------------------------------------
// Component
// -----------------------------------------------

/**
 * VariantSLanding — the Signe variant.
 *
 * Editorial elegance landing page for SmartOut. Characterized by:
 * - Playfair Display serif headings (unique to this variant)
 * - Rose-gold/burgundy accent palette
 * - Generous white space and restrained animations
 * - Magazine-style layout with pull quotes and thin borders
 *
 * @returns The complete Variant S landing page
 */
export default function VariantSLanding() {
  usePageTracking();
  const trackCta = useTrackCta();

  return (
    <div
      className={`${playfair.variable} min-h-screen bg-zinc-950 font-sans text-white selection:bg-rose-400/30`}
    >
      {/* Shared Navigation */}
      <Navigation />

      {/* ============================================
          Section 1 — Cinematic Hero
          Full viewport, centered composition, maximum restraint.
          A single serif headline, a quiet subtitle, one ghost button.
          ============================================ */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
        {/* Cinematic restaurant interior placeholder —
            dark gradient with subtle warm tones suggesting a dimly lit,
            elegant dining room. A thin border frame implies a photograph. */}
        <div className="absolute inset-0">
          {/* Warm ambient tone in the center */}
          <div className="absolute inset-0 bg-gradient-to-b from-rose-950/10 via-zinc-950 to-zinc-950" />
          {/* Subtle horizontal warmth suggesting candlelight */}
          <div className="absolute top-1/3 right-0 left-0 h-px bg-gradient-to-r from-transparent via-rose-900/20 to-transparent" />
          <div className="absolute top-2/3 right-0 left-0 h-px bg-gradient-to-r from-transparent via-rose-900/10 to-transparent" />
          {/* Thin editorial border frame */}
          <div className="absolute inset-8 border border-white/[0.03] sm:inset-16 lg:inset-24" />
        </div>

        {/* Dark gradient overlay from bottom — grounds the text */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

        {/* Hero content — centered, generous spacing */}
        <motion.div
          className="relative z-10 mx-auto max-w-3xl text-center"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.h1
            className="font-[family-name:var(--font-playfair)] text-4xl leading-tight font-light tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
            variants={fadeUpSlow}
          >
            {/* "Håndverk møter teknologi." */}H{"\u00e5"}ndverk m{"\u00f8"}ter teknologi.
          </motion.h1>

          <motion.p
            className="mx-auto mt-8 max-w-md text-base leading-relaxed text-zinc-400 sm:text-lg"
            variants={fadeUp}
          >
            {/* "SmartOut gjør dine ansatte klare fra dag én" */}
            SmartOut gj{"\u00f8"}r dine ansatte klare fra dag {"\u00e9"}n{" \u2014 "}med presisjon,
            respekt og teknologi i balanse.
          </motion.p>

          <motion.div className="mt-12" variants={fadeUp}>
            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Utforsk SmartOut")}
              className="inline-block border border-rose-300/30 px-8 py-3.5 text-sm font-medium tracking-widest text-rose-200 uppercase transition-colors duration-500 hover:border-rose-300/60 hover:text-white"
            >
              Utforsk SmartOut
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ============================================
          Section 2 — Philosophy
          Two-column editorial layout. Left: a large pull quote in
          serif italic. Right: four principles with rose-gold markers.
          ============================================ */}
      <section className="px-6 py-24 lg:py-32">
        <motion.div
          className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-2 lg:gap-24"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
        >
          {/* Left — Editorial pull quote */}
          <motion.div variants={fadeUp}>
            <blockquote className="font-[family-name:var(--font-playfair)] text-2xl leading-relaxed font-light text-zinc-300 italic sm:text-3xl lg:text-4xl">
              {"\u201C"}Ekte kvalitet oppst{"\u00e5"}r n{"\u00e5"}r tradisjon og innovasjon finner
              balanse. Teknologi skal ikke erstatte h{"\u00e5"}ndverket {"\u2014"} den skal l
              {"\u00f8"}fte det. Slik skaper vi en ny standard for oppl{"\u00e6"}ring og utvikling i
              bransjen.{"\u201D"}
            </blockquote>
          </motion.div>

          {/* Right — Principles list */}
          <motion.div className="flex flex-col justify-center" variants={staggerContainer}>
            <motion.p
              className="mb-8 text-xs font-medium tracking-[0.2em] text-zinc-500 uppercase"
              variants={fadeIn}
            >
              {/* "Våre prinsipper" */}V{"\u00e5"}re prinsipper
            </motion.p>
            <ul className="space-y-6">
              {PHILOSOPHY_PRINCIPLES.map((principle) => (
                <motion.li key={principle} className="flex items-center gap-4" variants={fadeUp}>
                  {/* Rose-gold bullet marker */}
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-rose-400/70" />
                  <span className="text-lg text-zinc-200">{principle}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </section>

      {/* Thin divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-white/[0.06]" />
      </div>

      {/* ============================================
          Section 3 — Custom Training
          Serif heading + elegant training visualization + 3 features
          with rose-gold icons.
          ============================================ */}
      <section className="px-6 py-24 lg:py-32">
        <motion.div
          className="mx-auto max-w-6xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
        >
          {/* Section heading */}
          <motion.div className="mb-20 max-w-2xl" variants={fadeUp}>
            <p className="mb-4 text-xs font-medium tracking-[0.2em] text-rose-400/80 uppercase">
              {/* "Opplæring" */}
              Oppl{"\u00e6"}ring
            </p>
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl leading-tight font-light tracking-tight text-white sm:text-4xl lg:text-5xl">
              {/* "Opplæring skreddersydd til ditt håndverk." */}
              Oppl{"\u00e6"}ring skreddersydd til ditt h{"\u00e5"}ndverk.
            </h2>
          </motion.div>

          {/* Elegant stepped training path visualization —
              ascending bars suggesting progressive mastery, like a
              sommelier's tasting flight from light to full-bodied. */}
          <motion.div
            className="mb-20 flex items-end justify-center gap-3 sm:gap-4"
            variants={fadeIn}
          >
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex flex-col items-center gap-2">
                <div
                  className="rounded-sm border border-rose-900/30 bg-rose-950/20"
                  style={{
                    width: "clamp(32px, 8vw, 64px)",
                    height: `${step * 28 + 20}px`,
                  }}
                />
                <span className="text-[10px] text-zinc-600">{step}</span>
              </div>
            ))}
          </motion.div>

          {/* Feature items */}
          <motion.div
            className="grid gap-12 md:grid-cols-3 md:gap-8 lg:gap-12"
            variants={staggerContainer}
          >
            {TRAINING_FEATURES.map((feature) => (
              <motion.div key={feature.title} variants={fadeUp}>
                <feature.icon className="mb-5 h-6 w-6 text-rose-400/70" strokeWidth={1.5} />
                <h3 className="mb-3 font-[family-name:var(--font-playfair)] text-xl font-light text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Thin divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-white/[0.06]" />
      </div>

      {/* ============================================
          Section 4 — Progressive Learning
          Horizontal timeline with 4 stages connected by thin lines.
          Rose-gold accent on the final "Ekspert" stage.
          ============================================ */}
      <section className="px-6 py-24 lg:py-32">
        <motion.div
          className="mx-auto max-w-4xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
        >
          <motion.div className="mb-16 text-center" variants={fadeUp}>
            <p className="mb-4 text-xs font-medium tracking-[0.2em] text-rose-400/80 uppercase">
              Utvikling
            </p>
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl leading-tight font-light tracking-tight text-white sm:text-4xl">
              Fra ny ansatt til ekspert.
            </h2>
          </motion.div>

          {/* Timeline — horizontal with connecting line and 4 stage circles */}
          <motion.div className="relative flex items-center justify-between" variants={fadeIn}>
            {/* Connecting line behind the circles */}
            <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-zinc-800" />

            {LEARNING_STAGES.map((stage, index) => (
              <div key={stage.label} className="relative z-10 flex flex-col items-center gap-3">
                {/* Stage circle */}
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border sm:h-12 sm:w-12 ${
                    stage.active
                      ? "border-rose-400/60 bg-rose-950/40"
                      : "border-zinc-700 bg-zinc-900"
                  }`}
                >
                  <span
                    className={`text-xs font-medium sm:text-sm ${
                      stage.active ? "text-rose-300" : "text-zinc-500"
                    }`}
                  >
                    {index + 1}
                  </span>
                </div>

                {/* Stage label */}
                <span
                  className={`max-w-[80px] text-center text-[11px] leading-tight sm:max-w-none sm:text-xs ${
                    stage.active ? "font-medium text-rose-300" : "text-zinc-500"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Thin divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-white/[0.06]" />
      </div>

      {/* ============================================
          Section 5 — Detail & Precision
          Three thin-bordered cards with maximum interior white space.
          Each has a small rose-gold icon, a serif heading, and
          1-2 lines of body text.
          ============================================ */}
      <section className="px-6 py-24 lg:py-32">
        <motion.div
          className="mx-auto max-w-6xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
        >
          <motion.div className="mb-16" variants={fadeUp}>
            <p className="mb-4 text-xs font-medium tracking-[0.2em] text-rose-400/80 uppercase">
              Kvalitet
            </p>
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl leading-tight font-light tracking-tight text-white sm:text-4xl lg:text-5xl">
              {/* "Detaljer som gjør forskjellen." */}
              Detaljer som gj{"\u00f8"}r forskjellen.
            </h2>
          </motion.div>

          <motion.div className="grid gap-6 md:grid-cols-3" variants={staggerContainer}>
            {DETAIL_CARDS.map((card) => (
              <motion.div
                key={card.title}
                className="border border-white/[0.06] p-8 sm:p-10 lg:p-12"
                variants={fadeUp}
              >
                <card.icon className="mb-8 h-5 w-5 text-rose-400/60" strokeWidth={1.5} />
                <h3 className="mb-4 font-[family-name:var(--font-playfair)] text-lg font-light text-white lg:text-xl">
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">{card.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Thin divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-white/[0.06]" />
      </div>

      {/* ============================================
          Section 6 — Professional Network
          Understated horizontal badge row. Thin borders, small text.
          No logos — just names, because restraint is the point.
          ============================================ */}
      <section className="px-6 py-24 lg:py-32">
        <motion.div
          className="mx-auto max-w-4xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
        >
          <motion.p
            className="mb-12 text-xs font-medium tracking-[0.2em] text-zinc-500 uppercase"
            variants={fadeIn}
          >
            Anerkjent av bransjens beste
          </motion.p>

          <motion.div
            className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6"
            variants={staggerContainer}
          >
            {NETWORK_BADGES.map((badge) => (
              <motion.div
                key={badge}
                className="flex items-center gap-2.5 border border-white/[0.06] px-6 py-3"
                variants={fadeUp}
              >
                <Star className="h-3.5 w-3.5 text-rose-400/50" strokeWidth={1.5} />
                <span className="text-sm text-zinc-300">{badge}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Thin divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-white/[0.06]" />
      </div>

      {/* ============================================
          Section 7 — SmartOut AI
          Two-column editorial layout: left shows thin-bordered
          capability cards, right holds the voice demo widget.
          Rose-gold accents, serif headings, no glow or pulse.
          ============================================ */}
      <section id="smartout-ai" className="px-6 py-24 lg:py-32">
        <motion.div
          className="mx-auto max-w-6xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
        >
          {/* Section heading — left-aligned editorial style */}
          <motion.div className="mb-20 max-w-2xl" variants={fadeUp}>
            <p className="mb-4 text-xs font-medium tracking-[0.2em] text-rose-400/80 uppercase">
              Intelligens
            </p>
            <h2 className="font-[family-name:var(--font-playfair)] text-3xl leading-tight font-light tracking-tight text-white sm:text-4xl lg:text-5xl">
              {VARIANT_AI_SECTION.S.heading}
            </h2>
          </motion.div>

          {/* Two-column: capabilities on left, voice widget on right */}
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left — 3 thin-bordered capability cards */}
            <motion.div className="space-y-6" variants={staggerContainer}>
              {VARIANT_AI_SECTION.S.capabilities.map((cap) => (
                <motion.div
                  key={cap.title}
                  className="border border-white/[0.06] p-8"
                  variants={fadeUp}
                >
                  <h3 className="mb-3 font-[family-name:var(--font-playfair)] text-lg font-light text-white">
                    {cap.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{cap.description}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Right — Voice demo widget */}
            <motion.div variants={fadeUp}>
              <VoiceDemoWidget config={VARIANT_VOICE_CONFIG.S} height="460px" />
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Thin divider */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="h-px bg-white/[0.06]" />
      </div>

      {/* ============================================
          Section 8 — CTA
          Minimal. Serif headline, one elegant button.
          No glow effects, no gradients, no embellishments.
          ============================================ */}
      <section className="px-6 py-32 lg:py-40">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
        >
          <motion.h2
            className="font-[family-name:var(--font-playfair)] text-3xl leading-tight font-light tracking-tight text-white sm:text-4xl lg:text-5xl"
            variants={fadeUpSlow}
          >
            {/* "Er du klar til å sette en ny standard?" */}
            Er du klar til {"\u00e5"} sette en ny standard?
          </motion.h2>

          <motion.div className="mt-12" variants={fadeUp}>
            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Kom i gang")}
              className="inline-block border border-rose-300/30 px-8 py-3.5 text-sm font-medium tracking-widest text-rose-200 uppercase transition-colors duration-500 hover:border-rose-300/60 hover:text-white"
            >
              Kom i gang
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}
