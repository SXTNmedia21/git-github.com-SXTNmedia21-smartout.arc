"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Key,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function ProsedyrerPage() {
  const router = useRouter();
  const tasks = [
    {
      id: 1,
      title: "Slå på ventilasjon & lys",
      time: "06:00",
      count: 1,
      completed: 1,
      status: "done",
    },
    {
      id: 2,
      title: "Temperaturkontroll kjølerom",
      time: "06:15",
      count: 2,
      completed: 2,
      status: "done",
    },
    {
      id: 3,
      title: "Fylle på kaffemaskiner",
      time: "06:30",
      count: 1,
      completed: 0,
      status: "active",
    },
    {
      id: 4,
      title: "Mottak av ferske brødvarer",
      time: "07:00",
      count: 1,
      completed: 0,
      status: "pending",
    },
    {
      id: 5,
      title: "Oppdatere dagens meny-tavle",
      time: "07:30",
      count: 1,
      completed: 0,
      status: "pending",
    },
  ];

  return (
    <div className="min-h-screen bg-[#050505] p-4 pt-24 text-zinc-100 selection:bg-rose-500/30 sm:p-6 md:p-12 md:pt-28">
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
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-rose-500 to-pink-500 p-[1px] shadow-[0_0_50px_-10px_rgba(244,63,94,0.4)]">
            <div className="flex h-full w-full items-center justify-center rounded-[23px] bg-[#0a0a0c]">
              <ClipboardList className="h-10 w-10 text-white drop-shadow-lg" />
            </div>
          </div>
          <div className="max-w-3xl">
            <h1 className="mb-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Prosedyrer & Arbeidsflyt
            </h1>
            <p className="text-xl leading-relaxed text-zinc-400">
              Byggeklossene i SmartOut. Alt som må gjøres kan samles i en prosedyre og kobles til
              riktig sesong, lokasjon eller rolle for en idiotsikker operasjon.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Workflow Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative flex min-h-[600px] flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0a0a0c]/80 p-8 shadow-[0_0_50px_-15px_rgba(244,63,94,0.15)] backdrop-blur-3xl md:p-12 lg:col-span-2"
          >
            <div className="pointer-events-none absolute top-0 right-0 h-[50%] w-[80%] bg-gradient-to-bl from-rose-500/10 to-transparent blur-[100px]"></div>

            <div className="z-10 mb-8 flex items-center justify-between border-b border-white/5 pb-8">
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-rose-500 bg-zinc-800 shadow-lg">
                  <ClipboardList className="h-8 w-8 text-rose-400" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-2xl font-black text-white">Morgenrutine Kjøkken</h2>
                  <span className="flex items-center gap-1 text-sm font-bold tracking-widest text-rose-400 uppercase">
                    <Key className="h-3.5 w-3.5" /> Aktiv Prosedyre
                  </span>
                </div>
              </div>
              <div className="flex hidden flex-col items-end sm:flex">
                <span className="mb-1 text-sm font-medium text-zinc-500">Fremdrift</span>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full w-[60%] bg-rose-500"></div>
                  </div>
                  <span className="text-lg font-bold text-white">60%</span>
                </div>
              </div>
            </div>

            {/* Tasks List */}
            <div className="relative z-10 flex flex-1 flex-col">
              <h3 className="mb-6 flex items-center gap-2 font-bold text-zinc-400">
                <CheckCircle2 className="h-5 w-5 text-rose-400" /> Oppgaver i Prosedyren
              </h3>

              <div className="space-y-4">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="group flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-black/40 p-5 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white/5 bg-zinc-900">
                        {task.status === "done" ? (
                          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                        ) : task.status === "active" ? (
                          <Clock className="h-6 w-6 text-amber-500" />
                        ) : (
                          <AlertTriangle className="h-6 w-6 text-zinc-600" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span
                          className={`mb-1 text-lg font-bold transition-colors group-hover:text-rose-400 ${task.status === "done" ? "text-zinc-500 line-through" : "text-white"}`}
                        >
                          {task.title}
                        </span>
                        <div className="flex items-center gap-3 text-xs font-bold tracking-wider text-zinc-500 uppercase">
                          <span className="rounded-sm bg-rose-500/10 px-2 py-0.5 text-rose-400">
                            {task.time}
                          </span>
                          <span>
                            {task.completed} / {task.count} Fullført
                          </span>
                        </div>
                      </div>
                    </div>

                    <button className="hidden rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                      Åpne
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Features checklist */}
          <div className="flex flex-col gap-6">
            {[
              {
                title: "Standardiser SOP",
                desc: "Digitaliser dine Standard Operating Procedures. Alle vet nøyaktig hva de skal gjøre, til enhver tid.",
                icon: ClipboardList,
                color: "text-rose-400",
                bg: "bg-rose-500/10",
                border: "border-rose-500/20",
              },
              {
                title: "Fleksibel Tildeling",
                desc: "Koble en prosedyre til en sesong, en spesifikk rolle, eller la den være en sjekkliste du krever inn via QR-kode.",
                icon: Key,
                color: "text-rose-400",
                bg: "bg-rose-500/10",
                border: "border-rose-500/20",
              },
              {
                title: "Total Kontroll",
                desc: "Spor hvem som gjorde hva, når. Full revisjonsspor for temperaturer og matsikkerhet på kjøkkenet.",
                icon: Shield,
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
              },
            ].map((feat, i) => (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * (i + 1) }}
                key={i}
                className="group rounded-3xl border border-white/5 bg-[#0a0a0c]/80 p-6 shadow-lg backdrop-blur-xl transition-all hover:border-white/20 hover:shadow-xl"
              >
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${feat.bg} border ${feat.border}`}
                >
                  <feat.icon className={`h-6 w-6 ${feat.color}`} />
                </div>
                <h3 className="mb-2 text-xl font-bold text-white">{feat.title}</h3>
                <p className="text-sm leading-relaxed font-medium text-zinc-400">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <NextPageBanner
          href="/concepts/seasons"
          title="Sesonger & Bølger"
          subtitle="Neste Konsept"
          color="from-fuchsia-500/10"
        />
      </div>
    </div>
  );
}
