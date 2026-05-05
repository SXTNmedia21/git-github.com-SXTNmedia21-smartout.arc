"use client";

/**
 * AddressStep.tsx — Step 3
 *
 * Collect: Fødselsdato, Adresse, Postnummer, By.
 * All 4 fields required — "Neste" disabled until all are filled.
 * No postnummer auto-lookup (deferred per brief).
 */

import { useState, useTransition } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveAddress } from "@/app/dashboard/_actions/welcome-wizard-actions";

type Props = {
  onNext: () => void;
  onBack: () => void;
};

export function AddressStep({ onNext, onBack }: Props) {
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [isPending, startTransition] = useTransition();

  const canProceed =
    dateOfBirth.length > 0 &&
    addressLine1.trim().length > 0 &&
    postalCode.length === 4 &&
    city.trim().length > 0;

  function handleNext() {
    if (!canProceed) return;
    startTransition(async () => {
      const result = await saveAddress({
        dateOfBirth,
        addressLine1: addressLine1.trim(),
        postalCode,
        city: city.trim(),
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
        <h2 className="font-heading text-foreground text-2xl">Adresse og fødselsdato</h2>
        <p className="text-muted-foreground text-sm">Nødvendig for HR og lønn.</p>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-4">
        {/* Date of birth */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="ww-dob"
            className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          >
            Fødselsdato
          </Label>
          <Input
            id="ww-dob"
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="border-border bg-muted/40 focus-visible:ring-foreground/20"
          />
        </div>

        {/* Address */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="ww-address"
            className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          >
            Gate / Vei
          </Label>
          <Input
            id="ww-address"
            type="text"
            autoComplete="street-address"
            placeholder="Storgata 1"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            className="border-border bg-muted/40 focus-visible:ring-foreground/20"
          />
        </div>

        {/* Postal + City */}
        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label
              htmlFor="ww-postal"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              Postnr.
            </Label>
            <Input
              id="ww-postal"
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="0150"
              value={postalCode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPostalCode(v);
              }}
              className="border-border bg-muted/40 focus-visible:ring-foreground/20"
            />
          </div>
          <div className="col-span-3 flex flex-col gap-1.5">
            <Label
              htmlFor="ww-city"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
            >
              By
            </Label>
            <Input
              id="ww-city"
              type="text"
              autoComplete="address-level2"
              placeholder="Oslo"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="border-border bg-muted/40 focus-visible:ring-foreground/20"
            />
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
