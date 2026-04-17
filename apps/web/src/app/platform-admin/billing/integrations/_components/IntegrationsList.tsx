"use client";

import { useMemo, useState } from "react";
import type { BillingIntegration } from "@smartout/billing";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { CreateIntegrationSheet } from "./CreateIntegrationSheet";
import { EditIntegrationDialog } from "./EditIntegrationDialog";
import {
  IntegrationStatusIndicator,
  type IntegrationStatusState,
} from "./IntegrationStatusIndicator";
import { SyncHistoryPanel } from "./SyncHistoryPanel";
import { TestConnectionButton } from "./TestConnectionButton";

// IntegrationsList — the main client surface for the integrations tab.
// Renders the table, hosts the create sheet + edit dialog state, and
// exposes the row click → edit flow plus the per-row test-connection
// button. The selected integration also drives the SyncHistoryPanel
// beneath the table.
//
// ADR-0129: placeholder rows render a distinct state in the status
// column (muted + AlertTriangle + explicit inline copy).

type Props = {
  integrations: BillingIntegration[];
};

export function IntegrationsList({ integrations }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = useMemo<BillingIntegration | null>(
    () => integrations.find((i) => i.integration_id === editingId) ?? null,
    [integrations, editingId],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="font-heading text-2xl">Integrasjoner</h2>
          <p className="text-muted-foreground text-sm">
            Platform-admin registrerer billing-integrasjoner. Fase 2 kjører kun PlaceholderAdapter;
            reelle Fiken / Tripletex / Stripe-adaptere lander i Fase 3.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          <span className="ml-1">Legg til integrasjon</span>
        </Button>
      </header>

      {integrations.length === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="border-border/60 overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Siste sync</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((integration) => {
                const state = rowState(integration);
                return (
                  <TableRow
                    key={integration.integration_id}
                    className="cursor-pointer"
                    onClick={() => setEditingId(integration.integration_id)}
                  >
                    <TableCell className="font-medium">{integration.display_name}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {integration.integration_type}
                    </TableCell>
                    <TableCell>
                      <IntegrationStatusIndicator state={state} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {integration.last_sync_at ? formatTimestamp(integration.last_sync_at) : "—"}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => {
                        // Button clicks here must not trigger the row
                        // open-for-edit navigation.
                        e.stopPropagation();
                      }}
                    >
                      <TestConnectionButton integrationId={integration.integration_id} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editing ? <SyncHistoryPanel key={editing.integration_id} integration={editing} /> : null}

      <CreateIntegrationSheet open={createOpen} onOpenChange={setCreateOpen} />
      <EditIntegrationDialog
        integration={editing}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      />
    </div>
  );
}

function rowState(integration: BillingIntegration): IntegrationStatusState {
  if (integration.is_placeholder) return "placeholder";
  if (!integration.is_enabled) return "error";
  if (integration.last_sync_status === "error") return "error";
  if (integration.last_sync_status === "ok") return "healthy";
  // No sync yet on an enabled, non-placeholder row = waiting.
  return "in_flight";
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border-border/60 bg-muted/10 flex flex-col items-start gap-3 rounded-xl border p-8">
      <h3 className="font-heading text-xl">Ingen integrasjoner registrert</h3>
      <p className="text-muted-foreground max-w-prose text-sm">
        Opprett en integrasjon for å teste &quot;Test tilkobling&quot;-flyten og se
        sync-historikken. Fase 2 bruker kun PlaceholderAdapter — ingen reelle kall mot Fiken,
        Tripletex eller Stripe.
      </p>
      <Button type="button" onClick={onCreate}>
        <Plus className="size-4" aria-hidden />
        <span className="ml-1">Legg til integrasjon</span>
      </Button>
    </div>
  );
}
