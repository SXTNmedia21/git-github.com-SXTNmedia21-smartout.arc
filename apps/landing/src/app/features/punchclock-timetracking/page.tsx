"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  History,
  FileText,
  Fingerprint,
  Fingerprint as FingerprintIcon,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function TimeforingPage() {
  const router = useRouter();
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

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
          {/* Punch Clock Widget Mockup */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative flex min-h-[500px] flex-col items-center justify-center overflow-hidden rounded-[3rem] border border-white/10 bg-[#0a0a0c]/80 p-12 text-center shadow-[0_0_50px_-15px_rgba(59,130,246,0.2)] backdrop-blur-3xl"
          >
            <div
              className={`absolute inset-0 blur-3xl transition-opacity duration-1000 ${isClockedIn ? "bg-emerald-500/10" : "bg-blue-500/5"}`}
            ></div>

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
                    <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div> Aktivt
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
                } `}
              >
                {isAuthenticating ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-t-2 border-r-2 border-white/50"
                  ></motion.div>
                ) : (
                  <div
                    className={`absolute inset-0 scale-75 rounded-full opacity-50 blur-xl transition-transform duration-500 group-hover:scale-95 ${isClockedIn ? "bg-red-500" : "bg-blue-500"}`}
                  ></div>
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

          {/* Report / History Widget Mockup */}
          <div className="flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-1 flex-col rounded-[2rem] border border-white/10 bg-[#0a0a0c]/80 p-8 backdrop-blur-3xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                  <History className="h-5 w-5 text-blue-400" /> Tidslogg
                </h3>
                <button className="text-sm font-bold text-zinc-400 transition-colors hover:text-white">
                  Se alle
                </button>
              </div>

              <div className="flex flex-1 flex-col gap-4">
                {[
                  { date: "I går", in: "15:58", out: "23:15", hours: "7t 17m", status: "Godkjent" },
                  {
                    date: "Mandag",
                    in: "14:02",
                    out: "22:00",
                    hours: "7t 58m",
                    status: "Godkjent",
                  },
                  {
                    date: "Fredag",
                    in: "16:05",
                    out: "02:30",
                    hours: "10t 25m",
                    status: "Venter godkjenning",
                  },
                ].map((log, i) => (
                  <div
                    key={i}
                    className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/5 bg-black/40 p-4 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex flex-col">
                      <span className="mb-1 font-bold text-zinc-300">{log.date}</span>
                      <div className="flex w-fit gap-2 rounded bg-zinc-900 px-2 py-1 text-xs font-bold text-zinc-500">
                        <span>Inn {log.in}</span>
                        <span>•</span>
                        <span>Ut {log.out}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-sm">
                      <span className="mb-1 font-bold text-white">{log.hours}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${log.status === "Godkjent" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}
                      >
                        {log.status === "Godkjent" ? (
                          <CheckCircle2 className="mr-1 inline h-3 w-3" />
                        ) : null}
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

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
    </div>
  );
}
