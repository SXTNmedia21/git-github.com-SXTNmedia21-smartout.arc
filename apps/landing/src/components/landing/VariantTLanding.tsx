// ============================================
// VariantTLanding.tsx
// Landing page variant for persona "Thomas" — Enterprise / Admin / Data.
// Thomas is a Senior HR Director (60 yrs), 30+ years of ERP systems.
// He values data, audit trails, integrations, and evidence over promises.
//
// Design energy: Enterprise SaaS — tables, metrics, integrations.
// Accent color: Slate-blue (slate-400/500/600).
// No decorative gradients — everything looks like an enterprise dashboard.
//
// Sections (8):
//   1. Hero — headline + animated dashboard mockup with status table
//   2. Compliance Dashboard — counter stats + fake data table
//   3. Integration Matrix — 8-tile grid of integration partners
//   4. Multi-Property Analytics — property tabs + compliance ring + mini stats
//   5. Data Export — 3 bullet points about data ownership
//   6. Security Badges — 5 trust badges in a row
//   7. SmartOut AI — AI capabilities table + VoiceDemoWidget
//   8. CTA — final conversion section
//
// Connected to: ../navigation.tsx (shared nav), ../footer.tsx (shared footer)
// ============================================

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { usePageTracking, useTrackCta } from "../../hooks/useTracking";
import { useScrollTracking } from "../../hooks/useScrollTracking";
import { useClickTracking } from "../../hooks/useClickTracking";
import { useSessionLifecycle } from "../../hooks/useSessionLifecycle";
import {
  ArrowRight,
  Shield,
  BarChart3,
  CheckCircle2,
  Download,
  Database,
  Lock,
  Globe,
  FileCheck,
  KeyRound,
  ShieldCheck,
  Server,
  Table,
  Users,
  Building2,
  CalendarClock,
  AlertTriangle,
  ExternalLink,
  MonitorSmartphone,
  Bot,
} from "lucide-react";
import Navigation from "../navigation";
import Footer from "../footer";
import VoiceDemoWidget from "./VoiceDemoWidget";
import { WEB_APP_LINKS } from "../../lib/web-app-url";
import { VARIANT_VOICE_CONFIG, VARIANT_AI_SECTION } from "../../lib/variant-voice-config";

// --------------------------------------------
// Counter animation component
// Counts up from 0 to the target value when scrolled into view.
// Uses requestAnimationFrame for smooth 60fps animation.
// --------------------------------------------

/** Props for the animated counter */
type AnimatedCounterProps = {
  /** The number to count up to */
  target: number;
  /** Suffix appended after the number (e.g. "%" or " min") */
  suffix?: string;
  /** Prefix before the number (e.g. "kr ") */
  prefix?: string;
  /** Number of decimal places to show */
  decimals?: number;
  /** Duration of the count-up animation in milliseconds */
  duration?: number;
};

/**
 * Renders a number that animates from 0 to the target value
 * when the element scrolls into view. Uses useInView from
 * framer-motion to detect visibility, then drives a simple
 * ease-out cubic interpolation over the specified duration.
 *
 * Why: Thomas values data — seeing numbers "materialize" reinforces
 * that the platform is actively tracking real metrics.
 *
 * @returns A span element displaying the animated number
 */
function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
  decimals = 0,
  duration = 2000,
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Only animate once, and only when the element is visible
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now();

    /**
     * Animation frame callback. Calculates elapsed time,
     * derives progress (0 to 1) with ease-out cubic easing,
     * and updates the displayed count.
     */
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for a natural deceleration feel
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(eased * target);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [isInView, target, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toFixed(decimals)}
      {suffix}
    </span>
  );
}

// --------------------------------------------
// Shared animation variants
// Reused across sections for consistent reveal behavior.
// --------------------------------------------

/** Fade-up animation: starts invisible and 24px below, slides into place */
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

/** Fade-in animation: starts invisible, fades into place */
const fadeIn = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

// --------------------------------------------
// Data constants
// Static data used across multiple sections.
// Kept outside the component to avoid re-creation on render.
// --------------------------------------------

/** Rows for the hero dashboard mockup table */
const heroTableRows = [
  { name: "Matvaretrygghet", status: "Godkjent", color: "emerald" },
  { name: "Brannvern", status: "Godkjent", color: "emerald" },
  { name: "Allergenprotokoll", status: "Utloper", color: "yellow" },
  { name: "HMS-opplaering", status: "Mangler", color: "red" },
] as const;

/** Rows for the compliance dashboard data table */
const complianceTableRows = [
  {
    name: "Erik Hansen",
    cert: "Matvaretrygghet",
    expiry: "2026-08-15",
    status: "Godkjent",
    color: "emerald",
  },
  {
    name: "Ingrid Bakke",
    cert: "Brannvern",
    expiry: "2026-04-01",
    status: "Utloper",
    color: "yellow",
  },
  {
    name: "Lars Pedersen",
    cert: "Allergenprotokoll",
    expiry: "2026-09-22",
    status: "Godkjent",
    color: "emerald",
  },
  {
    name: "Marte Johansen",
    cert: "HMS-kurs",
    expiry: "2026-03-10",
    status: "Mangler",
    color: "red",
  },
  {
    name: "Ola Nilsen",
    cert: "Skjenkebevilling",
    expiry: "2026-12-01",
    status: "Godkjent",
    color: "emerald",
  },
] as const;

/** Integration partner names for the integration matrix grid */
const integrations = [
  "Planday",
  "Quinyx",
  "Visma Lonn",
  "Tripletex",
  "HotSoft",
  "Infrasys",
  "Mews",
  "Lightspeed",
] as const;

/** Property tab labels for the multi-property analytics section */
const properties = ["Oslo", "Bergen", "Stavanger"] as const;

/** Mini stat cards for the multi-property analytics section */
const propertyStats = [
  { label: "Ansatte", value: "142", icon: Users },
  { label: "Sertifiseringer", value: "847", icon: FileCheck },
  { label: "Neste utlop", value: "12 dager", icon: CalendarClock },
  { label: "Avvik", value: "2", icon: AlertTriangle },
] as const;

/** Data export feature bullet points */
const exportFeatures = [
  {
    icon: Download,
    text: "CSV-eksport med ett klikk",
  },
  {
    icon: Database,
    text: "Full API-tilgang for egne systemer",
  },
  {
    icon: FileCheck,
    text: "Revisjonsklar dokumentasjon",
  },
] as const;

/** Security trust badges shown in a row */
const securityBadges = [
  { icon: ShieldCheck, label: "GDPR-kompatibel" },
  { icon: Globe, label: "Norske datasentre" },
  { icon: Server, label: "SOC 2" },
  { icon: KeyRound, label: "2-faktor (2FA)" },
  { icon: Lock, label: "Ende-til-ende kryptering" },
] as const;

// --------------------------------------------
// Status badge helper
// Returns the correct Tailwind classes for a status badge
// based on the color key from the data constants.
// --------------------------------------------

/**
 * Maps a color key to Tailwind background, text, and border classes
 * for the status badges in the data tables.
 *
 * Why: Consistent visual language — green = good, yellow = expiring,
 * red = missing. Thomas expects traffic-light compliance indicators.
 *
 * @param color - One of "emerald", "yellow", or "red"
 * @returns A string of Tailwind CSS classes for the badge
 */
function statusClasses(color: string): string {
  switch (color) {
    case "emerald":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "yellow":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    case "red":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

// ============================================
// Main component
// ============================================

/**
 * VariantTLanding — Enterprise-focused landing page for persona "Thomas".
 *
 * This variant emphasizes data, compliance, integrations, and security.
 * Every visual element is designed to look like an enterprise dashboard:
 * tables with status badges, counter animations, integration grids,
 * and zero decorative gradients.
 *
 * Why: Thomas needs evidence, not promises. He trusts structured data
 * and familiar enterprise patterns over flashy marketing visuals.
 *
 * @returns The complete landing page for the Thomas persona
 */
export default function VariantTLanding() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  const trackCta = useTrackCta();

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white selection:bg-slate-500/30">
      {/* Shared Navigation */}
      <Navigation />

      {/* ================================
          Section 1: Hero
          "Full kontroll. Null gjetning."
          Dashboard mockup with status table.
          ================================ */}
      <section className="relative px-6 pt-32 pb-20 lg:pt-48 lg:pb-32">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          {/* Left column: headline and CTAs */}
          <div className="z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-500/20 bg-slate-500/10 px-3 py-1"
            >
              <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Enterprise Compliance Platform
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-6 text-5xl leading-[1.1] font-extrabold tracking-tight lg:text-7xl"
            >
              Full kontroll.
              <span className="block text-slate-400">Null gjetning.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-8 max-w-xl text-lg leading-relaxed text-zinc-400"
            >
              Samle sertifiseringer, opplaering og compliance i ett system. Revisionsklar
              dokumentasjon, sanntidsdata og full integrasjonsstotte.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col gap-4 sm:flex-row"
            >
              <Link
                href={WEB_APP_LINKS.onboarding}
                onClick={() => trackCta("Se plattformen")}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-500 px-8 py-4 font-bold text-white transition-all hover:bg-slate-400"
              >
                Se plattformen <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="#compliance"
                onClick={() => trackCta("Book demo")}
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-8 py-4 text-center font-bold text-white transition-all hover:border-zinc-600 hover:bg-zinc-800"
              >
                Book demo
              </Link>
            </motion.div>
          </div>

          {/* Right column: animated dashboard mockup with status table */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl">
              {/* Dashboard header bar */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-zinc-300">Compliance Oversikt</span>
                </div>
                <span className="text-xs text-zinc-500">Sist oppdatert: I dag 08:14</span>
              </div>

              {/* Status table with traffic-light badges */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase">
                      <th className="pr-4 pb-3 font-medium">Krav</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heroTableRows.map((row, i) => (
                      <motion.tr
                        key={row.name}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
                        className="border-b border-zinc-800/50"
                      >
                        <td className="py-3 pr-4 text-zinc-300">{row.name}</td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses(row.color)}`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Live data indicator */}
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-500" />
                </span>
                Sanntidsdata
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================
          Section 2: Compliance Dashboard
          Counter stats + fake data table.
          Counters animate on scroll via AnimatedCounter.
          ================================ */}
      <section id="compliance" className="px-6 py-20 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight lg:text-5xl">
              Compliance i sanntid
            </h2>
            <p className="mx-auto max-w-2xl text-zinc-400">
              Alle sertifiseringer, opplaeringsloep og avvik samlet i ett dashboard. Ingen
              overraskelser ved revisjon.
            </p>
          </motion.div>

          {/* 3 animated counter stats */}
          <div className="mb-16 grid gap-8 sm:grid-cols-3">
            {[
              {
                value: 98.3,
                suffix: "% compliance",
                decimals: 1,
                icon: CheckCircle2,
              },
              {
                value: 47,
                suffix: " min spart daglig",
                decimals: 0,
                icon: CalendarClock,
              },
              {
                value: 0,
                suffix: " avvik siste 30 dager",
                decimals: 0,
                icon: Shield,
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.suffix}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center"
              >
                <stat.icon className="mx-auto mb-4 h-8 w-8 text-slate-400" />
                <p className="text-4xl font-bold text-white lg:text-5xl">
                  <AnimatedCounter
                    target={stat.value}
                    suffix={stat.suffix}
                    decimals={stat.decimals}
                    duration={2000}
                  />
                </p>
              </motion.div>
            ))}
          </div>

          {/* Fake data table — full compliance table with Norwegian names */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-zinc-300">Sertifiseringsoversikt</span>
              </div>
              <span className="text-xs text-zinc-500">5 ansatte</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase">
                    <th className="px-6 py-3 font-medium">Ansatt</th>
                    <th className="px-6 py-3 font-medium">Sertifikat</th>
                    <th className="px-6 py-3 font-medium">Utlop</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {complianceTableRows.map((row) => (
                    <tr
                      key={`${row.name}-${row.cert}`}
                      className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                    >
                      <td className="px-6 py-4 text-zinc-300">{row.name}</td>
                      <td className="px-6 py-4 text-zinc-400">{row.cert}</td>
                      <td className="px-6 py-4 text-zinc-400">{row.expiry}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses(row.color)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================
          Section 3: Integration Matrix
          "Kobles til systemene du allerede bruker."
          8-tile grid of integration partners.
          ================================ */}
      <section className="px-6 py-20 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight lg:text-5xl">
              Kobles til systemene du allerede bruker
            </h2>
            <p className="mx-auto max-w-2xl text-zinc-400">
              Smartout integrerer med vaktplansystemer, lonnssystemer og POS uten manuell
              dataoverfoering.
            </p>
          </motion.div>

          {/* 8-tile integration grid — 2 cols mobile, 4 cols desktop */}
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
            {integrations.map((name, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-6 text-center transition-colors hover:border-slate-600 hover:bg-zinc-800/60"
              >
                <span className="text-sm font-medium text-zinc-300">{name}</span>
              </motion.div>
            ))}
          </div>

          {/* API documentation link */}
          <motion.div {...fadeIn} className="mt-8 text-center">
            <Link
              href="/docs/api"
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-300"
            >
              Se full API-dokumentasjon
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ================================
          Section 4: Multi-Property Analytics
          Property selector tabs + compliance ring + mini stat cards.
          Tabs are visual-only — "Oslo" is always the active tab.
          ================================ */}
      <section className="px-6 py-20 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight lg:text-5xl">
              Alle lokasjoner. Ett overblikk.
            </h2>
            <p className="mx-auto max-w-2xl text-zinc-400">
              Sammenlign compliance-status, opplaeringsfremdrift og avvik pa tvers av alle
              avdelinger og eiendommer.
            </p>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 lg:p-10"
          >
            {/* Property selector tabs — first tab is visually active */}
            <div className="mb-8 flex gap-2">
              {properties.map((city, i) => (
                <button
                  key={city}
                  type="button"
                  className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
                    i === 0
                      ? "bg-slate-500 text-white"
                      : "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {city}
                </button>
              ))}
            </div>

            <div className="grid items-center gap-10 lg:grid-cols-2">
              {/* Compliance ring — SVG circle showing 94% completion */}
              <div className="flex justify-center">
                <div className="relative flex h-52 w-52 items-center justify-center">
                  {/* Background ring (full circle in zinc-800) */}
                  <svg
                    className="absolute h-full w-full -rotate-90"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-zinc-800"
                    />
                    {/* Filled arc — 94% of circumference (2 * PI * 42 = ~263.9) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray="263.9"
                      strokeDashoffset={263.9 * (1 - 0.94)}
                      className="text-slate-500"
                    />
                  </svg>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-white">94%</p>
                    <p className="text-sm text-zinc-400">Compliance</p>
                  </div>
                </div>
              </div>

              {/* 4 mini stat cards in a 2x2 grid */}
              <div className="grid grid-cols-2 gap-4">
                {propertyStats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5"
                  >
                    <stat.icon className="mb-2 h-5 w-5 text-slate-400" />
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-sm text-zinc-500">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================
          Section 5: Data Export
          "Dine data. Ditt format."
          3 bullet points with icons about data ownership.
          ================================ */}
      <section className="px-6 py-20 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div {...fadeUp}>
            <MonitorSmartphone className="mx-auto mb-6 h-10 w-10 text-slate-400" />
            <h2 className="mb-4 text-3xl font-bold tracking-tight lg:text-5xl">
              Dine data. Ditt format.
            </h2>
            <p className="mx-auto mb-12 max-w-xl text-zinc-400">
              Eksporter, integrer eller bygg videre. Du eier alltid dataene dine — uten vendor
              lock-in.
            </p>
          </motion.div>

          <div className="space-y-6">
            {exportFeatures.map((feature, i) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-500/10">
                  <feature.icon className="h-5 w-5 text-slate-400" />
                </div>
                <span className="text-lg font-medium text-zinc-200">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================
          Section 6: Security Badges
          "Sikkerhet uten kompromiss."
          5 trust badges in a responsive row.
          ================================ */}
      <section className="px-6 py-20 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight lg:text-5xl">
              Sikkerhet uten kompromiss
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {securityBadges.map((badge, i) => (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center"
              >
                <badge.icon className="h-7 w-7 text-slate-400" />
                <span className="text-sm font-medium text-zinc-300">{badge.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================
          Section 7: SmartOut AI
          AI capability table rows + VoiceDemoWidget.
          Enterprise-styled with table-row layout for capabilities.
          Icons: Shield (audit), Database (compliance), AlertTriangle (anomaly).
          ================================ */}
      <section id="smartout-ai" className="px-6 py-20 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight lg:text-5xl">
              {VARIANT_AI_SECTION.T.heading}
            </h2>
            <p className="mx-auto max-w-2xl text-zinc-400">{VARIANT_AI_SECTION.T.subheading}</p>
          </motion.div>

          <div className="grid gap-10 lg:grid-cols-2">
            {/* Left: Enterprise-style table rows for AI capabilities */}
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
              <div className="flex items-center gap-2 border-b border-zinc-800 px-6 py-4">
                <Bot className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-semibold text-zinc-300">AI-funksjoner</span>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {VARIANT_AI_SECTION.T.capabilities.map((cap, i) => {
                  // Map each capability to an enterprise-appropriate icon
                  const CapIcon = [Shield, Database, AlertTriangle][i] ?? Shield;
                  return (
                    <motion.div
                      key={cap.title}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                      className="flex items-start gap-4 px-6 py-5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-500/10">
                        <CapIcon className="h-4 w-4 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-200">{cap.title}</h3>
                        <p className="text-sm text-zinc-500">{cap.description}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right: Voice demo widget */}
            <VoiceDemoWidget config={VARIANT_VOICE_CONFIG.T} height="400px" />
          </div>
        </div>
      </section>

      {/* ================================
          Section 8: CTA
          "Klar for en strukturert overgang?"
          Final conversion section with primary CTA button.
          ================================ */}
      <section className="px-6 py-20 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div {...fadeUp}>
            <Building2 className="mx-auto mb-6 h-10 w-10 text-slate-400" />
            <h2 className="mb-4 text-3xl font-bold tracking-tight lg:text-5xl">
              Klar for en strukturert overgang?
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-lg text-zinc-400">
              Se hvordan Smartout gir deg full kontroll over compliance, opplaering og revisjonsspor
              — pa tvers av alle lokasjoner.
            </p>
            <Link
              href={WEB_APP_LINKS.onboarding}
              onClick={() => trackCta("Book en teknisk demo")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-500 px-10 py-4 text-lg font-bold text-white transition-all hover:bg-slate-400"
            >
              Book en teknisk demo <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}
