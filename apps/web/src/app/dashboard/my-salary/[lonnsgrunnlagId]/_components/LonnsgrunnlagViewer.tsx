/**
 * LonnsgrunnlagViewer — iframe-based PDF viewer for a single lønnsgrunnlag.
 *
 * Fetches a signed URL via useLonnsgrunnlagUrl() and renders the PDF in an
 * iframe. The signed URL is refreshed automatically ~10 minutes before expiry
 * (staleTime=50min covers 1h employee-issued URLs; 23h for 24h admin URLs).
 *
 * Security:
 *   - iframe sandbox: allow-same-origin + allow-popups (no scripts per spec).
 *   - The signed URL is fetched fresh from the BFF, never cached in localStorage.
 *   - eventId + profileId come from the server component (page.tsx) — not from
 *     client-side URL params — so they are session-validated before reach.
 *
 * ADR-0078: Høy-PII — viewer is web-only. No voice surface. (ADR-0133 mobile = Wave D)
 * ADR-0151: profileId resolved server-side in page.tsx, passed down as prop.
 * L-0177: signed-URL not-found → toast + user-visible error card (no silent fallback).
 * Nordic Split: CSS variables only. No hardcoded colours.
 *
 * L-0176 compliance: docstring written after body verified.
 */
"use client";

import type { JSX } from "react";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useLonnsgrunnlagUrl } from "@/app/dashboard/payroll/[periodId]/_hooks/use-payroll-lonnsgrunnlag";
import { Button } from "@/components/ui/button";

// ─── Props ────────────────────────────────────────────────────────────────────

type LonnsgrunnlagViewerProps = {
  /** ID of the export_event (= lonnsgrunnlagId from the route segment). */
  eventId: string;
  /**
   * Profile ID whose PDF to display. Passed from the server component after
   * server-side session validation — never from client URL params.
   * ADR-0151: identity is server-derived, not client-forged.
   */
  profileId: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LonnsgrunnlagViewer({ eventId, profileId }: LonnsgrunnlagViewerProps): JSX.Element {
  const { data, isLoading, isError, error } = useLonnsgrunnlagUrl(eventId, profileId, true);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center gap-3">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Henter lønnsgrunnlag…</p>
      </div>
    );
  }

  if (isError || !data?.signed_url) {
    return (
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center gap-3">
        <AlertCircle className="h-6 w-6 text-red-500" />
        <p className="text-foreground text-sm font-medium">Kunne ikke laste lønnsgrunnlag.</p>
        <p className="text-muted-foreground text-center text-xs">
          {error?.message ?? "URL er utilgjengelig eller utløpt — kontakt administrator."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[600px] flex-col gap-3">
      {/* Open in new tab for native PDF experience */}
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
          <a
            href={data.signed_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Åpne lønnsgrunnlag i ny fane"
          >
            <ExternalLink className="h-3 w-3" />
            Åpne i ny fane
          </a>
        </Button>
      </div>

      {/*
       * PDF viewer iframe.
       * sandbox="allow-same-origin allow-popups":
       *   - allow-same-origin: Supabase signed URL (same-origin storage bucket)
       *   - allow-popups: lets the native PDF viewer open print/save dialogs
       *   - scripts are intentionally NOT allowed per spec
       */}
      <iframe
        src={data.signed_url}
        title="Lønnsgrunnlag PDF"
        className="bg-muted border-border flex-1 rounded-lg border"
        style={{ minHeight: 560 }}
        sandbox="allow-same-origin allow-popups"
        aria-label="Lønnsgrunnlag PDF-visning"
      />

      <p className="text-muted-foreground text-center text-[10px]">
        Dette er et lønnsgrunnlag — ikke en lønnsslipp.
      </p>
    </div>
  );
}
