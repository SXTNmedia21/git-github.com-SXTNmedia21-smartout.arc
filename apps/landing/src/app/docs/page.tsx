import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
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
import { createTranslator } from "@smartout/i18n";
import type { DocsLocale } from "@/lib/user-manual";
import { DocsAgentPanel } from "./_components/docs-agent-panel";

type QuickCard = {
  titleKey: string;
  icon: LucideIcon;
  color: string;
  slug: string;
};

const quickCards: QuickCard[] = [
  {
    titleKey: "quick.gettingStarted",
    icon: Rocket,
    color: "text-brand-orange bg-brand-orange/10 border-brand-orange/20",
    slug: "getting-started",
  },
  {
    titleKey: "quick.onboarding",
    icon: UserPlus,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    slug: "onboarding",
  },
  {
    titleKey: "quick.contact",
    icon: MessageSquare,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    slug: "_pricing",
  },
];

type FeatureDef = {
  icon: LucideIcon;
  key: string;
  nbSlug: string;
  enSlug: string;
};

const featureDefs: FeatureDef[] = [
  { icon: Rocket, key: "gettingStarted", nbSlug: "kom-i-gang", enSlug: "getting-started" },
  { icon: UserPlus, key: "onboarding", nbSlug: "onboarding", enSlug: "onboarding" },
  { icon: CalendarDays, key: "shiftPlanning", nbSlug: "vaktplan", enSlug: "shift-planning" },
  { icon: Users, key: "staffManagement", nbSlug: "ansatte", enSlug: "staff-management" },
  {
    icon: ClipboardCheck,
    key: "tasksAndRoutines",
    nbSlug: "oppgaver-rutiner",
    enSlug: "tasks-and-routines",
  },
  { icon: ShieldCheck, key: "haccp", nbSlug: "haccp", enSlug: "haccp" },
  { icon: MessageSquare, key: "communication", nbSlug: "kommunikasjon", enSlug: "communication" },
  { icon: Bot, key: "aiAssistant", nbSlug: "ai-assistent", enSlug: "ai-assistant" },
  { icon: BarChart3, key: "reports", nbSlug: "rapporter", enSlug: "reports" },
  { icon: Settings, key: "settings", nbSlug: "innstillinger", enSlug: "settings" },
];

function docsHref(slug: string, locale: DocsLocale) {
  const prefix = locale === "en" ? "/en/docs" : "/docs";
  return `${prefix}/${slug}`;
}

function quickCardHref(card: QuickCard, locale: DocsLocale) {
  if (card.slug === "_pricing") return "/pricing";
  const nbSlugs: Record<string, string> = {
    "getting-started": "kom-i-gang",
    onboarding: "onboarding",
  };
  const slug = locale === "en" ? card.slug : (nbSlugs[card.slug] ?? card.slug);
  return docsHref(slug, locale);
}

export const metadata: Metadata = {
  alternates: {
    canonical: "/docs",
    languages: {
      nb: "/docs",
      en: "/en/docs",
    },
  },
};

export default async function DocsOverviewPage() {
  const headersList = await headers();
  const locale = (headersList.get("x-locale") ?? "nb") as DocsLocale;
  const t = createTranslator(locale, "docs");

  return (
    <div>
      {/* Title */}
      <h1 className="text-foreground mb-3 text-4xl font-black tracking-tighter md:text-5xl">
        {t("index.title")}
      </h1>

      {/* Subtitle */}
      <div className="border-brand-orange/20 bg-brand-orange/5 mb-10 rounded-xl border px-5 py-3">
        <p className="text-brand-orange text-base font-medium">{t("index.subtitle")}</p>
      </div>

      {/* Quick action cards */}
      <div className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {quickCards.map((card) => {
          const href = quickCardHref(card, locale);
          return (
            <Link
              key={card.slug}
              href={href}
              className={`group flex flex-col items-center gap-2 rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg ${card.color}`}
            >
              <card.icon className="h-6 w-6" />
              <span className="text-foreground text-sm font-bold">{t(card.titleKey)}</span>
            </Link>
          );
        })}
      </div>

      {/* Key features */}
      <h2 className="text-foreground mb-6 text-2xl font-bold tracking-tight">
        {t("index.modules")}
      </h2>

      <div className="mb-12 space-y-0">
        {featureDefs.map((feature) => {
          const slug = locale === "en" ? feature.enSlug : feature.nbSlug;
          const href = docsHref(slug, locale);
          return (
            <Link
              key={feature.key}
              href={href}
              className="group border-border/50 hover:bg-foreground/5 -mx-3 flex items-start gap-4 rounded-lg border-b px-3 py-4 transition-colors last:border-b-0"
            >
              <feature.icon className="text-muted-foreground group-hover:text-brand-orange mt-0.5 h-5 w-5 shrink-0 transition-colors" />
              <div className="min-w-0 flex-1">
                <span className="text-foreground group-hover:text-brand-orange text-sm font-semibold transition-colors">
                  {t(`feature.${feature.key}.title`)}
                </span>
                <span className="text-muted-foreground mx-2">{"\u2192"}</span>
                <span className="text-muted-foreground text-sm">
                  {t(`feature.${feature.key}.description`)}
                </span>
              </div>
              <ArrowRight className="text-muted-foreground group-hover:text-brand-orange mt-1 h-4 w-4 shrink-0 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>

      {/* Separator */}
      <hr className="border-border/50 mb-10" />

      {/* Docs agent */}
      <DocsAgentPanel />

      {/* Help */}
      <div className="border-border/50 mt-12 border-t pt-6">
        <p className="text-muted-foreground text-sm">
          {t("index.help")}{" "}
          <Link
            href="/pricing"
            className="text-brand-orange hover:text-brand-orange/80 font-medium transition-colors"
          >
            {t("index.contact")}
          </Link>
          {t("index.helpSuffix")}
        </p>
      </div>
    </div>
  );
}
