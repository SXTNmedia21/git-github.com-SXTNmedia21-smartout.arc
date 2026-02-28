import {
  Rocket,
  UserPlus,
  CalendarDays,
  Users,
  ClipboardCheck,
  ShieldCheck,
  MessageSquare,
  Bot,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type DocSection = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  items: DocItem[];
};

export type DocItem = {
  title: string;
  href: string;
};

export const docsNavigation: DocSection[] = [
  {
    title: "Kom i gang",
    href: "/docs/kom-i-gang",
    icon: Rocket,
    description: "Opprett konto, konfigurer bedriften din, og bli klar på minutter.",
    items: [
      { title: "Opprett konto", href: "/docs/kom-i-gang#opprett-konto" },
      { title: "Konfigurer bedrift", href: "/docs/kom-i-gang#konfigurer-bedrift" },
      { title: "Opprett arbeidsplassen", href: "/docs/kom-i-gang#opprett-arbeidsplass" },
      { title: "Inviter ansatte", href: "/docs/kom-i-gang#inviter-ansatte" },
    ],
  },
  {
    title: "Onboarding",
    href: "/docs/onboarding",
    icon: UserPlus,
    description: "Slik gjør du nye ansatte klare for jobb fra dag én.",
    items: [
      { title: "Onboarding-flyten", href: "/docs/onboarding#onboarding-flyten" },
      { title: "Opplæringsplan", href: "/docs/onboarding#opplaeringsplan" },
      { title: "Dokumenter og signering", href: "/docs/onboarding#dokumenter" },
      { title: "Trainee-modus", href: "/docs/onboarding#trainee-modus" },
    ],
  },
  {
    title: "Vaktplan",
    href: "/docs/vaktplan",
    icon: CalendarDays,
    description: "Planlegg vakter, håndter bytter, og hold oversikt over timer.",
    items: [
      { title: "Lag en vaktplan", href: "/docs/vaktplan#lag-vaktplan" },
      { title: "Publiser og varsle", href: "/docs/vaktplan#publiser" },
      { title: "Vaktbytte", href: "/docs/vaktplan#vaktbytte" },
      { title: "Stemplingsur", href: "/docs/vaktplan#stemplingsur" },
      { title: "Timeregistrering", href: "/docs/vaktplan#timeregistrering" },
    ],
  },
  {
    title: "Ansatte",
    href: "/docs/ansatte",
    icon: Users,
    description: "Administrer ansatte, roller, avdelinger og team.",
    items: [
      { title: "Ansattoversikt", href: "/docs/ansatte#oversikt" },
      { title: "Roller og tilganger", href: "/docs/ansatte#roller" },
      { title: "Avdelinger", href: "/docs/ansatte#avdelinger" },
      { title: "Team", href: "/docs/ansatte#team" },
      { title: "Profiler og status", href: "/docs/ansatte#profiler" },
    ],
  },
  {
    title: "Oppgaver og Rutiner",
    href: "/docs/oppgaver-rutiner",
    icon: ClipboardCheck,
    description: "Daglige sesjoner, prosedyrer, sjekklister og rutiner.",
    items: [
      { title: "Daglig sesjon", href: "/docs/oppgaver-rutiner#daglig-sesjon" },
      { title: "Prosedyrer", href: "/docs/oppgaver-rutiner#prosedyrer" },
      { title: "Rutiner", href: "/docs/oppgaver-rutiner#rutiner" },
      { title: "Sjekklister", href: "/docs/oppgaver-rutiner#sjekklister" },
    ],
  },
  {
    title: "HACCP og Mattilsyn",
    href: "/docs/haccp",
    icon: ShieldCheck,
    description: "Internkontroll, temperaturlogging, og rapporter til Mattilsynet.",
    items: [
      { title: "IK-mat oppsett", href: "/docs/haccp#ik-mat" },
      { title: "Temperaturlogging", href: "/docs/haccp#temperatur" },
      { title: "Avviksbehandling", href: "/docs/haccp#avvik" },
      { title: "Mattilsynsrapporter", href: "/docs/haccp#rapporter" },
    ],
  },
  {
    title: "Kommunikasjon",
    href: "/docs/kommunikasjon",
    icon: MessageSquare,
    description: "Meldinger, varsler, og auto-oversettelse for hele teamet.",
    items: [
      { title: "Team-chat", href: "/docs/kommunikasjon#chat" },
      { title: "Varsler og påminnelser", href: "/docs/kommunikasjon#varsler" },
      { title: "Auto-oversettelse", href: "/docs/kommunikasjon#oversettelse" },
    ],
  },
  {
    title: "Lise AI Assistent",
    href: "/docs/ai-assistent",
    icon: Bot,
    description: "Snakk med Lise — din AI-drevne medarbeider.",
    items: [
      { title: "Hva er Lise?", href: "/docs/ai-assistent#hva-er-lise" },
      { title: "Spør Lise", href: "/docs/ai-assistent#spor-lise" },
      { title: "Stemmeassistent", href: "/docs/ai-assistent#stemme" },
    ],
  },
  {
    title: "Rapporter",
    href: "/docs/rapporter",
    icon: BarChart3,
    description: "Analyser og KPI-er for driften din.",
    items: [
      { title: "Dashboard-oversikt", href: "/docs/rapporter#dashboard" },
      { title: "Timeoversikt", href: "/docs/rapporter#timer" },
      { title: "Opplæringsstatus", href: "/docs/rapporter#opplaering" },
      { title: "Eksporter data", href: "/docs/rapporter#eksport" },
    ],
  },
  {
    title: "Innstillinger",
    href: "/docs/innstillinger",
    icon: Settings,
    description: "Tilpass SmartOut til din bedrift.",
    items: [
      { title: "Bedriftsinnstillinger", href: "/docs/innstillinger#bedrift" },
      { title: "Arbeidsplasser", href: "/docs/innstillinger#arbeidsplasser" },
      { title: "Integrasjoner", href: "/docs/innstillinger#integrasjoner" },
      { title: "Faktura og abonnement", href: "/docs/innstillinger#faktura" },
    ],
  },
];
