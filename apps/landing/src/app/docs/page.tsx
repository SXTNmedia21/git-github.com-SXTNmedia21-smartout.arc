import Link from "next/link";
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
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { DocsAgentPanel } from "./_components/docs-agent-panel";

type QuickCard = {
  title: string;
  icon: LucideIcon;
  color: string;
  href: string;
};

const quickCards: QuickCard[] = [
  {
    title: "Kom i gang",
    icon: Rocket,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    href: "/docs/kom-i-gang",
  },
  {
    title: "Onboarding",
    icon: UserPlus,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    href: "/docs/onboarding",
  },
  {
    title: "Kontakt oss",
    icon: MessageSquare,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    href: "/pricing",
  },
];

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
};

const features: Feature[] = [
  {
    icon: Rocket,
    title: "Kom i gang",
    description: "Opprett konto, konfigurer bedriften din, og bli klar på minutter",
    href: "/docs/kom-i-gang",
  },
  {
    icon: UserPlus,
    title: "Onboarding",
    description: "Trainee-modus, modulreiser, protokollopplæring og readiness score",
    href: "/docs/onboarding",
  },
  {
    icon: CalendarDays,
    title: "Vaktplan",
    description: "Tre visningsmodi, dra-og-slipp, maler, vaktbytte og stemplingsur",
    href: "/docs/vaktplan",
  },
  {
    icon: Users,
    title: "Ansatte",
    description: "Organisasjonsstruktur, profiler, roller og kompetansesporing",
    href: "/docs/ansatte",
  },
  {
    icon: ClipboardCheck,
    title: "Oppgaver og rutiner",
    description: "Driftsøkter, hooks, oppgavetyper, governance-kjede og signering",
    href: "/docs/oppgaver-rutiner",
  },
  {
    icon: ShieldCheck,
    title: "HACCP og Mattilsynet",
    description: "Temperaturlogging, avvikshåndtering, sertifiseringer og inspeksjonsklar",
    href: "/docs/haccp",
  },
  {
    icon: MessageSquare,
    title: "Kommunikasjon",
    description: "Chat med sanntidslevering, kunngjøringer, varslingssystem og eskalering",
    href: "/docs/kommunikasjon",
  },
  {
    icon: Bot,
    title: "Lise AI-assistent",
    description: "8 kapabiliteter, konfigurerbare autorisasjonsnivåer, stemme og hendelseslogg",
    href: "/docs/ai-assistent",
  },
  {
    icon: BarChart3,
    title: "Rapporter og avstemming",
    description: "Daglig avstemming, KPI-dashboard, sesongavstemming og rapporttyper",
    href: "/docs/rapporter",
  },
  {
    icon: Settings,
    title: "Innstillinger",
    description: "Konfigurering, abonnement, GDPR, språk og integrasjoner",
    href: "/docs/innstillinger",
  },
];

export default function DocsOverviewPage() {
  return (
    <div>
      {/* Title */}
      <h1 className="mb-3 text-4xl font-black tracking-tighter text-white md:text-5xl">
        Oversikt: SmartOut
      </h1>

      {/* Subtitle */}
      <div className="mb-10 rounded-xl border border-orange-500/20 bg-orange-500/5 px-5 py-3">
        <p className="text-base font-medium text-orange-300">
          Gjør ansatte klare for jobb — trent, compliant, utstyrt og informert fra dag én.
        </p>
      </div>

      {/* Quick action cards */}
      <div className="mb-12 grid grid-cols-3 gap-3">
        {quickCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`group flex flex-col items-center gap-2 rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg ${card.color}`}
          >
            <card.icon className="h-6 w-6" />
            <span className="text-sm font-bold text-white">{card.title}</span>
          </Link>
        ))}
      </div>

      {/* Key features */}
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-white">Moduler</h2>

      <div className="mb-12 space-y-0">
        {features.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group -mx-3 flex items-start gap-4 rounded-lg border-b border-white/5 px-3 py-4 transition-colors last:border-b-0 hover:bg-white/[0.02]"
          >
            <feature.icon className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500 transition-colors group-hover:text-orange-400" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-white transition-colors group-hover:text-orange-300">
                {feature.title}
              </span>
              <span className="mx-2 text-zinc-500">→</span>
              <span className="text-sm text-zinc-400">{feature.description}</span>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-700 opacity-0 transition-all group-hover:text-orange-400 group-hover:opacity-100" />
          </Link>
        ))}
      </div>

      {/* Separator */}
      <hr className="mb-10 border-white/5" />

      {/* Docs agent */}
      <DocsAgentPanel />

      {/* Help */}
      <div className="mt-12 border-t border-white/5 pt-6">
        <p className="text-sm text-zinc-600">
          Finner du ikke det du leter etter?{" "}
          <Link
            href="/pricing"
            className="font-medium text-orange-400 transition-colors hover:text-orange-300"
          >
            Ta kontakt med oss
          </Link>
          , så hjelper vi deg.
        </p>
      </div>
    </div>
  );
}
