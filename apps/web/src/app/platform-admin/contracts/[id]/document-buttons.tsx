"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Props = {
  contractId: string;
  hasAuditLog: boolean;
  hasDocuments: boolean;
  docusealSubmissionId: string | null;
};

export function DocumentButtons({
  contractId,
  hasAuditLog,
  hasDocuments,
  docusealSubmissionId,
}: Props) {
  const router = useRouter();
  const [fetching, setFetching] = useState(false);

  // Only show fetch button if there's a DocuSeal submission but missing audit log or documents
  if (!docusealSubmissionId || (hasAuditLog && hasDocuments)) return null;

  async function handleFetchDocuments() {
    setFetching(true);
    try {
      const res = await fetch(`/api/platform-admin/contracts/${contractId}/fetch-documents`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kunne ikke hente dokumenter");
      toast.success("Dokumenter hentet fra DocuSeal");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noe gikk galt");
    } finally {
      setFetching(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleFetchDocuments} disabled={fetching}>
      <RefreshCw className={`mr-2 h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
      {fetching ? "Henter..." : "Hent dokumenter fra DocuSeal"}
    </Button>
  );
}
