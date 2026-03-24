"use client";

import Link from "next/link";
import { m } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Zap as ZapIcon,
  BarChart3,
  Clock,
  CheckCircle2,
  Users,
  Building,
  TrendingUp,
  Coffee,
  AlertCircle,
  Bot,
} from "lucide-react";
import Navigation from "../navigation";
import Footer from "../footer";
import VoiceDemoWidget from "./VoiceDemoWidget";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { usePageTracking, useTrackCta } from "../../hooks/useTracking";
import { useScrollTracking } from "../../hooks/useScrollTracking";
import { useClickTracking } from "../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../hooks/useSessionLifecycle";
import { VARIANT_VOICE_CONFIG, VARIANT_AI_SECTION } from "../../lib/variant-voice-config";

export default function VariantELanding() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const trackCta = useTrackCta();

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white selection:bg-orange-500/30">
      {/* Shared Navigation */}
      <Navigation />

      {/* Hero Section */}
      <section className="relative px-6 pt-32 pb-20 lg:pt-48 lg:pb-32">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div className="z-10">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
              </span>
              <span className="text-xs font-bold tracking-wider text-orange-400 uppercase">
                Driftsplattformen er live{" "}
                {/* CHANGED: replaced meaningless jargon "Genesis Protocol v2 Live" with operations-relevant message */}
              </span>
            </div>

            <h1 className="mb-6 text-5xl leading-[1.1] font-black tracking-tight lg:text-7xl">
              Intelligent
              <span className="block bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Vaktplanlegging.
              </span>
            </h1>

            <p className="mb-8 max-w-xl text-lg leading-relaxed text-zinc-400">
              Slutt å styre driften i skjøre regneark. Smartout samler alt – fra{" "}
              {/* CHANGED: "drive butikken" (Swedish-ism) → "styre driften" (Norwegian) */}
              kontrakter til live lønnsprognoser – i én intelligent plattform.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href={WEB_APP_LINKS.onboarding}
                onClick={() => trackCta("Kom I Gang Nå")}
                className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-8 py-4 font-bold text-white shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all hover:bg-orange-400 hover:shadow-[0_0_40px_rgba(249,115,22,0.5)]"
              >
                Kom I Gang Nå <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="#features"
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-8 py-4 text-center font-bold text-white transition-all hover:border-zinc-700 hover:bg-zinc-800"
              >
                Se hvordan det fungerer{" "}
                {/* CHANGED: more action-oriented than "Se Interaktiv Demo" */}
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-4 text-sm text-zinc-500">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-zinc-950 bg-zinc-800"
                  >
                    <Users className="h-3 w-3 text-zinc-400" />
                  </div>
                ))}
              </div>
              <p>
                Brukes av <strong className="text-zinc-300">10 000+</strong> ansatte i{" "}
                {/* CHANGED: "Stoles på" is Swedish → "Brukes av" (Norwegian). Fixed number format. */}
                frontlinjen
              </p>
            </div>
          </div>

          {/* Animated Hero Graphic / Dashboard Prototype */}
          <m.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 lg:ml-8"
          >
            <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-bl from-orange-500/20 to-transparent blur-3xl"></div>

            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0e] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              {/* Fake Window Header */}
              <div className="flex h-10 items-center gap-2 border-b border-zinc-800 bg-[#121214] px-4">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500/80"></div>
                </div>
                <div className="ml-4 flex flex-1 justify-center">
                  <div className="flex h-5 w-48 items-center justify-center rounded border border-zinc-800 bg-zinc-900">
                    <span className="font-mono text-[10px] text-zinc-500">smartout.ai/live</span>
                  </div>
                </div>
              </div>

              {/* Dashboard Content */}
              <div className="relative p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Live Operations</h3>
                    <p className="text-xs text-zinc-400">Restaurant Oslo</p>{" "}
                    {/* CHANGED: "Restaurang Stockholm" (Swedish) → Norwegian city + spelling */}
                  </div>
                  <div className="animate-pulse rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold tracking-widest text-emerald-500 uppercase shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                    Live
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-3">
                  <div className="flex transform cursor-default items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition-transform hover:scale-[1.02]">
                    <div>
                      <div className="mb-1 text-[10px] font-bold text-zinc-500 uppercase">
                        Inntekter
                      </div>
                      <div className="text-xl font-black text-emerald-400">42,500 kr</div>
                    </div>
                    <div className="rounded-full bg-emerald-500/10 p-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </div>
                  </div>
                  <div className="flex transform cursor-default items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition-transform hover:scale-[1.02]">
                    <div>
                      <div className="mb-1 text-[10px] font-bold text-zinc-500 uppercase">
                        Personalkostnad
                      </div>
                      <div className="text-xl font-black text-orange-400">8,500 kr</div>
                    </div>
                    <div className="rounded-full bg-orange-500/10 p-2">
                      <Users className="h-4 w-4 text-orange-500" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="mb-1 text-xs font-bold tracking-widest text-zinc-500 uppercase">
                    Avdelingsstatus {/* CHANGED: "Avdelningsstatus" (Swedish) → Norwegian */}
                  </div>
                  {[
                    {
                      name: "Kjøkken", // CHANGED: "Kök" (Swedish) → Norwegian
                      status: "Optimal",
                      color: "text-emerald-500",
                      bgColor: "bg-emerald-500",
                      w: "w-[85%]",
                      icon: <Coffee strokeWidth={3} className="h-4 w-4" />,
                    },
                    {
                      name: "Sal", // CHANGED: "Matsal" (Swedish) → Norwegian
                      status: "Høy belastning", // CHANGED: "Hög" (Swedish) → "Høy" (Norwegian)
                      color: "text-orange-500",
                      bgColor: "bg-orange-500",
                      w: "w-[95%]",
                      icon: <Users strokeWidth={3} className="h-4 w-4" />,
                    },
                    {
                      name: "Bar",
                      status: "Rolig", // CHANGED: "Lugnt" (Swedish) → "Rolig" (Norwegian)
                      color: "text-indigo-500",
                      bgColor: "bg-indigo-500",
                      w: "w-[30%]",
                      icon: <Sparkles strokeWidth={3} className="h-4 w-4" />,
                    },
                  ].map((dept, i) => (
                    <div
                      key={i}
                      className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-zinc-700"
                    >
                      <div className={`${dept.color} rounded-lg bg-zinc-950 p-2`}>{dept.icon}</div>
                      <div className="flex-1">
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-bold text-zinc-200">{dept.name}</span>
                          <span className={`text-xs font-semibold ${dept.color}`}>
                            {dept.status}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-950 shadow-inner">
                          <div
                            className={`h-full ${dept.bgColor} ${dept.w} rounded-full transition-all duration-1000`}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating Element 1 - Tactile Card */}
            <m.div
              initial={{ opacity: 0, x: 20, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              whileHover={{ x: -10, scale: 1.02, transition: { duration: 0.2 } }}
              className="absolute -top-6 -right-6 z-20 flex cursor-default items-center gap-4 rounded-2xl border-2 border-zinc-700/50 bg-zinc-800 p-4 shadow-2xl backdrop-blur-xl"
              style={{ animation: "float 6s ease-in-out infinite" }}
            >
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/20 p-3 shadow-inner">
                <CheckCircle2 className="h-6 w-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>
              <div>
                <div className="text-sm font-black text-white">Vaktplan klar</div>{" "}
                {/* CHANGED: "Schema Klart" (Swedish) → Norwegian */}
                <div className="text-[11px] font-medium text-zinc-400">
                  Automatisk fordeling via AI {/* CHANGED: "fördelning" (Swedish) → Norwegian */}
                </div>
              </div>
            </m.div>

            {/* Floating Element 2 - New Contract */}
            <m.div
              initial={{ opacity: 0, x: -20, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              whileHover={{ x: 10, scale: 1.02, transition: { duration: 0.2 } }}
              className="absolute -bottom-8 -left-8 z-20 cursor-default rounded-2xl border-2 border-zinc-700/50 bg-zinc-800 p-4 shadow-2xl backdrop-blur-xl"
              style={{ animation: "float 7s ease-in-out infinite reverse" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                <div className="text-xs font-bold text-white">Nytt Kontrakt Signerat</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900">
                  <span className="text-[10px] font-bold text-zinc-300">EK</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Erik Knudsen</div>
                  <div className="text-[10px] tracking-wider text-zinc-400 uppercase">
                    Bartender
                  </div>
                </div>
              </div>
            </m.div>
          </m.div>
        </div>
      </section>

      {/* SEKSJON 1: The Cost of Inaction */}
      <section className="relative overflow-hidden bg-zinc-950 px-6 py-32">
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[400px] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/5 blur-[120px]"></div>

        <div className="relative z-10 mx-auto max-w-7xl text-center">
          <m.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="mb-6 text-4xl font-black tracking-tight md:text-6xl">
              Hvor mye koster <span className="text-red-500">kaoset?</span>
            </h2>
            <p className="mx-auto mb-16 max-w-2xl text-xl text-zinc-400">
              Regneark, Facebook-grupper og gule lapper. Det er ikke bare utmattende – det er et
              massivt, usynlig inntektstap hver eneste måned.
            </p>
          </m.div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Overtidsbrudd",
                value: "+18%",
                desc: "Ekstra personalkostnad fordi ingen varsler deg før timene sprekker.", // CHANGED: tighter, more direct — speaks to Lars Erik's frustration
                icon: <AlertCircle className="h-5 w-5 text-red-500" />,
              },
              {
                title: "Administrasjon",
                value: "40 t",
                desc: "Tapt per måned per restaurant på vaktlister, lønnskjøring og manuell oppfølging.", // CHANGED: removed "pusla" (Swedish-ism), tightened
                icon: <Clock className="h-5 w-5 text-red-500" />,
              },
              {
                title: "Turnover",
                value: "3x",
                desc: "Høyere sjanse for at folk slutter når vaktplaner og kommunikasjon er uforutsigbare.", // CHANGED: "vagtplanene" (Danish-ism) → "vaktplaner", tightened
                icon: <Users className="h-5 w-5 text-red-500" />,
              },
            ].map((stat, idx) => (
              <m.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="rounded-3xl border border-red-500/10 bg-zinc-900/50 p-8 text-left transition-colors hover:border-red-500/30"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
                  {stat.icon}
                </div>
                <div className="mb-2 text-4xl font-black text-white">{stat.value}</div>
                <div className="mb-2 text-lg font-bold text-zinc-200">{stat.title}</div>
                <p className="text-sm leading-relaxed text-zinc-500">{stat.desc}</p>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="relative z-10 border-y border-zinc-800 bg-zinc-900/30 py-40"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-5xl">Én plattform. Hele driften.</h2>{" "}
            {/* CHANGED: "Alt du trenger for å skalere" was generic → operator-specific */}
            <p className="mx-auto max-w-2xl text-zinc-400">
              Erstatter 5 forskjellige verktøy med ett operativsystem bygget{" "}
              {/* CHANGED: cut "sammenhengende" — filler */}
              for servicebransjen.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Smart Vaktplanlegging",
                desc: "AI bygger den optimale planen basert på historikk, været og bookinger.", // CHANGED: benefit-oriented — what data it actually uses
                icon: <Clock className="h-5 w-5 text-zinc-300" />,
              },
              {
                title: "Live Lønnsprognoser",
                desc: "Vit nøyaktig hva dagen koster før den starter. Null overraskelser ved lønnskjøring.", // CHANGED: "Se" → "Vit" (stronger), "månedsslutt" → "lønnskjøring" (more specific pain)
                icon: <TrendingUp className="h-5 w-5 text-zinc-300" />,
              },
              {
                title: "Automatisk Compliance",
                desc: "Automatisk varsling før overtid eller hviletidsbrudd inntreffer.", // CHANGED: tighter, avoids repetitive "brudd" twice
                icon: <Shield className="h-5 w-5 text-zinc-300" />,
              },
              {
                title: "Arbeidsgiver Hub",
                desc: "Kontrakter, dokumenter og kommunikasjon samlet på ett sted.", // CHANGED: "Sentraliserte" is corporate filler — simpler is better
                icon: <Building className="h-5 w-5 text-zinc-300" />,
              },
            ].map((feature, i) => (
              <m.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-6 transition-colors hover:bg-zinc-900"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-bold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{feature.desc}</p>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Metrics */}
      <section className="relative overflow-hidden px-6 py-40">
        <div className="pointer-events-none absolute inset-0 bg-orange-500/5 mix-blend-overlay"></div>
        <div className="relative z-10 mx-auto max-w-7xl text-center">
          <h2 className="mb-16 text-2xl font-bold md:text-4xl">
            Tallene som driver servicebransjen fremover{" "}
            {/* CHANGED: "Den operative ryggraden for moderne team" was generic */}
          </h2>

          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { value: "2.5M+", label: "Planlagte Vakter" },
              { value: "40%", label: "Mindre Administrasjon" },
              { value: "0", label: "Lovbrudd / Bøter" },
              { value: "99.9%", label: "Plattform Oppetid" },
            ].map((stat, i) => (
              <m.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6"
              >
                <div className="mb-2 text-4xl font-black text-white">{stat.value}</div>
                <div className="text-sm font-semibold tracking-widest text-zinc-500 uppercase">
                  {stat.label}
                </div>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tre steg til fred i sinnet */}
      <section className="relative overflow-hidden border-t border-zinc-900 bg-zinc-950 px-6 py-40">
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/5 blur-[120px]"></div>
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="mb-24 text-center">
            <m.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 shadow-[0_0_30px_rgba(249,115,22,0.2)]"
            >
              <Sparkles className="h-6 w-6 text-orange-500" />
            </m.div>
            <h2 className="mb-6 text-4xl font-black tracking-tight text-white md:text-6xl">
              Tre steg til fred i{" "}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                sinnet.
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-xl font-medium text-zinc-400">
              En smidig arbeidsflyt som tar det tunge løftet ut av administrasjonen. Pust ut.
            </p>
          </div>

          <div className="relative grid gap-8 md:grid-cols-3">
            {/* Connecting Line (Desktop) */}
            <div className="absolute top-[60px] right-[15%] left-[15%] hidden h-1 rounded-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent opacity-50 md:block"></div>

            {[
              {
                step: "1",
                title: "Smartout Lærer",
                desc: "Last opp historikk, bookinger og værdata. Smartout forstår mønstrene.", // CHANGED: tighter, less playful — Lars Erik wants efficiency, not humor
                icon: <BarChart3 className="h-6 w-6" />,
                color: "text-blue-400",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
              },
              {
                step: "2",
                title: "AI Magi",
                desc: "Algoritmen lager en lovlig, optimal vaktplan på sekunder.", // CHANGED: cut "lekende lett" and "skreddersyr" — filler that undersells seriousness
                icon: <Zap className="h-6 w-6" />,
                color: "text-orange-400",
                bg: "bg-orange-500/10",
                border: "border-orange-500/20",
              },
              {
                step: "3",
                title: "Sømløs Synk",
                desc: "Godkjente timer flyter rett inn i lønnssystemet ditt. Ingen manuell eksport.", // CHANGED: "spretter" too playful for Lars Erik, added benefit
                icon: <ArrowRight className="h-6 w-6" />,
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
              },
            ].map((item, idx) => (
              <m.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -10 }}
                transition={{ type: "spring", bounce: 0.4, delay: idx * 0.1 }}
                className="relative rounded-[2.5rem] border border-zinc-800 bg-zinc-900/40 p-10 text-center shadow-xl transition-colors hover:bg-zinc-900"
              >
                <div className="absolute -top-6 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 font-black shadow-md">
                  <span className={item.color}>{item.step}</span>
                </div>
                <div
                  className={`mx-auto h-20 w-20 ${item.bg} mb-8 flex items-center justify-center rounded-[2rem] border shadow-inner ${item.border}`}
                >
                  <div className={item.color}>{item.icon}</div>
                </div>
                <h3 className="mb-4 text-2xl font-bold text-white">{item.title}</h3>
                <p className="leading-relaxed font-medium text-zinc-400">{item.desc}</p>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section
        id="integrations"
        className="relative z-10 overflow-hidden border-t border-zinc-800/50 bg-zinc-900/20 px-6 py-40"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center gap-12 md:flex-row">
            <div className="flex-1">
              <h2 className="mb-6 text-3xl font-bold md:text-5xl">Navet i virksomheten din</h2>{" "}
              {/* CHANGED: "verksamhet" (Swedish) → "virksomheten" (Norwegian), possessive moved */}
              <p className="mb-8 max-w-xl text-lg text-zinc-400">
                Smartout snakker med systemene du allerede bruker. POS, lønnssystem eller{" "}
                {/* CHANGED: full Swedish sentence → Norwegian */}
                HR-verktøy — vi samler alle trådene i én kraftig hub.
              </p>
              <Link
                href="#features"
                className="flex items-center gap-2 font-bold text-orange-500 transition-all hover:gap-3"
              >
                Se alle 40+ integrasjoner <ArrowRight className="h-5 w-5" />{" "}
                {/* CHANGED: "alla integrationer" (Swedish) → Norwegian */}
              </Link>
            </div>
            <div className="relative aspect-square w-full flex-1 md:aspect-auto md:h-[400px]">
              {/* Inner glowing core */}
              <div className="absolute top-1/2 left-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 rotate-45 items-center justify-center rounded-2xl bg-orange-500 shadow-[0_0_60px_rgba(249,115,22,0.6)]">
                <Sparkles className="h-10 w-10 -rotate-45 text-white" />
              </div>

              {/* Orbiting Elements */}
              <m.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-800"
              >
                <div className="absolute top-0 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900">
                  <BarChart3 className="h-5 w-5 rotate-[-20deg] text-zinc-400" />
                </div>
                <div className="absolute bottom-0 left-1/2 flex h-12 w-12 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900">
                  <Users className="h-5 w-5 rotate-[20deg] text-zinc-400" />
                </div>
              </m.div>

              <m.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
                className="absolute top-1/2 left-1/2 hidden h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-800/50 sm:block"
              >
                <div className="absolute top-1/2 left-0 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900">
                  <Clock className="h-6 w-6 text-zinc-400" />
                </div>
                <div className="absolute top-1/2 right-0 flex h-14 w-14 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900">
                  <Building className="h-6 w-6 text-zinc-400" />
                </div>
              </m.div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section
        id="testimonials"
        className="relative z-10 overflow-hidden border-t border-zinc-900 bg-zinc-950 px-6 py-40"
      >
        <div className="pointer-events-none absolute top-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-orange-500/5 blur-[120px]"></div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-8 h-16 w-16 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900">
            <div className="flex h-full w-full items-center justify-center bg-zinc-800">
              <Users className="h-6 w-6 text-zinc-500" />
            </div>
          </div>

          <h2 className="mb-8 text-3xl leading-tight font-black md:text-5xl">
            &quot;Smartout forandret alt. Vi sparer 40 timer i måneden kun på vaktplanlegging, og
            personalet elsker appen.&quot;
          </h2>

          <div>
            <div className="text-lg font-bold">Sofie Larsen</div>{" "}
            {/* CHANGED: "Sofia Lindström" (Swedish name) → Norwegian name */}
            <div className="mt-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
              Driftssjef, Brasserie Blå{" "}
              {/* CHANGED: "Urban Deli" (Stockholm venue) → Norwegian venue */}
            </div>
          </div>

          <div className="mx-auto mt-12 grid max-w-lg grid-cols-2 gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="mb-1 text-3xl font-black text-orange-400">-40t</div>
              <div className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
                Admin per måned
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="mb-1 text-3xl font-black text-emerald-400">100%</div>
              <div className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
                Team Tilfredshet
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Employee Experience Section */}
      <section className="relative overflow-hidden border-t border-zinc-800 bg-zinc-900/20 px-6 py-40">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-16 lg:flex-row">
          <div className="flex-1 lg:order-2">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1">
              <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
                For de Ansatte
              </span>
            </div>
            <h2 className="mb-6 text-3xl font-bold md:text-5xl">
              En app teamet ditt faktisk vil bruke.
            </h2>
            <p className="mb-8 max-w-xl text-lg text-zinc-400">
              Slutt på forvirring rundt vakter og bytting i rotete chattespor. Med Smartout-appen
              har de ansatte full kontroll over sin egen hverdag, direkte i lommen.
            </p>

            <ul className="mb-8 space-y-4">
              {[
                "Bytt vakter med ett klikk (godkjennes av leder)",
                "Push-varsler for nye vakter og beskjeder",
                "Se opptjent lønn og estimater live",
                "Søk om ferie og fravær direkte i appen",
              ].map((item, i) => (
                <m.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="text-zinc-300">{item}</span>
                </m.li>
              ))}
            </ul>
          </div>

          <div className="relative flex w-full flex-1 justify-center lg:order-1">
            {/* Mobile Mockup */}
            <div className="relative flex h-[600px] w-[300px] flex-col overflow-hidden rounded-[3rem] border-[8px] border-zinc-800 bg-black shadow-2xl">
              {/* Dynamic Island */}
              <div className="absolute inset-x-0 top-0 z-50 mt-2 flex h-7 justify-center">
                <div className="h-7 w-24 rounded-full bg-black"></div>
              </div>

              {/* App Content */}
              <div className="relative flex flex-1 flex-col gap-6 bg-zinc-950 px-5 pt-16 pb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500">I dag, 14. Okt</p>
                    <h3 className="text-xl font-bold">God morgen, Erik</h3>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/20 font-bold text-orange-500">
                    EK
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 shadow-lg shadow-orange-500/20">
                  <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
                  <p className="mb-1 text-sm font-bold tracking-wider text-white/80 uppercase">
                    Neste vakt
                  </p>
                  <h4 className="mb-4 text-2xl font-black text-white">16:00 - 23:30</h4>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="rounded-lg bg-black/20 px-3 py-1 text-sm font-medium text-white">
                      Bartender
                    </span>
                    <span className="text-sm text-white/90">Brasserie Blå</span>{" "}
                    {/* CHANGED: consistent with testimonial name change */}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-bold tracking-wider text-zinc-400 uppercase">
                    Ledige Vakter
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                      <div>
                        <div className="font-bold">Lørdag, 18. Okt</div>
                        <div className="text-xs text-zinc-500">18:00 - 02:00 &bull; Servitør</div>
                      </div>
                      <button className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black">
                        Meld interesse
                      </button>
                    </div>
                  </div>
                </div>

                <m.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1, duration: 0.5 }}
                  className="absolute right-5 bottom-6 left-5 flex items-center justify-between rounded-2xl border border-zinc-700 bg-zinc-800 p-4 shadow-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Vaktbytte godkjent</div>
                      <div className="text-[10px] text-zinc-400">Anna tar vakten din fredag.</div>
                    </div>
                  </div>
                </m.div>
              </div>
            </div>

            <div className="absolute -bottom-10 -z-10 h-96 w-96 rounded-full bg-orange-500/20 blur-[100px]"></div>
          </div>
        </div>
      </section>

      {/* Security & Compliance Section */}
      <section className="relative z-10 bg-zinc-950 px-6 py-40">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
                <Shield className="h-8 w-8 text-zinc-100" />
              </div>
              <h2 className="mb-6 text-3xl font-black tracking-tight md:text-5xl">
                Bygget for trygghet. Designet for compliance.
              </h2>
              <p className="mb-8 text-lg leading-relaxed text-zinc-400">
                Arbeidsmiljøloven er kompleks. Vi har bygget et regelmotorverk som fungerer som din
                digitale HR-avdeling, slik at du aldri mer trenger å bekymre deg for bøter eller
                manuelle sjekker.
              </p>

              <div className="space-y-6">
                {[
                  {
                    title: "GDPR-Sertifisert",
                    desc: "All ansattdata er kryptert, lagret sikkert i EU, og automatisk slettet i henhold til lovverk når en ansatt slutter.",
                  },
                  {
                    title: "Arbeidsmiljøloven (AML)",
                    desc: "Automatisk validering mot norske og svenske arbeidslover. Systemet blokkerer vakter som bryter med lovpålagt hviletid.",
                  },
                  {
                    title: "Bank-grad Sikkerhet",
                    desc: "Enterprise-grade infrastruktur med Rollebasert tilgangskontroll (RBAC), SSO-integrasjon og full revisjonslogg for alle handlinger.",
                  },
                ].map((item, idx) => (
                  <m.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.15 }}
                    className="flex gap-4"
                  >
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
                      <CheckCircle2 className="h-3 w-3 text-zinc-500" />
                    </div>
                    <div>
                      <h4 className="mb-1 text-lg font-bold text-zinc-200">{item.title}</h4>
                      <p className="text-sm leading-relaxed text-zinc-500">{item.desc}</p>
                    </div>
                  </m.div>
                ))}
              </div>
            </div>

            <div className="relative rounded-3xl border border-zinc-800 bg-[#0c0c0e] p-8 shadow-2xl lg:p-12">
              {/* Rules Engine Visualization */}
              <div className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-4">
                <span className="font-mono text-xs text-zinc-500 uppercase">
                  AML_VALIDATION_ENGINE
                </span>
                <div className="flex gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-bold tracking-wider text-emerald-500">ACTIVE</span>
                </div>
              </div>

              <div className="space-y-4 font-mono text-sm">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="mb-2 flex justify-between">
                    <span className="text-zinc-400">Regel 10.8 (Daglig hviletid)</span>
                    <span className="text-emerald-400">PASS</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {">"} Evaluering: 11 timer hviletid overholdt for Erik K.
                  </div>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <div className="mb-2 flex justify-between">
                    <span className="text-red-400">Regel 10.9 (Ukentlig hviletid)</span>
                    <span className="font-bold text-red-500">VIOLATION PREVENTED</span>
                  </div>
                  <div className="text-xs text-red-500/80">
                    {">"} Forsøk på planlegging avviste. Ansatt krever 35t sammenhengende hvile.
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="mb-2 flex justify-between">
                    <span className="text-zinc-400">Kontor 3 (Overtid)</span>
                    <span className="text-emerald-400">PASS</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {">"} Evaluering: Under maksgrense for månedlig overtid (14t/25t max).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-t border-zinc-800 bg-zinc-900/30 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-5xl">Vanlige Spørsmål</h2>
            <p className="mx-auto max-w-xl text-zinc-400">
              Svar på det ledere oftest lurer på før de tar i bruk Smartout.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "Hvor lang tid tar det å komme i gang?",
                a: "Takket være våre pre-definerte maler for servicebransjen, kan en restaurant på 30 ansatte være i full drift og ha sin første live-vaktplan innen 48 timer fra onboarding.",
              },
              {
                q: "Integrerer dere med vårt nåværende POS-system?",
                a: "Vi integrerer direkte med markedets ledende aktører (Zettle, Trivec, Lightspeed, etc.) for å hente sanntids salgsdata direkte inn i vaktplanleggeren din for %-lønnsberegninger.",
              },
              {
                q: "Krever det mye opplæring for de ansatte?",
                a: "Appen for ansatte er designet for å være like intuitiv som sosiale medier. Vi opplever at ansatte laster den ned og forstår basisfunksjoner (fravær, bytter, tilgjengelighet) uten opplæring.",
              },
              {
                q: "Er det bindingstid?",
                a: "Vår filosofi er at et godt produkt holder på kundene. Du binder deg måned for måned as-a-service, eller du kan velge et årlig abonnement for å få 20% rabatt.",
              },
            ].map((faq, idx) => (
              <details
                key={idx}
                className="group rounded-2xl border border-zinc-800 bg-zinc-950 transition-colors hover:border-zinc-700"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between p-6 font-bold text-zinc-200">
                  <span>{faq.q}</span>
                  <span className="transition group-open:rotate-45">
                    <svg
                      fill="none"
                      height="24"
                      width="24"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <line x1="12" x2="12" y1="5" y2="19"></line>
                      <line x1="5" x2="19" y1="12" y2="12"></line>
                    </svg>
                  </span>
                </summary>
                <div className="px-6 pt-0 pb-6 text-sm leading-relaxed text-zinc-500">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* SmartOut AI Section */}
      <section id="smartout-ai" className="px-6 py-20 lg:py-32">
        <div className="mx-auto max-w-7xl">
          {/* Badge + heading */}
          <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1">
              <Bot className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-xs font-semibold tracking-wider text-orange-400 uppercase">
                SmartOut AI
              </span>
            </div>
            <h2 className="mb-4 text-4xl font-black tracking-tight text-white md:text-6xl">
              {VARIANT_AI_SECTION.E.heading}
            </h2>
            <p className="mx-auto max-w-2xl text-xl font-medium text-zinc-400">
              {VARIANT_AI_SECTION.E.subheading}
            </p>
          </m.div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left: 3 compact capability cards */}
            <div className="space-y-4">
              {VARIANT_AI_SECTION.E.capabilities.map((cap, i) => {
                const icons = [
                  <ZapIcon key="zap" className="h-5 w-5 text-orange-400" />,
                  <Bot key="bot" className="h-5 w-5 text-orange-400" />,
                  <CheckCircle2 key="check" className="h-5 w-5 text-orange-400" />,
                ];
                return (
                  <m.div
                    key={cap.title}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                      {icons[i]}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{cap.title}</h3>
                      <p className="text-sm text-zinc-400">{cap.description}</p>
                    </div>
                  </m.div>
                );
              })}
            </div>

            {/* Right: Voice widget */}
            <VoiceDemoWidget config={VARIANT_VOICE_CONFIG.E} height="400px" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-10 text-center md:p-20">
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-orange-500/10 blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-blue-500/10 blur-[100px]"></div>

          <h2 className="relative z-10 mb-6 text-4xl font-bold md:text-6xl">
            Klar til å transformere driften?
          </h2>
          <p className="relative z-10 mx-auto mb-10 max-w-2xl text-xl text-zinc-400">
            Bli med tusenvis av bedrifter som bruker Smartout for å bygge robuste, effektive og
            lykkelige arbeidsplasser.
          </p>

          <div className="relative z-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Start Gratis Prøveperiode")}
              className="w-full rounded-xl bg-white px-8 py-4 text-center text-lg font-black text-zinc-950 transition-colors hover:bg-zinc-200 sm:w-auto"
            >
              Start Gratis Prøveperiode
            </Link>
            <Link
              href="/pricing"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-8 py-4 text-center text-lg font-bold text-white transition-colors hover:bg-zinc-700 sm:w-auto"
            >
              Kontakt Salg
            </Link>
          </div>
          <p className="relative z-10 mt-6 text-sm text-zinc-500">
            Ingen kredittkort påkrevd. 14 dagers gratis prøveperiode.
          </p>
        </div>
      </section>

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}
