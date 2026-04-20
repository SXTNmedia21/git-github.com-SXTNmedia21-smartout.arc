"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { BillingDispatchChannel, BillingDispatchRule } from "@smartout/billing";
import { useTranslation } from "@smartout/i18n";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Workspace-admin dispatch rule form. Narrower surface than the
// platform-admin variant:
//   - workspace_id is locked to the workspace picker (never null).
//   - company_id is not exposed (Fase 2 workspace-admin can't carve
//     out per-company inside a workspace).
//   - action supports both 'send' (new recipient) and 'suppress' (turn
//     off a platform default).
//
// All strings go through @smartout/i18n per spec §9.

export type WorkspaceDispatchRuleFormValues = {
  channel: BillingDispatchChannel;
  trigger_event: string;
  target: Record<string, unknown>;
  action: "send" | "suppress";
  is_enabled: boolean;
  workspace_id: string;
};

type Props = {
  defaultValues?: Partial<BillingDispatchRule>;
  /** Pick list for the workspace select. Required — workspace-admin
   *  always scopes to one of their own workspaces. */
  workspaces: Array<{ workspace_id: string; name: string }>;
  /** When true, hides the workspace select (used on edit when scope
   *  cannot change). */
  lockWorkspace?: boolean;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: WorkspaceDispatchRuleFormValues) => void;
  onCancel: () => void;
};

const SUGGESTED_EVENTS = [
  "invoice issued",
  "invoice dispatched",
  "invoice paid",
  "invoice voided",
  "invoice marked_paid",
];

export function WorkspaceDispatchRuleForm({
  defaultValues,
  workspaces,
  lockWorkspace = false,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: Props) {
  const { t } = useTranslation("billing");
  const [channel, setChannel] = useState<BillingDispatchChannel>(
    (defaultValues?.channel as BillingDispatchChannel | undefined) ?? "email_customer",
  );
  const [triggerEvent, setTriggerEvent] = useState<string>(
    defaultValues?.trigger_event ?? "invoice issued",
  );
  const [workspaceId, setWorkspaceId] = useState<string>(
    defaultValues?.workspace_id ?? workspaces[0]?.workspace_id ?? "",
  );
  const [action, setAction] = useState<"send" | "suppress">(
    ((defaultValues?.action as "send" | "suppress" | undefined) ?? "send") === "suppress"
      ? "suppress"
      : "send",
  );
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultValues?.is_enabled ?? true);

  const initTarget = (defaultValues?.target ?? {}) as Record<string, unknown>;
  const [emailTarget, setEmailTarget] = useState<string>(
    typeof initTarget.email === "string" ? initTarget.email : "",
  );
  const [endpoint, setEndpoint] = useState<string>(
    typeof initTarget.endpoint === "string" ? initTarget.endpoint : "",
  );
  const [signingKeyEnv, setSigningKeyEnv] = useState<string>(
    typeof initTarget.signing_key_env === "string" ? initTarget.signing_key_env : "",
  );
  const [peppolId, setPeppolId] = useState<string>(
    typeof initTarget.peppol_participant_id === "string" ? initTarget.peppol_participant_id : "",
  );

  const buildTarget = (): Record<string, unknown> => {
    if (channel === "email_customer" || channel === "email_internal") {
      return { email: emailTarget.trim() };
    }
    if (channel === "http_api") {
      const tgt: Record<string, unknown> = { endpoint: endpoint.trim() };
      if (signingKeyEnv.trim().length > 0) tgt.signing_key_env = signingKeyEnv.trim();
      return tgt;
    }
    if (channel === "peppol_ehf") {
      return { peppol_participant_id: peppolId.trim() };
    }
    return {};
  };

  const targetValid = () => {
    if (channel === "email_customer" || channel === "email_internal")
      return emailTarget.includes("@");
    if (channel === "http_api") return endpoint.trim().length > 0;
    if (channel === "peppol_ehf") return peppolId.trim().length > 0;
    return false;
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!workspaceId) return;
    onSubmit({
      channel,
      trigger_event: triggerEvent.trim(),
      target: buildTarget(),
      action,
      is_enabled: isEnabled,
      workspace_id: workspaceId,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {workspaces.length > 1 && !lockWorkspace ? (
        <div className="space-y-2">
          <Label htmlFor="workspace_id">Workspace</Label>
          <Select value={workspaceId} onValueChange={setWorkspaceId}>
            <SelectTrigger id="workspace_id">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((w) => (
                <SelectItem key={w.workspace_id} value={w.workspace_id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="trigger_event">{t("dispatch_settings.rule_sheet.event_label")}</Label>
        <Input
          id="trigger_event"
          name="trigger_event"
          list="workspace-trigger-events"
          value={triggerEvent}
          onChange={(e) => setTriggerEvent(e.target.value)}
          required
          className="font-mono text-sm"
        />
        <datalist id="workspace-trigger-events">
          {SUGGESTED_EVENTS.map((ev) => (
            <option key={ev} value={ev} />
          ))}
        </datalist>
        <p className="text-muted-foreground text-xs">
          {t("dispatch_settings.rule_sheet.event_hint")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="channel">{t("dispatch_settings.rule_sheet.channel_label")}</Label>
        <Select value={channel} onValueChange={(v) => setChannel(v as BillingDispatchChannel)}>
          <SelectTrigger id="channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email_customer">
              {t("dispatch_settings.rule_sheet.channel_email_customer")}
            </SelectItem>
            <SelectItem value="email_internal">
              {t("dispatch_settings.rule_sheet.channel_email_internal")}
            </SelectItem>
            <SelectItem value="http_api">
              {t("dispatch_settings.rule_sheet.channel_http_api")}
            </SelectItem>
            <SelectItem value="peppol_ehf">
              {t("dispatch_settings.rule_sheet.channel_peppol_ehf")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {channel === "email_customer" || channel === "email_internal" ? (
        <div className="space-y-2">
          <Label htmlFor="target_email">
            {t("dispatch_settings.rule_sheet.target_email_label")}
          </Label>
          <Input
            id="target_email"
            type="email"
            value={emailTarget}
            onChange={(e) => setEmailTarget(e.target.value)}
            placeholder={t("dispatch_settings.rule_sheet.target_email_placeholder")}
            required
          />
        </div>
      ) : null}

      {channel === "http_api" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="target_endpoint">
              {t("dispatch_settings.rule_sheet.target_endpoint_label")}
            </Label>
            <Input
              id="target_endpoint"
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder={t("dispatch_settings.rule_sheet.target_endpoint_placeholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signing_key_env">
              {t("dispatch_settings.rule_sheet.target_signing_key_env_label")}
            </Label>
            <Input
              id="signing_key_env"
              value={signingKeyEnv}
              onChange={(e) => setSigningKeyEnv(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-muted-foreground text-xs">
              {t("dispatch_settings.rule_sheet.target_signing_key_env_hint")}
            </p>
          </div>
        </div>
      ) : null}

      {channel === "peppol_ehf" ? (
        <div className="space-y-2">
          <Label htmlFor="peppol_id">{t("dispatch_settings.rule_sheet.target_peppol_label")}</Label>
          <Input
            id="peppol_id"
            value={peppolId}
            onChange={(e) => setPeppolId(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="action">{t("dispatch_settings.rule_sheet.action_label")}</Label>
        <Select value={action} onValueChange={(v) => setAction(v as "send" | "suppress")}>
          <SelectTrigger id="action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="send">{t("dispatch_settings.rule_sheet.action_send")}</SelectItem>
            <SelectItem value="suppress">
              {t("dispatch_settings.rule_sheet.action_suppress")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_enabled"
          checked={isEnabled}
          onCheckedChange={(v) => setIsEnabled(v === true)}
        />
        <Label htmlFor="is_enabled" className="cursor-pointer">
          {t("dispatch_settings.rule_sheet.is_enabled_label")}
        </Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {t("dispatch_settings.rule_sheet.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={pending || triggerEvent.trim().length === 0 || !targetValid() || !workspaceId}
        >
          {pending ? t("dispatch_settings.rule_sheet.submitting") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
