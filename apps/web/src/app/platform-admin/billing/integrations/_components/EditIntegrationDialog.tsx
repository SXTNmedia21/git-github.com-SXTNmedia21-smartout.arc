"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { BillingIntegration } from "@smartout/billing";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteIntegrationAction } from "../../_actions/integrations/deleteIntegrationAction";
import { updateIntegrationAction } from "../../_actions/integrations/updateIntegrationAction";

import { IntegrationForm, type IntegrationFormValues } from "./IntegrationForm";

// EditIntegrationDialog — Dialog opened from an IntegrationsList row.
// Pre-fills IntegrationForm with the current row. Also exposes a
// "Slett" button with an AlertDialog confirm step that routes to
// deleteIntegrationAction.
//
// The form submit goes through updateIntegrationAction — only changed
// fields end up in the emitted "integration updated" diff (diff logic
// lives in the web Server Action).

type Props = {
  integration: BillingIntegration | null;
  onOpenChange: (open: boolean) => void;
};

export function EditIntegrationDialog({ integration, onOpenChange }: Props) {
  const [pendingSave, startSaveTransition] = useTransition();
  const [pendingDelete, startDeleteTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSubmit = (values: IntegrationFormValues) => {
    if (!integration) return;
    startSaveTransition(async () => {
      const result = await updateIntegrationAction({
        integration_id: integration.integration_id,
        display_name: values.display_name,
        is_enabled: values.is_enabled,
        is_placeholder: values.is_placeholder,
        config: values.config,
      });

      if (result.ok) {
        toast.success(`Integrasjon "${values.display_name}" oppdatert.`);
        onOpenChange(false);
      } else {
        toast.error(`Kunne ikke oppdatere: ${result.error}`);
      }
    });
  };

  const handleDelete = () => {
    if (!integration) return;
    startDeleteTransition(async () => {
      const result = await deleteIntegrationAction({
        integration_id: integration.integration_id,
      });
      if (result.ok) {
        toast.success(`Integrasjon "${integration.display_name}" slettet.`);
        setConfirmOpen(false);
        onOpenChange(false);
      } else {
        toast.error(`Kunne ikke slette: ${result.error}`);
      }
    });
  };

  const open = integration !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onOpenChange(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Rediger integrasjon</DialogTitle>
            <DialogDescription>
              Endringer logges i revisjonssporet som &quot;integration updated&quot;.
            </DialogDescription>
          </DialogHeader>

          {integration ? (
            <div className="space-y-4">
              <IntegrationForm
                defaultValues={integration}
                submitLabel="Lagre endringer"
                pending={pendingSave}
                onCancel={() => onOpenChange(false)}
                onSubmit={handleSubmit}
              />
              <div className="border-border/60 flex items-center justify-between border-t pt-3">
                <p className="text-muted-foreground text-xs">
                  Sletting fjerner raden permanent. Deaktiver i stedet om du vil bevare historikk.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pendingSave || pendingDelete}
                  onClick={() => setConfirmOpen(true)}
                >
                  Slett
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slette integrasjon?</AlertDialogTitle>
            <AlertDialogDescription>
              {integration
                ? `Dette sletter "${integration.display_name}" permanent. Kan ikke angres.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingDelete}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendingDelete}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {pendingDelete ? "Sletter…" : "Slett"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
