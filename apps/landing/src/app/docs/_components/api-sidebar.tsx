"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Search, Menu, X } from "lucide-react";

type NavItem = { id: string; label: string };
type NavSection = { title: string; items: NavItem[] };

const navigation: NavSection[] = [
  {
    title: "API-oversikt",
    items: [
      { id: "oversikt", label: "Oversikt" },
      { id: "autentisering", label: "Autentisering" },
      { id: "rate-limits", label: "Rate limits" },
      { id: "feilformat", label: "Feilformat" },
    ],
  },
  {
    title: "Route Handlers",
    items: [
      { id: "get-health", label: "Health" },
      { id: "get-auth-callback", label: "Auth Callback" },
      { id: "get-content-slug", label: "Content" },
      { id: "post-docs-agent", label: "Docs Agent" },
      { id: "post-wizard-start", label: "Voice Mission" },
      { id: "post-onboarding-agent", label: "Onboarding Agent" },
      { id: "post-telemetry", label: "Telemetry" },
      { id: "post-webhooks-docuseal", label: "DocuSeal Webhook" },
    ],
  },
  {
    title: "Edge Functions",
    items: [
      { id: "fn-gather", label: "Gather Intelligence" },
      { id: "fn-analyze", label: "Analyze Workspace" },
      { id: "fn-finalize", label: "Finalize Workspace" },
      { id: "fn-activate", label: "Activate Workspace" },
      { id: "fn-invite", label: "Create Invitation" },
      { id: "fn-extract", label: "Extract Data" },
      { id: "fn-scrape-raw", label: "Scrape Raw" },
      { id: "fn-websearch", label: "Web Search" },
      { id: "fn-monitoring", label: "Monitoring" },
    ],
  },
  {
    title: "Admin API",
    items: [
      { id: "platform-admin", label: "Platform Admin" },
      { id: "interne-tjenester", label: "Internal Services" },
    ],
  },
];

export function ApiSidebar({ activeId }: { activeId?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = query
    ? navigation
        .map((s) => ({
          ...s,
          items: s.items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
        }))
        .filter((s) => s.items.length > 0)
    : navigation;

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
            placeholder="Søk endepunkter..."
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
                  className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "font-semibold text-orange-400"
                      : "text-zinc-400 hover:bg-white/3 hover:text-white"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 px-4 py-3">
        <Link
          href="/docs"
          className="block rounded-md px-2 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-white"
        >
          ← Tilbake til dokumentasjon
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
