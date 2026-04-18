"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { BillingDispatchChannel } from "@smartout/billing";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createAdHocDispatchAction } from "../../../_actions/createAdHocDispatch";

// AdHocDispatchSheet — slide-out drawer for "Legg til ad-hoc mottaker"
// on the invoice detail page. Lets platform-admin fire a dispatch
// without a matching rule (dispatch_rule_id NULL on the new row).
//
// The Sheet reuses the channel-specific target fields from
// DispatchRuleForm mentally but inlines them here so there's no cross-
// area coupling — platform-admin adhoc is a one-off, not a rule.

type Props = {
  invoiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdHocDispatchSheet({ invoiceId, open, onOpenChange }: Props) {
  const [channel, setChannel] = useState<BillingDispatchChannel>("email_customer");
  const [email, setEmail] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [signingKeyEnv, setSigningKeyEnv] = useState("");
  const [peppolId, setPeppolId] = useState("");
  const [pending, startTransition] = useTransition();

  const buildTarget = (): Record<string, unknown> => {
    if (channel === "email_customer" || channel === "email_internal") {
      return { email: email.trim() };
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

  const targetValid = () => {
    if (channel === "email_customer" || channel === "email_internal") return email.includes("@");
    if (channel === "http_api") return endpoint.trim().length > 0;
    if (channel === "peppol_ehf") return peppolId.trim().length > 0;
    return false;
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createAdHocDispatchAction({
        invoice_id: invoiceId,
        channel,
        target: buildTarget(),
      });
      if (result.ok) {
        toast.success("Ad-hoc utsending køet.");
        onOpenChange(false);
      } else {
        toast.error(`Kunne ikke sende: ${result.error}`);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-lg overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-1">
          <SheetTitle className="font-heading text-xl">Legg til ad-hoc mottaker</SheetTitle>
          <SheetDescription>
            Send denne fakturaen til én ekstra mottaker utenom regel-matchingen. Lagrer ingen regel
            — kun en engangs-dispatch.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="faktura@example.no"
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
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Avbryt
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={pending || !targetValid()}>
              {pending ? "Sender…" : "Send ad-hoc"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
