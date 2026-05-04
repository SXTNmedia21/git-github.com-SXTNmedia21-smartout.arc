"use client";

/**
 * PersonalNumberStep.tsx — Step 4
 *
 * PII step — isolated so the user understands the sensitivity.
 * 11-digit input with masking. Single "Lagre og fortsett" CTA.
 * Pattern: only digits allowed, max 11 chars.
 */

import { useState, useTransition } from "react";
import { ChevronLeft, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { savePersonalNumber } from "@/app/dashboard/_actions/welcome-wizard-actions";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

export function PersonalNumberStep({ onNext, onBack }: Props) {
  const [personalNumber, setPersonalNumber] = useState("");
  const [isPending, startTransition] = useTransition();

  const canProceed = personalNumber.replace(/\s/g, "").length === 11;

  function handleNext() {
    if (!canProceed) return;
    startTransition(async () => {
      const result = await savePersonalNumber({
        personalNumber: personalNumber.replace(/\s/g, ""),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Noe gikk galt. Prøv igjen.");
        return;
      }
      onNext();
    });
  }

  function handleChange(raw: string) {
    // Only digits, max 11
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    setPersonalNumber(digits);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h2 className="font-heading text-foreground text-2xl">Personnummer</h2>
        <p className="text-muted-foreground text-sm">Brukes til lønn og A-melding.</p>
      </div>

      {/* PII notice */}
      <div className="border-border bg-muted/30 flex items-start gap-3 rounded-xl border p-3.5">
        <Lock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Personnummeret ditt lagres kryptert og brukes kun til lønnsbehandling og offentlig
          rapportering (A-melding). Det deles aldri med uvedkommende.
        </p>
      </div>

      {/* Input */}
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="ww-pnr"
          className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          Personnummer (11 siffer)
        </Label>
        <Input
          id="ww-pnr"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={11}
          placeholder="***********"
          value={personalNumber}
          onChange={(e) => handleChange(e.target.value)}
          className="border-border bg-muted/40 focus-visible:ring-foreground/20 font-mono tracking-widest"
        />
        <p className="text-muted-foreground text-right text-xs">{personalNumber.length}/11</p>
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={isPending}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Tilbake
        </Button>
        <Button
          size="default"
          onClick={handleNext}
          disabled={!canProceed || isPending}
          className="bg-foreground text-background hover:bg-foreground/90 min-w-[140px] disabled:opacity-40"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lagre og fortsett"}
        </Button>
      </div>
    </div>
  );
}
