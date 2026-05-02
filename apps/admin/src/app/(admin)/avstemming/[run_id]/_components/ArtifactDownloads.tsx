"use client";

/**
 * ArtifactDownloads.tsx — 4 download cards for settlement artifacts.
 *
 * Each card triggers a GET to /api/avstemming/[run_id]/artifact/[type]
 * which returns a 302 redirect to a signed Supabase Storage URL.
 * Emits "settlement artifact_downloaded" telemetry indirectly via the API route.
 *
 * Client component — uses window.open for a tab-friendly download experience.
 * Nordic Split: CSS vars only.
 */

import { FileText, TableProperties, FileStack, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SettlementArtifactRow } from "@/lib/avstemming/fetchers";

type ArtifactMeta = {
  type: string;
  label: string;
  description: string;
  icon: React.ElementType;
  ext: string;
};

const ARTIFACT_META: ArtifactMeta[] = [
  {
    type: "summary_pdf",
    label: "Sammendrag",
    description: "Oversikt per workspace + totaler + avvik",
    icon: FileText,
    ext: "PDF",
  },
  {
    type: "detail_csv",
    label: "Detalj-linjer",
    description: "Tripletex / Fiken / Visma-klar CSV med alle ordrelinjer",
    icon: TableProperties,
    ext: "CSV",
  },
  {
    type: "invoice_bundle_pdf",
    label: "Faktura-bunke",
    description: "Alle grunnfakturaer for perioden samlet i én PDF",
    icon: FileStack,
    ext: "PDF",
  },
  {
    type: "discrepancy_pdf",
    label: "Avvik-liste",
    description: "Forfalte ordre, partial betalinger og mangler som krever handling",
    icon: AlertTriangle,
    ext: "PDF",
  },
];

type Props = {
  runId: string;
  artifacts: SettlementArtifactRow[];
};

export function ArtifactDownloads({ runId, artifacts }: Props) {
  const availableTypes = new Set(artifacts.map((a) => a.artifact_type));

  function handleDownload(type: string) {
    // Open in new tab — the API route returns 302 to signed URL.
    window.open(`/api/avstemming/${runId}/artifact/${type}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ARTIFACT_META.map(({ type, label, description, icon: Icon, ext }) => {
        const available = availableTypes.has(type);
        return (
          <Card
            key={type}
            className={`border-border bg-card transition-opacity ${!available ? "opacity-50" : ""}`}
          >
            <CardContent className="flex items-start gap-3 pt-4 pb-4">
              <div className="bg-muted flex-shrink-0 rounded-md p-2">
                <Icon className="text-muted-foreground h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-foreground text-sm font-medium">{label}</span>
                  <span className="text-muted-foreground text-xs">{ext}</span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!available}
                onClick={() => handleDownload(type)}
                className="flex-shrink-0"
              >
                Last ned
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
