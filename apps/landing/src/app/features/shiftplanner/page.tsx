"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Users,
  CheckCircle2,
  MoreVertical,
  Briefcase,
  Network,
  Clock,
  AlertCircle,
  Circle,
  PlayCircle,
  Ban,
  Bot,
  Mic,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function VaktlisteLonnPage() {
  const router = useRouter();
  const [scheduleLayout, setScheduleLayout] = useState<"daily" | "weekly" | "monthly">("daily");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] p-4 pt-24 pb-12 text-zinc-100 selection:bg-orange-500/30 sm:p-6 md:p-12 md:pt-28">
      <Navigation />

      <button
        onClick={() => router.back()}
        className="mb-8 inline-flex items-center gap-2 text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-5 w-5" />
        Tilbake til forside
      </button>

      <div className="mx-auto flex max-w-[1500px] flex-col md:h-[85vh] md:min-h-[850px]">
        {/* Toggle controls to show off the different views on the landing page */}
        <div className="mb-8 flex shrink-0 flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">
              Lise – Din Digitale Vaktplanlegger
            </h1>
            <p className="mt-2 max-w-xl text-lg text-zinc-400">
              Opplev fremtidens workforce management. Chat med Lise for å automatisk generere,
              optimalisere, og publisere vaktplaner.
            </p>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex rounded-xl border border-white/10 bg-[#0a0a0c] p-1 shadow-inner">
              <button
                onClick={() => setScheduleLayout("daily")}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${scheduleLayout === "daily" ? "bg-zinc-800 text-white shadow-md" : "text-zinc-500 hover:text-white"}`}
              >
                Dag-til-dag
              </button>
              <button
                onClick={() => setScheduleLayout("weekly")}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${scheduleLayout === "weekly" ? "border border-orange-500/30 bg-orange-500/20 text-orange-400 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]" : "text-zinc-500 hover:text-white"}`}
              >
                Rullerende
              </button>
              <button
                onClick={() => setScheduleLayout("monthly")}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${scheduleLayout === "monthly" ? "bg-zinc-800 text-white shadow-md" : "text-zinc-500 hover:text-white"}`}
              >
                Månedsvisning
              </button>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#050505] font-sans text-zinc-100 shadow-[0_0_50px_-15px_rgba(249,115,22,0.15)]"
        >
          {/* AMBIENT BACKGROUND */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-3xl opacity-20">
            <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-orange-600/20 mix-blend-screen blur-[120px]" />
          </div>

          {/* HEADER / HERO SECTION */}
          <div className="relative z-10 flex w-full shrink-0 flex-col items-start justify-between gap-6 border-b border-white/5 bg-[#0a0a0c]/80 p-6 backdrop-blur-xl md:p-8 md:py-6 xl:flex-row xl:items-center">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-black tracking-widest text-orange-400 uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                AI-Drevet Vaktplanlegging
              </div>
              <h1 className="mb-2 text-3xl font-black tracking-tight text-white md:text-5xl">
                Møt din nye{" "}
                <span className="bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">
                  planlegger
                </span>
              </h1>
              <p className="max-w-xl text-sm leading-relaxed font-medium text-zinc-400 md:text-base">
                Lise er din digitale kollega som hjelper deg med å optimalisere vaktplaner, håndtere
                fravær og sikre at du alltid har rett bemanning. Glem manuelle oppgaver – snakk med
                Lise og la henne løse flokene for deg.
              </p>
            </div>

            <div className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-[#050505] p-3 shadow-[0_0_40px_-5px_rgba(249,115,22,0.15)] sm:gap-4 sm:rounded-3xl sm:p-5 sm:pl-4 xl:w-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>

              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 p-[2px] shadow-[0_0_20px_rgba(249,115,22,0.4)] sm:h-16 sm:w-16">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-[#050505]">
                  <Bot className="h-5 w-5 text-orange-500 transition-transform duration-300 group-hover:scale-110 sm:h-7 sm:w-7" />
                </div>
                <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 sm:h-4 sm:w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-zinc-950 bg-green-500 sm:h-4 sm:w-4"></span>
                </span>
              </div>

              <div className="min-w-0 flex-1 pl-1 sm:pl-2 xl:pr-12">
                <div className="mb-0.5 flex items-center gap-2 sm:mb-1">
                  <h3 className="truncate text-base leading-none font-bold text-white sm:text-lg">
                    Lise Botsson
                  </h3>
                  <span className="hidden shrink-0 rounded-md border border-orange-500/30 bg-orange-500/20 px-2 py-0.5 text-[9px] font-black tracking-widest text-orange-400 uppercase sm:inline-block">
                    AI Agent
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 sm:mt-1.5 sm:text-xs">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                  Klar til å hjelpe deg
                </p>
              </div>

              <div className="shrink-0">
                <button className="group/btn flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20 transition-all hover:scale-110 hover:from-orange-400 hover:to-rose-500 active:scale-95 sm:h-14 sm:w-14 sm:rounded-2xl">
                  <Mic className="h-5 w-5 transition-transform group-hover/btn:scale-95 sm:h-6 sm:w-6" />
                </button>
              </div>
            </div>
          </div>

          {/* MOBILE SHIFT PREVIEW */}
          <div className="relative z-10 space-y-3 p-4 md:hidden">
            <h3 className="mb-4 text-xs font-black tracking-widest text-zinc-500 uppercase">
              Dagens Vakter — Torsdag 27. feb
            </h3>
            {[
              {
                name: "Maria S.",
                dept: "Kjøkken",
                time: "07:00–15:00",
                color: "from-orange-500 to-rose-500",
              },
              {
                name: "Lars K.",
                dept: "Sal",
                time: "10:00–18:00",
                color: "from-cyan-500 to-blue-500",
              },
              {
                name: "Sofia A.",
                dept: "Bar",
                time: "16:00–00:00",
                color: "from-purple-500 to-indigo-500",
              },
              {
                name: "Peder N.",
                dept: "Kjøkken",
                time: "15:00–23:00",
                color: "from-orange-500 to-rose-500",
              },
              {
                name: "Nina H.",
                dept: "Sal",
                time: "17:00–01:00",
                color: "from-cyan-500 to-blue-500",
              },
            ].map((shift, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-2xl border border-white/5 bg-[#0a0a0c]/80 p-4"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${shift.color} text-sm font-bold text-white`}
                >
                  {shift.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{shift.name}</span>
                    <span className="text-sm font-medium text-zinc-400">{shift.time}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{shift.dept}</span>
                </div>
              </div>
            ))}
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-orange-500/20 bg-orange-500/5 p-4">
              <Plus className="h-5 w-5 text-orange-400" />
              <div>
                <span className="text-sm font-bold text-orange-400">2 åpne vakter</span>
                <p className="text-xs text-zinc-500">
                  Ekstra Servitør 17:00–23:00 · Vaskevakt 22:00–02:00
                </p>
              </div>
            </div>
          </div>

          {/* DESKTOP GRID */}
          <div className="relative z-10 hidden w-full flex-1 overflow-hidden bg-[#030303]/50 md:flex">
            {/* LEFT CONTEXT SIDEBAR */}
            <aside
              className={`z-20 hidden shrink-0 flex-col border-r border-white/5 bg-[#0a0a0c]/40 backdrop-blur-md transition-all duration-300 ease-in-out lg:flex ${isSidebarOpen ? "w-64 opacity-100 xl:w-72" : "w-0 overflow-hidden border-none opacity-0"}`}
            >
              <div className="w-64 flex-1 overflow-y-auto p-5 xl:w-72 xl:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[10px] font-black tracking-widest text-zinc-500 uppercase xl:text-xs">
                    Åpen Vakt
                  </h3>
                  <button className="rounded-md bg-orange-500/10 p-1 text-orange-400 transition-colors hover:text-orange-300">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <OpenShiftCard title="Ekstra Servitør" time="17:00-23:00" />
                  <OpenShiftCard title="Vaskevakt" time="22:00-02:00" />
                </div>
              </div>
            </aside>

            {/* THE GRID (CALENDAR) */}
            <main className="relative flex flex-1 shrink-0 overflow-auto">
              {scheduleLayout === "daily" && (
                <GridContent isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
              )}
              {scheduleLayout === "weekly" && (
                <WeeklyGridContent
                  isSidebarOpen={isSidebarOpen}
                  setIsSidebarOpen={setIsSidebarOpen}
                />
              )}
              {scheduleLayout === "monthly" && (
                <MonthlyGridContent
                  isSidebarOpen={isSidebarOpen}
                  setIsSidebarOpen={setIsSidebarOpen}
                />
              )}
            </main>
          </div>
        </motion.div>

        <NextPageBanner
          href="/features/task-rutines"
          title="Oppgaver & Rutiner"
          subtitle="Neste Funksjon"
          color="from-amber-500/10"
        />
      </div>
    </div>
  );
}

function OpenShiftCard({ title, time }: { title: string; time: string }) {
  return (
    <div className="group cursor-grab rounded-xl border border-white/5 bg-[#0a0a0c] p-3 shadow-sm transition-all hover:border-white/10 hover:bg-white/5 active:cursor-grabbing">
      <h4 className="mb-1 text-[13px] font-bold text-white transition-colors group-hover:text-orange-400">
        {title}
      </h4>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
        <Clock className="h-3 w-3" />
        {time}
      </div>
    </div>
  );
}

// MULTI-COLUMN GRID COMPONENT
type GridContentProps = {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
};

function GridContent({ isSidebarOpen, setIsSidebarOpen }: GridContentProps) {
  return (
    <div className="flex w-fit min-w-full">
      <div className="sticky left-0 z-30 flex w-[200px] shrink-0 flex-col border-r border-white/5 bg-[#0a0a0c]/60 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md xl:w-[250px]">
        {/* Corner header with toggle */}
        <div className="flex h-24 items-start justify-end border-b border-white/5 p-4 xl:h-28">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Entity Rows (Sticky Left) */}
        <EntityRow
          name="Lars Erik Johansen"
          subtitle="Sous Chef"
          hours="38.5"
          shifts="5"
          avatarColor="bg-blue-500/20 text-blue-400 border-blue-500/30"
          initials="LJ"
        />
        <EntityRow
          name="Ingrid Haugen"
          subtitle="Manager"
          hours="40"
          shifts="5"
          avatarColor="bg-purple-500/20 text-purple-400 border-purple-500/30"
          initials="IH"
        />
        <EntityRow
          name="Ahmad Reza"
          subtitle="Kokk"
          hours="30"
          shifts="4"
          avatarColor="bg-orange-500/20 text-orange-400 border-orange-500/30"
          initials="AR"
        />
        <EntityRow
          name="Fatima Abdi"
          subtitle="Housekeeping"
          hours="24"
          shifts="4"
          avatarColor="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
          initials="FA"
        />
      </div>

      {/* Days Columns */}
      {/* MONDAY - Pre-populated with different states */}
      <DayColumn date="Man 22/12" staff="4" shifts="4" cost="5,264">
        <GridCell>
          <ShiftCard role="Sous Chef" time="15:00-23:00" status="completed" indicator="blue" />
        </GridCell>
        <GridCell>
          <ShiftCard role="Manager" time="08:00-16:00" status="completed" indicator="purple" />
        </GridCell>
        <GridCell>
          <AbsenceCard type="Sykdom" reason="Sluttet 12:00" />
        </GridCell>
        <GridCell>
          <ShiftCard
            role="Housekeeping"
            time="22:00-02:00"
            status="published"
            indicator="emerald"
          />
        </GridCell>
      </DayColumn>

      {/* TUESDAY - Active day scenario */}
      <DayColumn
        date="Tir 23/12"
        staff="3"
        shifts="4"
        cost="4,100"
        isToday
        coverageAlert="⚠️ Mangler Housekeeping"
      >
        <GridCell>
          <ShiftCard role="Sous Chef" time="10:00-14:00" status="published" indicator="blue" />
          <ShiftCard role="Sous Chef" time="18:00-22:00" status="draft" indicator="blue" />
        </GridCell>
        <GridCell>
          <ShiftCard role="Manager" time="10:00-18:00" status="active" indicator="purple" />
        </GridCell>
        <GridCell>
          <ShiftCard role="Kokk" time="16:00-23:00" status="published" indicator="orange" />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
      </DayColumn>

      {/* WEDNESDAY - Future planned */}
      <DayColumn date="Ons 24/12" staff="5" shifts="5" cost="9,681" isHoliday>
        <GridCell>
          <ShiftCard role="Sous Chef" time="08:00-16:00" status="published" indicator="blue" />
        </GridCell>
        <GridCell>
          <AbsenceCard type="Ferie" reason="Julaften" />
        </GridCell>
        <GridCell>
          <ShiftCard role="Kokk" time="08:00-16:00" status="published" indicator="orange" />
        </GridCell>
        <GridCell>
          <ShiftCard role="Housekeeping" time="06:00-12:00" status="draft" indicator="emerald" />
        </GridCell>
      </DayColumn>

      {/* OTHER DAYS AS PLACEHOLDERS */}
      <DayColumn date="Tor 25/12" staff="0" shifts="0" cost="0" isHoliday>
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
      </DayColumn>
      <DayColumn date="Fre 26/12" staff="4" shifts="4" cost="6,200">
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
      </DayColumn>
      <DayColumn date="Lør 27/12" staff="6" shifts="8" cost="12,400">
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
      </DayColumn>
      <DayColumn date="Søn 28/12" staff="4" shifts="4" cost="7,100">
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
        <GridCell>
          <EmptyCell />
        </GridCell>
      </DayColumn>
    </div>
  );
}

// WEEKLY GRID COMPONENT (1-10)
function WeeklyGridContent({ isSidebarOpen, setIsSidebarOpen }: GridContentProps) {
  // Generate 10 columns for the weekly sequence
  const columns = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className="flex w-fit min-w-full">
      <div className="sticky left-0 z-30 flex w-[200px] shrink-0 flex-col border-r border-white/5 bg-[#0a0a0c]/60 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md xl:w-[250px]">
        {/* Corner header with toggle */}
        <div className="flex h-24 flex-col items-end justify-between border-b border-white/5 px-4 pt-4 pb-4 xl:h-28">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" />
            )}
          </button>
          <div className="flex w-full items-center gap-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase xl:text-xs">
            <Network className="h-4 w-4 text-orange-500" /> Rullerende Plan
          </div>
        </div>

        {/* Entity Rows (Sticky Left) */}
        <EntityRow
          name="Lars Erik Johansen"
          subtitle="Sous Chef"
          hours="38.5"
          shifts="5"
          avatarColor="bg-blue-500/20 text-blue-400 border-blue-500/30"
          initials="LJ"
        />
        <EntityRow
          name="Ingrid Haugen"
          subtitle="Manager"
          hours="40"
          shifts="5"
          avatarColor="bg-purple-500/20 text-purple-400 border-purple-500/30"
          initials="IH"
        />
        <EntityRow
          name="Ahmad Reza"
          subtitle="Kokk"
          hours="30"
          shifts="4"
          avatarColor="bg-orange-500/20 text-orange-400 border-orange-500/30"
          initials="AR"
        />
        <EntityRow
          name="Fatima Abdi"
          subtitle="Housekeeping"
          hours="24"
          shifts="4"
          avatarColor="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
          initials="FA"
        />
      </div>

      {/* Week Columns 1 to 10 */}
      {columns.map((col) => (
        <div
          key={col}
          className={`flex w-40 shrink-0 flex-col border-r border-white/5 transition-colors hover:bg-white/[0.02] xl:w-48 ${col === 3 ? "bg-orange-500/[0.02]" : ""}`}
        >
          {/* Header */}
          <div className="relative sticky top-0 z-20 flex h-24 flex-col items-center justify-center border-b border-white/5 bg-[#0a0a0c]/80 p-3 backdrop-blur-xl xl:h-28 xl:p-4">
            {col === 3 && (
              <div className="absolute top-2 right-2 rounded border border-orange-500/30 bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-black text-orange-400 uppercase">
                Aktiv
              </div>
            )}
            <h2
              className={`text-xl font-black tracking-tighter xl:text-3xl ${col === 3 ? "text-orange-400" : "text-white"}`}
            >
              {col}
            </h2>
            <span className="mt-1 text-[9px] font-bold tracking-widest text-zinc-500 uppercase xl:text-[10px]">
              Uke / Periode
            </span>
          </div>

          {/* Placeholders for shift assignment patterns */}
          <GridCell>
            {col % 2 !== 0 ? (
              <ShiftCard role="Sous Chef" time="5 vakter" status="published" indicator="blue" />
            ) : (
              <EmptyCell />
            )}
          </GridCell>
          <GridCell>
            <ShiftCard
              role="Manager"
              time="5 vakter"
              status={col === 3 ? "active" : "published"}
              indicator="purple"
            />
          </GridCell>
          <GridCell>
            {col % 4 === 0 ? (
              <AbsenceCard type="Avspasering" reason="Rotasjon" />
            ) : (
              <ShiftCard role="Kokk" time="4 vakter" status="draft" indicator="orange" />
            )}
          </GridCell>
          <GridCell>
            <ShiftCard role="Housekeeping" time="4 vakter" status="published" indicator="emerald" />
          </GridCell>
        </div>
      ))}
    </div>
  );
}

type EntityRowProps = {
  name: string;
  subtitle: string;
  hours: string;
  shifts: string;
  avatarColor: string;
  initials: string;
  contractedHours?: number;
};

function EntityRow({
  name,
  subtitle,
  hours,
  shifts,
  avatarColor,
  initials,
  contractedHours = 37.5,
}: EntityRowProps) {
  const scheduledHours = parseFloat(hours) || 0;
  const percentage = Math.min((scheduledHours / contractedHours) * 100, 100);
  const isOvertime = scheduledHours > contractedHours;

  let barColor = "bg-zinc-500"; // Default Neutral
  if (isOvertime) barColor = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
  else if (percentage >= 95) barColor = "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]";
  else if (percentage >= 70) barColor = "bg-orange-500";

  return (
    <div className="group flex h-24 cursor-pointer items-center gap-2 border-b border-white/5 bg-[#0a0a0c] p-2 transition-colors hover:bg-white/[0.02]">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[9px] font-black ${avatarColor}`}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[10px] leading-tight font-bold text-white transition-colors group-hover:text-orange-400 xl:text-[11px]">
          {name}
        </h3>
        <p className="mb-1 truncate text-[8px] leading-tight text-zinc-500 xl:text-[9px]">
          {subtitle}
        </p>

        {/* Capacity Progress Bar */}
        <div className="mt-1 space-y-1">
          <div className="flex items-center justify-between text-[7px] font-bold tracking-widest uppercase">
            <span className="text-zinc-500">{shifts} vakter</span>
            <span
              className={
                isOvertime ? "text-red-400" : percentage >= 95 ? "text-green-400" : "text-zinc-400"
              }
            >
              {hours} <span className="text-zinc-600">/{contractedHours}</span>
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full ${barColor} rounded-full transition-all`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type DayColumnProps = {
  date: string;
  staff: string;
  shifts: string;
  cost?: string;
  isHoliday?: boolean;
  isToday?: boolean;
  coverageAlert?: string;
  children: React.ReactNode;
};

function DayColumn({
  date,
  staff,
  shifts,
  isHoliday,
  isToday,
  coverageAlert,
  children,
}: DayColumnProps) {
  return (
    <div
      className={`flex max-w-[200px] min-w-[110px] flex-1 shrink-0 flex-col border-r border-white/5 sm:min-w-[130px] lg:min-w-[140px] xl:min-w-[160px] ${isToday ? "bg-orange-500/[0.02]" : ""}`}
    >
      {/* Header Sticky block */}
      <div className="sticky top-0 z-20 flex h-24 flex-col justify-between border-b border-white/5 bg-[#0a0a0c]/80 p-2 backdrop-blur-xl">
        {/* Coverage Warning Banner */}
        {coverageAlert ? (
          <div className="absolute top-0 left-0 h-1 w-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
        ) : (
          <div className="absolute top-0 left-0 h-1 w-full bg-green-500/20" />
        )}

        <div className="flex items-start justify-between">
          <div className="min-w-0 truncate pr-1">
            <h2
              className={`flex items-center gap-1.5 truncate text-[11px] font-black tracking-tight sm:text-xs ${isToday ? "text-orange-400" : isHoliday ? "text-rose-400" : "text-zinc-300"}`}
            >
              <span className="truncate">{date}</span>
              {isToday && (
                <span className="h-1 w-1 shrink-0 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]"></span>
              )}
            </h2>
          </div>
          <button className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white">
            <MoreVertical className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex gap-1 text-[8px] font-bold tracking-widest text-zinc-500 uppercase xl:gap-2 xl:text-[9px]">
            <span className="flex items-center gap-0.5" title="Ansatte">
              <Users className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {staff}
            </span>
            <span className="flex items-center gap-0.5" title="Vakter">
              <Briefcase className="h-2.5 w-2.5 xl:h-3 xl:w-3" /> {shifts}
            </span>
          </div>

          {coverageAlert ? (
            <div className="flex w-fit max-w-full items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-1 py-0.5 text-[8px] font-bold text-red-500">
              <AlertCircle className="h-2.5 w-2.5 shrink-0" />{" "}
              <span className="truncate">{coverageAlert}</span>
            </div>
          ) : (
            <div className="flex w-fit max-w-full items-center gap-1 rounded px-1 py-0.5 text-[8px] font-bold text-zinc-500">
              <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-green-500/50" />{" "}
              <span className="truncate">Optimal dekning</span>
            </div>
          )}
        </div>
      </div>

      {/* Cells for this day */}
      {children}
    </div>
  );
}

function GridCell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative flex h-24 flex-col gap-1 overflow-hidden border-b border-white/5 bg-[#050505]/40 p-1 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] transition-colors hover:bg-white/[0.04]">
      {children}
    </div>
  );
}

function EmptyCell() {
  return (
    <button className="absolute inset-x-1 inset-y-1 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-white/10 bg-white/[0.01] text-orange-500/0 opacity-0 transition-all hover:border-orange-500/30 hover:bg-white/[0.03] hover:text-orange-500/50 hover:opacity-100">
      <Plus className="h-4 w-4" />
    </button>
  );
}

function ShiftCard({
  role,
  time,
  status,
  indicator,
}: {
  role: string;
  time: string;
  status: "draft" | "published" | "active" | "completed";
  indicator: "blue" | "purple" | "orange" | "emerald";
}) {
  // Status visual mapping
  const getStatusStyles = () => {
    switch (status) {
      case "draft":
        return {
          border: "border-white/10 border-dashed",
          bg: "bg-white/5 opacity-70 hover:opacity-100",
          icon: Circle,
          iconColor: "text-zinc-600",
        };
      case "published":
        return {
          border: "border-white/10 hover:border-white/20",
          bg: "bg-[#0a0a0c]",
          icon: Circle,
          iconColor: "text-zinc-500",
        };
      case "active":
        return {
          border: "border-orange-500/40 shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)]",
          bg: "bg-orange-500/5",
          icon: PlayCircle,
          iconColor: "text-orange-400 animate-pulse",
        };
      case "completed":
        return {
          border: "border-emerald-500/30 bg-[#0a0a0c]",
          bg: "bg-emerald-500/[0.02]",
          icon: CheckCircle2,
          iconColor: "text-emerald-500",
        };
    }
  };

  const getIndicatorColor = () => {
    switch (indicator) {
      case "blue":
        return "bg-blue-500";
      case "purple":
        return "bg-purple-500";
      case "orange":
        return "bg-orange-500";
      case "emerald":
        return "bg-emerald-500";
    }
  };

  const styles = getStatusStyles();
  const StatusIcon = styles.icon;

  return (
    <div
      className={`relative flex h-[38px] min-h-0 w-full shrink-0 cursor-pointer flex-row items-center justify-between rounded-md border p-1 pl-2 transition-all hover:border-white/20 hover:bg-white/5 xl:h-[42px] ${styles.border} ${styles.bg}`}
    >
      {/* Color Indicator Ribbon */}
      <div
        className={`absolute top-1 bottom-1 left-0 w-0.5 rounded-r-[1px] ${getIndicatorColor()} opacity-80`}
      ></div>

      {/* Text Container */}
      <div className="flex min-w-0 flex-1 flex-col truncate pr-1">
        <span className="truncate text-[10px] leading-none font-black tracking-tight text-white xl:text-[11px]">
          {time}
        </span>
        <span className="mt-0.5 truncate text-[8px] leading-none font-bold tracking-widest text-zinc-500 uppercase xl:text-[9px]">
          {role}
        </span>
      </div>

      {/* State Indicators */}
      <div className="ml-auto flex shrink-0 items-center gap-1 rounded bg-black/20 px-1 py-0.5">
        {status === "active" && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)] xl:h-2 xl:w-2"></span>
        )}
        <StatusIcon className={`h-3 w-3 shrink-0 xl:h-3.5 xl:w-3.5 ${styles.iconColor}`} />
      </div>
    </div>
  );
}

function AbsenceCard({
  type,
  reason,
}: {
  type: "Sykdom" | "Ferie" | "Avspasering";
  reason?: string;
}) {
  const isSick = type === "Sykdom";

  return (
    <div
      className={`relative flex h-[38px] w-full shrink-0 items-center rounded-md border px-1.5 py-1 transition-all xl:h-[42px] ${
        isSick
          ? 'border-rose-500/30 bg-rose-500/10 bg-[url("/diagonal-stripes-rose.svg")] bg-repeat'
          : 'border-blue-500/30 bg-blue-500/10 bg-[url("/diagonal-stripes-blue.svg")] bg-repeat'
      }`}
    >
      {isSick ? (
        <AlertCircle className="mr-1.5 h-3.5 w-3.5 shrink-0 text-rose-400 xl:h-4 xl:w-4" />
      ) : (
        <Ban className="mr-1.5 h-3.5 w-3.5 shrink-0 text-blue-400 xl:h-4 xl:w-4" />
      )}

      <div className="flex min-w-0 flex-col truncate pr-1">
        <h4
          className={`truncate text-[10px] leading-none font-black tracking-tight xl:text-[11px] ${isSick ? "text-rose-400" : "text-blue-400"}`}
        >
          {type}
        </h4>
        {reason && (
          <p
            className={`mt-0.5 truncate text-[7px] leading-none font-bold tracking-widest uppercase xl:text-[8px] ${isSick ? "text-rose-500/80" : "text-blue-500/80"}`}
          >
            {reason}
          </p>
        )}
      </div>

      {/* Absolute overlay blocker for interactions */}
      <div className="absolute inset-0 z-10 hidden cursor-not-allowed sm:block"></div>
    </div>
  );
}

// MONTHLY GRID COMPONENT (1-31 Days)
function MonthlyGridContent({ isSidebarOpen, setIsSidebarOpen }: GridContentProps) {
  // Generate 31 columns for the month sequence
  const columns = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="flex w-fit min-w-full">
      <div className="sticky left-0 z-30 flex w-[200px] shrink-0 flex-col border-r border-white/5 bg-[#0a0a0c]/60 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md xl:w-[250px]">
        {/* Corner header with toggle */}
        <div className="flex h-24 flex-col items-end justify-between border-b border-white/5 px-4 pt-4 pb-4 xl:h-28">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" />
            )}
          </button>
          <div className="flex w-full items-center gap-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase xl:text-xs">
            <Clock className="h-4 w-4 text-orange-500" /> Månedsvisning
          </div>
        </div>

        {/* Entity Rows (Sticky Left) */}
        <EntityRow
          name="Lars Erik Johansen"
          subtitle="Sous Chef"
          hours="160.5"
          shifts="22"
          avatarColor="bg-blue-500/20 text-blue-400 border-blue-500/30"
          initials="LJ"
        />
        <EntityRow
          name="Ingrid Haugen"
          subtitle="Manager"
          hours="162"
          shifts="21"
          avatarColor="bg-purple-500/20 text-purple-400 border-purple-500/30"
          initials="IH"
        />
        <EntityRow
          name="Ahmad Reza"
          subtitle="Kokk"
          hours="120"
          shifts="18"
          avatarColor="bg-orange-500/20 text-orange-400 border-orange-500/30"
          initials="AR"
        />
        <EntityRow
          name="Fatima Abdi"
          subtitle="Housekeeping"
          hours="90"
          shifts="15"
          avatarColor="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
          initials="FA"
        />
      </div>

      {/* Month Columns 1 to 31 */}
      {columns.map((col) => {
        const isWeekend = col % 7 === 6 || col % 7 === 0;
        return (
          <div
            key={col}
            className={`flex w-[90px] shrink-0 flex-col border-r border-white/5 transition-colors hover:bg-white/[0.02] xl:w-[110px] ${col === 15 ? "bg-orange-500/[0.02]" : ""}`}
          >
            {/* Header */}
            <div
              className={`relative sticky top-0 z-20 flex h-24 flex-col items-center justify-center border-b border-white/5 bg-[#0a0a0c]/80 p-2 backdrop-blur-xl xl:h-28 ${isWeekend ? "bg-indigo-500/[0.02]" : ""}`}
            >
              {col === 15 && (
                <div className="absolute top-1 right-1 rounded border border-orange-500/30 bg-orange-500/20 px-1 py-0.5 text-[8px] font-black text-orange-400 uppercase">
                  I dag
                </div>
              )}
              <h2
                className={`text-lg font-black tracking-tighter xl:text-xl ${col === 15 ? "text-orange-400" : isWeekend ? "text-indigo-400" : "text-zinc-300"}`}
              >
                {col}
              </h2>
              <span
                className={`mt-0.5 text-[8px] font-bold tracking-widest uppercase ${isWeekend ? "text-indigo-500" : "text-zinc-600"}`}
              >
                Des
              </span>
            </div>

            {/* Placeholders for shift assignment patterns */}
            <GridCell>
              {col % 2 !== 0 ? (
                <ShiftCard role="S-Chef" time="08-16" status="published" indicator="blue" />
              ) : (
                <EmptyCell />
              )}
            </GridCell>
            <GridCell>
              <ShiftCard
                role="Mgr"
                time="10-18"
                status={col === 15 ? "active" : "published"}
                indicator="purple"
              />
            </GridCell>
            <GridCell>
              {isWeekend ? (
                <AbsenceCard type="Avspasering" reason="Helg" />
              ) : (
                <ShiftCard role="Kokk" time="16-23" status="draft" indicator="orange" />
              )}
            </GridCell>
            <GridCell>
              <ShiftCard role="Hskp" time="06-12" status="published" indicator="emerald" />
            </GridCell>
          </div>
        );
      })}
    </div>
  );
}
