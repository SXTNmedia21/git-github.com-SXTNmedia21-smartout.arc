"use client";

/**
 * WaltShell — Employee contract signing room.
 *
 * What: Receives pending employment_contract data from the /walt page and
 *       renders the appropriate state panel for the employee:
 *         - pending: contract card + "Les og signer kontrakten" CTA
 *         - no_pending: empty state with dashboard link
 *         - just_signed: thank-you panel after signing (?signed param)
 *         - no_profile: user exists but has no profile in any workspace
 *
 * Why: Employees in shift-based businesses need a simple, frictionless
 *      contract landing surface — not a full dashboard.
 *
 * Dev-path: When CONTRACT_SERVICE_URL is not configured, signing_url points
 *   to /walt/sign-dev/<employment_contract_id> instead of DocuSeal.
 *   This allows E2E tests to exercise the full sign flow without DocuSeal.
 */

import { useRouter } from "next/navigation";
import { FileText, CheckCircle2 } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WaltState = "pending" | "no_pending" | "just_signed" | "no_profile";

export interface WaltContractData {
  contract_id: string;
  position_title: string | null;
  start_date: string;
  employment_category: string | null;
  employment_percentage: number | null;
  hourly_rate: number | null;
  monthly_salary: number | null;
  signing_url: string | null;
}

interface WaltShellProps {
  state: WaltState;
  firstName: string;
  contract: WaltContractData | null;
  signedContractId?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─── Panels ──────────────────────────────────────────────────────────────────

function NoPendingPanel() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <CheckCircle2 className="text-muted-foreground h-12 w-12" />
      <h1 className="font-heading text-foreground text-2xl font-bold">Ingenting venter</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Du har ingen kontrakter til signering akkurat nå.
      </p>
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="mt-2 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
      >
        Gå til dashbordet
      </button>
    </div>
  );
}

function NoProfilePanel() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <FileText className="text-muted-foreground h-12 w-12" />
      <h1 className="font-heading text-foreground text-2xl font-bold">Vi finner ikke deg</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Kontoen din er ikke koblet til et arbeidssted ennå. Kontakt arbeidsgiveren din.
      </p>
    </div>
  );
}

function JustSignedPanel({
  firstName,
  signedContractId,
}: {
  firstName: string;
  signedContractId?: string | null;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      <h1 className="font-heading text-foreground text-2xl font-bold">Takk, {firstName}</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Kontrakten din er signert. Du kan nå se kontrakten din i dashbordet.
      </p>
      <button
        type="button"
        onClick={() => router.push("/dashboard/my-contract")}
        className="mt-2 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
      >
        Se min kontrakt
      </button>
    </div>
  );
}

function PendingPanel({ contract, firstName }: { contract: WaltContractData; firstName: string }) {
  const router = useRouter();

  const handleSign = () => {
    if (contract.signing_url) {
      router.push(contract.signing_url);
    }
  };

  const compensation = contract.hourly_rate
    ? `${contract.hourly_rate} kr / time`
    : contract.monthly_salary
      ? `${contract.monthly_salary} kr / mnd`
      : null;

  return (
    <section data-testid="walt-pending-panel" className="flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <h1 className="font-heading text-foreground text-2xl font-bold">Hei {firstName}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Du har en kontrakt som venter på signering.
        </p>
      </div>

      {/* Contract detail card */}
      <div
        data-testid="walt-contract-card"
        className="border-border bg-card rounded-xl border p-6 shadow-sm"
      >
        <div className="mb-4 flex items-start gap-4">
          <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <FileText className="text-primary h-5 w-5" />
          </div>
          <div>
            <h2
              data-testid="walt-position-title"
              className="font-heading text-foreground text-lg font-semibold"
            >
              {contract.position_title ?? "Stilling"}
            </h2>
            {contract.employment_category && (
              <p className="text-muted-foreground text-xs">{contract.employment_category}</p>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4">
          {compensation && (
            <div>
              <dt className="text-muted-foreground text-xs">Lønn</dt>
              <dd className="text-foreground text-sm font-medium">{compensation}</dd>
            </div>
          )}
          {contract.employment_percentage !== null && (
            <div>
              <dt className="text-muted-foreground text-xs">Stillingsprosent</dt>
              <dd className="text-foreground text-sm font-medium">
                {contract.employment_percentage}%
              </dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-muted-foreground text-xs">Startdato</dt>
            <dd className="text-foreground text-sm font-medium">
              {formatDate(contract.start_date)}
            </dd>
          </div>
        </dl>
      </div>

      {/* CTA */}
      {contract.signing_url ? (
        <button
          type="button"
          data-testid="walt-sign-btn"
          onClick={handleSign}
          className="w-full rounded-xl bg-orange-500 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-orange-600"
        >
          Les og signer kontrakten
        </button>
      ) : (
        <p className="text-muted-foreground text-center text-sm">
          Signeringslenken er ikke tilgjengelig ennå. Kontakt arbeidsgiveren din.
        </p>
      )}
    </section>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function WaltShell({ state, firstName, contract, signedContractId }: WaltShellProps) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      {state === "pending" && contract && (
        <PendingPanel contract={contract} firstName={firstName} />
      )}
      {state === "no_pending" && <NoPendingPanel />}
      {state === "just_signed" && (
        <JustSignedPanel firstName={firstName} signedContractId={signedContractId} />
      )}
      {state === "no_profile" && <NoProfilePanel />}
    </div>
  );
}
