/**
 * sidebar-config.ts
 * Single-source-of-truth navigation config for the Smartout dashboard sidebar.
 *
 * WHY: DashboardShell previously inlined nav items as JSX. Extracting them here
 * makes the config testable, mode-switchable (admin vs employee vs demo), and
 * diff-friendly when routes change. No React dependency — pure data.
 *
 * Three exports:
 *   SIDEBAR_GROUPS_ADMIN    — full manager/admin surface (11 standalone groups)
 *   SIDEBAR_GROUPS_EMPLOYEE — employee-facing surface (10 standalone groups)
 *   SIDEBAR_GROUPS_DEMO     — investor-pitch / showcase surface
 */
import type { LucideIcon } from "lucide-react";
import {
  Home,
  Users,
  Calendar,
  CalendarDays,
  CalendarRange,
  ListTodo,
  Wallet,
  Banknote,
  BarChart3,
  FileCheck,
  ShieldAlert,
  GraduationCap,
  ClipboardCheck,
  MessageCircle,
  Users2,
  PanelLeft,
  Bot,
  UserCircle,
  Clock,
  Hash,
  Newspaper,
  LayoutDashboard,
  TrendingUp,
  IdCard,
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

// Preserved for future multi-item komm group resurrection. Not currently
// referenced — 11-flat layout uses inline single-item kommunikasjon entry.
const KOMM_ITEMS: SidebarItem[] = [
  {
    labelKey: "sidebar.item_kanaler",
    href: "/dashboard/komm",
    icon: Hash,
    status: "live",
    exactMatch: true,
  },
  {
    labelKey: "sidebar.item_chat",
    href: "/dashboard/komm/chat",
    icon: MessageCircle,
    status: "live",
  },
  {
    labelKey: "sidebar.item_nyheter",
    href: "/dashboard/komm/nyheter",
    icon: Newspaper,
    status: "live",
  },
  {
    labelKey: "sidebar.item_desks",
    href: "/dashboard/komm/desks",
    icon: PanelLeft,
    status: "linked-orphan",
  },
  {
    labelKey: "sidebar.item_oversikt",
    href: "/dashboard/komm/oversikt",
    icon: Users2,
    status: "linked-orphan",
  },
];

// ---------------------------------------------------------------------------
// SIDEBAR_GROUPS_ADMIN — full manager/admin surface
// ---------------------------------------------------------------------------

export const SIDEBAR_GROUPS_ADMIN: SidebarGroupDef[] = [
  {
    labelKey: "sidebar.group_oversikt",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_oversikt",
        href: "/dashboard",
        icon: Home,
        status: "live",
        exactMatch: true,
      },
    ],
  },
  {
    labelKey: "sidebar.group_oppgaver",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_oppgaver",
        href: "/dashboard/tasks",
        icon: ListTodo,
        status: "not-yet-built",
        disabled: true,
      },
    ],
  },
  {
    labelKey: "sidebar.group_planlegging",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_planlegging",
        href: "/dashboard/planning",
        icon: CalendarRange,
        status: "live",
        compositeActive: ["/dashboard/calendar"],
      },
    ],
  },
  {
    labelKey: "sidebar.group_vaktplan",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_vaktplan",
        href: "/dashboard/schedule",
        icon: CalendarDays,
        status: "live",
      },
    ],
  },
  {
    labelKey: "sidebar.group_ansatte",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_ansatte",
        href: "/dashboard/people",
        icon: Users,
        status: "live",
      },
    ],
  },
  {
    labelKey: "sidebar.group_hms",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_hms",
        href: "/dashboard/hms",
        icon: ShieldAlert,
        status: "live",
        compositeActive: ["/dashboard/policies", "/dashboard/handbook"],
      },
    ],
  },
  {
    labelKey: "sidebar.group_lonn",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_lonn",
        href: "/dashboard/payroll",
        icon: Wallet,
        status: "live",
        compositeActive: ["/dashboard/cost", "/dashboard/billing"],
      },
    ],
  },
  {
    labelKey: "sidebar.group_avstemming",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_avstemming",
        href: "/dashboard/reconciliation",
        icon: ClipboardCheck,
        status: "live",
      },
    ],
  },
  {
    labelKey: "sidebar.group_rapporter",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_rapporter",
        href: "/dashboard/reports",
        icon: BarChart3,
        status: "live",
      },
    ],
  },
  {
    labelKey: "sidebar.group_chat",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_chat_standalone",
        href: "/dashboard/chat",
        icon: MessageCircle,
        status: "live",
      },
    ],
  },
  {
    labelKey: "sidebar.group_kommunikasjon",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_kommunikasjon_root",
        href: "/dashboard/komm",
        icon: Hash,
        status: "live",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// SIDEBAR_GROUPS_EMPLOYEE — employee-facing surface
// ---------------------------------------------------------------------------

export const SIDEBAR_GROUPS_EMPLOYEE: SidebarGroupDef[] = [
  {
    labelKey: "sidebar.group_oversikt",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_oversikt",
        href: "/dashboard",
        icon: Home,
        status: "live",
        exactMatch: true,
      },
    ],
  },
  {
    labelKey: "sidebar.group_min_plan",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_min_plan",
        href: "/dashboard/my-schedule",
        icon: Calendar,
        status: "live",
      },
    ],
  },
  {
    labelKey: "sidebar.group_min_lonn",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_min_lonn",
        href: "/dashboard/my-salary",
        icon: Banknote,
        status: "live",
      },
    ],
  },
  {
    labelKey: "sidebar.group_min_kontrakt",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_min_kontrakt",
        href: "/dashboard/my-contract",
        icon: FileCheck,
        status: "live",
      },
    ],
  },
  {
    labelKey: "sidebar.group_min_cv",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_min_cv",
        href: "/dashboard/my-cv",
        icon: IdCard,
        status: "live",
        featureFlag: "MY_CV",
      },
    ],
  },
  {
    labelKey: "sidebar.group_min_trening",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_min_trening",
        href: "/dashboard/my-training",
        icon: GraduationCap,
        status: "live",
        indicators: [{ type: "warning", label: "1 forfalt" }],
      },
    ],
  },
  {
    labelKey: "sidebar.group_min_profil",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_min_profil",
        href: "/dashboard/my-profile",
        icon: UserCircle,
        status: "live",
      },
    ],
  },
  {
    labelKey: "sidebar.group_stempelur",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_stempelur",
        href: "/dashboard/shift-clock",
        icon: Clock,
        status: "linked-orphan",
      },
    ],
  },
  {
    labelKey: "sidebar.group_chat",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_chat_standalone",
        href: "/dashboard/chat",
        icon: MessageCircle,
        status: "live",
      },
    ],
  },
  {
    labelKey: "sidebar.group_kommunikasjon",
    standalone: true,
    items: [
      {
        labelKey: "sidebar.item_kommunikasjon_root",
        href: "/dashboard/komm",
        icon: Hash,
        status: "live",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// SIDEBAR_GROUPS_DEMO — investor-pitch / showcase surface
// ---------------------------------------------------------------------------

const DEMO_SHOWCASE_ITEMS: SidebarItem[] = [
  {
    labelKey: "sidebar.item_oversikt",
    href: "/dashboard",
    icon: LayoutDashboard,
    status: "live",
    exactMatch: true,
  },
  {
    labelKey: "sidebar.item_templates",
    href: "/dashboard/schedule",
    icon: CalendarDays,
    status: "live",
  },
  {
    labelKey: "sidebar.item_analytics",
    href: "/dashboard/reports",
    icon: TrendingUp,
    status: "live",
  },
  {
    labelKey: "sidebar.item_system_intelligence",
    href: "/onboarding",
    icon: Bot,
    status: "live",
    ai: true,
  },
];

export const SIDEBAR_GROUPS_DEMO: SidebarGroupDef[] = [
  // 1. Showcase — header chrome visible (standalone: false = default = shows label)
  {
    labelKey: "sidebar.group_showcase",
    standalone: false,
    items: DEMO_SHOWCASE_ITEMS,
  },
  // 2–11: full admin surface so investors see the complete product
  ...SIDEBAR_GROUPS_ADMIN.slice(1),
];
