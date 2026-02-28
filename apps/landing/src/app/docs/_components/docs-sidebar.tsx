"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Building2, Search, Menu, X, BookOpen } from "lucide-react";

type DocsNavItem = {
  title: string;
  href: string;
  description: string;
};

export function DocsSidebar({ navigation }: { navigation: DocsNavItem[] }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNav = searchQuery
    ? navigation.filter((item) => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : navigation;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/5 p-5">
        <Link href="/" className="mb-5 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-orange-500" />
          <span className="text-base font-black tracking-tighter text-white">SmartOut</span>
          <span className="ml-1 text-xs font-semibold text-zinc-500">Docs</span>
        </Link>

        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Søk i dokumentasjonen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pr-4 pl-10 text-sm text-white transition-all placeholder:text-zinc-600 focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20 focus:outline-none"
          />
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-4">
        {filteredNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
              pathname === item.href
                ? "border border-orange-500/20 bg-orange-500/10 text-orange-400"
                : "border border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <BookOpen
              className={`mt-0.5 h-4 w-4 shrink-0 ${pathname === item.href ? "text-orange-400" : "text-zinc-500"}`}
            />
            <span className="min-w-0">
              <span className="block text-sm leading-tight font-semibold">{item.title}</span>
              <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-zinc-500">
                {item.description}
              </span>
            </span>
          </Link>
        ))}

        {filteredNav.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-600">
            Ingen resultater for &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </nav>

      <div className="border-t border-white/5 p-4">
        <Link
          href="/pricing"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
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
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#0a0a0c]/90 text-zinc-400 backdrop-blur-xl transition-colors hover:text-white lg:hidden"
        aria-label="Toggle docs menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-white/5 bg-[#0a0a0c]/60 backdrop-blur-xl lg:flex">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw] transform border-r border-white/5 bg-[#0a0a0c] transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>
    </>
  );
}
