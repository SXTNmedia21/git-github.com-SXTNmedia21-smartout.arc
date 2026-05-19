"use client";

// ============================================
// GlobalSearchPalette.tsx
// Minimal global Cmd/Ctrl+K search palette for dashboard navigation and scoped search prefixes.
// Exists to provide one non-breaking command surface while backend search APIs are still evolving.
// ============================================

// UI Events:
// - action: openPalette() (Cmd+K / Ctrl+K keyboard shortcut)
// - action: closePalette() (Escape key, backdrop click)
// - action: selectResult(deepLink) (Enter key, click on result item)
// - action: changeMode(prefix) (typing ?, @, > prefix characters)
// - nav: dynamic deep links from search results (e.g. /dashboard/people/:id)

import { useState, useEffect, useCallback, useContext, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  FileText,
  Users,
  BookOpen,
  Terminal,
  ArrowRight,
  Clock,
  Sparkles,
  Calendar,
  Settings,
  BarChart3,
  Shield,
  Building2,
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { parseSearchPrefix, type SearchMode } from "@/lib/search/query-prefix";
import { useSearch, type SearchGroup, type SearchResult } from "@/lib/search/use-search";

// ---------------------------------------------------------------------------
// Static navigation data — used as fallback when query is empty
// ---------------------------------------------------------------------------

const COMMAND_RESULTS: SearchResult[] = [
  {
    id: "cmd-dashboard",
    title: "Oversikt",
    subtitle: "Ga til dashbord",
    deepLink: "/dashboard",
    icon: "command",
  },
  {
    id: "cmd-schedule",
    title: "Vaktplan",
    subtitle: "Ga til vaktplan",
    deepLink: "/dashboard/schedule",
    icon: "command",
  },
  {
    id: "cmd-people",
    title: "Ansatte",
    subtitle: "Ga til ansattoversikt",
    deepLink: "/dashboard/people",
    icon: "command",
  },
  {
    id: "cmd-reports",
    title: "Rapporter",
    subtitle: "Ga til rapporter",
    deepLink: "/dashboard/reports",
    icon: "command",
  },
  {
    id: "cmd-season",
    title: "Årshjul",
    subtitle: "Gå til årshjul og sesongplanlegging",
    deepLink: "/dashboard/year-wheel",
    icon: "command",
  },
  {
    id: "cmd-governance",
    title: "Kvalitetsstyring",
    subtitle: "Ga til HACCP og kontroll",
    deepLink: "/dashboard/governance",
    icon: "command",
  },
  {
    id: "cmd-settings",
    title: "Innstillinger",
    subtitle: "Ga til innstillinger",
    deepLink: "/dashboard/settings",
    icon: "command",
  },
  {
    id: "cmd-contracts",
    title: "Kontrakter",
    subtitle: "Ga til kontrakter og brev",
    deepLink: "/dashboard/people/contracts",
    icon: "command",
  },
  {
    id: "cmd-org",
    title: "Organisasjon",
    subtitle: "Ga til organisasjon",
    deepLink: "/dashboard/organization",
    icon: "command",
  },
];

const PEOPLE_RESULTS: SearchResult[] = [
  {
    id: "p-1",
    title: "Kristian Berg",
    subtitle: "Hovmester",
    deepLink: "/dashboard/people/p-1",
    icon: "person",
  },
  {
    id: "p-2",
    title: "Maren Haugen",
    subtitle: "Bartender",
    deepLink: "/dashboard/people/p-2",
    icon: "person",
  },
  {
    id: "p-3",
    title: "Lars Nilsen",
    subtitle: "Kokk",
    deepLink: "/dashboard/people/p-3",
    icon: "person",
  },
];

const KNOWLEDGE_RESULTS: SearchResult[] = [
  {
    id: "k-1",
    title: "Allergenhandtering",
    subtitle: "Policy - Matsikkerhet",
    deepLink: "/dashboard/governance",
    icon: "knowledge",
  },
  {
    id: "k-2",
    title: "Apningsrutine",
    subtitle: "Protokoll - Daglig drift",
    deepLink: "/dashboard/governance",
    icon: "policy",
  },
  {
    id: "k-3",
    title: "Brannsikkerhet",
    subtitle: "Policy - HMS",
    deepLink: "/dashboard/governance",
    icon: "knowledge",
  },
];

const RECENT_SEARCHES = ["Vaktplan neste uke", "Allergenrutine", "Kristian Berg"];

const SUGGESTED_QUERIES = ["? allergenhandtering", "@ nye ansatte", "> vaktplan"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ICON_MAP = {
  page: FileText,
  person: Users,
  knowledge: BookOpen,
  policy: Shield,
  command: Terminal,
} as const;

const MODE_LABELS: Record<SearchMode, string> = {
  all: "Alle",
  knowledge: "Kunnskap",
  people: "Ansatte",
  commands: "Kommandoer",
};

const MODE_ICONS: Record<SearchMode, typeof Search> = {
  all: Search,
  knowledge: BookOpen,
  people: Users,
  commands: Terminal,
};

function filterResults(results: SearchResult[], query: string): SearchResult[] {
  if (!query) return results;
  const lower = query.toLowerCase();
  return results.filter(
    (r) => r.title.toLowerCase().includes(lower) || r.subtitle.toLowerCase().includes(lower),
  );
}

function getGroupedResults(mode: SearchMode, query: string): SearchGroup[] {
  // Static navigation + mock results — used as fallback when query is empty
  switch (mode) {
    case "knowledge":
      return [{ label: "Kunnskap", results: filterResults(KNOWLEDGE_RESULTS, query) }];
    case "people":
      return [{ label: "Ansatte", results: filterResults(PEOPLE_RESULTS, query) }];
    case "commands":
      return [{ label: "Kommandoer", results: filterResults(COMMAND_RESULTS, query) }];
    case "all":
    default:
      return [
        { label: "Sider", results: filterResults(COMMAND_RESULTS, query).slice(0, 4) },
        { label: "Ansatte", results: filterResults(PEOPLE_RESULTS, query).slice(0, 3) },
        { label: "Kunnskap", results: filterResults(KNOWLEDGE_RESULTS, query).slice(0, 3) },
      ].filter((g) => g.results.length > 0);
  }
}

// Navigation command icons for the "Sider" group
const NAV_ICON_MAP: Record<string, typeof Search> = {
  "cmd-dashboard": BarChart3,
  "cmd-schedule": Calendar,
  "cmd-people": Users,
  "cmd-reports": BarChart3,
  "cmd-season": Sparkles,
  "cmd-governance": Shield,
  "cmd-settings": Settings,
  "cmd-org": Building2,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GlobalSearchPalette() {
  const [open, setOpen] = useState(false);
  const [rawValue, setRawValue] = useState("");
  const { isDark } = useContext(DashboardContext);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = parseSearchPrefix(rawValue);
  const { data: liveGroups } = useSearch(parsed.query, parsed.mode, open);
  // Live API results when user types a query; static navigation commands as fallback when empty
  const groups =
    parsed.query.length > 0 && liveGroups
      ? liveGroups
      : getGroupedResults(parsed.mode, parsed.query);
  const ModeIcon = MODE_ICONS[parsed.mode];

  // Keyboard shortcut: Cmd+K / Ctrl+K.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Programmatic open hook from dashboard shell controls.
  useEffect(() => {
    function handleOpenEvent() {
      setOpen(true);
    }

    window.addEventListener("smartout:open-global-search", handleOpenEvent);
    return () => window.removeEventListener("smartout:open-global-search", handleOpenEvent);
  }, []);

  // Escape closes palette when open.
  useEffect(() => {
    if (!open) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  // Reset input when opening
  useEffect(() => {
    if (open) {
      setRawValue("");
      // Let Dialog content paint before focusing the command input.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const handleSelect = useCallback(
    (deepLink: string) => {
      setOpen(false);
      router.push(deepLink);
    },
    [router],
  );

  if (!open) return null;

  const showEmpty = parsed.query.length > 0 && groups.every((g) => g.results.length === 0);
  const showRecentAndSuggested = parsed.query.length === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Palette */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
        <div className="border-border bg-card shadow-border/50 w-full max-w-[540px] overflow-hidden rounded-xl border shadow-2xl">
          <Command className="bg-card" shouldFilter={false}>
            {/* Input with mode indicator */}
            <div className="flex items-center gap-2 border-b px-3">
              <ModeIcon className="text-muted-foreground h-[18px] w-[18px] shrink-0" />
              {parsed.mode !== "all" && (
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                    isDark ? "bg-orange-500/10 text-orange-400" : "bg-orange-50 text-orange-600"
                  }`}
                >
                  {MODE_LABELS[parsed.mode]}
                </span>
              )}
              <CommandInput
                ref={inputRef}
                value={rawValue}
                onValueChange={setRawValue}
                placeholder="Sok etter sider, ansatte, kunnskap..."
                className="text-foreground placeholder:text-muted-foreground flex-1 border-0"
              />
              <kbd className="border-border bg-muted text-muted-foreground hidden shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline-block">
                ESC
              </kbd>
            </div>

            <CommandList className="bg-card max-h-[360px]">
              {/* Empty state */}
              {showEmpty && (
                <CommandEmpty>
                  <div className="flex flex-col items-center gap-2 py-8">
                    <Search className="text-muted-foreground h-8 w-8" />
                    <p className="text-muted-foreground text-sm font-medium">
                      Ingen resultater for &ldquo;{parsed.query}&rdquo;
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Prov et annet sokeord, eller bruk ? @ &gt; for filtrering
                    </p>
                  </div>
                </CommandEmpty>
              )}

              {/* Recent searches + suggestions (when empty input) */}
              {showRecentAndSuggested && (
                <>
                  <CommandGroup
                    heading={
                      <span className="text-muted-foreground text-xs font-semibold">
                        Nylig sokt
                      </span>
                    }
                  >
                    {RECENT_SEARCHES.map((term) => (
                      <CommandItem
                        key={term}
                        value={term}
                        onSelect={() => setRawValue(term)}
                        className="text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground gap-3"
                      >
                        <Clock className="text-muted-foreground h-[14px] w-[14px]" />
                        <span className="text-sm">{term}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  <CommandSeparator className="bg-border" />

                  <CommandGroup
                    heading={
                      <span className="text-muted-foreground text-xs font-semibold">Forslag</span>
                    }
                  >
                    {SUGGESTED_QUERIES.map((term) => (
                      <CommandItem
                        key={term}
                        value={term}
                        onSelect={() => setRawValue(term)}
                        className="text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground gap-3"
                      >
                        <Sparkles
                          className={`h-[14px] w-[14px] ${
                            isDark ? "text-orange-500/60" : "text-orange-400"
                          }`}
                        />
                        <span className="text-sm font-medium">{term}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {/* Grouped results */}
              {!showRecentAndSuggested &&
                groups.map((group, gi) => (
                  <CommandGroup
                    key={group.label}
                    heading={
                      <span className="text-muted-foreground text-xs font-semibold">
                        {group.label}
                      </span>
                    }
                  >
                    {gi > 0 && <CommandSeparator className="bg-border" />}
                    {group.results.map((result) => {
                      const ResultIcon =
                        result.icon === "command"
                          ? (NAV_ICON_MAP[result.id] ?? ICON_MAP[result.icon])
                          : ICON_MAP[result.icon];
                      return (
                        <CommandItem
                          key={result.id}
                          value={result.id}
                          onSelect={() => handleSelect(result.deepLink)}
                          className="group/item text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground gap-3"
                        >
                          <ResultIcon className="text-muted-foreground h-[16px] w-[16px] shrink-0" />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold">{result.title}</span>
                            <span className="text-muted-foreground truncate text-xs">
                              {result.subtitle}
                            </span>
                          </div>
                          <ArrowRight className="text-muted-foreground h-[14px] w-[14px] shrink-0 opacity-0 transition-opacity group-data-[selected=true]/item:opacity-100" />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
            </CommandList>

            {/* Footer with mode hints */}
            <div className="border-border flex items-center gap-3 border-t px-3 py-2">
              <span className="text-muted-foreground text-[11px]">
                <kbd className="font-mono font-semibold">?</kbd> kunnskap
              </span>
              <div className="bg-border h-3 w-px" />
              <span className="text-muted-foreground text-[11px]">
                <kbd className="font-mono font-semibold">@</kbd> ansatte
              </span>
              <div className="bg-border h-3 w-px" />
              <span className="text-muted-foreground text-[11px]">
                <kbd className="font-mono font-semibold">&gt;</kbd> kommandoer
              </span>
              <div className="flex-1" />
              <span className="text-muted-foreground text-[11px]">
                <kbd className="font-mono font-semibold">&uarr;&darr;</kbd> naviger
                <span className="mx-1">&middot;</span>
                <kbd className="font-mono font-semibold">&crarr;</kbd> velg
              </span>
            </div>
          </Command>
        </div>
      </div>
    </>
  );
}
