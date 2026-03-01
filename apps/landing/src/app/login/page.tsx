import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { FullTracker, TrackedCta } from "../../components/tracking";

export const metadata: Metadata = {
  title: "Logg inn — SmartOut",
  description: "Logg inn på SmartOut dashboardet ditt.",
};

export default function LoginPage() {
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

        {/* Refined Glowing Orbs */}
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
      <FullTracker />
      <Navigation />

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <LogIn className="h-8 w-8 text-orange-400" />
          </div>
          <h1 className="mb-3 text-3xl font-black tracking-tighter">Logg inn</h1>
          <p className="mb-10 text-zinc-400">Gå til SmartOut dashboardet for å logge inn.</p>
          <TrackedCta
            label="Gå til innlogging"
            href={WEB_APP_LINKS.login}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 font-bold text-zinc-950 shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
          >
            Gå til innlogging <ArrowRight className="h-4 w-4" />
          </TrackedCta>
          <p className="mt-6 text-sm text-zinc-500">
            Har du ikke konto?{" "}
            <Link
              href={WEB_APP_LINKS.onboarding}
              className="font-semibold text-orange-400 hover:text-orange-300"
            >
              Kom i gang
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
