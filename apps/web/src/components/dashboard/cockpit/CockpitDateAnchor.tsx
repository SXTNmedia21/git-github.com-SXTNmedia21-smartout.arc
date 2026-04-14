"use client";

// ============================================
// CockpitDateAnchor.tsx
// Date anchor bar for the cockpit. All cockpit
// panels (Drift, Forberedelse) read from this
// anchor. Defaults to today in workspace tz.
// Exists so multi-timezone operators and iPad
// bookmarks can target a specific operational day.
// ============================================

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCockpitDateAnchor } from "@/app/dashboard/_hooks/use-cockpit-date-anchor";
import { formatAnchorLabel, shiftIsoDate } from "@/app/dashboard/_lib/cockpit/date-anchor";

type CockpitDateAnchorProps = {
  /** Optional external mirror — parent receives the current anchor. */
  onChange?: (anchorDate: string) => void;
};

/**
 * Renders the cockpit date anchor bar: arrow navigation + preset chips +
 * calendar popover. Watches for day rollover and nudges the user back to
 * "today" rather than silently jumping under them.
 */
export function CockpitDateAnchor({ onChange }: CockpitDateAnchorProps) {
  const { t } = useTranslation("dashboard");
  const { anchorDate, workspaceToday, isToday, setAnchorDate, goPrev, goNext, goToday } =
    useCockpitDateAnchor();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [showRolloverHint, setShowRolloverHint] = useState(false);

  useEffect(() => {
    onChange?.(anchorDate);
  }, [anchorDate, onChange]);

  // Surface a gentle nudge if the workspace calendar has rolled over while
  // the user stayed on the cockpit. We never auto-jump — we ask.
  useEffect(() => {
    if (!isToday && anchorDate < workspaceToday) {
      setShowRolloverHint(true);
    } else {
      setShowRolloverHint(false);
    }
  }, [anchorDate, isToday, workspaceToday]);

  const tomorrow = shiftIsoDate(workspaceToday, 1);
  const isTomorrow = anchorDate === tomorrow;

  return (
    <div
      data-testid="cockpit-date-anchor"
      className="border-border/30 bg-card/40 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 backdrop-blur-sm"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("cockpit.anchor_prev")}
        onClick={goPrev}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" className="h-8 gap-2 px-2 font-medium">
            <CalendarIcon className="h-4 w-4" />
            <span className="capitalize">{formatAnchorLabel(anchorDate)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={parseIso(anchorDate)}
            onSelect={(day) => {
              if (!day) return;
              const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
              setAnchorDate(iso);
              setPopoverOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("cockpit.anchor_next")}
        onClick={goNext}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <div className="bg-border/40 mx-1 h-5 w-px" />

      <Button
        type="button"
        variant={isToday ? "secondary" : "ghost"}
        size="sm"
        onClick={goToday}
        className="h-8 px-2.5 text-xs"
      >
        {t("cockpit.anchor_today")}
      </Button>
      <Button
        type="button"
        variant={isTomorrow ? "secondary" : "ghost"}
        size="sm"
        onClick={() => setAnchorDate(tomorrow)}
        className="h-8 px-2.5 text-xs"
      >
        {t("cockpit.anchor_tomorrow")}
      </Button>

      {showRolloverHint && (
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t("cockpit.anchor_day_shifted")}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goToday}
            className="h-7 px-2 text-xs"
          >
            {t("cockpit.anchor_go_today")}
          </Button>
        </div>
      )}
    </div>
  );
}

function parseIso(iso: string): Date | undefined {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
