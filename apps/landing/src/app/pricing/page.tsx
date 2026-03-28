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
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { FullTracker, TrackedCta } from "../../components/tracking";

export default function PricingPage() {
  return (
    <div className="bg-background text-foreground selection:bg-brand-orange/30 relative min-h-screen overflow-x-hidden font-sans">
      <FullTracker />

      {/* Dynamic Ambient Background */}
      <div className="bg-background pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-foreground)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.03]"></div>

        {/* Glow orbs */}
        <div className="bg-brand-orange/10 absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full blur-[120px]" />
        <div className="bg-primary/10 absolute right-[-10%] bottom-[-20%] h-[40vw] w-[40vw] rounded-full blur-[150px]" />
      </div>

      <Navigation />

      <main className="relative z-10 mx-auto min-h-screen max-w-7xl px-6 pt-32 pb-20 sm:pt-40">
        <div className="mb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-brand-orange/20 bg-brand-orange/10 text-brand-orange mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold tracking-widest uppercase"
          >
            <Zap className="h-4 w-4" />
            <span>En ny standard</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 text-5xl leading-[1.05] font-black tracking-tighter md:text-7xl"
          >
            Gratis i bunn. <br className="hidden md:block" />
            <span className="text-brand-orange">Betal kun for intelligens.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground mx-auto max-w-3xl text-xl leading-relaxed font-medium"
          >
            Tradisjonelle systemer straffer deg for å vokse ved å ta betalt per ansatt for helt
            enkle funksjoner. Vi gjør det motsatte. Smartout Grunnplattform er 100% gratis for
            ubegrenset antall ansatte. Du betaler kun når du velger å oppgradere med AI og
            automasjon som sparer deg for timer hver uke.
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
                Smartout Core for drift, vaktlister og grunnleggende personalarbeid.
              </p>

              <div className="mb-6">
                <span className="text-foreground text-4xl font-black">0,-</span>
                <span className="text-muted-foreground mt-1 block text-xs font-bold tracking-widest uppercase">
                  Alltid gratis
                </span>
              </div>

              <ul className="mb-8 space-y-4 text-sm">
                {[
                  "Ubegrenset antall ansatte",
                  "Vaktlister og manuell planlegging",
                  "Punch clock og lønnsgrunnlag",
                  "Ansattoversikt og kontraktsflyt",
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
              label="Start gratis"
              href={WEB_APP_LINKS.login}
              className="border-border/50 bg-foreground/5 text-foreground hover:bg-foreground/10 relative z-10 w-full rounded-full border py-3 text-center text-sm font-bold transition-colors"
            >
              Start gratis
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
              Mest aktuell
            </div>

            <div className="relative z-10 flex-1">
              <div className="border-brand-orange/20 bg-brand-orange/20 mb-4 flex h-12 w-12 items-center justify-center rounded-xl border shadow-inner">
                <Star className="text-brand-orange fill-brand-orange h-6 w-6" />
              </div>

              <h3 className="text-brand-orange mb-2 text-2xl font-black">Premium</h3>
              <p className="text-foreground/80 mb-6 text-sm">
                Supercharge Smartout med AI og automasjon som sparer deg tid i hverdagen.
              </p>

              <div className="mb-6">
                <span className="text-foreground text-4xl font-black">995,-</span>
                <span className="text-muted-foreground mt-1 block text-xs font-bold tracking-widest uppercase">
                  Per måned
                </span>
              </div>

              <ul className="mb-8 space-y-4 text-sm">
                {[
                  "Alt fra Free",
                  "300 AI-genererte vaktforslag",
                  "400 AI-sammendrag",
                  "Policy Gates og Event Engine",
                  "Slå av/på betalfunksjoner med ett klikk",
                ].map((feature, i) => (
                  <li key={i} className="text-foreground flex items-start gap-3 font-semibold">
                    <CheckCircle2 className="text-brand-orange mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <TrackedCta
              label="Reserver Premium"
              href={WEB_APP_LINKS.login}
              className="bg-brand-orange relative z-10 w-full rounded-full py-3 text-center text-sm font-bold text-white shadow-xl transition-transform hover:scale-[1.02]"
            >
              Start reisen
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
                For drift med høyere tempo, mer automatisering og større ambisjon.
              </p>

              <div className="mb-6">
                <span className="text-foreground text-4xl font-black">2500,-</span>
                <span className="text-muted-foreground mt-1 block text-xs font-bold tracking-widest uppercase">
                  Per måned
                </span>
              </div>

              <ul className="mb-8 space-y-4 text-sm">
                {[
                  "Alt fra Premium",
                  "Høyere tak for AI og automasjon",
                  "Standard Website Factory",
                  "Flere operative workflows",
                  "Sterkere rapport- og sammendragsmotor",
                ].map((feature, i) => (
                  <li key={i} className="text-foreground flex items-start gap-3 font-medium">
                    <CheckCircle2 className="text-foreground/40 mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <TrackedCta
              label="Se Pro"
              href={WEB_APP_LINKS.login}
              className="border-border/50 bg-foreground/5 text-foreground hover:bg-foreground/10 relative z-10 w-full rounded-full border py-3 text-center text-sm font-bold transition-colors"
            >
              Oppgrader til Pro
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
                Fri flyt, SAML og tilpasning for kjeder, multi-location og spesialbehov.
              </p>

              <div className="mb-6">
                <span className="text-foreground text-4xl font-black">Custom</span>
                <span className="text-muted-foreground mt-1 block text-xs font-bold tracking-widest uppercase">
                  Ta kontakt
                </span>
              </div>

              <ul className="mb-8 space-y-4 text-sm">
                {[
                  "Alt fra Pro",
                  "Advanced website og spesialmoduler",
                  "SAML / enterprise auth",
                  "Tilpasset onboarding og rollout",
                  "Dedikert Customer Success Manager",
                ].map((feature, i) => (
                  <li key={i} className="text-foreground flex items-start gap-3 font-medium">
                    <CheckCircle2 className="text-foreground/40 mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <TrackedCta
              label="Snakk med oss"
              href="/om-oss"
              className="border-border/50 bg-foreground/5 text-foreground hover:bg-foreground/10 relative z-10 w-full rounded-full border py-3 text-center text-sm font-bold transition-colors"
            >
              Snakk med oss
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
            href="/compare"
            className="text-brand-orange inline-flex items-center gap-2 font-bold hover:underline"
          >
            Se full sammenligning med konkurrentene <ArrowRight className="h-4 w-4" />
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
              <span>Sammenligning</span>
            </motion.div>
            <h2 className="text-foreground mb-4 text-4xl font-black tracking-tighter md:text-5xl">
              Hvorfor velge Smartout?
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed">
              Vi bygger ikke bare en isolert vaktplan. Vi bygger et intuitivt operativsystem for
              hele bedriften.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Planday / Timebanken comparison */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card/40 border-border/50 hover:border-border rounded-[2.5rem] border p-8 shadow-xl backdrop-blur-xl transition-colors"
            >
              <h3 className="text-foreground mb-4 text-xl font-black">
                Istedenfor Planday & Timebanken
              </h3>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                De tar betalt per ansatt og fokuserer nesten utelukkende på tall og timer. I
                Smartout får du en plattform hvor{" "}
                <strong className="text-foreground">vaktplan og stemplingsur er 100% gratis</strong>
                . Men viktigst av alt: vi gir deg en engasjerende, interaktiv plattform der de
                ansatte faktisk liker å kommunisere.
              </p>
              <ul className="text-foreground space-y-3 text-sm font-medium">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> Alt-i-ett hub for teamet
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> Null lisens per ansatt
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> Moderne, lynraskt design
                </li>
              </ul>
            </motion.div>

            {/* eSmiley comparison */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-card/40 border-border/50 hover:border-border rounded-[2.5rem] border p-8 shadow-xl backdrop-blur-xl transition-colors"
            >
              <h3 className="text-foreground mb-4 text-xl font-black">Istedenfor eSmiley</h3>
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                Hvorfor betale for et eget, isolert system kun for IK-mat? Smartout erstatter
                eSmiley ved å bake alt av renhold, temperaturlogger og Mattilsynets krav rett inn i
                den{" "}
                <strong className="text-foreground">samme appen de ansatte allerede bruker</strong>{" "}
                hver dag.
              </p>
              <ul className="text-foreground space-y-3 text-sm font-medium">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> HACCP i samme app
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> Automatiske påminnelser
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-success h-4 w-4" /> Færre apper å forholde seg til
                </li>
              </ul>
            </motion.div>

            {/* What you get in Free */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="bg-brand-orange/5 border-brand-orange/30 hover:border-brand-orange/50 relative overflow-hidden rounded-[2.5rem] border p-8 shadow-xl backdrop-blur-xl transition-colors"
            >
              <div className="bg-brand-orange/10 absolute top-0 right-0 h-32 w-32 rounded-full blur-[40px]" />
              <h3 className="text-brand-orange relative z-10 mb-4 text-xl font-black">
                Smartout Free endrer alt
              </h3>
              <p className="text-foreground/80 relative z-10 mb-6 text-sm leading-relaxed">
                Hvorfor betale for grunnleggende verktøy i andre apper? Vi gir deg alt du trenger
                for å bygge grunnmuren, <strong className="text-foreground">helt gratis</strong>. Du
                betaler kun om du vil ha avansert AI og automasjon.
              </p>
              <ul className="text-foreground relative z-10 space-y-3 text-sm font-bold">
                <li className="flex items-center gap-3">
                  <Zap className="text-brand-orange h-4 w-4" /> Gratis vaktplan
                </li>
                <li className="flex items-center gap-3">
                  <Zap className="text-brand-orange h-4 w-4" /> Gratis stemplingsur
                </li>
                <li className="flex items-center gap-3">
                  <Zap className="text-brand-orange h-4 w-4" /> Gratis Website Factory
                </li>
                <li className="flex items-center gap-3">
                  <Zap className="text-brand-orange h-4 w-4" /> Gratis team-chat
                </li>
              </ul>
            </motion.div>
          </div>
        </div>

        {/* Undertekst / FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mt-20 max-w-3xl text-center"
        >
          <h3 className="text-foreground mb-4 text-2xl font-bold">
            Har du flere lokasjoner eller ekstremt komplekse behov?
          </h3>
          <p className="text-muted-foreground mb-6 text-lg">
            Smartout Engine er bygget for å håndtere alt fra den lille kaffebaren til nasjonale
            kjeder. Hvis du trenger skreddersydde Policy Gates, Enterprise API-tilganger eller
            hardware-sensorer (IoT) for kjøleskap, bygger vi et oppsett som speiler din virkelighet.
          </p>
          <Link
            href="/om-oss"
            className="text-brand-orange inline-flex items-center gap-2 font-bold hover:underline"
          >
            Les historien vår og hvorfor vi gjør dette <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
