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

type QuickCard = {
  title: string;
  icon: LucideIcon;
  color: string;
  href: string;
};

const quickCards: QuickCard[] = [
  {
    title: "Getting started",
    icon: Rocket,
    color: "text-brand-orange bg-brand-orange/10 border-brand-orange/20",
    href: "/en/docs/getting-started",
  },
  {
    title: "Onboarding",
    icon: UserPlus,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    href: "/en/docs/onboarding",
  },
  {
    title: "Contact us",
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
    title: "Getting started",
    description: "Create an account, configure your business, and get ready in minutes",
    href: "/en/docs/getting-started",
  },
  {
    icon: UserPlus,
    title: "Onboarding",
    description: "Trainee mode, module journeys, protocol training and readiness score",
    href: "/en/docs/onboarding",
  },
  {
    icon: CalendarDays,
    title: "Shift planning",
    description: "Three view modes, drag-and-drop, templates, shift swaps and time clock",
    href: "/en/docs/shift-planning",
  },
  {
    icon: Users,
    title: "Staff management",
    description: "Organization structure, profiles, roles and competence tracking",
    href: "/en/docs/staff-management",
  },
  {
    icon: ClipboardCheck,
    title: "Tasks and routines",
    description: "Operations sessions, hooks, task types, governance chain and sign-off",
    href: "/en/docs/tasks-and-routines",
  },
  {
    icon: ShieldCheck,
    title: "HACCP and food safety",
    description: "Temperature logging, deviation handling, certifications and inspection-ready",
    href: "/en/docs/haccp",
  },
  {
    icon: MessageSquare,
    title: "Communication",
    description: "Real-time chat, announcements, notification system and escalation",
    href: "/en/docs/communication",
  },
  {
    icon: Bot,
    title: "Lise AI assistant",
    description: "8 capabilities, configurable authority levels, voice and event log",
    href: "/en/docs/ai-assistant",
  },
  {
    icon: BarChart3,
    title: "Reports and reconciliation",
    description: "Daily reconciliation, KPI dashboard, season reconciliation and report types",
    href: "/en/docs/reports",
  },
  {
    icon: Settings,
    title: "Settings",
    description: "Configuration, subscription, GDPR, language and integrations",
    href: "/en/docs/settings",
  },
];

export default function EnDocsOverviewPage() {
  return (
    <div>
      {/* Title */}
      <h1 className="text-foreground mb-3 text-4xl font-black tracking-tighter md:text-5xl">
        Overview: SmartOut
      </h1>

      {/* Subtitle */}
      <div className="border-brand-orange/20 bg-brand-orange/5 mb-10 rounded-xl border px-5 py-3">
        <p className="text-brand-orange text-base font-medium">
          Get employees ready for work — trained, compliant, equipped and informed from day one.
        </p>
      </div>

      {/* Quick action cards */}
      <div className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {quickCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`group flex flex-col items-center gap-2 rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg ${card.color}`}
          >
            <card.icon className="h-6 w-6" />
            <span className="text-foreground text-sm font-bold">{card.title}</span>
          </Link>
        ))}
      </div>

      {/* Key features */}
      <h2 className="text-foreground mb-6 text-2xl font-bold tracking-tight">Modules</h2>

      <div className="mb-12 space-y-0">
        {features.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className="group border-border/50 hover:bg-foreground/5 -mx-3 flex items-start gap-4 rounded-lg border-b px-3 py-4 transition-colors last:border-b-0"
          >
            <feature.icon className="text-muted-foreground group-hover:text-brand-orange mt-0.5 h-5 w-5 shrink-0 transition-colors" />
            <div className="min-w-0 flex-1">
              <span className="text-foreground group-hover:text-brand-orange text-sm font-semibold transition-colors">
                {feature.title}
              </span>
              <span className="text-muted-foreground mx-2">&rarr;</span>
              <span className="text-muted-foreground text-sm">{feature.description}</span>
            </div>
            <ArrowRight className="text-muted-foreground group-hover:text-brand-orange mt-1 h-4 w-4 shrink-0 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
          </Link>
        ))}
      </div>

      {/* Separator */}
      <hr className="border-border/50 mb-10" />

      {/* Help */}
      <div className="border-border/50 mt-12 border-t pt-6">
        <p className="text-muted-foreground text-sm">
          Can&apos;t find what you&apos;re looking for?{" "}
          <Link
            href="/pricing"
            className="text-brand-orange hover:text-brand-orange/80 font-medium transition-colors"
          >
            Contact us
          </Link>
          , and we&apos;ll help you out.
        </p>
      </div>
    </div>
  );
}
