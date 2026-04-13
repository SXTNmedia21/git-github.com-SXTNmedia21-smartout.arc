"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "@smartout/i18n";
import {
  useCommunicationOverview,
  type CommunicationEntry,
} from "../_hooks/use-communication-overview";
import {
  Megaphone,
  FileText,
  ArrowRightLeft,
  Clock,
  Bell,
  CalendarDays,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TYPE_CONFIG: Record<CommunicationEntry["type"], { icon: typeof Megaphone; color: string }> = {
  announcement: { icon: Megaphone, color: "bg-orange-500/15 text-orange-600" },
  brief: { icon: FileText, color: "bg-blue-500/15 text-blue-600" },
  handoff: { icon: ArrowRightLeft, color: "bg-purple-500/15 text-purple-600" },
  reminder: { icon: Clock, color: "bg-amber-500/15 text-amber-600" },
  summary: { icon: Bell, color: "bg-green-500/15 text-green-600" },
  planning_event: { icon: CalendarDays, color: "bg-cyan-500/15 text-cyan-600" },
};

type FilterType = CommunicationEntry["type"] | "all";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return `I dag ${date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays === 1) return "I går";
  if (diffDays < 7) return `${diffDays} dager siden`;
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

function groupByDate(entries: CommunicationEntry[]): Map<string, CommunicationEntry[]> {
  const groups = new Map<string, CommunicationEntry[]>();
  for (const entry of entries) {
    const date = new Date(entry.date);
    const key = date.toLocaleDateString("nb-NO", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const existing = groups.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }
  return groups;
}

export function CommunicationOverview() {
  const { t } = useTranslation("komm");
  const { data: entries, isLoading } = useCommunicationOverview();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: t("overview.filter_all") },
    { key: "announcement", label: t("overview.filter_announcement") },
    { key: "brief", label: t("overview.filter_brief") },
    { key: "handoff", label: t("overview.filter_handoff") },
    { key: "reminder", label: t("overview.filter_reminder") },
    { key: "planning_event", label: t("overview.filter_event") },
  ];

  const filtered = useMemo(() => {
    if (!entries) return [];
    if (activeFilter === "all") return entries;
    return entries.filter((e) => e.type === activeFilter);
  }, [entries, activeFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="bg-muted h-3 w-24 animate-pulse rounded" />
              <div className="bg-muted h-4 w-full animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1 border-b px-3 py-2">
        {filters.map(({ key, label }) => (
          <Button
            key={key}
            variant={activeFilter === key ? "secondary" : "ghost"}
            size="sm"
            className="h-6 rounded-full px-2.5 text-[11px]"
            onClick={() => setActiveFilter(key)}
          >
            {key === "all" && <Filter className="mr-1 h-3 w-3" />}
            {label}
          </Button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8">
            <p className="text-muted-foreground text-xs">{t("overview.empty")}</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div className="bg-muted/50 sticky top-0 z-10 px-3 py-1.5">
                <span className="text-muted-foreground text-[11px] font-medium capitalize">
                  {dateLabel}
                </span>
              </div>
              {/* Entries */}
              {items.map((entry) => {
                const config = TYPE_CONFIG[entry.type];
                const Icon = config.icon;
                return (
                  <div
                    key={entry.id}
                    className="hover:bg-accent/50 flex items-start gap-3 px-3 py-2.5 transition-colors"
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        config.color,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold">{entry.title}</span>
                        <span className="text-muted-foreground shrink-0 text-[10px]">
                          {formatDate(entry.date)}
                        </span>
                      </div>
                      <p className="text-foreground/80 mt-0.5 line-clamp-2 text-xs leading-relaxed">
                        {entry.content}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        {entry.channelName && (
                          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                            #{entry.channelName}
                          </span>
                        )}
                        {entry.targetDescription && (
                          <span className="text-muted-foreground text-[10px]">
                            {entry.targetDescription}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
