"use client";

import { DollarSign, CreditCard, Banknote, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RevenueSectionProps = {
  revenueTotal: number | null;
  revenueCard: number | null;
  revenueCash: number | null;
  revenueVat: number | null;
  revenueTransactions: number | null;
  revenueSource: string | null;
  images: Array<{
    image_id: string;
    source_type: string;
    ocr_confidence: number | null;
    storage_path: string;
  }>;
};

function formatAmount(amount: number | null): string {
  if (amount === null) return "--";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
  }).format(amount);
}

export function RevenueSection({
  revenueTotal,
  revenueCard,
  revenueCash,
  revenueVat,
  revenueTransactions,
  revenueSource,
  images,
}: RevenueSectionProps) {
  return (
    <div className="space-y-4">
      {/* Revenue summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              Totalt
            </div>
            <p className="mt-1 text-lg font-bold">{formatAmount(revenueTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <CreditCard className="h-3.5 w-3.5" />
              Kort
            </div>
            <p className="mt-1 text-lg font-bold">{formatAmount(revenueCard)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Banknote className="h-3.5 w-3.5" />
              Kontant
            </div>
            <p className="mt-1 text-lg font-bold">{formatAmount(revenueCash)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Receipt className="h-3.5 w-3.5" />
              Trans.
            </div>
            <p className="mt-1 text-lg font-bold">{revenueTransactions ?? "--"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Source indicator */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Kilde:</span>
        <Badge variant="outline" className="text-xs">
          {revenueSource === "ocr" ? "OCR (automatisk)" : "Manuell"}
        </Badge>
        {revenueVat !== null && (
          <>
            <span className="text-muted-foreground text-xs">MVA:</span>
            <span className="text-xs font-medium">{formatAmount(revenueVat)}</span>
          </>
        )}
      </div>

      {/* Settlement images */}
      {images.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Oppgjørsbilder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img) => (
                <div
                  key={img.image_id}
                  className="group bg-muted relative aspect-[3/4] overflow-hidden rounded-lg border"
                >
                  <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                    {img.source_type.toUpperCase()}
                  </div>
                  {img.ocr_confidence !== null && (
                    <Badge variant="outline" className="absolute bottom-2 left-2 text-[10px]">
                      OCR: {Math.round(img.ocr_confidence * 100)}%
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
