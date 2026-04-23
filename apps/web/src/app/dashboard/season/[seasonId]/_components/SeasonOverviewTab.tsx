"use client";

/**
 * SeasonOverviewTab — Budget-derived season summary with charts.
 *
 * Shows four KPI cards (season goal, daily average, peak staffing, guests/day)
 * and three chart strips (monthly, weekly, hourly) calculated from the season
 * budget and day/hour factor tables.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@smartout/i18n";
import { useSeasonBudget, useDayFactors, useHourFactors } from "@/app/dashboard/year-wheel/_hooks";
import { useSeasonOperatingHours } from "@/app/dashboard/year-wheel/_hooks";
import { useOperatingHours } from "@/app/dashboard/settings/_hooks/use-operating-hours";
import {
  calculateDayTargets,
  calculateHourTargets,
  calculateStaffingNeed,
} from "@/lib/season-calculations";
import {
  DollarSign,
  Users,
  Clock,
  TrendingUp,
  Archive,
  Copy,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { yearWheelKeys } from "@smartout/year-wheel";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SeasonActivationProposalModal } from "@/app/dashboard/year-wheel/_components/SeasonActivationProposalModal";
import { archiveSeasonAction } from "@/app/dashboard/_actions/archive-season-action";
import { duplicateSeasonAction } from "@/app/dashboard/_actions/duplicate-season-action";

// Parses "HH:MM" time strings to integer hours for operating hours calculations.
function parseTimeToHour(time: string): number {
  return parseInt(time.split(":")[0] ?? "0", 10);
}

type Props = {
  seasonId: string;
  seasonBudgetId: string;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  seasonName: string;
  seasonStatus: "draft" | "active" | "archived";
};

/** Weekday key suffixes indexed by weekday number (0=Mon … 6=Sun). */
const WEEKDAY_KEYS = [
  "yearWheel.weekday_mon",
  "yearWheel.weekday_tue",
  "yearWheel.weekday_wed",
  "yearWheel.weekday_thu",
  "yearWheel.weekday_fri",
  "yearWheel.weekday_sat",
  "yearWheel.weekday_sun",
] as const;

export function SeasonOverviewTab({
  seasonId,
  seasonBudgetId,
  seasonStartDate,
  seasonEndDate,
  seasonName,
  seasonStatus,
}: Props) {
  const { t } = useTranslation("dashboard");
  const { t: tYearWheel } = useTranslation("year-wheel");
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();
  const queryClient = useQueryClient();

  // ADR-0200 §Decision Layer 3 "Activate-button wiring — IN M1 SCOPE" +
  // Invariant 13. Mounts SeasonActivationProposalModal behind the CTA
  // at tab level. Enablement rules:
  //   - draft: button enabled, label "Aktiver sesong"
  //   - active: button disabled, label "Aktivert"
  //   - archived: button enabled, label "Aktiver på nytt" (RPC is
  //     already_active-safe; the preview-noop state shows if it's a no-op).
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [isArchivePending, startArchive] = useTransition();
  const [isDuplicatePending, startDuplicate] = useTransition();
  const router = useRouter();
  const isActive = seasonStatus === "active";
  const isArchived = seasonStatus === "archived";
  const ctaLabel = isActive
    ? tYearWheel("seasonActivation.cta.alreadyActive")
    : isArchived
      ? tYearWheel("seasonActivation.cta.reactivate")
      : tYearWheel("seasonActivation.cta.activate");

  const handleArchive = () => {
    startArchive(async () => {
      const result = await archiveSeasonAction(seasonId);
      if (result.ok) {
        if (result.was_already_archived) {
          toast.info(tYearWheel("seasonActions.archive.toastAlreadyArchived"));
        } else {
          toast.success(tYearWheel("seasonActions.archive.toastSuccess"));
        }
        if (wsId) {
          queryClient.invalidateQueries({ queryKey: yearWheelKeys.seasons(wsId) });
        }
        setArchiveOpen(false);
        router.refresh();
      } else {
        toast.error(tYearWheel("seasonActions.archive.toastError"));
      }
    });
  };

  const handleDuplicate = () => {
    startDuplicate(async () => {
      const result = await duplicateSeasonAction(seasonId);
      if (result.ok) {
        toast.success(
          tYearWheel("seasonActions.duplicate.toastSuccess", {
            seasonName: result.new_season_name,
          }),
        );
        if (wsId) {
          queryClient.invalidateQueries({ queryKey: yearWheelKeys.seasons(wsId) });
        }
        router.push(`/dashboard/season/${result.new_season_id}`);
      } else {
        toast.error(tYearWheel("seasonActions.duplicate.toastError"));
      }
    });
  };

  const { data: departments } = useQuery({
    queryKey: ["departments", wsId],
    queryFn: async () => {
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", wsId!)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return data ?? [];
    },
    enabled: !!wsId,
  });

  const firstDeptId = departments?.[0]?.department_id;

  const { budget } = useSeasonBudget(seasonId);
  const { dayFactors } = useDayFactors(seasonBudgetId);
  const { hourFactors } = useHourFactors(seasonBudgetId);
  // Prefer season-specific operating hours; fall back to default (season_id=NULL) hours
  const { hours: seasonHours, hasSeasonHours } = useSeasonOperatingHours(seasonId);
  const { hours: defaultHoursRaw } = useOperatingHours(firstDeptId);
  const operatingHours = hasSeasonHours ? seasonHours : defaultHoursRaw || [];

  // Derive the earliest open and latest close time across all operating day records.
  const opHours = useMemo(() => {
    if (!operatingHours || operatingHours.length === 0) return { openHour: 10, closeHour: 22 };
    const openTimes = operatingHours.filter((oh) => !oh.is_closed);
    if (openTimes.length === 0) return { openHour: 10, closeHour: 22 };
    return {
      openHour: Math.min(...openTimes.map((oh) => parseTimeToHour(oh.open_time ?? "10:00"))),
      closeHour: Math.max(...openTimes.map((oh) => parseTimeToHour(oh.close_time ?? "22:00"))),
    };
  }, [operatingHours]);

  // Spread total season revenue across every day weighted by day factors.
  const sampleDayTargets = useMemo(() => {
    if (!budget || !seasonStartDate || !seasonEndDate) return [];

    return calculateDayTargets({
      totalTargetRevenue: budget.total_target_revenue,
      startDate: seasonStartDate,
      endDate: seasonEndDate,
      dayFactors: dayFactors.map((df) => ({ weekday: df.weekday, factor: df.factor })),
    });
  }, [budget, seasonStartDate, seasonEndDate, dayFactors]);

  // First seven days used for the weekly distribution chart.
  const firstWeekTargets = useMemo(() => {
    return sampleDayTargets.slice(0, 7);
  }, [sampleDayTargets]);

  // Aggregate daily targets into calendar months for the monthly bar chart.
  const monthlyTargets = useMemo(() => {
    const months = new Map<string, number>();

    for (const day of sampleDayTargets) {
      const monthKey = day.date.substring(0, 7); // "YYYY-MM"
      months.set(monthKey, (months.get(monthKey) || 0) + day.target);
    }

    return Array.from(months.entries())
      .map(([month, target]) => {
        const [yyyy, mm] = month.split("-");
        const date = new Date(parseInt(yyyy!), parseInt(mm!) - 1, 1);
        return {
          monthKey: month,
          label: date.toLocaleDateString("nb-NO", { month: "short", year: "2-digit" }),
          target,
        };
      })
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [sampleDayTargets]);

  // Distribute the peak day's revenue across hours using hour factors.
  const peakDayHourTargets = useMemo(() => {
    const first = sampleDayTargets[0];
    if (!first) return [];
    const peakDay = sampleDayTargets.reduce((max, d) => (d.target > max.target ? d : max), first);

    return calculateHourTargets({
      dayTarget: peakDay.target,
      hourFactors: hourFactors.map((hf) => ({ hour: hf.hour, factor: hf.factor })),
      operatingHours: opHours,
    });
  }, [sampleDayTargets, hourFactors, opHours]);

  // Derive peak-hour staffing need from labor percentage and average wage.
  const peakStaffing = useMemo(() => {
    const firstHour = peakDayHourTargets[0];
    if (!firstHour || !budget) return null;
    const peakHour = peakDayHourTargets.reduce(
      (max, h) => (h.target > max.target ? h : max),
      firstHour,
    );

    return {
      hour: peakHour.hour,
      ...calculateStaffingNeed({
        hourTarget: peakHour.target,
        targetLaborPercentage: budget.target_labor_percentage,
        avgHourlyWage: budget.avg_hourly_wage ?? 0,
      }),
    };
  }, [peakDayHourTargets, budget]);

  const avgDailyTarget =
    sampleDayTargets.length > 0
      ? sampleDayTargets.reduce((sum, d) => sum + d.target, 0) / sampleDayTargets.length
      : 0;

  const expectedGuests =
    budget?.base_price_per_guest && budget.base_price_per_guest > 0
      ? Math.round(
          avgDailyTarget / (budget.base_price_per_guest * (budget.season_price_factor ?? 1)),
        )
      : null;

  const formatNOK = (n: number) =>
    new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency: "NOK",
      maximumFractionDigits: 0,
    }).format(n);

  // Activate-button wiring — rendered alongside content AND the
  // no-budget guard so the CTA is always reachable. The modal owns
  // preview + typed-error rendering (missing_budget, missing_factors,
  // etc.), so we deliberately don't replicate those checks here.
  // Archive shown only when the season is in a non-archived state
  // (draft or active). Archived seasons hide the button — "Aktiver på
  // nytt" via the primary CTA is the reactivation path.
  const showArchive = !isArchived;

  // M4 — Pre-activation checklist. Four preconditions; the first three
  // are blockers that the activation RPC rejects; operating hours is a
  // soft signal (activation falls back to default_weekly). Per Invariant
  // 13 the Activate CTA itself stays enabled — the modal owns final
  // validation and typed-error rendering. The checklist is informational
  // so users can fix gaps before clicking Activate.
  const checklistBudgetOk =
    !!budget && budget.total_target_revenue !== null && budget.total_target_revenue > 0;
  const checklistDayFactorsOk = dayFactors.length > 0;
  const checklistHourFactorsOk = hourFactors.length > 0;
  const checklistHoursOk = hasSeasonHours;
  const hasBlockers = !checklistBudgetOk || !checklistDayFactorsOk || !checklistHourFactorsOk;
  const showChecklist = !isActive && !isArchived;

  const blockedTooltip = hasBlockers
    ? tYearWheel("seasonActions.checklist.blockedTooltip")
    : undefined;

  const activationChecklist = showChecklist ? (
    <div
      className="border-border bg-card rounded-2xl border p-5"
      aria-label={tYearWheel("seasonActions.checklist.title")}
    >
      <h3 className="text-muted-foreground mb-4 text-xs font-bold tracking-wider uppercase">
        {tYearWheel("seasonActions.checklist.title")}
      </h3>
      <ul className="space-y-2">
        <li className="flex items-start gap-2 text-sm">
          {checklistBudgetOk ? (
            <CheckCircle2
              className="text-success mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
              strokeWidth={2.5}
            />
          ) : (
            <XCircle
              className="text-destructive mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
              strokeWidth={2.5}
            />
          )}
          <span className={checklistBudgetOk ? "text-foreground" : "text-muted-foreground"}>
            {tYearWheel("seasonActions.checklist.budget")}
          </span>
        </li>
        <li className="flex items-start gap-2 text-sm">
          {checklistDayFactorsOk ? (
            <CheckCircle2
              className="text-success mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
              strokeWidth={2.5}
            />
          ) : (
            <XCircle
              className="text-destructive mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
              strokeWidth={2.5}
            />
          )}
          <span className={checklistDayFactorsOk ? "text-foreground" : "text-muted-foreground"}>
            {tYearWheel("seasonActions.checklist.dayFactors")}
          </span>
        </li>
        <li className="flex items-start gap-2 text-sm">
          {checklistHourFactorsOk ? (
            <CheckCircle2
              className="text-success mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
              strokeWidth={2.5}
            />
          ) : (
            <XCircle
              className="text-destructive mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
              strokeWidth={2.5}
            />
          )}
          <span className={checklistHourFactorsOk ? "text-foreground" : "text-muted-foreground"}>
            {tYearWheel("seasonActions.checklist.hourFactors")}
          </span>
        </li>
        <li className="flex items-start gap-2 text-sm">
          {checklistHoursOk ? (
            <CheckCircle2
              className="text-success mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
              strokeWidth={2.5}
            />
          ) : (
            <AlertCircle
              className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
              strokeWidth={2.5}
            />
          )}
          <div className="flex flex-col">
            <span className={checklistHoursOk ? "text-foreground" : "text-muted-foreground"}>
              {tYearWheel("seasonActions.checklist.operatingHours")}
            </span>
            {!checklistHoursOk && (
              <span className="text-muted-foreground text-xs">
                {tYearWheel("seasonActions.checklist.operatingHoursHint")}
              </span>
            )}
          </div>
        </li>
      </ul>
    </div>
  ) : null;

  const activateCta = (
    <div className="mb-6 flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="default"
        disabled={isDuplicatePending}
        onClick={handleDuplicate}
      >
        <Copy className="mr-2 h-4 w-4" aria-hidden />
        {isDuplicatePending
          ? tYearWheel("seasonActions.duplicate.pending")
          : tYearWheel("seasonActions.duplicate.cta")}
      </Button>
      {showArchive && (
        <Button
          type="button"
          variant="outline"
          size="default"
          disabled={isArchivePending}
          onClick={() => setArchiveOpen(true)}
        >
          <Archive className="mr-2 h-4 w-4" aria-hidden />
          {isArchivePending
            ? tYearWheel("seasonActions.archive.pending")
            : tYearWheel("seasonActions.archive.cta")}
        </Button>
      )}
      <Button
        type="button"
        variant="default"
        size="default"
        disabled={isActive}
        aria-disabled={isActive}
        onClick={() => setActivateModalOpen(true)}
        title={blockedTooltip}
      >
        {ctaLabel}
      </Button>
      <SeasonActivationProposalModal
        seasonId={activateModalOpen ? seasonId : null}
        seasonName={seasonName}
        open={activateModalOpen}
        onOpenChange={setActivateModalOpen}
        onActivated={(result) => {
          toast.success(
            tYearWheel("seasonActivation.toast.success", { count: result.rows_generated }),
          );
          if (wsId) {
            queryClient.invalidateQueries({ queryKey: yearWheelKeys.seasons(wsId) });
            queryClient.invalidateQueries({
              queryKey: yearWheelKeys.seasonOperatingHours(wsId, seasonId),
            });
          }
        }}
      />
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tYearWheel("seasonActions.archive.confirmTitle", { seasonName })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tYearWheel("seasonActions.archive.confirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchivePending}>
              {tYearWheel("seasonActions.archive.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleArchive();
              }}
              disabled={isArchivePending}
            >
              {isArchivePending
                ? tYearWheel("seasonActions.archive.pending")
                : tYearWheel("seasonActions.archive.confirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // Guard: budget must exist for any calculations to be meaningful.
  if (!budget) {
    return (
      <div className="space-y-4">
        {activationChecklist}
        {activateCta}
        <div className="border-border bg-card rounded-2xl border p-6">
          <p className="text-muted-foreground text-sm">{t("yearWheel.setup_budget_first")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activationChecklist}
      {activateCta}
      {/* KPI metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="border-border bg-card flex flex-col justify-between rounded-2xl border p-4">
          <div className="mb-2 flex items-center gap-2">
            <DollarSign className="text-success h-4 w-4" />
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {t("yearWheel.season_goals")}
            </span>
          </div>
          <span className="text-foreground text-2xl font-extrabold">
            {formatNOK(budget.total_target_revenue)}
          </span>
        </div>

        <div className="border-border bg-card flex flex-col justify-between rounded-2xl border p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="text-primary h-4 w-4" />
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {t("yearWheel.season_overview_avg_day")}
            </span>
          </div>
          <span className="text-foreground text-2xl font-extrabold">
            {formatNOK(avgDailyTarget)}
          </span>
        </div>

        <div className="border-border bg-card flex flex-col justify-between rounded-2xl border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Users className="text-chart-4 h-4 w-4" />
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {t("yearWheel.season_overview_peak_staff")}
            </span>
          </div>
          <span className="text-foreground text-2xl font-extrabold">
            {peakStaffing
              ? `${Math.ceil(peakStaffing.staffNeeded)} ${t("yearWheel.persons_short")}`
              : "\u2014"}
          </span>
          {peakStaffing && (
            <span className="text-muted-foreground text-xs">
              {t("yearWheel.time_prefix")} {peakStaffing.hour}:00
            </span>
          )}
        </div>

        <div className="border-border bg-card flex flex-col justify-between rounded-2xl border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="text-brand-orange h-4 w-4" />
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {t("yearWheel.season_overview_guests_day")}
            </span>
          </div>
          <span className="text-foreground text-2xl font-extrabold">
            {expectedGuests ?? "\u2014"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Monthly distribution bar chart */}
        <div className="border-border bg-card rounded-2xl border p-6">
          <h3 className="text-muted-foreground mb-4 text-sm font-bold tracking-wider uppercase">
            {t("yearWheel.monthly_distribution")}
          </h3>
          <div className="flex h-32 items-end gap-2 overflow-x-auto pb-2">
            {monthlyTargets.map((m) => {
              const maxTarget = Math.max(...monthlyTargets.map((mt) => mt.target));
              const heightPct = maxTarget > 0 ? (m.target / maxTarget) * 100 : 0;
              return (
                <div
                  key={m.monthKey}
                  className="flex min-w-[60px] flex-1 flex-col items-center gap-1"
                >
                  <span className="text-muted-foreground text-[10px] font-bold">
                    {formatNOK(m.target)}
                  </span>
                  <div
                    className="bg-brand-orange/30 w-full rounded-t-lg transition-all"
                    style={{ height: `${Math.max(heightPct, 8)}%` }}
                  />
                  <span className="text-muted-foreground text-xs font-medium capitalize">
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly distribution bar chart (first 7 days of season) */}
        <div className="border-border bg-card rounded-2xl border p-6">
          <h3 className="text-muted-foreground mb-4 text-sm font-bold tracking-wider uppercase">
            {t("yearWheel.weekly_distribution")}
          </h3>
          <div className="flex h-32 items-end gap-2 overflow-x-auto pb-2">
            {firstWeekTargets.map((d) => {
              const maxTarget = Math.max(...firstWeekTargets.map((ft) => ft.target));
              const heightPct = maxTarget > 0 ? (d.target / maxTarget) * 100 : 0;
              return (
                <div key={d.date} className="flex min-w-[40px] flex-1 flex-col items-center gap-1">
                  <span className="text-muted-foreground text-[10px] font-bold">
                    {formatNOK(d.target)}
                  </span>
                  <div
                    className="bg-primary/30 w-full rounded-t-lg transition-all"
                    style={{ height: `${Math.max(heightPct, 8)}%` }}
                  />
                  <span className="text-muted-foreground text-xs font-medium">
                    {t(WEEKDAY_KEYS[d.weekday]!)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hourly revenue distribution for the peak day */}
      {peakDayHourTargets.length > 0 && (
        <div className="border-border bg-card rounded-2xl border p-6">
          <h3 className="text-foreground mb-4 text-lg font-bold">
            {t("yearWheel.hourly_distribution")}
          </h3>
          <div className="flex items-end gap-1">
            {peakDayHourTargets.map((h) => {
              const maxHourTarget = Math.max(...peakDayHourTargets.map((ht) => ht.target));
              const heightPct = maxHourTarget > 0 ? (h.target / maxHourTarget) * 100 : 0;
              // Highlight bars that are within 80% of the peak to show the busy window.
              const isPeak = h.target >= maxHourTarget * 0.8;

              return (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-muted-foreground text-[10px] font-bold">
                    {formatNOK(h.target)}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all ${isPeak ? "bg-success/40" : "bg-primary/20"}`}
                    style={{ height: `${Math.max(heightPct * 1.2, 4)}px` }}
                  />
                  <span className="text-muted-foreground font-mono text-[10px]">{h.hour}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
