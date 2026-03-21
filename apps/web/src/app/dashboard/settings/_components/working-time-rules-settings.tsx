"use client";

// Configuration panel for AML (arbeidsmiljøloven) working time rules.
//
// This is NOT a CRUD table — there are exactly 6 pre-defined rules (W01–W06).
// The workspace either has them activated or not. Once activated, each rule
// card is inline-editable: threshold value, severity level, and active state.
//
// Flow:
//   1. Load — check if rules exist for this workspace
//   2. Empty state — greyed-out default cards + "Aktiver AML-regler" button
//   3. Active state — 6 editable rule cards + "Lagre endringer" button
//
// UI Events:
// - action: useActivateDefaults().mutate() — "Aktiver AML-regler" button
// - action: updateLocalRule(code, patch) — threshold input / severity badge click / switch
// - action: useUpsertWorkingTimeRules().mutate(localState) — "Lagre endringer" button
// - color-regime: severity-based (warn=orange badge, block=red badge)

import { useState, useEffect } from "react";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { Button, Card, Skeleton } from "@smartout/ui";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  useWorkingTimeRules,
  useUpsertWorkingTimeRules,
  useActivateDefaults,
  DEFAULT_WORKING_TIME_RULES,
  type WorkingTimeRuleRow,
  type WorkingTimeRuleUpdate,
  type RuleSeverity,
} from "../_hooks/use-working-time-rules";

// ─── Types ────────────────────────────────────────────────────────────────────

// Local editable state for each card — mirrors WorkingTimeRuleUpdate
// but includes display fields (name, description) for rendering.
type LocalRule = {
  id: string;
  code: string;
  name: string;
  description: string;
  threshold_value: number;
  severity: RuleSeverity;
  is_active: boolean;
};

// ─── Severity badge ───────────────────────────────────────────────────────────

// Clicking the badge toggles between 'warn' and 'block'. Visual design:
//   warn  → orange (flags in payroll, does not prevent scheduling)
//   block → red    (prevents scheduling outright)

type SeverityBadgeProps = {
  severity: RuleSeverity;
  onChange: (next: RuleSeverity) => void;
  disabled?: boolean;
};

function SeverityBadge({ severity, onChange, disabled }: SeverityBadgeProps) {
  const isBlock = severity === "block";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(isBlock ? "warn" : "block")}
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold transition-colors ${
        isBlock
          ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
          : "border-orange-500/30 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 dark:text-orange-400"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {isBlock ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
      {isBlock ? "Blokkér" : "Advarsel"}
    </button>
  );
}

// ─── Rule card ────────────────────────────────────────────────────────────────

// Each card represents one working time rule. When `dimmed` is true the card
// is shown in the "not yet activated" state — greyed out, inputs disabled.

type RuleCardProps = {
  rule: LocalRule;
  dimmed?: boolean;
  onChange: (patch: Partial<LocalRule>) => void;
};

function RuleCard({ rule, dimmed, onChange }: RuleCardProps) {
  return (
    <Card
      className={`flex items-center gap-4 p-4 transition-opacity ${dimmed ? "opacity-50" : "opacity-100"}`}
    >
      {/* Code pill */}
      <div className="bg-muted text-muted-foreground w-12 shrink-0 rounded px-2 py-1 text-center text-xs font-bold">
        {rule.code}
      </div>

      {/* Name + description */}
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-semibold">{rule.name}</p>
        {rule.description && (
          <p className="text-muted-foreground mt-0.5 text-xs">{rule.description}</p>
        )}
      </div>

      {/* Threshold input */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Input
          type="number"
          min={0}
          step={0.5}
          value={rule.threshold_value}
          disabled={dimmed}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            if (!isNaN(parsed)) onChange({ threshold_value: parsed });
          }}
          className="h-8 w-20 text-right text-sm"
        />
        <span className="text-muted-foreground text-xs">t</span>
      </div>

      {/* Severity toggle badge */}
      <SeverityBadge
        severity={rule.severity}
        onChange={(next) => onChange({ severity: next })}
        disabled={dimmed}
      />

      {/* Active switch */}
      <Switch
        checked={rule.is_active}
        disabled={dimmed}
        onCheckedChange={(checked) => onChange({ is_active: checked })}
      />
    </Card>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RulesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-7 w-12 rounded" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-72" />
          </div>
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-5 w-9 rounded-full" />
        </Card>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Maps DB rows to local editable state, preserving display-only fields from
// the DEFAULT_WORKING_TIME_RULES constant (name/description come from the DB row
// but we fall back to the constant if somehow absent).
function dbRowsToLocal(rows: WorkingTimeRuleRow[]): LocalRule[] {
  return rows.map((row) => {
    const def = DEFAULT_WORKING_TIME_RULES.find((d) => d.code === row.code);
    return {
      id: row.id,
      code: row.code,
      name: row.name ?? def?.name ?? row.code,
      description: row.description ?? def?.description ?? "",
      threshold_value: Number(row.threshold_value),
      severity: row.severity,
      is_active: row.is_active,
    };
  });
}

// Builds the dimmed preview cards shown before activation.
function defaultsToLocal(): LocalRule[] {
  return DEFAULT_WORKING_TIME_RULES.map((def, i) => ({
    id: `preview-${i}`,
    code: def.code,
    name: def.name,
    description: def.description,
    threshold_value: def.threshold_value,
    severity: def.severity,
    is_active: true,
  }));
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WorkingTimeRulesSettings() {
  const { data: dbRules, isLoading } = useWorkingTimeRules();
  const upsert = useUpsertWorkingTimeRules();
  const activateDefaults = useActivateDefaults();

  // Local working copy of all 6 rules — keeps UI snappy between saves.
  const [localRules, setLocalRules] = useState<LocalRule[]>([]);
  // true once we've synced from the DB query
  const [initialised, setInitialised] = useState(false);

  // Sync DB → local on first successful fetch and whenever rules change externally.
  useEffect(() => {
    if (!dbRules) return;
    setLocalRules(dbRules.length > 0 ? dbRowsToLocal(dbRules) : defaultsToLocal());
    setInitialised(true);
  }, [dbRules]);

  // Whether this workspace has activated its rules yet
  const hasRules = (dbRules?.length ?? 0) > 0;

  function updateLocalRule(code: string, patch: Partial<LocalRule>) {
    setLocalRules((prev) => prev.map((r) => (r.code === code ? { ...r, ...patch } : r)));
  }

  function handleSave() {
    const updates: WorkingTimeRuleUpdate[] = localRules.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      threshold_value: r.threshold_value,
      severity: r.severity,
      is_active: r.is_active,
    }));
    upsert.mutate(updates);
  }

  // ─── Loading state ────────────────────────────────────────────────────────

  if (isLoading || !initialised) {
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-foreground text-lg font-semibold">Arbeidstidsregler</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Regler basert på arbeidsmiljøloven (AML). Blokkerende regler forhindrer planlegging
            utover grensen. Advarsler flagges i lønnskjøring.
          </p>
        </div>

        {/* "Aktiver AML-regler" only shown before activation */}
        {!hasRules && (
          <Button
            size="sm"
            disabled={activateDefaults.isPending}
            onClick={() => activateDefaults.mutate()}
          >
            {activateDefaults.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Aktiverer...
              </>
            ) : (
              "Aktiver AML-regler"
            )}
          </Button>
        )}
      </div>

      {/* Empty state banner — shown when rules not yet activated */}
      {!hasRules && (
        <div className="border-border bg-muted/40 rounded-lg border border-dashed px-4 py-3">
          <p className="text-muted-foreground text-sm">
            Ingen arbeidstidsregler er aktivert ennå. Klikk{" "}
            <span className="text-foreground font-medium">Aktiver AML-regler</span> for å sette opp
            standardverdiene fra arbeidsmiljøloven.
          </p>
        </div>
      )}

      {/* Rule cards — dimmed/disabled before activation, editable after */}
      <div className="space-y-3">
        {localRules.map((rule) => (
          <RuleCard
            key={rule.code}
            rule={rule}
            dimmed={!hasRules}
            onChange={(patch) => updateLocalRule(rule.code, patch)}
          />
        ))}
      </div>

      {/* Save button — only shown when rules are active */}
      {hasRules && (
        <div className="flex justify-end pt-2">
          <Button size="sm" disabled={upsert.isPending} onClick={handleSave}>
            {upsert.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Lagrer...
              </>
            ) : (
              "Lagre endringer"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
