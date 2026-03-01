"use client";

import { motion } from "framer-motion";
import { Quote, Heart } from "lucide-react";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";
import { usePageTracking } from "../../hooks/useTracking";

export default function BlogPage() {
  usePageTracking();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] font-sans text-white selection:bg-orange-500/30">
      {/* Dynamic Premium Background */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-[size:24px_24px]"></div>
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'url(\'data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)"/%3E%3C/svg%3E\')',
          }}
        ></div>
        <div
          className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] animate-pulse rounded-full bg-orange-600/10 mix-blend-screen blur-[120px]"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute top-[20%] right-[-10%] h-[40vw] w-[40vw] animate-pulse rounded-full bg-rose-600/10 mix-blend-screen blur-[150px]"
          style={{ animationDuration: "12s" }}
        />
        <div
          className="absolute bottom-[-20%] left-[20%] h-[60vw] w-[60vw] animate-pulse rounded-full bg-purple-600/10 mix-blend-screen blur-[150px]"
          style={{ animationDuration: "10s" }}
        />
      </div>

      {/* Navigation */}
      <Navigation />

      <main className="relative z-10 mx-auto min-h-screen max-w-7xl px-6 pt-40 pb-20">
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="group relative mb-8 inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-md"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-rose-500/20 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="absolute -inset-[1px] rounded-full bg-gradient-to-r from-orange-500 to-rose-500 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-30" />
            <Heart className="relative z-10 h-4 w-4 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]" />
            <span className="relative z-10">Historiene fra bransjen</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 text-5xl leading-[1.05] font-black tracking-tighter drop-shadow-2xl md:text-7xl"
          >
            Bygget for <br />
            <span className="relative inline-block">
              <span className="absolute -inset-2 bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 opacity-20 blur"></span>
              <span className="relative bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]">
                virkelighetens helter.
              </span>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl font-medium text-zinc-400"
          >
            Les om hvordan Norges beste restauranter har halvert administrativ tid og fått fornøyde
            ansatte.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {[
            {
              title: "Hvordan Torget kuttet lønnskjøringen fra dager til timer",
              author: "Peder Aas",
              role: "Daglig Leder",
              color: "from-blue-500 to-indigo-500",
            },
            {
              title: "Bryggekanten overlevde Mattilsynet takket være Lise",
              author: "Lars Larsson",
              role: "Driftsjef",
              color: "from-emerald-500 to-teal-500",
            },
            {
              title: "Språkbarrierer er et tilbakelagt kapittel for vår restaurant",
              author: "Sofia Sofia",
              role: "HR Ansvarlig",
              color: "from-fuchsia-500 to-pink-500",
            },
            {
              title: "Fra papirkaos til digital ro i sjelen",
              author: "Geir Geirsen",
              role: "Eier",
              color: "from-orange-500 to-rose-500",
            },
            {
              title: "Oppskriften på null turnover i teamet",
              author: "Nina Ninasen",
              role: "Restaurantsjef",
              color: "from-purple-500 to-indigo-500",
            },
            {
              title: "Hvordan onboarding på 5 minutter endret alt",
              author: "Ole Olsen",
              role: "Kjøkkensjef",
              color: "from-cyan-500 to-blue-500",
            },
          ].map((story, i) => (
            <div
              key={i}
              className="group relative flex flex-col overflow-hidden rounded-[32px] border border-white/5 bg-[#0a0a0c]/40 p-8 shadow-2xl backdrop-blur-2xl transition-all duration-500"
            >
              <span className="absolute top-6 right-6 z-10 rounded-full border border-white/5 bg-white/5 px-3 py-1 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                Kommer snart
              </span>
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div
                className={`absolute -inset-1 bg-gradient-to-b ${story.color} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-10`}
              ></div>

              <div className="relative z-10 flex flex-1 flex-col">
                <Quote className="mb-6 h-8 w-8 text-white/20 transition-colors group-hover:text-white/40" />
                <h3 className="mb-6 flex-1 text-xl leading-relaxed font-bold text-white transition-all">
                  &ldquo;{story.title}&rdquo;
                </h3>

                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-full bg-gradient-to-tr ${story.color} p-[2px]`}
                  >
                    <div className="h-full w-full rounded-full border-2 border-[#111] bg-[#111]"></div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{story.author}</p>
                    <p className="text-xs text-zinc-500">{story.role}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
