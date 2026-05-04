"use client";

/**
 * AdminSidebarNav.tsx — sidebar navigation
 *
 * Five primary routes: Dashboard / Workspaces / Ordrer / Historikk / Konto.
 * Highlights active route via usePathname.
 * M7c: Added Avstemming (dashboard) + Historikk nav items.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, FileText, History, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
  { label: "Workspaces", href: "/workspaces", icon: Building2, exact: false },
  { label: "Ordrer", href: "/orders", icon: FileText, exact: false },
  { label: "Historikk", href: "/avstemming/historikk", icon: History, exact: false },
  { label: "Konto", href: "/account", icon: User, exact: false },
] as const;

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-card border-border flex w-56 flex-shrink-0 flex-col border-r">
      <div className="border-border flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold tracking-tight">Smartout Admin</span>
      </div>

      <ul className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
