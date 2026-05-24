"use client";

/**
 * TimelineTopBar — topbar row (60px) for the Manager Timeline page.
 *
 * Layout: three zones in a horizontal flex container:
 *   LEFT   — brand wordmark "Dagslinjen" (Instrument Serif) + search + bell + voice
 *   CENTER — date stepper (prev ← date label → next) in Geist Mono
 *   RIGHT  — manager pill + "Lukk dagen → AVV" CTA (disabled V1)
 *
 * V1 constraints:
 *   - Lukk-dagen button is always disabled; no action wired yet.
 *   - Voice icon present; no action wired yet.
 *   - All strings via t() from the "oppgaver" namespace.
 *
 * Design: Nordic Split tokens only — no OKLCH literals, no zinc/gray/slate classes.
 * Icons: Lucide React only.
 */

import { Search, Bell, Mic, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@smartout/i18n";

type Props = {
  /** ISO date string, e.g. "2026-05-24" */
  dateISO: string;
  /** Human-readable date label, e.g. "Lør 24. mai 2026" */
  dateLabel: string;
  /** Manager's first name shown in the right pill, e.g. "Sofia" */
  managerName: string;
  onPrevDay: () => void;
  onNextDay: () => void;
};

export function TimelineTopBar({ dateISO, dateLabel, managerName, onPrevDay, onNextDay }: Props) {
  const { t } = useTranslation("oppgaver");

  return (
    <header
      className="border-border bg-card flex h-full items-center justify-between border-b px-4"
      role="banner"
    >
      {/* ── LEFT: brand + utility icons ─────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="font-heading text-foreground text-xl leading-none select-none">
          {t("oppgaver.brand")}
        </span>

        <Button
          variant="ghost"
          size="icon"
          aria-label={t("oppgaver.search_aria")}
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={t("oppgaver.notifications_aria")}
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={t("oppgaver.voice_aria")}
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <Mic className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* ── CENTER: date stepper ─────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("oppgaver.prev_day_aria")}
          onClick={onPrevDay}
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>

        <time
          dateTime={dateISO}
          className="text-foreground font-mono text-sm tabular-nums select-none"
        >
          {dateLabel}
        </time>

        <Button
          variant="ghost"
          size="icon"
          aria-label={t("oppgaver.next_day_aria")}
          onClick={onNextDay}
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* ── RIGHT: manager pill + Lukk-dagen CTA ────────────────── */}
      <div className="flex items-center gap-3">
        <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-sm select-none">
          {managerName}
        </span>

        {/*
         * Lukk-dagen is disabled in V1.
         * Wire action + C4 gate in a future sortie when Day-close flow is spec'd.
         */}
        <Button
          variant="default"
          disabled
          aria-label={t("oppgaver.lukk_dagen")}
          className="h-8 text-sm"
        >
          {t("oppgaver.lukk_dagen")}
        </Button>
      </div>
    </header>
  );
}
