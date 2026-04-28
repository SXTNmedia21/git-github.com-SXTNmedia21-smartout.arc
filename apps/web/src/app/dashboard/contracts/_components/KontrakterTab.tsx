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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
};

export function KontrakterTab({ workspaceId, actorProfileId }: Props) {
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
      {/* Bucket sub-filters — typography-led, spring tab indicator inherited from shadcn Tabs */}
      <Tabs value={activeBucket} onValueChange={handleBucketChange} className="w-full">
        <TabsList>
          <TabsTrigger value="all">{t("buckets.all")}</TabsTrigger>
          {BUCKET_KEYS.map((bucket) => (
            <TabsTrigger key={bucket} value={bucket}>
              {t(`buckets.${bucket}`)}
              {bucketCounts[bucket] > 0 && (
                <span className="bg-muted text-muted-foreground ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-xs font-medium">
                  {bucketCounts[bucket]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Each tab renders the data table — bucket-specific filtering is
            handled by the data table's own status select for now */}
        <TabsContent value="all">
          <ContractsDataTable workspaceId={workspaceId} actorProfileId={actorProfileId} />
        </TabsContent>
        {BUCKET_KEYS.map((bucket) => (
          <TabsContent key={bucket} value={bucket}>
            <ContractsDataTable workspaceId={workspaceId} actorProfileId={actorProfileId} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
