"use client";

/**
 * OptionalStep.tsx — Step 5
 *
 * Optional data: bankkontonummer, nærmeste pårørende, familiesituasjon.
 * Two CTAs: "Hopp over" (toast + proceed) or "Lagre" (save + proceed).
 * No field is required — the step itself is skippable.
 */

import { useState, useTransition } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveOptional, skipOptional } from "@/app/dashboard/_actions/welcome-wizard-actions";

type FamilySituation = "enslig" | "samboer" | "gift" | "barn";

const FAMILY_OPTIONS: { value: FamilySituation; label: string }[] = [
  { value: "enslig", label: "Enslig" },
  { value: "samboer", label: "Samboer" },
  { value: "gift", label: "Gift" },
  { value: "barn", label: "Med barn" },
];

type Props = {
  onNext: () => void;
  onBack: () => void;
};

export function OptionalStep({ onNext, onBack }: Props) {
  const [bankAccount, setBankAccount] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [familySituation, setFamilySituation] = useState<FamilySituation | "">("");
  const [isPending, startTransition] = useTransition();
  const [isSkipping, startSkipTransition] = useTransition();

  function formatBankAccount(raw: string) {
    return raw.replace(/\D/g, "").slice(0, 11);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveOptional({
        bankAccount: bankAccount || undefined,
        emergencyContactName: emergencyName || undefined,
        emergencyContactPhone: emergencyPhone || undefined,
        emergencyContactRelation: emergencyRelation || undefined,
        familySituation: (familySituation as FamilySituation) || undefined,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Noe gikk galt. Prøv igjen.");
        return;
      }
      onNext();
    });
  }

  function handleSkip() {
    startSkipTransition(async () => {
      await skipOptional();
      toast.info("Du kan fylle inn dette senere under profilen din.");
      onNext();
    });
  }

  const isAnyPending = isPending || isSkipping;

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h2 className="font-heading text-foreground text-2xl">Valgfri informasjon</h2>
        <p className="text-muted-foreground text-sm">
          Du kan fylle inn dette nå, eller hoppe over og gjøre det senere.
        </p>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-5 overflow-y-auto">
        {/* Bank account */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="ww-bank"
            className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          >
            Bankkontonummer (11 siffer)
          </Label>
          <Input
            id="ww-bank"
            type="text"
            inputMode="numeric"
            placeholder="1234 56 78901"
            value={bankAccount}
            onChange={(e) => setBankAccount(formatBankAccount(e.target.value))}
            className="border-border bg-muted/40 focus-visible:ring-foreground/20 font-mono"
          />
        </div>

        {/* Emergency contact */}
        <div className="flex flex-col gap-2.5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Nærmeste pårørende
          </p>
          <div className="border-border/60 bg-muted/20 flex flex-col gap-2 rounded-xl border p-3">
            <Input
              type="text"
              placeholder="Navn"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              className="border-border bg-background/60 focus-visible:ring-foreground/20"
            />
            <Input
              type="tel"
              placeholder="Telefon"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              className="border-border bg-background/60 focus-visible:ring-foreground/20"
            />
            <Input
              type="text"
              placeholder="Relasjon (f.eks. ektefelle, forelder)"
              value={emergencyRelation}
              onChange={(e) => setEmergencyRelation(e.target.value)}
              className="border-border bg-background/60 focus-visible:ring-foreground/20"
            />
          </div>
        </div>

        {/* Family situation */}
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Familiesituasjon
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FAMILY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFamilySituation((prev) => (prev === opt.value ? "" : opt.value))}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  familySituation === opt.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-muted/30 text-foreground hover:bg-muted/60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={isAnyPending}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Tilbake
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={isAnyPending}
            className="text-muted-foreground hover:text-foreground"
          >
            {isSkipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Hopp over"}
          </Button>
          <Button
            size="default"
            onClick={handleSave}
            disabled={isAnyPending}
            className="bg-foreground text-background hover:bg-foreground/90 min-w-[80px]"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lagre"}
          </Button>
        </div>
      </div>
    </div>
  );
}
