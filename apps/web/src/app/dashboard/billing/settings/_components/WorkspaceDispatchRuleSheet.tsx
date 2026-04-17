"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createDispatchRuleAction } from "../../_actions/dispatch-rules/createDispatchRuleAction";

import {
  WorkspaceDispatchRuleForm,
  type WorkspaceDispatchRuleFormValues,
} from "./WorkspaceDispatchRuleForm";

// Workspace-admin "Legg til regel" sheet. Locks the workspace_id to the
// caller's scope (workspace admins never write NULL here — platform
// defaults are Smartout-owned).

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceIds: string[];
  workspaceNames: Map<string, string>;
};

export function WorkspaceDispatchRuleSheet({
  open,
  onOpenChange,
  workspaceIds,
  workspaceNames,
}: Props) {
  const { t } = useTranslation("billing");
  const [pending, startTransition] = useTransition();

  const workspaces = workspaceIds.map((id) => ({
    workspace_id: id,
    name: workspaceNames.get(id) ?? id,
  }));

  const handleSubmit = (values: WorkspaceDispatchRuleFormValues) => {
    startTransition(async () => {
      const result = await createDispatchRuleAction({
        channel: values.channel,
        trigger_event: values.trigger_event,
        target: values.target,
        action: values.action,
        is_enabled: values.is_enabled,
        workspace_id: values.workspace_id,
        company_id: null,
      });

      if (result.ok) {
        toast.success(t("dispatch_settings.rule_sheet.create_success"));
        onOpenChange(false);
      } else {
        toast.error(t("dispatch_settings.rule_sheet.create_error", { error: result.error }));
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-lg overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-1">
          <SheetTitle className="font-heading text-xl">
            {t("dispatch_settings.rule_sheet.create_title")}
          </SheetTitle>
          <SheetDescription>
            {t("dispatch_settings.rule_sheet.create_description")}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <WorkspaceDispatchRuleForm
            workspaces={workspaces}
            submitLabel={t("dispatch_settings.rule_sheet.submit_create")}
            pending={pending}
            onCancel={() => onOpenChange(false)}
            onSubmit={handleSubmit}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
