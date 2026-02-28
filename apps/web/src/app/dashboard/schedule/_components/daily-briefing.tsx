"use client";

import { useContext, useState } from "react";
import {
  X,
  Info,
  MessageSquare,
  CalendarCheck,
  ListTodo,
  Briefcase,
  ChevronDown,
  Clock,
  Users,
  MapPin,
  Plus,
  Eye,
  Megaphone,
  MessageCircle,
  Mail,
  CheckSquare,
  AlertCircle,
} from "lucide-react";
import { DashboardContext } from "../../layout";

// ---------------------------------------------------------------------------
// DailyBriefingPanel — rich day detail panel (no DnD interaction)
// ---------------------------------------------------------------------------
export function DailyBriefingPanel({
  date,
  onClose,
}: {
  date: string | null;
  onClose: () => void;
}) {
  const { isDark } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<"oversikt" | "meldinger" | "bookings" | "oppgaver">(
    "oversikt",
  );

  if (!date) return null;

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Header */}
      <div
        className={`shrink-0 border-b ${isDark ? "border-white/10" : "border-zinc-300"} bg-gradient-to-r from-[#0a0a0c]/40 to-orange-500/[0.02]`}
      >
        <div className="p-5 pb-3">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex flex-col">
              <span className="mb-0.5 text-[10px] font-bold tracking-widest text-orange-400 uppercase">
                Kontrollsenter for dag
              </span>
              <h2
                className={`text-xl font-black ${isDark ? "text-white" : "text-zinc-900"} tracking-tight`}
              >
                {date}
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`p-2 text-zinc-400 hover:text-white ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-xl transition-all`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:gap-4">
            <TabButton
              active={activeTab === "oversikt"}
              onClick={() => setActiveTab("oversikt")}
              icon={<Info className="h-3.5 w-3.5" />}
              label="Oversikt"
            />
            <TabButton
              active={activeTab === "meldinger"}
              onClick={() => setActiveTab("meldinger")}
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label="Dagsinfo"
            />
            <TabButton
              active={activeTab === "bookings"}
              onClick={() => setActiveTab("bookings")}
              icon={<CalendarCheck className="h-3.5 w-3.5" />}
              label="Selskap / Booking"
            />
            <TabButton
              active={activeTab === "oppgaver"}
              onClick={() => setActiveTab("oppgaver")}
              icon={<ListTodo className="h-3.5 w-3.5" />}
              label="Oppgaver"
            />
          </div>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
        {activeTab === "oversikt" && <OversiktTab isDark={isDark} />}
        {activeTab === "meldinger" && <MeldingerTab isDark={isDark} />}
        {activeTab === "bookings" && <BookingsTab isDark={isDark} />}
        {activeTab === "oppgaver" && <OppgaverTab isDark={isDark} />}
      </div>

      {/* Footer Broadcast Action */}
      <div className={`border-t border-white/10 p-5 ${isDark ? "bg-[#0a0a0c]" : "bg-white"}`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
            <Megaphone className="h-3.5 w-3.5" /> Kringkast til alle på vakt
          </h3>
          <span className="text-[10px] font-medium text-zinc-600">8 ansatte</span>
        </div>
        <div className="flex gap-2">
          <button
            className={`flex flex-1 items-center justify-center gap-2 bg-white/5 ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white transition-all hover:border-white/20`}
          >
            <MessageCircle className="h-4 w-4 text-blue-400" /> Push Vakt
          </button>
          <button
            className={`flex flex-1 items-center justify-center gap-2 bg-white/5 ${isDark ? "hover:bg-white/10" : "hover:bg-zinc-200"} rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white transition-all hover:border-white/20`}
          >
            <Mail className="h-4 w-4 text-orange-400" /> SMS
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function OversiktTab({ isDark }: { isDark: boolean }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-purple-500/30 bg-purple-500/20 text-purple-400">
            <Briefcase className="h-3.5 w-3.5" />
          </div>
          <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            Vaktansvarlig
          </h3>
        </div>
        <div
          className={`p-4 ${isDark ? "bg-white/5" : "bg-zinc-100"} group flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 transition-colors hover:border-white/20`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/20 text-xs font-black text-purple-400">
              IH
            </div>
            <div className="flex flex-col">
              <span
                className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"} transition-colors group-hover:text-purple-400`}
              >
                Ingrid Haugen
              </span>
              <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                Manager &bull; 08:00 - 16:00
              </span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-zinc-600" />
        </div>
      </section>

      <section>
        <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-3`}>
          Dagens nøkkeltall
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div
            className={`rounded-xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-zinc-50"}`}
          >
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Est. Kostnad
            </span>
            <div className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"} mt-1`}>
              14,350 kr
            </div>
          </div>
          <div
            className={`rounded-xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-zinc-50"}`}
          >
            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              Totale Timer
            </span>
            <div className={`text-lg font-black ${isDark ? "text-white" : "text-zinc-900"} mt-1`}>
              56t 30m
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MeldingerTab({ isDark }: { isDark: boolean }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
      <div
        className={`rounded-2xl border p-4 ${isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-white shadow-sm"}`}
      >
        <h4 className={`text-xs font-bold ${isDark ? "text-white" : "text-zinc-900"} mb-2`}>
          Nytt oppslag
        </h4>
        <textarea
          placeholder="Skriv beskjed til ansatte her..."
          className={`h-24 w-full border bg-transparent ${isDark ? "border-white/10" : "border-zinc-300"} mb-3 block resize-none rounded-xl p-3 text-xs focus:border-blue-500/50 focus:outline-none`}
        />
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-white/20">
              <Eye className="h-3.5 w-3.5 text-zinc-400" />
              <select className="cursor-pointer bg-transparent text-[11px] font-bold text-zinc-300 outline-none">
                <option>Alle På Vakt</option>
                <option>Kun Ledere</option>
                <option>Servering (Team)</option>
              </select>
            </div>
            <div className="hidden h-4 w-px bg-white/10 md:block" />
            <div className="flex items-center gap-1.5 rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-white/20">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <select className="cursor-pointer bg-transparent text-[11px] font-bold text-zinc-300 outline-none">
                <option>Hele dagen</option>
                <option>Frem til 16:00</option>
                <option>Permanent oppslag</option>
              </select>
            </div>
          </div>
          <button className="rounded-lg border border-blue-500/30 bg-blue-500/20 px-3 py-1.5 text-[10px] font-bold text-blue-400 transition-all hover:bg-blue-500/30">
            Publiser
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h4
          className={`text-xs font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"} tracking-widest uppercase`}
        >
          Aktive Oppslag (2)
        </h4>
        <MessageCard
          title="Inngangsdøra trøbler"
          audience="Alle"
          author="Ingridhaugen"
          time="Hele dagen"
          content="Låsen på bakdøra henger litt. Dra den til deg før du vrir om for å unngå alarmen."
          alert
        />
        <MessageCard
          title="VIP Selskap kl 18:00"
          audience="Kun Ledere"
          author="System"
          time="18:00 - 22:00"
          content="Sørg for at velkomstdrinker er på plass. Jens fra styret er med og har med seg investornettverk."
        />
      </div>
    </div>
  );
}

function BookingsTab({ isDark }: { isDark: boolean }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5">
      <div className="flex items-center justify-between">
        <h4
          className={`text-xs font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"} tracking-widest uppercase`}
        >
          Reservasjoner og Selskap (2)
        </h4>
        <button className="flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300">
          <Plus className="h-3.5 w-3.5" /> Legg til manuelt
        </button>
      </div>

      <div className="space-y-3">
        <div
          className={`p-4 ${isDark ? "border border-white/10 bg-white/5 hover:border-white/20" : "border bg-white text-zinc-900 shadow-sm hover:border-zinc-300"} rounded-xl transition-colors`}
        >
          <div className="mb-2 flex justify-between">
            <span className="flex items-center gap-2 text-sm font-bold">
              <Users className="h-4 w-4 text-orange-400" /> Julebord Entreprenør AS
            </span>
            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Bekreftet &bull; VIP
            </span>
          </div>
          <p className="mb-3 text-xs font-medium text-zinc-500">
            35 Personer &bull; Julemeny 3-retter &bull; Utvidet Drikkepakke (Se notat i booking)
          </p>
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <div className="flex gap-4 text-[10px] font-bold text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-500" /> 18:00 - 23:00
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-500" /> Chambre Séparée
              </span>
            </div>
            <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300">
              Se detaljer
            </button>
          </div>
        </div>

        <div
          className={`p-4 ${isDark ? "border border-white/10 bg-white/5 hover:border-white/20" : "border bg-white text-zinc-900 shadow-sm hover:border-zinc-300"} rounded-xl transition-colors`}
        >
          <div className="mb-2 flex justify-between">
            <span className="flex items-center gap-2 text-sm font-bold">
              <Users className="h-4 w-4 text-orange-400" /> Bursdagsfeiring: Thomas 30 år
            </span>
            <span className="rounded-lg border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
              Avventer depositum
            </span>
          </div>
          <p className="mb-3 text-xs font-medium text-zinc-500">
            12 Personer &bull; À la carte &bull; Mulig kake (må bekrefte allergener)
          </p>
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <div className="flex gap-4 text-[10px] font-bold text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-500" /> 19:30 - 22:30
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-500" /> Hovedsal Bord 4-5
              </span>
            </div>
            <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300">
              Se detaljer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OppgaverTab({ isDark }: { isDark: boolean }) {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2">
      <div className="mb-4 flex items-center justify-between">
        <h3
          className={`text-xs font-bold ${isDark ? "text-zinc-500" : "text-zinc-400"} tracking-widest uppercase`}
        >
          Gjøremål &amp; Rutiner
        </h3>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
          2 / 5 Utført
        </span>
      </div>
      <div className="space-y-2">
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Planlegg nytt gjøremål for dagen..."
            className={`flex-1 ${isDark ? "border-white/10 bg-white/5 text-white placeholder:text-zinc-600" : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"} rounded-xl border p-3 text-xs shadow-inner focus:border-orange-500/50 focus:outline-none`}
          />
          <button className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 text-xs font-bold text-emerald-500 transition-all hover:bg-emerald-500/30 md:px-4">
            <Plus className="h-3.5 w-3.5" /> Legg til
          </button>
        </div>

        <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto pb-1">
          <span
            className={`shrink-0 cursor-pointer rounded-lg px-2 py-1.5 text-[9px] font-bold ${isDark ? "bg-zinc-800 text-white" : "bg-zinc-200 text-zinc-900"} transition-colors hover:bg-orange-500/20 hover:text-orange-400`}
          >
            Alle oppgaver
          </span>
          <span
            className={`shrink-0 cursor-pointer rounded-lg border bg-transparent px-2 py-1.5 text-[9px] font-bold text-zinc-500 ${isDark ? "border-white/10" : "border-zinc-300"} transition-colors hover:border-orange-500/50`}
          >
            Faste Rutiner (3)
          </span>
          <span
            className={`shrink-0 cursor-pointer rounded-lg border bg-transparent px-2 py-1.5 text-[9px] font-bold text-zinc-500 ${isDark ? "border-white/10" : "border-zinc-300"} transition-colors hover:border-orange-500/50`}
          >
            Delegert (1)
          </span>
        </div>

        <TaskRow isDark={isDark} done label="Varetelling - Drikkevarer" />
        <TaskRow isDark={isDark} done label="Sjekk temperatur i fryser (Rutine: Stengevakt)" />
        <TaskRow isDark={isDark} label="Motta bestilling Bama" />
        <TaskRow isDark={isDark} highlight label="Oppdater meny i kasse" />
        <TaskRow isDark={isDark} label="Kaste papp (Rutine: Kjøkken)" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------
function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-2 text-[11px] font-bold whitespace-nowrap transition-all ${active ? (isDark ? "border-orange-500 text-orange-400" : "border-orange-500 text-orange-500") : "border-transparent text-zinc-500 hover:text-zinc-400"} px-2`}
    >
      {icon} {label}
    </button>
  );
}

function MessageCard({
  title,
  audience,
  author,
  time,
  content,
  alert,
}: {
  title: string;
  audience: string;
  author: string;
  time: string;
  content: string;
  alert?: boolean;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div
      className={`rounded-xl border p-4 ${alert ? (isDark ? "border-rose-500/30 bg-rose-500/10" : "border-rose-200 bg-rose-50") : isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-white"} transition-all`}
    >
      <div className="mb-2 flex items-start justify-between">
        <h5
          className={`flex items-center gap-1.5 text-xs font-black ${alert ? "text-rose-400" : isDark ? "text-white" : "text-zinc-900"}`}
        >
          {alert ? <AlertCircle className="h-3.5 w-3.5" /> : null} {title}
        </h5>
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase ${isDark ? "bg-black/40 text-zinc-400" : "bg-zinc-100 text-zinc-500"}`}
        >
          {time}
        </span>
      </div>
      <p className={`text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"} mb-3`}>
        {content}
      </p>
      <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500">
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" /> Synlig for: {audience}
        </span>
        <span className="italic">Av: {author}</span>
      </div>
    </div>
  );
}

function TaskRow({
  isDark,
  done,
  highlight,
  label,
}: {
  isDark: boolean;
  done?: boolean;
  highlight?: boolean;
  label: string;
}) {
  const base = done
    ? `${isDark ? "border-white/5 bg-white/5 opacity-60" : "border-zinc-200 bg-zinc-100 opacity-60"}`
    : highlight
      ? `${isDark ? "border-orange-500/20 bg-orange-500/5" : "border-orange-200 bg-orange-50"}`
      : `${isDark ? "border-white/5 bg-[#0a0a0c]" : "border-zinc-200 bg-white"}`;

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${base}`}>
      <button
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          done
            ? "border-emerald-500 bg-emerald-500 text-[#050505]"
            : "border-zinc-600 text-transparent hover:border-orange-500"
        }`}
      >
        <CheckSquare className="h-3.5 w-3.5" />
      </button>
      <span
        className={`truncate text-xs font-medium ${done ? "text-zinc-500 line-through" : "text-zinc-200"}`}
      >
        {label}
      </span>
      {highlight ? (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
      ) : null}
    </div>
  );
}
