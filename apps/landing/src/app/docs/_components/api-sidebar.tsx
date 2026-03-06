"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Search, Menu, X } from "lucide-react";

type Tier = "public" | "internal" | "admin";
type NavItem = { id: string; label: string; tier?: Tier };
type NavSection = { title: string; items: NavItem[] };

const navigation: NavSection[] = [
  {
    title: "Introduction",
    items: [
      { id: "overview", label: "Overview" },
      { id: "authentication", label: "Authentication" },
      { id: "rate-limits", label: "Rate Limits" },
      { id: "errors", label: "Errors" },
      { id: "pagination", label: "Pagination" },
    ],
  },
  {
    title: "Organization",
    items: [
      { id: "get-profiles", label: "List Profiles", tier: "public" },
      { id: "get-departments", label: "List Departments", tier: "public" },
      { id: "get-teams", label: "List Teams", tier: "public" },
      { id: "get-locations", label: "List Locations", tier: "public" },
    ],
  },
  {
    title: "Contracts",
    items: [{ id: "get-contracts", label: "List Contracts", tier: "public" }],
  },
  {
    title: "Training",
    items: [
      { id: "get-protocols", label: "List Protocols", tier: "public" },
      { id: "get-assignments", label: "List Assignments", tier: "public" },
    ],
  },
  {
    title: "Schedules",
    items: [
      { id: "get-shifts", label: "List Shifts", tier: "public" },
      { id: "get-absences", label: "List Absences", tier: "public" },
    ],
  },
  {
    title: "Operations",
    items: [
      { id: "get-sessions", label: "List Sessions", tier: "public" },
      { id: "get-deviations", label: "List Deviations", tier: "public" },
    ],
  },
  {
    title: "Reports",
    items: [
      { id: "get-reconciliations", label: "List Reconciliations", tier: "public" },
      { id: "get-shift-approvals", label: "List Shift Approvals", tier: "public" },
      { id: "get-kpi-targets", label: "List KPI Targets", tier: "public" },
      { id: "get-budgets", label: "List Budgets", tier: "public" },
    ],
  },
  {
    title: "Guardian",
    items: [
      { id: "get-signals", label: "List Signals", tier: "public" },
      { id: "get-guardian-log", label: "Guardian Log", tier: "public" },
    ],
  },
  {
    title: "Events",
    items: [{ id: "get-events", label: "List Events", tier: "public" }],
  },
  {
    title: "Suppliers",
    items: [
      { id: "get-suppliers", label: "List Suppliers", tier: "public" },
      { id: "get-supplier-orders", label: "List Orders", tier: "public" },
    ],
  },
  {
    title: "Waste",
    items: [{ id: "get-waste-logs", label: "List Waste Logs", tier: "public" }],
  },
  {
    title: "Equipment",
    items: [
      { id: "get-assets", label: "List Assets", tier: "public" },
      { id: "get-asset-maintenance", label: "Maintenance Log", tier: "public" },
      { id: "get-asset-downtime", label: "Downtime Log", tier: "public" },
    ],
  },
  {
    title: "Internal",
    items: [{ id: "internal-routes", label: "Dashboard & Landing", tier: "internal" }],
  },
  {
    title: "Admin",
    items: [{ id: "admin-endpoints", label: "Platform Admin", tier: "admin" }],
  },
  {
    title: "Reference",
    items: [{ id: "scopes", label: "Scopes" }],
  },
];

export function ApiSidebar({
  activeId,
  activeTiers,
}: {
  activeId?: string;
  activeTiers?: Set<Tier>;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  const tiers = activeTiers ?? new Set<Tier>(["public", "internal", "admin"]);

  const filtered = navigation
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        if (i.tier && !tiers.has(i.tier)) return false;
        if (query && !i.label.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    }))
    .filter((s) => s.items.length > 0);

  const tierDot: Record<Tier, string> = {
    public: "bg-emerald-400",
    internal: "bg-amber-400",
    admin: "bg-rose-400",
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="border-b border-white/5 px-5 py-4">
        <Link href="/docs" className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-black tracking-tighter text-white">SmartOut</span>
          <span className="ml-auto rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-[11px] font-bold text-fuchsia-400">
            API
          </span>
        </Link>
      </div>

      {/* Search */}
      <div className="border-b border-white/5 px-4 py-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search endpoints..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-white/5 bg-white/3 py-2 pr-3 pl-8 text-sm text-white placeholder:text-zinc-600 focus:border-fuchsia-500/30 focus:outline-none"
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {filtered.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="mb-1.5 px-2 text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = activeId === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "font-semibold text-orange-400"
                      : "text-zinc-400 hover:bg-white/3 hover:text-white"
                  }`}
                >
                  {item.tier && (
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tierDot[item.tier]}`} />
                  )}
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Tier legend */}
      <div className="border-t border-white/5 px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
          {(["public", "internal", "admin"] as Tier[]).map((t) => (
            <div
              key={t}
              className={`flex items-center gap-1 text-[10px] ${tiers.has(t) ? "text-zinc-400" : "text-zinc-700"}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tierDot[t]}`} />
              {t}
            </div>
          ))}
        </div>
        <Link
          href="/docs"
          className="block rounded-md px-2 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-white"
        >
          &larr; Back to docs
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-60 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#0a0a0c]/90 text-zinc-400 backdrop-blur-xl lg:hidden"
        aria-label="Toggle API menu"
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-55 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop */}
      <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-white/5 bg-[#08080c] lg:flex">
        {sidebar}
      </aside>

      {/* Mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-58 w-72 transform border-r border-white/5 bg-[#08080c] transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>
    </>
  );
}
