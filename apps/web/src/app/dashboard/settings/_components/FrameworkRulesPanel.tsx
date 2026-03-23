"use client";

// Panel for viewing and managing cascade framework rules.
//
// Shows rules from the regulatory framework bound to this workspace.
// Each rule displays its Norwegian description, category, outcome badge,
// and source reference. Overridable rules have a select to change the
// effective outcome.
//
// UI Events:
// - action: change outcome select → toggleOverride mutation
// - color-regime: outcome-based (allowed=green, exception=yellow, review=orange, blocked=red)

import { useContext } from "react";
import { Shield, Lock } from "lucide-react";
import { Card, Skeleton } from "@smartout/ui";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import {
  useFrameworkRules,
  type FrameworkRuleDisplay,
  type EvaluationOutcome,
} from "../_hooks/use-framework-rules";

// ─── Outcome display config ──────────────────────────────────────────────────

const OUTCOME_CONFIG: Record<EvaluationOutcome, { label: string; color: string }> = {
  allowed: { label: "Tillatt", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  allowed_with_exception: {
    label: "Tillatt (unntak)",
    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  },
  review_required: {
    label: "Krever vurdering",
    color: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  },
  blocked: { label: "Blokkert", color: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const CATEGORY_LABELS: Record<string, string> = {
  working_hours: "Arbeidstid",
  rest_period: "Hvile",
  youth: "Ungdom",
  overtime: "Overtid",
  scheduling: "Planlegging",
  compensation: "Kompensasjon",
};

const OUTCOME_OPTIONS: EvaluationOutcome[] = [
  "allowed",
  "allowed_with_exception",
  "review_required",
  "blocked",
];

// ─── Rule card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  isDark,
  onOverrideChange,
}: {
  rule: FrameworkRuleDisplay;
  isDark: boolean;
  onOverrideChange: (outcome: EvaluationOutcome | null) => void;
}) {
  const effectiveOutcome = rule.overrideOutcome ?? rule.defaultOutcome;
  const config = OUTCOME_CONFIG[effectiveOutcome];
  const categoryLabel = CATEGORY_LABELS[rule.category] ?? rule.category;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        {/* Code pill */}
        <div className="bg-muted text-muted-foreground w-14 shrink-0 rounded px-2 py-1 text-center text-xs font-bold">
          {rule.code}
        </div>

        {/* Description + meta */}
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-semibold">{rule.descriptionNo}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {/* Category badge */}
            <span
              className={`rounded px-1.5 py-0.5 text-xs ${
                isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {categoryLabel}
            </span>

            {/* Source reference */}
            {rule.sourceReference && (
              <span className="text-muted-foreground text-xs">{rule.sourceReference}</span>
            )}

            {/* Override indicator */}
            {rule.overrideOutcome && <span className="text-xs text-blue-400">Overstyrt</span>}
          </div>
        </div>

        {/* Outcome control */}
        <div className="flex shrink-0 items-center gap-2">
          {rule.outcomeOverridable ? (
            <select
              value={effectiveOutcome}
              onChange={(e) => {
                const newOutcome = e.target.value as EvaluationOutcome;
                if (newOutcome === rule.defaultOutcome) {
                  // Revert to default — delete override
                  onOverrideChange(null);
                } else {
                  onOverrideChange(newOutcome);
                }
              }}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isDark
                  ? "border-zinc-700 bg-zinc-800 text-zinc-200"
                  : "border-zinc-200 bg-white text-zinc-800"
              }`}
            >
              {OUTCOME_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {OUTCOME_CONFIG[opt].label}
                  {opt === rule.defaultOutcome ? " (standard)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${config.color}`}
              >
                {config.label}
              </span>
              <Lock className="text-muted-foreground h-3 w-3" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RulesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-7 w-14 rounded" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-7 w-28 rounded" />
        </Card>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FrameworkRulesPanel() {
  const { isDark } = useContext(DashboardContext);
  const { rules, isLoading, toggleOverride } = useFrameworkRules();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-96" />
        </div>
        <RulesSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-foreground text-lg font-semibold">Arbeidsregler</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Regler fra gjeldende rammeverk (arbeidsmiljøloven, riksavtalen). Overstyrbare regler kan
          justeres per workspace. Låste regler kan ikke endres.
        </p>
      </div>

      {/* Empty state */}
      {rules.length === 0 && (
        <div className="border-border bg-muted/40 rounded-lg border border-dashed px-4 py-8">
          <div className="flex flex-col items-center text-center">
            <div className="bg-muted mb-3 flex h-10 w-10 items-center justify-center rounded-full">
              <Shield className="text-muted-foreground h-5 w-5" />
            </div>
            <p className="text-muted-foreground text-sm">
              Ingen rammeverk er koblet til dette workspace. Rammeverk aktiveres automatisk ved
              oppsett.
            </p>
          </div>
        </div>
      )}

      {/* Rule cards */}
      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.ruleId}
              rule={rule}
              isDark={isDark}
              onOverrideChange={(outcome) => {
                toggleOverride.mutate({
                  ruleId: rule.ruleId,
                  overrideId: rule.overrideId,
                  outcome,
                  reason: outcome ? "Admin-overstyring" : "",
                  validFrom: null,
                  validUntil: null,
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
