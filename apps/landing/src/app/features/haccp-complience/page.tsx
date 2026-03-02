"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Camera,
  PenTool,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import Footer from "../../../components/footer";
import { usePageTracking } from "../../../hooks/useTracking";
import { useScrollTracking } from "../../../hooks/useScrollTracking";
import { useClickTracking } from "../../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../../hooks/useSessionLifecycle";
import NextPageBanner from "../../../components/next-page-banner";

export default function IkMatAvvikPage() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [temp, setTemp] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsDone(true);
    }, 1200);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#050505] p-4 pt-24 font-sans text-zinc-100 selection:bg-orange-500/30 sm:p-6 md:p-12 md:pt-28">
      <Navigation />

      {/* Dynamic Ambient Background */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50">
        <div className="animate-pulse-slow absolute top-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-orange-600/10 mix-blend-screen blur-[120px]" />
        <div className="absolute right-[-10%] bottom-[-10%] h-[600px] w-[600px] rounded-full bg-rose-600/10 mix-blend-screen blur-[150px]" />
        {/* Inner Grid Pattern */}
        <div className="pointer-events-none absolute inset-0 bg-[url('/grid.svg')] bg-[length:32px_32px] bg-repeat opacity-[0.03]"></div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        {/* Header Navigation */}
        <div className="mb-12 flex items-center justify-between sm:mb-16">
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-bold text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            Tilbake
          </button>
          <Link
            href="/waitlist"
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-600 to-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_-5px_rgba(249,115,22,0.5)] transition-all hover:from-orange-500 hover:to-rose-500"
          >
            <Sparkles className="h-4 w-4" />
            Waitlist
          </Link>
        </div>

        <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 flex-shrink-0 rounded-2xl bg-gradient-to-tr from-orange-500 to-rose-500 p-[1px] shadow-[0_0_30px_-5px_rgba(249,115,22,0.4)]">
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#111]">
                <ShieldCheck className="h-8 w-8 text-white drop-shadow-md" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                IK-Mat & Avvik
              </h1>
              <p className="mt-1 text-lg font-medium text-zinc-400 sm:text-xl">
                Sømløs temperaturkontroll og mathygiene
              </p>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0c]/80 p-6 shadow-[0_0_50px_-15px_rgba(249,115,22,0.2)] backdrop-blur-3xl sm:p-8 md:p-12"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 to-rose-500"></div>

          {isDone ? (
            <div className="py-24 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
              >
                <div className="mx-auto mb-8 flex h-32 w-32 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="h-16 w-16 text-emerald-400" />
                </div>
              </motion.div>
              <h2 className="mb-4 text-4xl font-black text-white">Kontroll Loggført</h2>
              <p className="mx-auto max-w-md text-xl font-medium text-zinc-400">
                Målingen er sikkert lagret og synkronisert med styringssystemet ditt.
              </p>
              <button
                onClick={() => {
                  setIsDone(false);
                  setStep(1);
                  setTemp(4);
                }}
                className="mt-10 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 font-bold text-white shadow-sm transition-all hover:bg-white/10"
              >
                Ny registrering
              </button>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col gap-8 md:flex-row lg:gap-16">
              {/* Survey Progress Sidebar */}
              <div className="flex flex-col gap-6 border-white/5 md:w-1/3 md:border-r md:pr-8">
                <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm font-bold text-orange-400 shadow-inner">
                  <AlertTriangle className="h-4 w-4" /> Kjøl 1 (Kjøtt & Fisk)
                </div>
                <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-4 md:flex-col md:pb-0">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="flex flex-shrink-0 items-center gap-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black transition-all duration-300 ${step === s ? "bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] ring-4 ring-orange-500/20" : step > s ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "border border-zinc-700 bg-zinc-800 text-zinc-500"}`}
                      >
                        {step > s ? <CheckCircle2 className="h-6 w-6" /> : s}
                      </div>
                      <span
                        className={`hidden text-lg font-bold transition-colors duration-300 sm:block ${step === s ? "text-white" : step > s ? "text-emerald-400" : "text-zinc-600"}`}
                      >
                        {s === 1 ? "Visuell Sjekk" : s === 2 ? "Temperatur" : "Signatur"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Survey Step Content */}
              <div className="flex min-h-[350px] flex-col justify-center md:w-2/3">
                {step === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-8"
                  >
                    <div>
                      <h2 className="mb-2 text-3xl font-black tracking-tight text-white">
                        Status for Kjøl 1
                      </h2>
                      <p className="text-lg text-zinc-400">
                        Er det noen tegn til svikt, ising eller skitne overflater?
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <button
                        onClick={() => setStep(2)}
                        className="group flex h-40 flex-col items-center justify-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10"
                      >
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 transition-transform group-hover:scale-110">
                          <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <span className="text-lg font-bold">Nei, alt ser bra ut</span>
                      </button>
                      <button className="group flex h-40 flex-col items-center justify-center gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 text-rose-400 transition-all hover:border-rose-500/50 hover:bg-rose-500/10">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 transition-transform group-hover:scale-110">
                          <AlertTriangle className="h-8 w-8" />
                        </div>
                        <span className="text-lg font-bold">Ja, registrer avvik</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-8"
                  >
                    <div>
                      <h2 className="mb-2 text-3xl font-black tracking-tight text-white">
                        Registrer temperatur
                      </h2>
                      <p className="text-lg text-zinc-400">
                        Hva viser panelet på utsiden av Kjøl 1?
                      </p>
                    </div>
                    <div className="relative flex flex-col items-center gap-10 overflow-hidden rounded-3xl border border-white/5 bg-[#050505] p-10 shadow-inner">
                      {/* Temperature Glow Effect based on value */}
                      <div
                        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${temp > 4 ? "bg-rose-500/5" : temp < 0 ? "bg-blue-500/5" : "bg-emerald-500/5"}`}
                      />

                      <div
                        className={`text-4xl font-black tracking-tighter transition-colors duration-300 sm:text-5xl md:text-7xl ${temp > 4 ? "text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]" : temp < 0 ? "text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.3)]" : "bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent"}`}
                      >
                        {temp}°C
                      </div>
                      <input
                        type="range"
                        min="-2"
                        max="12"
                        value={temp}
                        onChange={(e) => setTemp(Number(e.target.value))}
                        className="h-3 w-full max-w-md cursor-pointer appearance-none rounded-full bg-zinc-800 accent-orange-500 transition-colors hover:bg-zinc-700"
                      />
                      <div className="flex w-full max-w-md justify-between text-xs font-black tracking-widest text-zinc-500 uppercase">
                        <span className="text-blue-400/70">Under 0°C</span>
                        <span className="text-emerald-400/70">Ideell (1-4°C)</span>
                        <span className="text-rose-400/70">Kritisk {">"}4°C</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setStep(3)}
                      className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-8 py-4 text-lg font-bold text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:bg-white"
                    >
                      Bekreft Temperatur <ChevronRight className="h-5 w-5" />
                    </button>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-8"
                  >
                    <div>
                      <h2 className="mb-2 text-3xl font-black tracking-tight text-white">
                        Godkjenn registrering
                      </h2>
                      <p className="text-lg text-zinc-400">
                        Se over dataene før du signerer sjekklisten.
                      </p>
                    </div>

                    <div className="relative space-y-6 overflow-hidden rounded-3xl border border-white/10 bg-[#050505] p-8 shadow-inner">
                      {temp > 4 && (
                        <div className="absolute top-0 right-0 p-4">
                          <div className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/20 px-3 py-1 text-xs font-bold tracking-wider text-rose-400 uppercase">
                            <AlertTriangle className="h-3 w-3" /> Avvik Omdirigert
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-b border-white/5 pb-6">
                        <span className="text-lg font-semibold text-zinc-500">Visuell sjekk:</span>
                        <span className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-lg font-bold text-emerald-400">
                          <CheckCircle2 className="h-5 w-5" /> Godkjent
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-zinc-500">
                          Målt temperatur:
                        </span>
                        <span
                          className={`${temp > 4 ? "border-rose-500/20 bg-rose-500/10 text-rose-400" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"} rounded-xl border px-6 py-2 text-3xl font-black`}
                        >
                          {temp}°C
                        </span>
                      </div>
                      {temp > 4 && (
                        <div className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-orange-400">
                          <strong>Systemvarsel:</strong> Temperaturen er over grenseverdien. Et
                          tiltakskjema for kjølesvikt vil automatisk bli lagt til i oppgavelisten
                          din etter signering.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-4 pt-2 sm:flex-row">
                      <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-4 font-bold text-zinc-300 transition-all hover:bg-white/10">
                        <Camera className="h-5 w-5" />
                        Legg til bilde
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-4 text-lg font-bold text-white shadow-[0_0_20px_-5px_rgba(249,115,22,0.5)] transition-all hover:bg-orange-500"
                      >
                        {isSubmitting ? "Leverer til systemet..." : "Signer og send"}
                        {!isSubmitting && <PenTool className="h-5 w-5" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        <NextPageBanner
          href="/features/punchclock-timetracking"
          title="Træcking & Timeføring"
          subtitle="Neste Funksjon"
          color="from-indigo-500/10"
        />
      </div>
      <Footer />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `,
        }}
      />
    </div>
  );
}
