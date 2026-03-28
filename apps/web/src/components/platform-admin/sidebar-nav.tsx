"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  FileText,
  FileSignature,
  Activity,
  Map,
  Users,
  ScrollText,
  Mail,
  KeyRound,
  Globe,
  Layers,
  Server,
  Shield,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  indent?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type ShiftLockStatusResponse = {
  services?: Array<{ status: "operational" | "degraded" | "down" }>;
  shift_lock: {
    severity: "normal" | "warning" | "critical";
    off_workspaces: number;
  } | null;
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/platform-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/platform-admin/health", label: "Health", icon: Activity },
      { href: "/platform-admin/services", label: "Services", icon: Server },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/platform-admin/workspaces", label: "Workspaces", icon: Building2 },
      { href: "/platform-admin/users", label: "Users", icon: Users },
      { href: "/platform-admin/billing", label: "Billing", icon: CreditCard },
      { href: "/platform-admin/contracts", label: "Contracts", icon: FileSignature },
      { href: "/platform-admin/contracts/templates", label: "Maler", icon: FileText, indent: true },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/platform-admin/communications", label: "Communications", icon: Mail },
      { href: "/platform-admin/content", label: "Content", icon: FileText },
      { href: "/platform-admin/landing", label: "Landing", icon: Globe },
      { href: "/platform-admin/landing/variants", label: "Variants", icon: Layers, indent: true },
      { href: "/platform-admin/journeys", label: "Journey", icon: Map },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/platform-admin/keys", label: "Keys & Secrets", icon: KeyRound },
      { href: "/platform-admin/guardian", label: "Guardian", icon: Shield },
      { href: "/platform-admin/audit", label: "Audit Log", icon: ScrollText },
    ],
  },
];

export function PlatformAdminSidebarNav() {
  const pathname = usePathname();
  const [shiftLockSeverity, setShiftLockSeverity] = useState<"normal" | "warning" | "critical">(
    "normal",
  );
  const [shiftLockBadgeCount, setShiftLockBadgeCount] = useState(0);
  const [servicesDownCount, setServicesDownCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    /**
     * Loads shift lock severity from platform health endpoint.
     * Why: sidebar should surface critical governance state globally.
     */
    async function loadShiftLockSeverity() {
      try {
        const res = await fetch("/api/platform-admin/health/status", { cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as ShiftLockStatusResponse;
        const severity = data.shift_lock?.severity ?? "normal";
        const offWorkspaces = data.shift_lock?.off_workspaces ?? 0;
        const count = severity === "critical" ? Math.max(offWorkspaces, 1) : 0;
        const downCount = (data.services ?? []).filter((svc) => svc.status === "down").length;

        if (!isMounted) return;
        setShiftLockSeverity(severity);
        setShiftLockBadgeCount(count);
        setServicesDownCount(downCount);
      } catch {
        // Ignore fetch errors in sidebar; health page remains source of truth.
      }
    }

    void loadShiftLockSeverity();
    const interval = setInterval(() => void loadShiftLockSeverity(), 60_000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const showCriticalShiftLockBadge = useMemo(
    () => shiftLockSeverity === "critical" && shiftLockBadgeCount > 0,
    [shiftLockSeverity, shiftLockBadgeCount],
  );
  const showServicesDownBadge = useMemo(() => servicesDownCount > 0, [servicesDownCount]);
  const systemAlertsCount = useMemo(() => {
    const shiftLockAlerts = showCriticalShiftLockBadge ? shiftLockBadgeCount : 0;
    const serviceAlerts = showServicesDownBadge ? servicesDownCount : 0;
    return shiftLockAlerts + serviceAlerts;
  }, [showCriticalShiftLockBadge, shiftLockBadgeCount, showServicesDownBadge, servicesDownCount]);
  const showSystemAlertsBadge = useMemo(() => systemAlertsCount > 0, [systemAlertsCount]);

  return (
    <nav className="space-y-4 px-2 py-4">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="text-muted-foreground mb-1 px-3 text-[11px] font-semibold tracking-wider uppercase">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive =
                item.href === "/platform-admin/dashboard"
                  ? pathname === "/platform-admin/dashboard" || pathname === "/platform-admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={
                    item.href === "/platform-admin/health" && showCriticalShiftLockBadge
                      ? "/platform-admin/health?focus=shift-lock"
                      : item.href
                  }
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    item.indent && "pl-8",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">{item.label}</span>
                    {item.href === "/platform-admin/health" && showCriticalShiftLockBadge ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="bg-destructive text-destructive-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold">
                              {shiftLockBadgeCount}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            Shift Lock critical: {shiftLockBadgeCount} workspace
                            {shiftLockBadgeCount === 1 ? "" : "s"} need attention
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                    {item.href === "/platform-admin/services" && showServicesDownBadge ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="bg-destructive text-destructive-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold">
                              {servicesDownCount}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            Services down: {servicesDownCount}. Open Services/Health for details.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                    {item.href === "/platform-admin/dashboard" && showSystemAlertsBadge ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="bg-destructive text-destructive-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold">
                              {systemAlertsCount}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            System alerts: {systemAlertsCount} total (
                            {showCriticalShiftLockBadge
                              ? `${shiftLockBadgeCount} shift-lock`
                              : "0 shift-lock"}
                            ,{" "}
                            {showServicesDownBadge ? `${servicesDownCount} services` : "0 services"}
                            )
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
