"use client";

/**
 * TimelineTopBar — topbar row (60px) for the Manager Timeline page.
 *
 * Layout: three zones in a horizontal flex container:
 *   LEFT   — LayoutGrid icon + "Dagslinjen" brand (Instrument Serif) + workspace sub-label
 *   CENTER — LocationSwitcherPill (Område filter) + date stepper (prev ← date → next)
 *   RIGHT  — Søk icon + Bell icon + Mic icon + "Lukk dagen → AVV" CTA + manager avatar-pill
 *
 * Props:
 *   dateISO, dateLabel, managerName — preserved from V1
 *   onPrevDay, onNextDay            — preserved from V1
 *   workspaceId, profileId          — required for LocationSwitcherPill + telemetry
 *   workspaceName                   — shown as sub-label under "Dagslinjen" brand
 *
 * Telemetry (L-0176 — emit() call-sites in same file as handlers):
 *   oppgaver.close_day_clicked — on "Lukk dagen → AVV" button click (stub; no
 *     gate wired yet — day-close flow spec'd in future sortie).
 *
 * Design: Nordic Split tokens only. No OKLCH literals (ADR-0366).
 * No hardcoded zinc/gray/slate (ADR-0361).
 * Icons: Lucide React only. No emojis.
 */

import { useCallback, useContext } from "react";
import { Search, Bell, Mic, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { LocationSwitcherPill } from "./LocationSwitcherPill";

type Props = {
  /** ISO date string, e.g. "2026-05-24" */
  dateISO: string;
  /** Human-readable date label, e.g. "Lør 24. mai 2026" */
  dateLabel: string;
  /** Manager's first name shown in the right pill, e.g. "Sofia" */
  managerName: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  /** workspace_id — used for LocationSwitcherPill data fetch (L-0177) */
  workspaceId: string;
  /** profile_id — used for telemetry emit() (L-0177) */
  profileId: string;
  /** Workspace display name shown as sub-label under "Dagslinjen" */
  workspaceName?: string;
};

/** Derive 1–2 character initials from a name for the avatar fallback. */
function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function TimelineTopBar({
  dateISO,
  dateLabel,
  managerName,
  onPrevDay,
  onNextDay,
  workspaceId,
  profileId,
  workspaceName,
}: Props) {
  const { t } = useTranslation("oppgaver");

  // ── oppgaver.close_day_clicked — stub emit, no gate yet ──────────────────
  const handleCloseDayClick = useCallback(() => {
    if (!workspaceId || !profileId) return;
    void emit({
      event: "oppgaver.close_day_clicked",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        data: { date_iso: dateISO },
      },
    });
    // TODO: wire day-close C4 gate + flow in a future sortie
  }, [workspaceId, profileId, dateISO]);

  return (
    <header
      className="border-border bg-card flex h-full items-center justify-between border-b px-4"
      role="banner"
      data-testid="timeline-top-bar"
    >
      {/* ── LEFT: brand cluster ──────────────────────────────────────── */}
      <div className="flex min-w-0 items-center gap-2">
        <LayoutGrid className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="flex min-w-0 flex-col leading-none">
          <span className="font-heading text-foreground text-lg leading-tight font-semibold select-none">
            {t("brand")}
          </span>
          {workspaceName && (
            <span className="text-muted-foreground truncate text-xs leading-tight select-none">
              {workspaceName}
            </span>
          )}
        </div>
      </div>

      {/* ── CENTER: location switcher + date stepper ─────────────────── */}
      <div className="flex items-center gap-2">
        {/* LocationSwitcherPill renders nothing useful when workspaceId is empty —
            skip render guard prevents a hook-order violation (the hook still fires,
            but enabled=false so no DB call is made per L-0177 guard). */}
        <LocationSwitcherPill workspaceId={workspaceId} profileId={profileId} />

        <Button
          variant="ghost"
          size="icon"
          aria-label={t("prev_day_aria")}
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
          aria-label={t("next_day_aria")}
          onClick={onNextDay}
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* ── RIGHT: utility icons + Lukk-dagen CTA + manager pill ────── */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("search_aria")}
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={t("notifications_aria")}
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {/* Bell dot hidden (no live notification count in V1) */}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={t("voice_aria")}
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <Mic className="h-4 w-4" aria-hidden="true" />
        </Button>

        {/* Separator gap */}
        <span className="bg-border mx-1 inline-block h-5 w-px" aria-hidden="true" />

        {/*
         * Lukk-dagen CTA — fires oppgaver.close_day_clicked telemetry (stub).
         * Day-close C4 gate + full flow wired in future sortie.
         * NOT disabled in V2 so managers can signal intent; the handler is a stub.
         */}
        <Button
          variant="default"
          onClick={handleCloseDayClick}
          aria-label={`${t("close_day")} ${t("close_day_avv_suffix")}`}
          className="h-8 gap-1 px-3 text-sm"
        >
          {t("close_day")}
          <span className="font-mono text-[0.65rem] opacity-80" aria-hidden="true">
            {t("close_day_avv_suffix")}
          </span>
        </Button>

        {/* Manager avatar-pill */}
        <div className="bg-muted flex items-center gap-2 rounded-full px-2 py-1 select-none">
          <Avatar size="sm">
            <AvatarFallback className="text-xs">{initials(managerName)}</AvatarFallback>
          </Avatar>
          <span className="text-foreground max-w-[80px] truncate text-sm">{managerName}</span>
        </div>
      </div>
    </header>
  );
}
