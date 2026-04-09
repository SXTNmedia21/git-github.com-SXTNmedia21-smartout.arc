"use client";

/**
 * /dashboard/contracts/[id]/revise — Revise an existing contract.
 *
 * Stub page: shows the contract ID and renders CompositionWizard.
 * Pre-filling from the existing contract will be wired in a later task.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CompositionWizard } from "../../_components/CompositionWizard";

export default function ReviseContractPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-4">
      <Link
        href={`/dashboard/contracts/${id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Tilbake til kontrakt
      </Link>
      <p className="text-muted-foreground text-xs">Reviderer kontrakt: {id}</p>
      <CompositionWizard />
    </div>
  );
}
