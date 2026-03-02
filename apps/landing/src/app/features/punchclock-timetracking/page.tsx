"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  History,
  FileText,
  Fingerprint,
  Fingerprint as FingerprintIcon,
  ShieldCheck,
  CheckCircle2,
  X,
  MapPin,
  Coffee,
  Moon,
  Sun,
  Calendar,
  User,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import Footer from "../../../components/footer";
import { usePageTracking } from "../../../hooks/useTracking";
import { useScrollTracking } from "../../../hooks/useScrollTracking";
import { useClickTracking } from "../../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../../hooks/useSessionLifecycle";
import NextPageBanner from "../../../components/next-page-banner";

// ─── Shift data ─────────────────────────────────────────────────────────────

type ShiftLog = {
  id: string;
  date: string;
  dateDetail: string;
  inTime: string;
  outTime: string;
  hours: string;
  status: "approved" | "pending";
  location: string;
  department: string;
  breakMinutes: number;
  grossHours: string;
  netHours: string;
  supplements: { label: string; amount: string }[];
  manager: string;
};

const SHIFT_LOGS: ShiftLog[] = [
  {
    id: "shift-1",
    date: "I går",
    dateDetail: "Torsdag 27. feb 2026",
    inTime: "15:58",
    outTime: "23:15",
    hours: "7t 17m",
    status: "approved",
    location: "Sentralstasjonen, Oslo",
    department: "Servering",
    breakMinutes: 30,
    grossHours: "7t 17m",
    netHours: "6t 47m",
    supplements: [
      { label: "Kveldstillegg (17:00–21:00)", amount: "+56 kr/t" },
      { label: "Nattillegg (21:00–23:15)", amount: "+70 kr/t" },
    ],
    manager: "Kari Nordmann",
  },
  {
    id: "shift-2",
    date: "Mandag",
    dateDetail: "Mandag 24. feb 2026",
    inTime: "14:02",
    outTime: "22:00",
    hours: "7t 58m",
    status: "approved",
    location: "Sentralstasjonen, Oslo",
    department: "Servering",
    breakMinutes: 30,
    grossHours: "7t 58m",
    netHours: "7t 28m",
    supplements: [
      { label: "Kveldstillegg (17:00–21:00)", amount: "+56 kr/t" },
      { label: "Nattillegg (21:00–22:00)", amount: "+70 kr/t" },
    ],
    manager: "Kari Nordmann",
  },
  {
    id: "shift-3",
    date: "Fredag",
    dateDetail: "Fredag 21. feb 2026",
    inTime: "16:05",
    outTime: "02:30",
    hours: "10t 25m",
    status: "pending",
    location: "Sentralstasjonen, Oslo",
    department: "Bar",
    breakMinutes: 45,
    grossHours: "10t 25m",
    netHours: "9t 40m",
    supplements: [
      { label: "Kveldstillegg (17:00–21:00)", amount: "+56 kr/t" },
      { label: "Nattillegg (21:00–02:30)", amount: "+70 kr/t" },
      { label: "Helgetillegg", amount: "+100 kr/t" },
    ],
    manager: "Kari Nordmann",
  },
];

// ─── ShiftDetailView ────────────────────────────────────────────────────────

function ShiftDetailView({ shift, onClose }: { shift: ShiftLog; onClose: () => void }) {
  const isApproved = shift.status === "approved";

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="absolute inset-0 z-20 flex flex-col overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0a0a0c] backdrop-blur-3xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
        <div>
          <h3 className="text-lg font-bold text-white">{shift.date}</h3>
          <p className="text-xs text-zinc-500">{shift.dateDetail}</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-colors hover:bg-white/10"
        >
          <X className="h-4 w-4 text-zinc-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-5 p-6">
        {/* Time block */}
        <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Sun className="h-3.5 w-3.5" /> Inn
              </div>
              <p className="text-xl font-black text-white tabular-nums">{shift.inTime}</p>
            </div>
          </div>
          <div className="mx-4 h-[1px] flex-1 bg-gradient-to-r from-white/10 via-white/5 to-white/10" />
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 text-sm text-zinc-400">
              <Moon className="h-3.5 w-3.5" /> Ut
            </div>
            <p className="text-xl font-black text-white tabular-nums">{shift.outTime}</p>
          </div>
        </div>

        {/* Duration + break */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <p className="mb-1 text-xs font-medium text-zinc-500">Brutto tid</p>
            <p className="text-lg font-bold text-white tabular-nums">{shift.grossHours}</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <p className="mb-1 text-xs font-medium text-zinc-500">Netto tid</p>
            <p className="text-lg font-bold text-white tabular-nums">{shift.netHours}</p>
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Coffee className="h-4 w-4 text-zinc-500" />
            <span className="text-zinc-400">Pause</span>
            <span className="ml-auto font-semibold text-zinc-300">{shift.breakMinutes} min</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-zinc-500" />
            <span className="text-zinc-400">Lokasjon</span>
            <span className="ml-auto font-semibold text-zinc-300">{shift.location}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-zinc-500" />
            <span className="text-zinc-400">Avdeling</span>
            <span className="ml-auto font-semibold text-zinc-300">{shift.department}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-zinc-500" />
            <span className="text-zinc-400">Godkjenner</span>
            <span className="ml-auto font-semibold text-zinc-300">{shift.manager}</span>
          </div>
        </div>

        {/* Supplements */}
        {shift.supplements.length > 0 && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <p className="mb-3 text-xs font-bold tracking-wider text-zinc-500 uppercase">Tillegg</p>
            <div className="space-y-2.5">
              {shift.supplements.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{s.label}</span>
                  <span className="font-semibold text-emerald-400">{s.amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 ${
            isApproved
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-amber-500/20 bg-amber-500/5"
          }`}
        >
          {isApproved ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <Clock className="h-5 w-5 text-amber-400" />
          )}
          <div>
            <p
              className={`text-sm font-bold ${isApproved ? "text-emerald-400" : "text-amber-400"}`}
            >
              {isApproved ? "Godkjent" : "Venter godkjenning"}
            </p>
            <p className="text-xs text-zinc-500">
              {isApproved ? `Godkjent av ${shift.manager}` : "Sendt til leder for godkjenning"}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function TimeforingPage() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const router = useRouter();
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftLog | null>(null);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("no-NO", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isClockedIn) return;

    let seconds = 0;
    const interval = setInterval(() => {
      seconds++;
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      setElapsedTime([h, m, s].map((v) => v.toString().padStart(2, "0")).join(":"));
    }, 1000);

    return () => clearInterval(interval);
  }, [isClockedIn]);

  const handlePunch = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      setIsAuthenticating(false);
      setIsClockedIn(!isClockedIn);
      if (isClockedIn) setElapsedTime("00:00:00");
    }, 1500);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] p-4 pt-24 text-zinc-100 selection:bg-blue-500/30 sm:p-6 md:p-12 md:pt-28">
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
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 p-[1px] shadow-[0_0_30px_-5px_rgba(59,130,246,0.4)]">
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#111]">
              <Clock className="h-8 w-8 text-white drop-shadow-md" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">
              Timeføring & Stemplingsur
            </h1>
            <p className="text-lg text-zinc-400">
              GPS-sikker innstempling via personlig enhet eller ansattpanel
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Punch Clock Widget */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative flex min-h-[500px] flex-col items-center justify-center overflow-hidden rounded-[3rem] border border-white/10 bg-[#0a0a0c]/80 p-12 text-center shadow-[0_0_50px_-15px_rgba(59,130,246,0.2)] backdrop-blur-3xl"
          >
            <div
              className={`absolute inset-0 blur-3xl transition-opacity duration-1000 ${isClockedIn ? "bg-emerald-500/10" : "bg-blue-500/5"}`}
            />

            <div className="relative z-10 flex w-full flex-col items-center">
              <p className="mb-4 text-sm font-bold tracking-widest text-zinc-400 uppercase">
                Lokal Tid Oslo
              </p>
              <h2 className="mb-12 text-4xl font-black tracking-tight text-white tabular-nums sm:text-6xl md:text-7xl">
                {currentTime}
              </h2>

              {isClockedIn && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-12 flex flex-col items-center"
                >
                  <div className="mb-2 flex items-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-400">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Aktivt
                    skift
                  </div>
                  <p className="font-mono text-3xl font-bold text-emerald-100">{elapsedTime}</p>
                </motion.div>
              )}

              <button
                onClick={handlePunch}
                disabled={isAuthenticating}
                className={`group relative flex h-48 w-48 flex-col items-center justify-center rounded-full border-4 shadow-2xl transition-all duration-300 ${
                  isAuthenticating
                    ? "border-zinc-700 bg-zinc-800"
                    : isClockedIn
                      ? "border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-50"
                      : "border-blue-500/50 bg-blue-500/10 text-blue-500 shadow-[0_0_50px_-10px_rgba(59,130,246,0.5)] hover:bg-blue-500/20"
                }`}
              >
                {isAuthenticating ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-t-2 border-r-2 border-white/50"
                  />
                ) : (
                  <div
                    className={`absolute inset-0 scale-75 rounded-full opacity-50 blur-xl transition-transform duration-500 group-hover:scale-95 ${isClockedIn ? "bg-red-500" : "bg-blue-500"}`}
                  />
                )}

                <div className="z-10 flex flex-col items-center gap-3">
                  {isAuthenticating ? (
                    <FingerprintIcon className="h-12 w-12 animate-pulse text-white/50" />
                  ) : (
                    <Fingerprint
                      className={`h-12 w-12 ${isClockedIn ? "text-red-400" : "text-blue-400"}`}
                    />
                  )}
                  <span
                    className={`text-sm font-black tracking-widest uppercase ${isAuthenticating ? "text-white/50" : "text-white"}`}
                  >
                    {isAuthenticating
                      ? "Verifiserer..."
                      : isClockedIn
                        ? "Stemple ut"
                        : "Stemple inn"}
                  </span>
                </div>
              </button>

              {!isClockedIn && !isAuthenticating && (
                <p className="mt-8 flex items-center gap-2 text-sm font-medium text-zinc-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> GPS Posisjon Verifisert
                  (Restaurant)
                </p>
              )}
            </div>
          </motion.div>

          {/* Shift Log + Detail View */}
          <div className="flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0c]/80 backdrop-blur-3xl"
            >
              {/* Shift list */}
              <div className="flex flex-1 flex-col p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="flex items-center gap-2.5 text-xl font-bold text-white">
                    <History className="h-5 w-5 text-blue-400" /> Tidslogg
                  </h3>
                  <button className="text-sm font-bold text-zinc-400 transition-colors hover:text-white">
                    Se alle
                  </button>
                </div>

                <div className="flex flex-1 flex-col gap-3">
                  {SHIFT_LOGS.map((log, i) => {
                    const isApproved = log.status === "approved";
                    return (
                      <motion.button
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        onClick={() => setSelectedShift(log)}
                        className="group flex w-full items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left transition-all hover:border-white/10 hover:bg-white/[0.04] sm:p-5"
                      >
                        {/* Left: date + times */}
                        <div className="min-w-0 flex-1">
                          <p className="mb-2 text-[15px] font-bold text-white">{log.date}</p>
                          <div className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/80 px-2.5 py-1 text-xs font-semibold text-zinc-400 tabular-nums">
                            <span>Inn {log.inTime}</span>
                            <span className="text-zinc-600">&middot;</span>
                            <span>Ut {log.outTime}</span>
                          </div>
                        </div>

                        {/* Right: hours + status */}
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="text-base font-black text-white tabular-nums">
                            {log.hours}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                              isApproved
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {isApproved && <CheckCircle2 className="h-3 w-3" />}
                            {isApproved ? "Godkjent" : "Venter godkjenning"}
                          </span>
                        </div>

                        {/* Chevron */}
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" />
                      </motion.button>
                    );
                  })}
                </div>

                {/* Weekly summary */}
                <div className="mt-5 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                  <span className="text-xs font-medium text-zinc-500">Denne uken</span>
                  <span className="text-sm font-bold text-white tabular-nums">25t 40m</span>
                </div>
              </div>

              {/* Detail overlay */}
              <AnimatePresence>
                {selectedShift && (
                  <ShiftDetailView shift={selectedShift} onClose={() => setSelectedShift(null)} />
                )}
              </AnimatePresence>
            </motion.div>

            {/* Automatiske Tillegg card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="group cursor-pointer rounded-[2rem] border border-indigo-500/30 bg-indigo-900/20 p-8 transition-colors hover:bg-indigo-900/30"
            >
              <div className="flex items-start justify-between">
                <FileText className="h-8 w-8 text-indigo-400 transition-transform group-hover:scale-110" />
                <div className="rounded-full border border-indigo-500/50 bg-indigo-500/20 px-3 py-1 text-xs font-bold tracking-widest text-indigo-300 uppercase">
                  Nyhet
                </div>
              </div>
              <h3 className="mt-4 mb-2 text-xl font-bold text-white">Automatiske Tillegg</h3>
              <p className="text-sm leading-relaxed font-medium text-indigo-200">
                Systemet legger automatisk til kvelds- og nattillegg basert på din tariff og
                arbeidstid.
              </p>
            </motion.div>
          </div>
        </div>

        <NextPageBanner
          href="/features/communications"
          title="Kommunikasjon"
          subtitle="Neste Funksjon"
          color="from-violet-500/10"
        />
      </div>
      <Footer />
    </div>
  );
}
