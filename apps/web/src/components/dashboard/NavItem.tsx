"use client";

/**
 * NavItem.tsx
 * Single sidebar navigation link — extracted from DashboardShell's inline definition.
 *
 * WHY: DashboardShell previously defined NavItem as a module-local function
 * (lines 2113-2256). SidebarGroup needs to import it independently, so it lives
 * here. DashboardShell still uses its own inline copy until T4 rewires it.
 */

import Link from "next/link";
import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NavBadgePill, NavBadgeDot, type NavBadgeVariant } from "./NavBadge";

export type NavItemProps = {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
  /** Stackable right-aligned badges (NavBadge variants). First item wins
   *  priority for the collapsed-mode dot overlay. */
  indicators?: NavBadgeVariant[];
  /** @deprecated pass `{ type: "text", label }` via `indicators` instead */
  badge?: string;
  /** @deprecated pass `{ type: "live" }` via `indicators` instead */
  liveIndicator?: boolean;
  isDark?: boolean;
  ai?: boolean;
  isCollapsed?: boolean;
  onClick?: () => void;
  useButton?: boolean;
  /** Test identifier for e2e / protocol assertions. */
  "data-testid"?: string;
};

export function NavItem({
  icon: Icon,
  label,
  href,
  active,
  indicators,
  badge,
  liveIndicator,
  isDark,
  ai,
  isCollapsed,
  onClick,
  useButton,
  "data-testid": dataTestId,
}: NavItemProps) {
  // Fold legacy props into the indicators array so rendering has a
  // single source of truth. Live ranks first so it wins the collapsed dot.
  const resolvedIndicators: NavBadgeVariant[] = [
    ...(liveIndicator ? ([{ type: "live" }] as NavBadgeVariant[]) : []),
    ...(indicators ?? []),
    ...(badge ? ([{ type: "text", label: badge }] as NavBadgeVariant[]) : []),
  ];
  const hasIndicators = resolvedIndicators.length > 0;
  const topIndicator = resolvedIndicators[0];
  const normalizedLabel = label.toLowerCase().replace(/\s+/g, "-");
  const navAutoplayId = `nav-${href}`;
  const navButtonAutoplayId = `navbtn-${normalizedLabel}`;
  const baseClassName = `group flex items-center rounded-[9px] transition-all ${
    isCollapsed ? "justify-center px-0 py-1.5" : "justify-between px-2.5 py-[9px]"
  } ${
    active
      ? "border border-sidebar-border bg-card font-semibold text-sidebar-accent-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
      : "border border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
  }`;

  const inner = (
    <>
      <div className={`flex items-center ${isCollapsed ? "" : "gap-2.5"}`}>
        <Icon
          className={`h-4 w-4 shrink-0 transition-colors ${
            ai
              ? "text-brand-orange group-hover:text-brand-orange/80"
              : active
                ? "text-brand-orange"
                : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
          }`}
        />
        {!isCollapsed && (
          <span className={`text-[12px] tracking-wide ${active ? "font-bold" : "font-medium"}`}>
            {label}
          </span>
        )}
      </div>
      {/* Expanded: right-aligned stack of badges. Active-route dot is
       *  suppressed when indicators are present so the row stays clean. */}
      {!isCollapsed && hasIndicators && (
        <div className="flex shrink-0 items-center gap-1">
          {resolvedIndicators.map((variant, i) => (
            <NavBadgePill key={`${variant.type}-${i}`} variant={variant} />
          ))}
        </div>
      )}
      {!isCollapsed && !hasIndicators && active && (
        <div className="bg-brand-orange h-1.5 w-1.5 rounded-full" />
      )}
      {/* Collapsed: single dot overlay on the icon corner using the
       *  highest-priority indicator (live > warning > count/text). */}
      {isCollapsed && topIndicator && (
        <span className="absolute top-0.5 right-0.5">
          <NavBadgeDot variant={topIndicator} />
        </span>
      )}
    </>
  );

  const content = useButton ? (
    <button
      type="button"
      onClick={onClick}
      data-autoplay={navButtonAutoplayId}
      data-testid={dataTestId}
      className={baseClassName}
    >
      {inner}
    </button>
  ) : (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      data-autoplay={navAutoplayId}
      data-testid={dataTestId}
      className={baseClassName}
    >
      {inner}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-semibold">
          {label}
          {badge ? ` (${badge})` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
