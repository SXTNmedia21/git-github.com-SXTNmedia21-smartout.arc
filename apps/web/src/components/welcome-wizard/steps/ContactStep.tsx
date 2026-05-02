"use client";

/**
 * ContactStep.tsx — Step 2
 *
 * Collect: Fornavn, Etternavn, Telefonnummer.
 * Email is pre-filled from auth (readonly + "Verifisert" badge).
 * "Neste" disabled until all 3 typeable fields are filled.
 */

import { useState, useTransition } from "react";
import { CheckCircle, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveContact } from "@/app/dashboard/_actions/welcome-wizard-actions";

type Props = {
  userEmail: string;
  onNext: () => void;
  onBack: () => void;
};

export function ContactStep({ userEmail, onNext, onBack }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();

  const canProceed =
    firstName.trim().length > 0 && lastName.trim().length > 0 && phone.trim().length >= 8;

  function handleNext() {
    if (!canProceed) return;
    startTransition(async () => {
      const result = await saveContact({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Noe gikk galt. Prøv igjen.");
        return;
      }
      onNext();
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h2 className="font-heading text-foreground text-2xl">Hvem er du?</h2>
        <p className="text-muted-foreground text-sm">Grunnleggende kontaktinformasjon.</p>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="ww-first-name"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              Fornavn
            </Label>
            <Input
              id="ww-first-name"
              type="text"
              autoComplete="given-name"
              placeholder="Kari"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="border-border bg-muted/40 focus-visible:ring-foreground/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="ww-last-name"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              Etternavn
            </Label>
            <Input
              id="ww-last-name"
              type="text"
              autoComplete="family-name"
              placeholder="Nordmann"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="border-border bg-muted/40 focus-visible:ring-foreground/20"
            />
          </div>
        </div>

        {/* Phone */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="ww-phone"
            className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          >
            Telefonnummer
          </Label>
          <Input
            id="ww-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+47 000 00 000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border-border bg-muted/40 focus-visible:ring-foreground/20"
          />
        </div>

        {/* Email — readonly */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="ww-email"
            className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          >
            E-post
          </Label>
          <div className="relative">
            <Input
              id="ww-email"
              type="email"
              value={userEmail}
              readOnly
              className="border-border/50 bg-muted/20 text-muted-foreground cursor-default pr-28"
            />
            <div className="absolute inset-y-0 right-2 flex items-center">
              <span className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-3 w-3" />
                Verifisert
              </span>
            </div>
          </div>
        </div>
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
          className="bg-foreground text-background hover:bg-foreground/90 min-w-[90px] disabled:opacity-40"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Neste"}
        </Button>
      </div>
    </div>
  );
}
