"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import type { BillingDispatchRule } from "@smartout/billing";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { createDispatchRuleAction } from "../../_actions/dispatch-rules/createDispatchRuleAction";
import { deleteDispatchRuleAction } from "../../_actions/dispatch-rules/deleteDispatchRuleAction";

// DunningOptOutToggle — per-workspace opt-out for auto-dunning.
//
// Mechanics per spec §4.4 (2026-04-17-billing-engine-fase-3-design.md):
//  - ON (default): no suppress row in billing_dispatch_rule. B4's
//    scan_overdue_invoices handler enqueues email_customer dispatches
//    for invoice dunning_escalated events.
//  - OFF: a billing_dispatch_rule with channel=email_customer,
//    trigger_event='invoice dunning_escalated', action='suppress',
//    is_enabled=true exists for the workspace. B4's handler reads
//    effective_dispatch_rules() and skips the customer email while
//    still advancing dunning_status internally (audit trail intact).
//
// Framing (Frontend R8): policy decision — "should Smartout ever
// remind THIS workspace's customers?" — not a per-invoice exception.
// One workspace = one toggle. Companies with multiple workspaces see
// one toggle per workspace (parent component renders N toggles).

export const DUNNING_OPTOUT_CHANNEL = "email_customer" as const;
export const DUNNING_OPTOUT_TRIGGER_EVENT = "invoice dunning_escalated" as const;

type Props = {
  workspaceId: string;
  workspaceName: string;
  /** The existing suppress rule for this workspace, if one exists. */
  existingSuppressRule: BillingDispatchRule | null;
  /** Hide the per-workspace heading when only one workspace is visible. */
  showWorkspaceHeading?: boolean;
};

export function DunningOptOutToggle({
  workspaceId,
  workspaceName,
  existingSuppressRule,
  showWorkspaceHeading = false,
}: Props) {
  const { t } = useTranslation("billing");
  const [pending, startTransition] = useTransition();
  // Optimistic local state — toggled immediately on click, rolled back on
  // error. Server action triggers revalidatePath which re-renders with
  // the authoritative row state on next request.
  const [autoRemindersOn, setAutoRemindersOn] = useState<boolean>(
    !existingSuppressRule || existingSuppressRule.is_enabled === false,
  );
  // Track the current rule id locally so we can delete it after a
  // toggle-OFF round trip without waiting for server revalidation.
  const [currentRuleId, setCurrentRuleId] = useState<string | null>(
    existingSuppressRule && existingSuppressRule.is_enabled
      ? existingSuppressRule.dispatch_rule_id
      : null,
  );

  const handleToggle = (nextOn: boolean) => {
    // Record starting point so we can roll back on error.
    const prevOn = autoRemindersOn;
    const prevRuleId = currentRuleId;
    setAutoRemindersOn(nextOn);

    startTransition(async () => {
      if (!nextOn) {
        // Toggle OFF → create suppress rule (turn off auto-dunning)
        const result = await createDispatchRuleAction({
          workspace_id: workspaceId,
          channel: DUNNING_OPTOUT_CHANNEL,
          trigger_event: DUNNING_OPTOUT_TRIGGER_EVENT,
          target: {},
          action: "suppress",
          is_enabled: true,
        });
        if (!result.ok) {
          setAutoRemindersOn(prevOn);
          setCurrentRuleId(prevRuleId);
          toast.error(t("dunning.optout.error_toast", { error: result.error }));
          return;
        }
        setCurrentRuleId(result.rule.dispatch_rule_id);
        toast.success(t("dunning.optout.success_toast"));
      } else {
        // Toggle ON → delete the existing suppress rule (re-enable
        // auto-dunning). Without a rule id there is nothing to delete;
        // silently succeed — UI and server already agree.
        if (!prevRuleId) {
          toast.success(t("dunning.optout.success_toast"));
          return;
        }
        const result = await deleteDispatchRuleAction({
          dispatch_rule_id: prevRuleId,
        });
        if (!result.ok) {
          setAutoRemindersOn(prevOn);
          setCurrentRuleId(prevRuleId);
          toast.error(t("dunning.optout.error_toast", { error: result.error }));
          return;
        }
        setCurrentRuleId(null);
        toast.success(t("dunning.optout.success_toast"));
      }
    });
  };

  const switchId = `dunning-optout-${workspaceId}`;

  return (
    <div className="border-border/60 bg-card/40 space-y-3 rounded-xl border p-4">
      {showWorkspaceHeading ? (
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {t("dunning.optout.workspace_heading", { name: workspaceName })}
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label
            htmlFor={switchId}
            className={cn("text-sm font-medium", pending && "animate-pulse")}
          >
            {t("dunning.optout.toggle_label")}
          </Label>
          <p className="text-muted-foreground max-w-prose text-xs">
            {autoRemindersOn ? t("dunning.optout.helper_on") : t("dunning.optout.helper_off")}
          </p>
        </div>
        <Switch
          id={switchId}
          role="switch"
          aria-checked={autoRemindersOn}
          aria-label={t("dunning.optout.toggle_aria_label")}
          checked={autoRemindersOn}
          disabled={pending}
          onCheckedChange={handleToggle}
        />
      </div>
    </div>
  );
}
