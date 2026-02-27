"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Users, Target, Heart, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navigation from "../../components/navigation";

export default function OmOssPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 p-4 sm:p-6 md:p-12 pt-24 md:pt-28 selection:bg-orange-500/30 font-sans relative overflow-hidden flex flex-col items-center">
            <Navigation />

            {/* Dynamic Ambient Background */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-[#050505]">
                {/* Subtle Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

                {/* Glowing Orbs */}
                <div className="absolute top-[10%] left-[20%] w-[30vw] h-[30vw] bg-orange-600/10 rounded-full blur-[120px] mix-blend-screen" />
                <div className="absolute bottom-[20%] right-[10%] w-[40vw] h-[40vw] bg-rose-600/10 rounded-full blur-[150px] mix-blend-screen" />
            </div>

            <div className="w-full max-w-5xl relative z-10">
                <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12">
                    <ArrowLeft className="w-5 h-5" />
                    Tilbake til forside
                </button>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-20"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-bold uppercase tracking-widest mb-6">
                        <Users className="w-4 h-4" /> Vår Historie
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-8">
                        Drevet av lidenskap <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400">for gjestfrihet.</span>
                    </h1>
                    <p className="text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
                        Vi startet SmartOut fordi vi så at serveringsbransjen ble holdt tilbake av gamle, fragmenterte systemer. Vår misjon er å gi restauranter, hoteller og barer teknologien de fortjener.
                    </p>
                </motion.div>

                {/* Core Values Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="p-8 rounded-[32px] bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/5 hover:border-white/10 transition-colors"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500/20 to-rose-500/20 flex items-center justify-center mb-6 border border-orange-500/20">
                            <Target className="w-7 h-7 text-orange-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Målrettet Effektivitet</h3>
                        <p className="text-zinc-400 leading-relaxed">Vi tror på å fjerne friksjon. Hvert minutt spart på administrasjon er et minutt mer til gjestene.</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="p-8 rounded-[32px] bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/5 hover:border-white/10 transition-colors"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-6 border border-blue-500/20">
                            <ShieldCheck className="w-7 h-7 text-blue-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Full Pålitelighet</h3>
                        <p className="text-zinc-400 leading-relaxed">Systemet vårt er bygget for å tåle presset når restauranten er stappfull og marginene er små.</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="p-8 rounded-[32px] bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/5 hover:border-white/10 transition-colors"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-6 border border-emerald-500/20">
                            <Heart className="w-7 h-7 text-emerald-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Mennesker Først</h3>
                        <p className="text-zinc-400 leading-relaxed">Teknologi skal empowerere de ansatte, ikke overvåke dem. Vi designer for glede og mestring.</p>
                    </motion.div>
                </div>

                {/* Team / Office Section Placeholder */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="relative rounded-[40px] overflow-hidden bg-zinc-900 border border-white/10 aspect-video md:aspect-[21/9] flex items-center justify-center mb-32 group"
                >
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-1000 grayscale group-hover:grayscale-0" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="relative z-10 text-center p-8">
                        <h2 className="text-4xl font-black text-white mb-4">Bygget i Norge. Brukes overalt.</h2>
                        <p className="text-xl text-zinc-300">Fra vårt hovedkvarter jobber vi hver dag for å revolusjonere bransjen.</p>
                    </div>
                </motion.div>

                {/* CTA Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/10 rounded-[40px] p-12 relative overflow-hidden mb-20"
                >
                    <div className="absolute -inset-10 bg-gradient-to-br from-orange-500/10 to-rose-500/10 blur-3xl rounded-full" />
                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-5xl font-black text-white mb-6">Bli med på reisen</h2>
                        <p className="text-zinc-400 text-lg mb-8 max-w-2xl mx-auto">
                            Vi er alltid på utkikk etter nye partnere og kunder som vil være med å forme fremtidens restaurantdrift.
                        </p>
                        <Link href="http://localhost:3050/onboarding" className="inline-flex items-center gap-3 bg-white text-zinc-950 font-black px-10 py-5 rounded-full text-lg shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:-translate-y-1 transition-all duration-300">
                            <Zap className="w-5 h-5 text-orange-500" /> Start din SmartOut i dag
                        </Link>
                    </div>
                </motion.div>

            </div>
            {/* FOOTER */}
            <footer className="w-full border-t border-zinc-900 bg-zinc-950 py-12 relative z-10 mt-auto">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2 opacity-50">
                        <span className="text-lg font-black tracking-tighter text-zinc-400">SmartOut</span>
                    </div>
                    <p className="text-sm text-zinc-600 font-semibold">&copy; 2026 SmartOut AS. Helt bygget for fremtiden.</p>
                </div>
            </footer>
        </div>
    );
}
