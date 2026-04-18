"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

import { updateCompanyEhfSettings } from "../_actions/updateCompanyEhfSettings";

// Fase 3B B6 — EHF-innstillinger på /dashboard/billing/settings.
//
// Workspace-admin / owner toggler ehf_enabled + setter
// peppol_participant_id for sin company. Platform-admin gjør deretter
// månedlig EHF-eksport på tvers av alle aktiverte companies.

type Props = {
  initialEhfEnabled: boolean;
  initialPeppolParticipantId: string | null;
};

export function EhfSettingsSection({ initialEhfEnabled, initialPeppolParticipantId }: Props) {
  const [ehfEnabled, setEhfEnabled] = useState(initialEhfEnabled);
  const [peppolId, setPeppolId] = useState(initialPeppolParticipantId ?? "");
  const [pending, start] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = peppolId.trim();
    if (ehfEnabled && !trimmed) {
      toast.error("Peppol-ID må fylles ut før EHF kan slås på");
      return;
    }
    start(async () => {
      const result = await updateCompanyEhfSettings({
        ehf_enabled: ehfEnabled,
        peppol_participant_id: trimmed === "" ? null : trimmed,
      });
      if (result.ok) {
        toast.success("EHF-innstillinger lagret");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-heading text-lg">EHF-fakturering</h2>
        <p className="text-muted-foreground max-w-prose text-xs">
          Slå på hvis din regnskapsfører håndterer EHF-fakturaer. Smartout inkluderer da selskapets
          fakturaer i den månedlige eksporten til regnskapsfører, som leverer EHF i sitt eget
          system.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch id="ehf-enabled" checked={ehfEnabled} onCheckedChange={setEhfEnabled} />
          <Label htmlFor="ehf-enabled" className="cursor-pointer">
            EHF aktivert
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="peppol-id">Peppol-deltaker-ID</Label>
          <Input
            id="peppol-id"
            value={peppolId}
            onChange={(e) => setPeppolId(e.target.value)}
            placeholder="0192:923609016"
            aria-describedby="peppol-id-hint"
          />
          <p id="peppol-id-hint" className="text-muted-foreground text-xs">
            Format: <span className="font-mono">0192:&lt;orgnr&gt;</span> for norske avsendere.
            Regnskapsfører bruker verdien når EHF sendes.
          </p>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Lagrer…" : "Lagre"}
        </Button>
      </form>
    </section>
  );
}
