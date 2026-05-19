/**
 * /dashboard/people/contracts/awaiting-my-signature
 *
 * Server Component. Lists employee contracts where the current admin (employer)
 * has not yet signed. Identified by matching sender_email to the authenticated
 * user's email and checking signed_by_employer_at IS NULL.
 *
 * Signing flow: "Signer nå" → /sign/<signing_url> (DocuSeal embed).
 */

import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { createClient } from "@smartout/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { AwaitingSignatureToolsBridge } from "./_tools/awaiting-signature-tools-bridge";
import type { AwaitingSignatureRow } from "./_tools/use-awaiting-signature-tools";

// Shape returned from the joined query
interface AwaitingContract {
  contract_id: string;
  title: string | null;
  sent_at: string | null;
  signing_url: string | null;
  sender_email: string | null;
  recipient_name: string | null;
  employment_contract: {
    position_title: string | null;
    profile: { display_name: string | null } | null;
    signed_by_employer_at: string | null;
    signed_by_employee_at: string | null;
    status: string | null;
  } | null;
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function EmployeeSignedBadge({ signedAt }: { signedAt: string | null }) {
  if (!signedAt) {
    return (
      <Badge variant="outline" className="text-muted-foreground text-xs">
        Ansatt ikke signert
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-success/40 text-success-foreground text-xs">
      Ansatt signerte {formatDate(signedAt)}
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <Inbox className="text-muted-foreground h-10 w-10" />
      <p className="text-foreground font-medium">Ingen kontrakter venter din signatur</p>
      <p className="text-muted-foreground text-sm">
        Alle ansattkontrakter du har sendt er signert eller ikke sendt ennå.
      </p>
    </div>
  );
}

export default async function AwaitingMySignaturePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/login");

  const { data: raw } = await supabase
    .from("contract")
    .select(
      `
      contract_id,
      title,
      sent_at,
      signing_url,
      sender_email,
      recipient_name,
      employment_contract!signing_contract_id (
        position_title,
        profile ( display_name ),
        signed_by_employer_at,
        signed_by_employee_at,
        status
      )
    `,
    )
    .eq("contract_type", "employee")
    .eq("sender_email", user.email)
    .neq("status", "signed")
    .neq("status", "cancelled")
    .neq("status", "declined")
    .order("sent_at", { ascending: false });

  // Filter client-side: keep only rows where employer has NOT signed yet.
  // Nested .is() on joined tables is not reliably filtered by PostgREST — safe fallback.
  const contracts: AwaitingContract[] = ((raw ?? []) as unknown as AwaitingContract[]).filter(
    (c) => c.employment_contract?.signed_by_employer_at == null,
  );

  const count = contracts.length;

  const bridgeRows: AwaitingSignatureRow[] = contracts.map((c) => ({
    contractId: c.contract_id,
    title: c.title,
    sentAt: c.sent_at,
    signingUrl: c.signing_url,
    employeeName:
      c.employment_contract?.profile?.display_name ?? c.recipient_name ?? "Ukjent ansatt",
    positionTitle: c.employment_contract?.position_title ?? null,
    employeeSignedAt: c.employment_contract?.signed_by_employee_at ?? null,
  }));

  return (
    <>
      <AwaitingSignatureToolsBridge contracts={bridgeRows} pendingCount={count} />
      <div className="flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-1">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Avtaler som venter din signatur
          </h1>
          <p className="text-muted-foreground text-sm">
            {count > 0
              ? `${count} kontrakt${count === 1 ? "" : "er"} krever din signatur som arbeidsgiver`
              : "Ingen kontrakter venter din signatur"}
          </p>
          {/* Page instructions — explains the pending-signature queue */}
          <p className="text-muted-foreground mt-2 max-w-prose text-sm">
            Disse kontraktene er sendt til ansatte og venter nå på din signatur som arbeidsgiver.
            Trykk «Signer nå» for å signere elektronisk via DocuSeal. Kontrakten er gyldig først når
            begge parter har signert.
          </p>
        </header>

        {/* List */}
        {count === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {contracts.map((contract) => {
              const ec = contract.employment_contract;
              const employeeName =
                ec?.profile?.display_name ?? contract.recipient_name ?? "Ukjent ansatt";
              const positionTitle = ec?.position_title ?? null;

              return (
                <Card
                  key={contract.contract_id}
                  className="bg-background border-border flex items-center justify-between gap-4 p-4"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-foreground truncate font-medium">
                      {contract.title ?? "Ansattkontrakt"}
                    </p>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span>{employeeName}</span>
                      {positionTitle && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>{positionTitle}</span>
                        </>
                      )}
                      {contract.sent_at && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>Sendt {formatDate(contract.sent_at)}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1">
                      <EmployeeSignedBadge signedAt={ec?.signed_by_employee_at ?? null} />
                    </div>
                  </div>

                  {contract.signing_url ? (
                    <Button asChild size="sm" className="shrink-0">
                      <Link href={`/sign/${contract.signing_url}`}>Signer nå</Link>
                    </Button>
                  ) : (
                    <Button size="sm" disabled className="shrink-0">
                      Mangler signeringslenke
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
