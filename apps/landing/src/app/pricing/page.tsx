import { ArrowRight, CheckCircle2, Zap, Star } from "lucide-react";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { PageTracker, TrackedCta } from "../../components/tracking";

export default function PricingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] font-sans text-white selection:bg-orange-500/30">
      <PageTracker />
      {/* Dynamic Premium Background */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]">
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-[size:24px_24px]"></div>

        {/* Noise overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'url(\'data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E\')',
          }}
        ></div>

        {/* Refined Glowing Orbs with Animations */}
        <div
          className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-orange-600/10 mix-blend-screen blur-[100px] motion-safe:animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute top-[20%] right-[-10%] h-[40vw] w-[40vw] rounded-full bg-rose-600/10 mix-blend-screen blur-[120px] motion-safe:animate-pulse"
          style={{ animationDuration: "12s" }}
        />
        <div
          className="absolute bottom-[-20%] left-[20%] h-[60vw] w-[60vw] rounded-full bg-purple-600/10 mix-blend-screen blur-[120px] motion-safe:animate-pulse"
          style={{ animationDuration: "10s" }}
        />
      </div>

      {/* Navigation */}
      <Navigation />

      <main className="relative z-10 mx-auto min-h-screen max-w-7xl px-6 pt-40 pb-20">
        <div className="mb-20 text-center">
          <div className="group relative mb-8 inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-md">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-rose-500/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="absolute -inset-[1px] rounded-full bg-gradient-to-r from-orange-500 to-rose-500 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-30" />
            <Star className="relative z-10 h-4 w-4 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]" />
            <span className="relative z-10">Enkelt og forutsigbart</span>
          </div>

          <h1 className="mb-6 text-5xl leading-[1.05] font-black tracking-tighter drop-shadow-2xl md:text-7xl">
            Full kontroll til <br />
            <span className="relative inline-block">
              <span className="absolute -inset-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 opacity-20 blur"></span>
              <span className="relative bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                en fast pris.
              </span>
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-xl font-medium text-zinc-400">
            Ingen skjulte kostnader. Ingen overraskelser. Betal for det du trenger, og skaler når du
            er klar for det.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
          {/* Basic Plan */}
          <div className="group relative flex flex-col overflow-hidden rounded-[40px] border border-white/5 bg-[#0a0a0c]/40 p-10 shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:border-white/10">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="absolute -inset-1 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"></div>

            <div className="relative z-10 flex-1">
              <h3 className="mb-2 text-2xl font-bold text-white">Essential</h3>
              <p className="mb-8 text-zinc-400">
                For den mindre restauranten som trenger full kontroll på vaktplan og kommunikasjon.
              </p>

              <div className="mb-8">
                <span className="text-5xl font-black text-white">499,-</span>
                <span className="ml-2 text-zinc-500">/ måned</span>
              </div>

              <ul className="mb-10 space-y-4">
                {[
                  "Vaktplan og Timeregistrering",
                  "Stemplingsur med lokasjonskontroll",
                  "Lise AI Botsson (Inntil 500 spørsmål/mnd)",
                  "Kommunikasjon med auto-oversettelse",
                  "Standard IK-mat og Rutiner",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-zinc-300">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                      <CheckCircle2 className="h-3 w-3 text-blue-400" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <TrackedCta
              label="Kom i gang"
              href={WEB_APP_LINKS.onboarding}
              className="relative z-10 w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-center font-bold text-white transition-colors hover:bg-white/10"
            >
              Kom i gang
            </TrackedCta>
          </div>

          {/* Pro Plan */}
          <div className="group relative flex transform flex-col overflow-hidden rounded-[40px] border border-orange-500/20 bg-[#0a0a0c]/60 p-10 shadow-[0_20px_80px_-20px_rgba(249,115,22,0.3)] backdrop-blur-2xl transition-all duration-500 hover:border-orange-500/40 md:-translate-y-4">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent opacity-100 transition-all duration-500" />
            <div className="absolute -inset-4 bg-gradient-to-b from-orange-500/10 to-transparent opacity-50 blur-3xl transition-opacity duration-500 group-hover:opacity-100"></div>

            <div className="absolute top-6 right-6 z-20 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-1.5 text-xs font-black tracking-wider text-white uppercase shadow-lg">
              Mest populær
            </div>

            <div className="relative z-10 flex-1">
              <h3 className="mb-2 bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-2xl font-bold text-transparent">
                SmartOut Pro
              </h3>
              <p className="mb-8 text-zinc-400">
                Kraftpakken for voksende konsepter og de som setter Mattilsynet i høysetet.
              </p>

              <div className="mb-8">
                <span className="text-5xl font-black text-white">1299,-</span>
                <span className="ml-2 text-zinc-500">/ måned</span>
              </div>

              <ul className="mb-10 space-y-4">
                {[
                  "Alt fra Essential",
                  "Automatisert lønnskjøring og integrasjoner",
                  "Ubegrenset bruk av Lise AI Botsson",
                  "Avansert HACCP og Mattilsynsrapporter",
                  "Automatisert Onboarding av ansatte",
                  "Sensordata fra kjøleskap (krever hardware)",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 font-medium text-white">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/20">
                      <Zap className="h-3 w-3 text-orange-400" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <TrackedCta
              label="Velg Pro"
              href={WEB_APP_LINKS.onboarding}
              className="group relative block w-full"
            >
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 opacity-40 blur transition duration-500 group-hover:opacity-70"></div>
              <div className="relative flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-center font-black text-zinc-950 shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all group-hover:-translate-y-0.5">
                Velg Pro <ArrowRight className="h-4 w-4" />
              </div>
            </TrackedCta>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
