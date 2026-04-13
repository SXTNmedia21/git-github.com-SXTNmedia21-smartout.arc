"use client";

/**
 * SeasonGoalsTab — Season-scoped goal management.
 *
 * Displays goals for the selected season with inline create form
 * and status controls (complete, cancel, reactivate, delete).
 * Each goal can optionally track a numeric KPI target.
 */

import { useState } from "react";
import { Plus, Check, X, Trash2, RotateCcw, Loader2, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSeasonGoals } from "../_hooks/use-season-goals";
import type { SeasonGoalStatus } from "@/lib/cascade/types";

type Props = {
  seasonId: string;
  isDark: boolean;
};

const STATUS_LABELS: Record<SeasonGoalStatus, string> = {
  active: "Aktiv",
  completed: "Fullført",
  cancelled: "Avbrutt",
};

function statusBadgeClass(status: SeasonGoalStatus, isDark: boolean): string {
  switch (status) {
    case "completed":
      return isDark
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
        : "border-emerald-200 bg-emerald-50 text-emerald-600";
    case "cancelled":
      return isDark
        ? "border-zinc-500/20 bg-zinc-500/10 text-zinc-500"
        : "border-zinc-300 bg-zinc-100 text-zinc-400";
    default:
      return isDark
        ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
        : "border-orange-200 bg-orange-50 text-orange-600";
  }
}

export function SeasonGoalsTab({ seasonId, isDark }: Props) {
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

  const cardClass = isDark
    ? "rounded-xl border border-zinc-800 bg-[#0c0c0e] p-4"
    : "rounded-xl border border-zinc-200 bg-white p-4";

  const labelClass = isDark ? "text-zinc-400" : "text-zinc-500";
  const inputClass = isDark
    ? "border-zinc-700 bg-zinc-900 text-white"
    : "border-zinc-300 bg-white text-zinc-900";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`h-6 w-6 animate-spin ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            Sesongmål
          </h3>
          <p className={`text-xs ${labelClass}`}>Sett mål og KPI-er for denne sesongen</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
          className="h-8 bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white hover:opacity-90"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Nytt mål
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className={cardClass}>
          <div className="space-y-3">
            <div>
              <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>Tittel *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="F.eks. Redusere lønnskostnad til 28%"
                className={`h-8 text-sm ${inputClass}`}
              />
            </div>
            <div>
              <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>
                Beskrivelse
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Valgfri utdypning"
                className={`h-8 text-sm ${inputClass}`}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>
                  Nøkkeltall
                </label>
                <Input
                  value={metricKey}
                  onChange={(e) => setMetricKey(e.target.value)}
                  placeholder="labor_pct"
                  className={`h-8 text-sm ${inputClass}`}
                />
              </div>
              <div>
                <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>Målverdi</label>
                <Input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="28"
                  className={`h-8 text-sm ${inputClass}`}
                />
              </div>
              <div>
                <label className={`mb-1 block text-xs font-semibold ${labelClass}`}>Enhet</label>
                <Input
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  placeholder="%"
                  className={`h-8 text-sm ${inputClass}`}
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
                Avbryt
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!title.trim() || createGoal.isPending}
                className="h-7 bg-gradient-to-r from-orange-600 to-rose-600 text-xs text-white hover:opacity-90"
              >
                {createGoal.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Opprett
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 && !showCreate ? (
        <div className={`${cardClass} py-8 text-center`}>
          <Target
            className={`mx-auto mb-3 h-8 w-8 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}
          />
          <p className={`text-sm ${labelClass}`}>Ingen mål satt for denne sesongen ennå.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => (
            <div key={goal.season_goal_id} className={`${cardClass} flex items-start gap-3`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-semibold ${
                      goal.status === "cancelled"
                        ? "line-through opacity-50"
                        : isDark
                          ? "text-white"
                          : "text-zinc-900"
                    }`}
                  >
                    {goal.title}
                  </p>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusBadgeClass(goal.status, isDark)}`}
                  >
                    {STATUS_LABELS[goal.status]}
                  </span>
                </div>
                {goal.description && (
                  <p className={`mt-0.5 text-xs ${labelClass}`}>{goal.description}</p>
                )}
                {goal.target_value != null && (
                  <p
                    className={`mt-1 font-mono text-xs ${isDark ? "text-orange-400/70" : "text-orange-600/70"}`}
                  >
                    {goal.metric_key ? `${goal.metric_key}: ` : ""}
                    {goal.target_value} {goal.target_unit ?? ""}
                  </p>
                )}
              </div>
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
                      title="Marker som fullført"
                      aria-label="Marker som fullført"
                      className={`rounded-md p-1.5 transition-colors ${isDark ? "text-emerald-500 hover:bg-emerald-500/10" : "text-emerald-600 hover:bg-emerald-50"}`}
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
                      title="Avbryt mål"
                      aria-label="Avbryt mål"
                      className={`rounded-md p-1.5 transition-colors ${isDark ? "text-zinc-500 hover:bg-zinc-800" : "text-zinc-400 hover:bg-zinc-100"}`}
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
                    title="Reaktiver mål"
                    aria-label="Reaktiver mål"
                    className={`rounded-md p-1.5 transition-colors ${isDark ? "text-orange-400 hover:bg-orange-500/10" : "text-orange-600 hover:bg-orange-50"}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (window.confirm("Er du sikker på at du vil slette dette målet?")) {
                      deleteGoal.mutate(goal.season_goal_id);
                    }
                  }}
                  title="Slett mål"
                  aria-label="Slett mål"
                  className={`rounded-md p-1.5 transition-colors ${isDark ? "text-red-500/60 hover:bg-red-500/10" : "text-red-400 hover:bg-red-50"}`}
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
