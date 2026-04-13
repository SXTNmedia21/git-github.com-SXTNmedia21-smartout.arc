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

/** Human-readable status label */
function statusLabel(status: Contract["status"]): string {
  const map: Record<Contract["status"], string> = {
    draft: "Utkast",
    sent: "Sendt",
    viewed: "Sett",
    signed: "Signert",
    expired: "Utloept",
    terminated: "Oppsagt",
    pending_data: "Venter paa data",
    declined: "Avslatt",
  };
  return map[status] ?? status;
}

/** Compensation display — hourly rate or monthly salary */
function compensationText(contract: Contract): string {
  if (contract.hourly_rate) return `${contract.hourly_rate} kr/t`;
  if (contract.monthly_salary) return `${contract.monthly_salary} kr/mnd`;
  return "Ikke satt";
}

export default function MyContractPage() {
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
        <h2 className="text-foreground text-lg font-semibold">Ingen kontrakter</h2>
        <p className="text-muted-foreground text-sm">
          Du har ingen kontrakter knyttet til denne arbeidsplassen ennaa.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-foreground text-xl font-bold tracking-tight">Min kontrakt</h1>

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
                {statusLabel(activeContract.status)}
              </span>
            </div>
          </div>

          {/* Action banners for pending statuses */}
          {["sent", "viewed"].includes(activeContract.status) && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Denne kontrakten venter paa din signatur.
              </p>
              {signingUrl && (
                <a
                  href={`/sign/${signingUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  Signer kontrakt
                </a>
              )}
            </div>
          )}

          {activeContract.status === "pending_data" && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Vi trenger noe informasjon fra deg foer kontrakten kan sendes.
              </p>
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                Du vil bli kontaktet med instruksjoner.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Briefcase className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">Kompensasjon</p>
                <p className="text-foreground text-sm font-medium">
                  {compensationText(activeContract)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">Stillingsandel</p>
                <p className="text-foreground text-sm font-medium">
                  {activeContract.employment_percentage
                    ? `${activeContract.employment_percentage}%`
                    : "Ikke satt"}
                </p>
              </div>
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <Calendar className="text-muted-foreground h-4 w-4" />
              <div>
                <p className="text-muted-foreground text-xs">Startdato</p>
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
          <h3 className="text-muted-foreground text-sm font-medium">Historikk</h3>
          {history.map((contract) => (
            <div
              key={contract.contract_id}
              className="flex items-center justify-between rounded-lg border p-4 opacity-60"
            >
              <div>
                <p className="text-foreground text-sm font-medium">{contract.position_title}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDate(contract.start_date)} — {statusLabel(contract.status)}
                </p>
              </div>
              <p className="text-muted-foreground text-sm">{compensationText(contract)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
