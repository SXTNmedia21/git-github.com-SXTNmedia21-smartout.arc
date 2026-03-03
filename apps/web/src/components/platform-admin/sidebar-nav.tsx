"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    item.indent && "pl-8",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
