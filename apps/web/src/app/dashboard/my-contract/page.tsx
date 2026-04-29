"use client";

/**
 * /dashboard/my-contract — Employee contract view.
 *
 * Shows the employee's active (signed) contract as a hero card and
 * previous contracts in a muted history list. Data is fetched client-side
 * from employment_contract using the profile_id + workspace_id from
 * DashboardContext.
 *
 * Wave 4 additions:
 *   - Stilling, lønn, lønningsdag, ansiennitet-start (from payroll profile)
 *   - ObligationsList with per-obligation status badge + bulk progress header
 *   - TariffBadge (ADR-0181 drift indicator)
 *   - RevealableField for personal_number + bank_account (ADR-0234 Høy-PII)
 *   - Last-ned-PDF-knapp
 *   - Obligation click → /dashboard/competence/protocol/[id]
 */

import { useContext, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  Check,
  Clock,
  Download,
  FileText,
  MessageCircle,
  TrendingUp,
  X,
} from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { useTranslation } from "@smartout/i18n";
import type { Database } from "@smartout/supabase/database.types";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { RevealableField } from "@/components/RevealableField";
import { ObligationsList } from "@/components/contract/ObligationsList";
import { TariffBadge, deriveTariffSyncState } from "@/components/contract/TariffBadge";
import { ContractAmendmentDiff, type DiffField } from "@/components/contract/ContractAmendmentDiff";

type Contract = Database["public"]["Tables"]["employment_contract"]["Row"];
type PayrollProfile = Database["public"]["Tables"]["employee_payroll_profile"]["Row"];

// Local type for contract_obligation — pre-migration placeholder
type ContractObligation = {
  id: string;
  contract_id: string;
  obligation_type:
    | "training_required"
    | "certification_required"
    | "activity_required"
    | "attendance_required";
  policy_id: string | null;
  protocol_id: string | null;
  due_within_days: number | null;
  is_blocker: boolean;
  reference_text: string;
  status: "pending" | "in_progress" | "completed" | "overdue" | "waived";
  started_at: string | null;
  completed_at: string | null;
  waived_at: string | null;
  waived_reason: string | null;
};

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
  const [payrollProfile, setPayrollProfile] = useState<PayrollProfile | null>(null);
  const [obligations, setObligations] = useState<ContractObligation[]>([]);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [personalNumber, setPersonalNumber] = useState<string>("");
  const [bankAccount, setBankAccount] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // WS2G: amendment banner state.
  const [pendingAmendment, setPendingAmendment] = useState<{
    amendment_id: string;
    contract_id: string;
    change_summary: Record<string, { from: unknown; to: unknown; classification: string }>;
    requires_employee_signature: boolean;
    is_constructive_dismissal_risk: boolean;
    reason: string | null;
  } | null>(null);
  const [amendmentAction, setAmendmentAction] = useState<"idle" | "submitting" | "done">("idle");
  const [declineReason, setDeclineReason] = useState("");

  const workspaceId = workspaceData?.workspace_id;
  // workspaceData doesn't carry slug — use workspaceId as fallback for protocol deep-links.
  // Phase 0b will resolve the actual slug from the workspace row if needed.
  const workspaceSlug = workspaceId ?? "";

  useEffect(() => {
    if (!workspaceId || !profileId) return;

    const supabase = createClient();

    // Parallel fetch: contracts + payroll profile + PII fields + obligations
    Promise.all([
      supabase
        .from("employment_contract")
        .select("*")
        .eq("profile_id", profileId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("employee_payroll_profile")
        .select("*")
        .eq("profile_id", profileId)
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase
        .from("profile")
        .select("personal_number, bank_account")
        .eq("profile_id", profileId)
        .single(),
    ]).then(([contractsRes, payrollRes, profileRes]) => {
      if (!contractsRes.error && contractsRes.data) {
        setContracts(contractsRes.data);

        // Load signing URL for contracts awaiting signature
        const pending = contractsRes.data.find((c) => ["sent", "viewed"].includes(c.status));
        if (pending?.signing_contract_id) {
          supabase
            .from("contract")
            .select("signing_url")
            .eq("contract_id", pending.signing_contract_id)
            .single()
            .then(({ data: sc }) => {
              if (sc?.signing_url) setSigningUrl(sc.signing_url);
            });
        }

        // WS2G: Load pending amendment for active contract.
        const signedContract = contractsRes.data.find(
          (c) => c.status === "signed" || c.status === "active",
        );
        if (signedContract) {
          void Promise.resolve(
            supabase
              .from("contract_amendment" as never)
              .select(
                "id, parent_contract_id, change_summary, requires_employee_signature, is_constructive_dismissal_risk, reason, status",
              )
              .eq("parent_contract_id", signedContract.contract_id)
              .eq("status", "proposed")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          )
            .then((res: { data: unknown }) => {
              if (res.data) {
                const row = res.data as {
                  id: string;
                  parent_contract_id: string;
                  change_summary: Record<
                    string,
                    { from: unknown; to: unknown; classification: string }
                  >;
                  requires_employee_signature: boolean;
                  is_constructive_dismissal_risk: boolean;
                  reason: string | null;
                };
                setPendingAmendment({
                  amendment_id: row.id,
                  contract_id: row.parent_contract_id,
                  change_summary: row.change_summary ?? {},
                  requires_employee_signature: row.requires_employee_signature,
                  is_constructive_dismissal_risk: row.is_constructive_dismissal_risk,
                  reason: row.reason,
                });
              }
            })
            .catch(() => {
              /* table may not exist yet */
            });
        }

        // Load obligations for active contract (best-effort — table may not exist yet)
        const active = contractsRes.data.find((c) => ["signed", "active"].includes(c.status));
        if (active) {
          void Promise.resolve(
            supabase
              .from("contract_obligation" as never)
              .select("*")
              .eq("contract_id", active.contract_id),
          )
            .then((res: { data: unknown }) => {
              if (res.data) setObligations(res.data as ContractObligation[]);
            })
            .catch(() => {
              // Table doesn't exist yet (pre-migration) — silently skip
            });
        }
      }

      if (payrollRes.data) setPayrollProfile(payrollRes.data);
      if (profileRes.data) {
        setPersonalNumber(profileRes.data.personal_number ?? "");
        setBankAccount(profileRes.data.bank_account ?? "");
      }

      setLoading(false);
    });
  }, [workspaceId, profileId]);

  // WS2G: Accept / decline amendment handlers.
  async function handleAmendmentAccept() {
    if (!pendingAmendment) return;
    setAmendmentAction("submitting");
    try {
      const res = await fetch(
        `/api/contracts/${pendingAmendment.contract_id}/amend/${pendingAmendment.amendment_id}/accept`,
        { method: "POST" },
      );
      if (res.ok) {
        setPendingAmendment(null);
        setAmendmentAction("done");
      } else {
        setAmendmentAction("idle");
      }
    } catch {
      setAmendmentAction("idle");
    }
  }

  async function handleAmendmentDecline() {
    if (!pendingAmendment) return;
    setAmendmentAction("submitting");
    try {
      const res = await fetch(
        `/api/contracts/${pendingAmendment.contract_id}/amend/${pendingAmendment.amendment_id}/decline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: declineReason }),
        },
      );
      if (res.ok) {
        setPendingAmendment(null);
        setAmendmentAction("done");
      } else {
        setAmendmentAction("idle");
      }
    } catch {
      setAmendmentAction("idle");
    }
  }

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

      {/* WS2G: Pending amendment banner — shown when admin has proposed changes */}
      {pendingAmendment && amendmentAction !== "done" && (
        <div className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Kontraktsendring krever din godkjenning
              </p>
              {pendingAmendment.reason && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Begrunnelse: {pendingAmendment.reason}
                </p>
              )}
              {pendingAmendment.requires_employee_signature && (
                <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                  Materiell endring — krever ny signering.
                </p>
              )}
            </div>
          </div>

          {/* Side-by-side diff */}
          {Object.keys(pendingAmendment.change_summary).length > 0 && (
            <ContractAmendmentDiff
              fields={
                Object.entries(pendingAmendment.change_summary).map(([col, val]) => ({
                  label: col,
                  previous: val.from as string | number | null,
                  proposed: val.to as string | number | null,
                })) satisfies DiffField[]
              }
              layout="side-by-side"
            />
          )}

          {/* Accept / Decline actions */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleAmendmentAccept}
              disabled={amendmentAction === "submitting"}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Godkjenn endring
            </button>
            <button
              type="button"
              onClick={handleAmendmentDecline}
              disabled={amendmentAction === "submitting"}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-400"
            >
              <X className="h-4 w-4" />
              Avvis endring
            </button>
          </div>
        </div>
      )}

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
              <button
                type="button"
                onClick={() => {
                  // Open Botsson chat with contract_intake mission
                  window.dispatchEvent(
                    new CustomEvent("botsson:open", {
                      detail: {
                        view: "admin-chat",
                        primeContext: {
                          kind: "contract_intake",
                          chatEndpoint: "/api/emma/chat",
                          mission: "contract_intake",
                          missionContext: {
                            employment_contract_id: activeContract.contract_id,
                            contract_id: activeContract.signing_contract_id,
                          },
                        },
                      },
                    }),
                  );
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <MessageCircle className="h-4 w-4" />
                {t("my_contract.talk_to_emma")}
              </button>
            </div>
          )}

          {/* Core fields grid */}
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

          {/* Wave 4: Payroll detail row */}
          {payrollProfile && (
            <div className="border-border mt-4 border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                {payrollProfile.payday_regular !== null && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-muted-foreground h-4 w-4" />
                    <div>
                      <p className="text-muted-foreground text-xs">Lønningsdag</p>
                      <p className="text-foreground text-sm font-medium">
                        {payrollProfile.payday_regular}. i måneden
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="text-muted-foreground h-4 w-4" />
                  <div>
                    <p className="text-muted-foreground text-xs">Ansiennitetsdato</p>
                    <p className="text-foreground text-sm font-medium">
                      {formatDate(payrollProfile.seniority_start_date)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Wave 4: Tariff badge (ADR-0181 drift indicator) */}
          {payrollProfile?.tariff_category && (
            <div className="mt-3 flex items-center gap-2">
              <TariffBadge
                state={deriveTariffSyncState(payrollProfile.payroll_last_synced_at ?? null)}
                lastSyncedAt={payrollProfile.payroll_last_synced_at ?? null}
                tariffName={payrollProfile.tariff_category}
              />
            </div>
          )}

          {/* Wave 4: PII fields — RevealableField (ADR-0234) */}
          {(personalNumber || bankAccount) && workspaceId && profileId && (
            <div className="border-border mt-4 space-y-3 border-t pt-4">
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Personlig informasjon
              </p>
              {personalNumber && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Personnummer</p>
                  <RevealableField
                    label="Personnummer"
                    value={personalNumber}
                    fieldName="personal_number"
                    profileId={profileId}
                    workspaceId={workspaceId}
                    isSelf={true}
                    actorProfileId={profileId}
                  />
                </div>
              )}
              {bankAccount && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Bankkonto</p>
                  <RevealableField
                    label="Bankkonto"
                    value={bankAccount}
                    fieldName="bank_account"
                    profileId={profileId}
                    workspaceId={workspaceId}
                    isSelf={true}
                    actorProfileId={profileId}
                  />
                </div>
              )}
            </div>
          )}

          {/* Wave 4: Obligations list */}
          {obligations.length > 0 && (
            <div className="border-border mt-4 border-t pt-4">
              <ObligationsList obligations={obligations} workspaceSlug={workspaceSlug} />
            </div>
          )}

          {/* Wave 4: PDF download */}
          {activeContract.document_url && (
            <div className="mt-4">
              <a
                href={activeContract.document_url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="border-border text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
              >
                <Download className="h-4 w-4" />
                Last ned kontrakt (PDF)
              </a>
            </div>
          )}
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
