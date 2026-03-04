"use client";

import { CheckCircle2, XCircle, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type GatekeeperCondition = {
  id: string;
  label: string;
  met: boolean;
};

type GatekeeperStatusProps = {
  checklistComplete: boolean;
  imagesUploaded: boolean;
  ocrValidated: boolean;
  deviationsHandled: boolean;
  reconciliationReady: boolean;
};

export function GatekeeperStatus({
  checklistComplete,
  imagesUploaded,
  ocrValidated,
  deviationsHandled,
  reconciliationReady,
}: GatekeeperStatusProps) {
  const conditions: GatekeeperCondition[] = [
    {
      id: "checklist",
      label: "Stengesjekkliste fullført",
      met: checklistComplete,
    },
    {
      id: "images",
      label: "Oppgjørsbilder lastet opp (min. 2)",
      met: imagesUploaded,
    },
    {
      id: "ocr",
      label: "OCR validert eller manuelt bekreftet",
      met: ocrValidated,
    },
    {
      id: "deviations",
      label: "Kritiske avvik kommentert",
      met: deviationsHandled,
    },
    {
      id: "ready",
      label: "Avstemming klar for innsending",
      met: reconciliationReady,
    },
  ];

  const allMet = conditions.every((c) => c.met);
  const metCount = conditions.filter((c) => c.met).length;

  return (
    <Card
      className={cn(
        "transition-colors",
        allMet ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/20",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className={cn("h-5 w-5", allMet ? "text-emerald-500" : "text-destructive")} />
          <CardTitle className="text-base">
            {allMet ? "Utsjekking tillatt" : "Utsjekking blokkert"}
          </CardTitle>
          <span className="text-muted-foreground ml-auto text-xs">
            {metCount}/{conditions.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {conditions.map((condition) => (
          <div key={condition.id} className="flex items-center gap-2.5">
            {condition.met ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="text-destructive h-4 w-4 shrink-0" />
            )}
            <span
              className={cn(
                "text-sm",
                condition.met ? "text-muted-foreground" : "text-foreground font-medium",
              )}
            >
              {condition.label}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
