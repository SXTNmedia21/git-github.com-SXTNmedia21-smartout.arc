"use client";

/**
 * /dashboard/contracts/[id] — Contract detail view.
 *
 * Shows employee name, position, status, terms, decline info,
 * compliance overrides, and parent lineage. Provides edit (draft)
 * and regenerate (signed, disabled) actions.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileEdit, RefreshCw, AlertCircle, Link2, UserPlus } from "lucide-react";
import { Button } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { ComplianceBadge } from "../_components/ComplianceBadge";
import type { ComplianceLevel } from "@smartout/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ComplianceOverride = {
  rule_id: string;
  level: ComplianceLevel;
  message: string;
};

type ContractDetail = {
  contract_id: string;
  profile_id: string | null;
  status: string;
  position_title: string;
  hourly_rate: number | null;
  monthly_salary: number | null;
  employment_percentage: number | null;
  start_date: string;
  framework_snapshot: Record<string, unknown> | null;
  compliance_overrides: ComplianceOverride[] | null;
  parent_contract_id: string | null;
  decline_reason_code: string | null;
  decline_reason_text: string | null;
  profile: { display_name: string } | null;
};

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  sent: "bg-blue-50 text-blue-700",
  viewed: "bg-blue-50 text-blue-700",
  signed: "bg-green-50 text-green-700",
  expired: "bg-amber-50 text-amber-700",
  pending_data: "bg-amber-50 text-amber-700",
  declined: "bg-red-50 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-500",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContractDetailPage() {
  const { t } = useTranslation("contracts");
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContract() {
      try {
        const res = await fetch(`/api/employment-contracts/${id}`);
        if (res.ok) {
          const data = (await res.json()) as ContractDetail;
          setContract(data);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchContract();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-sm">{t("detail_page.loading")}</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground text-sm">{t("detail_page.not_found")}</p>
        <Link href="/dashboard/contracts" className="text-primary mt-2 text-sm underline">
          {t("detail_page.back_to_contracts")}
        </Link>
      </div>
    );
  }

  const isDraft = contract.status === "draft";
  const isSigned = contract.status === "signed";
  const isDeclined = contract.status === "declined";
  const isPendingData = contract.status === "pending_data";
  const overrides = contract.compliance_overrides ?? [];
  const employeeName = contract.profile?.display_name ?? t("detail_page.unknown_employee");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/contracts"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("detail_page.all_contracts")}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">{employeeName}</h1>
          <p className="text-muted-foreground text-sm">{contract.position_title}</p>
          <div className="mt-2">
            <StatusBadge status={contract.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/dashboard/contracts/${contract.contract_id}/revise`}>
                <FileEdit className="h-3.5 w-3.5" />
                {t("detail_page.edit")}
              </Link>
            </Button>
          )}
          {isPendingData && contract.profile_id && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/dashboard/people/${contract.profile_id}/complete-data`}>
                <UserPlus className="h-3.5 w-3.5" />
                {t("detail_page.complete_data")}
              </Link>
            </Button>
          )}
          {isSigned && (
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <RefreshCw className="h-3.5 w-3.5" />
              {t("detail_page.regenerate")}
            </Button>
          )}
        </div>
      </div>

      {/* Decline info */}
      {isDeclined && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t("detail_page.declined_title")}</p>
            {contract.decline_reason_code && (
              <p className="mt-1 text-xs">
                {t("detail_page.decline_reason", { code: contract.decline_reason_code })}
              </p>
            )}
            {contract.decline_reason_text && <p className="mt-1">{contract.decline_reason_text}</p>}
          </div>
        </div>
      )}

      {/* Pending data info */}
      {isPendingData && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{t("detail_page.pending_data_title")}</p>
            <p className="mt-1">{t("detail_page.pending_data_description")}</p>
          </div>
        </div>
      )}

      {/* Terms */}
      <section className="rounded-lg border p-4">
        <h2 className="text-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
          {t("detail_page.terms")}
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("detail_page.hourly_rate")}</dt>
            <dd className="text-foreground font-medium">
              {contract.hourly_rate != null
                ? `${contract.hourly_rate} kr/t`
                : t("detail_page.not_set")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("detail_page.monthly_salary")}</dt>
            <dd className="text-foreground font-medium">
              {contract.monthly_salary != null
                ? `${contract.monthly_salary} kr`
                : t("detail_page.not_set")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("detail_page.employment_percentage")}</dt>
            <dd className="text-foreground font-medium">
              {contract.employment_percentage != null
                ? `${contract.employment_percentage}%`
                : t("detail_page.not_set")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("detail_page.start_date")}</dt>
            <dd className="text-foreground font-medium">{contract.start_date}</dd>
          </div>
        </dl>
      </section>

      {/* Compliance overrides */}
      {overrides.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            {t("detail_page.compliance_overrides")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {overrides.map((o) => (
              <ComplianceBadge key={o.rule_id} level={o.level} message={o.message} />
            ))}
          </div>
        </section>
      )}

      {/* Parent lineage */}
      {contract.parent_contract_id && (
        <div className="flex items-center gap-2 text-sm">
          <Link2 className="text-muted-foreground h-4 w-4" />
          <span className="text-muted-foreground">{t("detail_page.parent_contract")}</span>
          <Link
            href={`/dashboard/contracts/${contract.parent_contract_id}`}
            className="text-primary underline"
          >
            {contract.parent_contract_id}
          </Link>
        </div>
      )}
    </div>
  );
}
