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
  labelKey: string;
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
  labelKey: string;
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
  {
    labelKey: "dashboard.sidebar.item_kanaler",
    href: "/dashboard/komm",
    icon: Hash,
    status: "live",
    exactMatch: true,
  },
  {
    labelKey: "dashboard.sidebar.item_chat",
    href: "/dashboard/komm/chat",
    icon: MessageCircle,
    status: "live",
  },
  {
    labelKey: "dashboard.sidebar.item_nyheter",
    href: "/dashboard/komm/nyheter",
    icon: Newspaper,
    status: "live",
  },
  {
    labelKey: "dashboard.sidebar.item_desks",
    href: "/dashboard/komm/desks",
    icon: PanelLeft,
    status: "linked-orphan",
  },
  {
    labelKey: "dashboard.sidebar.item_oversikt",
    href: "/dashboard/komm/oversikt",
    icon: Users2,
    status: "linked-orphan",
  },
];

// ---------------------------------------------------------------------------
// SIDEBAR_GROUPS_ADMIN — full manager/admin surface
// ---------------------------------------------------------------------------

export const SIDEBAR_GROUPS_ADMIN: SidebarGroupDef[] = [
  // 1. Oversikt
  {
    labelKey: "dashboard.sidebar.group_oversikt",
    standalone: true,
    items: [
      {
        labelKey: "dashboard.sidebar.item_oversikt",
        href: "/dashboard",
        icon: Home,
        status: "live",
        exactMatch: true,
      },
    ],
  },

  // 2. Drift
  {
    labelKey: "dashboard.sidebar.group_drift",
    items: [
      {
        labelKey: "dashboard.sidebar.item_ansatte",
        href: "/dashboard/people",
        icon: Users,
        status: "live",
        compositeActive: ["/dashboard/contracts"],
      },
      {
        labelKey: "dashboard.sidebar.item_vaktplan",
        href: "/dashboard/schedule",
        icon: Calendar,
        status: "live",
      },
      {
        labelKey: "dashboard.sidebar.item_kalender",
        href: "/dashboard/calendar",
        icon: CalendarRange,
        status: "live",
      },
      {
        labelKey: "dashboard.sidebar.item_vaktbors",
        href: "/dashboard/schedule/marketplace",
        icon: ArrowLeftRight,
        status: "live",
      },
      {
        labelKey: "dashboard.sidebar.item_rutiner",
        href: "/dashboard/tasks",
        icon: ListTodo,
        status: "not-yet-built",
        disabled: true,
      },
      {
        labelKey: "dashboard.sidebar.item_forslag",
        href: "/dashboard/proposals",
        icon: Lightbulb,
        status: "linked-orphan",
      },
    ],
  },

  // 3. Planlegging
  {
    labelKey: "dashboard.sidebar.group_planlegging",
    items: [
      {
        labelKey: "dashboard.sidebar.item_arshjul",
        href: "/dashboard/year-wheel",
        icon: CalendarCheck2,
        status: "linked-orphan",
      },
      {
        labelKey: "dashboard.sidebar.item_setup_veiviser",
        href: "/dashboard/setup",
        icon: Wand2,
        status: "linked-orphan",
      },
    ],
  },

  // 4. Administrasjon
  {
    labelKey: "dashboard.sidebar.group_administrasjon",
    items: [
      {
        labelKey: "dashboard.sidebar.item_organisasjon",
        href: "/dashboard/organization",
        icon: Building2,
        status: "live",
      },
      {
        labelKey: "dashboard.sidebar.item_lonn",
        href: "/dashboard/payroll",
        icon: Wallet,
        status: "live",
      },
      {
        labelKey: "dashboard.sidebar.item_avstemming",
        href: "/dashboard/reconciliation",
        icon: ScaleIcon,
        status: "live",
      },
      {
        labelKey: "dashboard.sidebar.item_rapporter",
        href: "/dashboard/reports",
        icon: BarChart3,
        status: "live",
      },
      {
        labelKey: "dashboard.sidebar.item_kontrakter",
        href: "/dashboard/contracts",
        icon: FileText,
        status: "linked-orphan",
      },
      {
        labelKey: "dashboard.sidebar.item_kostnader",
        href: "/dashboard/cost",
        icon: DollarSign,
        status: "linked-orphan",
      },
      {
        labelKey: "dashboard.sidebar.item_fakturering",
        href: "/dashboard/billing",
        icon: Receipt,
        status: "linked-orphan",
      },
      {
        labelKey: "dashboard.sidebar.item_nettside",
        href: "/dashboard/website",
        icon: Globe,
        status: "linked-orphan",
      },
    ],
  },

  // 5. HMS & Compliance
  {
    labelKey: "dashboard.sidebar.group_hms_compliance",
    items: [
      {
        labelKey: "dashboard.sidebar.item_hms_oversikt",
        href: "/dashboard/hms",
        icon: ShieldAlert,
        status: "linked-orphan",
      },
      {
        labelKey: "dashboard.sidebar.item_avvik",
        href: "/dashboard/hms/deviations",
        icon: AlertTriangle,
        status: "linked-orphan",
      },
      {
        labelKey: "dashboard.sidebar.item_dokumenter",
        href: "/dashboard/hms/documents",
        icon: FileCheck,
        status: "linked-orphan",
      },
      {
        labelKey: "dashboard.sidebar.item_trening",
        href: "/dashboard/hms/training",
        icon: GraduationCap,
        status: "linked-orphan",
      },
      {
        labelKey: "dashboard.sidebar.item_drift_sjekk",
        href: "/dashboard/hms/drift",
        icon: ClipboardCheck,
        status: "linked-orphan",
      },
      {
        labelKey: "dashboard.sidebar.item_styring",
        href: "/dashboard/hms/governance",
        icon: Gavel,
        status: "linked-orphan",
      },
      {
        labelKey: "dashboard.sidebar.item_policies",
        href: "/dashboard/policies",
        icon: BookOpen,
        status: "linked-orphan",
      },
      {
        labelKey: "dashboard.sidebar.item_handbok",
        href: "/dashboard/handbook",
        icon: Book,
        status: "linked-orphan",
      },
    ],
  },

  // 6. Kommunikasjon
  {
    labelKey: "dashboard.sidebar.group_kommunikasjon",
    items: KOMM_ITEMS,
  },

  // 7. Integrasjoner
  {
    labelKey: "dashboard.sidebar.group_integrasjoner",
    items: [
      {
        labelKey: "dashboard.sidebar.item_pos_lightspeed",
        href: "/dashboard/admin/pos-accounts",
        icon: Plug,
        status: "linked-orphan",
      },
    ],
  },

  // 8. AI & Botsson
  {
    labelKey: "dashboard.sidebar.group_ai_botsson",
    items: [
      {
        labelKey: "dashboard.sidebar.item_mr_botsson",
        href: "/dashboard/ai",
        icon: Bot,
        status: "live",
        featureFlag: "AI_CHAT",
        ai: true,
      },
      {
        labelKey: "dashboard.sidebar.item_onboarding_assistent",
        href: "/dashboard/onboarding-assistant",
        icon: BotMessageSquare,
        status: "linked-orphan",
      },
    ],
  },

  // 9. Veiledning
  {
    labelKey: "dashboard.sidebar.group_veiledning",
    items: [
      {
        labelKey: "dashboard.sidebar.item_manualer",
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
    labelKey: "dashboard.sidebar.group_oversikt",
    standalone: true,
    items: [
      {
        labelKey: "dashboard.sidebar.item_oversikt",
        href: "/dashboard",
        icon: Home,
        status: "live",
        exactMatch: true,
      },
    ],
  },

  // 2. Min Tid
  {
    labelKey: "dashboard.sidebar.group_min_tid",
    items: [
      {
        labelKey: "dashboard.sidebar.item_min_plan",
        href: "/dashboard/my-schedule",
        icon: Calendar,
        status: "live",
      },
      {
        labelKey: "dashboard.sidebar.item_min_lonn",
        href: "/dashboard/my-salary",
        icon: Banknote,
        status: "live",
      },
      {
        labelKey: "dashboard.sidebar.item_min_kontrakt",
        href: "/dashboard/my-contract",
        icon: FileCheck,
        status: "live",
      },
      {
        labelKey: "dashboard.sidebar.item_min_cv",
        href: "/dashboard/my-cv",
        icon: IdCard,
        status: "live",
        featureFlag: "MY_CV",
      },
      {
        labelKey: "dashboard.sidebar.item_min_trening",
        href: "/dashboard/my-training",
        icon: GraduationCap,
        status: "live",
        indicators: [{ type: "warning", label: "1 forfalt" }],
      },
      {
        labelKey: "dashboard.sidebar.item_min_profil",
        href: "/dashboard/my-profile",
        icon: UserCircle,
        status: "live",
      },
      {
        labelKey: "dashboard.sidebar.item_stempelur",
        href: "/dashboard/shift-clock",
        icon: Clock,
        status: "linked-orphan",
      },
    ],
  },

  // 3. Kommunikasjon (same items as admin)
  {
    labelKey: "dashboard.sidebar.group_kommunikasjon",
    items: KOMM_ITEMS,
  },
];

// ---------------------------------------------------------------------------
// SIDEBAR_GROUPS_DEMO — investor-pitch / showcase surface
// ---------------------------------------------------------------------------

const DEMO_SHOWCASE_ITEMS: SidebarItem[] = [
  {
    labelKey: "dashboard.sidebar.item_oversikt",
    href: "/dashboard",
    icon: LayoutDashboard,
    status: "live",
    exactMatch: true,
  },
  {
    labelKey: "dashboard.sidebar.item_templates",
    href: "/dashboard/schedule",
    icon: CalendarDays,
    status: "live",
  },
  {
    labelKey: "dashboard.sidebar.item_analytics",
    href: "/dashboard/reports",
    icon: TrendingUp,
    status: "live",
  },
  {
    labelKey: "dashboard.sidebar.item_system_intelligence",
    href: "/onboarding",
    icon: Bot,
    status: "live",
    ai: true,
  },
];

export const SIDEBAR_GROUPS_DEMO: SidebarGroupDef[] = [
  // 1. Showcase — header chrome visible (standalone: false = default = shows label)
  {
    labelKey: "dashboard.sidebar.group_showcase",
    standalone: false,
    items: DEMO_SHOWCASE_ITEMS,
  },
  // 2–9: full admin surface so investors see the complete product
  ...SIDEBAR_GROUPS_ADMIN.slice(1),
];
