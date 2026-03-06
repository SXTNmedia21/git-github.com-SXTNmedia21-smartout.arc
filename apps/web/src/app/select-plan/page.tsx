"use client";

import Link from "next/link";
import { CheckCircle2, Zap, ArrowRight, Star } from "lucide-react";

export default function SelectPlanPage() {
  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 font-sans text-white selection:bg-orange-500/30">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes float-orb-1 {
          0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); }
          33% { transform: translate(4vw, -4vh) scale(1.05) rotate(5deg); }
          66% { transform: translate(-2vw, 3vh) scale(0.95) rotate(-5deg); }
        }
        @keyframes float-orb-2 {
          0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); }
          33% { transform: translate(-3vw, 4vh) scale(1.1) rotate(-5deg); }
          66% { transform: translate(3vw, -3vh) scale(0.9) rotate(5deg); }
        }
        .animate-float-1 { animation: float-orb-1 22s ease-in-out infinite; }
        .animate-float-2 { animation: float-orb-2 26s ease-in-out infinite; }
      `,
        }}
      />

      {/* Ambient background (matching onboarding/dashboard aesthetic) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={{ contain: "layout style paint" }}
      >
        <div className="bg-noise pointer-events-none absolute inset-0 z-10 h-full w-full opacity-[0.03] mix-blend-overlay" />

        {/* ORANGE ORB - Fixed Volumetric 5-layer 3D build up */}
        <div className="animate-float-1 absolute top-[-15%] left-[-25%] h-[90vh] w-[90vh]">
          {/* Layer 1: The wide, dark falloff (starts expanding out) */}
          <div className="absolute inset-[15%] rounded-full bg-[#c2410c] opacity-15 mix-blend-screen blur-[70px]" />
          {/* Layer 2: Transition 1 */}
          <div className="absolute inset-[25%] rounded-full bg-[#ea580c] opacity-30 mix-blend-screen blur-[50px]" />
          {/* Layer 3: Transition 2 */}
          <div className="absolute inset-[32%] rounded-full bg-[#f97316] opacity-50 mix-blend-screen blur-[30px]" />
          {/* Layer 4: Transition 3 (The core starts shaping) */}
          <div className="absolute inset-[38%] rounded-full bg-[#fb923c] opacity-75 mix-blend-screen blur-[18px]" />
          {/* Layer 5: The bright epicenter */}
          <div className="absolute inset-[44%] rounded-full bg-[#fdba74] opacity-100 mix-blend-screen blur-[10px]" />
        </div>

        {/* ROSE ORB - Fixed Volumetric 5-layer 3D build up */}
        <div className="animate-float-2 absolute right-[-25%] bottom-[-15%] h-[95vh] w-[95vh]">
          {/* Layer 1: The wide, dark falloff */}
          <div className="absolute inset-[15%] rounded-full bg-[#be123c] opacity-15 mix-blend-screen blur-[80px]" />
          {/* Layer 2: Transition 1 */}
          <div className="absolute inset-[25%] rounded-full bg-[#e11d48] opacity-30 mix-blend-screen blur-[55px]" />
          {/* Layer 3: Transition 2 */}
          <div className="absolute inset-[32%] rounded-full bg-[#f43f5e] opacity-50 mix-blend-screen blur-[35px]" />
          {/* Layer 4: Transition 3 */}
          <div className="absolute inset-[38%] rounded-full bg-[#fb7185] opacity-75 mix-blend-screen blur-[22px]" />
          {/* Layer 5: The bright epicenter */}
          <div className="absolute inset-[44%] rounded-full bg-[#fda4af] opacity-100 mix-blend-screen blur-[12px]" />
        </div>
      </div>

      <main className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col items-center justify-center px-6">
        {/* Header Section */}
        <div className="mb-12 text-center">
          <p className="mb-4 text-xs font-semibold tracking-[0.25em] text-white/30 uppercase">
            Abonnement
          </p>
          <h1 className="font-heading mb-4 text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] tracking-tight text-white drop-shadow-2xl">
            Velg <span className="text-white/30">din</span> plan.
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/40">
            Ingen skjulte kostnader, ingen overraskelser. Velg nivået som passer ditt konsept. Du
            kan alltids oppgradere senere.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-10">
          {/* Essential Plan */}
          <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 shadow-2xl backdrop-blur-md transition-all duration-500 hover:bg-white/[0.04] sm:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative z-10 flex-1">
              <h3 className="mb-2 text-2xl font-bold tracking-tight text-white">Essential</h3>
              <p className="mb-6 text-sm leading-relaxed text-white/40">
                For den mindre restauranten som trenger full kontroll på vaktplan og kommunikasjon.
              </p>

              <div className="mb-8 flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight text-white">499,-</span>
                <span className="text-xs font-semibold tracking-widest text-white/30 uppercase">
                  / mnd
                </span>
              </div>

              <ul className="mb-8 space-y-3">
                {[
                  "Vaktplan og Timeregistrering",
                  "Stemplingsur med lokasjonskontroll",
                  "Lise AI Botsson (Inntil 500 spm/mnd)",
                  "Kommunikasjon med auto-oversettelse",
                  "Standard IK-mat og Rutiner",
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-[13px] text-white/70">
                    <div className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
                      <CheckCircle2 className="h-2.5 w-2.5 text-white/60" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href="/dashboard"
              className="relative z-10 w-full rounded-xl border border-white/10 bg-white/5 py-3 text-center text-sm font-bold tracking-wide text-white transition-colors hover:bg-white/10"
            >
              Velg Essential
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-orange-500/20 bg-[#0a0a0c]/80 p-6 shadow-[0_20px_80px_-20px_rgba(249,115,22,0.15)] backdrop-blur-xl transition-all duration-500 hover:border-orange-500/40 sm:p-8 md:-translate-y-2">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent opacity-100 transition-all duration-500" />
            <div className="absolute -inset-4 bg-gradient-to-b from-orange-500/10 to-transparent opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60"></div>

            <div className="absolute top-6 right-6 z-20 flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[9px] font-bold tracking-widest text-orange-400 uppercase shadow-lg">
              <Star className="h-2.5 w-2.5 fill-orange-400" />
              Mest populær
            </div>

            <div className="relative z-10 flex-1">
              <h3 className="mb-2 bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                SmartOut Pro
              </h3>
              <p className="mb-6 pr-12 text-sm leading-relaxed text-white/40">
                Kraftpakken for voksende konsepter og de som setter Mattilsynet i høysetet.
              </p>

              <div className="mb-8 flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight text-white">1299,-</span>
                <span className="text-xs font-semibold tracking-widest text-white/30 uppercase">
                  / mnd
                </span>
              </div>

              <ul className="mb-8 space-y-3">
                {[
                  "Alt fra Essential",
                  "Automatisert lønnskjøring & integrasjoner",
                  "Ubegrenset bruk av Lise AI Botsson",
                  "Avansert HACCP og Mattilsynsrapporter",
                  "Automatisert Onboarding av ansatte",
                  "Sensordata fra kjøleskap (IoT)",
                ].map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-[13px] font-medium text-white/90"
                  >
                    <div className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10">
                      <Zap className="h-2.5 w-2.5 text-orange-400" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <Link href="/dashboard" className="group/btn relative block w-full">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 opacity-30 blur transition duration-500 group-hover/btn:opacity-60"></div>
              <div className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-center text-sm font-black text-zinc-950 shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-transform group-hover/btn:-translate-y-0.5">
                Velg Pro <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          </div>
        </div>

        {/* Enterprise/Footer text */}
        <div className="mt-8 text-center">
          <p className="text-xs text-white/30">
            Behov for en skreddersydd Enterprise-avtale?{" "}
            <a
              href="#"
              className="text-white/60 underline decoration-white/20 underline-offset-4 hover:text-white"
            >
              Ta kontakt med oss
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
