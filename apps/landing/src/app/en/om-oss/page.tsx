"use client";

import { m } from "framer-motion";
import { ArrowLeft, Users, Target, Heart, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
import Footer from "../../../components/footer";
import { WEB_APP_LINKS } from "../../../lib/web-app-url";
import { usePageTracking, useTrackCta } from "../../../hooks/useTracking";
import { useScrollTracking } from "../../../hooks/useScrollTracking";
import { useClickTracking } from "../../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../../hooks/useSessionLifecycle";

export default function AboutPageEN() {
  const router = useRouter();
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const trackCta = useTrackCta();

  return (
    <div className="bg-background text-foreground selection:bg-brand-orange/30 relative flex min-h-screen flex-col items-center overflow-hidden p-4 pt-24 font-sans sm:p-6 md:p-12 md:pt-28">
      <Navigation locale="en" />

      <div className="bg-background pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-foreground)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.03]"></div>
        <div className="bg-brand-orange/10 absolute top-[10%] left-[20%] h-[30vw] w-[30vw] rounded-full mix-blend-screen blur-[120px]" />
        <div className="bg-primary/10 absolute right-[10%] bottom-[20%] h-[40vw] w-[40vw] rounded-full mix-blend-screen blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground mb-12 inline-flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to home
        </button>

        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="border-brand-orange/20 bg-brand-orange/10 text-brand-orange mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold tracking-widest uppercase">
            <Users className="h-4 w-4" /> Our Story
          </div>
          <h1 className="text-foreground mb-12 text-5xl font-black tracking-tighter md:text-7xl">
            Do you want me to be <br className="hidden md:block" />
            <span className="text-brand-orange">100% honest?</span>
          </h1>

          <div className="text-muted-foreground max-w-3xl space-y-6 text-xl leading-relaxed">
            <p>
              I&apos;ve worked in this industry for 20 years. For the last four years, we&apos;ve
              been building Smartout. And it has been brutal.
            </p>
            <p>
              Building a complex system from scratch is incredibly hard. We&apos;ve made mistakes,
              and I&apos;ll be honest:{" "}
              <strong className="text-foreground font-semibold">
                I&apos;ve lost many customers along the way.
              </strong>
              The system simply wasn&apos;t where it needed to be in the beginning.
            </p>
            <p>
              But my goal was never to build yet another isolated scheduling app, or yet another
              simple task list. There are plenty of those.
            </p>
            <p>
              For me, it was always about the essence. Everything in between. The information flow.
              The momentum. Building a system that takes control of the obvious, so you can finally
              focus on your people and your guests instead of paperwork.
            </p>
            <p className="text-foreground font-semibold">
              Now artificial intelligence is finally here. Technology has caught up with the vision
              we&apos;ve been working towards for four years. And I promise you — this is going to
              change our industry.
            </p>
          </div>

          <div className="mt-12 flex items-center gap-4">
            <div className="bg-brand-orange/20 border-brand-orange/30 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2">
              <div className="text-brand-orange text-xl font-bold">P</div>
            </div>
            <div>
              <div className="text-foreground text-lg font-bold">Pontus</div>
              <div className="text-muted-foreground text-sm tracking-widest uppercase">
                Founder, Smartout
              </div>
            </div>
          </div>
        </m.div>

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
            <h3 className="mb-4 text-2xl font-bold text-white">Purposeful Efficiency</h3>
            <p className="leading-relaxed text-zinc-400">
              We believe in removing friction. Every minute saved on administration is a minute more
              for your guests.
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
            <h3 className="mb-4 text-2xl font-bold text-white">Full Reliability</h3>
            <p className="leading-relaxed text-zinc-400">
              Our system is built to handle the pressure when the restaurant is packed and margins
              are thin.
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
            <h3 className="mb-4 text-2xl font-bold text-white">People First</h3>
            <p className="leading-relaxed text-zinc-400">
              Technology should empower employees, not monitor them. We design for joy and mastery.
            </p>
          </m.div>
        </div>

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
            <h2 className="mb-4 text-4xl font-black text-white">
              Built in Norway. Used everywhere.
            </h2>
            <p className="text-xl text-zinc-300">
              From our headquarters, we work every day to revolutionize the industry.
            </p>
          </div>
        </m.div>

        <m.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative mb-20 overflow-hidden rounded-[40px] border border-white/10 bg-[#0a0a0c]/80 p-12 text-center backdrop-blur-xl"
        >
          <div className="absolute -inset-10 rounded-full bg-gradient-to-br from-orange-500/10 to-rose-500/10 blur-3xl" />
          <div className="relative z-10">
            <h2 className="mb-6 text-3xl font-black text-white md:text-5xl">Join the journey</h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-zinc-400">
              We&apos;re always looking for new partners and customers who want to help shape the
              future of hospitality operations.
            </p>
            <Link
              href={WEB_APP_LINKS.login}
              onClick={() => trackCta("Start your SmartOut today")}
              className="inline-flex items-center gap-3 rounded-full bg-white px-10 py-5 text-lg font-black text-zinc-950 shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(255,255,255,0.4)]"
            >
              <Zap className="h-5 w-5 text-orange-500" /> Start your SmartOut today
            </Link>
          </div>
        </m.div>
      </div>
      <Footer locale="en" />
    </div>
  );
}
