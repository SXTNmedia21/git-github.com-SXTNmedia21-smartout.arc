"use client";

/**
 * PersonalNumberStep.tsx — Step 4
 *
 * PII step — isolated so the user understands the sensitivity.
 * Two-phase flow: input → confirm (R8 council directive).
 * Phase 1: 11-digit input with reveal toggle (default visible per D4/R8).
 * Phase 2: confirmation screen — re-shows value masked by default, requires
 *   explicit confirm before the Server Action fires.
 * Mod-11 checksum validation is server-side; client only checks 11 digits.
 */

import * as React from "react";
import { useTransition } from "react";
import { ChevronLeft, Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { savePersonalNumber } from "@/app/dashboard/_actions/welcome-wizard-actions";

type Phase = "input" | "confirm";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

export function PersonalNumberStep({ onNext, onBack }: Props) {
  const [phase, setPhase] = React.useState<Phase>("input");
  const [personalNumber, setPersonalNumber] = React.useState("");
  // D4 / R8 directive: default visible (was masked — changed from type="password")
  const [reveal, setReveal] = React.useState(true);
  const [isPending, startTransition] = useTransition();

  const canProceed = personalNumber.length === 11;

  function handleChange(raw: string) {
    // Only digits, max 11
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    setPersonalNumber(digits);
  }

  function goConfirm() {
    if (canProceed) {
      // Reset reveal to masked on confirm screen so user consciously reveals
      setReveal(false);
      setPhase("confirm");
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = await savePersonalNumber({
        personalNumber,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Noe gikk galt. Prøv igjen.");
        setPhase("input");
        return;
      }
      onNext();
    });
  }

  // ─── Confirm phase ────────────────────────────────────────────────────────

  if (phase === "confirm") {
    return (
      <div role="dialog" aria-labelledby="pii-confirm-h2" className="flex flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <h2 id="pii-confirm-h2" className="font-heading text-foreground text-2xl">
            Bekreft personnummer
          </h2>
          <p className="text-muted-foreground text-sm">
            Sjekk at nummeret er riktig før du lagrer. Du kan endre det senere i Min Tid.
          </p>
        </div>

        {/* Masked display with reveal toggle */}
        <div className="border-border bg-card flex items-center justify-between rounded-xl border p-4">
          <code className="font-mono text-2xl tracking-widest">
            {reveal ? personalNumber : "•".repeat(11)}
          </code>
          <Button
            variant="ghost"
            size="icon"
            aria-label={reveal ? "Skjul personnummer" : "Vis personnummer"}
            onClick={() => setReveal((r) => !r)}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>

        {/* Actions */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPhase("input")}
            disabled={isPending}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Tilbake
          </Button>
          <Button
            size="default"
            onClick={handleSave}
            disabled={isPending}
            autoFocus
            className="bg-foreground text-background hover:bg-foreground/90 min-w-[160px] disabled:opacity-40"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Lagrer…
              </>
            ) : (
              "Bekreft og lagre"
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Input phase ──────────────────────────────────────────────────────────

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

      {/* Input with reveal toggle */}
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="ww-pnr"
          className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
        >
          Personnummer (11 siffer)
        </Label>
        <div className="relative">
          <Input
            id="ww-pnr"
            type={reveal ? "text" : "password"}
            inputMode="numeric"
            autoComplete="off"
            maxLength={11}
            placeholder={reveal ? "12345678901" : "***********"}
            value={personalNumber}
            onChange={(e) => handleChange(e.target.value)}
            className="border-border bg-muted/40 focus-visible:ring-foreground/20 pr-10 font-mono tracking-widest"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={reveal ? "Skjul personnummer" : "Vis personnummer"}
            onClick={() => setReveal((r) => !r)}
            className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
            tabIndex={-1}
          >
            {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
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
          onClick={goConfirm}
          disabled={!canProceed || isPending}
          className="bg-foreground text-background hover:bg-foreground/90 min-w-[140px] disabled:opacity-40"
        >
          Neste
        </Button>
      </div>
    </div>
  );
}
