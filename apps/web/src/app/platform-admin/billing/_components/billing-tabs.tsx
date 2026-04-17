"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Five-tab nav for the billing hub. Renders a pill row; active pill is
// derived from pathname (not Radix Tabs state) because each tab is a
// distinct route with its own Server Component tree. This keeps the
// Server-Component-first pattern per ADR-0115 and avoids hydrating a
// Radix Tabs.Root just for navigation.

const TABS: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  {
    href: "/platform-admin/billing",
    label: "Oversikt",
    match: (p) => p === "/platform-admin/billing",
  },
  {
    href: "/platform-admin/billing/invoices",
    label: "Fakturaer",
    match: (p) => p.startsWith("/platform-admin/billing/invoices"),
  },
  {
    href: "/platform-admin/billing/dunning",
    label: "Purring",
    match: (p) => p.startsWith("/platform-admin/billing/dunning"),
  },
  {
    href: "/platform-admin/billing/export",
    label: "Eksport",
    match: (p) => p.startsWith("/platform-admin/billing/export"),
  },
  {
    href: "/platform-admin/billing/drift",
    label: "Drift",
    match: (p) => p.startsWith("/platform-admin/billing/drift"),
  },
  {
    href: "/platform-admin/billing/integrations",
    label: "Integrasjoner",
    match: (p) => p.startsWith("/platform-admin/billing/integrations"),
  },
];

export function BillingTabs() {
  const pathname = usePathname();

  return (
    <nav className="border-border/40 flex gap-1 border-b">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px inline-flex items-center border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
