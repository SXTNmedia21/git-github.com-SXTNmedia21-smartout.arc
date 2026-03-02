"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowLeft, Calendar, DollarSign } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useBudget } from "@/app/dashboard/_hooks/use-budget";
import type { BudgetPeriodType, BudgetEntry } from "@/app/dashboard/_hooks/use-budget";

// ── Date helpers ──────────────────────────────────────────────────

const MONTH_NAMES_NO = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

const DAY_HEADERS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lor", "Son"];

function formatMonthYear(date: Date): string {
  return `${MONTH_NAMES_NO[date.getMonth()]} ${date.getFullYear()}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

/** Returns Monday-based ISO week number */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get the Monday of the ISO week containing the given date */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

/** Get all weeks (as Monday dates) that overlap the given month */
function getWeeksInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const weeks: Date[] = [];
  const seen = new Set<string>();

  let current = getMonday(first);
  while (current <= last) {
    const key = toDateStr(current);
    if (!seen.has(key)) {
      seen.add(key);
      weeks.push(new Date(current));
    }
    current = new Date(current);
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

/** Build calendar grid rows (weeks) for a month */
function getCalendarGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const rows: (Date | null)[][] = [];
  let row: (Date | null)[] = [];

  // Monday = 0, Sunday = 6 in our grid
  const startDow = (first.getDay() + 6) % 7;

  // Pad start
  for (let i = 0; i < startDow; i++) row.push(null);

  for (let d = 1; d <= last.getDate(); d++) {
    row.push(new Date(year, month, d));
    if (row.length === 7) {
      rows.push(row);
      row = [];
    }
  }

  // Pad end
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    rows.push(row);
  }

  return rows;
}

function formatCurrency(val: number | null): string {
  if (val === null || val === 0) return "";
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
  return String(val);
}

// ── Types ─────────────────────────────────────────────────────────

interface BudgetSettingsPanelProps {
  onClose: () => void;
}

// ── Main panel ────────────────────────────────────────────────────

export function BudgetSettingsPanel({ onClose }: BudgetSettingsPanelProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [activeTab, setActiveTab] = useState<BudgetPeriodType>("monthly");
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

  const monthStart = useMemo(() => toDateStr(startOfMonth(currentMonth)), [currentMonth]);
  const monthEnd = useMemo(() => toDateStr(endOfMonth(currentMonth)), [currentMonth]);

  const monthlyBudget = useBudget({
    periodType: "monthly",
    startDate: monthStart,
    endDate: monthEnd,
  });

  const weeklyBudget = useBudget({
    periodType: "weekly",
    startDate: monthStart,
    endDate: monthEnd,
  });

  const dailyBudget = useBudget({
    periodType: "daily",
    startDate: monthStart,
    endDate: monthEnd,
  });

  const hourlyBudget = useBudget({
    periodType: "hourly",
    startDate: monthStart,
    endDate: monthEnd,
  });

  function prevMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
    setSelectedDays(new Set());
  }

  function nextMonth() {
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
    setSelectedDays(new Set());
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Back button + Month selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to KPIs
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="text-muted-foreground hover:text-foreground hover:border-border rounded-lg border border-transparent p-1.5 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-foreground min-w-[160px] text-center text-sm font-bold capitalize">
            {formatMonthYear(currentMonth)}
          </span>
          <button
            onClick={nextMonth}
            className="text-muted-foreground hover:text-foreground hover:border-border rounded-lg border border-transparent p-1.5 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Granularity tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BudgetPeriodType)}>
        <TabsList className="w-full">
          <TabsTrigger value="monthly" className="flex-1">
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            Monthly
          </TabsTrigger>
          <TabsTrigger value="weekly" className="flex-1">
            Weekly
          </TabsTrigger>
          <TabsTrigger value="daily" className="flex-1">
            Daily
          </TabsTrigger>
          <TabsTrigger value="hourly" className="flex-1">
            Hourly
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <MonthlyForm
            monthDate={monthStart}
            budgets={monthlyBudget.budgets}
            onSave={(entry) => monthlyBudget.upsertBudget.mutate(entry)}
            isSaving={monthlyBudget.upsertBudget.isPending}
          />
        </TabsContent>

        <TabsContent value="weekly">
          <WeeklyGrid
            year={currentMonth.getFullYear()}
            month={currentMonth.getMonth()}
            budgets={weeklyBudget.budgets}
            onSave={(entry) => weeklyBudget.upsertBudget.mutate(entry)}
          />
        </TabsContent>

        <TabsContent value="daily">
          <DailyGrid
            year={currentMonth.getFullYear()}
            month={currentMonth.getMonth()}
            budgets={dailyBudget.budgets}
            selectedDays={selectedDays}
            onSelectedDaysChange={setSelectedDays}
            onSave={(entry) => dailyBudget.upsertBudget.mutate(entry)}
          />
        </TabsContent>

        <TabsContent value="hourly">
          <HourlyGrid
            selectedDays={selectedDays}
            budgets={hourlyBudget.budgets}
            onSave={(entry) => hourlyBudget.upsertBudget.mutate(entry)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Monthly form ──────────────────────────────────────────────────

function MonthlyForm({
  monthDate,
  budgets,
  onSave,
  isSaving,
}: {
  monthDate: string;
  budgets: BudgetEntry[];
  onSave: (entry: Omit<BudgetEntry, "id"> & { id?: string }) => void;
  isSaving: boolean;
}) {
  const existing = budgets.find((b) => b.period_type === "monthly" && b.period_date === monthDate);

  const [revenue, setRevenue] = useState<string>("");
  const [laborCost, setLaborCost] = useState<string>("");
  const [foodCost, setFoodCost] = useState<string>("");
  const [costOfSales, setCostOfSales] = useState<string>("");
  const [turnover, setTurnover] = useState<string>("");
  const [absence, setAbsence] = useState<string>("");
  const [timeToJob, setTimeToJob] = useState<string>("");

  const prevExisting = useRef<BudgetEntry | undefined>(undefined);
  if (prevExisting.current !== existing) {
    prevExisting.current = existing;
    if (existing) {
      setRevenue(existing.revenue_target?.toString() ?? "");
      setLaborCost(existing.labor_cost_target?.toString() ?? "");
      setFoodCost(existing.food_cost_target?.toString() ?? "");
      setCostOfSales(existing.cost_of_sales_target?.toString() ?? "");
      setTurnover(existing.turnover_target?.toString() ?? "");
      setAbsence(existing.absence_threshold?.toString() ?? "");
      setTimeToJob(existing.time_to_job_target?.toString() ?? "");
    }
  }

  function handleSave() {
    onSave({
      period_type: "monthly",
      period_date: monthDate,
      hour_slot: null,
      location_id: null,
      department_id: null,
      revenue_target: revenue ? Number(revenue) : null,
      labor_cost_target: laborCost ? Number(laborCost) : null,
      food_cost_target: foodCost ? Number(foodCost) : null,
      cost_of_sales_target: costOfSales ? Number(costOfSales) : null,
      turnover_target: turnover ? Number(turnover) : null,
      absence_threshold: absence ? Number(absence) : null,
      time_to_job_target: timeToJob ? Number(timeToJob) : null,
      notes: null,
    });
  }

  return (
    <div className="border-border bg-card mt-2 rounded-xl border p-5">
      <h3 className="text-foreground mb-4 text-sm font-bold">Monthly Budget Targets</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BudgetInput
          label="Expected Revenue (NOK)"
          value={revenue}
          onChange={setRevenue}
          type="number"
          placeholder="e.g. 850000"
          icon={<DollarSign className="h-3.5 w-3.5" />}
        />
        <BudgetInput
          label="Labor Cost Budget (NOK)"
          value={laborCost}
          onChange={setLaborCost}
          type="number"
          placeholder="e.g. 255000"
          icon={<DollarSign className="h-3.5 w-3.5" />}
        />
        <BudgetInput
          label="Food Cost Budget (NOK)"
          value={foodCost}
          onChange={setFoodCost}
          type="number"
          placeholder="e.g. 210000"
          icon={<DollarSign className="h-3.5 w-3.5" />}
        />
        <BudgetInput
          label="Cost of Sales Target (%)"
          value={costOfSales}
          onChange={setCostOfSales}
          type="number"
          placeholder="e.g. 30"
        />
        <BudgetInput
          label="Turnover Target (%)"
          value={turnover}
          onChange={setTurnover}
          type="number"
          placeholder="e.g. 15"
        />
        <BudgetInput
          label="Absence Threshold (%)"
          value={absence}
          onChange={setAbsence}
          type="number"
          placeholder="e.g. 4"
        />
        <BudgetInput
          label="Time to Job-Ready (days)"
          value={timeToJob}
          onChange={setTimeToJob}
          type="number"
          placeholder="e.g. 7"
        />
      </div>
      <div className="mt-5 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-5 py-2 text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Monthly Budget"}
        </button>
      </div>
    </div>
  );
}

// ── Weekly grid ───────────────────────────────────────────────────

function WeeklyGrid({
  year,
  month,
  budgets,
  onSave,
}: {
  year: number;
  month: number;
  budgets: BudgetEntry[];
  onSave: (entry: Omit<BudgetEntry, "id"> & { id?: string }) => void;
}) {
  const weeks = useMemo(() => getWeeksInMonth(year, month), [year, month]);

  const budgetByDate = useMemo(() => {
    const map = new Map<string, BudgetEntry>();
    for (const b of budgets) {
      if (b.period_type === "weekly") {
        map.set(b.period_date, b);
      }
    }
    return map;
  }, [budgets]);

  return (
    <div className="border-border bg-card mt-2 overflow-hidden rounded-xl border">
      <div className="bg-muted border-border text-muted-foreground grid grid-cols-4 gap-px border-b px-4 py-2.5 text-xs font-bold">
        <span>Week</span>
        <span>Revenue (NOK)</span>
        <span>Labor Cost (NOK)</span>
        <span>Food Cost (NOK)</span>
      </div>
      {weeks.map((monday) => {
        const dateStr = toDateStr(monday);
        const weekNum = getWeekNumber(monday);
        const existing = budgetByDate.get(dateStr);
        return (
          <WeeklyRow
            key={dateStr}
            weekLabel={`Uke ${weekNum}`}
            dateStr={dateStr}
            existing={existing}
            onSave={onSave}
          />
        );
      })}
    </div>
  );
}

function WeeklyRow({
  weekLabel,
  dateStr,
  existing,
  onSave,
}: {
  weekLabel: string;
  dateStr: string;
  existing?: BudgetEntry;
  onSave: (entry: Omit<BudgetEntry, "id"> & { id?: string }) => void;
}) {
  const [revenue, setRevenue] = useState(existing?.revenue_target?.toString() ?? "");
  const [labor, setLabor] = useState(existing?.labor_cost_target?.toString() ?? "");
  const [food, setFood] = useState(existing?.food_cost_target?.toString() ?? "");

  const prevExisting = useRef<BudgetEntry | undefined>(undefined);
  if (prevExisting.current !== existing) {
    prevExisting.current = existing;
    setRevenue(existing?.revenue_target?.toString() ?? "");
    setLabor(existing?.labor_cost_target?.toString() ?? "");
    setFood(existing?.food_cost_target?.toString() ?? "");
  }

  const handleBlur = useCallback(() => {
    onSave({
      period_type: "weekly",
      period_date: dateStr,
      hour_slot: null,
      location_id: null,
      department_id: null,
      revenue_target: revenue ? Number(revenue) : null,
      labor_cost_target: labor ? Number(labor) : null,
      food_cost_target: food ? Number(food) : null,
      cost_of_sales_target: null,
      turnover_target: null,
      absence_threshold: null,
      time_to_job_target: null,
      notes: null,
    });
  }, [dateStr, revenue, labor, food, onSave]);

  return (
    <div className="border-border grid grid-cols-4 gap-px border-b px-4 py-2 last:border-b-0">
      <span className="text-foreground flex items-center text-sm font-semibold">{weekLabel}</span>
      <input
        type="number"
        value={revenue}
        onChange={(e) => setRevenue(e.target.value)}
        onBlur={handleBlur}
        placeholder="0"
        className="bg-background border-border focus:ring-ring rounded-md border px-2.5 py-1.5 text-sm focus:ring-1 focus:outline-none"
      />
      <input
        type="number"
        value={labor}
        onChange={(e) => setLabor(e.target.value)}
        onBlur={handleBlur}
        placeholder="0"
        className="bg-background border-border focus:ring-ring ml-1 rounded-md border px-2.5 py-1.5 text-sm focus:ring-1 focus:outline-none"
      />
      <input
        type="number"
        value={food}
        onChange={(e) => setFood(e.target.value)}
        onBlur={handleBlur}
        placeholder="0"
        className="bg-background border-border focus:ring-ring ml-1 rounded-md border px-2.5 py-1.5 text-sm focus:ring-1 focus:outline-none"
      />
    </div>
  );
}

// ── Daily grid (calendar) ─────────────────────────────────────────

function DailyGrid({
  year,
  month,
  budgets,
  selectedDays,
  onSelectedDaysChange,
  onSave,
}: {
  year: number;
  month: number;
  budgets: BudgetEntry[];
  selectedDays: Set<string>;
  onSelectedDaysChange: (days: Set<string>) => void;
  onSave: (entry: Omit<BudgetEntry, "id"> & { id?: string }) => void;
}) {
  const grid = useMemo(() => getCalendarGrid(year, month), [year, month]);

  const budgetByDate = useMemo(() => {
    const map = new Map<string, BudgetEntry>();
    for (const b of budgets) {
      if (b.period_type === "daily") {
        map.set(b.period_date, b);
      }
    }
    return map;
  }, [budgets]);

  const [bulkRevenue, setBulkRevenue] = useState("");
  const [bulkLabor, setBulkLabor] = useState("");

  function toggleDay(dateStr: string) {
    const next = new Set(selectedDays);
    if (next.has(dateStr)) {
      next.delete(dateStr);
    } else {
      next.add(dateStr);
    }
    onSelectedDaysChange(next);
  }

  function applyBulk() {
    for (const dateStr of selectedDays) {
      onSave({
        period_type: "daily",
        period_date: dateStr,
        hour_slot: null,
        location_id: null,
        department_id: null,
        revenue_target: bulkRevenue ? Number(bulkRevenue) : null,
        labor_cost_target: bulkLabor ? Number(bulkLabor) : null,
        food_cost_target: null,
        cost_of_sales_target: null,
        turnover_target: null,
        absence_threshold: null,
        time_to_job_target: null,
        notes: null,
      });
    }
    setBulkRevenue("");
    setBulkLabor("");
  }

  return (
    <div className="mt-2 flex flex-col gap-4">
      {/* Calendar */}
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        {/* Day headers */}
        <div className="bg-muted border-border grid grid-cols-7 gap-px border-b">
          {DAY_HEADERS.map((d) => (
            <div key={d} className="text-muted-foreground py-2 text-center text-xs font-bold">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar rows */}
        {grid.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-px">
            {row.map((date, ci) => {
              if (!date) {
                return <div key={ci} className="bg-muted/30 h-16" />;
              }
              const dateStr = toDateStr(date);
              const isSelected = selectedDays.has(dateStr);
              const existing = budgetByDate.get(dateStr);
              const hasData = existing && (existing.revenue_target || existing.labor_cost_target);
              const isToday = toDateStr(new Date()) === dateStr;

              return (
                <button
                  key={ci}
                  onClick={() => toggleDay(dateStr)}
                  className={`relative flex h-16 flex-col items-start justify-start p-1.5 text-left transition-all ${
                    isSelected
                      ? "ring-primary bg-primary/5 z-10 ring-2 ring-inset"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`text-xs font-semibold ${
                      isToday
                        ? "bg-primary text-primary-foreground rounded-full px-1.5 py-0.5"
                        : "text-foreground"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {hasData && (
                    <span className="mt-auto text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(existing.revenue_target)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bulk edit panel for selected days */}
      {selectedDays.size > 0 && (
        <div className="border-border bg-card rounded-xl border p-4">
          <p className="text-foreground mb-3 text-sm font-bold">
            Edit {selectedDays.size} selected day{selectedDays.size > 1 ? "s" : ""}
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Revenue (NOK)
              </label>
              <input
                type="number"
                value={bulkRevenue}
                onChange={(e) => setBulkRevenue(e.target.value)}
                placeholder="0"
                className="bg-background border-border focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-muted-foreground mb-1 block text-xs font-medium">
                Labor Cost (NOK)
              </label>
              <input
                type="number"
                value={bulkLabor}
                onChange={(e) => setBulkLabor(e.target.value)}
                placeholder="0"
                className="bg-background border-border focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
              />
            </div>
            <button
              onClick={applyBulk}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-5 py-2 text-sm font-bold shadow-sm transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hourly grid ───────────────────────────────────────────────────

const HOUR_RANGE = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00

function HourlyGrid({
  selectedDays,
  budgets,
  onSave,
}: {
  selectedDays: Set<string>;
  budgets: BudgetEntry[];
  onSave: (entry: Omit<BudgetEntry, "id"> & { id?: string }) => void;
}) {
  if (selectedDays.size === 0) {
    return (
      <div className="border-border bg-card mt-2 flex flex-col items-center justify-center rounded-xl border p-8">
        <Calendar className="text-muted-foreground mb-3 h-8 w-8" />
        <p className="text-muted-foreground text-sm font-medium">
          Select days in the Daily view first
        </p>
        <p className="text-muted-foreground/60 mt-1 text-xs">
          Switch to the Daily tab, select one or more days, then return here.
        </p>
      </div>
    );
  }

  // For simplicity, use the first selected day as representative
  const firstDay = Array.from(selectedDays).sort()[0]!;

  const budgetByHour = useMemo(() => {
    const map = new Map<number, BudgetEntry>();
    for (const b of budgets) {
      if (b.period_type === "hourly" && b.period_date === firstDay && b.hour_slot !== null) {
        map.set(b.hour_slot, b);
      }
    }
    return map;
  }, [budgets, firstDay]);

  return (
    <div className="border-border bg-card mt-2 overflow-hidden rounded-xl border">
      <div className="bg-muted border-border text-muted-foreground grid grid-cols-3 gap-px border-b px-4 py-2.5 text-xs font-bold">
        <span>Hour</span>
        <span>Revenue (NOK)</span>
        <span>Labor Cost (NOK)</span>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {HOUR_RANGE.map((hour) => (
          <HourlyRow
            key={hour}
            hour={hour}
            dateStr={firstDay}
            existing={budgetByHour.get(hour)}
            selectedDays={selectedDays}
            onSave={onSave}
          />
        ))}
      </div>
      {selectedDays.size > 1 && (
        <div className="text-muted-foreground border-border border-t px-4 py-2 text-xs">
          Saving will apply to all {selectedDays.size} selected days.
        </div>
      )}
    </div>
  );
}

function HourlyRow({
  hour,
  dateStr,
  existing,
  selectedDays,
  onSave,
}: {
  hour: number;
  dateStr: string;
  existing?: BudgetEntry;
  selectedDays: Set<string>;
  onSave: (entry: Omit<BudgetEntry, "id"> & { id?: string }) => void;
}) {
  const [revenue, setRevenue] = useState(existing?.revenue_target?.toString() ?? "");
  const [labor, setLabor] = useState(existing?.labor_cost_target?.toString() ?? "");

  const prevExisting = useRef<BudgetEntry | undefined>(undefined);
  if (prevExisting.current !== existing) {
    prevExisting.current = existing;
    setRevenue(existing?.revenue_target?.toString() ?? "");
    setLabor(existing?.labor_cost_target?.toString() ?? "");
  }

  const handleBlur = useCallback(() => {
    // Save for all selected days
    for (const day of selectedDays) {
      onSave({
        period_type: "hourly",
        period_date: day,
        hour_slot: hour,
        location_id: null,
        department_id: null,
        revenue_target: revenue ? Number(revenue) : null,
        labor_cost_target: labor ? Number(labor) : null,
        food_cost_target: null,
        cost_of_sales_target: null,
        turnover_target: null,
        absence_threshold: null,
        time_to_job_target: null,
        notes: null,
      });
    }
  }, [hour, revenue, labor, selectedDays, onSave]);

  const hourLabel = `${String(hour).padStart(2, "0")}:00`;

  return (
    <div className="border-border grid grid-cols-3 gap-px border-b px-4 py-1.5 last:border-b-0">
      <span className="text-foreground flex items-center text-sm font-medium tabular-nums">
        {hourLabel}
      </span>
      <input
        type="number"
        value={revenue}
        onChange={(e) => setRevenue(e.target.value)}
        onBlur={handleBlur}
        placeholder="0"
        className="bg-background border-border focus:ring-ring rounded-md border px-2.5 py-1 text-sm focus:ring-1 focus:outline-none"
      />
      <input
        type="number"
        value={labor}
        onChange={(e) => setLabor(e.target.value)}
        onBlur={handleBlur}
        placeholder="0"
        className="bg-background border-border focus:ring-ring ml-1 rounded-md border px-2.5 py-1 text-sm focus:ring-1 focus:outline-none"
      />
    </div>
  );
}

// ── Shared input component ────────────────────────────────────────

function BudgetInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-muted-foreground text-xs font-medium">{label}</label>
      <div className="relative">
        {icon && (
          <div className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`bg-background border-border focus:ring-ring w-full rounded-md border py-2 text-sm focus:ring-1 focus:outline-none ${icon ? "pr-3 pl-8" : "px-3"}`}
        />
      </div>
    </div>
  );
}
