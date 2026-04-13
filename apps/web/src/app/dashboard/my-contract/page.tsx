"use client";

/**
 * /dashboard/my-contract — Employee contract view.
 *
 * Shows the employee's active (signed) contract as a hero card and
 * previous contracts in a muted history list. Data is fetched client-side
 * from employment_contract using the profile_id + workspace_id from
 * DashboardContext.
 */

import { useContext, useEffect, useState, useMemo } from "react";
import { FileText, Briefcase, Clock, Calendar } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { useTranslation } from "@smartout/i18n";
import type { Database } from "@smartout/supabase/database.types";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

type Contract = Database["public"]["Tables"]["employment_contract"]["Row"];

/** Format ISO date to Norwegian locale (dd.mm.yyyy) */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MyContractPage() {
  const { t } = useTranslation("contracts");
  const { workspaceData, profileId } = useContext(DashboardContext);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const workspaceId = workspaceData?.workspace_id;

  useEffect(() => {
    if (!workspaceId || !profileId) return;

    const supabase = createClient();
    supabase
      .from("employment_contract")
      .select("*")
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setContracts(data);

          // Load signing URL for contracts awaiting signature
          const active = data.find((c) => ["sent", "viewed"].includes(c.status));
          if (active?.signing_contract_id) {
            supabase
              .from("contract")
              .select("signing_url")
              .eq("contract_id", active.signing_contract_id)
              .single()
              .then(({ data: sc }) => {
                if (sc?.signing_url) setSigningUrl(sc.signing_url);
              });
          }
        }
        setLoading(false);
      });
  }, [workspaceId, profileId]);

  const ACTIVE_STATUSES = ["signed", "sent", "viewed", "pending_data"] as const;

  const activeContract = useMemo(
    () =>
      contracts.find((c) =>
        ACTIVE_STATUSES.includes(c.status as (typeof ACTIVE_STATUSES)[number]),
      ) ?? null,
    [contracts],
  );

  const history = useMemo(
    () => contracts.filter((c) => c.contract_id !== activeContract?.contract_id),
    [contracts, activeContract],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="bg-muted h-48 animate-pulse rounded-xl" />
        <div className="bg-muted h-24 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <h2 className="text-foreground text-lg font-semibold">
          {t("my_contract.no_contracts_title")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("my_contract.no_contracts_description")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-foreground text-xl font-bold tracking-tight">{t("my_contract.title")}</h1>

      {/* Active contract hero card */}
      {activeContract && (
        <div className="border-primary/20 rounded-xl border-2 p-6 shadow-sm">
          <div className="mb-4 flex items-start gap-4">
            <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <FileText className="text-primary h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-heading text-lg font-semibold">
                {activeContract.position_title}
              </h2>
              <span className="bg-primary/10 text-primary mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium">
                {t(`status.${activeContract.status}`)}
              </span>
            </div>
          </div>

          {/* Action banners for pending statuses */}
          {["sent", "viewed"].includes(activeContract.status) && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {t("my_contract.awaiting_signature")}
              </p>
              {signingUrl && (
                <a
                  href={`/sign/${signingUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  {t("my_contract.sign_contract")}
                </a>
              )}
            </div>
          )}

          {activeContract.status === "pending_data" && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {t("my_contract.pending_data_notice")}
              </p>
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                {t("my_contract.pending_data_sub")}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Briefcase className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">
                  {t("my_contract.compensation_label")}
                </p>
                <p className="text-foreground text-sm font-medium">
                  {activeContract.hourly_rate
                    ? `${activeContract.hourly_rate} ${t("my_contract.hourly_rate_suffix")}`
                    : activeContract.monthly_salary
                      ? `${activeContract.monthly_salary} ${t("my_contract.monthly_suffix")}`
                      : t("detail_page.not_set")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">
                  {t("my_contract.employment_percentage_label")}
                </p>
                <p className="text-foreground text-sm font-medium">
                  {activeContract.employment_percentage
                    ? `${activeContract.employment_percentage}%`
                    : t("detail_page.not_set")}
                </p>
              </div>
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <Calendar className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">{t("my_contract.start_date_label")}</p>
                <p className="text-foreground text-sm font-medium">
                  {formatDate(activeContract.start_date)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contract history */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-muted-foreground text-sm font-medium">
            {t("my_contract.history_label")}
          </h3>
          {history.map((contract) => (
            <div
              key={contract.contract_id}
              className="flex items-center justify-between rounded-lg border p-4 opacity-60"
            >
              <div>
                <p className="text-foreground text-sm font-medium">{contract.position_title}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDate(contract.start_date)} — {t(`status.${contract.status}`)}
                </p>
              </div>
              <p className="text-muted-foreground text-sm">
                {contract.hourly_rate
                  ? `${contract.hourly_rate} ${t("my_contract.hourly_rate_suffix")}`
                  : contract.monthly_salary
                    ? `${contract.monthly_salary} ${t("my_contract.monthly_suffix")}`
                    : t("detail_page.not_set")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
