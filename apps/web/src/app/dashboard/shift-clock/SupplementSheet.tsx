"use client";

/**
 * SupplementSheet — Side drawer for claiming manual wage supplements.
 *
 * Lists available supplement rules from useSupplements. Each supplement can be
 * claimed with an optional comment. Uses Zod validation from @smartout/shift-clock.
 * Already-claimed supplements are shown with a checkmark.
 */

import { useState } from "react";
import { Coins, Check, AlertCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { SupplementOption } from "@smartout/shift-clock";

type SupplementSheetProps = {
  availableSupplements: SupplementOption[];
  claimedSupplementRuleIds: Set<string>;
  onClaim: (supplementRuleId: string, comment?: string) => Promise<unknown>;
  isLoading?: boolean;
  claimedCount: number;
};

export function SupplementSheet({
  availableSupplements,
  claimedSupplementRuleIds,
  onClaim,
  isLoading,
  claimedCount,
}: SupplementSheetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedSupplement = availableSupplements.find((s) => s.id === selectedId);

  const handleClaim = async () => {
    if (!selectedId) return;

    try {
      await onClaim(selectedId, comment.trim() || undefined);
      setSelectedId(null);
      setComment("");
    } catch {
      // Error handled by hook (toast)
    }
  };

  const handleBack = () => {
    setSelectedId(null);
    setComment("");
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="border-border/50 bg-card/50 hover:bg-card/80 relative flex h-auto flex-col items-center gap-2 rounded-2xl px-4 py-4 backdrop-blur-sm transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <Coins className="h-5 w-5 text-emerald-400" />
          </div>
          <span className="text-muted-foreground text-xs">Tillegg</span>
          {claimedCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-brand-orange absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-[10px] text-white"
            >
              {claimedCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-heading text-lg">
            {selectedSupplement ? selectedSupplement.name : "Tillegg"}
          </SheetTitle>
          <SheetDescription>
            {selectedSupplement
              ? "Bekreft registrering av tillegget"
              : "Velg tillegget du vil registrere"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {/* Supplement list view */}
          {!selectedId && (
            <>
              {availableSupplements.length === 0 && (
                <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
                  <AlertCircle className="h-8 w-8 opacity-50" />
                  <p className="text-sm">Ingen tillegg tilgjengelig</p>
                </div>
              )}

              {availableSupplements.map((supplement) => {
                const isClaimed = claimedSupplementRuleIds.has(supplement.id);

                return (
                  <button
                    key={supplement.id}
                    type="button"
                    className="border-border/50 bg-card/50 hover:bg-card/80 flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-50"
                    onClick={() => !isClaimed && setSelectedId(supplement.id)}
                    disabled={isClaimed || isLoading}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground text-sm font-medium">
                          {supplement.name}
                        </span>
                        {isClaimed && <Check className="h-4 w-4 text-emerald-400" />}
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {supplement.description}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-foreground font-mono text-sm font-semibold">
                        {supplement.amount} kr
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {supplement.rateType === "per_hour" ? "/time" : "/vakt"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Confirmation view */}
          {selectedId && selectedSupplement && (
            <div className="space-y-4">
              <div className="border-border/50 bg-card/50 rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{selectedSupplement.name}</span>
                  <span className="font-mono text-sm font-semibold">
                    {selectedSupplement.amount} kr
                    {selectedSupplement.rateType === "per_hour" ? "/time" : "/vakt"}
                  </span>
                </div>
                {selectedSupplement.salaryCode && (
                  <span className="text-muted-foreground mt-1 block text-xs">
                    Lonnart: {selectedSupplement.salaryCode}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="supplement-comment" className="text-muted-foreground text-sm">
                  Kommentar {selectedSupplement.commentRequired && "(obligatorisk)"}
                </label>
                <Textarea
                  id="supplement-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Beskriv kort hvorfor..."
                  className="border-border/50 bg-card/50 min-h-[80px]"
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleBack}
                  disabled={isLoading}
                >
                  Tilbake
                </Button>
                <Button
                  className="bg-brand-orange hover:bg-brand-orange-light flex-1 text-white"
                  onClick={() => void handleClaim()}
                  disabled={isLoading || (selectedSupplement.commentRequired && !comment.trim())}
                >
                  Registrer tillegg
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
