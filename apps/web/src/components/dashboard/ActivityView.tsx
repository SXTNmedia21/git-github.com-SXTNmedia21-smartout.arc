"use client";

import { Activity, BarChart2 } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useActivityFeed } from "@/app/dashboard/_hooks/use-activity-feed";
import type { ActivityEntry } from "@/app/dashboard/_hooks/use-activity-feed";

export function ActivityView() {
  const { t } = useTranslation("dashboard");

  return (
    <div className="animate-in fade-in flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto pr-2 pb-6 duration-500">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-col justify-between gap-4 pt-2 md:flex-row md:items-center">
        <div>
          <h1 className="text-foreground flex items-center gap-3 text-2xl font-black tracking-tight">
            <div className="rounded-xl bg-indigo-500/15 p-2 text-indigo-500 dark:shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <Activity className="h-5 w-5" />
            </div>
            Aktivitet
          </h1>
        </div>
      </div>

      {/* Heatmap coming soon — replaces the mock data heatmap, filters and quick stats */}
      <div className="border-border bg-background flex flex-col items-center justify-center rounded-3xl border p-16 shadow-sm">
        <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
          <BarChart2 className="text-muted-foreground h-7 w-7" />
        </div>
        <h2 className="text-foreground text-lg font-bold">{t("activity.coming_soon_title")}</h2>
        <p className="text-muted-foreground mt-1 max-w-md text-center text-sm">
          {t("activity.coming_soon_description")}
        </p>
      </div>

      {/* Activity feed — real data from activity_trail */}
      <ActivityDetailPanel />
    </div>
  );
}

function ActivityDetailPanel() {
  const { data: feed, isLoading } = useActivityFeed({
    limit: 30,
    filters: { timeRange: "today" },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="border-border bg-muted/10 h-10 animate-pulse rounded-lg border"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    );
  }

  if (!feed?.length) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        Ingen aktivitet registrert i dag ennå.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
        Aktivitetslogg — i dag
      </p>
      {feed.map((entry: ActivityEntry) => {
        const time = new Date(entry.createdAt).toLocaleTimeString("nb-NO", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const isWarning = entry.event.includes("late") || entry.event.includes("deviation");

        return (
          <div
            key={entry.id}
            className="border-border flex items-center gap-3 rounded-lg border p-2"
          >
            <span className="text-muted-foreground w-12 font-mono text-xs">{time}</span>
            {isWarning && <div className="h-2 w-2 shrink-0 rounded-full bg-orange-400" />}
            <span className="text-foreground flex-1 truncate text-sm">
              <span className="font-semibold">{entry.actorName}</span>
              <span className="text-muted-foreground"> — {entry.description}</span>
            </span>
            <span className="text-muted-foreground shrink-0 text-[10px] font-medium uppercase">
              {entry.category}
            </span>
          </div>
        );
      })}
    </div>
  );
}
