"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createDispatchRuleAction } from "../../../_actions/dispatch-rules/createDispatchRuleAction";

import { DispatchRuleForm, type DispatchRuleFormValues } from "./DispatchRuleForm";

// DispatchRuleSheet — slide-out form triggered by "Legg til regel" in
// DispatchRulesTable. Loads a workspace list client-side so platform-
// admin can bind a rule to any workspace (or pick "Platform-default").
// Calls createDispatchRuleAction on submit; toast success closes.

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DispatchRuleSheet({ open, onOpenChange }: Props) {
  const [pending, startTransition] = useTransition();
  const [workspaces, setWorkspaces] = useState<Array<{ workspace_id: string; name: string }>>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Workspaces are not sensitive to list from a platform-admin
    // surface. We use the anon client here so the page doesn't need
    // an extra Server Action round-trip before the form renders.
    createClient()
      .from("workspace")
      .select("workspace_id, name")
      .order("name")
      .limit(500)
      .then(({ data }) => {
        if (cancelled) return;
        const mapped = (data ?? []).map((w) => ({
          workspace_id: w.workspace_id,
          name: w.name ?? w.workspace_id,
        }));
        setWorkspaces(mapped);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSubmit = (values: DispatchRuleFormValues) => {
    startTransition(async () => {
      const result = await createDispatchRuleAction({
        channel: values.channel,
        trigger_event: values.trigger_event,
        target: values.target,
        action: values.action,
        is_enabled: values.is_enabled,
        workspace_id: values.workspace_id,
        company_id: values.company_id,
      });

      if (result.ok) {
        toast.success("Regel opprettet.");
        onOpenChange(false);
      } else {
        toast.error(`Kunne ikke opprette regel: ${result.error}`);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-lg overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-1">
          <SheetTitle className="font-heading text-xl">Ny utsendelsesregel</SheetTitle>
          <SheetDescription>
            Velg omfang (platform-default eller spesifikt workspace), event, kanal og mottaker.
            Platform-rader må være &quot;Send&quot;.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <DispatchRuleForm
            workspaces={workspaces}
            submitLabel="Opprett regel"
            pending={pending}
            onCancel={() => onOpenChange(false)}
            onSubmit={handleSubmit}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
