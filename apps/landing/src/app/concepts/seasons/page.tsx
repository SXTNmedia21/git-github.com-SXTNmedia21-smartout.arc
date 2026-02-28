"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Leaf,
  Snowflake,
  Sun,
  CalendarRange,
  ToggleRight,
  Info,
  Sparkles,
  Target,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function SesongerPage() {
  const router = useRouter();
  const [selected, setSelected] = useState(1);

  const seasons = [
    {
      id: 1,
      name: "Sommermeny",
      icon: Sun,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      glow: "shadow-[0_0_50px_-10px_rgba(251,191,36,0.3)]",
    },
    {
      id: 2,
      name: "Høstmeny",
      icon: Leaf,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      glow: "shadow-[0_0_50px_-10px_rgba(249,115,22,0.3)]",
    },
    {
      id: 3,
      name: "Julebordsesong",
      icon: Snowflake,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      glow: "shadow-[0_0_50px_-10px_rgba(34,211,238,0.3)]",
    },
  ];

  const currentSeason = seasons.find((s) => s.id === selected)!;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] p-4 pt-24 text-zinc-100 selection:bg-amber-500/30 sm:p-6 md:p-12 md:pt-28">
      <Navigation />

      <button
        onClick={() => router.back()}
        className="mb-12 inline-flex items-center gap-2 text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-5 w-5" />
        Tilbake til forside
      </button>

      <div className="mx-auto max-w-6xl">
        <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-6">
            <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-tr from-amber-400 to-orange-500 p-[1px] shadow-[0_0_50px_-10px_rgba(251,191,36,0.4)]">
              <div className="absolute -top-3 -right-3 z-20 flex items-center gap-1 rounded-full bg-fuchsia-500 px-3 py-1 text-[10px] font-black tracking-widest text-white uppercase shadow-[0_0_15px_rgba(217,70,239,0.5)]">
                <Sparkles className="h-3 w-3" /> 100% Unikt
              </div>
              <div className="relative z-10 flex h-full w-full items-center justify-center rounded-[23px] bg-[#0a0a0c]">
                <CalendarRange className="h-10 w-10 text-white drop-shadow-lg" />
              </div>
            </div>
            <div className="max-w-xl">
              <h1 className="mb-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
                Sesonger
              </h1>
              <p className="text-lg leading-relaxed text-zinc-400">
                Et konsept{" "}
                <strong className="font-bold text-amber-400">100% unikt for SmartOut</strong>. Endre
                hundrevis av menyer, policyer og rutiner på sekundet, basert på hvilken sesong
                restauranten din er i.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Visualizer */}
          <div className="relative flex min-h-[500px] flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0a0a0c]/80 p-8 shadow-[0_0_50px_-15px_rgba(251,191,36,0.15)] backdrop-blur-3xl md:p-12 lg:col-span-2">
            <div
              className={`absolute inset-x-0 top-0 h-1 transition-colors duration-1000 ${currentSeason.bg.replace("/10", "")}`}
            ></div>

            <div className="custom-scrollbar z-10 mb-12 flex gap-4 overflow-x-auto pb-4">
              {seasons.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  className={`flex min-w-max items-center gap-3 rounded-2xl border px-6 py-4 transition-all duration-300 ${selected === s.id ? `${s.bg} ${s.border} ${s.glow}` : "border-white/5 bg-black/30 opacity-60 hover:opacity-100"}`}
                >
                  <s.icon className={`h-6 w-6 ${selected === s.id ? s.color : "text-zinc-500"}`} />
                  <span
                    className={`text-lg font-bold ${selected === s.id ? "text-white" : "text-zinc-400"}`}
                  >
                    {s.name}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative z-10 flex flex-1 flex-col justify-center">
              <motion.div
                key={selected}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-white/5 bg-black/40 p-12 text-center shadow-inner"
              >
                <div className={`absolute inset-0 ${currentSeason.bg} opacity-20 blur-3xl`}></div>
                <currentSeason.icon
                  className={`mb-6 h-24 w-24 ${currentSeason.color} relative z-10 drop-shadow-[0_0_25px_rgba(251,191,36,0.5)]`}
                />
                <h2 className="relative z-10 mb-4 text-3xl font-black tracking-tight text-white uppercase sm:text-4xl">
                  {currentSeason.name} Aktiv
                </h2>
                <p className="relative z-10 mx-auto mb-8 max-w-md text-lg leading-relaxed text-zinc-300">
                  Akkurat nå har <strong>{currentSeason.name.toLowerCase()}</strong>-protokollene
                  fortrengt alle standardoppgaver. Appen har automatisk byttet ut alt innhold for
                  samtlige ansatte.
                </p>
                <div className="relative z-10 flex items-center gap-3 rounded-full border border-emerald-500/50 bg-emerald-500/20 px-6 py-3 font-bold text-emerald-400 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]">
                  <ToggleRight className="h-5 w-5" /> 84 Rutiner Modifisert
                </div>
              </motion.div>
            </div>
          </div>

          {/* Features checklist */}
          <div className="flex flex-col gap-6">
            {[
              {
                title: "SmartOut Eksklusiv",
                desc: "Ingen andre systemer tilbyr denne graden av fleksibilitet. Ett klikk endrer hele bedriftens maskineri for en ny årstid.",
                icon: Target,
                isPrimary: true,
              },
              {
                title: "Aktiver via knapp",
                desc: "Høstmeny? Sommertid? Bytt meny og rengjøringsrutiner synkront over hele organisasjonen umiddelbart.",
                icon: ToggleRight,
              },
              {
                title: "Gjenbruk og kopier",
                desc: "Var fjorårets sommerrutiner bra? Gjenbruk og kopier over til nytt år, så er du klar på sekunder.",
                icon: Info,
              },
            ].map((feat, i) => (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * (i + 1) }}
                key={i}
                className={`border border-l-4 border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl ${feat.isPrimary ? "border-l-fuchsia-500 bg-fuchsia-500/5" : "border-l-amber-500"} group rounded-2xl p-6 shadow-lg transition-all`}
              >
                <div className="flex items-start gap-4">
                  <feat.icon
                    className={`h-6 w-6 flex-shrink-0 ${feat.isPrimary ? "text-fuchsia-400" : "text-amber-500/50"}`}
                  />
                  <div>
                    <h3
                      className={`mb-2 text-lg font-bold ${feat.isPrimary ? "text-fuchsia-400" : "text-white"}`}
                    >
                      {feat.title}
                    </h3>
                    <p className="text-sm leading-relaxed font-medium text-zinc-400">{feat.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <NextPageBanner
          href="/concepts/daily-session"
          title="Den Daglige Økten"
          subtitle="Neste Konsept"
          color="from-cyan-500/10"
        />
      </div>
    </div>
  );
}
