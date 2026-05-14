"use client";

/**
 * /dashboard/contracts/[id]/revise — Revise an existing contract.
 *
 * Stub page: shows the contract ID and renders CompositionWizard.
 * Pre-filling from the existing contract will be wired in a later task.
 */

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { CompositionWizard } from "../../_components/CompositionWizard";
import { ContractReviseToolsBridge } from "./_tools/contract-revise-tools-bridge";

export default function ReviseContractPage() {
  const { t } = useTranslation("contracts");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <>
      <ContractReviseToolsBridge contractId={id ?? ""} navigateTo={(href) => router.push(href)} />
      <div className="space-y-4">
        <Link
          href={`/dashboard/contracts/${id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("revise.back_to_contract")}
        </Link>
        <p className="text-muted-foreground text-xs">{t("revise.revising", { id })}</p>
        <CompositionWizard />
      </div>
    </>
  );
}
