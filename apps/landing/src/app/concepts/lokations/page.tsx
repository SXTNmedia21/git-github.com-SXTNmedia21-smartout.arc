"use client";

import { m } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Activity,
  CheckCircle2,
  Target,
  BarChart3,
  Database,
  ShieldCheck,
  Zap,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import Footer from "../../../components/footer";
import { usePageTracking } from "../../../hooks/useTracking";
import { useScrollTracking } from "../../../hooks/useScrollTracking";
import { useClickTracking } from "../../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../../hooks/useSessionLifecycle";
import NextPageBanner from "../../../components/next-page-banner";

export default function LokasjonerPage() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const router = useRouter();
  const stats = [
    {
      label: "Aktive Lokasjoner",
      value: "142",
      icon: MapPin,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
    },
    {
      label: "Registrerte Soner",
      value: "854",
      icon: Target,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
    },
    {
      label: "Kontrollpunkter",
      value: "12,450",
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Totale Oppgaver",
      value: "1.2M",
      icon: Activity,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Aktive Rutiner",
      value: "45,000",
      icon: BarChart3,
      color: "text-fuchsia-400",
      bg: "bg-fuchsia-500/10",
      border: "border-fuchsia-500/20",
    },
    {
      label: "Prosedyrer",
      value: "340",
      icon: Database,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
    },
    {
      label: "Aktive Retningslinjer",
      value: "12",
      icon: ShieldCheck,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      label: "Automatiseringer",
      value: "2,840",
      icon: Zap,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] p-4 pt-24 text-zinc-100 selection:bg-orange-500/30 sm:p-6 md:p-12 md:pt-28">
      <Navigation />

      <button
        onClick={() => router.back()}
        className="mb-12 inline-flex items-center gap-2 text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-5 w-5" />
        Tilbake til forside
      </button>

      <div className="mx-auto max-w-6xl">
        <div className="mb-16 flex flex-col items-center gap-6 text-center">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-orange-500 to-rose-500 p-[1px] shadow-[0_0_50px_-10px_rgba(249,115,22,0.4)]">
            <div className="flex h-full w-full items-center justify-center rounded-[23px] bg-[#0a0a0c]">
              <Activity className="h-10 w-10 text-white drop-shadow-lg" />
            </div>
          </div>
          <div className="max-w-3xl">
            <h1 className="mb-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Kapasitet & Datavolum
            </h1>
            <p className="text-xl leading-relaxed text-zinc-400">
              Et glimt av sanntidsdata for lokasjonene dine. Bygget for enorm skala og uendelig
              detaljstyring – uansett hvor stor du blir.
            </p>
          </div>
        </div>

        {/* Score Section */}
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0c]/80 p-8 backdrop-blur-3xl"
          >
            <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 bg-emerald-500/10 blur-[80px]"></div>
            <h2 className="mb-2 text-sm font-bold tracking-widest text-zinc-400 uppercase">
              Daglig Kvalitetspoeng
            </h2>
            <div className="flex items-end gap-4">
              <span className="text-4xl font-black tracking-tighter text-white sm:text-5xl md:text-7xl">
                98.4<span className="text-4xl text-emerald-400">%</span>
              </span>
              <div className="mb-2 flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 font-bold text-emerald-400">
                <TrendingUp className="h-4 w-4" /> +2.1%
              </div>
            </div>
            <div className="mt-8 flex gap-2">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full ${i < 9 ? "bg-emerald-500" : "bg-zinc-800"}`}
                ></div>
              ))}
            </div>
          </m.div>

          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative flex flex-col justify-center overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0c]/80 p-8 backdrop-blur-3xl"
          >
            <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 bg-blue-500/10 blur-[80px]"></div>
            <h2 className="mb-2 text-sm font-bold tracking-widest text-zinc-400 uppercase">
              Suksessrate (Alle Lokasjoner)
            </h2>
            <div className="flex items-center gap-6">
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-[12px] border-zinc-800">
                <svg className="absolute inset-0 h-full w-full -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-blue-500"
                    strokeDasharray="326"
                    strokeDashoffset="5"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="relative z-10 text-3xl font-black text-white">
                  99<span className="text-xl text-zinc-400">%</span>
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-4">
                <div>
                  <span className="block font-bold text-white">1,198,000</span>
                  <span className="text-xs font-medium text-zinc-500 uppercase">
                    Oppgaver Fullført
                  </span>
                </div>
                <div>
                  <span className="block font-bold text-red-400">2,000</span>
                  <span className="text-xs font-medium text-zinc-500 uppercase">
                    Manglende/Forfalt
                  </span>
                </div>
              </div>
            </div>
          </m.div>
        </div>

        {/* Grid of stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat, i) => (
            <m.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              key={i}
              className={`flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-[#0a0a0c]/80 p-6 text-center backdrop-blur-xl transition-transform hover:-translate-y-1`}
            >
              <div
                className={`h-12 w-12 rounded-2xl ${stat.bg} ${stat.border} mb-4 flex items-center justify-center border`}
              >
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <h3 className="mb-2 text-sm font-bold tracking-wider text-zinc-500 uppercase">
                {stat.label}
              </h3>
              <span className="text-3xl font-black text-white">{stat.value}</span>
            </m.div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Alle målinger representerer sanntidsdata aggregert på tvers av lokasjoner
          </p>
        </div>

        <NextPageBanner
          href="/concepts/procedures"
          title="Prosedyrer & Arbeidsflyt"
          subtitle="Neste Konsept"
          color="from-rose-500/10"
        />
      </div>
      <Footer />
    </div>
  );
}
