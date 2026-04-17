"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createIntegrationAction } from "../../_actions/integrations/createIntegrationAction";

import { IntegrationForm, type IntegrationFormValues } from "./IntegrationForm";

// CreateIntegrationSheet — slide-out form triggered by the "Legg til
// integrasjon" button in IntegrationsList. Calls createIntegrationAction
// on submit. Toast success closes the sheet; errors stay visible.

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateIntegrationSheet({ open, onOpenChange }: Props) {
  const [pending, startTransition] = useTransition();

  const handleSubmit = (values: IntegrationFormValues) => {
    startTransition(async () => {
      const result = await createIntegrationAction({
        display_name: values.display_name,
        integration_type: values.integration_type,
        is_enabled: values.is_enabled,
        is_placeholder: values.is_placeholder,
        config: values.config,
      });

      if (result.ok) {
        toast.success(`Integrasjon "${values.display_name}" opprettet.`);
        onOpenChange(false);
      } else {
        toast.error(`Kunne ikke opprette integrasjon: ${result.error}`);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-lg overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-1">
          <SheetTitle className="font-heading text-xl">Ny integrasjon</SheetTitle>
          <SheetDescription>
            Registrer en billing-integrasjon. Fase 2 bruker kun PlaceholderAdapter — ingen reell
            ekstern effekt kjøres.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <IntegrationForm
            submitLabel="Opprett integrasjon"
            pending={pending}
            onCancel={() => onOpenChange(false)}
            onSubmit={handleSubmit}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
