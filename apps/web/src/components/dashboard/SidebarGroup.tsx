"use client";

/**
 * SidebarGroup.tsx
 * Renders a SidebarGroupDef as a visual sidebar section.
 *
 * WHY: Isolates the "group → items → NavItem" rendering logic so DashboardShell
 * can iterate over SIDEBAR_GROUPS_* without repeating per-item active-state and
 * feature-flag logic inline.
 *
 * Responsibilities:
 *  - Filter feature-flag-gated items
 *  - Compute active state (exact / prefix / compositeActive)
 *  - Route disabled items to DisabledNavItem
 *  - Merge dynamic indicators (e.g. unread counts) over static config indicators
 */

import { NavItem } from "./NavItem";
import type { NavBadgeVariant } from "./NavBadge";
import type { SidebarItem, SidebarGroupDef } from "./sidebar-config";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

export type SidebarGroupProps = {
  group: SidebarGroupDef;
  pathname: string;
  isDark: boolean;
  isCollapsed: boolean;
  /** Optional dynamic indicators per href — overrides static config indicators */
  dynamicIndicators?: Record<string, NavBadgeVariant[]>;
};

export function SidebarGroup({
  group,
  pathname,
  isDark,
  isCollapsed,
  dynamicIndicators,
}: SidebarGroupProps) {
  // Filter feature-flag-gated items
  const visibleItems = group.items.filter(
    (item) => !item.featureFlag || FEATURE_FLAGS[item.featureFlag],
  );

  if (visibleItems.length === 0) return null;

  return (
    <div
      className={group.footer ? "border-border mt-3 border-t pt-3" : group.standalone ? "" : "mt-3"}
    >
      {!group.standalone && !isCollapsed && (
        <div
          data-testid={`sidebar-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
          className="text-muted-foreground mt-1 mb-1 px-2 text-[9px] font-bold tracking-widest uppercase"
        >
          {group.label}
        </div>
      )}
      {!group.standalone && isCollapsed && <div className="mt-2" />}
      {visibleItems.map((item) => {
        const isActive = computeActive(item, pathname);
        const indicators = dynamicIndicators?.[item.href] ?? item.indicators;

        // routeSlug: strip leading /dashboard/ prefix, replace remaining / with -, fall back to href
        const routeSlug = item.href
          .replace(/^\/dashboard\/?/, "")
          .replace(/\//g, "-") || "dashboard";

        if (item.disabled) {
          return (
            <DisabledNavItem
              key={item.href}
              item={item}
              routeSlug={routeSlug}
              isDark={isDark}
              isCollapsed={isCollapsed}
            />
          );
        }

        return (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActive}
            indicators={indicators as NavBadgeVariant[] | undefined}
            ai={item.ai}
            isDark={isDark}
            isCollapsed={isCollapsed}
            data-testid={`sidebar-item-${routeSlug}`}
          />
        );
      })}
    </div>
  );
}

function computeActive(item: SidebarItem, pathname: string): boolean {
  if (item.exactMatch) return pathname === item.href;
  if (pathname === item.href) return true;
  if (pathname.startsWith(item.href + "/")) return true;
  if (item.compositeActive?.some((p) => pathname === p || pathname.startsWith(p + "/")))
    return true;
  return false;
}

function DisabledNavItem({
  item,
  routeSlug,
  isDark: _isDark,
  isCollapsed,
}: {
  item: SidebarItem;
  routeSlug: string;
  isDark: boolean;
  isCollapsed: boolean;
}) {
  // Muted, non-clickable. Renders like NavItem but as a div — no link, no click.
  const Icon = item.icon;
  return (
    <div
      data-testid={`sidebar-disabled-${routeSlug}`}
      data-disabled="true"
      title="Kommer snart"
      className={`group flex cursor-not-allowed items-center rounded-xl opacity-50 ${
        isCollapsed ? "justify-center px-0 py-1.5" : "justify-between px-2.5 py-1.5"
      } text-muted-foreground border border-transparent`}
    >
      <div className={`flex items-center ${isCollapsed ? "" : "gap-2.5"}`}>
        <Icon className="h-4 w-4 shrink-0" />
        {!isCollapsed && (
          <span className="text-[12px] font-medium tracking-wide">{item.label}</span>
        )}
      </div>
      {!isCollapsed && (
        <span className="text-muted-foreground/70 text-[9px] tracking-wider uppercase">Snart</span>
      )}
    </div>
  );
}
