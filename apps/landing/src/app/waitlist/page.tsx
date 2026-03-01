import type { Metadata } from "next";
import { Sparkles, ArrowRight } from "lucide-react";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { FullTracker, TrackedCta } from "../../components/tracking";

export const metadata: Metadata = {
  title: "Venteliste — SmartOut",
  description: "Kom i gang med SmartOut — AI-drevet workforce management.",
};

export default function WaitlistPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] font-sans text-white selection:bg-orange-500/30">
      {/* Dynamic Premium Background */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]">
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-[size:24px_24px]" />

        {/* Noise overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'url(\'data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E\')',
          }}
        />

        {/* Ambient Glowing Orbs */}
        <div
          className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-orange-600/10 mix-blend-screen blur-[100px] motion-safe:animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute top-[20%] right-[-10%] h-[40vw] w-[40vw] rounded-full bg-rose-600/10 mix-blend-screen blur-[120px] motion-safe:animate-pulse"
          style={{ animationDuration: "12s" }}
        />
      </div>

      {/* Navigation */}
      <FullTracker />
      <Navigation />

      {/* Main Content — centered card */}
      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 pt-16">
        <div className="w-full max-w-lg text-center">
          {/* Card */}
          <div className="group relative overflow-hidden rounded-3xl border border-orange-500/20 bg-[#0a0a0c]/60 p-10 shadow-[0_20px_80px_-20px_rgba(249,115,22,0.15)] backdrop-blur-2xl md:p-14">
            {/* Top shimmer line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
            {/* Background glow */}
            <div className="absolute -inset-4 bg-gradient-to-b from-orange-500/5 to-transparent opacity-50 blur-3xl" />

            <div className="relative z-10">
              {/* Icon */}
              <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
                <Sparkles className="h-7 w-7 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]" />
              </div>

              {/* Heading */}
              <h1 className="mb-4 text-3xl font-black tracking-tighter text-white md:text-4xl">
                Klar for å komme i gang?
              </h1>

              {/* Subtext */}
              <p className="mx-auto mb-10 max-w-sm text-lg leading-relaxed font-medium text-zinc-400">
                SmartOut er nå åpen for nye kunder. Start din onboarding i dag.
              </p>

              {/* CTA Button */}
              <TrackedCta
                label="Kom i gang"
                href={WEB_APP_LINKS.onboarding}
                className="group/btn relative inline-block"
              >
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 opacity-40 blur transition duration-500 group-hover/btn:opacity-70" />
                <div className="relative flex items-center justify-center gap-2 rounded-2xl bg-white px-10 py-4 font-black text-zinc-950 shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all group-hover/btn:-translate-y-0.5">
                  Kom i gang <ArrowRight className="h-4 w-4" />
                </div>
              </TrackedCta>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
