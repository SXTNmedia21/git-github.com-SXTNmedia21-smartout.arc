"use client";

/**
 * SeasonGoalsTab — Season-scoped goal management.
 *
 * Displays goals for the selected season with inline create form
 * and status controls (complete, cancel, reactivate, delete).
 * Each goal can optionally track a numeric KPI target.
 */

import { useState } from "react";
import { useTranslation } from "@smartout/i18n";
import { Plus, Check, X, Trash2, RotateCcw, Loader2, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSeasonGoals } from "../_hooks/use-season-goals";
import type { SeasonGoalStatus } from "@/lib/cascade/types";

type Props = {
  seasonId: string;
};

// CSS variable-based badge classes per goal status.
// active = success (green) to indicate the goal is in flight.
// completed = muted because the work is done — de-emphasised.
// cancelled = warning (orange) to flag that the goal was abandoned.
const STATUS_BADGE_CLASSES: Record<SeasonGoalStatus, string> = {
  active: "border-success/20 bg-success/10 text-success",
  completed: "border-muted-foreground/20 bg-muted text-muted-foreground",
  cancelled: "border-warning/20 bg-warning/10 text-warning",
};

export function SeasonGoalsTab({ seasonId }: Props) {
  const { t } = useTranslation("dashboard");
  const { goals, isLoading, createGoal, updateGoal, deleteGoal } = useSeasonGoals(seasonId);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metricKey, setMetricKey] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [targetUnit, setTargetUnit] = useState("");

  function handleCreate() {
    if (!title.trim()) return;
    createGoal.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        metric_key: metricKey.trim() || null,
        target_value: targetValue ? Number(targetValue) : null,
        target_unit: targetUnit.trim() || null,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setMetricKey("");
          setTargetValue("");
          setTargetUnit("");
          setShowCreate(false);
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-sm font-bold">{t("yearWheel.season_goals")}</h3>
          <p className="text-muted-foreground text-xs">{t("yearWheel.goals_description")}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
          className="h-8 bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white hover:opacity-90"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("yearWheel.new_goal")}
        </Button>
      </div>

      {/* Inline create form */}
      {showCreate && (
        <div className="border-border bg-card rounded-xl border p-4">
          <div className="space-y-3">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                {t("yearWheel.goal_title")} *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("yearWheel.placeholder_goal_title")}
                className="border-border bg-background text-foreground h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                {t("yearWheel.goal_description")}
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("yearWheel.placeholder_goal_description")}
                className="border-border bg-background text-foreground h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  {t("yearWheel.goal_metric_key")}
                </label>
                <Input
                  value={metricKey}
                  onChange={(e) => setMetricKey(e.target.value)}
                  placeholder="labor_pct"
                  className="border-border bg-background text-foreground h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  {t("yearWheel.goal_target_value")}
                </label>
                <Input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="28"
                  className="border-border bg-background text-foreground h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                  {t("yearWheel.goal_unit")}
                </label>
                <Input
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  placeholder="%"
                  className="border-border bg-background text-foreground h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreate(false)}
                className="h-7 text-xs"
              >
                {t("yearWheel.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!title.trim() || createGoal.isPending}
                className="h-7 bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white hover:opacity-90"
              >
                {createGoal.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {t("yearWheel.create")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Goals list — empty state or populated list */}
      {goals.length === 0 && !showCreate ? (
        <div className="border-border bg-card rounded-xl border p-4 py-8 text-center">
          <Target className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          <p className="text-muted-foreground text-sm">{t("yearWheel.no_goals_yet")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => (
            <div
              key={goal.season_goal_id}
              className="border-border bg-card flex items-start gap-3 rounded-xl border p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-foreground text-sm font-semibold ${
                      goal.status === "cancelled" ? "line-through opacity-50" : ""
                    }`}
                  >
                    {goal.title}
                  </p>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGE_CLASSES[goal.status]}`}
                  >
                    {t(`yearWheel.goal_status_${goal.status}`)}
                  </span>
                </div>
                {goal.description && (
                  <p className="text-muted-foreground mt-0.5 text-xs">{goal.description}</p>
                )}
                {goal.target_value != null && (
                  <p className="text-brand-orange mt-1 font-mono text-xs">
                    {goal.metric_key ? `${goal.metric_key}: ` : ""}
                    {goal.target_value} {goal.target_unit ?? ""}
                  </p>
                )}
              </div>

              {/* Status action buttons */}
              <div className="flex shrink-0 items-center gap-1">
                {goal.status === "active" && (
                  <>
                    <button
                      onClick={() =>
                        updateGoal.mutate({
                          season_goal_id: goal.season_goal_id,
                          status: "completed",
                        })
                      }
                      title={t("yearWheel.mark_completed")}
                      aria-label={t("yearWheel.mark_completed")}
                      className="text-success hover:bg-success/10 rounded-md p-1.5 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        updateGoal.mutate({
                          season_goal_id: goal.season_goal_id,
                          status: "cancelled",
                        })
                      }
                      title={t("yearWheel.cancel_goal")}
                      aria-label={t("yearWheel.cancel_goal")}
                      className="text-muted-foreground hover:bg-muted rounded-md p-1.5 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {(goal.status === "completed" || goal.status === "cancelled") && (
                  <button
                    onClick={() =>
                      updateGoal.mutate({ season_goal_id: goal.season_goal_id, status: "active" })
                    }
                    title={t("yearWheel.reactivate_goal")}
                    aria-label={t("yearWheel.reactivate_goal")}
                    className="text-warning hover:bg-warning/10 rounded-md p-1.5 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (window.confirm(t("yearWheel.confirm_delete"))) {
                      deleteGoal.mutate(goal.season_goal_id);
                    }
                  }}
                  title={t("yearWheel.delete_goal")}
                  aria-label={t("yearWheel.delete_goal")}
                  className="text-destructive/60 hover:bg-destructive/10 rounded-md p-1.5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
