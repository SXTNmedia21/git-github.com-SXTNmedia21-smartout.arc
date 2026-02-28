"use client";

import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  PlayCircle,
  Flame,
  Coffee,
  CalendarDays,
  ListTodo,
  FileCheck2,
  ChevronRight,
  Settings,
  UserCircle2,
  TerminalSquare,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function DailySessionSimple() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[#050505] pt-16 font-sans text-zinc-100 selection:bg-orange-500/30 md:flex-row">
      <Navigation />

      {/* Dynamic Ambient Background */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40">
        <div className="animate-pulse-slow absolute top-0 left-[-10%] h-[500px] w-[500px] rounded-full bg-orange-600/20 mix-blend-screen blur-[120px]" />
        <div className="absolute right-[-10%] bottom-[-10%] h-[600px] w-[600px] rounded-full bg-rose-600/10 mix-blend-screen blur-[150px]" />
      </div>

      {/* SIDEBAR */}
      <aside className="relative z-20 hidden w-72 flex-col border-r border-white/5 bg-[#0a0a0c]/80 shadow-2xl backdrop-blur-3xl md:flex">
        <div className="flex items-center gap-3 p-6">
          <button
            onClick={() => router.back()}
            className="group flex w-full items-center gap-3 text-left"
          >
            <ArrowLeft className="absolute -left-10 h-5 w-5 text-zinc-500 opacity-0 transition-colors group-hover:left-2 group-hover:text-white group-hover:opacity-100" />
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-orange-500 to-rose-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">Smartout</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          <div className="mb-4 px-3 text-xs font-bold tracking-widest text-zinc-500 uppercase">
            Dagens Flyt
          </div>

          <NavItem icon={Flame} label="Kjøkken-økt" active badge="Live" />
          <NavItem icon={Coffee} label="Sal & Service" />
          <NavItem icon={TerminalSquare} label="Bar" badge="16:00" />

          <div className="mt-8 mb-4 px-3 text-xs font-bold tracking-widest text-zinc-500 uppercase">
            Administrasjon
          </div>
          <NavItem icon={ListTodo} label="Alle Oppgaver" />
          <NavItem icon={CalendarDays} label="Vaktplan" />
          <NavItem icon={FileCheck2} label="Økt-Godkjenninger" />
        </nav>

        {/* Waitlist Call to Action */}
        <div className="relative p-6">
          <div className="pointer-events-none absolute inset-0 rounded-t-3xl bg-gradient-to-t from-orange-500/10 to-transparent" />
          <div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
            <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl" />
            <h4 className="mb-2 flex items-center gap-2 font-bold text-white">
              <Sparkles className="h-4 w-4 text-orange-400" />
              Opplev magien
            </h4>
            <p className="mb-4 text-xs leading-relaxed text-zinc-400">
              Bli med på reisen og revolusjoner restaurantdriften. Få tidlig tilgang til
              plattformen.
            </p>
            <Link
              href="/waitlist"
              className="block w-full rounded-xl bg-gradient-to-r from-orange-600 to-rose-600 py-2.5 text-center text-sm font-bold text-white shadow-[0_0_20px_-5px_rgba(249,115,22,0.5)] transition-all hover:from-orange-500 hover:to-rose-500"
            >
              Sett meg på venteliste
            </Link>
          </div>
        </div>

        <div className="border-t border-white/5 bg-[#050505]/50 p-5">
          <div className="group flex cursor-pointer items-center gap-3 px-2">
            <UserCircle2 className="h-8 w-8 text-zinc-500 transition-colors group-hover:text-zinc-300" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">Restaurant Admin</p>
              <p className="truncate text-xs text-zinc-500 transition-colors group-hover:text-zinc-400">
                admin@smartout.no
              </p>
            </div>
            <Settings className="h-4 w-4 text-zinc-500 transition-colors group-hover:text-zinc-300" />
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="relative z-10 flex h-screen flex-1 flex-col overflow-hidden">
        {/* Mobile Header Overrides */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-[#0a0a0c]/90 p-4 backdrop-blur-xl md:hidden">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-bold">Tilbake</span>
          </button>
          <Link
            href="/waitlist"
            className="rounded-full bg-orange-600 px-4 py-1.5 text-xs font-bold text-white"
          >
            Venteliste
          </Link>
        </div>

        {/* HEADER */}
        <header className="flex h-auto flex-col items-start justify-between gap-6 border-b border-white/5 bg-[#0a0a0c]/40 px-4 py-6 shadow-sm backdrop-blur-xl md:h-24 md:flex-row md:items-center md:gap-0 md:px-10 md:py-0">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
              <span>24 Feb 2026</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text font-bold text-transparent">
                Aktiv Økt
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">Kjøkkenavdeling</h1>
          </div>

          <div className="flex w-full flex-col items-start gap-6 md:w-auto md:flex-row md:items-center">
            <div className="hide-scrollbar flex w-full gap-6 overflow-x-auto pb-2 md:w-auto md:pb-0">
              <Metric label="Oppgaver Fullført" value="12 / 18" color="text-white" />
              <Metric label="Forfalt" value="1" color="text-rose-500" />
              <Metric label="Ansatte Innsjekket" value="3" color="text-emerald-400" />
            </div>
          </div>
        </header>

        {/* TIMELINE / DAY VIEW */}
        <div className="custom-scrollbar relative flex-1 overflow-y-auto p-4 md:p-10">
          {/* Inner Grid Pattern */}
          <div className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-[length:32px_32px] bg-repeat opacity-[0.02]"></div>

          <div className="relative z-10 mx-auto max-w-4xl">
            <div className="mb-12">
              <h2 className="mb-4 text-2xl font-bold text-white">Driftsflyt & Rutiner</h2>
              <p className="text-lg leading-relaxed font-medium text-zinc-400">
                En restaurant tenker ikke i &quot;oppgaver&quot;, den tenker i{" "}
                <strong>dager</strong>. Her er operasjonsflyten for Kjøkkenet i dag, drevet frem av
                hendelsesbaserte &quot;hooks&quot; og sanntidsaktivitet.
              </p>
            </div>

            <div className="relative ml-4 space-y-16 border-l-2 border-white/10 pb-32">
              {/* PRE-OPEN HOOK */}
              <TimelineSection time="08:00" title="Før-Åpning" status="Fullført">
                <TaskCard
                  title="Lås opp dører og skru på ovner"
                  assigned="Anna (Kokk)"
                  status="completed"
                  time="08:05"
                  category="Forberedelse"
                />
                <TaskCard
                  title="Ta imot morgenleveranse fra Bama"
                  assigned="Anna (Kokk)"
                  status="completed"
                  time="08:15"
                  category="Varemottak"
                />
              </TimelineSection>

              {/* OPEN HOOK */}
              <TimelineSection time="10:00" title="Åpning" status="Fullført">
                <TaskCard
                  title="Temperaturkontroll - Kjølerom 1"
                  assigned="Erik (Sous Chef)"
                  status="completed"
                  time="10:05"
                  category="HACCP"
                  data="Registrert: 3.2°C"
                />
                <TaskCard
                  title="Mise en place for lunsj-rush"
                  assigned="Skift-ansvarlig"
                  status="completed"
                  time="10:30"
                  category="Forberedelse"
                />
              </TimelineSection>

              {/* MID-DAY ROUTINE (CURRENT TIME ZONE) */}
              <TimelineSection time="14:00" title="Midt-På-Dagen Rutine" status="Aktiv" isCurrent>
                <TaskCard
                  title="Vask og desinfiser prep-stasjon"
                  assigned="Alle på skift"
                  status="in_progress"
                  time="Startet 14:15"
                  category="Rengjøring"
                  claimedBy="Lise"
                />
                <TaskCard
                  title="Ettermiddagskontroll - Frys 2"
                  assigned="Alle på skift"
                  status="overdue"
                  time="Frist 14:30"
                  category="HACCP"
                />
                {/* Ad-hoc task inserted into timeline */}
                <TaskCard
                  title="Søl i Sone 3 - Dyprens nødvendig"
                  assigned="Ad-hoc (Leder)"
                  status="available"
                  time="Opprettet 14:45"
                  category="Ad-hoc"
                />
              </TimelineSection>

              {/* PRE-CLOSE HOOK */}
              <TimelineSection time="21:00" title="Før-Stenging" status="Kommende">
                <TaskCard
                  title="Last Orders Call (Rop opp)"
                  assigned="Kvelds-skift"
                  status="pending"
                  time="Planlagt 21:00"
                  category="Service"
                />
                <TaskCard
                  title="Begynn nedvask av frityr-området"
                  assigned="Kvelds-skift"
                  status="pending"
                  time="Planlagt 21:15"
                  category="Forberedelse"
                />
              </TimelineSection>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <a
      href="#"
      className={`group flex items-center justify-between rounded-xl px-3 py-3 transition-all ${active ? "border border-orange-500/20 bg-orange-500/10 font-bold text-orange-400" : "border border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"}`}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={`h-4 w-4 ${active ? "text-orange-400" : "text-zinc-500 transition-colors group-hover:text-zinc-300"}`}
        />
        <span className={`text-[13px] tracking-wide ${active ? "font-bold" : "font-semibold"}`}>
          {label}
        </span>
      </div>
      {badge && (
        <span
          className={`rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase ${active ? "border-orange-500/30 bg-orange-500/20 text-orange-400" : "border-white/10 bg-white/5 text-zinc-500"}`}
        >
          {badge}
        </span>
      )}
    </a>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-white/5 bg-[#0a0a0c] px-4 py-2">
      <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">{label}</span>
      <span className={`text-xl font-black ${color}`}>{value}</span>
    </div>
  );
}

function TimelineSection({
  time,
  title,
  status,
  isCurrent,
  children,
}: {
  time: string;
  title: string;
  status: string;
  isCurrent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pl-8 sm:pl-10">
      {/* Node on the timeline */}
      <div
        className={`absolute top-1 -left-[10px] flex h-5 w-5 items-center justify-center rounded-full border-4 border-[#050505] shadow-[0_0_20px_-5px_rgba(0,0,0,1)] ${
          status === "Fullført"
            ? "bg-zinc-600"
            : status === "Aktiv"
              ? "bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.6)]"
              : "border-zinc-700 bg-zinc-800"
        }`}
      />

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <span
          className={`text-sm font-black tracking-wider ${isCurrent ? "text-orange-500" : "text-zinc-500"}`}
        >
          {time}
        </span>
        <h2
          className={`text-xl font-black tracking-tight ${isCurrent ? "text-white" : "text-zinc-400"}`}
        >
          {title}
        </h2>
        {isCurrent && (
          <span className="mt-2 w-fit rounded-full bg-gradient-to-r from-orange-600 to-rose-600 px-3 py-1 text-[10px] font-black tracking-widest text-white uppercase shadow-lg sm:mt-0">
            Live Nå
          </span>
        )}
      </div>

      <div className="space-y-4">{children}</div>
    </div>
  );
}

type TaskCardProps = {
  title: string;
  assigned: string;
  status: string;
  time: string;
  category: string;
  claimedBy?: string;
  data?: string;
};

function TaskCard({ title, assigned, status, time, category, claimedBy, data }: TaskCardProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "completed":
        return {
          icon: CheckCircle2,
          color: "text-emerald-400",
          bg: "bg-emerald-500/5 border-emerald-500/20",
          text: "text-zinc-500 line-through",
        };
      case "in_progress":
        return {
          icon: PlayCircle,
          color: "text-blue-400",
          bg: "bg-blue-500/10 border-blue-500/30 shadow-[0_0_30px_-10px_rgba(59,130,246,0.2)]",
          text: "text-white",
        };
      case "overdue":
        return {
          icon: AlertCircle,
          color: "text-rose-400",
          bg: "bg-rose-500/10 border-rose-500/40 shadow-[0_0_30px_-10px_rgba(243,62,92,0.2)]",
          text: "text-rose-100",
        };
      case "available":
        return {
          icon: Circle,
          color: "text-orange-400",
          bg: "bg-white/5 border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5",
          text: "text-zinc-100",
        };
      case "pending":
        return {
          icon: Circle,
          color: "text-zinc-600",
          bg: "bg-[#0a0a0c]/50 border-white/5 opacity-60",
          text: "text-zinc-500",
        };
      default:
        return {
          icon: Circle,
          color: "text-zinc-500",
          bg: "bg-[#0a0a0c] border-white/10",
          text: "text-zinc-300",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={`flex flex-col justify-between gap-6 rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 md:flex-row md:items-center ${config.bg}`}
    >
      <div className="flex items-start gap-4">
        <Icon
          className={`mt-0.5 h-6 w-6 flex-shrink-0 ${config.color} ${status === "overdue" ? "animate-pulse" : ""}`}
        />
        <div>
          <h3 className={`text-base font-bold tracking-tight ${config.text}`}>{title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 font-bold ${
                status === "completed"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : status === "overdue"
                    ? "bg-rose-500/10 text-rose-400"
                    : "bg-white/10 text-zinc-300"
              }`}
            >
              <Clock className="h-3 w-3" /> {time}
            </span>
            <span className="font-semibold text-zinc-400">
              Ansvarlig: <span className="text-zinc-300">{assigned}</span>
            </span>

            {category && (
              <>
                <span className="hidden text-zinc-600 sm:inline">•</span>
                <span className="rounded-md border border-white/5 bg-[#0a0a0c] px-2 py-1 text-[9px] font-black tracking-widest text-zinc-500 uppercase">
                  {category}
                </span>
              </>
            )}
          </div>

          {/* Conditional Data / Claims display */}
          {claimedBy && status === "in_progress" && (
            <div className="mt-4 inline-block rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-300">
              Utføres av: {claimedBy}
            </div>
          )}
          {data && status === "completed" && (
            <div className="mt-4 inline-block rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
              {data}
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full shrink-0 items-end gap-3 pl-10 sm:flex-col md:w-auto md:pl-0">
        {status === "available" && (
          <button className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold text-zinc-300 transition-all hover:border-orange-500/40 hover:bg-orange-500/20 hover:text-orange-400 md:w-auto">
            Ta oppdrag
          </button>
        )}
        {status === "in_progress" && (
          <button className="w-full rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-[0_0_20px_-5px_rgba(37,99,235,0.5)] transition-all hover:bg-blue-500 md:w-auto">
            Marker Fullført
          </button>
        )}
        {status === "overdue" && (
          <button className="w-full rounded-xl border border-rose-500/30 bg-rose-500/20 px-4 py-2 text-[10px] font-black tracking-widest text-rose-400 uppercase shadow-[0_0_15px_-5px_rgba(244,63,94,0.3)] transition-all hover:bg-rose-500/30 md:w-auto">
            Håndter Avvik
          </button>
        )}
      </div>

      <NextPageBanner
        href="/concepts/lokations"
        title="Tilbake til Lokasjoner"
        subtitle="Fullfør Gjennomgangen"
        color="from-orange-500/10"
      />
    </div>
  );
}
