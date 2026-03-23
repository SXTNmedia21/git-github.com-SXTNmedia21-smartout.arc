// ============================================
// page.tsx
// Full-page competitor comparison matrix.
//
// Why: the free-forever campaign needs hard proof
// that Smartout Free delivers more than competitors'
// paid plans. This page is the evidence wall —
// 68 feature points across 11 categories with
// real pricing data from 12 competitors.
//
// Connected to: apps/landing/src/app/free-forever/page.tsx
// ============================================

"use client";

import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { useState, useMemo, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  Filter,
  Minus,
  Sparkles,
  X,
} from "lucide-react";
import { FullTracker, TrackedCta } from "../../components/tracking";
import { WEB_APP_LINKS } from "../../lib/web-app-url";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

// ── Competitor definitions ────────────────────────

type CompetitorId =
  | "smartout"
  | "planday"
  | "7shifts"
  | "homebase"
  | "wheniwork"
  | "fork"
  | "tidsbanken"
  | "timegrip"
  | "runwell"
  | "connecteam"
  | "smartplan"
  | "workfeed"
  | "powerplan";

type Competitor = {
  id: CompetitorId;
  name: string;
  country: string;
  pricingModel: string;
  freePrice: string;
  lowestPaid: string;
  midPaid: string;
  topPaid: string;
  /** What a typical 20-person, 1-location restaurant pays for comparable features */
  typicalCost: string;
  color: string;
  website: string;
};

const competitors: Competitor[] = [
  {
    id: "smartout",
    name: "Smartout",
    country: "Norge",
    pricingModel: "Flat / restaurang",
    freePrice: "0 kr",
    lowestPaid: "995 NOK/mnd",
    midPaid: "2 500 NOK/mnd",
    topPaid: "Custom",
    typicalCost: "0 kr",
    color: "text-orange-400",
    website: "smartout.ai",
  },
  {
    id: "planday",
    name: "Planday",
    country: "Danmark / UK",
    pricingModel: "Per ansatt / mnd",
    freePrice: "Ingen",
    lowestPaid: "45 NOK/bruker/mnd",
    midPaid: "~75 NOK/bruker/mnd",
    topPaid: "Custom",
    typicalCost: "~900 NOK/mnd",
    color: "text-blue-400",
    website: "planday.com",
  },
  {
    id: "7shifts",
    name: "7shifts",
    country: "USA / Canada",
    pricingModel: "Per location / mnd",
    freePrice: "Gratis (30 pers, 1 loc)",
    lowestPaid: "$29.99/loc/mnd",
    midPaid: "$69.99/loc/mnd",
    topPaid: "$135/loc/mnd",
    typicalCost: "~330 NOK/mnd",
    color: "text-green-400",
    website: "7shifts.com",
  },
  {
    id: "homebase",
    name: "Homebase",
    country: "USA",
    pricingModel: "Per location / mnd",
    freePrice: "Gratis (10 pers, 1 loc)",
    lowestPaid: "$30/loc/mnd",
    midPaid: "$70/loc/mnd",
    topPaid: "$120/loc/mnd",
    typicalCost: "~330 NOK/mnd",
    color: "text-purple-400",
    website: "joinhomebase.com",
  },
  {
    id: "wheniwork",
    name: "When I Work",
    country: "USA",
    pricingModel: "Per ansatt / mnd",
    freePrice: "Ingen",
    lowestPaid: "$2.50/bruker/mnd",
    midPaid: "$5/bruker/mnd",
    topPaid: "$8/bruker/mnd",
    typicalCost: "~540 NOK/mnd",
    color: "text-cyan-400",
    website: "wheniwork.com",
  },
  {
    id: "fork",
    name: "Fork",
    country: "USA",
    pricingModel: "Per location / mnd",
    freePrice: "Ingen",
    lowestPaid: "$39/loc/mnd",
    midPaid: "$79/loc/mnd",
    topPaid: "$129/loc/mnd",
    typicalCost: "~430 NOK/mnd",
    color: "text-rose-400",
    website: "forkhr.com",
  },
  {
    id: "tidsbanken",
    name: "Tidsbanken",
    country: "Norge",
    pricingModel: "Tilpasset tilbud",
    freePrice: "Ingen",
    lowestPaid: "Tilpasset",
    midPaid: "Tilpasset",
    topPaid: "Tilpasset",
    typicalCost: "~1 000+ NOK/mnd",
    color: "text-teal-400",
    website: "tidsbanken.no",
  },
  {
    id: "timegrip",
    name: "Timegrip",
    country: "Norge / Norden",
    pricingModel: "Per avdeling / mnd",
    freePrice: "Ingen",
    lowestPaid: "990 NOK/avd/mnd",
    midPaid: "Tilpasset",
    topPaid: "Tilpasset",
    typicalCost: "~990 NOK/mnd",
    color: "text-indigo-400",
    website: "timegrip.no",
  },
  {
    id: "runwell",
    name: "Runwell",
    country: "Norge",
    pricingModel: "Per lokasjon / mnd",
    freePrice: "30 dager prøve",
    lowestPaid: "349 NOK/loc/mnd",
    midPaid: "Tilpasset",
    topPaid: "Custom",
    typicalCost: "~940 NOK/mnd",
    color: "text-lime-400",
    website: "runwell.app",
  },
  {
    id: "connecteam",
    name: "Connecteam",
    country: "USA / Global",
    pricingModel: "Per bruker / mnd",
    freePrice: "Gratis (10 pers)",
    lowestPaid: "$35/bruker/mnd",
    midPaid: "$59/bruker/mnd",
    topPaid: "$110/bruker/mnd",
    typicalCost: "~7 600 NOK/mnd",
    color: "text-amber-400",
    website: "connecteam.com",
  },
  {
    id: "smartplan",
    name: "Smartplan",
    country: "Norge / Norden",
    pricingModel: "Fast + per ansatt / mnd",
    freePrice: "Ingen",
    lowestPaid: "199 NOK + 15/ans/mnd",
    midPaid: "399 NOK + 20/ans/mnd",
    topPaid: "499 NOK + 30/ans/mnd",
    typicalCost: "~500–1 100 NOK/mnd",
    color: "text-sky-400",
    website: "smartplanapp.com",
  },
  {
    id: "workfeed",
    name: "Workfeed",
    country: "Danmark / Norden",
    pricingModel: "Per bruker / mnd",
    freePrice: "Gratis (500 vakter)",
    lowestPaid: "~24 NOK/bruker/mnd",
    midPaid: "~32 NOK/bruker/mnd",
    topPaid: "Tilpasset",
    typicalCost: "~480–640 NOK/mnd",
    color: "text-violet-400",
    website: "workfeed.io",
  },
  {
    id: "powerplan",
    name: "PowerPlan",
    country: "Norge / Norden",
    pricingModel: "Per ansatt / mnd",
    freePrice: "1 mnd gratis",
    lowestPaid: "~55 NOK/ans/mnd",
    midPaid: "~55 NOK/ans/mnd",
    topPaid: "~55 NOK/ans/mnd",
    typicalCost: "~1 100 NOK/mnd",
    color: "text-fuchsia-400",
    website: "powerplan.io",
  },
];

// ── Feature matrix data ───────────────────────────

type FeatureValue = true | false | string;

type Feature = {
  name: string;
  /** Tooltip or extra context shown on hover */
  note?: string;
  values: Record<CompetitorId, FeatureValue>;
};

type Category = {
  id: string;
  name: string;
  icon: string;
  features: Feature[];
};

/**
 * Helper: shorthand for a paid-tier lock label.
 * Shows which plan and price is required to unlock the feature.
 */
function paid(plan: string): string {
  return plan;
}

const categories: Category[] = [
  {
    id: "scheduling",
    name: "Schema & planlegging",
    icon: "📅",
    features: [
      {
        name: "Vaktplan / drag-and-drop",
        values: {
          smartout: true,
          planday: true,
          "7shifts": true,
          homebase: true,
          wheniwork: true,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: false,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Skiftmaler / templates",
        values: {
          smartout: true,
          planday: paid("Plus ~75 NOK/u"),
          "7shifts": paid("Entrée $30"),
          homebase: paid("Ess. $30"),
          wheniwork: true,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: false,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Flerukersplanlegging",
        values: {
          smartout: true,
          planday: true,
          "7shifts": true,
          homebase: false,
          wheniwork: true,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: false,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Åpne skift / OpenShifts",
        values: {
          smartout: true,
          planday: true,
          "7shifts": true,
          homebase: false,
          wheniwork: true,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: false,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Skiftbytte mellom ansatte",
        values: {
          smartout: true,
          planday: true,
          "7shifts": true,
          homebase: paid("Ess. $30"),
          wheniwork: true,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: false,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Tilgjengelighet og fravær",
        values: {
          smartout: true,
          planday: paid("Plus ~75 NOK/u"),
          "7shifts": true,
          homebase: paid("Ess. $30"),
          wheniwork: true,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: false,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Multi-location støtte",
        values: {
          smartout: true,
          planday: true,
          "7shifts": paid("Kun 1 loc gratis"),
          homebase: paid("Kun 1 loc gratis"),
          wheniwork: true,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: true,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Arbeidsbudsjett / labor cost",
        values: {
          smartout: paid("Pro"),
          planday: paid("Plus ~75 NOK/u"),
          "7shifts": paid("Entrée $30"),
          homebase: paid("All-in-One $120"),
          wheniwork: paid("Pro $5/u"),
          fork: paid("Pro $79"),
          tidsbanken: true,
          timegrip: "Tilpasset",
          runwell: false,
          connecteam: paid("Advanced $59/u"),
          smartplan: paid("Pro 499+30/u"),
          workfeed: paid("Pro ~32/u"),
          powerplan: false,
        },
      },
    ],
  },
  {
    id: "time",
    name: "Tid & oppmøte",
    icon: "⏱️",
    features: [
      {
        name: "Stemplingsur / punch clock",
        values: {
          smartout: true,
          planday: true,
          "7shifts": true,
          homebase: true,
          wheniwork: paid("+$1.50/u tillegg"),
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: "Via Planday",
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "GPS / lokasjonskontroll",
        values: {
          smartout: true,
          planday: paid("Plus ~75 NOK/u"),
          "7shifts": false,
          homebase: paid("Ess. $30"),
          wheniwork: paid("+tillegg"),
          fork: true,
          tidsbanken: false,
          timegrip: true,
          runwell: false,
          connecteam: true,
          smartplan: true,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Overtidsvarsler",
        values: {
          smartout: true,
          planday: true,
          "7shifts": false,
          homebase: paid("All-in-One $120"),
          wheniwork: false,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: false,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Pauseregistrering",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: false,
          connecteam: true,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Grunnleggende lønnsrapport",
        values: {
          smartout: true,
          planday: true,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: false,
          connecteam: false,
          smartplan: true,
          workfeed: true,
          powerplan: false,
        },
      },
    ],
  },
  {
    id: "employees",
    name: "Ansatte & HR",
    icon: "👥",
    features: [
      {
        name: "Ansattoversikt / profiler",
        values: {
          smartout: true,
          planday: true,
          "7shifts": "Maks 30",
          homebase: "Maks 10",
          wheniwork: true,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: true,
          connecteam: "Maks 10",
          smartplan: "10 inkl.",
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Ubegrenset antall ansatte",
        note: "I gratis plan",
        values: {
          smartout: true,
          planday: "Min 5 (betalt)",
          "7shifts": false,
          homebase: false,
          wheniwork: "Betalt",
          fork: "Betalt",
          tidsbanken: "Betalt",
          timegrip: "Betalt",
          runwell: "5 inkl. (39/ekstra)",
          connecteam: false,
          smartplan: "10 inkl. (+15/u)",
          workfeed: "Betalt",
          powerplan: "Betalt",
        },
      },
      {
        name: "Digital kontraktshåndtering",
        values: {
          smartout: true,
          planday: paid("Plus docs"),
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: true,
          runwell: false,
          connecteam: paid("Advanced $59/u"),
          smartplan: paid("Basic 399+20/u"),
          workfeed: paid("Pro ~32/u"),
          powerplan: false,
        },
      },
      {
        name: "E-signering av kontrakter",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: paid("Pro $79"),
          tidsbanken: false,
          timegrip: true,
          runwell: false,
          connecteam: paid("Expert $110/u"),
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Automatisert onboarding",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: paid("All-in-One $120"),
          wheniwork: false,
          fork: paid("Pro $79"),
          tidsbanken: false,
          timegrip: false,
          runwell: true,
          connecteam: paid("Advanced $59/u"),
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Roller og tilgangsstyring",
        values: {
          smartout: true,
          planday: true,
          "7shifts": true,
          homebase: paid("Plus $70"),
          wheniwork: paid("Pro $5/u"),
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: true,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Avdelinger og team",
        values: {
          smartout: true,
          planday: true,
          "7shifts": true,
          homebase: paid("Plus $70"),
          wheniwork: true,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: true,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Kompetanseregistrering",
        values: {
          smartout: true,
          planday: paid("Plus ~75 NOK/u"),
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: true,
          connecteam: paid("Advanced $59/u"),
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
    ],
  },
  {
    id: "compliance",
    name: "Compliance & regelverk",
    icon: "🛡️",
    features: [
      {
        name: "Arbeidstidsregler og varsler",
        values: {
          smartout: true,
          planday: true,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: false,
          connecteam: false,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "IK-mat / HACCP grunnleggende",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: true,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Rutiner og sjekklister (SOP)",
        values: {
          smartout: true,
          planday: false,
          "7shifts": paid("Gourmet $135"),
          homebase: false,
          wheniwork: false,
          fork: paid("Premium $129"),
          tidsbanken: false,
          timegrip: false,
          runwell: true,
          connecteam: true,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Policyer og personalhåndbok",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: paid("Advanced $59/u"),
          smartplan: false,
          workfeed: paid("Pro+ tilpasset"),
          powerplan: false,
        },
      },
      {
        name: "Kunnskapstest",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: "Kurs (20+)",
          connecteam: paid("Advanced $59/u"),
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Norsk arbeidsmiljølov-støtte",
        values: {
          smartout: true,
          planday: "Delvis",
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: true,
          timegrip: true,
          runwell: true,
          connecteam: false,
          smartplan: true,
          workfeed: false,
          powerplan: true,
        },
      },
      {
        name: "Avvikshåndtering",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: paid("Premium $129"),
          tidsbanken: false,
          timegrip: false,
          runwell: true,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Temperaturovervåking",
        note: "Automatisk overvåking av kjøleskap/frysere med varsling",
        values: {
          smartout: paid("Pro"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: true,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
    ],
  },
  {
    id: "communication",
    name: "Kommunikasjon",
    icon: "💬",
    features: [
      {
        name: "Teamkommunikasjon / chat",
        values: {
          smartout: true,
          planday: true,
          "7shifts": paid("Entrée $30"),
          homebase: paid("Ess. $30"),
          wheniwork: true,
          fork: true,
          tidsbanken: false,
          timegrip: true,
          runwell: true,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Auto-oversettelse",
        note: "Automatisk oversettelse av meldinger mellom språk",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Push-varsler",
        values: {
          smartout: true,
          planday: true,
          "7shifts": true,
          homebase: true,
          wheniwork: true,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: true,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
    ],
  },
  {
    id: "website",
    name: "Nettside for restauranten",
    icon: "🌐",
    features: [
      {
        name: "Egen restaurantnettside",
        note: "Inkludert i systemet — ingen ekstern tjeneste nødvendig",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Menyvisning online",
        values: {
          smartout: paid("Pro"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Standard website med maler",
        values: {
          smartout: paid("Pro"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Advanced multipage nettsted",
        values: {
          smartout: paid("Enterprise"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Eget domenenavn",
        values: {
          smartout: paid("Enterprise"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
    ],
  },
  {
    id: "ai",
    name: "AI & automasjon",
    icon: "🤖",
    features: [
      {
        name: "AI-assistent for ansatte og ledere",
        note: "Smartouts Lise AI Botsson — trent på din bedrifts rutiner",
        values: {
          smartout: paid("Premium 995 NOK"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: paid("Premium $129"),
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "AI-vaktforslag / auto-scheduling",
        values: {
          smartout: paid("Premium 995 NOK"),
          planday: paid("Pro custom"),
          "7shifts": paid("Gourmet $135"),
          homebase: paid("Plus $70"),
          wheniwork: true,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: paid("Advanced $59/u"),
          smartplan: true,
          workfeed: paid("Pro ~32/u"),
          powerplan: true,
        },
      },
      {
        name: "AI-sammendrag av drift",
        values: {
          smartout: paid("Premium 995 NOK"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "AI-drevet onboarding",
        values: {
          smartout: paid("Premium 995 NOK"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Toggle betalfunksjoner av/på",
        note: "Slå AI og automasjon av og på med ett klikk, uten å bytte plan",
        values: {
          smartout: paid("Premium 995 NOK"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Etterspørselsprognose",
        values: {
          smartout: paid("Pro"),
          planday: paid("Plus ~75 NOK/u"),
          "7shifts": false,
          homebase: false,
          wheniwork: paid("Pro $5/u"),
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Sesongplanlegging med AI",
        values: {
          smartout: paid("Pro"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
    ],
  },
  {
    id: "integrations",
    name: "Integrasjoner & lønn",
    icon: "🔗",
    features: [
      {
        name: "POS-integrasjon",
        values: {
          smartout: paid("Pro"),
          planday: paid("Plus ~75 NOK/u"),
          "7shifts": paid("Entrée $30"),
          homebase: true,
          wheniwork: true,
          fork: paid("Pro $79"),
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: paid("Pro 499+30/u"),
          workfeed: true,
          powerplan: false,
        },
      },
      {
        name: "Lønnssystem-integrasjon",
        values: {
          smartout: paid("Pro"),
          planday: paid("Plus ~75 NOK/u"),
          "7shifts": false,
          homebase: paid("Tillegg $39+/mnd"),
          wheniwork: true,
          fork: paid("Pro $79"),
          tidsbanken: true,
          timegrip: true,
          runwell: "Via Planday",
          connecteam: paid("Advanced $59/u"),
          smartplan: paid("Basic 399+20/u"),
          workfeed: true,
          powerplan: false,
        },
      },
      {
        name: "Tripletex-integrasjon",
        note: "Norsk regnskapssystem",
        values: {
          smartout: paid("Pro"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: true,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "API-tilgang",
        values: {
          smartout: paid("Enterprise"),
          planday: paid("Plus ~75 NOK/u"),
          "7shifts": paid("Works $70"),
          homebase: paid("All-in-One $120"),
          wheniwork: paid("Premium $8/u"),
          fork: false,
          tidsbanken: true,
          timegrip: false,
          runwell: true,
          connecteam: paid("Expert $110/u"),
          smartplan: paid("Pro 499+30/u"),
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "SSO / SAML",
        values: {
          smartout: paid("Enterprise"),
          planday: paid("Pro custom"),
          "7shifts": false,
          homebase: false,
          wheniwork: paid("Premium $8/u"),
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: paid("Expert $110/u"),
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
    ],
  },
  {
    id: "reports",
    name: "Rapporter & analyse",
    icon: "📊",
    features: [
      {
        name: "Grunnrapporter",
        values: {
          smartout: true,
          planday: true,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: false,
          connecteam: false,
          smartplan: true,
          workfeed: true,
          powerplan: false,
        },
      },
      {
        name: "Personalkostnadsrapport",
        values: {
          smartout: paid("Pro"),
          planday: paid("Plus ~75 NOK/u"),
          "7shifts": paid("Entrée $30"),
          homebase: paid("All-in-One $120"),
          wheniwork: false,
          fork: paid("Pro $79"),
          tidsbanken: true,
          timegrip: "Tilpasset",
          runwell: false,
          connecteam: paid("Advanced $59/u"),
          smartplan: paid("Pro 499+30/u"),
          workfeed: paid("Pro ~32/u"),
          powerplan: false,
        },
      },
      {
        name: "KPI-er og dashboards",
        values: {
          smartout: paid("Pro"),
          planday: paid("Pro custom"),
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Sesonganalyser",
        values: {
          smartout: paid("Pro"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
    ],
  },
  {
    id: "mobile",
    name: "Mobilapp & opplevelse",
    icon: "📱",
    features: [
      {
        name: "Mobilapp (iOS + Android)",
        values: {
          smartout: true,
          planday: true,
          "7shifts": true,
          homebase: true,
          wheniwork: true,
          fork: true,
          tidsbanken: true,
          timegrip: true,
          runwell: true,
          connecteam: true,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Dark mode",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Flerspråklig plattform",
        values: {
          smartout: true,
          planday: "Delvis",
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: "Norden",
          runwell: false,
          connecteam: true,
          smartplan: "Norden",
          workfeed: "Norden",
          powerplan: "NO + EN",
        },
      },
      {
        name: "Norsk språk (native)",
        values: {
          smartout: true,
          planday: true,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: true,
          timegrip: true,
          runwell: true,
          connecteam: false,
          smartplan: true,
          workfeed: true,
          powerplan: true,
        },
      },
      {
        name: "Gamification / poeng",
        values: {
          smartout: paid("Premium 995 NOK"),
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
    ],
  },
  {
    id: "pricing",
    name: "Pris & modell",
    icon: "💰",
    features: [
      {
        name: "Gratis plan med alle kjernefunksjoner",
        values: {
          smartout: true,
          planday: false,
          "7shifts": "Delvis (30 pers)",
          homebase: "Delvis (10 pers)",
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: "Delvis (10 pers)",
          smartplan: false,
          workfeed: "500 vakter",
          powerplan: false,
        },
      },
      {
        name: "Ingen per-ansatt-kostnad",
        values: {
          smartout: true,
          planday: false,
          "7shifts": true,
          homebase: true,
          wheniwork: false,
          fork: true,
          tidsbanken: false,
          timegrip: true,
          runwell: "5 inkl.",
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Slå betalfunksjoner av/på",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: false,
          timegrip: false,
          runwell: false,
          connecteam: false,
          smartplan: false,
          workfeed: false,
          powerplan: false,
        },
      },
      {
        name: "Bygget for norsk marked",
        values: {
          smartout: true,
          planday: false,
          "7shifts": false,
          homebase: false,
          wheniwork: false,
          fork: false,
          tidsbanken: true,
          timegrip: true,
          runwell: true,
          connecteam: false,
          smartplan: true,
          workfeed: false,
          powerplan: true,
        },
      },
    ],
  },
];

// ── Cell renderer ─────────────────────────────────

/**
 * Renders a single cell in the comparison matrix.
 * true = green check, false = red dash, string = paid-tier label.
 */
function CellValue({ value, isSmartout }: { value: FeatureValue; isSmartout: boolean }) {
  if (value === true) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full ${isSmartout ? "bg-emerald-500/20" : "bg-emerald-500/10"}`}
        style={{ width: 28, height: 28 }}
      >
        <Check className={`h-4 w-4 ${isSmartout ? "text-emerald-400" : "text-emerald-500/70"}`} />
      </span>
    );
  }
  if (value === false) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-white/5"
        style={{ width: 28, height: 28 }}
      >
        <Minus className="h-3.5 w-3.5 text-zinc-600" />
      </span>
    );
  }
  return (
    <span className="text-muted-foreground inline-block max-w-[7rem] text-center text-xs leading-tight">
      {value}
    </span>
  );
}

// ── Section label ─────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-brand-orange text-sm font-semibold tracking-[0.18em] uppercase">
      {children}
    </p>
  );
}

// ── Main page ─────────────────────────────────────

export default function ComparePage() {
  const allCompetitorIds = competitors.map((c) => c.id);
  const [visibleCompetitors, setVisibleCompetitors] = useState<CompetitorId[]>(allCompetitorIds);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id)),
  );
  const [filterOpen, setFilterOpen] = useState(false);

  const visibleCompetitorObjects = useMemo(
    () => competitors.filter((c) => visibleCompetitors.includes(c.id)),
    [visibleCompetitors],
  );

  function toggleCompetitor(id: CompetitorId) {
    if (id === "smartout") return;
    setVisibleCompetitors((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function toggleCategory(id: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Count how many features Smartout Free includes that a competitor charges for */
  function countSmartoutWins(competitorId: CompetitorId): number {
    let wins = 0;
    for (const cat of categories) {
      for (const feat of cat.features) {
        const sv = feat.values.smartout;
        const cv = feat.values[competitorId];
        if (sv === true && cv !== true) wins++;
      }
    }
    return wins;
  }

  const totalFeatures = categories.reduce((sum, cat) => sum + cat.features.length, 0);

  return (
    <div className="bg-background text-foreground relative min-h-screen overflow-x-hidden">
      <FullTracker />

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(1_0_0/0.05),transparent_40%)]" />
        <div className="bg-brand-orange/8 absolute top-0 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.02)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-border/80 bg-background/80 sticky top-0 z-20 border-b backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-foreground flex items-center gap-3">
              <div className="border-border bg-card flex h-10 w-10 items-center justify-center rounded-2xl border">
                <Building2 className="text-brand-orange h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight">Smartout</p>
                <p className="text-muted-foreground text-xs">vs konkurrentene</p>
              </div>
            </Link>

            <div className="hidden items-center gap-3 sm:flex">
              <Link
                href="/free-forever"
                className="border-border text-muted-foreground hover:border-brand-orange/40 hover:text-foreground rounded-full border px-4 py-2 text-sm font-medium transition"
              >
                Se priser
              </Link>
              <TrackedCta
                label="Compare CTA start free"
                href={WEB_APP_LINKS.login}
                className="bg-primary text-primary-foreground rounded-full px-5 py-2 text-sm font-semibold transition hover:opacity-95"
              >
                Start gratis
              </TrackedCta>
            </div>
          </div>
        </header>

        <main>
          {/* Hero */}
          <section className="mx-auto max-w-7xl px-6 pt-16 pb-12 sm:pt-24">
            <div className="border-brand-orange/20 bg-brand-orange/10 text-brand-orange inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              {totalFeatures} funksjoner sammenlignet
            </div>

            <h1
              className={`${instrumentSerif.className} text-foreground mt-6 max-w-4xl text-4xl leading-[0.95] tracking-tight sm:text-5xl lg:text-7xl`}
            >
              Se hva andre tar betalt for. Og hva Smartout gir deg gratis.
            </h1>

            <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
              Smartout Free inkluderer alt du trenger for å drive restaurang — vaktplan,
              stemplingsur, kontrakter, onboarding, compliance, kommunikasjon og en egen nettside.
              Funksjoner som konkurrentene tar betalt for fra dag én.
            </p>
          </section>

          {/* Cost comparison cards */}
          <section className="mx-auto max-w-7xl px-6 pb-16">
            <SectionLabel>Typisk kostnad — 20 ansatte, 1 lokasjon</SectionLabel>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {competitors.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-2xl border p-5 transition ${
                    c.id === "smartout"
                      ? "border-brand-orange/40 bg-brand-orange/10"
                      : "border-border bg-card/90"
                  }`}
                >
                  <p className={`text-sm font-semibold ${c.color}`}>{c.name}</p>
                  <p className="text-foreground mt-2 text-2xl font-bold tracking-tight">
                    {c.typicalCost}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">{c.pricingModel}</p>
                  {c.id !== "smartout" && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      Smartout gratis inkluderer{" "}
                      <strong className="text-brand-orange">{countSmartoutWins(c.id)}</strong>{" "}
                      funksjoner de tar betalt for
                    </p>
                  )}
                  {c.id === "smartout" && (
                    <p className="text-brand-orange mt-2 text-xs font-medium">
                      Gratis — ubegrenset ansatte
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Filter toolbar */}
          <section className="border-border/50 bg-background/90 sticky top-[65px] z-10 border-y backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="border-border text-foreground hover:border-brand-orange/30 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtrer konkurrenter
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${filterOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {visibleCompetitors.length < allCompetitorIds.length && (
                  <button
                    onClick={() => setVisibleCompetitors(allCompetitorIds)}
                    className="text-muted-foreground hover:text-foreground text-xs transition"
                  >
                    Vis alle
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setExpandedCategories(new Set(categories.map((c) => c.id)))}
                  className="text-muted-foreground hover:text-foreground text-xs transition"
                >
                  Utvid alle
                </button>
                <button
                  onClick={() => setExpandedCategories(new Set())}
                  className="text-muted-foreground hover:text-foreground text-xs transition"
                >
                  Lukk alle
                </button>
              </div>
            </div>

            {filterOpen && (
              <div className="border-border/50 mx-auto max-w-7xl border-t px-6 py-3">
                <div className="flex flex-wrap gap-2">
                  {competitors.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => toggleCompetitor(c.id)}
                      disabled={c.id === "smartout"}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        visibleCompetitors.includes(c.id)
                          ? c.id === "smartout"
                            ? "border-brand-orange/40 bg-brand-orange/15 text-brand-orange cursor-default"
                            : "border-border bg-card text-foreground hover:border-brand-orange/30"
                          : "border-border/50 text-muted-foreground hover:border-border bg-transparent"
                      }`}
                    >
                      {c.name}
                      {c.id !== "smartout" && visibleCompetitors.includes(c.id) && (
                        <X className="h-3 w-3" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Comparison matrix */}
          <section className="mx-auto max-w-7xl px-6 py-12">
            <div className="space-y-6">
              {categories.map((category) => {
                const isExpanded = expandedCategories.has(category.id);

                return (
                  <div
                    key={category.id}
                    className="border-border bg-card/60 overflow-hidden rounded-2xl border backdrop-blur"
                  >
                    {/* Category header */}
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="text-foreground flex w-full items-center justify-between px-6 py-5 text-left transition hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{category.icon}</span>
                        <h3 className="text-lg font-semibold tracking-tight">{category.name}</h3>
                        <span className="text-muted-foreground text-sm">
                          {category.features.length} funksjoner
                        </span>
                      </div>
                      <ChevronDown
                        className={`text-muted-foreground h-5 w-5 transition ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px]">
                          <thead>
                            <tr className="border-border/50 border-t">
                              <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                                Funksjon
                              </th>
                              {visibleCompetitorObjects.map((c) => (
                                <th
                                  key={c.id}
                                  className={`px-3 py-3 text-center text-xs font-medium tracking-wider uppercase ${c.color}`}
                                >
                                  {c.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {category.features.map((feature, fi) => (
                              <tr
                                key={feature.name}
                                className={`border-border/30 border-t transition hover:bg-white/[0.02] ${
                                  fi % 2 === 0 ? "bg-white/[0.01]" : ""
                                }`}
                              >
                                <td className="px-6 py-3.5">
                                  <span className="text-foreground text-sm font-medium">
                                    {feature.name}
                                  </span>
                                  {feature.note && (
                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                      {feature.note}
                                    </p>
                                  )}
                                </td>
                                {visibleCompetitorObjects.map((c) => (
                                  <td key={c.id} className="px-3 py-3.5 text-center">
                                    <CellValue
                                      value={feature.values[c.id]}
                                      isSmartout={c.id === "smartout"}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Pricing tier summary */}
          <section className="mx-auto max-w-7xl px-6 py-16">
            <div className="border-border bg-card/85 rounded-[2.25rem] border p-8 shadow-[0_24px_90px_-55px_rgba(0,0,0,0.55)]">
              <SectionLabel>Konklusjon</SectionLabel>
              <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Smartout Free gir deg mer enn konkurrentenes betalte planer.
              </h2>
              <p className="text-muted-foreground mt-4 max-w-3xl text-base leading-7">
                Planday Starter koster 900 NOK/mnd for 20 ansatte, og mangler kontrakter,
                onboarding, HACCP, nettside og auto-oversettelse. Timegrip starter på 990 NOK/mnd
                for én avdeling. Tidsbanken krever tilpasset tilbud uten gratis alternativ. Runwell
                koster 349 NOK/lok pluss 39 NOK per ekstra bruker. Connecteam tar $35/bruker/mnd —
                det er over 7 600 NOK for 20 ansatte.
              </p>
              <p className="text-foreground mt-4 max-w-3xl text-base leading-7 font-medium">
                Smartout Free har alt dette inkludert. Gratis. Uten begrensning på antall ansatte.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <TrackedCta
                  label="Compare bottom CTA start"
                  href={WEB_APP_LINKS.login}
                  className="bg-primary text-primary-foreground inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition hover:opacity-95"
                >
                  Start gratis nå
                  <ArrowRight className="h-4 w-4" />
                </TrackedCta>
                <Link
                  href="/free-forever"
                  className="border-border text-foreground hover:border-brand-orange/30 hover:text-brand-orange inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 py-3 text-base font-semibold transition"
                >
                  Se alle pakker
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-border/80 bg-background/90 border-t">
          <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-foreground font-medium">Smartout er alltid gratis i Core.</p>
              <p className="mt-1">
                Priser og funksjoner for konkurrenter er hentet fra deres offentlige nettsider (mars
                2026).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/personvern" className="hover:text-foreground transition">
                Personvern
              </Link>
              <Link href="/vilkar" className="hover:text-foreground transition">
                Vilkår
              </Link>
              <TrackedCta
                label="Compare footer CTA"
                href={WEB_APP_LINKS.login}
                className="border-border text-foreground hover:border-brand-orange/30 hover:text-brand-orange rounded-full border px-4 py-2 font-medium transition"
              >
                Start gratis
              </TrackedCta>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
