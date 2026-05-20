"use client";

/**
 * HeroStep.tsx — Step 1
 *
 * Emotion-first hero screen. No fields. Just brand + warmth.
 * Instrument Serif heading, warm body copy, single CTA.
 */

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onNext: () => void;
};

export function HeroStep({ onNext }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-4 text-center">
      {/* Brand mark */}
      <div className="from-brand-orange-light to-brand-orange-dark flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg">
        <Sparkles className="h-8 w-8 text-white" strokeWidth={1.5} />
      </div>

      {/* Heading */}
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-foreground text-4xl leading-tight tracking-tight">
          Velkommen til Smartout!
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          La oss få deg i gang.{" "}
          <span className="text-foreground">Vi trenger noen opplysninger først.</span>
        </p>
      </div>

      {/* Warm divider */}
      <div className="via-border h-px w-16 rounded bg-gradient-to-r from-transparent to-transparent" />

      {/* CTA */}
      <Button
        size="lg"
        onClick={onNext}
        className="bg-foreground text-background hover:bg-foreground/90 w-full max-w-[220px]"
      >
        Kom i gang
        <span className="ml-1 opacity-60">→</span>
      </Button>
    </div>
  );
}
