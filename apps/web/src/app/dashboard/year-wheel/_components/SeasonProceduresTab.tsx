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
import { Loader2, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSeasonPolicyBindings } from "../_hooks/use-season-policy-bindings";

type Props = {
  seasonId: string;
  isDark: boolean;
};

const POLICY_TYPE_LABELS: Record<string, string> = {
  operational: "Drift",
  haccp: "HACCP",
  hr: "HR",
  safety: "Sikkerhet",
  access: "Tilgang",
  payroll: "Lønn",
  custom: "Egendefinert",
};

const POLICY_TYPE_ORDER = ["safety", "haccp", "operational", "hr", "access", "payroll", "custom"];

function policyTypeIcon(type: string, isDark: boolean) {
  const cls = `h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`;
  switch (type) {
    case "safety":
    case "haccp":
      return <ShieldAlert className={cls} />;
    default:
      return <ShieldCheck className={cls} />;
  }
}

export function SeasonProceduresTab({ seasonId, isDark }: Props) {
  const { policies, isLoading, toggleBinding } = useSeasonPolicyBindings(seasonId);
  const [pendingPolicyId, setPendingPolicyId] = useState<string | null>(null);

  const cardClass = isDark
    ? "rounded-xl border border-zinc-800 bg-[#0c0c0e]"
    : "rounded-xl border border-zinc-200 bg-white";

  const labelClass = isDark ? "text-zinc-400" : "text-zinc-500";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`h-6 w-6 animate-spin ${isDark ? "text-zinc-600" : "text-zinc-300"}`} />
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className={`${cardClass} p-12 text-center`}>
        <ShieldOff
          className={`mx-auto mb-3 h-8 w-8 ${isDark ? "text-zinc-700" : "text-zinc-300"}`}
        />
        <h3 className={`mb-2 text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
          Ingen prosedyrer
        </h3>
        <p className={`text-xs ${labelClass}`}>
          Opprett prosedyrer under HMS-modulen for å kunne aktivere dem per sesong.
        </p>
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
        <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
          Prosedyrer & HMS
        </h3>
        <p className={`text-xs ${labelClass}`}>
          {activeCount} av {policies.length} prosedyrer er aktive for denne sesongen
        </p>
      </div>

      {grouped.map(({ type, items }) => (
        <div key={type} className={cardClass}>
          <div
            className={`flex items-center gap-2 border-b px-4 py-2.5 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}
          >
            {policyTypeIcon(type, isDark)}
            <span className={`text-xs font-bold tracking-wider uppercase ${labelClass}`}>
              {POLICY_TYPE_LABELS[type] ?? type}
            </span>
            <span className={`text-[10px] ${labelClass}`}>
              ({items.filter((i) => i.is_bound_to_season).length}/{items.length})
            </span>
          </div>
          <div className="divide-y divide-zinc-800/30">
            {items.map((policy) => (
              <div
                key={policy.policy_id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isDark ? "hover:bg-zinc-800/30" : "hover:bg-zinc-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p
                    id={`policy-name-${policy.policy_id}`}
                    className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}
                  >
                    {policy.name}
                  </p>
                  {policy.description && (
                    <p className={`mt-0.5 truncate text-xs ${labelClass}`}>{policy.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        policy.enforcement_status === "enforced"
                          ? isDark
                            ? "bg-red-500/10 text-red-400"
                            : "bg-red-50 text-red-600"
                          : isDark
                            ? "bg-zinc-500/10 text-zinc-500"
                            : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      {policy.enforcement_status}
                    </span>
                    {!policy.is_active_global && (
                      <span
                        className={`text-[10px] ${isDark ? "text-amber-400" : "text-amber-600"}`}
                      >
                        (Globalt deaktivert)
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
