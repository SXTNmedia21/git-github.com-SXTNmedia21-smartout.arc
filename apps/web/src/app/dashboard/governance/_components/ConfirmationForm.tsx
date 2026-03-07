"use client";

/**
 * Create form for confirmations within a protocol.
 * Connected to: use-governance-mutations.ts (useCreateConfirmation)
 *
 * UI Events:
 * - action: openSheet (create trigger)
 * - action: submitForm (create confirmation)
 */

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useCreateConfirmation } from "../_hooks/use-governance-mutations";

export function ConfirmationForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [protocolId, setProtocolId] = useState("");
  const [requiresSignature, setRequiresSignature] = useState(true);

  const { workspace } = useWorkspace();
  const createConfirmation = useCreateConfirmation();

  const { data: protocols } = useQuery({
    queryKey: ["governance", "protocols", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("protocol")
        .select("protocol_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !confirmationText.trim() || !protocolId) return;

    createConfirmation.mutate(
      {
        name: name.trim(),
        confirmation_text: confirmationText.trim(),
        protocol_id: protocolId,
        requires_signature: requiresSignature,
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      },
    );
  }

  function resetForm() {
    setName("");
    setConfirmationText("");
    setProtocolId("");
    setRequiresSignature(true);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors">
          <Plus className="h-4 w-4" />
          Ny Bekreftelse
        </button>
      </SheetTrigger>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Opprett ny bekreftelse</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="conf-name">Navn</Label>
            <Input
              id="conf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Hygienebekreftelse"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tilhorende protokoll</Label>
            <Select value={protocolId} onValueChange={setProtocolId}>
              <SelectTrigger>
                <SelectValue placeholder="Velg protokoll..." />
              </SelectTrigger>
              <SelectContent>
                {(protocols ?? []).map((p) => (
                  <SelectItem key={p.protocol_id} value={p.protocol_id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="conf-text">Bekreftelsestekst</Label>
            <Textarea
              id="conf-text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Teksten som ansatte ma bekrefte at de har lest og forstatt..."
              rows={4}
              required
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={requiresSignature}
              onCheckedChange={setRequiresSignature}
              id="req-sig"
            />
            <Label htmlFor="req-sig" className="text-sm">
              Krever digital signatur
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={
                createConfirmation.isPending ||
                !name.trim() ||
                !confirmationText.trim() ||
                !protocolId
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {createConfirmation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Opprett
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
