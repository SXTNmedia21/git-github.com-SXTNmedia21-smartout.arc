import {
  Building2,
  Users,
  Clock,
  ShieldCheck,
  MessageSquare,
  GraduationCap,
  CalendarDays,
  Star,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type HandbookChapter = {
  key: string;
  title: string;
  icon: LucideIcon;
  description: string;
};

export const HANDBOOK_CHAPTERS: HandbookChapter[] = [
  {
    key: "identity-mission",
    title: "Identitet og misjon",
    icon: Building2,
    description: "Misjon, servicelofte, readiness-definisjon og merkevaretone",
  },
  {
    key: "organization-model",
    title: "Organisasjonsmodell",
    icon: Users,
    description: "Avdelinger, team, rollestige og beslutningsmyndighet",
  },
  {
    key: "daily-operations",
    title: "Daglig drift",
    icon: Clock,
    description: "Apning, midt-service, stenging og eventdags-varianter",
  },
  {
    key: "safety-compliance",
    title: "Sikkerhet og etterlevelse",
    icon: ShieldCheck,
    description: "Mattrygghet, hygiene, allergen, alkohol, brann og evakuering",
  },
  {
    key: "communication",
    title: "Kommunikasjon og eskalering",
    icon: MessageSquare,
    description: "Vaktkanaler, hendelsesrapportering, eskaleringsmatrise",
  },
  {
    key: "onboarding-training",
    title: "Onboarding og opplaering",
    icon: GraduationCap,
    description: "Pre-boarding, dag 1-7, mentor og kunnskapstester",
  },
  {
    key: "scheduling",
    title: "Vaktplan og bemanning",
    icon: CalendarDays,
    description: "Planlegging, apne vakter, bytteregler og overtid",
  },
  {
    key: "quality-service",
    title: "Kvalitet og service",
    icon: Star,
    description: "Gjesteinteraksjon, stasjonsklar, service recovery",
  },
  {
    key: "incident-response",
    title: "Hendelseshandtering",
    icon: AlertTriangle,
    description: "Avvikskategorier, umiddelbare tiltak, korrigering og forebygging",
  },
  {
    key: "kpi-review",
    title: "KPI og gjennomgang",
    icon: TrendingUp,
    description: "Daglig, ukentlig og manedlig review med eierskap",
  },
];
