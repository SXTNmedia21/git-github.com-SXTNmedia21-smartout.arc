// packages/ai/src/tools/season/learn-factors.ts
// Tool: learnFactors — Stage: reflect
// Queries current and previous season day/hour factors for comparison.
import { z } from "zod";
import { defineTool } from "../../types";
import type { SeasonToolContext } from "./types";

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const learnFactors = defineTool({
  name: "learn_factors",
  description:
    "Compare planned day/hour factors against actual performance from previous seasons. Highlights where estimates were off and suggests adjustments.",
  schema: z.object({}),
  execute: async (_params, ctx: SeasonToolContext) => {
    // Get the two most recent seasons with budgets
    const { data: seasons, error: seasonError } = await ctx.supabase
      .from("season")
      .select("season_id, name, status, start_date, end_date")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(2);

    if (seasonError || !seasons?.length) {
      return "No seasons found. Create a season first to start tracking factors.";
    }

    const currentSeason = seasons[0]!;
    const previousSeason = seasons.length > 1 ? seasons[1] : null;

    // Get current season's budget and factors
    const { data: currentBudget } = await ctx.supabase
      .from("season_budget")
      .select("season_budget_id, total_target_revenue, target_labor_percentage")
      .eq("season_id", currentSeason.season_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (!currentBudget) {
      return `Season '${currentSeason.name}' has no budget configured yet.`;
    }

    // Get current day factors
    const { data: currentDayFactors } = await ctx.supabase
      .from("day_factor")
      .select("weekday, factor")
      .eq("season_budget_id", currentBudget.season_budget_id)
      .order("weekday", { ascending: true });

    // Get current hour factors
    const { data: currentHourFactors } = await ctx.supabase
      .from("hour_factor")
      .select("hour, factor")
      .eq("season_budget_id", currentBudget.season_budget_id)
      .order("hour", { ascending: true });

    const lines: string[] = [`Factor Analysis for '${currentSeason.name}':`];

    // Day factors summary
    lines.push("", "Day Factors (current season):");
    if (currentDayFactors?.length) {
      for (const df of currentDayFactors) {
        const bar = "=".repeat(Math.round(df.factor * 5));
        lines.push(
          `  ${WEEKDAY_NAMES[df.weekday]?.padEnd(10) ?? "?"}: ${df.factor.toFixed(1)} ${bar}`,
        );
      }
    } else {
      lines.push("  No day factors configured.");
    }

    // Hour factors summary (only show non-1.0 or peak hours 10-22)
    lines.push("", "Hour Factors (peak hours 10-22):");
    if (currentHourFactors?.length) {
      const peakHours = currentHourFactors.filter((hf) => hf.hour >= 10 && hf.hour <= 22);
      for (const hf of peakHours) {
        const bar = "=".repeat(Math.round(hf.factor * 5));
        lines.push(`  ${String(hf.hour).padStart(2, "0")}:00: ${hf.factor.toFixed(1)} ${bar}`);
      }
    } else {
      lines.push("  No hour factors configured.");
    }

    // Compare with previous season if available
    if (previousSeason) {
      const { data: prevBudget } = await ctx.supabase
        .from("season_budget")
        .select("season_budget_id, total_target_revenue, target_labor_percentage")
        .eq("season_id", previousSeason.season_id)
        .eq("workspace_id", ctx.workspaceId)
        .single();

      if (prevBudget) {
        const { data: prevDayFactors } = await ctx.supabase
          .from("day_factor")
          .select("weekday, factor")
          .eq("season_budget_id", prevBudget.season_budget_id)
          .order("weekday", { ascending: true });

        lines.push("", `Comparison with previous season '${previousSeason.name}':`);

        if (prevDayFactors?.length && currentDayFactors?.length) {
          const diffs: string[] = [];
          for (const curr of currentDayFactors) {
            const prev = prevDayFactors.find((p) => p.weekday === curr.weekday);
            if (prev && Math.abs(curr.factor - prev.factor) >= 0.1) {
              const direction = curr.factor > prev.factor ? "up" : "down";
              const dayName = WEEKDAY_NAMES[curr.weekday] ?? "?";
              diffs.push(
                `  ${dayName}: ${prev.factor.toFixed(1)} -> ${curr.factor.toFixed(1)} (${direction})`,
              );
            }
          }
          if (diffs.length > 0) {
            lines.push("  Changed day factors:");
            lines.push(...diffs);
          } else {
            lines.push("  Day factors unchanged from previous season.");
          }
        }

        // Revenue comparison
        if (prevBudget.total_target_revenue > 0) {
          const revChange =
            ((currentBudget.total_target_revenue - prevBudget.total_target_revenue) /
              prevBudget.total_target_revenue) *
            100;
          lines.push(
            `  Revenue target: ${prevBudget.total_target_revenue.toLocaleString("nb-NO")} -> ${currentBudget.total_target_revenue.toLocaleString("nb-NO")} (${revChange >= 0 ? "+" : ""}${revChange.toFixed(1)}%)`,
          );
        }
      }
    } else {
      lines.push(
        "",
        "No previous season data available for comparison.",
        "Complete this season to enable factor learning for next time.",
      );
    }

    return lines.join("\n");
  },
});
