/**
 * Declarative entity registry — single source of truth for entity types,
 * their tabs, icons, accent colors, and navigation hrefs.
 * EntityDrawer reads this instead of maintaining switch statements.
 */

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  User,
  Clock,
  Users,
  CalendarCheck,
  LayoutTemplate,
  AlertTriangle,
} from "lucide-react";
import type { EntityType } from "./EntityDrawerContext";

type EntityTabConfig = {
  value: string;
  labelKey: string;
  badge?: number;
};

type EntityConfig = {
  tabs: EntityTabConfig[];
  href?: string;
  icon: LucideIcon;
  accent: string;
  labelKey: string;
};

export const entityRegistry: Record<EntityType, EntityConfig> = {
  department: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: "/dashboard/organization/departments/{id}",
    icon: Building2,
    accent: "oklch(0.65 0.18 55)",
    labelKey: "entity_drawer.type_department",
  },
  profile: {
    tabs: [{ value: "summary", labelKey: "entity_drawer.tab_summary" }],
    href: "/dashboard/people/{id}",
    icon: User,
    accent: "oklch(0.60 0.15 240)",
    labelKey: "entity_drawer.type_profile",
  },
  shift: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: "/dashboard/schedule",
    icon: Clock,
    accent: "oklch(0.65 0.18 145)",
    labelKey: "entity_drawer.type_shift",
  },
  department_session: {
    tabs: [{ value: "summary", labelKey: "entity_drawer.tab_summary" }],
    href: undefined,
    icon: CalendarCheck,
    accent: "oklch(0.60 0.20 35)",
    labelKey: "entity_drawer.type_session",
  },
  team: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: "/dashboard/organization/teams/{id}",
    icon: Users,
    accent: "oklch(0.60 0.12 280)",
    labelKey: "entity_drawer.type_team",
  },
  shift_template: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: undefined,
    icon: LayoutTemplate,
    accent: "oklch(0.55 0.10 200)",
    labelKey: "entity_drawer.type_template",
  },
  cascade_task: {
    tabs: [{ value: "context", labelKey: "entity_drawer.tab_context" }],
    href: undefined,
    icon: AlertTriangle,
    accent: "oklch(0.65 0.22 40)",
    labelKey: "entity_drawer.type_task",
  },
};

export function getEntityHref(type: EntityType, id: string): string | null {
  const config = entityRegistry[type];
  if (!config.href) return null;
  return config.href.replace("{id}", id);
}
