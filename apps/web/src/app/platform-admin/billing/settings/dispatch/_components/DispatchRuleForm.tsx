"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { BillingDispatchChannel, BillingDispatchRule } from "@smartout/billing";

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
import { Textarea } from "@/components/ui/textarea";

// Shared form for Create + Edit. Mirrors the billing_dispatch_rule
// columns the UI can edit. Target is an object editor:
//   - email_customer / email_internal → {email: string}
//   - http_api → {endpoint: string, signing_key_env?: string}
//   - peppol_ehf → {peppol_participant_id: string}
// Rendered as explicit fields per channel so platform-admin doesn't
// hand-type JSON at the keyboard. A fallback JSON textarea shows if
// the form is opened on a rule with unrecognised target shape.
//
// Platform-admin scope: caller may select workspace_id = null (= platform
// default) or any workspace from the provided list. ADR-0127 CHECK
// forces platform rules to action=send + no company_id; the form
// disables those fields when workspace_id === null.

export type DispatchRuleFormValues = {
  channel: BillingDispatchChannel;
  trigger_event: string;
  target: Record<string, unknown>;
  action: "send" | "suppress";
  is_enabled: boolean;
  workspace_id: string | null;
  company_id: string | null;
};

type Props = {
  defaultValues?: Partial<BillingDispatchRule>;
  /** Workspace pick list ([id, name]). When empty, workspace select is hidden. */
  workspaces?: Array<{ workspace_id: string; name: string }>;
  /** When true, lock workspace_id to the defaultValue (used in workspace-admin UI). */
  lockWorkspace?: boolean;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: DispatchRuleFormValues) => void;
  onCancel: () => void;
};

// Known trigger events — kept as suggestions, not a hard whitelist,
// so platform-admin can stage new events without a code change. The
// DB CHECK still blocks dot-separator drift.
const SUGGESTED_EVENTS = [
  "invoice issued",
  "invoice dispatched",
  "invoice paid",
  "invoice voided",
  "invoice marked_paid",
];

export function DispatchRuleForm({
  defaultValues,
  workspaces = [],
  lockWorkspace = false,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: Props) {
  const [channel, setChannel] = useState<BillingDispatchChannel>(
    (defaultValues?.channel as BillingDispatchChannel | undefined) ?? "email_customer",
  );
  const [triggerEvent, setTriggerEvent] = useState<string>(
    defaultValues?.trigger_event ?? "invoice issued",
  );
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    defaultValues?.workspace_id ?? null,
  );
  const [action, setAction] = useState<"send" | "suppress">(
    ((defaultValues?.action as "send" | "suppress" | undefined) ?? "send") === "suppress"
      ? "suppress"
      : "send",
  );
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultValues?.is_enabled ?? true);

  // Channel-specific target fields.
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

  const isPlatform = workspaceId === null;

  // Platform rules: ADR-0127 CHECK constraint forces action=send.
  // Auto-coerce when user flips workspace_id → null.
  const effectiveAction = isPlatform ? "send" : action;

  const buildTarget = (): Record<string, unknown> => {
    if (channel === "email_customer" || channel === "email_internal") {
      return { email: emailTarget.trim() };
    }
    if (channel === "http_api") {
      const t: Record<string, unknown> = { endpoint: endpoint.trim() };
      if (signingKeyEnv.trim().length > 0) t.signing_key_env = signingKeyEnv.trim();
      return t;
    }
    if (channel === "peppol_ehf") {
      return { peppol_participant_id: peppolId.trim() };
    }
    return {};
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({
      channel,
      trigger_event: triggerEvent.trim(),
      target: buildTarget(),
      action: effectiveAction,
      is_enabled: isEnabled,
      workspace_id: workspaceId,
      company_id: null,
    });
  };

  const targetValid = () => {
    if (channel === "email_customer" || channel === "email_internal") {
      return emailTarget.includes("@");
    }
    if (channel === "http_api") {
      return endpoint.trim().length > 0;
    }
    if (channel === "peppol_ehf") {
      return peppolId.trim().length > 0;
    }
    return false;
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {workspaces.length > 0 && !lockWorkspace ? (
        <div className="space-y-2">
          <Label htmlFor="workspace_id">Omfang</Label>
          <Select
            value={workspaceId ?? "__platform__"}
            onValueChange={(v) => setWorkspaceId(v === "__platform__" ? null : v)}
          >
            <SelectTrigger id="workspace_id">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__platform__">Platform-default (gjelder alle)</SelectItem>
              {workspaces.map((w) => (
                <SelectItem key={w.workspace_id} value={w.workspace_id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Platform-default gjelder for alle workspaces. Velg et workspace for en spesifikk
            override.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="trigger_event">Event</Label>
        <Input
          id="trigger_event"
          name="trigger_event"
          list="trigger-event-suggestions"
          value={triggerEvent}
          onChange={(e) => setTriggerEvent(e.target.value)}
          required
          placeholder="invoice issued"
          className="font-mono text-sm"
        />
        <datalist id="trigger-event-suggestions">
          {SUGGESTED_EVENTS.map((ev) => (
            <option key={ev} value={ev} />
          ))}
        </datalist>
        <p className="text-muted-foreground text-xs">
          Bruk mellomrom-separator (f.eks. &quot;invoice issued&quot;). Punktum er ikke tillatt.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="channel">Kanal</Label>
        <Select value={channel} onValueChange={(v) => setChannel(v as BillingDispatchChannel)}>
          <SelectTrigger id="channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email_customer">Epost (kunde)</SelectItem>
            <SelectItem value="email_internal">Epost (intern)</SelectItem>
            <SelectItem value="http_api">HTTP API</SelectItem>
            <SelectItem value="peppol_ehf">EHF / Peppol (reservert Fase 3)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {channel === "email_customer" || channel === "email_internal" ? (
        <div className="space-y-2">
          <Label htmlFor="target_email">Epost-mottaker</Label>
          <Input
            id="target_email"
            type="email"
            value={emailTarget}
            onChange={(e) => setEmailTarget(e.target.value)}
            placeholder="faktura@example.no"
            required
          />
        </div>
      ) : null}

      {channel === "http_api" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="target_endpoint">HTTP endpoint</Label>
            <Input
              id="target_endpoint"
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.no/invoices"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signing_key_env">Signing key env (valgfri)</Label>
            <Input
              id="signing_key_env"
              value={signingKeyEnv}
              onChange={(e) => setSigningKeyEnv(e.target.value)}
              placeholder="BILLING_WEBHOOK_SIGNING_KEY"
              className="font-mono text-xs"
            />
            <p className="text-muted-foreground text-xs">
              Navn på env-variabelen som inneholder HMAC-nøkkelen. Aldri lagre klartekst her — bruk
              op:// referanser.
            </p>
          </div>
        </div>
      ) : null}

      {channel === "peppol_ehf" ? (
        <div className="space-y-2">
          <Label htmlFor="peppol_id">Peppol participant ID</Label>
          <Input
            id="peppol_id"
            value={peppolId}
            onChange={(e) => setPeppolId(e.target.value)}
            placeholder="0192:987654321"
            className="font-mono text-sm"
          />
          <Textarea
            readOnly
            rows={2}
            className="text-muted-foreground mt-2 font-mono text-xs"
            value="Peppol-kanal er reservert for Fase 3. Regler kan lagres, men utsending er ikke implementert."
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="action">Handling</Label>
        <Select
          value={effectiveAction}
          onValueChange={(v) => setAction(v as "send" | "suppress")}
          disabled={isPlatform}
        >
          <SelectTrigger id="action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="send">Send</SelectItem>
            <SelectItem value="suppress">Ikke send (suppress platform-default)</SelectItem>
          </SelectContent>
        </Select>
        {isPlatform ? (
          <p className="text-muted-foreground text-xs">
            Platform-defaults må være send (ADR-0127). Bruk en workspace-regel for å suppressere.
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_enabled"
          checked={isEnabled}
          onCheckedChange={(v) => setIsEnabled(v === true)}
        />
        <Label htmlFor="is_enabled" className="cursor-pointer">
          Aktiv
        </Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Avbryt
        </Button>
        <Button
          type="submit"
          disabled={pending || triggerEvent.trim().length === 0 || !targetValid()}
        >
          {pending ? "Lagrer…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
