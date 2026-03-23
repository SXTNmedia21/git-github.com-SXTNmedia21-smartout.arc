"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import {
  ArrowRight,
  Globe,
  Sparkles,
  Zap,
  CheckCircle2,
  CalendarCheck,
  Building2,
  Users,
  MessageSquare,
  Bot,
  X,
  Check,
  BarChart3,
  BrainCircuit,
  Lock,
} from "lucide-react";
import Navigation from "../../components/navigation";
import Footer from "../../components/footer";
import { TrackedCta as CtaButton, FullTracker } from "../../components/tracking";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { ThemeToggle } from "../../components/theme-toggle";

import { LandingInteractivePoll } from "./LandingInteractivePoll";
import { LandingInteractiveMockup } from "./LandingInteractiveMockup";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export default function VariantMLanding() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
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

        {/* Glow orbs using tokens */}
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="bg-brand-orange absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="bg-primary absolute top-[30%] right-[-10%] h-[40vw] w-[40vw] rounded-full blur-[120px]"
        />
      </div>

      <Navigation />

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
              <span>AI gjør jobben for tusenvis. Hvorfor ikke deg?</span>
            </div>

            <h1
              className={`${instrumentSerif.className} mb-6 max-w-5xl text-[3.5rem] leading-[0.95] tracking-tight sm:text-6xl md:text-7xl lg:text-[7.5rem]`}
            >
              Ta steget inn i{" "}
              <span className="text-brand-orange relative whitespace-nowrap">
                fremtiden
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
              Mens andre fyller ut regneark manuelt, opplever Smartout-brukere et operativsystem i
              bevegelse. Grunnfjellet er helt gratis. AI tar over rutineoppgavene.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <CtaButton
                label="M Hero Start Free"
                href={WEB_APP_LINKS.login}
                className="bg-primary text-primary-foreground group relative flex min-h-[56px] items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-bold shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl sm:text-lg"
              >
                <span>Start din reise gratis</span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </CtaButton>
              <Link
                href="/compare"
                className="border-border text-foreground hover:bg-foreground/5 hover:border-brand-orange/30 flex min-h-[56px] items-center justify-center gap-2 rounded-full border px-8 py-4 text-base font-semibold transition-all sm:text-lg"
              >
                Se hvorfor vi er gratis
              </Link>
            </div>
          </motion.div>
        </section>

        {/* 2. PROGRESSION & APP IN MOTION */}
        <section className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32">
          {/* New Polling Section to capture engagement right away */}
          <div className="mb-24">
            <LandingInteractivePoll />
          </div>

          <div className="mb-20 text-center">
            <h2 className={`${instrumentSerif.className} text-4xl sm:text-6xl`}>
              Slik fungerer det
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
              Fra null til AI-drevet drift på under en uke. Smartout er ikke bare programvare, det
              er en ustoppelig bevegelse fremover.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-3">
            {[
              {
                step: "01",
                icon: <Building2 className="h-8 w-8" />,
                title: "Et bunnsolid fundament",
                desc: "Du starter med bransjens beste gratisversjon. Vaktplan, timeregistrering, fravær og ansattkommunikasjon. Ingen lisenser. Kun muligheter.",
                color: "text-blue-500",
                bg: "bg-blue-500/10",
              },
              {
                step: "02",
                icon: <Users className="h-8 w-8" />,
                title: "Samle teamet ditt",
                desc: "Inviter teamet inn i appen. Legg inn rutiner, signer kontrakter digitalt med BankID, og kjør full onboarding før første vakt.",
                color: "text-emerald-500",
                bg: "bg-emerald-500/10",
              },
              {
                step: "03",
                icon: <Bot className="h-8 w-8" />,
                title: "La AI ta over",
                desc: "Slå på Premium når du trenger fart. Lise Botsson svarer på chat, og Event Motoren auto-bygger vakter basert på læring og historikk.",
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
          <LandingInteractiveMockup />
        </div>

        {/* 4. WEBSITE FACTORY - Luftig, elegant, sylskarpt */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          {/* Subtle elegant gradient */}
          <div className="via-primary/30 absolute top-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent to-transparent" />

          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-16 px-6 lg:flex-row">
            {/* Content Left */}
            <div className="lg:w-1/2">
              <SectionLabel>Inkludert i Free</SectionLabel>
              <h2
                className={`${instrumentSerif.className} mt-4 text-4xl leading-tight sm:text-5xl lg:text-6xl`}
              >
                En hjemmeside som puster.
              </h2>
              <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
                Smartout Website Factory genererer en profesjonell, sylskarp nettside for din
                bedrift – automatisk. Ingen koding. Alltid oppdatert med åpningstider, menyer og
                bordbestilling, direkte koblet til dine data i Smartout.
              </p>

              <ul className="mt-8 flex flex-col gap-4">
                {[
                  "Inkludert hosting og SSL",
                  "Oppdaterer åpningstider automatisk",
                  "Elegant og mobiltilpasset design",
                ].map((item, i) => (
                  <li key={i} className="text-foreground flex items-center gap-3 font-medium">
                    <CheckCircle2 className="text-success h-5 w-5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Visual Right - The "luftig" representation */}
            <div className="relative flex justify-center lg:w-1/2">
              {/* Soft glow behind */}
              <div className="bg-primary/10 absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]" />

              {/* Elegant floating card */}
              <motion.div
                whileHover={{ y: -10 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="border-border/60 bg-card/40 relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border p-2 shadow-2xl backdrop-blur-xl"
              >
                <div className="bg-background relative overflow-hidden rounded-[1.75rem] p-8 pt-12 text-center shadow-inner">
                  {/* Faux elegant website layout inside */}
                  <div className="mb-8 flex justify-center">
                    <Globe className="text-primary/40 h-16 w-16" strokeWidth={1} />
                  </div>
                  <div className="bg-foreground/10 mx-auto mb-4 h-2 w-24 rounded-full" />
                  <h5 className={`${instrumentSerif.className} mb-3 text-3xl`}>Café Belle</h5>
                  <p className="text-muted-foreground mx-auto mb-8 max-w-[200px] text-xs">
                    Fransk inspirasjon midt i hjertet av byen.
                  </p>
                  <div className="bg-primary/5 text-primary mx-auto w-fit rounded-full px-6 py-2 text-xs font-semibold">
                    Bestill bord
                  </div>

                  {/* Subtle fade out at bottom */}
                  <div className="from-background absolute right-0 bottom-0 left-0 h-24 bg-gradient-to-t to-transparent" />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 5. PRICING WHY - Hvorfor vi tar betalt som vi gjør */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
            <SectionLabel>Vår Prismodell</SectionLabel>
            <h2
              className={`${instrumentSerif.className} mt-6 text-4xl leading-tight sm:text-5xl md:text-6xl`}
            >
              Vi tar kun betalt for <span className="text-brand-orange">tiden vi sparer deg</span>.
            </h2>
            <p className="text-muted-foreground mt-8 max-w-2xl text-lg leading-relaxed sm:text-xl">
              De fleste systemer straffer deg for å vokse ved å ta betalt per ansatt. Vi mener det
              er baklengs. I Smartout er ubegrenset antall ansatte inkludert. Du betaler kun for de
              modulene som aktivt reduserer dine lønnskostnader og administrative timer.
            </p>
          </div>
        </section>

        {/* 6. SAMMENLIGNING - Det gamle vs Det nye */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-16 text-center">
              <SectionLabel>Sammenligning</SectionLabel>
              <h2 className={`${instrumentSerif.className} mt-4 text-4xl sm:text-5xl`}>
                Gammelt vs. Smartout
              </h2>
            </div>

            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
              {/* Gamle systemer */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-card/20 border-border/40 flex flex-col rounded-[2rem] border p-8 sm:p-12"
              >
                <div className="text-muted-foreground/60 mb-8 flex items-center gap-3 text-xl font-bold">
                  <Lock className="h-6 w-6" /> Det gamle rotet
                </div>
                <ul className="space-y-6">
                  {[
                    "Betaler lisens for hver eneste ringevikar.",
                    "Fem forskjellige apper for vaktplan, timelister, IK-mat og opplæring.",
                    "Sjefen bruker helgen på å jage ansatte for signaturer.",
                    "Lønnskjøring krever dager med manuell punsjing og kontroll.",
                  ].map((item, i) => (
                    <li key={i} className="text-muted-foreground flex gap-4">
                      <X className="text-destructive mt-1 h-5 w-5 shrink-0" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Smartout */}
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
                    "Ubegrenset antall ansatte. Skaler bedriften uten straff.",
                    "Én app for absolutt alt. Mindre kaos, mer flyt.",
                    "Lise Botsson følger opp manglende signaturer og oppgaver automatisk.",
                    "AI-optimalisert lønnskjøring med ett klikk.",
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

        {/* 7. WHAT WE DO FOR YOU (Data & Roller) */}
        <section className="border-border/50 bg-background relative w-full border-t py-24 sm:py-32">
          <div className="mx-auto flex max-w-7xl flex-col-reverse items-center justify-between gap-16 px-6 lg:flex-row">
            {/* Visual Left - Abstract Analytics */}
            <div className="relative flex w-full justify-center lg:w-1/2">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-card/40 border-border/50 relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border p-8 backdrop-blur-md"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="text-muted-foreground text-sm font-semibold">
                    Lønnskostnad / Omsetning
                  </div>
                  <BarChart3 className="text-primary h-5 w-5" />
                </div>
                {/* Faux Chart */}
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
                    <div className="text-foreground text-sm font-bold">Bemanningsgrad optimal</div>
                    <div className="text-muted-foreground text-xs">
                      Vaktplan godkjent for uke 42
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Content Right */}
            <div className="lg:w-1/2">
              <SectionLabel>Innsikt som teller</SectionLabel>
              <h2
                className={`${instrumentSerif.className} mt-4 text-4xl leading-tight sm:text-5xl`}
              >
                Dine data,
                <br />i arbeid for deg.
              </h2>
              <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
                Slutt å gjette om dere er over- eller underbemannet. Smartout analyserer trafikk,
                vær, og historikk for å anbefale nøyaktig hvem og hvor mange som burde være på jobb.
                Rett rolle til rett tid betyr en optimalisert bunnlinje.
              </p>
              <div className="mt-8">
                <CtaButton
                  href={WEB_APP_LINKS.login}
                  label="Se Analytics Demo"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition-colors"
                >
                  Utforsk mulighetene <ArrowRight className="h-4 w-4" />
                </CtaButton>
              </div>
            </div>
          </div>
        </section>

        {/* 8. AI ASSISTANT WHO OWNS THE COMPANY (Grand Finale) */}
        <section className="border-border/50 bg-background relative w-full overflow-hidden border-t py-32 sm:py-48">
          {/* Majestic ambient glow */}
          <div className="bg-brand-orange/10 pointer-events-none absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[150px]" />

          <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              className="from-brand-orange mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-tr to-orange-400 shadow-[0_0_50px_rgba(251,146,60,0.4)]"
            >
              <BrainCircuit className="h-10 w-10 text-white" strokeWidth={1.5} />
            </motion.div>

            <SectionLabel>Din digitale partner</SectionLabel>
            <h2 className={`${instrumentSerif.className} mt-6 text-5xl leading-tight sm:text-7xl`}>
              Møt sjefen.
              <br />
              <span className="text-brand-orange">Lise Botsson.</span>
            </h2>
            <p className="text-muted-foreground mt-8 max-w-2xl text-xl leading-relaxed">
              Lise er ikke en vanlig chatbot. Hun er selve motoren i Smartout. Hun kjenner lovverket
              bedre enn noen, forstår kulturen din, og styrer rutiner og vaktplanlegging autonomt.
              Hun tar de tunge løftene, slik at du kan fokusere på gjestene.
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
                Opprett gratis konto <ArrowRight className="h-5 w-5" />
              </CtaButton>
              <p className="text-muted-foreground mt-4 text-sm">
                Klar på under to minutter. Ingen bindingstid.
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
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
