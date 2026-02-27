"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, ChevronRight, ShieldCheck, Camera, PenTool, AlertTriangle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import NextPageBanner from "../../../components/next-page-banner";

export default function IkMatAvvikPage() {
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
        <div className="min-h-screen bg-[#050505] text-zinc-100 p-4 sm:p-6 md:p-12 pt-24 md:pt-28 selection:bg-orange-500/30 font-sans relative overflow-hidden flex flex-col items-center">
            <Navigation />

            {/* Dynamic Ambient Background */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-50">
                <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[150px] mix-blend-screen" />
                {/* Inner Grid Pattern */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-[length:32px_32px] bg-repeat opacity-[0.03] pointer-events-none"></div>
            </div>

            <div className="w-full max-w-5xl mx-auto relative z-10">

                {/* Header Navigation */}
                <div className="flex items-center justify-between mb-12 sm:mb-16">
                    <button onClick={() => router.back()} className="group inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors font-bold px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20">
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        Tilbake
                    </button>
                    <Link href="/waitlist" className="bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-white font-bold px-6 py-2.5 rounded-full text-sm transition-all shadow-[0_0_20px_-5px_rgba(249,115,22,0.5)] flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Waitlist
                    </Link>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-rose-500 p-[1px] shadow-[0_0_30px_-5px_rgba(249,115,22,0.4)] flex-shrink-0">
                            <div className="w-full h-full bg-[#111] rounded-2xl flex items-center justify-center">
                                <ShieldCheck className="w-8 h-8 text-white drop-shadow-md" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">IK-Mat & Avvik</h1>
                            <p className="text-zinc-400 text-lg sm:text-xl font-medium mt-1">Sømløs temperaturkontroll og mathygiene</p>
                        </div>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="relative bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 sm:p-8 md:p-12 shadow-[0_0_50px_-15px_rgba(249,115,22,0.2)] overflow-hidden"
                >
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 to-rose-500"></div>

                    {isDone ? (
                        <div className="text-center py-24">
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                                <div className="w-32 h-32 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]">
                                    <CheckCircle2 className="w-16 h-16 text-emerald-400" />
                                </div>
                            </motion.div>
                            <h2 className="text-4xl font-black text-white mb-4">Kontroll Loggført</h2>
                            <p className="text-zinc-400 text-xl font-medium max-w-md mx-auto">Målingen er sikkert lagret og synkronisert med styringssystemet ditt.</p>
                            <button onClick={() => { setIsDone(false); setStep(1); setTemp(4); }} className="mt-10 px-8 py-3.5 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all text-white shadow-sm">Ny registrering</button>
                        </div>
                    ) : (
                        <div className="relative z-10 flex flex-col md:flex-row gap-8 lg:gap-16">
                            {/* Survey Progress Sidebar */}
                            <div className="md:w-1/3 flex flex-col gap-6 md:border-r border-white/5 md:pr-8">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-bold w-fit mb-2 shadow-inner">
                                    <AlertTriangle className="w-4 h-4" /> Kjøl 1 (Kjøtt & Fisk)
                                </div>
                                <div className="flex md:flex-col gap-4 overflow-x-auto pb-4 md:pb-0 hide-scrollbar">
                                    {[1, 2, 3].map((s) => (
                                        <div key={s} className="flex gap-4 items-center flex-shrink-0">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 ${step === s ? "bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] ring-4 ring-orange-500/20" : step > s ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-zinc-800 text-zinc-500 border border-zinc-700"}`}>
                                                {step > s ? <CheckCircle2 className="w-6 h-6" /> : s}
                                            </div>
                                            <span className={`font-bold text-lg hidden sm:block transition-colors duration-300 ${step === s ? 'text-white' : step > s ? 'text-emerald-400' : 'text-zinc-600'}`}>
                                                {s === 1 ? "Visuell Sjekk" : s === 2 ? "Temperatur" : "Signatur"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Survey Step Content */}
                            <div className="md:w-2/3 flex flex-col justify-center min-h-[350px]">
                                {step === 1 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-8">
                                        <div>
                                            <h2 className="text-3xl font-black mb-2 text-white tracking-tight">Status for Kjøl 1</h2>
                                            <p className="text-zinc-400 text-lg">Er det noen tegn til svikt, ising eller skitne overflater?</p>
                                        </div>
                                        <div className="grid sm:grid-cols-2 gap-4">
                                            <button onClick={() => setStep(2)} className="h-40 border border-emerald-500/30 bg-emerald-500/5 rounded-2xl flex flex-col items-center justify-center gap-4 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all group">
                                                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <CheckCircle2 className="w-8 h-8" />
                                                </div>
                                                <span className="font-bold text-lg">Nei, alt ser bra ut</span>
                                            </button>
                                            <button className="h-40 border border-rose-500/30 bg-rose-500/5 rounded-2xl flex flex-col items-center justify-center gap-4 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 transition-all group">
                                                <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <AlertTriangle className="w-8 h-8" />
                                                </div>
                                                <span className="font-bold text-lg">Ja, registrer avvik</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {step === 2 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-8">
                                        <div>
                                            <h2 className="text-3xl font-black mb-2 text-white tracking-tight">Registrer temperatur</h2>
                                            <p className="text-zinc-400 text-lg">Hva viser panelet på utsiden av Kjøl 1?</p>
                                        </div>
                                        <div className="p-10 border border-white/5 bg-[#050505] rounded-3xl flex flex-col items-center gap-10 shadow-inner overflow-hidden relative">
                                            {/* Temperature Glow Effect based on value */}
                                            <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${temp > 4 ? 'bg-rose-500/5' : temp < 0 ? 'bg-blue-500/5' : 'bg-emerald-500/5'}`} />

                                            <div className={`text-7xl font-black tracking-tighter transition-colors duration-300 ${temp > 4 ? 'text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]' : temp < 0 ? 'text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.3)]' : 'text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400'}`}>
                                                {temp}°C
                                            </div>
                                            <input
                                                type="range"
                                                min="-2"
                                                max="12"
                                                value={temp}
                                                onChange={(e) => setTemp(Number(e.target.value))}
                                                className="w-full max-w-md cursor-pointer accent-orange-500 h-3 bg-zinc-800 rounded-full appearance-none hover:bg-zinc-700 transition-colors"
                                            />
                                            <div className="flex justify-between w-full max-w-md text-xs text-zinc-500 font-black uppercase tracking-widest">
                                                <span className="text-blue-400/70">Under 0°C</span>
                                                <span className="text-emerald-400/70">Ideell (1-4°C)</span>
                                                <span className="text-rose-400/70">Kritisk {'>'}4°C</span>
                                            </div>
                                        </div>
                                        <button onClick={() => setStep(3)} className="mt-2 px-8 py-4 bg-zinc-100 hover:bg-white text-zinc-900 font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 text-lg">
                                            Bekreft Temperatur <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </motion.div>
                                )}

                                {step === 3 && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-8">
                                        <div>
                                            <h2 className="text-3xl font-black mb-2 text-white tracking-tight">Godkjenn registrering</h2>
                                            <p className="text-zinc-400 text-lg">Se over dataene før du signerer sjekklisten.</p>
                                        </div>

                                        <div className="p-8 border border-white/10 bg-[#050505] rounded-3xl space-y-6 shadow-inner relative overflow-hidden">
                                            {temp > 4 && (
                                                <div className="absolute top-0 right-0 p-4">
                                                    <div className="bg-rose-500/20 text-rose-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-rose-500/30 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Avvik Omdirigert</div>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center border-b border-white/5 pb-6">
                                                <span className="text-zinc-500 font-semibold text-lg">Visuell sjekk:</span>
                                                <span className="text-emerald-400 font-bold flex items-center gap-2 text-lg bg-emerald-500/10 px-4 py-1.5 rounded-lg border border-emerald-500/20"><CheckCircle2 className="w-5 h-5" /> Godkjent</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-zinc-500 font-semibold text-lg">Målt temperatur:</span>
                                                <span className={`${temp > 4 ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'} font-black text-3xl px-6 py-2 rounded-xl border`}>{temp}°C</span>
                                            </div>
                                            {temp > 4 && (
                                                <div className="mt-4 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm">
                                                    <strong>Systemvarsel:</strong> Temperaturen er over grenseverdien. Et tiltakskjema for kjølesvikt vil automatisk bli lagt til i oppgavelisten din etter signering.
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                            <button className="flex-1 px-6 py-4 border border-white/10 bg-white/5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all text-zinc-300">
                                                <Camera className="w-5 h-5" />
                                                Legg til bilde
                                            </button>
                                            <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 px-6 py-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(249,115,22,0.5)] flex items-center justify-center gap-2 text-lg">
                                                {isSubmitting ? "Leverer til systemet..." : "Signer og send"}
                                                {!isSubmitting && <PenTool className="w-5 h-5" />}
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
            <style dangerouslySetInnerHTML={{
                __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
        </div>
    );
}
