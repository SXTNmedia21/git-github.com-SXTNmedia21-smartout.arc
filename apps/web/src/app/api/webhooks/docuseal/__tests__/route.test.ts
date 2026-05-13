/**
 * Tests for POST /api/webhooks/docuseal — F-WH-01 regression guard
 *
 * Key contract: when the Supabase contract update fails, the handler MUST return
 * 500 with body `{ error: "internal" }` — never the raw Postgres error message.
 *
 * 4 test cases:
 *   a. DB error → 500 body has { error: "internal" } (F-WH-01 guard)
 *   b. DB error → raw PG message NOT present in response body
 *   c. Happy path (DB ok) → 200 with received: true
 *   d. Missing signature → 401 (existing auth contract preserved)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

// ─── Hoist mocks ──────────────────────────────────────────────────────────────
const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

const { emitMock, nonEmptyMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
  nonEmptyMock: vi.fn((v: string) => v),
}));

vi.mock("@smartout/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@smartout/telemetry", () => ({
  emit: emitMock,
  nonEmpty: nonEmptyMock,
}));

// Mock env — provides DOCUSEAL_WEBHOOK_SECRET
vi.mock("@/env", () => ({
  env: {
    DOCUSEAL_WEBHOOK_SECRET: "test-secret-abc123",
  },
}));

import { POST } from "../route";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const WEBHOOK_SECRET = "test-secret-abc123";

/** Build a signed POST request with the given payload */
function makeSignedRequest(payload: unknown) {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  return new Request("http://localhost/api/webhooks/docuseal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-docuseal-signature": sig,
    },
    body,
  });
}

const SUBMISSION_ID = 12345;
const CONTRACT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const WORKSPACE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** A minimal valid DocuSeal "form.declined" payload — no DB side-effects beyond update */
const DECLINED_PAYLOAD = {
  event_type: "form.declined",
  timestamp: new Date().toISOString(),
  data: {
    id: 1,
    submission_id: SUBMISSION_ID,
    status: "declined",
    declined_at: new Date().toISOString(),
    decline_reason: "Test decline",
  },
};

/** Build a chainable Supabase admin mock with configurable from() responses */
function makeAdminMock({
  findResult,
  updateResult,
}: {
  findResult?: { data: unknown; error: unknown };
  updateResult?: { error: unknown };
}) {
  // Resolved value for the contract update — route does: .update(u).eq("contract_id", id)
  // That's a single .eq() at the end, which must be a Promise.
  const contractFindData = findResult ?? {
    data: {
      contract_id: CONTRACT_ID,
      status: "sent",
      workspace_id: WORKSPACE_ID,
      contract_type: "saas",
    },
    error: null,
  };
  const contractUpdateOutcome = updateResult ?? { error: null };

  // Shared no-op eq chain for other tables (update/insert chains that we don't assert on)
  const noopEq = vi.fn().mockResolvedValue({ error: null, data: null });
  const noopEqChain: Record<string, unknown> = {};
  noopEqChain.eq = vi.fn().mockReturnValue(noopEqChain);
  noopEqChain.is = vi.fn().mockReturnValue(noopEqChain);
  noopEqChain.eq = vi.fn().mockResolvedValue({ error: null });

  const fromFn = vi.fn((table: string) => {
    if (table === "contract") {
      return {
        // .select().eq("docuseal_submission_id", ...).single()
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(contractFindData),
          }),
        }),
        // .update(updates).eq("contract_id", id) — single eq, resolves directly
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(contractUpdateOutcome),
        }),
      };
    }

    if (table === "contract_reminder") {
      // .update({}).eq("contract_id", id).eq("status", "scheduled")
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
    }

    if (table === "workspace") {
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }

    // All other tables (contract_event, platform_audit_log, engine_event)
    return {
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
  });

  return { from: fromFn, rpc: vi.fn().mockResolvedValue({ error: null }) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("POST /api/webhooks/docuseal — F-WH-01 error leak guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── (a) DB error → 500 body is { error: "internal" } ──────────────────────
  it("(a) DB update error returns 500 with body { error: 'internal' } — not raw PG message", async () => {
    const PG_ERROR_MESSAGE = "duplicate key value violates unique constraint _contract_pkey";

    createAdminClientMock.mockReturnValue(
      makeAdminMock({ updateResult: { error: { message: PG_ERROR_MESSAGE } } }),
    );

    const req = makeSignedRequest(DECLINED_PAYLOAD);
    const res = await POST(req as never);

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("internal");
  });

  // ── (b) Raw PG message must NOT be in response body ───────────────────────
  it("(b) DB error response body does NOT contain the raw Postgres error string", async () => {
    const PG_ERROR_MESSAGE = "syntax error at or near SELECT";

    createAdminClientMock.mockReturnValue(
      makeAdminMock({ updateResult: { error: { message: PG_ERROR_MESSAGE } } }),
    );

    const req = makeSignedRequest(DECLINED_PAYLOAD);
    const res = await POST(req as never);

    const body = await res.text();
    expect(body).not.toContain(PG_ERROR_MESSAGE);
    expect(body).not.toContain("syntax error");
    expect(body).not.toContain("constraint");
  });

  // ── (c) Happy path — DB ok → 200 ─────────────────────────────────────────
  it("(c) DB update succeeds → 200 with received: true", async () => {
    createAdminClientMock.mockReturnValue(makeAdminMock({}));

    const req = makeSignedRequest(DECLINED_PAYLOAD);
    const res = await POST(req as never);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { received: boolean };
    expect(body.received).toBe(true);
  });

  // ── (d) Missing signature → 401 (auth contract preserved) ─────────────────
  it("(d) missing x-docuseal-signature header → 401", async () => {
    const req = new Request("http://localhost/api/webhooks/docuseal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(DECLINED_PAYLOAD),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });
});
