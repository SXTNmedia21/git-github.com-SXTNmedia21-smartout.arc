"use client";

/**
 * /dashboard/people/contracts/[id]/revise — Revise an existing contract.
 *
 * Stub page: shows the contract ID and renders CompositionWizard.
 * Pre-filling from the existing contract will be wired in a later task.
 *
 * Telemetry: emits contracts.revise.opened once after workspace + actor are known.
 * workspace_id + actor_id resolved from DashboardContext per ADR-0134 R1.
 */

import { useContext, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { CompositionWizard } from "../../_components/CompositionWizard";
import { ContractReviseToolsBridge } from "./_tools/contract-revise-tools-bridge";

export default function ReviseContractPage() {
  const { t } = useTranslation("contracts");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { workspaceData, profileId } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? null;

  const openedRef = useRef(false);
  useEffect(() => {
    if (!workspaceId || !profileId || !id || openedRef.current) return;
    openedRef.current = true;
    void emit({
      event: "contracts.revise.opened",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "contract",
          entity_id: id,
        },
        data: {
          contract_id: id,
        },
      },
    });
  }, [workspaceId, profileId, id]);

  return (
    <>
      <ContractReviseToolsBridge contractId={id ?? ""} navigateTo={(href) => router.push(href)} />
      <div className="flex flex-col gap-6">
        {/* Back link */}
        <Link
          href={`/dashboard/people/contracts/${id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("revise.back_to_contract")}
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-foreground text-2xl leading-tight tracking-tight">
            {t("revise.revising", { id })}
          </h1>
          {/* Page instructions — explains the amendment flow to admin/manager */}
          <p className="text-muted-foreground mt-1 max-w-prose text-sm">
            Gjennomgå og endre vilkårene for denne kontrakten. Cascade foreslår oppdaterte verdier
            basert på gjeldende tariff og rammeverk. Endringene lagres som et nytt utkast — den
            opprinnelige kontrakten bevares i historikken.
          </p>
        </div>

        <CompositionWizard />
      </div>
    </>
  );
}
