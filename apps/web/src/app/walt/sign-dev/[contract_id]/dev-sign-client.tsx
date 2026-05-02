"use client";

/**
 * DevSignClient — Development-only contract signing stub.
 *
 * What: Renders a "Signer kontrakten" button that calls the dev-only
 *       POST /api/contracts/[id]/sign-dev endpoint to mark an employment
 *       contract as signed without DocuSeal.
 *
 * Why: Enables E2E tests to exercise the full sign flow (Walt → sign →
 *      DB updated) without a running contract-service or DocuSeal instance.
 *      Rendered only when CONTRACT_SERVICE_URL is not configured (dev mode).
 *
 * Security: This route and component must NEVER be reachable in production.
 *   The /walt/sign-dev/[contract_id]/page.tsx server component gates on
 *   isContractServiceConfigured() and returns 404 in production.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, CheckCircle2, Loader2 } from "lucide-react";

interface DevSignClientProps {
  contractId: string;
  positionTitle: string | null;
}

type SignState = "idle" | "loading" | "signed" | "error";

export function DevSignClient({ contractId, positionTitle }: DevSignClientProps) {
  const router = useRouter();
  const [signState, setSignState] = useState<SignState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSign = async () => {
    setSignState("loading");
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sign-dev`, {
        method: "POST",
      });
      if (res.status === 409) {
        setSignState("error");
        setErrorMessage("Kontrakten er allerede signert.");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSignState("error");
        setErrorMessage(body.error ?? "Noe gikk galt ved signering.");
        return;
      }
      setSignState("signed");
      // Redirect to /walt?signed=<id> after a brief pause so the signed panel renders
      setTimeout(() => {
        router.push(`/walt?signed=${contractId}`);
      }, 1500);
    } catch {
      setSignState("error");
      setErrorMessage("Nettverksfeil — prøv igjen.");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {/* Dev environment badge */}
      <div className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
        DEV — Signeringsstub
      </div>

      {signState !== "signed" ? (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="font-heading text-foreground text-2xl font-bold">Signer kontrakt</h1>
            {positionTitle && <p className="text-muted-foreground mt-1 text-sm">{positionTitle}</p>}
          </div>

          <div className="border-border bg-card rounded-xl border p-6">
            <div className="mb-4 flex items-center gap-3">
              <FileText className="text-muted-foreground h-8 w-8" />
              <p className="text-foreground text-sm font-medium">
                Klikk nedenfor for å simulere at ansatt signerer kontrakten (dev-modus).
              </p>
            </div>
            <p className="text-muted-foreground text-xs">
              Dette kaller POST /api/contracts/{contractId}/sign-dev som markerer kontrakten som
              signert i databasen uten DocuSeal.
            </p>
          </div>

          {signState === "error" && errorMessage && (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{errorMessage}</p>
          )}

          <button
            type="button"
            data-testid="dev-sign-btn"
            onClick={handleSign}
            disabled={signState === "loading"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signState === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signerer…
              </>
            ) : (
              "Signer kontrakten"
            )}
          </button>
        </div>
      ) : (
        <div
          data-testid="dev-sign-success"
          className="flex flex-col items-center gap-4 py-8 text-center"
        >
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <h2 className="font-heading text-foreground text-xl font-bold">Signert!</h2>
          <p className="text-muted-foreground text-sm">
            Kontrakten er signert. Du kan nå se kontrakten din i dashbordet.
          </p>
        </div>
      )}
    </div>
  );
}
