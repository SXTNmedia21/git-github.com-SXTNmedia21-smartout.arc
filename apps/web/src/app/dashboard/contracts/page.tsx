"use client";

/**
 * ContractsPage — /dashboard/contracts
 *
 * Reads workspace context from DashboardShell and renders the contracts DataTable
 * with bucket-based filter tabs (waiting_employee, ready_for_action, completed).
 *
 * Two entry points for creating contracts:
 * - "Ny kontrakt" link navigates to the composition wizard at /dashboard/contracts/new
 * - "Lag kontrakt med Botsson" delegates to Botsson via a global window event
 */

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractsDataTable } from "./_components/contracts-data-table";
import { groupByBucket, type ContractStatus, type DashboardBucket } from "./filters";

// Minimal shape returned by the contracts API — only status is needed for bucketing
type ContractRow = { status: ContractStatus };

const BUCKET_KEYS: DashboardBucket[] = ["ready_for_action", "waiting_employee", "completed"];

const EMPTY_COUNTS: Record<DashboardBucket, number> = {
  waiting_employee: 0,
  ready_for_action: 0,
  completed: 0,
};

export default function ContractsPage() {
  const { t } = useTranslation("contracts");
  const { workspaceData } = useContext(DashboardContext);
  const [allContracts, setAllContracts] = useState<ContractRow[]>([]);

  const workspaceId = workspaceData?.workspace_id;

  // Fetch a lightweight contract list to compute bucket counts. The data table
  // handles its own paginated fetching — this is only for the tab badges.
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

  if (!workspaceId) return null;

  function openBotssonForContract() {
    window.dispatchEvent(
      new CustomEvent("botsson:open", {
        detail: {
          view: "admin-chat",
          primeContext: {
            kind: "create_contract",
          },
        },
      }),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("page.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/dashboard/contracts/new">
              <FileText className="h-4 w-4" />
              {t("page.new_contract")}
            </Link>
          </Button>
          <Button onClick={openBotssonForContract} className="gap-2">
            <Sparkles className="h-4 w-4" />
            {t("page.create_with_botsson")}
          </Button>
        </div>
      </div>

      {/* Bucket filter tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">{t("buckets.all")}</TabsTrigger>
          {BUCKET_KEYS.map((bucket) => (
            <TabsTrigger key={bucket} value={bucket}>
              {t(`buckets.${bucket}`)}
              {bucketCounts[bucket] > 0 && (
                <span className="bg-muted text-muted-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium">
                  {bucketCounts[bucket]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Each tab renders the data table — bucket-specific filtering is
            handled by the data table's own status select for now */}
        <TabsContent value="all">
          <ContractsDataTable workspaceId={workspaceId} />
        </TabsContent>
        {BUCKET_KEYS.map((bucket) => (
          <TabsContent key={bucket} value={bucket}>
            <ContractsDataTable workspaceId={workspaceId} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
