"use client";

/**
 * Create/Edit form for policies. Opens in a Sheet.
 * Connected to: use-governance-mutations.ts (useCreatePolicy, useUpdatePolicy)
 *
 * UI Events:
 * - action: openSheet (create/edit trigger)
 * - action: submitForm (create or update policy)
 */

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
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
import { useCreatePolicy } from "../_hooks/use-governance-mutations";

const POLICY_TYPES = [
  { value: "operational", label: "Drift" },
  { value: "haccp", label: "HACCP" },
  { value: "hr", label: "HR" },
  { value: "safety", label: "Sikkerhet" },
  { value: "access", label: "Tilgang" },
  { value: "payroll", label: "Lonn" },
  { value: "custom", label: "Egendefinert" },
] as const;

const POLICY_SCOPES = [
  { value: "workspace", label: "Hele arbeidsomradet" },
  { value: "department", label: "Avdeling" },
  { value: "team", label: "Team" },
  { value: "location", label: "Lokasjon" },
] as const;

export function PolicyForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [statement, setStatement] = useState("");
  const [description, setDescription] = useState("");
  const [policyType, setPolicyType] =
    useState<(typeof POLICY_TYPES)[number]["value"]>("operational");
  const [policyScope, setPolicyScope] =
    useState<(typeof POLICY_SCOPES)[number]["value"]>("workspace");

  const createPolicy = useCreatePolicy();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !statement.trim()) return;

    createPolicy.mutate(
      {
        name: name.trim(),
        statement: statement.trim(),
        description: description.trim() || undefined,
        policy_type: policyType,
        policy_scope: policyScope,
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
    setStatement("");
    setDescription("");
    setPolicyType("operational");
    setPolicyScope("workspace");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors">
          <Plus className="h-4 w-4" />
          Ny Policy
        </button>
      </SheetTrigger>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Opprett ny policy</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="policy-name">Navn</Label>
            <Input
              id="policy-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Hygienepolicy"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policy-statement">Erklaering</Label>
            <Textarea
              id="policy-statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Kort erklaering om hva policyen dekkert..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policy-description">Beskrivelse (valgfritt)</Label>
            <Textarea
              id="policy-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Utdypende beskrivelse..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={policyType}
                onValueChange={(v) => setPolicyType(v as typeof policyType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Omfang</Label>
              <Select
                value={policyScope}
                onValueChange={(v) => setPolicyScope(v as typeof policyScope)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_SCOPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              disabled={createPolicy.isPending || !name.trim() || !statement.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {createPolicy.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Opprett
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
