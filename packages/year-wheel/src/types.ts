/**
 * Year-wheel domain types — shared between web and mobile.
 * Mirrors the cascade/types definitions for planning entities.
 */

export type Season = {
  season_id: string;
  name: string;
  slug: string;
  season_type: "default" | "calendar" | "focus" | "cycle" | "custom";
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "active" | "archived";
  is_default: boolean;
  color: string | null;
  icon: string | null;
  description: string | null;
  planning_cycle_id: string | null;
};

export type SeasonBudgetStatus = "draft" | "active" | "locked";

export type SeasonBudget = {
  season_budget_id: string;
  season_id: string;
  total_target_revenue: number;
  base_price_per_guest: number | null;
  season_price_factor: number;
  target_labor_percentage: number;
  avg_hourly_wage: number | null;
  status: SeasonBudgetStatus;
};

export type DayFactor = {
  day_factor_id: string;
  weekday: number;
  factor: number;
};

export type HourFactor = {
  hour_factor_id: string;
  hour: number;
  factor: number;
};

export type PlanningEventCategory =
  | "external_scraped"
  | "cultural_commercial"
  | "internal"
  | "weather"
  | "recurring";

export type PlanningEventSource =
  | "manual"
  | "scraped_municipality"
  | "scraped_cultural"
  | "weather_api"
  | "booking_integration"
  | "historical_import";

export type PlanningEventRow = {
  planning_event_id: string;
  workspace_id: string;
  planning_cycle_id: string | null;
  name: string;
  description: string | null;
  category: PlanningEventCategory;
  source: PlanningEventSource;
  event_date: string;
  end_date: string | null;
  demand_multiplier: number;
  expected_covers: number | null;
  confidence: number | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  external_source_url: string | null;
  hours_override_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanningCycleStatus = "draft" | "active" | "archived";

export type PlanningCycleRow = {
  planning_cycle_id: string;
  workspace_id: string;
  name: string;
  start_date: string;
  end_date: string;
  total_revenue_target: number | null;
  status: PlanningCycleStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SeasonGoalStatus = "active" | "completed" | "cancelled";

export type SeasonGoalRow = {
  season_goal_id: string;
  workspace_id: string;
  season_id: string;
  title: string;
  description: string | null;
  metric_key: string | null;
  target_value: number | null;
  target_unit: string | null;
  status: SeasonGoalStatus;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
