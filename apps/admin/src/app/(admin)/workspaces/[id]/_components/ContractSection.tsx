// ContractSection.tsx — employment contracts for this workspace
//
// Shows a list of employment_contract rows associated with the workspace.
// contracts === null means RLS denied (orders_only scope) — renders a
// gray "Ikke tilgang" placeholder and emits kartotek section_failed.
//
// The list is collapsed by default: summary row count + a "Vis" toggle
// is intentionally deferred to client-side interaction. Phase 1 renders
// all rows (≤30 typical) with full disclosure; collapse UI can be added
// in M7+ when we have real usage data.
//
// Server Component. No "use client".

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { emit, nonEmpty } from "@/lib/telemetry";
import type { KartotekContractRow } from "@smartout/billing/server";

type Props = {
  contracts: KartotekContractRow[] | null;
  hasPartialAccess: boolean;
  workspaceId: string;
  userId: string;
};

function contractStatusDisplay(status: string): { label: string; className: string } {
  switch (status) {
    case "active":
    case "signed":
      return { label: "Aktiv", className: "bg-primary/15 text-primary border-primary/30" };
    case "draft":
      return { label: "Utkast", className: "bg-muted text-muted-foreground border-border" };
    case "expired":
    case "terminated":
      return {
        label: status === "expired" ? "Utløpt" : "Avsluttet",
        className: "bg-destructive/15 text-destructive border-destructive/30",
      };
    case "pending":
      return {
        label: "Venter",
        className: "bg-muted text-muted-foreground border-border",
      };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

export async function ContractSection({ contracts, hasPartialAccess, workspaceId, userId }: Props) {
  // RLS denied — emit section_failed and render placeholder.
  if (contracts === null && hasPartialAccess) {
    await emit({
      event: "kartotek section_failed",
      actor_id: nonEmpty(userId, "actor_id"),
      workspace_id: null,
      properties: {
        entity: { entity_type: "workspace", entity_id: workspaceId },
        data: { workspace_id: workspaceId, section: "contracts", reason: "rls_denied" },
      },
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kontrakter</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Ikke tilgang — denne seksjonen krever full kartotek-tilgang
          </p>
        </CardContent>
      </Card>
    );
  }

  const list = contracts ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Kontrakter{" "}
          {list.length > 0 && (
            <span className="text-muted-foreground text-xs font-normal">({list.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ingen ansettelseskontrakter registrert</p>
        ) : (
          <div className="space-y-2">
            {list.map((contract) => {
              const { label, className } = contractStatusDisplay(contract.status);
              return (
                <div
                  key={contract.contract_id}
                  className="border-border flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground font-mono text-xs">
                    {contract.contract_id.slice(0, 8)}
                  </span>
                  <Badge variant="outline" className={className}>
                    {label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
