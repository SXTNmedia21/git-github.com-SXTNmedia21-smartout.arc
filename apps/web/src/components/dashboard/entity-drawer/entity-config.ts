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

// ADR-0366: accent values use CSS var references resolved from tokens.css
export const entityRegistry: Record<EntityType, EntityConfig> = {
  department: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: "/dashboard/organization/departments/{id}",
    icon: Building2,
    accent: "var(--komm-announcement)", // warm amber hue 55
    labelKey: "entity_drawer.type_department",
  },
  profile: {
    tabs: [{ value: "summary", labelKey: "entity_drawer.tab_summary" }],
    href: "/dashboard/people/{id}",
    icon: User,
    accent: "var(--info)", // blue hue 225/240
    labelKey: "entity_drawer.type_profile",
  },
  shift: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: "/dashboard/schedule",
    icon: Clock,
    accent: "var(--status-active)", // green hue 145
    labelKey: "entity_drawer.type_shift",
  },
  department_session: {
    tabs: [{ value: "summary", labelKey: "entity_drawer.tab_summary" }],
    href: undefined,
    icon: CalendarCheck,
    accent: "var(--destructive)", // warm red hue 25-35
    labelKey: "entity_drawer.type_session",
  },
  team: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: "/dashboard/organization/teams/{id}",
    icon: Users,
    accent: "var(--dept-bar)", // purple hue 280-300
    labelKey: "entity_drawer.type_team",
  },
  shift_template: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: undefined,
    icon: LayoutTemplate,
    accent: "var(--dept-storage)", // cyan hue 200
    labelKey: "entity_drawer.type_template",
  },
  cascade_task: {
    tabs: [{ value: "context", labelKey: "entity_drawer.tab_context" }],
    href: undefined,
    icon: AlertTriangle,
    accent: "var(--brand-orange)", // orange hue 40
    labelKey: "entity_drawer.type_task",
  },
  deviation: {
    tabs: [{ value: "details", labelKey: "entity_drawer.tab_details" }],
    href: undefined,
    icon: AlertTriangle,
    accent: "var(--priority-urgent)", // red-orange hue 20-27
    labelKey: "entity_drawer.type_task",
  },
};

export function getEntityHref(type: EntityType, id: string): string | null {
  const config = entityRegistry[type];
  if (!config.href) return null;
  return config.href.replace("{id}", id);
}
