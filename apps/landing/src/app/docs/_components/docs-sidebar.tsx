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

export function DocsSidebar({
  navigation,
  locale,
}: {
  navigation: DocsNavItem[];
  locale?: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNav = searchQuery
    ? navigation.filter((item) => item.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : navigation;

  const sidebar = (
    <div className="bg-card text-foreground flex h-full flex-col">
      <div className="border-border border-b p-5">
        <Link href="/" className="mb-5 flex items-center gap-2">
          <Building2 className="text-brand-orange h-4 w-4" />
          <span className="text-base font-black tracking-tighter">SmartOut</span>
          <span className="text-muted-foreground ml-1 text-xs font-semibold">Docs</span>
        </Link>

        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Søk i dokumentasjonen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border/50 bg-background placeholder:text-muted-foreground focus:border-brand-orange/40 focus:ring-brand-orange/20 w-full rounded-xl border py-2.5 pr-4 pl-10 text-sm transition-all focus:ring-1 focus:outline-none"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {filteredNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
              pathname === item.href
                ? "border-brand-orange/20 bg-brand-orange/10 text-brand-orange border"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground border border-transparent"
            }`}
          >
            <BookOpen
              className={`mt-0.5 h-4 w-4 shrink-0 ${pathname === item.href ? "text-brand-orange" : "text-muted-foreground/60"}`}
            />
            <span className="min-w-0">
              <span className="block text-sm leading-tight font-semibold">{item.title}</span>
              <span className="mt-1 line-clamp-2 block text-xs leading-relaxed opacity-80">
                {item.description}
              </span>
            </span>
          </Link>
        ))}

        {filteredNav.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Ingen resultater for &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </nav>

      <div className="border-border border-t p-4">
        <Link
          href="/pricing"
          className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
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
        className="border-border/50 bg-background/90 text-muted-foreground hover:text-foreground fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl border backdrop-blur-xl transition-colors lg:hidden"
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

      {/* Sidebar container */}
      <div
        className={`border-border fixed inset-y-0 left-0 z-40 w-72 transform border-r transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </div>
    </>
  );
}
