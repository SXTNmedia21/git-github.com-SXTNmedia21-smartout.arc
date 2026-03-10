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
  isDark,
  suggestedSeasons: _suggestedSeasons,
}: {
  isDark: boolean;
  suggestedSeasons?: IndustrySeasonTemplate[];
}) {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const hasInitRef = useRef(false);

  // ── Query existing season ──

  const { data: existingSeason } = useQuery({
    queryKey: ["seasons", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("season")
        .select("season_id, name, start_date, end_date, status")
        .eq("workspace_id", workspace.workspace_id)
        .limit(1)
        .maybeSingle();
      return data;
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

      // 1. Create season
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
          opening_hours: openingHours,
        })
        .select("season_id")
        .single();

      if (seasonError) throw seasonError;

      // 2. Create season budget
      const { data: budget, error: budgetError } = await supabase
        .from("season_budget")
        .insert({
          season_id: season.season_id,
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

      const { error: dayFactorError } = await supabase.from("day_factor").insert(dayFactorRecords);

      if (dayFactorError) throw dayFactorError;

      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: { trackingId: "season-created-with-budget" },
      });

      toast.success("Sesong opprettet med budsjett og dagprofil");
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

  // ── Render: existing season ──

  if (existingSeason) {
    return (
      <div className="space-y-4">
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-4 ${
            isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-white"
          }`}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
              {existingSeason.name}
            </p>
            <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {existingSeason.start_date} – {existingSeason.end_date}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
              isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {existingSeason.status}
          </span>
        </div>
      </div>
    );
  }

  // ── Render: create form ──

  return (
    <div className="space-y-8">
      {/* ── Section 1: Name + Period ── */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              Sesongnavn
            </Label>
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
            <Label className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              Startdato
            </Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              Sluttdato
            </Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        {seasonDays > 0 && (
          <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {seasonDays} dager
          </p>
        )}
      </div>

      {/* ── Section 2: Budget ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Budsjett
          </h3>
          <HelpTip text="Sett omsetning per gjest og totalmål. Systemet beregner bemanningsbehov automatisk." />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
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
                className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs ${
                  isDark ? "text-zinc-500" : "text-zinc-400"
                }`}
              >
                kr
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
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
                className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs ${
                  isDark ? "text-zinc-500" : "text-zinc-400"
                }`}
              >
                kr
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Lønnskostnad
            </Label>
            <div className="relative">
              <Input
                type="number"
                value={laborPct || ""}
                onChange={(e) => setLaborPct(Math.min(100, parseFloat(e.target.value) || 0))}
                placeholder="30"
                className="h-9 pr-8 text-sm"
              />
              <span
                className={`pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs ${
                  isDark ? "text-zinc-500" : "text-zinc-400"
                }`}
              >
                %
              </span>
            </div>
          </div>
        </div>

        {totalRevenue > 0 && seasonDays > 0 && (
          <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
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
            <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              <Clock className="mr-1 inline-block h-4 w-4" />
              Åpningstider per avdeling
            </h3>
            <HelpTip text="Kjøkken åpner før service (prep), bar stenger etter service. Disse tidene styrer vaktstart/-slutt og rutineberegninger." />
          </div>

          <div
            className={`overflow-x-auto rounded-xl border ${
              isDark ? "border-zinc-800" : "border-zinc-200"
            }`}
          >
            <table className="w-full text-xs">
              <thead>
                <tr
                  className={isDark ? "bg-zinc-900/70 text-zinc-500" : "bg-zinc-50 text-zinc-400"}
                >
                  <th className="px-3 py-2 text-left font-semibold">Avdeling</th>
                  {WEEKDAYS.map((wd) => (
                    <th key={wd.key} className="px-1.5 py-2 text-center font-semibold">
                      {wd.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(departments ?? []).map((dept) => {
                  const deptHours = openingHours[dept.name];
                  const firstDay = deptHours?.mon ?? "";

                  return (
                    <tr
                      key={dept.department_id}
                      className={`border-t ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                          >
                            {dept.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (firstDay) handleSetAllDays(dept.name, firstDay);
                            }}
                            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                              isDark
                                ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-400"
                                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-500"
                            }`}
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
                            className={`h-7 w-[90px] text-center text-[11px] tabular-nums ${
                              isDark ? "border-zinc-700 bg-zinc-800/50" : ""
                            }`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
            Format: 09:00-22:00. Kjøkken åpner først (prep), bar stenger sist.
          </p>
        </div>
      )}

      {/* ── Section 4: Weekly Profile (Day Factors) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
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
                  className={`relative flex w-full items-end justify-center rounded-t-lg transition-all ${
                    isDark ? "bg-zinc-800/50" : "bg-zinc-100"
                  }`}
                  style={{ height: "120px" }}
                >
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      isHigh
                        ? "bg-orange-500"
                        : isLow
                          ? isDark
                            ? "bg-zinc-600"
                            : "bg-zinc-300"
                          : isDark
                            ? "bg-zinc-500"
                            : "bg-zinc-400"
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
                  className={`h-7 w-full text-center text-[11px] tabular-nums ${
                    isDark ? "border-zinc-700 bg-zinc-800/50" : ""
                  }`}
                />

                {/* Day label */}
                <span
                  className={`text-[11px] font-semibold ${
                    isHigh ? "text-orange-500" : isDark ? "text-zinc-500" : "text-zinc-400"
                  }`}
                >
                  {wd.label}
                </span>
              </div>
            );
          })}
        </div>

        <p className={`text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
          1.0 = gjennomsnitt. Over 1.0 = travlere enn snitt. Under 1.0 = roligere.
        </p>
      </div>

      {/* ── Staffing Estimate ── */}
      {staffEstimates && totalRevenue > 0 && (
        <div
          className={`rounded-xl border p-4 ${
            isDark ? "border-orange-500/20 bg-orange-950/10" : "border-orange-200 bg-orange-50/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-orange-500" />
            <h4 className={`text-sm font-bold ${isDark ? "text-orange-300" : "text-orange-700"}`}>
              Estimert bemanning
            </h4>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {staffEstimates.map((est) => (
              <div key={est.key} className="text-center">
                <div
                  className={`text-2xl font-black tabular-nums ${
                    isDark ? "text-zinc-200" : "text-zinc-800"
                  }`}
                >
                  {est.staff}
                </div>
                <div
                  className={`text-[11px] font-medium ${
                    est.factor >= 1.3
                      ? "text-orange-500"
                      : isDark
                        ? "text-zinc-500"
                        : "text-zinc-400"
                  }`}
                >
                  {est.label}
                </div>
              </div>
            ))}
          </div>

          <p className={`mt-2 text-[11px] ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
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
            : "bg-orange-500 text-white hover:bg-orange-600"
        }`}
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Oppretter...
          </>
        ) : (
          "Opprett sesong"
        )}
      </button>
    </div>
  );
}
