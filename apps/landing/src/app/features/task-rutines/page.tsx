"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ListTodo,
  MoreVertical,
  Search,
  CheckSquare2,
  Square,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function OppgaverRutinerPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: "Sjekke kassa og opptelling",
      assigned: "Åpningsvakt",
      time: "09:00",
      done: false,
    },
    { id: 2, title: "Vaske kaffemaskinen", assigned: "Barista", time: "11:00", done: true },
    { id: 3, title: "Kontrollere nødutganger", assigned: "Manager", time: "14:00", done: false },
    {
      id: 4,
      title: "Sette ut stoler på uteservering",
      assigned: "Servering",
      time: "15:00",
      done: false,
    },
  ]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const progress = (tasks.filter((t) => t.done).length / tasks.length) * 100;

  return (
    <div className="min-h-screen bg-[#050505] p-4 pt-24 text-zinc-100 selection:bg-amber-500/30 sm:p-6 md:p-12 md:pt-28">
      <Navigation />

      <button
        onClick={() => router.back()}
        className="mb-12 inline-flex items-center gap-2 text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-5 w-5" />
        Tilbake til forside
      </button>

      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 p-[1px] shadow-[0_0_30px_-5px_rgba(251,191,36,0.4)]">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#111]">
              <ListTodo className="h-8 w-8 text-white drop-shadow-md" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">Oppgaver & Rutiner</h1>
            <p className="text-lg text-zinc-400">Individuelt ansvar og daglige gjøremål</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0c]/80 shadow-[0_0_50px_-15px_rgba(251,191,36,0.2)] backdrop-blur-3xl"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500"></div>
          <div className="pointer-events-none absolute -inset-20 bg-amber-500/5 blur-[100px]"></div>

          {/* App Header */}
          <div className="relative z-10 flex flex-col items-start justify-between gap-4 border-b border-white/5 bg-white/[0.02] p-8 sm:flex-row sm:items-center">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold">Dagens rutiner</h2>
              <p className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span> Aktiv nå:
                Åpningsvakt
              </p>
            </div>

            <div className="flex w-full gap-4 sm:w-auto">
              <div className="relative flex-1 text-zinc-400 transition-colors focus-within:text-white sm:flex-none">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Søk i oppgaver..."
                  className="w-full rounded-full border border-white/10 bg-black/40 py-2 pr-4 pl-9 text-sm focus:border-amber-500/50 focus:outline-none sm:w-64"
                />
              </div>
            </div>
          </div>

          {/* App Content */}
          <div className="relative z-10 flex min-h-[500px] flex-col md:flex-row">
            {/* Task List */}
            <div className="flex flex-col border-r border-white/5 p-8 md:w-2/3">
              <div className="mb-6 flex items-end justify-between">
                <h3 className="text-lg font-bold text-zinc-300">Mine oppgaver</h3>
                <span className="text-xs font-bold tracking-widest text-amber-500 uppercase">
                  {tasks.filter((t) => t.done).length} av {tasks.length} fullført
                </span>
              </div>

              <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              <div className="flex flex-col gap-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${task.done ? "border-white/5 bg-white/5 opacity-50" : "border-white/10 bg-black/40 hover:border-amber-500/30"} `}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {task.done ? (
                          <CheckSquare2 className="h-6 w-6 text-emerald-500" />
                        ) : (
                          <Square className="h-6 w-6 text-zinc-600" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span
                          className={`font-bold transition-all ${task.done ? "text-zinc-500 line-through" : "text-white"}`}
                        >
                          {task.title}
                        </span>
                        <div className="mt-1 flex gap-2 text-xs font-medium text-zinc-500">
                          <span className="rounded-md bg-white/5 px-2 py-0.5">{task.assigned}</span>
                          <span className="flex items-center gap-1">{task.time}</span>
                        </div>
                      </div>
                    </div>
                    <button className="p-2 text-zinc-600 hover:text-white">
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Side Panel: Focus task */}
            <div className="flex flex-col justify-between bg-black/20 p-8 md:w-1/3">
              <div>
                <h3 className="mb-6 border-b border-white/5 pb-4 text-lg font-bold text-zinc-300">
                  Neste prioritet
                </h3>
                {(() => {
                  const next = tasks.filter((t) => !t.done)[0];
                  return next ? (
                    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-6">
                      <div className="mb-4 flex items-start justify-between">
                        <span className="truncate rounded bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-500">
                          {next.assigned}
                        </span>
                        <span className="text-sm font-bold text-zinc-400">{next.time}</span>
                      </div>
                      <h4 className="mb-4 text-xl font-bold text-amber-50">{next.title}</h4>
                      <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                        Husk å notere ned eventuelle avvik i kommentarfeltet dersom oppgaven ikke
                        lar seg fullføre på vanlig måte.
                      </p>
                      <button className="w-full rounded-xl bg-amber-500 py-3 font-black text-black transition-colors hover:bg-amber-400">
                        Begynn nå
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-12 text-center">
                      <CheckCircle2 className="mb-4 h-16 w-16 text-emerald-500/50" />
                      <p className="font-bold text-zinc-400">Ingen flere oppgaver igjen!</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </motion.div>

        <NextPageBanner
          href="/features/staff-training"
          title="HR & Opplæring"
          subtitle="Neste Funksjon"
          color="from-fuchsia-500/10"
        />
      </div>
    </div>
  );
}
