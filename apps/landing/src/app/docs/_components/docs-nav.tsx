"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  Search,
  Menu,
  X,
  Rocket,
  UserPlus,
  CalendarDays,
  Users,
  ClipboardCheck,
  ShieldCheck,
  MessageSquare,
  Bot,
  BarChart3,
  Settings,
  Braces,
  type LucideIcon,
} from "lucide-react";

type NavItem = { label: string; href: string; icon: LucideIcon };
type NavSection = { title: string; items: NavItem[] };

const navigation: NavSection[] = [
  {
    title: "Kom i gang",
    items: [
      { label: "Kom i gang", href: "/docs/kom-i-gang", icon: Rocket },
      { label: "Onboarding", href: "/docs/onboarding", icon: UserPlus },
    ],
  },
  {
    title: "Moduler",
    items: [
      { label: "Vaktplan", href: "/docs/vaktplan", icon: CalendarDays },
      { label: "Ansatte", href: "/docs/ansatte", icon: Users },
      { label: "Oppgaver og rutiner", href: "/docs/oppgaver-rutiner", icon: ClipboardCheck },
      { label: "HACCP", href: "/docs/haccp", icon: ShieldCheck },
      { label: "Kommunikasjon", href: "/docs/kommunikasjon", icon: MessageSquare },
      { label: "Lise AI-assistent", href: "/docs/ai-assistent", icon: Bot },
      { label: "Rapporter", href: "/docs/rapporter", icon: BarChart3 },
      { label: "Innstillinger", href: "/docs/innstillinger", icon: Settings },
    ],
  },
  {
    title: "Referanse",
    items: [{ label: "API dokumentasjon", href: "/docs/api", icon: Braces }],
  },
];

export function DocsNav() {
  const pathname = usePathname();
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
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-black tracking-tighter text-white">SmartOut</span>
          <span className="ml-auto rounded bg-orange-500/15 px-1.5 py-0.5 text-[11px] font-bold text-orange-400">
            Docs
          </span>
        </Link>
      </div>

      {/* Search */}
      <div className="border-b border-white/5 px-4 py-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Søk i dokumentasjonen..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-white/5 bg-white/3 py-2 pr-3 pl-8 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/30 focus:outline-none"
          />
        </div>
      </div>

      {/* Overview link */}
      <div className="border-b border-white/5 px-3 py-2">
        <Link
          href="/docs"
          className={`block rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
            pathname === "/docs"
              ? "text-orange-400"
              : "text-zinc-300 hover:bg-white/3 hover:text-white"
          }`}
        >
          Oversikt
        </Link>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {filtered.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="mb-1.5 px-2 text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "font-semibold text-orange-400"
                      : "text-zinc-400 hover:bg-white/3 hover:text-white"
                  }`}
                >
                  <item.icon
                    className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-orange-400" : "text-zinc-600"}`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-1 border-t border-white/5 px-4 py-3">
        <Link
          href="/pricing"
          className="block rounded-md px-2 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-white"
        >
          Trenger du hjelp? Kontakt oss
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#0a0a0c]/90 text-zinc-400 backdrop-blur-xl lg:hidden"
        aria-label="Toggle docs menu"
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop */}
      <aside className="hidden h-full w-56 shrink-0 flex-col border-r border-white/5 bg-[#08080c] lg:flex">
        {sidebar}
      </aside>

      {/* Mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-45 w-72 transform border-r border-white/5 bg-[#08080c] transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>
    </>
  );
}
