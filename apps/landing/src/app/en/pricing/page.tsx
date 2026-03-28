"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Zap,
  Star,
  ShieldCheck,
  Users,
  Building2,
  GitCompareArrows,
} from "lucide-react";
import Navigation from "../../../components/navigation";
import Footer from "../../../components/footer";
import { WEB_APP_LINKS } from "../../../lib/web-app-url";
import { FullTracker, TrackedCta } from "../../../components/tracking";

export default function PricingPageEN() {
  return (
    <div className="bg-background text-foreground selection:bg-brand-orange/30 relative min-h-screen overflow-x-hidden font-sans">
      <FullTracker />

      <div className="bg-background pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-foreground)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.03]"></div>
        <div className="bg-brand-orange/10 absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full blur-[120px]" />
        <div className="bg-primary/10 absolute right-[-10%] bottom-[-20%] h-[40vw] w-[40vw] rounded-full blur-[150px]" />
      </div>

      <Navigation locale="en" />

      <main className="relative z-10 mx-auto min-h-screen max-w-7xl px-6 pt-32 pb-20 sm:pt-40">
        <div className="mb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-brand-orange/20 bg-brand-orange/10 text-brand-orange mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold tracking-widest uppercase"
          >
            <Zap className="h-4 w-4" />
            <span>A new standard</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 text-5xl leading-[1.05] font-black tracking-tighter md:text-7xl"
          >
            Free at the core. <br className="hidden md:block" />
            <span className="text-brand-orange">Pay only for intelligence.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground mx-auto max-w-3xl text-xl leading-relaxed font-medium"
          >
            Traditional systems punish you for growing by charging per employee for basic features.
            We do the opposite. Smartout Core Platform is 100% free for unlimited employees. You
            only pay when you choose to upgrade with AI and automation that saves you hours every
            week.
          </motion.p>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Free */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="group border-border/50 bg-card/40 hover:border-border relative flex flex-col overflow-hidden rounded-[2rem] border p-6 shadow-xl backdrop-blur-xl transition-all duration-500"
          >
            <div className="relative z-10 flex-1">
              <div className="border-border bg-foreground/5 mb-4 flex h-12 w-12 items-center justify-center rounded-xl border">
                <Users className="text-foreground h-6 w-6" />
              </div>

              <h3 className="text-foreground mb-2 text-2xl font-black">Free</h3>
              <p className="text-muted-foreground mb-6 text-sm">
                Smartout Core for operations, scheduling and basic HR.
              </p>

              <div className="mb-6">
                <span className="text-foreground text-4xl font-black">$0</span>
                <span className="text-muted-foreground mt-1 block text-xs font-bold tracking-widest uppercase">
                  Always free
                </span>
              </div>

              <ul className="mb-8 space-y-4 text-sm">
                {[
                  "Unlimited employees",
                  "Schedules and manual planning",
                  "Punch clock and payroll data",
                  "Employee overview and contracts",
                  "Basic Website Factory",
                ].map((feature, i) => (
                  <li key={i} className="text-foreground flex items-start gap-3 font-medium">
                    <CheckCircle2 className="text-foreground/40 mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <TrackedCta
              label="Start free"
              href={WEB_APP_LINKS.login}
              className="border-border/50 bg-foreground/5 text-foreground hover:bg-foreground/10 relative z-10 w-full rounded-full border py-3 text-center text-sm font-bold transition-colors"
            >
              Start free
            </TrackedCta>
          </motion.div>

          {/* Premium */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="group border-brand-orange/30 bg-brand-orange/5 hover:border-brand-orange/50 relative flex transform flex-col overflow-hidden rounded-[2rem] border p-6 shadow-[0_20px_80px_-20px_rgba(249,115,22,0.15)] backdrop-blur-xl transition-all duration-500 lg:-translate-y-4"
          >
            <div className="bg-brand-orange/10 absolute top-0 right-0 h-32 w-32 rounded-full blur-[40px]" />
            <div className="from-brand-orange absolute top-4 right-4 z-20 rounded-full bg-gradient-to-r to-orange-500 px-3 py-1 text-[10px] font-black tracking-wider text-white uppercase shadow-md">
              Most popular
            </div>

            <div className="relative z-10 flex-1">
              <div className="border-brand-orange/20 bg-brand-orange/20 mb-4 flex h-12 w-12 items-center justify-center rounded-xl border shadow-inner">
                <Star className="text-brand-orange fill-brand-orange h-6 w-6" />
              </div>

              <h3 className="text-brand-orange mb-2 text-2xl font-black">Premium</h3>
              <p className="text-foreground/80 mb-6 text-sm">
                Supercharge Smartout with AI and automation that saves you time every day.
              </p>

              <div className="mb-6">
                <span className="text-foreground text-4xl font-black">995,-</span>
                <span className="text-muted-foreground mt-1 block text-xs font-bold tracking-widest uppercase">
                  Per month (NOK)
                </span>
              </div>

              <ul className="mb-8 space-y-4 text-sm">
                {[
                  "Everything in Free",
                  "300 AI-generated shift suggestions",
                  "400 AI summaries",
                  "Policy Gates and Event Engine",
                  "Toggle paid features with one click",
                ].map((feature, i) => (
                  <li key={i} className="text-foreground flex items-start gap-3 font-semibold">
                    <CheckCircle2 className="text-brand-orange mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <TrackedCta
              label="Reserve Premium"
              href={WEB_APP_LINKS.login}
              className="bg-brand-orange relative z-10 w-full rounded-full py-3 text-center text-sm font-bold text-white shadow-xl transition-transform hover:scale-[1.02]"
            >
              Start the journey
            </TrackedCta>
          </motion.div>

          {/* Pro */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="group border-border/50 bg-card/40 hover:border-border relative flex flex-col overflow-hidden rounded-[2rem] border p-6 shadow-xl backdrop-blur-xl transition-all duration-500"
          >
            <div className="relative z-10 flex-1">
              <div className="border-border bg-foreground/5 mb-4 flex h-12 w-12 items-center justify-center rounded-xl border">
                <ShieldCheck className="text-foreground h-6 w-6" />
              </div>

              <h3 className="text-foreground mb-2 text-2xl font-black">Pro</h3>
              <p className="text-muted-foreground mb-6 text-sm">
                For operations with higher pace, more automation and bigger ambition.
              </p>

              <div className="mb-6">
                <span className="text-foreground text-4xl font-black">2500,-</span>
                <span className="text-muted-foreground mt-1 block text-xs font-bold tracking-widest uppercase">
                  Per month (NOK)
                </span>
              </div>

              <ul className="mb-8 space-y-4 text-sm">
                {[
                  "Everything in Premium",
                  "Higher AI and automation limits",
                  "Standard Website Factory",
                  "More operational workflows",
                  "Stronger reporting and summary engine",
                ].map((feature, i) => (
                  <li key={i} className="text-foreground flex items-start gap-3 font-medium">
                    <CheckCircle2 className="text-foreground/40 mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <TrackedCta
              label="See Pro"
              href={WEB_APP_LINKS.login}
              className="border-border/50 bg-foreground/5 text-foreground hover:bg-foreground/10 relative z-10 w-full rounded-full border py-3 text-center text-sm font-bold transition-colors"
            >
              Upgrade to Pro
            </TrackedCta>
          </motion.div>

          {/* Enterprise */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="group border-border/50 bg-card/40 hover:border-border relative flex flex-col overflow-hidden rounded-[2rem] border p-6 shadow-xl backdrop-blur-xl transition-all duration-500"
          >
            <div className="relative z-10 flex-1">
              <div className="border-border bg-foreground/5 mb-4 flex h-12 w-12 items-center justify-center rounded-xl border">
                <Building2 className="text-foreground h-6 w-6" />
              </div>

              <h3 className="text-foreground mb-2 text-2xl font-black">Enterprise</h3>
              <p className="text-muted-foreground mb-6 text-sm">
                Unlimited usage, SAML and customization for chains, multi-location and special
                needs.
              </p>

              <div className="mb-6">
                <span className="text-foreground text-4xl font-black">Custom</span>
                <span className="text-muted-foreground mt-1 block text-xs font-bold tracking-widest uppercase">
                  Contact us
                </span>
              </div>

              <ul className="mb-8 space-y-4 text-sm">
                {[
                  "Everything in Pro",
                  "Advanced website and special modules",
                  "SAML / enterprise auth",
                  "Custom onboarding and rollout",
                  "Dedicated Customer Success Manager",
                ].map((feature, i) => (
                  <li key={i} className="text-foreground flex items-start gap-3 font-medium">
                    <CheckCircle2 className="text-foreground/40 mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <TrackedCta
              label="Talk to us"
              href="/om-oss"
              className="border-border/50 bg-foreground/5 text-foreground hover:bg-foreground/10 relative z-10 w-full rounded-full border py-3 text-center text-sm font-bold transition-colors"
            >
              Talk to us
            </TrackedCta>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <Link
            href="/en/compare"
            className="text-brand-orange inline-flex items-center gap-2 font-bold hover:underline"
          >
            See full competitor comparison <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {/* COMPARISON SHOWCASES */}
        <div className="mx-auto mt-32 max-w-7xl">
          <div className="mb-16 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="border-foreground/10 bg-foreground/5 text-foreground mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold tracking-widest uppercase"
            >
              <GitCompareArrows className="h-4 w-4" />
              <span>Comparison</span>
            </motion.div>
            <h2 className="text-foreground mb-4 text-4xl font-black tracking-tighter md:text-5xl">
              Why choose Smartout?
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed">
              We don&apos;t just build an isolated scheduling tool. We build an intuitive operating
              system for your entire business.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card/40 border-border/50 hover:border-border rounded-[2.5rem] border p-8 shadow-xl backdrop-blur-xl transition-colors"
            >
              <h3 className="text-foreground mb-4 text-xl font-black">
                Instead of Planday & Timebanken
              </h3>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                They charge per employee and focus almost exclusively on numbers and hours. With
                Smartout you get a platform where{" "}
                <strong className="text-foreground">
                  scheduling and punch clock are 100% free
                </strong>
                . But most importantly: we give you an engaging, interactive platform where
                employees actually enjoy communicating.
              </p>
              <ul className="text-foreground space-y-3 text-sm font-medium">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> All-in-one team hub
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> Zero per-employee fees
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> Modern, blazing fast design
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-card/40 border-border/50 hover:border-border rounded-[2.5rem] border p-8 shadow-xl backdrop-blur-xl transition-colors"
            >
              <h3 className="text-foreground mb-4 text-xl font-black">Instead of eSmiley</h3>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                Why pay for a separate, isolated system just for food safety? Smartout replaces
                eSmiley by baking all cleaning, temperature logs and food authority requirements
                right into the{" "}
                <strong className="text-foreground">same app your employees already use</strong>{" "}
                every day.
              </p>
              <ul className="text-foreground space-y-3 text-sm font-medium">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> HACCP in the same app
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> Automatic reminders
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> Fewer apps to manage
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="bg-brand-orange/5 border-brand-orange/30 hover:border-brand-orange/50 relative overflow-hidden rounded-[2.5rem] border p-8 shadow-xl backdrop-blur-xl transition-colors"
            >
              <div className="bg-brand-orange/10 absolute top-0 right-0 h-32 w-32 rounded-full blur-[40px]" />
              <h3 className="text-brand-orange relative z-10 mb-4 text-xl font-black">
                Smartout Free changes everything
              </h3>
              <p className="text-foreground/80 relative z-10 mb-6 text-sm leading-relaxed">
                Why pay for basic tools in other apps? We give you everything you need to build the
                foundation, <strong className="text-foreground">completely free</strong>. You only
                pay if you want advanced AI and automation.
              </p>
              <ul className="text-foreground relative z-10 space-y-3 text-sm font-bold">
                <li className="flex items-center gap-3">
                  <Zap className="text-brand-orange h-4 w-4" /> Free scheduling
                </li>
                <li className="flex items-center gap-3">
                  <Zap className="text-brand-orange h-4 w-4" /> Free punch clock
                </li>
                <li className="flex items-center gap-3">
                  <Zap className="text-brand-orange h-4 w-4" /> Free Website Factory
                </li>
                <li className="flex items-center gap-3">
                  <Zap className="text-brand-orange h-4 w-4" /> Free team chat
                </li>
              </ul>
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mt-20 max-w-3xl text-center"
        >
          <h3 className="text-foreground mb-4 text-2xl font-bold">
            Multiple locations or extremely complex needs?
          </h3>
          <p className="text-muted-foreground mb-6 text-lg">
            Smartout Engine is built to handle everything from a small coffee shop to national
            chains. If you need custom Policy Gates, Enterprise API access or hardware sensors (IoT)
            for refrigerators, we build a setup that mirrors your reality.
          </p>
          <Link
            href="/en/om-oss"
            className="text-brand-orange inline-flex items-center gap-2 font-bold hover:underline"
          >
            Read our story and why we do this <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </main>

      <Footer locale="en" />
    </div>
  );
}
