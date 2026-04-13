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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  deepLink: string;
  icon: "page" | "person" | "knowledge" | "policy" | "command";
};

type SearchGroup = {
  label: string;
  results: SearchResult[];
};

// ---------------------------------------------------------------------------
// Mock data — replaced by /api/search when available
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
    deepLink: "/dashboard/contracts",
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
  // TODO: Replace with /api/search fetch + TanStack Query when API is ready
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
  const groups = getGroupedResults(parsed.mode, parsed.query);
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
        <div
          className={`w-full max-w-[540px] overflow-hidden rounded-xl border shadow-2xl ${
            isDark
              ? "border-zinc-800 bg-[#0c0c0e] shadow-black/50"
              : "border-zinc-200 bg-white shadow-zinc-300/50"
          }`}
        >
          <Command className={isDark ? "bg-[#0c0c0e]" : "bg-white"} shouldFilter={false}>
            {/* Input with mode indicator */}
            <div className="flex items-center gap-2 border-b px-3">
              <ModeIcon
                className={`h-[18px] w-[18px] shrink-0 ${
                  isDark ? "text-zinc-500" : "text-zinc-400"
                }`}
              />
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
                className={`flex-1 border-0 ${
                  isDark
                    ? "text-zinc-100 placeholder:text-zinc-500"
                    : "text-zinc-900 placeholder:text-zinc-400"
                }`}
              />
              <kbd
                className={`hidden shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline-block ${
                  isDark
                    ? "border-zinc-700 bg-zinc-800 text-zinc-400"
                    : "border-zinc-200 bg-zinc-100 text-zinc-500"
                }`}
              >
                ESC
              </kbd>
            </div>

            <CommandList className={`max-h-[360px] ${isDark ? "bg-[#0c0c0e]" : "bg-white"}`}>
              {/* Empty state */}
              {showEmpty && (
                <CommandEmpty>
                  <div className="flex flex-col items-center gap-2 py-8">
                    <Search className={`h-8 w-8 ${isDark ? "text-zinc-700" : "text-zinc-300"}`} />
                    <p
                      className={`text-sm font-medium ${
                        isDark ? "text-zinc-400" : "text-zinc-500"
                      }`}
                    >
                      Ingen resultater for &ldquo;{parsed.query}&rdquo;
                    </p>
                    <p className={`text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
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
                      <span
                        className={`text-xs font-semibold ${
                          isDark ? "text-zinc-500" : "text-zinc-400"
                        }`}
                      >
                        Nylig sokt
                      </span>
                    }
                  >
                    {RECENT_SEARCHES.map((term) => (
                      <CommandItem
                        key={term}
                        value={term}
                        onSelect={() => setRawValue(term)}
                        className={`gap-3 ${
                          isDark
                            ? "text-zinc-300 data-[selected=true]:bg-zinc-800/80"
                            : "text-zinc-600 data-[selected=true]:bg-zinc-100"
                        }`}
                      >
                        <Clock
                          className={`h-[14px] w-[14px] ${
                            isDark ? "text-zinc-600" : "text-zinc-400"
                          }`}
                        />
                        <span className="text-sm">{term}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  <CommandSeparator className={isDark ? "bg-zinc-800/50" : "bg-zinc-100"} />

                  <CommandGroup
                    heading={
                      <span
                        className={`text-xs font-semibold ${
                          isDark ? "text-zinc-500" : "text-zinc-400"
                        }`}
                      >
                        Forslag
                      </span>
                    }
                  >
                    {SUGGESTED_QUERIES.map((term) => (
                      <CommandItem
                        key={term}
                        value={term}
                        onSelect={() => setRawValue(term)}
                        className={`gap-3 ${
                          isDark
                            ? "text-zinc-300 data-[selected=true]:bg-zinc-800/80"
                            : "text-zinc-600 data-[selected=true]:bg-zinc-100"
                        }`}
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
                      <span
                        className={`text-xs font-semibold ${
                          isDark ? "text-zinc-500" : "text-zinc-400"
                        }`}
                      >
                        {group.label}
                      </span>
                    }
                  >
                    {gi > 0 && (
                      <CommandSeparator className={isDark ? "bg-zinc-800/50" : "bg-zinc-100"} />
                    )}
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
                          className={`group/item gap-3 ${
                            isDark
                              ? "text-zinc-300 data-[selected=true]:bg-zinc-800/80"
                              : "text-zinc-600 data-[selected=true]:bg-zinc-100"
                          }`}
                        >
                          <ResultIcon
                            className={`h-[16px] w-[16px] shrink-0 ${
                              isDark ? "text-zinc-500" : "text-zinc-400"
                            }`}
                          />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold">{result.title}</span>
                            <span
                              className={`truncate text-xs ${
                                isDark ? "text-zinc-500" : "text-zinc-400"
                              }`}
                            >
                              {result.subtitle}
                            </span>
                          </div>
                          <ArrowRight
                            className={`h-[14px] w-[14px] shrink-0 opacity-0 transition-opacity group-data-[selected=true]/item:opacity-100 ${
                              isDark ? "text-zinc-500" : "text-zinc-400"
                            }`}
                          />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
            </CommandList>

            {/* Footer with mode hints */}
            <div
              className={`flex items-center gap-3 border-t px-3 py-2 ${
                isDark ? "border-zinc-800/50" : "border-zinc-100"
              }`}
            >
              <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                <kbd className="font-mono font-semibold">?</kbd> kunnskap
              </span>
              <div className={`h-3 w-px ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`} />
              <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                <kbd className="font-mono font-semibold">@</kbd> ansatte
              </span>
              <div className={`h-3 w-px ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`} />
              <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
                <kbd className="font-mono font-semibold">&gt;</kbd> kommandoer
              </span>
              <div className="flex-1" />
              <span className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
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
