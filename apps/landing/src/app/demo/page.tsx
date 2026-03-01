// ============================================
// page.tsx
// Demo hub page — shows 6 journey cards in a grid.
// Visitors pick a scenario to experience with the
// AI assistant. Dark background, minimal chrome.
// Connected to: components/demo/JourneyCard.tsx,
//   components/demo/journeys/index.ts (registry)
// ============================================

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Bot } from "lucide-react";
import { journeys } from "../../components/demo/journeys";
import { JourneyCard } from "../../components/demo/JourneyCard";

/**
 * Hub page listing all 6 guided demo journeys.
 *
 * Why client component: We use Framer Motion for staggered
 * card entrance animations. No server data needed — journey
 * configs are static imports.
 */
export default function DemoHubPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 selection:bg-orange-500/30">
      {/* Top navigation — back to home */}
      <nav className="flex items-center justify-between px-6 py-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake til forsiden
        </Link>
      </nav>

      <div className="mx-auto max-w-4xl px-6 pt-8 pb-20 sm:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-12 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10">
            <Bot className="h-7 w-7 text-orange-400" />
          </div>
          <h1 className="text-3xl font-black text-white sm:text-4xl">Interaktiv Demo</h1>
          <p className="mx-auto mt-3 max-w-lg text-lg text-zinc-400">
            Velg et scenario og opplev hvordan Smartout fungerer i praksis — guidet av
            AI-assistenten Lise.
          </p>
        </motion.div>

        {/* Journey grid — 2 columns on tablet, 3 on desktop */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {journeys.map((journey, index) => (
            <JourneyCard
              key={journey.id}
              id={journey.id}
              title={journey.title}
              subtitle={journey.subtitle}
              persona={journey.persona}
              duration={journey.duration}
              icon={journey.icon}
              accentColor={journey.accentColor}
              hasSteps={journey.steps.length > 0}
              index={index}
            />
          ))}
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-12 text-center text-sm text-zinc-600"
        >
          Alle scenarier bruker simulert data — ingen ekte personopplysninger.
        </motion.p>
      </div>
    </div>
  );
}
