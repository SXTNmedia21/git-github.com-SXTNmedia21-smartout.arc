"use client";

import { m } from "framer-motion";
import { ArrowLeft, Users, Target, Heart, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { usePageTracking, useTrackCta } from "../../hooks/useTracking";
import { useScrollTracking } from "../../hooks/useScrollTracking";
import { useClickTracking } from "../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../hooks/useSessionLifecycle";

export default function OmOssPage() {
  const router = useRouter();
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const trackCta = useTrackCta();

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#050505] p-4 pt-24 font-sans text-zinc-100 selection:bg-orange-500/30 sm:p-6 md:p-12 md:pt-28">
      <Navigation />

      {/* Dynamic Ambient Background */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]">
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-[size:24px_24px]"></div>

        {/* Glowing Orbs */}
        <div className="absolute top-[10%] left-[20%] h-[30vw] w-[30vw] rounded-full bg-orange-600/10 mix-blend-screen blur-[120px]" />
        <div className="absolute right-[10%] bottom-[20%] h-[40vw] w-[40vw] rounded-full bg-rose-600/10 mix-blend-screen blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        <button
          onClick={() => router.back()}
          className="mb-12 inline-flex items-center gap-2 text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          Tilbake til forside
        </button>

        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-20 text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-sm font-bold tracking-widest text-orange-400 uppercase">
            <Users className="h-4 w-4" /> Vår Historie
          </div>
          <h1 className="mb-8 text-5xl font-black tracking-tighter text-white md:text-7xl">
            Drevet av lidenskap <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">
              for gjestfrihet.
            </span>
          </h1>
          <p className="mx-auto max-w-3xl text-xl leading-relaxed text-zinc-400">
            Vi startet SmartOut fordi vi så at serveringsbransjen ble holdt tilbake av gamle,
            fragmenterte systemer. Vår misjon er å gi restauranter, hoteller og barer teknologien de
            fortjener.
          </p>
        </m.div>

        {/* Core Values Section */}
        <div className="mb-32 grid grid-cols-1 gap-8 md:grid-cols-3">
          <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="rounded-[32px] border border-white/5 bg-[#0a0a0c]/80 p-8 backdrop-blur-xl transition-colors hover:border-white/10"
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/20 bg-gradient-to-tr from-orange-500/20 to-rose-500/20">
              <Target className="h-7 w-7 text-orange-400" />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-white">Målrettet Effektivitet</h3>
            <p className="leading-relaxed text-zinc-400">
              Vi tror på å fjerne friksjon. Hvert minutt spart på administrasjon er et minutt mer
              til gjestene.
            </p>
          </m.div>

          <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-[32px] border border-white/5 bg-[#0a0a0c]/80 p-8 backdrop-blur-xl transition-colors hover:border-white/10"
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-gradient-to-tr from-blue-500/20 to-cyan-500/20">
              <ShieldCheck className="h-7 w-7 text-blue-400" />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-white">Full Pålitelighet</h3>
            <p className="leading-relaxed text-zinc-400">
              Systemet vårt er bygget for å tåle presset når restauranten er stappfull og marginene
              er små.
            </p>
          </m.div>

          <m.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-[32px] border border-white/5 bg-[#0a0a0c]/80 p-8 backdrop-blur-xl transition-colors hover:border-white/10"
          >
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20">
              <Heart className="h-7 w-7 text-emerald-400" />
            </div>
            <h3 className="mb-4 text-2xl font-bold text-white">Mennesker Først</h3>
            <p className="leading-relaxed text-zinc-400">
              Teknologi skal empowerere de ansatte, ikke overvåke dem. Vi designer for glede og
              mestring.
            </p>
          </m.div>
        </div>

        {/* Team / Office Section Placeholder */}
        <m.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="group relative mb-32 flex aspect-video items-center justify-center overflow-hidden rounded-[40px] border border-white/10 bg-zinc-900 md:aspect-[21/9]"
        >
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center opacity-40 grayscale transition-transform duration-1000 group-hover:scale-105 group-hover:grayscale-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="relative z-10 p-8 text-center">
            <h2 className="mb-4 text-4xl font-black text-white">Bygget i Norge. Brukes overalt.</h2>
            <p className="text-xl text-zinc-300">
              Fra vårt hovedkvarter jobber vi hver dag for å revolusjonere bransjen.
            </p>
          </div>
        </m.div>

        {/* CTA Section */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative mb-20 overflow-hidden rounded-[40px] border border-white/10 bg-[#0a0a0c]/80 p-12 text-center backdrop-blur-xl"
        >
          <div className="absolute -inset-10 rounded-full bg-gradient-to-br from-orange-500/10 to-rose-500/10 blur-3xl" />
          <div className="relative z-10">
            <h2 className="mb-6 text-3xl font-black text-white md:text-5xl">Bli med på reisen</h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-zinc-400">
              Vi er alltid på utkikk etter nye partnere og kunder som vil være med å forme
              fremtidens restaurantdrift.
            </p>
            <Link
              href={WEB_APP_LINKS.login}
              onClick={() => trackCta("Start din SmartOut i dag")}
              className="inline-flex items-center gap-3 rounded-full bg-white px-10 py-5 text-lg font-black text-zinc-950 shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(255,255,255,0.4)]"
            >
              <Zap className="h-5 w-5 text-orange-500" /> Start din SmartOut i dag
            </Link>
          </div>
        </m.div>
      </div>
      <Footer />
    </div>
  );
}
