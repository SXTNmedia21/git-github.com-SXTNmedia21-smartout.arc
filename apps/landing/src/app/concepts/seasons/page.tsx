"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Leaf,
  Snowflake,
  Sun,
  CalendarRange,
  ToggleRight,
  Copy,
  Sparkles,
  Target,
  CheckCircle2,
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
      border: "border-amber-500/30",
      iconBg: "bg-amber-500/15",
      accentClass: "from-amber-500 to-orange-500",
      routines: 84,
    },
    {
      id: 2,
      name: "Høstmeny",
      icon: Leaf,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      iconBg: "bg-orange-500/15",
      accentClass: "from-orange-500 to-red-500",
      routines: 67,
    },
    {
      id: 3,
      name: "Julebordsesong",
      icon: Snowflake,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      iconBg: "bg-cyan-500/15",
      accentClass: "from-cyan-500 to-blue-500",
      routines: 112,
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
        {/* Header */}
        <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-6">
            <div className="relative h-20 w-20 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 p-[1px] shadow-[0_0_50px_-10px_rgba(251,191,36,0.4)]">
              <div className="absolute -top-3 -right-3 z-20 flex items-center gap-1 rounded-full bg-fuchsia-500 px-3 py-1 text-[10px] font-black tracking-widest text-white uppercase shadow-[0_0_15px_rgba(217,70,239,0.5)]">
                <Sparkles className="h-3 w-3" /> 100% Unikt
              </div>
              <div className="relative z-10 flex h-full w-full items-center justify-center rounded-full bg-[#0a0a0c]">
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
            {/* Accent bar */}
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${currentSeason.accentClass} transition-all duration-700`}
            />

            {/* Season selector */}
            <div className="custom-scrollbar z-10 mb-10 flex gap-3 overflow-x-auto pb-2">
              {seasons.map((s) => {
                const isActive = selected === s.id;
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s.id)}
                    className={`flex min-w-max items-center gap-3 rounded-full border px-5 py-3 transition-all duration-300 ${
                      isActive
                        ? `${s.bg} ${s.border}`
                        : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300 ${
                        isActive ? s.iconBg : "bg-white/5"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${isActive ? s.color : "text-zinc-500"}`} />
                    </div>
                    <span
                      className={`text-sm font-bold ${isActive ? "text-white" : "text-zinc-400"}`}
                    >
                      {s.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active season display */}
            <div className="relative z-10 flex flex-1 flex-col justify-center">
              <motion.div
                key={selected}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/5 bg-black/40 px-8 py-14 text-center sm:px-12"
              >
                <div className={`absolute inset-0 ${currentSeason.bg} opacity-30 blur-3xl`} />

                <div
                  className={`relative z-10 mb-8 flex h-28 w-28 items-center justify-center rounded-full ${currentSeason.iconBg} ring-1 ring-white/10`}
                >
                  <currentSeason.icon
                    className={`h-14 w-14 ${currentSeason.color} drop-shadow-lg`}
                  />
                </div>

                <h2 className="relative z-10 mb-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  {currentSeason.name}
                </h2>
                <p className="relative z-10 mx-auto mb-8 max-w-md text-base leading-relaxed text-zinc-400">
                  Alle <strong className="text-zinc-200">{currentSeason.name.toLowerCase()}</strong>
                  -protokoller er aktive. Appen har automatisk byttet ut innhold for samtlige
                  ansatte.
                </p>

                <div className="relative z-10 flex items-center gap-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {currentSeason.routines} Rutiner Modifisert
                </div>
              </motion.div>
            </div>
          </div>

          {/* Features checklist */}
          <div className="flex flex-col gap-5">
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
                icon: Copy,
              },
            ].map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * (i + 1) }}
                  key={i}
                  className={`rounded-2xl border p-6 transition-all ${
                    feat.isPrimary
                      ? "border-fuchsia-500/20 bg-fuchsia-500/5"
                      : "border-white/5 bg-[#0a0a0c]/80 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        feat.isPrimary ? "bg-fuchsia-500/15" : "bg-amber-500/10"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${feat.isPrimary ? "text-fuchsia-400" : "text-amber-400"}`}
                      />
                    </div>
                    <div>
                      <h3
                        className={`mb-1.5 text-[15px] font-bold ${feat.isPrimary ? "text-fuchsia-300" : "text-white"}`}
                      >
                        {feat.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-zinc-500">{feat.desc}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
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
