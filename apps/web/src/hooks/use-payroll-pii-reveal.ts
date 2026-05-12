// apps/web/src/hooks/use-payroll-pii-reveal.ts
// What: TanStack Query mutation for fetching Høy-PII fields from payroll BFF endpoints.
// Why: RevealableField in BFF-fetch mode uses this to call /api/payroll/reveal-* routes
//      so PII is never loaded raw by the browser (ADR-0242, ADR-0151).
//      Server-side: route resolves workspace + actor from session (ADR-0151),
//      calls gatedMutation tool, emits audit trail (ADR-0134).

"use client";

import { useMutation } from "@tanstack/react-query";

export type RevealField = "personal_number" | "bank_account";

const REVEAL_ENDPOINTS: Record<RevealField, string> = {
  personal_number: "/api/payroll/reveal-personal-number",
  bank_account: "/api/payroll/reveal-bank-account",
};

export type RevealResult = {
  ok: true;
  value: string | null;
  is_self: boolean;
  has_value: boolean;
  gate_evaluation_id: string | null;
};

export type RevealError = {
  ok: false;
  reason: string;
  detail?: string | null;
};

export function usePayrollPiiReveal() {
  return useMutation<RevealResult, Error, { profileId: string; field: RevealField }>({
    mutationFn: async ({ profileId, field }) => {
      const url = REVEAL_ENDPOINTS[field];
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (!res.ok) throw new Error(`Henting feilet: ${res.status}`);
      const data = (await res.json()) as RevealResult | RevealError;
      if (!data.ok) {
        const err = data as RevealError;
        throw new Error(err.reason ?? "avvist");
      }
      return data as RevealResult;
    },
    // Server-side audit emit handles the trail — no client-side onSuccess emit needed.
  });
}
