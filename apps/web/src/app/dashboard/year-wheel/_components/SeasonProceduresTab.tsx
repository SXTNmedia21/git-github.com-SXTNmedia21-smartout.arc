"use client";

/**
 * SeasonProceduresTab — Per-season HMS policy activation.
 *
 * Displays all workspace policies grouped by policy_type.
 * Each policy has a toggle switch to activate/deactivate it
 * for the selected season. This lets managers decide which
 * HMS procedures should be enforced during each season.
 */

import { useState } from "react";
import { useTranslation } from "@smartout/i18n";
import { Loader2, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSeasonPolicyBindings } from "../_hooks";

type Props = {
  seasonId: string;
};

// Display order for policy type groups — safety-critical types surface first.
const POLICY_TYPE_ORDER = ["safety", "haccp", "operational", "hr", "access", "payroll", "custom"];

// Returns the appropriate shield icon for a policy type group header.
function policyTypeIcon(type: string) {
  const cls = "h-4 w-4 text-muted-foreground";
  switch (type) {
    case "safety":
    case "haccp":
      // Safety and HACCP use an alert variant to signal higher risk.
      return <ShieldAlert className={cls} />;
    default:
      return <ShieldCheck className={cls} />;
  }
}

export function SeasonProceduresTab({ seasonId }: Props) {
  const { t } = useTranslation("dashboard");
  const { policies, isLoading, toggleBinding } = useSeasonPolicyBindings(seasonId);
  const [pendingPolicyId, setPendingPolicyId] = useState<string | null>(null);

  // Maps internal policy_type keys to translated display labels.
  function getPolicyTypeLabel(type: string): string {
    const key = `yearWheel.policy_type_${type}` as Parameters<typeof t>[0];
    // Fall back to the raw type string for unknown/future types.
    return t(key) ?? type;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className="border-border bg-card rounded-xl border p-12 text-center">
        <ShieldOff className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
        <h3 className="text-foreground mb-2 text-sm font-bold">{t("yearWheel.no_procedures")}</h3>
        <p className="text-muted-foreground text-xs">{t("yearWheel.no_procedures_description")}</p>
      </div>
    );
  }

  const grouped = POLICY_TYPE_ORDER.reduce(
    (acc, type) => {
      const items = policies.filter((p) => p.policy_type === type);
      if (items.length > 0) acc.push({ type, items });
      return acc;
    },
    [] as Array<{ type: string; items: typeof policies }>,
  );

  const ungrouped = policies.filter((p) => !POLICY_TYPE_ORDER.includes(p.policy_type));
  if (ungrouped.length > 0) {
    grouped.push({ type: "other", items: ungrouped });
  }

  const activeCount = policies.filter((p) => p.is_bound_to_season).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground text-sm font-bold">{t("yearWheel.procedures_hms")}</h3>
        <p className="text-muted-foreground text-xs">
          {t("yearWheel.procedures_count", { active: activeCount, total: policies.length })}
        </p>
      </div>

      {grouped.map(({ type, items }) => (
        <div key={type} className="border-border bg-card rounded-xl border">
          {/* Group header with type label and item count */}
          <div className="border-border flex items-center gap-2 border-b px-4 py-2.5">
            {policyTypeIcon(type)}
            <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {getPolicyTypeLabel(type)}
            </span>
            <span className="text-muted-foreground text-[10px]">
              ({items.filter((i) => i.is_bound_to_season).length}/{items.length})
            </span>
          </div>

          <div className="divide-border/30 divide-y">
            {items.map((policy) => (
              <div
                key={policy.policy_id}
                className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p
                    id={`policy-name-${policy.policy_id}`}
                    className="text-foreground text-sm font-medium"
                  >
                    {policy.name}
                  </p>
                  {policy.description && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {policy.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    {/* Enforcement status badge — enforced policies are highlighted as destructive */}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        policy.enforcement_status === "enforced"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {policy.enforcement_status}
                    </span>
                    {!policy.is_active_global && (
                      <span className="text-warning text-[10px]">
                        {t("yearWheel.globally_disabled")}
                      </span>
                    )}
                  </div>
                </div>
                <Switch
                  id={`policy-toggle-${policy.policy_id}`}
                  aria-labelledby={`policy-name-${policy.policy_id}`}
                  checked={policy.is_bound_to_season}
                  onCheckedChange={(checked) => {
                    setPendingPolicyId(policy.policy_id);
                    toggleBinding.mutate(
                      { policyId: policy.policy_id, isActive: checked },
                      { onSettled: () => setPendingPolicyId(null) },
                    );
                  }}
                  disabled={toggleBinding.isPending && pendingPolicyId === policy.policy_id}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
