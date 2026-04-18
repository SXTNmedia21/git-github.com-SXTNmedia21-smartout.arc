"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { BillingDispatchRule } from "@smartout/billing";
import { createClient } from "@smartout/supabase/client";

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
import { deleteDispatchRuleAction } from "../../../_actions/dispatch-rules/deleteDispatchRuleAction";
import { updateDispatchRuleAction } from "../../../_actions/dispatch-rules/updateDispatchRuleAction";

import { DispatchRuleForm, type DispatchRuleFormValues } from "./DispatchRuleForm";

// EditDispatchRuleDialog — opened when a row in DispatchRulesTable is
// clicked. Pre-fills DispatchRuleForm with the current rule, routes
// saves to updateDispatchRuleAction, deletes through an AlertDialog
// confirm step (destructive, so a second click is the guardrail).

type Props = {
  rule: BillingDispatchRule | null;
  workspaceNames: Map<string, string>;
  onOpenChange: (open: boolean) => void;
};

export function EditDispatchRuleDialog({ rule, workspaceNames, onOpenChange }: Props) {
  const [pendingSave, startSaveTransition] = useTransition();
  const [pendingDelete, startDeleteTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Array<{ workspace_id: string; name: string }>>([]);

  useEffect(() => {
    if (!rule) return;
    // Populate the workspace select with the known workspaces so the
    // picker still works if the admin re-scopes the rule. We reuse the
    // names map from page.tsx props first, but fall back to a fetch if
    // the map is empty (rare — test setups mostly).
    if (workspaceNames.size > 0) {
      const list = Array.from(workspaceNames.entries()).map(([id, name]) => ({
        workspace_id: id,
        name,
      }));
      setWorkspaces(list);
      return;
    }
    let cancelled = false;
    createClient()
      .from("workspace")
      .select("workspace_id, name")
      .order("name")
      .limit(500)
      .then(({ data }) => {
        if (cancelled) return;
        setWorkspaces(
          (data ?? []).map((w) => ({
            workspace_id: w.workspace_id,
            name: w.name ?? w.workspace_id,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [rule, workspaceNames]);

  const handleSubmit = (values: DispatchRuleFormValues) => {
    if (!rule) return;
    startSaveTransition(async () => {
      const result = await updateDispatchRuleAction({
        dispatch_rule_id: rule.dispatch_rule_id,
        channel: values.channel,
        trigger_event: values.trigger_event,
        target: values.target,
        action: values.action,
        is_enabled: values.is_enabled,
        company_id: values.company_id,
      });

      if (result.ok) {
        toast.success("Regel oppdatert.");
        onOpenChange(false);
      } else {
        toast.error(`Kunne ikke oppdatere: ${result.error}`);
      }
    });
  };

  const handleDelete = () => {
    if (!rule) return;
    startDeleteTransition(async () => {
      const result = await deleteDispatchRuleAction({ dispatch_rule_id: rule.dispatch_rule_id });
      if (result.ok) {
        toast.success("Regel slettet.");
        setConfirmOpen(false);
        onOpenChange(false);
      } else {
        toast.error(`Kunne ikke slette: ${result.error}`);
      }
    });
  };

  return (
    <>
      <Dialog open={!!rule} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Rediger utsendelsesregel</DialogTitle>
            <DialogDescription>
              Endring i regelen skriver en diff til billing_activity_log. Slett er permanent.
            </DialogDescription>
          </DialogHeader>
          {rule ? (
            <DispatchRuleForm
              defaultValues={rule}
              workspaces={workspaces}
              submitLabel="Lagre endringer"
              pending={pendingSave}
              onCancel={() => onOpenChange(false)}
              onSubmit={handleSubmit}
            />
          ) : null}
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(true)}
              disabled={pendingSave || pendingDelete}
              className="text-destructive hover:text-destructive"
            >
              Slett regel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett utsendelsesregel?</AlertDialogTitle>
            <AlertDialogDescription>
              Handlingen kan ikke angres. Regelen vil slettes permanent fra billing_dispatch_rule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingDelete}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pendingDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pendingDelete ? "Sletter…" : "Slett"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
