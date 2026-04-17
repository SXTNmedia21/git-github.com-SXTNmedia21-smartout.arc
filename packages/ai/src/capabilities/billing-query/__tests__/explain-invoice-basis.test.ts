import { describe, test, expect, vi } from "vitest";
import { explainInvoiceBasis } from "../tools";
import type { AgentToolContext } from "../../types";

// Phase 13.7 — vitest coverage for the explain_invoice_basis tool.
// Exercises the three refusal paths the tool's description promises:
//
//   1. Channel guard — anything other than 'chat' → hard-refuse.
//   2. Cross-company scope — invoice belongs to another company →
//      refuse without leaking the invoice.
//   3. Draft status — invoice has no final basis yet → informative
//      refusal, no RPC call.
//
// Plus the happy path: scoped invoice + non-draft status → calls
// supabase.rpc('get_invoice_basis', ...) and returns its payload
// verbatim (never computes).

const OWN_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-2222-2222-222222222222";
const INVOICE_ID = "33333333-3333-3333-3333-333333333333";

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  // A thin Supabase-like mock — only the methods actually invoked by
  // the tool are implemented. Tests override via mockResolvedValueOnce.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAdmin: any = {
    from: vi.fn(() => supabaseAdmin),
    select: vi.fn(() => supabaseAdmin),
    eq: vi.fn(() => supabaseAdmin),
    // resolveCompanyId uses .single(); the tool's own lookups use
    // .maybeSingle(). Both must be on the mock chain.
    single: vi.fn(),
    maybeSingle: vi.fn(),
    rpc: vi.fn(),
  };
  return {
    workspaceId: "ws-1",
    profileId: "profile-1",
    sessionId: "session-1",
    supabaseAdmin,
    channel: "chat",
    ...overrides,
  } as AgentToolContext;
}

describe("explain_invoice_basis tool", () => {
  test("refuses voice channel", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await explainInvoiceBasis.execute({ invoice_id: INVOICE_ID }, ctx);
    expect(String(result)).toMatch(/chat-only/i);
    // Never hit the DB for a rejected channel
    expect((ctx.supabaseAdmin as { from: unknown }).from).not.toHaveBeenCalled();
  });

  test("refuses autonomous channel", async () => {
    const ctx = makeCtx({ channel: "autonomous" });
    const result = await explainInvoiceBasis.execute({ invoice_id: INVOICE_ID }, ctx);
    expect(String(result)).toMatch(/chat-only/i);
  });

  test("refuses telegram channel", async () => {
    const ctx = makeCtx({ channel: "telegram" });
    const result = await explainInvoiceBasis.execute({ invoice_id: INVOICE_ID }, ctx);
    expect(String(result)).toMatch(/chat-only/i);
  });

  test("refuses invoice belonging to another company", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    // resolveCompanyId uses .single(); tool scope lookup uses .maybeSingle().
    admin.single.mockResolvedValueOnce({
      data: { company_id: OWN_COMPANY_ID },
      error: null,
    });
    admin.maybeSingle.mockResolvedValueOnce({
      data: {
        invoice_id: INVOICE_ID,
        company_id: OTHER_COMPANY_ID,
        status: "issued",
      },
      error: null,
    });

    const result = await explainInvoiceBasis.execute({ invoice_id: INVOICE_ID }, ctx);
    expect(String(result)).toMatch(/does not belong to your company/i);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  test("refuses draft status without hitting RPC", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    admin.single.mockResolvedValueOnce({
      data: { company_id: OWN_COMPANY_ID },
      error: null,
    });
    admin.maybeSingle.mockResolvedValueOnce({
      data: {
        invoice_id: INVOICE_ID,
        company_id: OWN_COMPANY_ID,
        status: "draft",
      },
      error: null,
    });

    const result = await explainInvoiceBasis.execute({ invoice_id: INVOICE_ID }, ctx);
    expect(String(result)).toMatch(/draft/i);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  test("happy path returns stringified RPC payload verbatim", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    const rpcPayload = {
      invoice_id: INVOICE_ID,
      amount_incl_vat: 125.0,
      line_items: [{ line_type: "base_plan", amount_incl_vat: 125 }],
      usage_snapshots: [{ workspace_id: "ws-1", billable_users: 3 }],
      pricing_terms_at_issue: { monthly_cost: 100, free_users: 5 },
    };

    admin.single.mockResolvedValueOnce({
      data: { company_id: OWN_COMPANY_ID },
      error: null,
    });
    admin.maybeSingle.mockResolvedValueOnce({
      data: {
        invoice_id: INVOICE_ID,
        company_id: OWN_COMPANY_ID,
        status: "issued",
      },
      error: null,
    });

    admin.rpc.mockResolvedValueOnce({ data: rpcPayload, error: null });

    const result = await explainInvoiceBasis.execute({ invoice_id: INVOICE_ID }, ctx);
    const parsed = JSON.parse(String(result));
    expect(parsed).toEqual(rpcPayload);
    expect(admin.rpc).toHaveBeenCalledWith("get_invoice_basis", {
      p_invoice_id: INVOICE_ID,
    });
  });

  test("surfaces RPC errors without mutation attempt", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    admin.single.mockResolvedValueOnce({
      data: { company_id: OWN_COMPANY_ID },
      error: null,
    });
    admin.maybeSingle.mockResolvedValueOnce({
      data: {
        invoice_id: INVOICE_ID,
        company_id: OWN_COMPANY_ID,
        status: "issued",
      },
      error: null,
    });

    admin.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "RPC failed" },
    });

    const result = await explainInvoiceBasis.execute({ invoice_id: INVOICE_ID }, ctx);
    expect(String(result)).toMatch(/Error: RPC failed/);
  });
});
