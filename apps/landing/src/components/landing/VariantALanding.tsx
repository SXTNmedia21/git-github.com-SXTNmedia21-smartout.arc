// ============================================
// VariantALanding.tsx
// Landing page variant A — "Ahmad" persona.
// Designed for immigrant workers and career progression seekers.
// Ahmad is 60 with 37 years in Norwegian hospitality. He remembers
// language barriers. Values warmth, visual clarity, and dignity.
//
// Design energy: Warm, visual — large icons, simple words, career path.
// Accent: Amber/gold (amber-400/500/600).
// Key differentiators: Maximum visual / minimum text, 96px+ icons,
// multi-language badges, career timeline, warm amber glow.
//
// Connected to: app/page.tsx (variant switcher)
// Connected to: components/navigation.tsx (shared nav)
// Connected to: components/footer.tsx (shared footer)
// Connected to: lib/web-app-url.ts (CTA destinations)
// ============================================

"use client";

import Link from "next/link";
import { m } from "framer-motion";
import {
  BookOpen,
  CheckCircle,
  TrendingUp,
  Shield,
  Globe,
  Heart,
  Star,
  UserCheck,
  Award,
  Quote,
  Mic,
} from "lucide-react";
import Navigation from "../navigation";
import Footer from "../footer";
import VoiceDemoWidget from "./VoiceDemoWidget";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { VARIANT_VOICE_CONFIG, VARIANT_AI_SECTION } from "../../lib/variant-voice-config";
import { usePageTracking, useTrackCta } from "../../hooks/useTracking";
import { useScrollTracking } from "../../hooks/useScrollTracking";
import { useClickTracking } from "../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../hooks/useSessionLifecycle";

// ============================================
// Animation variants
// High-class motion design: layered entrances, ambient loops,
// spring physics, and staggered reveals. Every section has a
// distinct animation personality while sharing a cohesive feel.
// ============================================

/** Fade-in from below — baseline scroll-reveal */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

/** Hero title — scales up from slightly small with a blur clear */
const heroReveal = {
  hidden: { opacity: 0, y: 40, scale: 0.96, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
};

/** Hero subtitle — slides in from below with slight delay feel */
const heroSubtitle = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/** Hero CTA buttons — fade in and scale up with spring */
const heroCta = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

/** Card entrance — rises with a subtle scale for depth */
const cardReveal = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

/** Timeline node — scales in from center with spring bounce */
const nodeReveal = {
  hidden: { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1 },
};

/** Individual language pill — fades in with slight upward drift */
const pillReveal = {
  hidden: { opacity: 0, y: 12, scale: 0.85 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

/** Quote block — subtle scale + fade from center */
const quoteReveal = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1 },
};

/** Stagger children — used on card grids and lists */
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

/** Faster stagger for dense item groups like language pills */
const staggerFast = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

/** Shared viewport config — animate once when 20% visible */
const viewportOnce = { once: true, amount: 0.2 } as const;

// ============================================
// Data
// All section content in one place for easy editing.
// ============================================

/** Three-step onboarding cards for the "How It Works" section */
const HOW_IT_WORKS_STEPS = [
  {
    icon: BookOpen,
    title: "Laer i ditt tempo",
    description: "Opplaering med bilder, video og ditt sprak.",
  },
  {
    icon: CheckCircle,
    title: "Vis at du kan",
    description: "Fullfoor oppgaver og bli godkjent.",
  },
  {
    icon: TrendingUp,
    title: "Voks i jobben",
    description: "Bygg kompetanse og fa nye muligheter.",
  },
] as const;

/** Supported languages displayed as pills */
const SUPPORTED_LANGUAGES = [
  "Norsk",
  "Polski",
  "English",
  "Somali",
  "Arabisk",
  "Tigrinja",
  "Urdu",
  "Dari",
  "Litauisk",
  "Thai",
  "Tagalog",
  "Rumensk",
  "Spansk",
  "Portugisisk",
  "Vietnamesisk",
] as const;

/** Career progression timeline stages */
const CAREER_STAGES = [
  {
    icon: Star,
    title: "Ny ansatt",
    description: "Du starter her. Alt du trenger er tilgjengelig.",
  },
  {
    icon: UserCheck,
    title: "Opplaert og klar",
    description: "Du har fullfoort opplaeringen. Du er godkjent.",
  },
  {
    icon: Award,
    title: "Erfaren og respektert",
    description: "Du mestrer jobben. Du veileder andre.",
  },
] as const;

/** Privacy bullet points for the trust section */
const PRIVACY_POINTS = [
  "Ingen overvaaking av deg som person",
  "Kun opplaeringsfremgang deles med leder",
  "Du eier din egen kompetanseprofil",
] as const;

/**
 * Variant A landing page — Ahmad persona.
 *
 * Warm, visual landing page targeting immigrant workers in Norwegian
 * hospitality. Emphasizes simplicity, multi-language support, and
 * career progression. Uses amber/gold as the accent color throughout.
 *
 * Why this design: Ahmad represents workers who may face language
 * barriers and need visual clarity over dense text. Every section
 * uses large icons (96px+), short headlines (3 words), and single-
 * sentence descriptions to communicate without requiring fluent Norwegian.
 *
 * @returns The full landing page with 7 sections + nav + footer
 */
export default function VariantALanding() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const trackCta = useTrackCta();

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white selection:bg-amber-500/30">
      {/* Shared Navigation */}
      <Navigation />

      {/* ============================================
          Section 1: Hero
          Warm amber gradient background with large headline,
          subtitle, and two action buttons.
          ============================================ */}
      <section className="relative px-6 pt-32 pb-20 lg:pt-48 lg:pb-32">
        {/* Subtle amber gradient wash behind the hero content */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-900/10 to-transparent" />

        {/* Animated radial glow — slow breathing warmth */}
        <m.div
          className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/5 blur-3xl"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Secondary orbiting glow — offset for depth */}
        <m.div
          className="pointer-events-none absolute top-1/3 left-1/3 h-[400px] w-[400px] rounded-full bg-amber-600/3 blur-3xl"
          animate={{
            x: [0, 60, 0, -60, 0],
            y: [0, -40, 0, 40, 0],
            scale: [0.8, 1, 0.8],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        <m.div
          className="relative z-10 mx-auto max-w-4xl text-center"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <m.h1
            className="mb-6 text-5xl font-black tracking-tight lg:text-7xl"
            variants={heroReveal}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            Jobb med{" "}
            <m.span
              className="inline-block bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              style={{ backgroundSize: "200% 200%" }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              trygghet.
            </m.span>
          </m.h1>

          <m.p
            className="mx-auto mb-10 max-w-2xl text-xl text-zinc-300 lg:text-2xl"
            variants={heroSubtitle}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            SmartOut gj&oslash;r deg klar for jobben — p&aring; ditt spr&aring;k.
          </m.p>

          <m.div
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            variants={heroCta}
            transition={{
              duration: 0.6,
              delay: 0.4,
              type: "spring",
              stiffness: 200,
              damping: 20,
            }}
          >
            {/* Primary CTA — amber filled button with hover glow */}
            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Kom i gang")}
              className="inline-flex items-center rounded-full bg-amber-500 px-8 py-4 text-lg font-bold text-zinc-950 shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-shadow duration-300 hover:shadow-[0_0_50px_rgba(245,158,11,0.5)]"
            >
              Kom i gang
            </Link>

            {/* Secondary CTA — ghost button with hover glow */}
            <button
              type="button"
              onClick={() => trackCta("Se video")}
              className="inline-flex items-center rounded-full border border-white/10 px-8 py-4 text-lg font-semibold text-zinc-300 transition-all duration-300 hover:border-amber-500/30 hover:text-white hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]"
            >
              Se video
            </button>
          </m.div>
        </m.div>
      </section>

      {/* ============================================
          Section 2: How It Works
          Three giant icon cards explaining the onboarding
          process in simple, visual steps.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        <m.div
          className="mx-auto max-w-5xl"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
        >
          <m.h2
            className="mb-16 text-center text-3xl font-bold tracking-tight lg:text-4xl"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            Enkelt. I tre steg.
          </m.h2>

          <div className="grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <m.div
                key={step.title}
                className="group flex flex-col items-center rounded-3xl border border-white/5 bg-white/[0.02] p-10 text-center transition-all duration-500 hover:border-amber-500/20 hover:bg-amber-500/[0.03] hover:shadow-[0_8px_40px_rgba(245,158,11,0.06)]"
                variants={cardReveal}
                transition={{
                  duration: 0.6,
                  delay: i * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {/* 96px icon — static, color shift on hover */}
                <step.icon
                  className="mb-6 h-24 w-24 text-amber-400 transition-colors duration-500 group-hover:text-amber-300"
                  strokeWidth={1.2}
                />
                <h3 className="mb-3 text-2xl font-bold">{step.title}</h3>
                <p className="text-base text-zinc-400">{step.description}</p>
              </m.div>
            ))}
          </div>
        </m.div>
      </section>

      {/* ============================================
          Section 3: Multi-Language Badge
          Shows 15+ supported languages as colorful pills.
          Communicates inclusivity at a glance.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        <m.div
          className="mx-auto max-w-4xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
        >
          {/* Globe icon — slow spin for a worldly feel */}
          <m.div
            className="mb-6 flex justify-center"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            <m.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            >
              <Globe className="h-16 w-16 text-amber-400" strokeWidth={1.2} />
            </m.div>
          </m.div>

          <m.h2
            className="mb-10 text-3xl font-bold tracking-tight lg:text-4xl"
            variants={heroReveal}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            15+ spr&aring;k st&oslash;ttet.
          </m.h2>

          {/* Language pills — individually staggered reveal */}
          <m.div className="flex flex-wrap justify-center gap-3" variants={staggerFast}>
            {SUPPORTED_LANGUAGES.map((language) => (
              <m.span
                key={language}
                className="rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 transition-all duration-300 hover:border-amber-400/40 hover:bg-amber-500/20 hover:text-amber-200"
                variants={pillReveal}
                transition={{
                  duration: 0.4,
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                }}
              >
                {language}
              </m.span>
            ))}
          </m.div>
        </m.div>
      </section>

      {/* ============================================
          Section 4: Career Progression
          Vertical timeline showing three career stages.
          An amber line connects them to show forward momentum.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        <m.div
          className="mx-auto max-w-3xl"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
        >
          <m.h2
            className="mb-16 text-center text-3xl font-bold tracking-tight lg:text-4xl"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            Din reise.
          </m.h2>

          {/* Timeline container — relative positioning for the vertical line */}
          <div className="relative">
            {/* Vertical amber line — animated height reveal */}
            <m.div
              className="absolute top-0 left-12 w-0.5 origin-top bg-gradient-to-b from-amber-500 via-amber-500 to-amber-500/20 lg:left-1/2 lg:-translate-x-1/2"
              initial={{ height: 0 }}
              whileInView={{ height: "100%" }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            />

            <div className="space-y-16">
              {CAREER_STAGES.map((stage, index) => (
                <m.div
                  key={stage.title}
                  className="relative flex items-start gap-8 lg:items-center"
                  variants={fadeUp}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                >
                  {/* Timeline node — scales in with spring bounce */}
                  <m.div
                    className="relative z-10 flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-amber-500 bg-zinc-950"
                    variants={nodeReveal}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 18,
                      delay: 0.3 + index * 0.25,
                    }}
                  >
                    <stage.icon className="h-10 w-10 text-amber-400" strokeWidth={1.5} />
                  </m.div>

                  {/* Stage content — slides in from the right */}
                  <m.div
                    className={
                      index === 0 ? "pt-2" : index === CAREER_STAGES.length - 1 ? "pb-2" : ""
                    }
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{
                      duration: 0.6,
                      delay: 0.5 + index * 0.25,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <h3 className="mb-2 text-2xl font-bold">{stage.title}</h3>
                    <p className="text-base text-zinc-400">{stage.description}</p>
                  </m.div>
                </m.div>
              ))}
            </div>
          </div>
        </m.div>
      </section>

      {/* ============================================
          Section 5: Privacy / Trust
          Shield icon with three privacy guarantees.
          Subtle amber background wash for warmth.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        {/* Subtle amber background wash */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-900/5 via-transparent to-transparent" />

        <m.div
          className="relative z-10 mx-auto max-w-3xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
        >
          {/* Shield icon — gentle breathing pulse for a sense of safety */}
          <m.div
            className="mb-6 flex justify-center"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            <m.div
              animate={{
                scale: [1, 1.08, 1],
                opacity: [0.85, 1, 0.85],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Shield className="h-16 w-16 text-amber-400" strokeWidth={1.2} />
            </m.div>
          </m.div>

          <m.h2
            className="mb-10 text-3xl font-bold tracking-tight lg:text-4xl"
            variants={heroReveal}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            Dine data er trygge.
          </m.h2>

          {/* Privacy bullet points — staggered entrance with heart pulse */}
          <m.ul className="mx-auto max-w-lg space-y-5 text-left" variants={staggerContainer}>
            {PRIVACY_POINTS.map((point, i) => (
              <m.li
                key={point}
                className="flex items-start gap-4 text-lg text-zinc-300"
                variants={fadeUp}
                transition={{
                  duration: 0.5,
                  delay: i * 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <m.div
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.6,
                  }}
                >
                  <Heart className="mt-1 h-5 w-5 shrink-0 text-amber-400" strokeWidth={1.5} />
                </m.div>
                <span>{point}</span>
              </m.li>
            ))}
          </m.ul>
        </m.div>
      </section>

      {/* ============================================
          Section 6: Testimonial
          A single powerful quote from a real-world persona.
          Large decorative Quote icon sets the tone.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        <m.div
          className="mx-auto max-w-3xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
        >
          {/* Decorative quote icon — subtle scale entrance with float */}
          <m.div
            className="mb-8 flex justify-center"
            variants={quoteReveal}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <m.div
              animate={{ y: [0, -4, 0], rotate: [0, 2, 0, -2, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Quote className="h-16 w-16 text-amber-500/40" strokeWidth={1.2} />
            </m.div>
          </m.div>

          <m.blockquote
            className="mb-6 text-xl leading-relaxed text-zinc-200 italic lg:text-2xl"
            variants={quoteReveal}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            &ldquo;Jeg var redd for &aring; starte med nytt datasystem. Men SmartOut var s&aring;
            enkelt at jeg klarte det p&aring; f&oslash;rste fors&oslash;k — p&aring; polsk.&rdquo;
          </m.blockquote>

          <m.p
            className="text-base font-semibold text-amber-400"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            Maria K., servit&oslash;r i 12 &aring;r
          </m.p>
        </m.div>
      </section>

      {/* ============================================
          Section: SmartOut AI
          Three giant icon cards showcasing AI capabilities
          (multilingual, voice, visual) plus a voice demo widget.
          Amber wash background to match variant A style.
          ============================================ */}
      <section id="smartout-ai" className="relative px-6 py-24 lg:py-32">
        {/* Subtle amber wash */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-900/5 via-transparent to-transparent" />

        <m.div
          className="relative z-10 mx-auto max-w-5xl"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
        >
          <m.h2
            className="mb-16 text-center text-3xl font-bold tracking-tight lg:text-4xl"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            {VARIANT_AI_SECTION.A.heading}
          </m.h2>

          <m.p
            className="mx-auto mb-12 max-w-2xl text-center text-xl text-zinc-300"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            {VARIANT_AI_SECTION.A.subheading}
          </m.p>

          {/* 3 giant icon cards — one per AI capability, with hover lift + floating icons */}
          <div className="mb-16 grid gap-8 md:grid-cols-3">
            {VARIANT_AI_SECTION.A.capabilities.map((cap, i) => {
              const icons = [Globe, Mic, BookOpen];
              const IconComponent = icons[i] ?? Globe;
              return (
                <m.div
                  key={cap.title}
                  className="group flex flex-col items-center rounded-3xl border border-white/5 bg-white/[0.02] p-10 text-center transition-all duration-500 hover:border-amber-500/20 hover:bg-amber-500/[0.03] hover:shadow-[0_8px_40px_rgba(245,158,11,0.06)]"
                  variants={cardReveal}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.12,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {/* 96px icon — static, color shift on hover */}
                  <IconComponent
                    className="mb-6 h-24 w-24 text-amber-400 transition-colors duration-500 group-hover:text-amber-300"
                    strokeWidth={1.2}
                  />
                  <h3 className="mb-3 text-2xl font-bold">{cap.title}</h3>
                  <p className="text-base text-zinc-400">{cap.description}</p>
                </m.div>
              );
            })}
          </div>

          {/* Voice widget — centered */}
          <div className="mx-auto max-w-lg">
            <VoiceDemoWidget config={VARIANT_VOICE_CONFIG.A} height="400px" />
          </div>
        </m.div>
      </section>

      {/* ============================================
          Section 7: Final CTA
          Single giant amber button — clear and unmistakable.
          ============================================ */}
      <section className="relative px-6 py-24 lg:py-32">
        {/* Ambient glow behind CTA — draws the eye */}
        <m.div
          className="pointer-events-none absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/8 blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        <m.div
          className="relative z-10 mx-auto max-w-3xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={heroReveal}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href={WEB_APP_LINKS.onboarding}
            onClick={() => trackCta("Start gratis i dag.")}
            className="inline-flex items-center rounded-full bg-amber-500 px-10 py-5 text-xl font-bold text-zinc-950 shadow-[0_0_40px_rgba(245,158,11,0.3)] transition-shadow duration-300 hover:shadow-[0_0_60px_rgba(245,158,11,0.5)]"
          >
            Start gratis i dag.
          </Link>
        </m.div>
      </section>

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}
