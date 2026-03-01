// ============================================
// VariantFLanding.tsx
// Landing page Variant F — "Fatima" persona.
// Maximum accessibility variant for near-zero literacy users.
// Giant icons, minimal text (3-4 word labels only), high-contrast
// yellow-on-dark design. No body paragraphs anywhere.
//
// Persona: Fatima, 60, 30 years in housekeeping, semi-literate,
// fears digital systems. Dignity is everything.
//
// Design principles:
// - ZERO body paragraphs — only headlines and short labels
// - text-xl MINIMUM for all visible text
// - High contrast: yellow-400 accents on zinc-950 background
// - Giant icons (w-20/h-20 to w-28/h-28) with aria-labels
// - 6 sections (including SmartOut AI with voice widget)
// - Single framer-motion animation (hero fade-in only)
//
// Connected to: app/page.tsx (variant switcher)
// Related variants: VariantALanding.tsx, VariantELanding.tsx, etc.
// ============================================

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PlayCircle, Image, CheckCircle, Globe, Mic, Bot } from "lucide-react";
import Navigation from "../navigation";
import Footer from "../footer";
import VoiceDemoWidget from "./VoiceDemoWidget";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { VARIANT_VOICE_CONFIG, VARIANT_AI_SECTION } from "../../lib/variant-voice-config";
import { usePageTracking, useTrackCta } from "../../hooks/useTracking";

/**
 * Icon card data for the "What We Do" section.
 * Each card has a massive icon and a 3-word label — no body text.
 *
 * Why separate data: keeps JSX clean and makes it easy to
 * add/remove cards without touching layout code.
 */
const FEATURE_CARDS = [
  {
    icon: PlayCircle,
    label: "Lær med video",
    ariaLabel: "Lær med video",
  },
  {
    icon: Image,
    label: "Se bilder",
    ariaLabel: "Se bilder",
  },
  {
    icon: CheckCircle,
    label: "Fullfør oppgaver",
    ariaLabel: "Fullfør oppgaver",
  },
  {
    icon: Globe,
    label: "Ditt eget språk",
    ariaLabel: "Ditt eget språk",
  },
] as const;

/**
 * Photo strip data for the placeholder image section.
 * Each entry represents a diverse worker photo placeholder
 * with a gradient background and a short caption.
 */
const PHOTO_STRIP = [
  {
    caption: "Ren og trygg",
    ariaLabel: "Bilde av en renholdsarbeider i arbeid",
    gradient: "from-yellow-400/20 via-zinc-800 to-zinc-900",
  },
  {
    caption: "Klar for jobb",
    ariaLabel: "Bilde av en ansatt klar for arbeidsdagen",
    gradient: "from-zinc-800 via-yellow-400/15 to-zinc-900",
  },
  {
    caption: "Stolt og dyktig",
    ariaLabel: "Bilde av en erfaren arbeider med stolthet",
    gradient: "from-zinc-900 via-zinc-800 to-yellow-400/20",
  },
] as const;

/**
 * Checklist items for the "Simple Checklist" section.
 * Each item is a short reassuring statement with a checkmark icon.
 */
const CHECKLIST_ITEMS = [
  "Ingen lesing nødvendig",
  "Lær med bilder og video",
  "Hjelp på ditt språk",
] as const;

/**
 * Variant F — Fatima: Maximum Accessibility Landing Page.
 *
 * This is the most accessible variant in the SmartOut landing page system.
 * Designed for users who are semi-literate, fearful of digital systems,
 * and need maximum visual clarity with near-zero reading requirements.
 *
 * Why this design:
 * - Giant icons replace text explanations (visual-first communication)
 * - Yellow-400 on zinc-950 provides maximum contrast for aging eyes
 * - Full-width buttons are impossible to miss on any screen size
 * - 6 sections (including SmartOut AI) keeps cognitive load low
 * - 3-4 word labels instead of paragraphs respects low literacy
 *
 * @returns The complete Variant F landing page
 */
export default function VariantFLanding() {
  usePageTracking();
  const trackCta = useTrackCta();

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white">
      {/* Shared navigation bar */}
      <Navigation />

      <main>
        {/* ================================================
            SECTION 1: Hero
            Full viewport, centered. 4-word headline + 1 sentence.
            Single CTA button spans full width (max-w-md).
            Only animation in the entire page: simple fade-in.
            ================================================ */}
        <section className="flex min-h-screen items-center justify-center px-6">
          <motion.div
            className="flex w-full flex-col items-center text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="mb-6 text-5xl font-bold text-white lg:text-7xl">Du klarer dette.</h1>

            <p className="mb-12 text-xl text-zinc-300 lg:text-2xl">
              SmartOut hjelper deg å lære jobben.
            </p>

            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Kom i gang")}
              className="w-full max-w-md rounded-2xl bg-yellow-400 py-6 text-center text-2xl font-bold text-zinc-950 transition-colors hover:bg-yellow-300"
            >
              Kom i gang
            </Link>
          </motion.div>
        </section>

        {/* ================================================
            SECTION 2: What We Do
            4 giant icon cards in a 2x2 grid. Each card has a
            massive icon and a 3-word label. No body text at all.
            Icons scale from w-20/h-20 to w-28/h-28 on large screens.
            ================================================ */}
        <section className="px-6 py-20 lg:py-32">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-16 text-center text-3xl font-bold text-white lg:text-4xl">
              SmartOut hjelper deg:
            </h2>

            <div className="grid grid-cols-2 gap-6 lg:gap-10">
              {FEATURE_CARDS.map((card) => (
                <div
                  key={card.label}
                  className="flex flex-col items-center rounded-3xl border border-white/10 bg-white/5 p-8 lg:p-12"
                >
                  <card.icon
                    className="mb-6 h-20 w-20 text-yellow-400 lg:h-28 lg:w-28"
                    aria-label={card.ariaLabel}
                    role="img"
                  />
                  <span className="text-center text-2xl font-bold text-white">{card.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================
            SECTION 3: Photo Strip
            3 large placeholder images representing diverse workers.
            Each has a gradient background, role="img", aria-label,
            and a 2-4 word caption beneath.
            ================================================ */}
        <section className="px-6 py-20 lg:py-32">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            {PHOTO_STRIP.map((photo) => (
              <div key={photo.caption} className="flex flex-col items-center">
                <div
                  className={`mb-4 aspect-[4/3] w-full rounded-2xl bg-gradient-to-br ${photo.gradient}`}
                  role="img"
                  aria-label={photo.ariaLabel}
                />
                <span className="text-xl font-semibold text-white">{photo.caption}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ================================================
            SECTION 4: Simple Checklist
            3 giant checkmark items. Large green CheckCircle icons
            paired with short reassuring statements.
            Communicates "you don't need to read" without irony.
            ================================================ */}
        <section className="px-6 py-20 lg:py-32">
          <div className="mx-auto flex max-w-2xl flex-col gap-8">
            {CHECKLIST_ITEMS.map((item) => (
              <div key={item} className="flex items-center gap-5">
                <CheckCircle
                  className="h-10 w-10 shrink-0 text-green-400 lg:h-12 lg:w-12"
                  aria-label="Hake"
                  role="img"
                />
                <span className="text-xl font-semibold text-white lg:text-2xl">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ================================================
            SECTION 4.5: SmartOut AI
            Two giant icons (Mic + Bot) in a 2-column grid
            with 3-word labels only. No body text, no animations.
            Voice demo widget below for hands-free interaction.
            ================================================ */}
        <section id="smartout-ai" className="px-6 py-20 lg:py-32">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-16 text-center text-3xl font-bold text-white lg:text-4xl">
              {VARIANT_AI_SECTION.F.heading}
            </h2>

            {/* Two giant icons in a row — Mic and Bot */}
            <div className="mb-16 grid grid-cols-2 gap-6 lg:gap-10">
              {VARIANT_AI_SECTION.F.capabilities.map((cap, i) => (
                <div
                  key={cap.title}
                  className="flex flex-col items-center rounded-3xl border border-white/10 bg-white/5 p-8 lg:p-12"
                >
                  {i === 0 ? (
                    <Mic
                      className="mb-6 h-20 w-20 text-yellow-400 lg:h-28 lg:w-28"
                      aria-label={cap.title}
                      role="img"
                    />
                  ) : (
                    <Bot
                      className="mb-6 h-20 w-20 text-yellow-400 lg:h-28 lg:w-28"
                      aria-label={cap.title}
                      role="img"
                    />
                  )}
                  <span className="text-center text-2xl font-bold text-white">{cap.title}</span>
                </div>
              ))}
            </div>

            {/* Giant voice widget */}
            <VoiceDemoWidget config={VARIANT_VOICE_CONFIG.F} height="300px" />
          </div>
        </section>

        {/* ================================================
            SECTION 5: Final CTA
            Big headline + massive yellow button.
            Last chance to convert — maximum visual weight.
            ================================================ */}
        <section className="px-6 py-20 lg:py-32">
          <div className="flex flex-col items-center text-center">
            <h2 className="mb-12 text-4xl font-bold text-white lg:text-5xl">Prøv det nå.</h2>

            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Start nå")}
              className="rounded-2xl bg-yellow-400 px-12 py-6 text-2xl font-bold text-zinc-950 transition-colors hover:bg-yellow-300 lg:px-16 lg:py-8 lg:text-3xl"
            >
              Start nå
            </Link>
          </div>
        </section>
      </main>

      {/* Shared footer */}
      <Footer />
    </div>
  );
}
