// ============================================
// /demo/voice — landing-demo mission surface
//
// Dedicated route that mounts VoiceDemoWidget with the `landing-demo`
// mission so the mission's UI surface is reachable + testable.
//
// Why a dedicated route: prior to 2026-05-27 the VoiceDemoWidget existed
// only as a CMS-mountable block (apps/landing/src/components/blocks/
// VoiceWidgetBlock.tsx) with no live page consuming it — landing-demo
// had no surface anywhere. Tracked as SMA-376; this route resolves the
// E2E gap without touching the production landing root (VariantMLanding)
// which is variant-tested and not the right place for a demo widget.
//
// Connected to:
//   apps/landing/src/components/landing/VoiceDemoWidget.tsx
//   packages/ai/src/missions/registry.ts → MISSIONS["landing-demo"]
//   apps/e2e/missions/landing-demo/landing-read.spec.ts
// ============================================

"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { VariantVoiceConfig } from "../../../lib/variant-voice-config";

const VoiceDemoWidget = dynamic(() => import("../../../components/landing/VoiceDemoWidget"), {
  ssr: false,
});

/** Voice config that hard-pins missionId="landing-demo" via the widget. */
const LANDING_DEMO_CONFIG: VariantVoiceConfig = {
  variant: "B",
  personaName: "Lise",
  personaRole: "AI-ambassadør",
  accentColor: "orange",
  placeholderTitle: "Snakk med Lise",
  placeholderSubtitle: "En av grunnleggerne i SmartOut. Spør om hva som helst.",
  usePulse: true,
  promptContext:
    "Du er Lise, en av The Founding AIs i SmartOut. Varm, direkte, kjenner SmartOut ut og inn.",
};

export default function LandingVoiceDemoPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 selection:bg-orange-500/30">
      <nav className="flex items-center justify-between px-6 py-5 sm:px-8">
        <Link
          href="/demo"
          className="flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbake til demo-oversikt
        </Link>
      </nav>

      <main className="mx-auto max-w-4xl px-6 pb-16">
        <div className="mb-10 text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">Snakk med Lise</h1>
          <p className="mx-auto max-w-xl text-base text-zinc-400 sm:text-lg">
            En av de grunnleggende AI-ene i SmartOut. Trykk og spør hva du vil.
          </p>
        </div>

        <VoiceDemoWidget config={LANDING_DEMO_CONFIG} height="600px" />
      </main>
    </div>
  );
}
