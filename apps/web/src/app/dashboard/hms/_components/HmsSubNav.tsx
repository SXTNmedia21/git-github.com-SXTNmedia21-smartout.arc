"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardCheck,
  GraduationCap,
  FileText,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

const HMS_TABS = [
  { id: "oversikt", href: "/dashboard/hms", label: "Oversikt", icon: LayoutDashboard },
  { id: "drift", href: "/dashboard/hms/drift", label: "Drift", icon: ClipboardCheck },
  { id: "training", href: "/dashboard/hms/training", label: "Opplæring", icon: GraduationCap },
  { id: "documents", href: "/dashboard/hms/documents", label: "Dokumenter", icon: FileText },
  { id: "deviations", href: "/dashboard/hms/deviations", label: "Avvik", icon: AlertTriangle },
  { id: "governance", href: "/dashboard/hms/governance", label: "Governance", icon: ShieldCheck },
] as const;

export function HmsSubNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard/hms") return pathname === "/dashboard/hms";
    return pathname.startsWith(href);
  }

  return (
    <nav aria-label="HMS navigasjon">
      <div
        role="tablist"
        className="bg-muted/50 border-border mb-6 flex gap-1 rounded-xl border p-1"
      >
        {HMS_TABS.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-background text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
