"use client";

import { m } from "framer-motion";
import { Quote, Heart } from "lucide-react";
import Link from "next/link";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";
import { usePageTracking } from "../../hooks/useTracking";
import { useScrollTracking } from "../../hooks/useScrollTracking";
import { useClickTracking } from "../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../hooks/useSessionLifecycle";

export default function BlogPage() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();

  return (
    <div className="bg-background text-foreground selection:bg-brand-orange/30 relative min-h-screen overflow-x-hidden font-sans">
      {/* Dynamic Ambient Background */}
      <div className="bg-background pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-foreground)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.03]"></div>

        {/* Glow orbs */}
        <div className="bg-brand-orange/10 absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full blur-[120px]" />
        <div className="bg-primary/10 absolute right-[-10%] bottom-[-20%] h-[40vw] w-[40vw] rounded-full blur-[150px]" />
      </div>

      <Navigation />

      <main className="relative z-10 mx-auto min-h-screen max-w-7xl px-6 pt-32 pb-20 sm:pt-40">
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="border-brand-orange/20 bg-brand-orange/10 text-brand-orange mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold tracking-widest uppercase"
          >
            <Heart className="h-4 w-4" />
            <span>Historiene fra bransjen</span>
          </m.div>

          <m.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 text-5xl leading-[1.05] font-black tracking-tighter md:text-7xl"
          >
            Bygget for <br />
            <span className="text-brand-orange">virkelighetens helter.</span>
          </m.h1>

          <m.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-muted-foreground text-xl leading-relaxed font-medium"
          >
            Les om hvordan Norges beste restauranter har halvert administrativ tid og fått fornøyde
            ansatte.
          </m.p>
        </div>

        <m.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {[
            {
              slug: "torget-kuttet-lonnskjoring",
              title: "Hvordan Torget kuttet lønnskjøringen fra dager til timer",
              author: "Peder Aas",
              role: "Daglig Leder",
              color: "from-blue-500 to-indigo-500",
              ready: true,
            },
            {
              slug: "bryggekanten-overlevde-mattilsynet",
              title: "Bryggekanten overlevde Mattilsynet takket være Lise",
              author: "Lars Larsson",
              role: "Driftsjef",
              color: "from-emerald-500 to-teal-500",
              ready: true,
            },
            {
              slug: "sprakbarrierer-tilbakelagt-kapittel",
              title: "Språkbarrierer er et tilbakelagt kapittel for vår restaurant",
              author: "Sofia Sofia",
              role: "HR Ansvarlig",
              color: "from-fuchsia-500 to-pink-500",
              ready: false,
            },
            {
              slug: "papirkaos-til-digital-ro",
              title: "Fra papirkaos til digital ro i sjelen",
              author: "Geir Geirsen",
              role: "Eier",
              color: "from-orange-500 to-rose-500",
              ready: false,
            },
            {
              slug: "oppskriften-pa-null-turnover",
              title: "Oppskriften på null turnover i teamet",
              author: "Nina Ninasen",
              role: "Restaurantsjef",
              color: "from-purple-500 to-indigo-500",
              ready: false,
            },
            {
              slug: "onboarding-5-minutter",
              title: "Hvordan onboarding på 5 minutter endret alt",
              author: "Ole Olsen",
              role: "Kjøkkensjef",
              color: "from-cyan-500 to-blue-500",
              ready: false,
            },
          ]
            .filter((s) => s.ready !== false)
            .map((story, i) => {
              return (
                <Link
                  key={i}
                  href={`/blog/${story.slug}`}
                  className="group border-border/50 bg-card/40 hover:border-border relative flex cursor-pointer flex-col overflow-hidden rounded-[2rem] border p-8 shadow-xl backdrop-blur-xl transition-all duration-500 hover:-translate-y-1"
                >
                  <div className="via-foreground/20 absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <div
                    className={`absolute -inset-1 bg-gradient-to-b ${story.color} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-10`}
                  ></div>

                  <div className="relative z-10 flex flex-1 flex-col">
                    <Quote className="text-foreground/20 group-hover:text-foreground/40 mb-6 h-8 w-8 transition-colors" />
                    <h3 className="text-foreground mb-6 flex-1 text-xl leading-relaxed font-bold transition-all">
                      &ldquo;{story.title}&rdquo;
                    </h3>

                    <div className="flex items-center gap-4">
                      <div
                        className={`h-10 w-10 rounded-full bg-gradient-to-tr ${story.color} p-[2px]`}
                      >
                        <div className="border-background bg-card h-full w-full rounded-full border-2"></div>
                      </div>
                      <div>
                        <p className="text-foreground text-sm font-bold">{story.author}</p>
                        <p className="text-muted-foreground text-xs font-semibold">{story.role}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
        </m.div>
      </main>

      <Footer />
    </div>
  );
}
