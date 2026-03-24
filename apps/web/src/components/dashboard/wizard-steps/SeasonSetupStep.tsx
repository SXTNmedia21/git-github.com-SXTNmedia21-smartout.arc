"use client";

import { useState, useCallback, useContext, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Clock, Users, TrendingUp } from "lucide-react";
import { HelpTip } from "@/components/dashboard/wizard-steps/HelpTip";
import type { IndustrySeasonTemplate } from "@/lib/industry/types";

// ─── Constants ──────────────────────────────────────────────

const WEEKDAYS = [
  { key: "mon", label: "Man" },
  { key: "tue", label: "Tir" },
  { key: "wed", label: "Ons" },
  { key: "thu", label: "Tor" },
  { key: "fri", label: "Fre" },
  { key: "sat", label: "Lør" },
  { key: "sun", label: "Søn" },
] as const;

type WeekdayKey = (typeof WEEKDAYS)[number]["key"];

// Restaurant default day factors (relative weight per weekday)
const DEFAULT_DAY_FACTORS: Record<WeekdayKey, number> = {
  mon: 0.7,
  tue: 0.8,
  wed: 0.9,
  thu: 1.0,
  fri: 1.5,
  sat: 1.4,
  sun: 0.7,
};

// Default opening hours per department type (hospitality)
const DEFAULT_DEPT_HOURS: Record<string, string> = {
  Kitchen: "09:00-22:00",
  Service: "10:30-23:00",
  Bar: "15:00-00:00",
  Operations: "07:00-23:00",
};

type OpeningHoursMap = Record<string, Record<WeekdayKey, string>>;

// Map weekday key index to cascade day_of_week (0=Mon...6=Sun)
const WEEKDAY_INDEX: Record<WeekdayKey, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

type DeptRow = { department_id: string; name: string };

/**
 * Converts the wizard's opening hours map (keyed by department name) into
 * department_operating_hours rows. Matches department name to department_id.
 */
async function upsertDepartmentHours(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  openingHours: OpeningHoursMap,
  departments: DeptRow[],
  seasonId: string,
) {
  const rows: {
    workspace_id: string;
    department_id: string;
    season_id: string;
    location_id: null;
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  }[] = [];

  for (const [deptName, weeklyHours] of Object.entries(openingHours)) {
    const dept = departments.find((d) => d.name.toLowerCase() === deptName.toLowerCase());
    if (!dept) continue;

    for (const [dayKey, timeRange] of Object.entries(weeklyHours) as [WeekdayKey, string][]) {
      const dayOfWeek = WEEKDAY_INDEX[dayKey];
      if (dayOfWeek === undefined) continue;

      const [open, close] = timeRange.split("-").map((t) => t.trim());
      const isClosed = !open || !close;

      rows.push({
        workspace_id: workspaceId,
        department_id: dept.department_id,
        season_id: seasonId,
        location_id: null,
        day_of_week: dayOfWeek,
        open_time: isClosed ? null : open!,
        close_time: isClosed ? null : close!,
        is_closed: isClosed,
      });
    }
  }

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("department_operating_hours")
    .upsert(rows, { onConflict: "department_id,location_id,season_id,day_of_week" });

  if (error) throw error;
}

// ─── Helpers ────────────────────────────────────────────────

function suggestSeason(): { name: string; startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed

  if (month <= 4) {
    return {
      name: `Vårsesong ${year}`,
      startDate: `${year}-03-01`,
      endDate: `${year}-05-31`,
    };
  }
  if (month <= 8) {
    return {
      name: `Sommersesong ${year}`,
      startDate: `${year}-06-01`,
      endDate: `${year}-08-31`,
    };
  }
  if (month <= 11) {
    return {
      name: `Høstsesong ${year}`,
      startDate: `${year}-09-01`,
      endDate: `${year}-11-30`,
    };
  }
  return {
    name: `Vintersesong ${year + 1}`,
    startDate: `${year}-12-01`,
    endDate: `${year + 1}-02-28`,
  };
}

function countSeasonDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

function countWeekdaysInSeason(start: string, end: string): Record<WeekdayKey, number> {
  const counts: Record<WeekdayKey, number> = {
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
    sun: 0,
  };
  const dayMap: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const key = dayMap[d.getDay()]!;
    counts[key]++;
  }
  return counts;
}

function parseShiftLength(timeRange: string): number {
  const [startStr, endStr] = timeRange.split("-");
  if (!startStr || !endStr) return 8;
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return 8;
  let hours = eh - sh + (em - sm) / 60;
  if (hours <= 0) hours += 24; // crosses midnight
  return hours;
}

function estimateStaffPerDay(
  dayFactor: number,
  avgFactor: number,
  totalRevenue: number,
  seasonDays: number,
  laborPct: number,
  avgWage: number,
  avgShiftHours: number,
): number {
  if (avgWage <= 0 || avgShiftHours <= 0 || avgFactor <= 0 || seasonDays <= 0) return 0;
  const dailyRevenue = (totalRevenue / seasonDays) * (dayFactor / avgFactor);
  const dailyLaborBudget = dailyRevenue * (laborPct / 100);
  return Math.round(dailyLaborBudget / (avgWage * avgShiftHours));
}

// ─── SeasonSetupStep ────────────────────────────────────────

export function SeasonSetupStep({
  suggestedSeasons: _suggestedSeasons,
}: {
  suggestedSeasons?: IndustrySeasonTemplate[];
}) {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const hasInitRef = useRef(false);

  // ── Query existing season (with budget + day factors for pre-population) ──

  const { data: existingSeason } = useQuery({
    queryKey: ["seasons", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data: season } = await supabase
        .from("season")
        .select("season_id, name, start_date, end_date, status, opening_hours")
        .eq("workspace_id", workspace.workspace_id)
        .limit(1)
        .maybeSingle();
      if (!season) return null;

      // Fetch budget + day factors for pre-population
      const { data: budget } = await supabase
        .from("season_budget")
        .select(
          "season_budget_id, total_target_revenue, target_labor_percentage, avg_hourly_wage, base_price_per_guest",
        )
        .eq("season_id", season.season_id)
        .maybeSingle();

      let dayFactorData: { weekday: number; factor: number }[] = [];
      if (budget) {
        const { data: df } = await supabase
          .from("day_factor")
          .select("weekday, factor")
          .eq("season_budget_id", budget.season_budget_id)
          .order("weekday");
        dayFactorData = df ?? [];
      }

      return { ...season, budget, dayFactors: dayFactorData };
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["departments", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .order("sort_order");
      return data ?? [];
    },
  });

  // Get avg hourly wage from payroll policy
  const { data: wagePolicy } = useQuery({
    queryKey: ["payroll-policies", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("policy")
        .select("rules_json")
        .eq("workspace_id", workspace.workspace_id)
        .eq("policy_type", "payroll")
        .eq("name", "Stillingslønn")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const avgHourlyWage = useMemo(() => {
    const rules = wagePolicy?.rules_json as Record<string, unknown> | null;
    const positions = (rules?.positions ?? []) as { hourly_rate: number }[];
    if (positions.length === 0) return 220; // default
    const sum = positions.reduce((acc, p) => acc + (p.hourly_rate || 0), 0);
    return Math.round(sum / positions.length) || 220;
  }, [wagePolicy]);

  // ── State ──

  const suggested = useMemo(() => suggestSeason(), []);

  const [name, setName] = useState(suggested.name);
  const [startDate, setStartDate] = useState(suggested.startDate);
  const [endDate, setEndDate] = useState(suggested.endDate);
  const [revenuePerGuest, setRevenuePerGuest] = useState(450);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [laborPct, setLaborPct] = useState(30);
  const [dayFactors, setDayFactors] = useState<Record<WeekdayKey, number>>(DEFAULT_DAY_FACTORS);
  const [openingHours, setOpeningHours] = useState<OpeningHoursMap>({});
  const [isSaving, setIsSaving] = useState(false);

  // ── Pre-populate from existing season ──

  const hasPrePopulatedRef = useRef(false);

  useEffect(() => {
    if (hasPrePopulatedRef.current || !existingSeason) return;
    hasPrePopulatedRef.current = true;

    setName(existingSeason.name);
    if (existingSeason.start_date) setStartDate(existingSeason.start_date);
    if (existingSeason.end_date) setEndDate(existingSeason.end_date);

    if (existingSeason.opening_hours) {
      setOpeningHours(existingSeason.opening_hours as OpeningHoursMap);
      hasInitRef.current = true; // skip default opening hours init
    }

    if (existingSeason.budget) {
      setTotalRevenue(existingSeason.budget.total_target_revenue ?? 0);
      setLaborPct(existingSeason.budget.target_labor_percentage ?? 30);
      setRevenuePerGuest(existingSeason.budget.base_price_per_guest ?? 450);
    }

    if (existingSeason.dayFactors && existingSeason.dayFactors.length > 0) {
      const weekdayKeys: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
      const factors = { ...DEFAULT_DAY_FACTORS };
      for (const df of existingSeason.dayFactors) {
        const key = weekdayKeys[df.weekday - 1]; // weekday 1=Mon
        if (key) factors[key] = df.factor;
      }
      setDayFactors(factors);
    }
  }, [existingSeason]);

  // ── Initialize opening hours from departments ──

  useEffect(() => {
    if (hasInitRef.current || !departments || departments.length === 0) return;
    hasInitRef.current = true;

    const hours: OpeningHoursMap = {};
    for (const dept of departments) {
      const defaultTime = DEFAULT_DEPT_HOURS[dept.name] ?? "08:00-22:00";
      hours[dept.name] = {} as Record<WeekdayKey, string>;
      for (const wd of WEEKDAYS) {
        hours[dept.name]![wd.key] = defaultTime;
      }
    }
    setOpeningHours(hours);
  }, [departments]);

  // ── Derived calculations ──

  const seasonDays = useMemo(
    () => (startDate && endDate ? countSeasonDays(startDate, endDate) : 0),
    [startDate, endDate],
  );

  const avgFactor = useMemo(() => {
    const vals = Object.values(dayFactors);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [dayFactors]);

  const avgShiftHours = useMemo(() => {
    const allRanges: string[] = [];
    for (const deptHours of Object.values(openingHours)) {
      for (const range of Object.values(deptHours)) {
        if (range) allRanges.push(range);
      }
    }
    if (allRanges.length === 0) return 8;
    const total = allRanges.reduce((sum, r) => sum + parseShiftLength(r), 0);
    return total / allRanges.length;
  }, [openingHours]);

  const staffEstimates = useMemo(() => {
    if (totalRevenue <= 0) return null;
    const estimates: { key: WeekdayKey; label: string; staff: number; factor: number }[] = [];
    for (const wd of WEEKDAYS) {
      estimates.push({
        key: wd.key,
        label: wd.label,
        factor: dayFactors[wd.key],
        staff: estimateStaffPerDay(
          dayFactors[wd.key],
          avgFactor,
          totalRevenue,
          seasonDays,
          laborPct,
          avgHourlyWage,
          avgShiftHours,
        ),
      });
    }
    return estimates;
  }, [totalRevenue, dayFactors, avgFactor, seasonDays, laborPct, avgHourlyWage, avgShiftHours]);

  const maxStaff = useMemo(
    () => (staffEstimates ? Math.max(...staffEstimates.map((e) => e.staff), 1) : 1),
    [staffEstimates],
  );

  // ── Handlers ──

  const handleDayFactorChange = useCallback((key: WeekdayKey, value: number) => {
    setDayFactors((prev) => ({ ...prev, [key]: Math.max(0.1, Math.min(3, value)) }));
  }, []);

  const handleOpeningHoursChange = useCallback(
    (deptName: string, day: WeekdayKey, value: string) => {
      setOpeningHours((prev) => {
        const existing = prev[deptName] ?? ({} as Record<WeekdayKey, string>);
        const updated: Record<WeekdayKey, string> = { ...existing, [day]: value };
        return { ...prev, [deptName]: updated };
      });
    },
    [],
  );

  const handleSetAllDays = useCallback((deptName: string, value: string) => {
    setOpeningHours((prev) => {
      const updated = { ...prev[deptName] } as Record<WeekdayKey, string>;
      for (const wd of WEEKDAYS) {
        updated[wd.key] = value;
      }
      return { ...prev, [deptName]: updated };
    });
  }, []);

  // ── Save ──

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Sesongen trenger et navn");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Velg start- og sluttdato");
      return;
    }
    if (startDate >= endDate) {
      toast.error("Sluttdato må være etter startdato");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    try {
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-æøå]/g, "");

      let seasonId: string;

      if (existingSeason) {
        // ── Update existing season ──
        const { error: updateError } = await supabase
          .from("season")
          .update({
            name: name.trim(),
            slug,
            start_date: startDate,
            end_date: endDate,
          })
          .eq("season_id", existingSeason.season_id);

        if (updateError) throw updateError;
        seasonId = existingSeason.season_id;

        // Write opening hours to department_operating_hours (cascade D1)
        await upsertDepartmentHours(
          supabase,
          workspace.workspace_id,
          openingHours,
          departments ?? [],
          seasonId,
        );

        // Update budget if it exists, otherwise create
        if (existingSeason.budget) {
          const { error: budgetUpdateError } = await supabase
            .from("season_budget")
            .update({
              total_target_revenue: totalRevenue,
              target_labor_percentage: laborPct,
              avg_hourly_wage: avgHourlyWage,
              base_price_per_guest: revenuePerGuest,
            })
            .eq("season_budget_id", existingSeason.budget.season_budget_id);

          if (budgetUpdateError) throw budgetUpdateError;

          // Delete old day factors and re-insert
          await supabase
            .from("day_factor")
            .delete()
            .eq("season_budget_id", existingSeason.budget.season_budget_id);

          const dayFactorRecords = WEEKDAYS.map((wd, idx) => ({
            season_budget_id: existingSeason.budget!.season_budget_id,
            workspace_id: workspace.workspace_id,
            weekday: idx + 1,
            factor: dayFactors[wd.key],
          }));

          const { error: dayFactorError } = await supabase
            .from("day_factor")
            .insert(dayFactorRecords);
          if (dayFactorError) throw dayFactorError;
        } else {
          // Create budget for existing season that has none
          const { data: budget, error: budgetError } = await supabase
            .from("season_budget")
            .insert({
              season_id: seasonId,
              workspace_id: workspace.workspace_id,
              total_target_revenue: totalRevenue,
              target_labor_percentage: laborPct,
              avg_hourly_wage: avgHourlyWage,
              base_price_per_guest: revenuePerGuest,
              created_by: profileId,
            })
            .select("season_budget_id")
            .single();

          if (budgetError) throw budgetError;

          const dayFactorRecords = WEEKDAYS.map((wd, idx) => ({
            season_budget_id: budget.season_budget_id,
            workspace_id: workspace.workspace_id,
            weekday: idx + 1,
            factor: dayFactors[wd.key],
          }));

          const { error: dayFactorError } = await supabase
            .from("day_factor")
            .insert(dayFactorRecords);
          if (dayFactorError) throw dayFactorError;
        }
      } else {
        // ── Create new season ──
        const { data: season, error: seasonError } = await supabase
          .from("season")
          .insert({
            name: name.trim(),
            slug,
            start_date: startDate,
            end_date: endDate,
            status: "draft" as const,
            workspace_id: workspace.workspace_id,
            created_by: profileId,
          })
          .select("season_id")
          .single();

        if (seasonError) throw seasonError;
        seasonId = season.season_id;

        // Write opening hours to department_operating_hours (cascade D1)
        await upsertDepartmentHours(
          supabase,
          workspace.workspace_id,
          openingHours,
          departments ?? [],
          seasonId,
        );

        // 2. Create season budget
        const { data: budget, error: budgetError } = await supabase
          .from("season_budget")
          .insert({
            season_id: seasonId,
            workspace_id: workspace.workspace_id,
            total_target_revenue: totalRevenue,
            target_labor_percentage: laborPct,
            avg_hourly_wage: avgHourlyWage,
            base_price_per_guest: revenuePerGuest,
            created_by: profileId,
          })
          .select("season_budget_id")
          .single();

        if (budgetError) throw budgetError;

        // 3. Create day factors
        const dayFactorRecords = WEEKDAYS.map((wd, idx) => ({
          season_budget_id: budget.season_budget_id,
          workspace_id: workspace.workspace_id,
          weekday: idx + 1, // 1=Mon, 7=Sun
          factor: dayFactors[wd.key],
        }));

        const { error: dayFactorError } = await supabase
          .from("day_factor")
          .insert(dayFactorRecords);
        if (dayFactorError) throw dayFactorError;
      }

      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: existingSeason ? "season-updated" : "season-created-with-budget",
        },
      });

      toast.success(
        existingSeason ? "Sesong oppdatert" : "Sesong opprettet med budsjett og dagprofil",
      );
      await queryClient.invalidateQueries({
        queryKey: ["seasons", workspace.workspace_id],
      });
    } catch (err) {
      console.error("[season] Save failed:", err);
      toast.error("Kunne ikke opprette sesong");
    } finally {
      setIsSaving(false);
    }
  }, [
    existingSeason,
    name,
    startDate,
    endDate,
    openingHours,
    totalRevenue,
    laborPct,
    avgHourlyWage,
    revenuePerGuest,
    dayFactors,
    workspace.workspace_id,
    profileId,
    queryClient,
  ]);

  // ── Render ──

  return (
    <div className="space-y-8">
      {/* ── Existing season banner ── */}
      {existingSeason && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${"border-success bg-success/50"}`}
        >
          <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
          <p className={`text-xs ${"text-success"}`}>
            Sesong opprettet — juster innstillinger nedenfor.
          </p>
        </div>
      )}

      {/* ── Section 1: Name + Period ── */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className={`text-sm font-medium ${"text-muted-foreground"}`}>Sesongnavn</Label>
            <HelpTip text="Gi sesongen et beskrivende navn. Du kan opprette flere sesonger fra dashboardet etterpå." />
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sommersesong 2026"
            className="h-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={`text-sm font-medium ${"text-muted-foreground"}`}>Startdato</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className={`text-sm font-medium ${"text-muted-foreground"}`}>Sluttdato</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        {seasonDays > 0 && (
          <p className={`text-xs ${"text-muted-foreground"}`}>{seasonDays} dager</p>
        )}
      </div>

      {/* ── Section 2: Budget ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-bold ${"text-muted-foreground"}`}>Budsjett</h3>
          <HelpTip text="Sett omsetning per gjest og totalmål. Systemet beregner bemanningsbehov automatisk." />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${"text-muted-foreground"}`}>
              Omsetning per gjest
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={revenuePerGuest || ""}
                onChange={(e) => setRevenuePerGuest(parseFloat(e.target.value) || 0)}
                placeholder="450"
                className="h-9 pr-8 text-sm"
              />
              <span
                className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs ${"text-muted-foreground"}`}
              >
                kr
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${"text-muted-foreground"}`}>
              Total omsetning (sesong)
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={totalRevenue || ""}
                onChange={(e) => setTotalRevenue(parseFloat(e.target.value) || 0)}
                placeholder="3 000 000"
                className="h-9 pr-8 text-sm"
              />
              <span
                className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs ${"text-muted-foreground"}`}
              >
                kr
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${"text-muted-foreground"}`}>Lønnskostnad</Label>
            <div className="relative">
              <Input
                type="number"
                value={laborPct || ""}
                onChange={(e) => setLaborPct(Math.min(100, parseFloat(e.target.value) || 0))}
                placeholder="30"
                className="h-9 pr-8 text-sm"
              />
              <span
                className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs ${"text-muted-foreground"}`}
              >
                %
              </span>
            </div>
          </div>
        </div>

        {totalRevenue > 0 && seasonDays > 0 && (
          <p className={`text-xs ${"text-muted-foreground"}`}>
            Snitt {Math.round(totalRevenue / seasonDays).toLocaleString("nb-NO")} kr/dag ·{" "}
            Lønnsbudsjett {Math.round((totalRevenue * laborPct) / 100).toLocaleString("nb-NO")} kr ·{" "}
            Snittlønn {avgHourlyWage} kr/t
          </p>
        )}
      </div>

      {/* ── Section 3: Opening Hours per Department ── */}
      {(departments ?? []).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-bold ${"text-muted-foreground"}`}>
              <Clock className="mr-1 inline-block h-4 w-4" />
              Åpningstider per avdeling
            </h3>
            <HelpTip text="Kjøkken åpner før service (prep), bar stenger etter service. Disse tidene styrer vaktstart/-slutt og rutineberegninger." />
          </div>

          <div className={`overflow-x-auto rounded-xl border ${"border-border"}`}>
            <table className="w-full text-xs">
              <thead>
                <tr className={"bg-muted text-muted-foreground"}>
                  <th className="px-3 py-2 text-left font-semibold">Avdeling</th>
                  {WEEKDAYS.map((wd) => (
                    <th key={wd.key} className="px-1.5 py-2 text-center font-semibold">
                      {wd.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(departments ?? []).map((dept, idx) => {
                  const deptHours = openingHours[dept.name];
                  const firstDay = deptHours?.mon ?? "";

                  return (
                    <tr key={dept.department_id ?? idx} className={`border-t ${"border-border"}`}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${"text-muted-foreground"}`}>
                            {dept.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (firstDay) handleSetAllDays(dept.name, firstDay);
                            }}
                            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${"text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                            title="Kopier mandag til alle dager"
                          >
                            Alle
                          </button>
                        </div>
                      </td>
                      {WEEKDAYS.map((wd) => (
                        <td key={wd.key} className="px-1 py-1.5">
                          <Input
                            type="text"
                            value={deptHours?.[wd.key] ?? ""}
                            onChange={(e) =>
                              handleOpeningHoursChange(dept.name, wd.key, e.target.value)
                            }
                            placeholder="09-22"
                            className="h-7 w-[90px] text-center text-[11px] tabular-nums"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className={`text-[11px] ${"text-muted-foreground"}`}>
            Format: 09:00-22:00. Kjøkken åpner først (prep), bar stenger sist.
          </p>
        </div>
      )}

      {/* ── Section 4: Weekly Profile (Day Factors) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-bold ${"text-muted-foreground"}`}>
            <TrendingUp className="mr-1 inline-block h-4 w-4" />
            Ukeprofil
          </h3>
          <HelpTip text="Juster aktivitetsnivå per ukedag. Fredag og lørdag er typisk travlest. Systemet bruker dette til å fordele budsjett og bemanning." />
        </div>

        <div className="flex items-end gap-2">
          {WEEKDAYS.map((wd) => {
            const factor = dayFactors[wd.key];
            const barHeight = Math.max(8, (factor / 2) * 100); // Scale: 0-2 → 0-100%
            const isHigh = factor >= 1.3;
            const isLow = factor <= 0.7;

            return (
              <div key={wd.key} className="flex flex-1 flex-col items-center gap-1">
                {/* Bar */}
                <div
                  className={`relative flex w-full items-end justify-center rounded-t-lg transition-all ${"bg-muted"}`}
                  style={{ height: "120px" }}
                >
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      isHigh ? "bg-brand-orange" : isLow ? "bg-muted" : "bg-muted"
                    }`}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>

                {/* Factor input */}
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="3"
                  value={factor}
                  onChange={(e) => handleDayFactorChange(wd.key, parseFloat(e.target.value) || 0.5)}
                  className="h-7 w-full text-center text-[11px] tabular-nums"
                />

                {/* Day label */}
                <span
                  className={`text-[11px] font-semibold ${
                    isHigh ? "text-brand-orange" : "text-muted-foreground"
                  }`}
                >
                  {wd.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className={`text-[11px] ${"text-muted-foreground"}`}>
          1.0 = gjennomsnitt. Over 1.0 = travlere enn snitt. Under 1.0 = roligere.
        </p>
      </div>

      {/* ── Staffing Estimate ── */}
      {staffEstimates && totalRevenue > 0 && (
        <div className={`rounded-xl border p-4 ${"border-brand-orange bg-brand-orange/50"}`}>
          <div className="flex items-center gap-2">
            <Users className="text-brand-orange h-4 w-4" />
            <h4 className={`text-sm font-bold ${"text-brand-orange"}`}>Estimert bemanning</h4>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {staffEstimates.map((est) => (
              <div key={est.key} className="text-center">
                <div className={`text-2xl font-black tabular-nums ${"text-foreground"}`}>
                  {est.staff}
                </div>
                <div
                  className={`text-[11px] font-medium ${
                    est.factor >= 1.3 ? "text-brand-orange" : "text-muted-foreground"
                  }`}
                >
                  {est.label}
                </div>
              </div>
            ))}
          </div>

          <p className={`mt-2 text-[11px] ${"text-muted-foreground"}`}>
            Basert på {avgHourlyWage} kr/t snittlønn og {Math.round(avgShiftHours)}t snittskift.
            Juster ukeprofilen for å se endringen.
          </p>
        </div>
      )}

      {/* ── Save ── */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
          isSaving
            ? "cursor-not-allowed opacity-50"
            : "bg-brand-orange hover:bg-brand-orange/90 text-white"
        }`}
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {existingSeason ? "Lagrer..." : "Oppretter..."}
          </>
        ) : existingSeason ? (
          "Lagre endringer"
        ) : (
          "Opprett sesong"
        )}
      </button>
    </div>
  );
}
