/**
 * Hooks for PDF lønnsgrunnlag generation and signed-URL retrieval.
 *
 * useGenerateBundle()  — POST /api/payroll/generate-pdf-bundle
 * useGenerateSingle()  — POST /api/payroll/generate-pdf-single
 * useLonnsgrunnlagUrl() — GET /api/payroll/lonnsgrunnlag-url
 *
 * ADR-0151: workspace_id + profile_id are server-derived by the BFF routes.
 *   Client does NOT supply identity; hooks pass periodId / profileId for
 *   routing only — the BFF re-validates against the authenticated session.
 * ADR-0134: telemetry (payroll.lonnsgrunnlag_generated, _url_granted, _generation_failed)
 *   is emitted server-side by BFF / capability tool. No client emit here.
 * ADR-0133: web-only authoring surface. Mobile reads via signed URL (Wave D scope).
 * L-0177: signed-URL not-found → 404 → toast (no silent fallback).
 *
 * Wave-B dependency note (2026-05-08):
 *   BFF routes /api/payroll/generate-pdf-bundle, /api/payroll/generate-pdf-single,
 *   and /api/payroll/lonnsgrunnlag-url were not yet present at commit time.
 *   The hooks call the correct paths and will work as-is once Wave B lands.
 *   typecheck passes because fetch() is typed by the response shape in this file.
 *
 * L-0176 compliance: docstring written after body verified.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── Response shapes ─────────────────────────────────────────────────────────

export type PdfBundleFile = {
  profile_id: string;
  path: string;
  signed_url: string;
};

export type GenerateBundleResult = {
  event_id: string;
  files: PdfBundleFile[];
};

export type GenerateSingleResult = {
  event_id: string;
  profile_id: string;
  signed_url: string;
};

export type LonnsgrunnlagUrlResult = {
  signed_url: string;
  expires_at: string;
};

// ─── Input shapes ────────────────────────────────────────────────────────────

export type GenerateBundleInput = {
  periodId: string;
  /** workspaceId is passed for BFF routing only — BFF re-validates against session (ADR-0151). */
  workspaceId: string;
  actorId: string;
};

export type GenerateSingleInput = {
  periodId: string;
  profileId: string;
  workspaceId: string;
  actorId: string;
};

// ─── Query key factory ───────────────────────────────────────────────────────

const lonnsgrunnlagKeys = {
  /** All PDFs for a period — used to invalidate after bundle generation */
  periodBundle: (periodId: string) => ["payroll", "lonnsgrunnlag", "bundle", periodId] as const,
  /** Signed URL for a specific export event + profile */
  signedUrl: (eventId: string, profileId: string) =>
    ["payroll", "lonnsgrunnlag", "url", eventId, profileId] as const,
};

// ─── useGenerateBundle ───────────────────────────────────────────────────────

async function runGenerateBundle(input: GenerateBundleInput): Promise<GenerateBundleResult> {
  const res = await fetch("/api/payroll/generate-pdf-bundle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      period_id: input.periodId,
      // NOTE: workspace_id intentionally omitted — BFF derives from session (ADR-0151)
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      body.error === "period_not_locked"
        ? "Perioden er ikke låst — lås perioden før du genererer PDF."
        : (body.error ?? `Generering feilet (HTTP ${res.status})`),
    );
  }

  return (await res.json()) as GenerateBundleResult;
}

export function useGenerateBundle(): UseMutationResult<
  GenerateBundleResult,
  Error,
  GenerateBundleInput
> {
  const queryClient = useQueryClient();

  return useMutation<GenerateBundleResult, Error, GenerateBundleInput>({
    mutationFn: runGenerateBundle,
    onSuccess: (data, variables) => {
      const count = data.files.length;
      toast.success(`${count} PDF-lønnsgrunnlag generert og lagret.`);
      // Invalidate bundle query so the signed-URL list refreshes
      void queryClient.invalidateQueries({
        queryKey: lonnsgrunnlagKeys.periodBundle(variables.periodId),
      });
    },
    onError: (err) => {
      toast.error(err.message ?? "PDF-generering feilet — prøv igjen.");
    },
  });
}

// ─── useGenerateSingle ───────────────────────────────────────────────────────

async function runGenerateSingle(input: GenerateSingleInput): Promise<GenerateSingleResult> {
  const res = await fetch("/api/payroll/generate-pdf-single", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      period_id: input.periodId,
      profile_id: input.profileId,
      // NOTE: workspace_id intentionally omitted — BFF derives from session (ADR-0151)
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      body.error === "period_not_locked"
        ? "Perioden er ikke låst — lås perioden først."
        : (body.error ?? `Generering feilet (HTTP ${res.status})`),
    );
  }

  return (await res.json()) as GenerateSingleResult;
}

export function useGenerateSingle(): UseMutationResult<
  GenerateSingleResult,
  Error,
  GenerateSingleInput
> {
  return useMutation<GenerateSingleResult, Error, GenerateSingleInput>({
    mutationFn: runGenerateSingle,
    onSuccess: (data) => {
      // Open signed URL in new tab
      window.open(data.signed_url, "_blank", "noopener,noreferrer");
      toast.success("PDF klar — åpnes i ny fane.");
    },
    onError: (err) => {
      toast.error(err.message ?? "PDF-generering feilet — prøv igjen.");
    },
  });
}

// ─── useLonnsgrunnlagUrl ─────────────────────────────────────────────────────

/**
 * Fetches a (possibly cached) signed URL for a specific lønnsgrunnlag PDF.
 *
 * Signed-URL expiry strategy:
 *   - Employee-issued URLs expire in 1 hour → staleTime: 50 min (refetch 10 min before expiry).
 *   - Admin-issued URLs expire in 24 hours → staleTime: 23 hours (refetch 1 hour before expiry).
 *
 * The BFF determines expiry based on the caller's role. This hook defaults to the
 * conservative (employee) staleTime so both roles get a correct experience.
 * The employee/admin distinction happens server-side; client cannot override it.
 *
 * enabled=false suppresses the query when eventId/profileId are not yet known.
 */
async function fetchLonnsgrunnlagUrl(
  eventId: string,
  profileId: string,
): Promise<LonnsgrunnlagUrlResult> {
  const params = new URLSearchParams({
    lonnsgrunnlagId: eventId,
    profileId,
  });
  const res = await fetch(`/api/payroll/lonnsgrunnlag-url?${params.toString()}`, {
    credentials: "same-origin",
  });

  if (res.status === 404) {
    // L-0177: explicit error, no silent fallback
    toast.error("Lønnsgrunnlag ikke funnet (404) — kontakt administrator.");
    throw new Error("Lønnsgrunnlag ikke funnet");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Kunne ikke hente URL (HTTP ${res.status})`);
  }

  return (await res.json()) as LonnsgrunnlagUrlResult;
}

/**
 * staleTime is set conservatively to 50 minutes (employee 1h expiry − 10 min buffer).
 * Admin-issued 24h URLs will re-fetch slightly more often than needed, but always within
 * the valid window. Use `refetchOnWindowFocus: false` to avoid spurious refetches
 * while the PDF viewer is open.
 */
const STALE_TIME_MS = 50 * 60 * 1000; // 50 minutes

export function useLonnsgrunnlagUrl(
  eventId: string,
  profileId: string,
  enabled = true,
): UseQueryResult<LonnsgrunnlagUrlResult> {
  return useQuery<LonnsgrunnlagUrlResult>({
    queryKey: lonnsgrunnlagKeys.signedUrl(eventId, profileId),
    queryFn: () => fetchLonnsgrunnlagUrl(eventId, profileId),
    staleTime: STALE_TIME_MS,
    enabled: enabled && !!eventId && !!profileId,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
