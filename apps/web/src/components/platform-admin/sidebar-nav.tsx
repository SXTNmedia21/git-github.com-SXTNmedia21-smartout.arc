"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

const navItems = [
  {
    href: "/platform-admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  { href: "/platform-admin/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/platform-admin/billing", label: "Billing", icon: CreditCard },
  {
    href: "/platform-admin/communications",
    label: "Communications",
    icon: Mail,
  },
  { href: "/platform-admin/content", label: "Content", icon: FileText },
  { href: "/platform-admin/landing", label: "Landing", icon: Globe },
  {
    href: "/platform-admin/landing/variants",
    label: "Variants",
    icon: Layers,
  },
  {
    href: "/platform-admin/contracts",
    label: "Contracts",
    icon: FileSignature,
  },
  {
    href: "/platform-admin/contracts/templates",
    label: "Maler",
    icon: FileText,
  },
  { href: "/platform-admin/health", label: "Health", icon: Activity },
  { href: "/platform-admin/journeys", label: "Journey", icon: Map },
  { href: "/platform-admin/keys", label: "Keys & Secrets", icon: KeyRound },
  { href: "/platform-admin/users", label: "Users", icon: Users },
  { href: "/platform-admin/audit", label: "Audit Log", icon: ScrollText },
];

export function PlatformAdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      <div className="mb-4 px-3 py-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Platform Admin
        </h2>
      </div>
      {navItems.map((item) => {
        const isActive =
          item.href === "/platform-admin/dashboard"
            ? pathname === "/platform-admin/dashboard" || pathname === "/platform-admin"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
