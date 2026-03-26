"use client";

import { useRef } from "react";
import { motion, useScroll } from "framer-motion";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import {
  ArrowRight,
  Globe,
  Sparkles,
  Zap,
  CheckCircle2,
  Building2,
  Users,
  MessageSquare,
  Bot,
  X,
  Check,
  BarChart3,
  BrainCircuit,
  Lock,
  ShieldCheck,
  GraduationCap,
  SunSnow,
  GitPullRequest,
  Activity,
} from "lucide-react";
import { createTranslator } from "@smartout/i18n";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";
import { TrackedCta as CtaButton, FullTracker } from "../../components/tracking";
import { WEB_APP_LINKS } from "../../lib/web-app-url";

import dynamic from "next/dynamic";

const LandingInteractivePoll = dynamic(() =>
  import("./LandingInteractivePoll").then((m) => m.LandingInteractivePoll),
);
const LandingInteractiveMockup = dynamic(() =>
  import("./LandingInteractiveMockup").then((m) => m.LandingInteractiveMockup),
);

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export default function VariantMLanding({ locale = "nb" }: { locale?: "nb" | "en" }) {
  const t = createTranslator(locale, "landing");
  const containerRef = useRef<HTMLDivElement>(null);
  useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <div className="bg-background text-foreground selection:bg-brand-orange/30 relative min-h-screen overflow-x-hidden font-sans">
      <FullTracker />

      {/* Dynamic Background Noise & Blur */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Subtle dot grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-foreground)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.03]" />

        {/* Glow orbs using tokens — initial opacity 0 prevents flash before hydration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ scale: [1, 1.05, 1], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="bg-brand-orange absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full blur-[120px]"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="bg-primary absolute top-[30%] right-[-10%] h-[40vw] w-[40vw] rounded-full blur-[120px]"
        />
      </div>

      <Navigation locale={locale} />

      <main className="relative z-10" ref={containerRef}>
        {/* 1. HERO - AI Horizon */}
        <section className="mx-auto flex min-h-[90vh] max-w-7xl flex-col items-center justify-center px-6 pt-32 pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 40, damping: 20 }}
            className="flex flex-col items-center"
          >
            <div className="border-brand-orange/20 bg-brand-orange/10 text-brand-orange mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold tracking-wide">
              <Sparkles className="h-4 w-4" />
              <span>{t("hero.badge")}</span>
            </div>

            <h1
              className={`${instrumentSerif.className} mb-6 max-w-5xl text-[3.5rem] leading-[0.95] tracking-tight sm:text-6xl md:text-7xl lg:text-[7.5rem]`}
            >
              {t("hero.title.prefix")}{" "}
              <span className="text-brand-orange relative whitespace-nowrap">
                {t("hero.title.highlight")}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 1, duration: 1.5, ease: "easeInOut" }}
                  className="bg-brand-orange/30 absolute -bottom-1 left-0 h-3 rounded-full sm:-bottom-2 sm:h-5"
                />
              </span>
              .
            </h1>

            <p className="text-muted-foreground mb-12 max-w-2xl text-lg leading-relaxed font-medium sm:text-xl md:text-2xl">
              {t("hero.subtitle")}
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <CtaButton
                label="M Hero Start Free"
                href={WEB_APP_LINKS.login}
                className="bg-primary text-primary-foreground group relative flex min-h-[56px] items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-bold shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl sm:text-lg"
              >
                <span>{t("hero.cta.primary")}</span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </CtaButton>
              <Link
                href="/compare"
                className="border-border text-foreground hover:bg-foreground/5 hover:border-brand-orange/30 flex min-h-[56px] items-center justify-center gap-2 rounded-full border px-8 py-4 text-base font-semibold transition-all sm:text-lg"
              >
                {t("hero.cta.secondary")}
              </Link>
            </div>
          </motion.div>
        </section>

        {/* 2. PROGRESSION & APP IN MOTION */}
        <section className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32">
          {/* New Polling Section to capture engagement right away */}
          <div className="mb-24">
            <LandingInteractivePoll locale={locale} />
          </div>

          <div className="mb-20 text-center">
            <h2 className={`${instrumentSerif.className} text-4xl sm:text-6xl`}>
              {t("steps.title")}
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
              {t("steps.subtitle")}
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-3">
            {[
              {
                step: "01",
                icon: <Building2 className="h-8 w-8" />,
                title: t("steps.1.title"),
                desc: t("steps.1.desc"),
                color: "text-[var(--info)]",
                bg: "bg-[var(--info)]/10",
              },
              {
                step: "02",
                icon: <Users className="h-8 w-8" />,
                title: t("steps.2.title"),
                desc: t("steps.2.desc"),
                color: "text-success",
                bg: "bg-success/10",
              },
              {
                step: "03",
                icon: <Bot className="h-8 w-8" />,
                title: t("steps.3.title"),
                desc: t("steps.3.desc"),
                color: "text-brand-orange",
                bg: "bg-brand-orange/10",
              },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: i * 0.2, type: "spring", stiffness: 45 }}
                className="border-border bg-card/50 flex flex-col rounded-3xl border p-8 backdrop-blur"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${s.bg} ${s.color}`}
                  >
                    {s.icon}
                  </div>
                  <span className="text-muted-foreground/30 text-5xl font-black">{s.step}</span>
                </div>
                <h3 className="text-foreground mb-3 text-2xl font-bold">{s.title}</h3>
                <p className="text-muted-foreground text-base leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 3. APP IN MOTION VISUAL (Scroll anims) */}
        <div className="relative z-10 mt-[-5rem]">
          <LandingInteractiveMockup locale={locale} />
        </div>

        {/* 4. WEBSITE FACTORY */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          <div className="via-primary/30 absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent to-transparent" />

          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-16 px-6 lg:flex-row">
            <div className="lg:w-1/2">
              <SectionLabel>{t("website.label")}</SectionLabel>
              <h2
                className={`${instrumentSerif.className} mt-4 text-4xl leading-tight sm:text-5xl lg:text-6xl`}
              >
                {t("website.title")}
              </h2>
              <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
                {t("website.desc")}
              </p>

              <ul className="mt-8 flex flex-col gap-4">
                {[t("website.feature.1"), t("website.feature.2"), t("website.feature.3")].map(
                  (item, i) => (
                    <li key={i} className="text-foreground flex items-center gap-3 font-medium">
                      <CheckCircle2 className="text-success h-5 w-5" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="relative flex justify-center lg:w-1/2">
              <div className="bg-primary/10 absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]" />

              <motion.div
                whileHover={{ y: -10 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="border-border/60 bg-card/40 relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border p-2 shadow-2xl backdrop-blur-xl"
              >
                <div className="bg-background relative overflow-hidden rounded-[1.75rem] p-8 pt-12 text-center shadow-inner">
                  <div className="mb-8 flex justify-center">
                    <Globe className="text-primary/40 h-16 w-16" strokeWidth={1} />
                  </div>
                  <div className="bg-foreground/10 mx-auto mb-4 h-2 w-24 rounded-full" />
                  <h5 className={`${instrumentSerif.className} mb-3 text-3xl`}>
                    {t("website.mockup.name")}
                  </h5>
                  <p className="text-muted-foreground mx-auto mb-8 max-w-[200px] text-xs">
                    {t("website.mockup.tagline")}
                  </p>
                  <div className="bg-primary/5 text-primary mx-auto w-fit rounded-full px-6 py-2 text-xs font-semibold">
                    {t("website.mockup.cta")}
                  </div>

                  <div className="from-background absolute right-0 bottom-0 left-0 h-24 bg-gradient-to-t to-transparent" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 4.5. FEATURE: IK-MAT & HMS */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          <div className="mx-auto flex max-w-7xl flex-col-reverse items-center justify-between gap-16 px-6 lg:flex-row-reverse">
            <div className="lg:w-1/2">
              <SectionLabel>{t("hms.label")}</SectionLabel>
              <h2
                className={`${instrumentSerif.className} mt-4 text-4xl leading-tight sm:text-5xl lg:text-6xl`}
              >
                {t("hms.title")}
              </h2>
              <p className="text-muted-foreground mt-6 text-lg leading-relaxed">{t("hms.desc")}</p>

              <ul className="mt-8 flex flex-col gap-4">
                {[t("hms.feature.1"), t("hms.feature.2"), t("hms.feature.3")].map((item, i) => (
                  <li key={i} className="text-foreground flex items-center gap-3 font-medium">
                    <ShieldCheck className="text-success h-5 w-5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative flex justify-center lg:w-1/2">
              <div className="bg-success/5 absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]" />
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-card/40 border-border/60 relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border p-6 shadow-2xl backdrop-blur-xl"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-success/20 flex h-10 w-10 items-center justify-center rounded-xl">
                      <ShieldCheck className="text-success h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{t("hms.mockup.title")}</div>
                      <div className="text-muted-foreground text-xs">{t("hms.mockup.due")}</div>
                    </div>
                  </div>
                  <div className="bg-success/10 text-success rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase">
                    {t("hms.mockup.status")}
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: t("hms.mockup.task.1"), done: true },
                    { label: t("hms.mockup.task.2"), done: true },
                    { label: t("hms.mockup.task.3"), done: false },
                  ].map((task, i) => (
                    <div
                      key={i}
                      className="bg-background/50 flex items-center gap-4 rounded-xl p-4"
                    >
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${task.done ? "border-success bg-success/20" : "border-border"}`}
                      >
                        {task.done && <Check className="text-success h-3 w-3" />}
                      </div>
                      <span
                        className={`text-sm ${task.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}
                      >
                        {task.label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 4.6. FEATURE: ONBOARDING & CONTINUOUS VERIFICATION */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-16 px-6 lg:flex-row">
            <div className="lg:w-1/2">
              <SectionLabel>{t("onboarding.label")}</SectionLabel>
              <h2
                className={`${instrumentSerif.className} mt-4 text-4xl leading-tight sm:text-5xl lg:text-6xl`}
              >
                {t("onboarding.title")}
              </h2>
              <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
                {t("onboarding.desc")}
              </p>

              <ul className="mt-8 flex flex-col gap-4">
                {[
                  t("onboarding.feature.1"),
                  t("onboarding.feature.2"),
                  t("onboarding.feature.3"),
                ].map((item, i) => (
                  <li key={i} className="text-foreground flex items-center gap-3 font-medium">
                    <GraduationCap className="text-brand-orange h-5 w-5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative flex justify-center lg:w-1/2">
              <div className="bg-brand-orange/5 absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]" />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-card/40 border-border/60 relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border p-8 shadow-2xl backdrop-blur-xl"
              >
                <div className="mb-8 flex flex-col items-center text-center">
                  <div className="border-border relative flex h-24 w-24 items-center justify-center rounded-full border-[6px]">
                    <svg
                      className="text-brand-orange absolute inset-0 h-full w-full -rotate-90 transform"
                      viewBox="0 0 100 100"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="46"
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray="289"
                        strokeDashoffset="40"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="text-2xl font-black">86%</span>
                  </div>
                  <h4 className="mt-4 text-lg font-bold">{t("onboarding.mockup.name")}</h4>
                  <p className="text-muted-foreground text-xs tracking-widest uppercase">
                    {t("onboarding.mockup.score")}
                  </p>
                </div>

                <div className="before:bg-border/50 relative space-y-4 before:absolute before:inset-y-0 before:left-[15px] before:w-[2px]">
                  {[
                    {
                      title: t("onboarding.mockup.step.1.title"),
                      status: "completed",
                      date: t("onboarding.mockup.step.1.date"),
                    },
                    {
                      title: t("onboarding.mockup.step.2.title"),
                      status: "completed",
                      date: t("onboarding.mockup.step.2.date"),
                    },
                    {
                      title: t("onboarding.mockup.step.3.title"),
                      status: "pending",
                      date: t("onboarding.mockup.step.3.date"),
                    },
                  ].map((step, i) => (
                    <div key={i} className="relative flex items-center gap-6 pl-10">
                      <div
                        className={`absolute top-1/2 left-0 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-2 ${step.status === "completed" ? "border-brand-orange bg-brand-orange" : "border-border bg-card"}`}
                      >
                        {step.status === "completed" ? (
                          <Check className="text-background h-4 w-4" />
                        ) : (
                          <div className="bg-border h-2 w-2 rounded-full" />
                        )}
                      </div>
                      <div className="bg-background/50 flex w-full items-center justify-between rounded-xl p-3">
                        <span
                          className={`text-sm font-semibold ${step.status === "completed" ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {step.title}
                        </span>
                        <span className="text-muted-foreground text-xs">{step.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 4.7. FEATURE: SEASONS WITH FACTORS & CASCADE */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          <div className="mx-auto flex max-w-7xl flex-col-reverse items-center justify-between gap-16 px-6 lg:flex-row-reverse">
            <div className="lg:w-1/2">
              <SectionLabel>{t("seasons.label")}</SectionLabel>
              <h2
                className={`${instrumentSerif.className} mt-4 text-4xl leading-tight sm:text-5xl lg:text-6xl`}
              >
                {t("seasons.title")}
              </h2>
              <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
                {t("seasons.desc")}
              </p>

              <ul className="mt-8 flex flex-col gap-4">
                {[t("seasons.feature.1"), t("seasons.feature.2"), t("seasons.feature.3")].map(
                  (item, i) => (
                    <li key={i} className="text-foreground flex items-center gap-3 font-medium">
                      <SunSnow className="h-5 w-5 shrink-0 text-[var(--info)]" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="relative flex justify-center lg:w-1/2">
              <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--info)]/5 blur-[80px]" />
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-card/40 border-border/60 relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border p-8 shadow-2xl backdrop-blur-xl"
              >
                <div className="bg-background/80 mb-8 flex rounded-xl p-1">
                  <div className="text-muted-foreground hover:bg-foreground/5 flex-1 cursor-pointer rounded-lg px-4 py-2 text-center text-sm font-semibold transition-colors">
                    {t("seasons.mockup.low")}
                  </div>
                  <div className="bg-primary/20 text-primary border-primary/20 flex-1 rounded-lg border px-4 py-2 text-center text-sm font-bold shadow-sm">
                    {t("seasons.mockup.high")}
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="bg-background/50 border-border/30 rounded-2xl border p-4 text-center">
                    <div className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wider uppercase">
                      {t("seasons.mockup.dayfactor")}
                    </div>
                    <div className="text-foreground text-2xl font-black">1.8x</div>
                  </div>
                  <div className="bg-background/50 border-border/30 rounded-2xl border p-4 text-center">
                    <div className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wider uppercase">
                      {t("seasons.mockup.revenue")}
                    </div>
                    <div className="text-success text-2xl font-black">145k</div>
                  </div>
                </div>

                {/* Micro Graph */}
                <div className="border-border/50 flex h-24 items-end justify-between gap-1 border-b pb-2">
                  {[20, 30, 40, 70, 95, 100, 60].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: "20%" }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.8, type: "spring" }}
                      className={`w-full rounded-t-sm ${i >= 4 ? "from-primary/60 to-primary/20 bg-gradient-to-t" : "from-foreground/10 to-foreground/5 bg-gradient-to-t"}`}
                    />
                  ))}
                </div>
                <div className="text-muted-foreground mt-2 flex justify-between text-[10px] font-semibold">
                  <span>M</span>
                  <span>T</span>
                  <span>O</span>
                  <span>T</span>
                  <span className="text-primary">F</span>
                  <span className="text-primary">L</span>
                  <span>S</span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 4.8. FEATURE: POLICY GATES & EVENT ENGINE */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-16 px-6 lg:flex-row">
            <div className="lg:w-1/2">
              <SectionLabel>{t("engine.label")}</SectionLabel>
              <h2
                className={`${instrumentSerif.className} mt-4 text-4xl leading-tight sm:text-5xl lg:text-6xl`}
              >
                {t("engine.title")}
              </h2>
              <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
                {t("engine.desc")}
              </p>

              <ul className="mt-8 flex flex-col gap-4">
                {[t("engine.feature.1"), t("engine.feature.2"), t("engine.feature.3")].map(
                  (item, i) => (
                    <li key={i} className="text-foreground flex items-center gap-3 font-medium">
                      <GitPullRequest className="text-brand-purple h-5 w-5 shrink-0" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="relative flex justify-center lg:w-1/2">
              <div className="bg-brand-purple/5 absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]" />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-card/40 border-border/60 relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border p-8 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex flex-col gap-4">
                  {/* Event Source */}
                  <div className="bg-background/80 border-border/50 relative z-10 flex items-center gap-4 rounded-xl border p-4">
                    <div className="bg-brand-orange/20 flex h-10 w-10 items-center justify-center rounded-full">
                      <Activity className="text-brand-orange h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{t("engine.mockup.event.title")}</div>
                      <div className="text-muted-foreground text-xs">
                        {t("engine.mockup.event.desc")}
                      </div>
                    </div>
                  </div>

                  {/* Flow arrow */}
                  <div className="relative z-0 -my-2 flex justify-center">
                    <div className="from-brand-orange to-brand-purple h-8 w-[2px] bg-gradient-to-b" />
                  </div>

                  {/* Policy Gate */}
                  <div className="border-brand-purple/20 bg-brand-purple/10 relative z-10 flex items-center gap-4 rounded-xl border p-4 shadow-[0_0_30px_-10px_var(--brand-purple)]">
                    <div className="bg-brand-purple/20 flex h-10 w-10 items-center justify-center rounded-full">
                      <Lock className="text-brand-purple-light h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-brand-purple-light text-sm font-bold">
                        {t("engine.mockup.gate.title")}
                      </div>
                      <div className="text-brand-purple/70 text-xs">
                        {t("engine.mockup.gate.desc")}
                      </div>
                    </div>
                  </div>

                  {/* Flow arrow */}
                  <div className="relative z-0 -my-2 flex justify-center">
                    <div className="to-success from-brand-purple h-8 w-[2px] bg-gradient-to-b" />
                  </div>

                  {/* Resolution */}
                  <div className="bg-background/80 border-border/50 relative z-10 flex items-center gap-4 rounded-xl border p-4">
                    <div className="bg-success/20 flex h-10 w-10 items-center justify-center rounded-full">
                      <MessageSquare className="text-success h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{t("engine.mockup.action.title")}</div>
                      <div className="text-muted-foreground text-xs">
                        {t("engine.mockup.action.desc")}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 4.9. FOUNDER STORY */}
        <section className="border-border/50 bg-background relative w-full overflow-hidden border-t py-24 sm:py-32">
          <div className="from-foreground/[0.02] pointer-events-none absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l to-transparent" />

          <div className="mx-auto flex max-w-7xl flex-col items-center gap-16 px-6 lg:flex-row">
            <div className="lg:w-3/5">
              <SectionLabel>{t("founder.label")}</SectionLabel>
              <h2
                className={`${instrumentSerif.className} mt-4 text-4xl leading-tight sm:text-5xl lg:text-6xl`}
              >
                {t("founder.title.line1")} <br />
                <span className="text-brand-orange">{t("founder.title.line2")}</span>
              </h2>

              <div className="text-muted-foreground mt-8 space-y-6 text-lg leading-relaxed sm:text-xl">
                <p>{t("founder.p1")}</p>
                <p>{t("founder.p2")}</p>
                <p className="text-foreground font-semibold">{t("founder.p3")}</p>
              </div>

              <div className="mt-10 flex items-center gap-4">
                <div className="bg-brand-orange/20 border-brand-orange/30 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2">
                  <div className="text-brand-orange text-xl font-bold">P</div>
                </div>
                <div>
                  <div className="text-foreground text-lg font-bold">{t("founder.name")}</div>
                  <div className="text-muted-foreground text-sm tracking-widest uppercase">
                    {t("founder.role")}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Stories */}
            <div className="flex w-full flex-col gap-6 lg:w-2/5">
              {[
                {
                  quote: t("testimonials.1.quote"),
                  author: t("testimonials.1.author"),
                  company: t("testimonials.1.company"),
                },
                {
                  quote: t("testimonials.2.quote"),
                  author: t("testimonials.2.author"),
                  company: t("testimonials.2.company"),
                },
                {
                  quote: t("testimonials.3.quote"),
                  author: t("testimonials.3.author"),
                  company: t("testimonials.3.company"),
                },
              ].map((story, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="bg-card/40 border-border/50 group relative overflow-hidden rounded-[2rem] border p-8"
                >
                  <div className="bg-brand-orange/5 group-hover:bg-brand-orange/10 absolute top-0 right-0 h-24 w-24 rounded-full blur-2xl transition-all" />
                  <MessageSquare className="text-brand-orange/30 mb-4 h-8 w-8" />
                  <p className="text-foreground relative z-10 mb-6 text-lg leading-relaxed font-medium">
                    {`"${story.quote}"`}
                  </p>
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="text-muted-foreground font-semibold">{story.author}</span>
                    <span className="text-brand-orange text-sm font-bold tracking-widest uppercase">
                      {story.company}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. PRICING WHY */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
            <SectionLabel>{t("pricing.label")}</SectionLabel>
            <h2
              className={`${instrumentSerif.className} mt-6 text-4xl leading-tight sm:text-5xl md:text-6xl`}
            >
              {t("pricing.title.prefix")}{" "}
              <span className="text-brand-orange">{t("pricing.title.highlight")}</span>.
            </h2>
            <p className="text-muted-foreground mt-8 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {t("pricing.desc")}
            </p>
          </div>
        </section>

        {/* 6. COMPARISON */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16 text-center">
              <SectionLabel>{t("compare.label")}</SectionLabel>
              <h2 className={`${instrumentSerif.className} mt-4 text-4xl sm:text-5xl`}>
                {t("compare.title")}
              </h2>
            </div>

            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-card/20 border-border/40 flex flex-col rounded-[2rem] border p-8 sm:p-12"
              >
                <div className="text-muted-foreground/60 mb-8 flex items-center gap-3 text-xl font-bold">
                  <Lock className="h-6 w-6" /> {t("compare.old.title")}
                </div>
                <ul className="space-y-6">
                  {[
                    t("compare.old.1"),
                    t("compare.old.2"),
                    t("compare.old.3"),
                    t("compare.old.4"),
                  ].map((item, i) => (
                    <li key={i} className="text-muted-foreground flex gap-4">
                      <X className="text-destructive mt-1 h-5 w-5 shrink-0" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-brand-orange/5 border-brand-orange/20 relative flex flex-col rounded-[2rem] border p-8 shadow-2xl sm:p-12"
              >
                <div className="bg-brand-orange/10 absolute top-0 right-0 h-32 w-32 rounded-full blur-[50px]" />
                <div className="text-foreground mb-8 flex items-center gap-3 text-xl font-bold">
                  <Zap className="text-brand-orange h-6 w-6" /> Smartout
                </div>
                <ul className="relative z-10 space-y-6">
                  {[
                    t("compare.new.1"),
                    t("compare.new.2"),
                    t("compare.new.3"),
                    t("compare.new.4"),
                  ].map((item, i) => (
                    <li key={i} className="text-foreground flex gap-4 font-medium">
                      <Check className="text-success mt-1 h-5 w-5 shrink-0" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 7. ANALYTICS */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          <div className="mx-auto flex max-w-7xl flex-col-reverse items-center justify-between gap-16 px-6 lg:flex-row">
            <div className="relative flex w-full justify-center lg:w-1/2">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-card/40 border-border/50 relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border p-8 backdrop-blur-md"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="text-muted-foreground text-sm font-semibold">
                    {t("analytics.mockup.label")}
                  </div>
                  <BarChart3 className="text-primary h-5 w-5" />
                </div>
                <div className="border-border/50 flex h-40 items-end justify-between gap-2 border-b pb-2">
                  {[40, 60, 45, 90, 75, 85, 50].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1, duration: 0.8, type: "spring" }}
                      className="from-primary/60 to-primary/10 w-full rounded-t-sm bg-gradient-to-t"
                    />
                  ))}
                </div>
                <div className="mt-8 flex items-center gap-4">
                  <div className="bg-success/20 flex h-10 w-10 items-center justify-center rounded-full">
                    <CheckCircle2 className="text-success h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-foreground text-sm font-bold">
                      {t("analytics.mockup.status")}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {t("analytics.mockup.detail")}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="lg:w-1/2">
              <SectionLabel>{t("analytics.label")}</SectionLabel>
              <h2
                className={`${instrumentSerif.className} mt-4 text-4xl leading-tight sm:text-5xl`}
              >
                {t("analytics.title.line1")}
                <br />
                {t("analytics.title.line2")}
              </h2>
              <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
                {t("analytics.desc")}
              </p>
              <div className="mt-8">
                <CtaButton
                  href={WEB_APP_LINKS.login}
                  label="Se Analytics Demo"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition-colors"
                >
                  {t("analytics.cta")} <ArrowRight className="h-4 w-4" />
                </CtaButton>
              </div>
            </div>
          </div>
        </section>

        {/* 8. AI ASSISTANT (Grand Finale) */}
        <section className="border-border/50 bg-background relative w-full overflow-hidden border-t py-32 sm:py-48">
          <div className="bg-brand-orange/10 pointer-events-none absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[150px]" />

          <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              className="from-brand-orange to-brand-orange-light mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-tr shadow-[0_0_50px_var(--brand-orange)]"
            >
              <BrainCircuit className="text-primary-foreground h-10 w-10" strokeWidth={1.5} />
            </motion.div>

            <SectionLabel>{t("ai.label")}</SectionLabel>
            <h2 className={`${instrumentSerif.className} mt-6 text-5xl leading-tight sm:text-7xl`}>
              {t("ai.title.line1")}
              <br />
              <span className="text-brand-orange">{t("ai.title.line2")}</span>
            </h2>
            <p className="text-muted-foreground mt-8 max-w-2xl text-xl leading-relaxed">
              {t("ai.desc")}
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-12"
            >
              <CtaButton
                href={WEB_APP_LINKS.login}
                label="Start reisen med Lise"
                className="bg-foreground text-background hover:bg-foreground/90 inline-flex items-center gap-2 rounded-full px-10 py-5 text-lg font-bold transition-transform hover:scale-105"
              >
                {t("ai.cta")} <ArrowRight className="h-5 w-5" />
              </CtaButton>
              <p className="text-muted-foreground mt-4 text-sm">{t("ai.cta.sub")}</p>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer locale={locale} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-brand-orange text-sm font-semibold tracking-[0.18em] uppercase">
      {children}
    </p>
  );
}
