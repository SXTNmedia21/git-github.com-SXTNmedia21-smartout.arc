import {
  Building2,
  Users,
  Clock,
  ShieldCheck,
  MessageSquare,
  GraduationCap,
  Calendar,
  Star,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ChapterKey =
  | "identity-mission"
  | "organization-model"
  | "daily-operations"
  | "safety-compliance"
  | "communication"
  | "onboarding-training"
  | "scheduling"
  | "quality-service"
  | "incident-response"
  | "kpi-review";

export type Chapter = {
  key: ChapterKey;
  number: number;
  title: string;
  icon: LucideIcon;
  description: string;
};

export const CHAPTERS: Chapter[] = [
  {
    key: "identity-mission",
    number: 1,
    title: "Identitet og Misjon",
    icon: Building2,
    description: "Misjon, serviceløfte, merkevare og tone",
  },
  {
    key: "organization-model",
    number: 2,
    title: "Organisasjonsmodell",
    icon: Users,
    description: "Avdelinger, team, roller og ansvar",
  },
  {
    key: "daily-operations",
    number: 3,
    title: "Daglig Drift",
    icon: Clock,
    description: "Åpning, midt-skift, lukking og overlevering",
  },
  {
    key: "safety-compliance",
    number: 4,
    title: "Sikkerhet og Etterlevelse",
    icon: ShieldCheck,
    description: "Mattrygghet, hygiene, allergener, brannvern",
  },
  {
    key: "communication",
    number: 5,
    title: "Kommunikasjon",
    icon: MessageSquare,
    description: "Kanaler, eskalering og rapportering",
  },
  {
    key: "onboarding-training",
    number: 6,
    title: "Onboarding og Opplæring",
    icon: GraduationCap,
    description: "Pre-boarding, mentor, kunnskapstester",
  },
  {
    key: "scheduling",
    number: 7,
    title: "Vaktplan og Bemanning",
    icon: Calendar,
    description: "Planlegging, bytter, overtid og regler",
  },
  {
    key: "quality-service",
    number: 8,
    title: "Kvalitet og Service",
    icon: Star,
    description: "Gjestestandard, stasjoner, service recovery",
  },
  {
    key: "incident-response",
    number: 9,
    title: "Avvik og Hendelser",
    icon: AlertTriangle,
    description: "Kategorier, tiltak, eierskap og forebygging",
  },
  {
    key: "kpi-review",
    number: 10,
    title: "KPI og Evaluering",
    icon: TrendingUp,
    description: "Daglig, ukentlig, månedlig oppfølging",
  },
];
