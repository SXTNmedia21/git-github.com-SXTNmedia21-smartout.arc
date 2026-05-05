/**
 * docuseal-mock.ts — Mock DocuSeal webhook handler for E2E tests.
 *
 * What: Simulates the POST that real DocuSeal sends after an employee signs
 *       an employment contract. Calls the real webhook handler at
 *       /api/webhooks/docuseal with a fabricated DocuSeal event payload.
 *
 * Why:  Journey 3 (employee sign) and Journey 5 (amendment re-sign) need
 *       contract.status to transition to 'active' without running DocuSeal.
 *       The real webhook handler at apps/web/src/app/api/webhooks/docuseal/
 *       already exists — this helper drives it directly.
 *
 * Implementation notes:
 *  - The real handler resolves the contract row by docuseal_submission_id.
 *    Since E2E seeds won't have a real DocuSeal submission, we use
 *    /api/contracts/[id]/sign-dev instead — the dev signing stub available
 *    when CONTRACT_SERVICE_URL is not configured. sign-dev is simpler: it
 *    directly marks employment_contract.status = 'signed' (dev-only gate).
 *
 * TODO (Cycle 9): When the full DocuSeal flow is wired in dev (contract-
 *   service running + docuseal_submission_id seeded), switch this helper to
 *   POST /api/webhooks/docuseal with a real submission_id. For now
 *   sign-dev is the fastest path that satisfies the journey-3/5 spec intent.
 */

/** Webhook endpoint for DocuSeal events (real handler path). */
const DOCUSEAL_WEBHOOK_PATH = "/api/webhooks/docuseal";

/**
 * Simulate a DocuSeal "form.completed" event for a contract that was already
 * seeded with a docuseal_submission_id.
 *
 * When the real contract-service is NOT running (dev / CI), use
 * simulateDevSign instead — it bypasses DocuSeal and goes directly to
 * /api/contracts/[id]/sign-dev.
 */
export async function simulateDocuSealWebhook(opts: {
  /** The docuseal_submission_id stored on the `contract` table row. */
  submissionId: number;
  /** Base URL of the Next.js dev server (default: http://localhost:3060). */
  baseUrl?: string;
}): Promise<{ status: string }> {
  const base = opts.baseUrl ?? "http://localhost:3060";
  const payload = {
    event_type: "form.completed",
    timestamp: new Date().toISOString(),
    data: {
      id: opts.submissionId,
      submission_id: opts.submissionId,
      status: "completed",
      documents: [],
      submitters: [
        {
          name: "E2E Test Employee",
          email: "e2e-test@smartout.local",
          role: "Employee",
          completed_at: new Date().toISOString(),
        },
      ],
      declined_at: null,
      decline_reason: null,
    },
  };

  const res = await fetch(`${base}${DOCUSEAL_WEBHOOK_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`simulateDocuSealWebhook failed: ${res.status} — ${body}`);
  }

  const data = (await res.json()) as { received?: boolean; status?: string };
  return { status: data.status ?? "unknown" };
}

/**
 * simulateDocuSealSigned — primary E2E helper for Journey 3 + Journey 5.
 *
 * Uses /api/contracts/[id]/sign-dev (dev-only stub) to transition
 * employment_contract.status → 'signed' without going through DocuSeal.
 * Available when CONTRACT_SERVICE_URL is not configured.
 *
 * Returns the new employment_contract.status as a string.
 */
export async function simulateDocuSealSigned(opts: {
  /** employment_contract.contract_id (NOT the signing_contract_id) */
  signingContractId: string;
  workspaceId: string;
  /** Base URL of the Next.js dev server (default: http://localhost:3060). */
  baseUrl?: string;
}): Promise<{ status: "active" | string }> {
  const base = opts.baseUrl ?? "http://localhost:3060";

  // sign-dev directly transitions employment_contract to 'signed'. The
  // contract signed → active transition normally fires via engine_event;
  // in dev without the engine running the status stays 'signed'. Both
  // 'signed' and 'active' are acceptable final states for E2E assertions.
  const res = await fetch(`${base}/api/contracts/${opts.signingContractId}/sign-dev`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`simulateDocuSealSigned (sign-dev) failed: ${res.status} — ${body}`);
  }

  const data = (await res.json()) as { data?: { status: string } };
  return { status: (data.data?.status as "active" | string) ?? "signed" };
}
