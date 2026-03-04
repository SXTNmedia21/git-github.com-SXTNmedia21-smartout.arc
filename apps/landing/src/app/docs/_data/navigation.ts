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
      { title: "Tre visningsmodi", href: "/docs/vaktplan#visningsmodi" },
      { title: "Dra-og-slipp", href: "/docs/vaktplan#dra-og-slipp" },
      { title: "Vaktbytte", href: "/docs/vaktplan#vaktbytte" },
      { title: "Stemplingsur", href: "/docs/vaktplan#stemplingsur" },
      { title: "Arbeidsrett", href: "/docs/vaktplan#arbeidsrett" },
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
    description: "Chat, varsler, kunngjøringer, eskalering og stille timer.",
    items: [
      { title: "Chat", href: "/docs/kommunikasjon#chat" },
      { title: "Kunngjøringer", href: "/docs/kommunikasjon#kunngjoeringer" },
      { title: "Varslingssystem", href: "/docs/kommunikasjon#varsling" },
      { title: "Eskalering", href: "/docs/kommunikasjon#eskalering" },
      { title: "Stille timer", href: "/docs/kommunikasjon#stille-timer" },
    ],
  },
  {
    title: "Lise AI Assistent",
    href: "/docs/ai-assistent",
    icon: Bot,
    description: "8 kapabiliteter, autorisasjonsnivåer, stemme og hendelseslogg.",
    items: [
      { title: "Hvem er Lise?", href: "/docs/ai-assistent#hvem-er-lise" },
      { title: "Kapabiliteter", href: "/docs/ai-assistent#kapabiliteter" },
      { title: "Autorisasjon", href: "/docs/ai-assistent#autorisasjon" },
      { title: "Stemme", href: "/docs/ai-assistent#stemme" },
    ],
  },
  {
    title: "Rapporter",
    href: "/docs/rapporter",
    icon: BarChart3,
    description: "Daglig avstemming, KPI-dashboard, sesongavstemming og rapporttyper.",
    items: [
      { title: "Tre nivåer", href: "/docs/rapporter#tre-nivaer" },
      { title: "Daglig avstemming", href: "/docs/rapporter#daglig" },
      { title: "KPI-dashboard", href: "/docs/rapporter#kpi" },
      { title: "Rapporttyper", href: "/docs/rapporter#rapporttyper" },
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
