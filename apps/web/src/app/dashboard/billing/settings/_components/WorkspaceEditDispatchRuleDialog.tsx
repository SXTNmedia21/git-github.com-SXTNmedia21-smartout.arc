"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { BillingDispatchRule } from "@smartout/billing";
import { useTranslation } from "@smartout/i18n";

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
import { deleteDispatchRuleAction } from "../../_actions/dispatch-rules/deleteDispatchRuleAction";
import { updateDispatchRuleAction } from "../../_actions/dispatch-rules/updateDispatchRuleAction";

import {
  WorkspaceDispatchRuleForm,
  type WorkspaceDispatchRuleFormValues,
} from "./WorkspaceDispatchRuleForm";

// Workspace-admin edit + delete dialog for dispatch rules. Scope-locked:
// workspace is pre-filled from the rule and not editable (a workspace-
// admin cannot re-scope a rule to another workspace through this UI).

type Props = {
  rule: BillingDispatchRule | null;
  onOpenChange: (open: boolean) => void;
};

export function WorkspaceEditDispatchRuleDialog({ rule, onOpenChange }: Props) {
  const { t } = useTranslation("billing");
  const [pendingSave, startSaveTransition] = useTransition();
  const [pendingDelete, startDeleteTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // A rule always has a workspace_id in this flow — we only render the
  // dialog for workspace rules, not platform rules.
  const ruleWorkspaces = rule?.workspace_id
    ? [{ workspace_id: rule.workspace_id, name: rule.workspace_id }]
    : [];

  const handleSubmit = (values: WorkspaceDispatchRuleFormValues) => {
    if (!rule) return;
    startSaveTransition(async () => {
      const result = await updateDispatchRuleAction({
        dispatch_rule_id: rule.dispatch_rule_id,
        channel: values.channel,
        trigger_event: values.trigger_event,
        target: values.target,
        action: values.action,
        is_enabled: values.is_enabled,
      });

      if (result.ok) {
        toast.success(t("dispatch_settings.rule_sheet.update_success"));
        onOpenChange(false);
      } else {
        toast.error(t("dispatch_settings.rule_sheet.update_error", { error: result.error }));
      }
    });
  };

  const handleDelete = () => {
    if (!rule) return;
    startDeleteTransition(async () => {
      const result = await deleteDispatchRuleAction({ dispatch_rule_id: rule.dispatch_rule_id });
      if (result.ok) {
        toast.success(t("dispatch_settings.rule_sheet.delete_success"));
        setConfirmOpen(false);
        onOpenChange(false);
      } else {
        toast.error(t("dispatch_settings.rule_sheet.delete_error", { error: result.error }));
      }
    });
  };

  return (
    <>
      <Dialog open={!!rule} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {t("dispatch_settings.rule_sheet.edit_title")}
            </DialogTitle>
            <DialogDescription>
              {t("dispatch_settings.rule_sheet.edit_description")}
            </DialogDescription>
          </DialogHeader>
          {rule ? (
            <WorkspaceDispatchRuleForm
              defaultValues={rule}
              workspaces={ruleWorkspaces}
              lockWorkspace
              submitLabel={t("dispatch_settings.rule_sheet.submit_edit")}
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
              {t("dispatch_settings.rule_sheet.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("dispatch_settings.rule_sheet.delete_confirm_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("dispatch_settings.rule_sheet.delete_confirm_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingDelete}>
              {t("dispatch_settings.rule_sheet.delete_cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={pendingDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pendingDelete
                ? t("dispatch_settings.rule_sheet.deleting")
                : t("dispatch_settings.rule_sheet.delete_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
