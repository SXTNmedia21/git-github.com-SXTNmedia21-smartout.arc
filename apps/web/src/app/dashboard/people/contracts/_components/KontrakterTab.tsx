"use client";

/**
 * KontrakterTab — the "Kontrakter" (contracts) sub-surface of /dashboard/contracts.
 *
 * Lifts the existing contract list + bucket filters into a tab component. Bucket
 * filters (`all | ready_for_action | waiting_employee | completed`) become a
 * sub-filter row above the ContractsDataTable.
 *
 * Emits:
 *  - `contract.tab_switched` when the sub-bucket filter changes.
 *
 * Workspace scope resolved from DashboardContext by the parent hub page.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { FileEdit } from "lucide-react";
import { cn } from "@smartout/ui";
import { ContractsDataTable } from "./contracts-data-table";
import { groupByBucket, type ContractStatus, type DashboardBucket } from "../filters";

// Minimal shape returned by the contracts API — only status is needed for bucketing
type ContractRow = { status: ContractStatus };

const BUCKET_KEYS: DashboardBucket[] = ["ready_for_action", "waiting_employee", "completed"];

const EMPTY_COUNTS: Record<DashboardBucket, number> = {
  waiting_employee: 0,
  ready_for_action: 0,
  completed: 0,
};

type Props = {
  workspaceId: string;
  actorProfileId: string | null;
  /** WS2H: count of pending tariff-version amendments across all contracts in this workspace. */
  pendingTariffAmendmentCount?: number;
};

export function KontrakterTab({
  workspaceId,
  actorProfileId,
  pendingTariffAmendmentCount = 0,
}: Props) {
  const { t } = useTranslation("contracts");
  const [allContracts, setAllContracts] = useState<ContractRow[]>([]);
  const [activeBucket, setActiveBucket] = useState<"all" | DashboardBucket>("all");

  // Fetch a lightweight contract list to compute bucket counts. The data table
  // handles its own paginated fetching — this is only for the sub-tab badges.
  const fetchForCounts = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/employment-contracts/list?workspace_id=${workspaceId}`);
      if (!res.ok) return;
      const json = (await res.json()) as { data?: ContractRow[] };
      setAllContracts(json.data ?? []);
    } catch {
      // Counts are non-critical — silently ignore errors
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchForCounts();
  }, [fetchForCounts]);

  const bucketCounts = useMemo(() => {
    if (allContracts.length === 0) return EMPTY_COUNTS;
    const buckets = groupByBucket(allContracts);
    return {
      waiting_employee: buckets.waiting_employee.length,
      ready_for_action: buckets.ready_for_action.length,
      completed: buckets.completed.length,
    };
  }, [allContracts]);

  function handleBucketChange(next: string) {
    const from = activeBucket;
    const to = next as "all" | DashboardBucket;
    setActiveBucket(to);
    if (from !== to) {
      void emit({
        event: "contract.tab_switched",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorProfileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "workspace",
            entity_id: workspaceId,
            entity_label: "Contracts Hub",
          },
          data: {
            from: `kontrakter:${from}`,
            to: `kontrakter:${to}`,
          },
        },
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* WS2H: Bulk tariff-amendment banner — shown when tariff-version-changed affects contracts */}
      {pendingTariffAmendmentCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <FileEdit className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {pendingTariffAmendmentCount} kontrakt{pendingTariffAmendmentCount !== 1 ? "er" : ""}{" "}
              har amendment-tilbud klare
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              Tariff-versjon er oppdatert — ansatte vil motta varsel om å signere ny versjon.
            </p>
          </div>
          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
            {pendingTariffAmendmentCount}
          </span>
        </div>
      )}

      {/* Bucket sub-filters — chip-row (nested Tabs forbidden per spec §3.2) */}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Kontrakt-bucket">
        {/* "all" bucket */}
        <button
          key="all"
          type="button"
          onClick={() => handleBucketChange("all")}
          data-active={activeBucket === "all" ? "true" : "false"}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
            activeBucket === "all"
              ? "border-foreground/20 bg-foreground text-background"
              : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
          )}
        >
          {t("buckets.all")}
        </button>
        {BUCKET_KEYS.map((bucket) => (
          <button
            key={bucket}
            type="button"
            onClick={() => handleBucketChange(bucket)}
            data-active={activeBucket === bucket ? "true" : "false"}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              activeBucket === bucket
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
            )}
          >
            {t(`buckets.${bucket}`)}
            {bucketCounts[bucket] > 0 && (
              <span className="ml-1.5 opacity-70">{bucketCounts[bucket]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Each bucket renders the data table — bucket-specific filtering is
          handled by the data table's own status select for now */}
      <ContractsDataTable workspaceId={workspaceId} actorProfileId={actorProfileId} />
    </div>
  );
}
