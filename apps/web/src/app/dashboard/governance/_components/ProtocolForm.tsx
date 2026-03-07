"use client";

/**
 * Create/Edit form for protocols. Opens in a Sheet.
 * Requires selecting a parent policy.
 * Connected to: use-governance-mutations.ts (useCreateProtocol)
 *
 * UI Events:
 * - action: openSheet (create trigger)
 * - action: submitForm (create protocol)
 */

import { useState, useContext } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useCreateProtocol } from "../_hooks/use-governance-mutations";

export function ProtocolForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [version, setVersion] = useState("1.0");

  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const createProtocol = useCreateProtocol();

  // Fetch available policies for the dropdown
  const { data: policies } = useQuery({
    queryKey: ["governance", "policies", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("policy")
        .select("policy_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !policyId || !profileId) return;

    createProtocol.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        policy_id: policyId,
        owner_profile_id: profileId,
        version,
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
    setDescription("");
    setPolicyId("");
    setVersion("1.0");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors">
          <Plus className="h-4 w-4" />
          Ny Protokoll
        </button>
      </SheetTrigger>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Opprett ny protokoll</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="protocol-name">Navn</Label>
            <Input
              id="protocol-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Opplæring i matsikkerhet"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocol-description">Beskrivelse (valgfritt)</Label>
            <Textarea
              id="protocol-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hva dekker denne protokollen..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Tilhorende policy</Label>
            <Select value={policyId} onValueChange={setPolicyId}>
              <SelectTrigger>
                <SelectValue placeholder="Velg policy..." />
              </SelectTrigger>
              <SelectContent>
                {(policies ?? []).map((p) => (
                  <SelectItem key={p.policy_id} value={p.policy_id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocol-version">Versjon</Label>
            <Input
              id="protocol-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0"
            />
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
              disabled={createProtocol.isPending || !name.trim() || !policyId}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {createProtocol.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Opprett
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
