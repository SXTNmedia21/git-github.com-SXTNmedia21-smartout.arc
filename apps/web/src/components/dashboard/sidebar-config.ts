/**
 * sidebar-config.ts
 * Single-source-of-truth navigation config for the Smartout dashboard sidebar.
 *
 * WHY: DashboardShell previously inlined nav items as JSX. Extracting them here
 * makes the config testable, mode-switchable (admin vs employee vs demo), and
 * diff-friendly when routes change. No React dependency — pure data.
 *
 * Three exports:
 *   SIDEBAR_GROUPS_ADMIN    — full manager/admin surface (9 groups)
 *   SIDEBAR_GROUPS_EMPLOYEE — employee-facing surface (3 groups)
 *   SIDEBAR_GROUPS_DEMO     — investor-pitch / showcase surface
 */
import type { LucideIcon } from "lucide-react";
import {
  Home,
  Users,
  Calendar,
  CalendarDays,
  CalendarRange,
  CalendarCheck2,
  ListTodo,
  Lightbulb,
  Wand2,
  Building2,
  Wallet,
  Banknote,
  BarChart3,
  FileText,
  FileCheck,
  DollarSign,
  Receipt,
  Globe,
  ShieldAlert,
  AlertTriangle,
  GraduationCap,
  ClipboardCheck,
  Gavel,
  BookOpen,
  Book,
  MessageCircle,
  Users2,
  PanelLeft,
  Plug,
  Bot,
  BotMessageSquare,
  UserCircle,
  Clock,
  Hash,
  Newspaper,
  LayoutDashboard,
  TrendingUp,
  IdCard,
  ArrowLeftRight,
  Scale as ScaleIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SidebarItemStatus = "live" | "linked-orphan" | "not-yet-built";

export type NavIndicator =
  | { type: "live" }
  | { type: "count"; value: number }
  | { type: "warning"; value?: number; label?: string }
  | { type: "text"; label: string };

export type SidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  status: SidebarItemStatus;
  /**
   * When true, item renders muted, non-clickable, tooltip "Kommer snart".
   * Reserved for not-yet-built routes.
   */
  disabled?: boolean;
  /** Special indigo "Mr. Botsson" glow (NavItem ai prop). */
  ai?: boolean;
  /** Feature flag key — item hides unless flag is true. */
  featureFlag?: "MY_CV" | "AI_CHAT";
  /**
   * When true, active state uses exact-match (pathname === href).
   * Default: prefix-match (pathname.startsWith(href)).
   */
  exactMatch?: boolean;
  /**
   * Extra hrefs that also activate this item.
   * Example: Ansatte activates on /people OR /contracts.
   */
  compositeActive?: string[];
  /** Static indicators. Dynamic ones (e.g. kanalerUnread) wire in DashboardShell. */
  indicators?: NavIndicator[];
};

export type SidebarGroupDef = {
  label: string;
  /** When true, renders without uppercase group-header chrome. */
  standalone?: boolean;
  /** When true, renders below a divider (Min Tid footer-style). */
  footer?: boolean;
  items: SidebarItem[];
};

// ---------------------------------------------------------------------------
// Shared item arrays (referenced by multiple group sets)
// ---------------------------------------------------------------------------

const KOMM_ITEMS: SidebarItem[] = [
  { label: "Kanaler", href: "/dashboard/komm", icon: Hash, status: "live", exactMatch: true },
  { label: "Chat", href: "/dashboard/komm/chat", icon: MessageCircle, status: "live" },
  { label: "Nyheter", href: "/dashboard/komm/nyheter", icon: Newspaper, status: "live" },
  { label: "Desks", href: "/dashboard/komm/desks", icon: PanelLeft, status: "linked-orphan" },
  { label: "Oversikt", href: "/dashboard/komm/oversikt", icon: Users2, status: "linked-orphan" },
];

// ---------------------------------------------------------------------------
// SIDEBAR_GROUPS_ADMIN — full manager/admin surface
// ---------------------------------------------------------------------------

export const SIDEBAR_GROUPS_ADMIN: SidebarGroupDef[] = [
  // 1. Oversikt
  {
    label: "Oversikt",
    standalone: true,
    items: [
      {
        label: "Oversikt",
        href: "/dashboard",
        icon: Home,
        status: "live",
        exactMatch: true,
      },
    ],
  },

  // 2. Drift
  {
    label: "Drift",
    items: [
      {
        label: "Ansatte",
        href: "/dashboard/people",
        icon: Users,
        status: "live",
        compositeActive: ["/dashboard/contracts"],
      },
      { label: "Vaktplan", href: "/dashboard/schedule", icon: Calendar, status: "live" },
      { label: "Kalender", href: "/dashboard/calendar", icon: CalendarRange, status: "live" },
      {
        label: "Vaktbørs",
        href: "/dashboard/schedule/marketplace",
        icon: ArrowLeftRight,
        status: "live",
      },
      {
        label: "Rutiner",
        href: "/dashboard/tasks",
        icon: ListTodo,
        status: "not-yet-built",
        disabled: true,
      },
      { label: "Forslag", href: "/dashboard/proposals", icon: Lightbulb, status: "linked-orphan" },
    ],
  },

  // 3. Planlegging
  {
    label: "Planlegging",
    items: [
      {
        label: "Årshjul",
        href: "/dashboard/year-wheel",
        icon: CalendarCheck2,
        status: "linked-orphan",
      },
      {
        label: "Setup-veiviser",
        href: "/dashboard/setup",
        icon: Wand2,
        status: "linked-orphan",
      },
    ],
  },

  // 4. Administrasjon
  {
    label: "Administrasjon",
    items: [
      {
        label: "Organisasjon",
        href: "/dashboard/organization",
        icon: Building2,
        status: "live",
      },
      { label: "Lønn", href: "/dashboard/payroll", icon: Wallet, status: "live" },
      {
        label: "Avstemming",
        href: "/dashboard/reconciliation",
        icon: ScaleIcon,
        status: "live",
      },
      { label: "Rapporter", href: "/dashboard/reports", icon: BarChart3, status: "live" },
      {
        label: "Kontrakter",
        href: "/dashboard/contracts",
        icon: FileText,
        status: "linked-orphan",
      },
      {
        label: "Kostnader",
        href: "/dashboard/cost",
        icon: DollarSign,
        status: "linked-orphan",
      },
      {
        label: "Fakturering",
        href: "/dashboard/billing",
        icon: Receipt,
        status: "linked-orphan",
      },
      { label: "Nettside", href: "/dashboard/website", icon: Globe, status: "linked-orphan" },
    ],
  },

  // 5. HMS & Compliance
  {
    label: "HMS & Compliance",
    items: [
      {
        label: "HMS-oversikt",
        href: "/dashboard/hms",
        icon: ShieldAlert,
        status: "linked-orphan",
      },
      {
        label: "Avvik",
        href: "/dashboard/hms/deviations",
        icon: AlertTriangle,
        status: "linked-orphan",
      },
      {
        label: "Dokumenter",
        href: "/dashboard/hms/documents",
        icon: FileCheck,
        status: "linked-orphan",
      },
      {
        label: "Trening",
        href: "/dashboard/hms/training",
        icon: GraduationCap,
        status: "linked-orphan",
      },
      {
        label: "Drift-sjekk",
        href: "/dashboard/hms/drift",
        icon: ClipboardCheck,
        status: "linked-orphan",
      },
      {
        label: "Styring",
        href: "/dashboard/hms/governance",
        icon: Gavel,
        status: "linked-orphan",
      },
      {
        label: "Policies",
        href: "/dashboard/policies",
        icon: BookOpen,
        status: "linked-orphan",
      },
      { label: "Handbok", href: "/dashboard/handbook", icon: Book, status: "linked-orphan" },
    ],
  },

  // 6. Kommunikasjon
  {
    label: "Kommunikasjon",
    items: KOMM_ITEMS,
  },

  // 7. Integrasjoner
  {
    label: "Integrasjoner",
    items: [
      {
        label: "POS Lightspeed",
        href: "/dashboard/admin/pos-accounts",
        icon: Plug,
        status: "linked-orphan",
      },
    ],
  },

  // 8. AI & Botsson
  {
    label: "AI & Botsson",
    items: [
      {
        label: "Mr. Botsson",
        href: "/dashboard/ai",
        icon: Bot,
        status: "live",
        featureFlag: "AI_CHAT",
        ai: true,
      },
      {
        label: "Onboarding-assistent",
        href: "/dashboard/onboarding-assistant",
        icon: BotMessageSquare,
        status: "linked-orphan",
      },
    ],
  },

  // 9. Veiledning
  {
    label: "Veiledning",
    items: [
      {
        label: "Manualer",
        href: "/dashboard/manuals",
        icon: Book,
        status: "not-yet-built",
        disabled: true,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// SIDEBAR_GROUPS_EMPLOYEE — employee-facing surface
// ---------------------------------------------------------------------------

export const SIDEBAR_GROUPS_EMPLOYEE: SidebarGroupDef[] = [
  // 1. Oversikt
  {
    label: "Oversikt",
    standalone: true,
    items: [
      {
        label: "Oversikt",
        href: "/dashboard",
        icon: Home,
        status: "live",
        exactMatch: true,
      },
    ],
  },

  // 2. Min Tid
  {
    label: "Min Tid",
    items: [
      { label: "Min plan", href: "/dashboard/my-schedule", icon: Calendar, status: "live" },
      { label: "Min lønn", href: "/dashboard/my-salary", icon: Banknote, status: "live" },
      { label: "Min kontrakt", href: "/dashboard/my-contract", icon: FileCheck, status: "live" },
      {
        label: "Min CV",
        href: "/dashboard/my-cv",
        icon: IdCard,
        status: "live",
        featureFlag: "MY_CV",
      },
      {
        label: "Min trening",
        href: "/dashboard/my-training",
        icon: GraduationCap,
        status: "live",
        indicators: [{ type: "warning", label: "1 forfalt" }],
      },
      { label: "Min profil", href: "/dashboard/my-profile", icon: UserCircle, status: "live" },
      {
        label: "Stempelur",
        href: "/dashboard/shift-clock",
        icon: Clock,
        status: "linked-orphan",
      },
    ],
  },

  // 3. Kommunikasjon (same items as admin)
  {
    label: "Kommunikasjon",
    items: KOMM_ITEMS,
  },
];

// ---------------------------------------------------------------------------
// SIDEBAR_GROUPS_DEMO — investor-pitch / showcase surface
// ---------------------------------------------------------------------------

const DEMO_SHOWCASE_ITEMS: SidebarItem[] = [
  {
    label: "Oversikt",
    href: "/dashboard",
    icon: LayoutDashboard,
    status: "live",
    exactMatch: true,
  },
  { label: "Templates", href: "/dashboard/schedule", icon: CalendarDays, status: "live" },
  { label: "Analytics", href: "/dashboard/reports", icon: TrendingUp, status: "live" },
  {
    label: "System Intelligence",
    href: "/onboarding",
    icon: Bot,
    status: "live",
    ai: true,
  },
];

export const SIDEBAR_GROUPS_DEMO: SidebarGroupDef[] = [
  // 1. Showcase — header chrome visible (standalone: false = default = shows label)
  {
    label: "Showcase",
    standalone: false,
    items: DEMO_SHOWCASE_ITEMS,
  },
  // 2–9: full admin surface so investors see the complete product
  ...SIDEBAR_GROUPS_ADMIN.slice(1),
];
