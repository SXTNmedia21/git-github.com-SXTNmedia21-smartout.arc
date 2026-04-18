import { describe, test, expect, vi } from "vitest";
import { listInvoiceDispatches } from "../tools";
import type { AgentToolContext } from "../../types";

// Fase 2 B6 — vitest coverage for list_invoice_dispatches. Four branches
// per the Trust Gate note on the tool description:
//
//   1. Channel guard — chat only.
//   2. Scope — invoice belongs to someone else → refuse without leaking.
//   3. Empty list — pre-Fase-2 invoice returns [] (LLM narrates "sjekk
//      invoice.delivery_status" per the description).
//   4. Happy path — returns rows with target email masked (a***@example.com).

const OWN_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-2222-2222-222222222222";
const INVOICE_ID = "33333333-3333-3333-3333-333333333333";

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  // The mock returns the same chainable object for .from/.select/.eq/.order.
  // resolveCompanyId uses .single(); the tool uses .maybeSingle() (scope
  // check) and a terminal .order() (list query). Terminal .order() must
  // resolve like an awaited query — hence listResolvedValue below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listResolvedValue: { current: any } = { current: { data: [], error: null } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAdmin: any = {
    from: vi.fn(() => supabaseAdmin),
    select: vi.fn(() => supabaseAdmin),
    eq: vi.fn(() => supabaseAdmin),
    order: vi.fn(() => Promise.resolve(listResolvedValue.current)),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    __setListResult: (v: unknown) => {
      listResolvedValue.current = v;
    },
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

describe("list_invoice_dispatches tool", () => {
  test("refuses voice channel", async () => {
    const ctx = makeCtx({ channel: "voice" });
    const result = await listInvoiceDispatches.execute({ invoice_id: INVOICE_ID }, ctx);
    expect(String(result)).toMatch(/chat-only/i);
    expect((ctx.supabaseAdmin as { from: unknown }).from).not.toHaveBeenCalled();
  });

  test("refuses invoice belonging to another company", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    admin.single.mockResolvedValueOnce({
      data: { company_id: OWN_COMPANY_ID },
      error: null,
    });
    admin.maybeSingle.mockResolvedValueOnce({
      data: { invoice_id: INVOICE_ID, company_id: OTHER_COMPANY_ID },
      error: null,
    });

    const result = await listInvoiceDispatches.execute({ invoice_id: INVOICE_ID }, ctx);
    expect(String(result)).toMatch(/does not belong to your company/i);
    expect(admin.order).not.toHaveBeenCalled();
  });

  test("returns empty array when no dispatches exist (pre-Fase-2 invoice)", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    admin.single.mockResolvedValueOnce({
      data: { company_id: OWN_COMPANY_ID },
      error: null,
    });
    admin.maybeSingle.mockResolvedValueOnce({
      data: { invoice_id: INVOICE_ID, company_id: OWN_COMPANY_ID },
      error: null,
    });
    admin.__setListResult({ data: [], error: null });

    const result = await listInvoiceDispatches.execute({ invoice_id: INVOICE_ID }, ctx);
    expect(JSON.parse(String(result))).toEqual([]);
  });

  test("happy path returns rows with email target masked", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    admin.single.mockResolvedValueOnce({
      data: { company_id: OWN_COMPANY_ID },
      error: null,
    });
    admin.maybeSingle.mockResolvedValueOnce({
      data: { invoice_id: INVOICE_ID, company_id: OWN_COMPANY_ID },
      error: null,
    });
    admin.__setListResult({
      data: [
        {
          channel: "email_customer",
          target: { email: "kunde@example.com" },
          status: "delivered",
          attempts: 1,
          last_attempt_at: "2026-04-17T10:00:00Z",
          delivered_at: "2026-04-17T10:00:03Z",
          error_code: null,
          error_message: null,
          external_reference: "sg-msg-abc",
          created_at: "2026-04-17T09:59:59Z",
        },
        {
          channel: "http_api",
          target: { url: "https://fiken.no/api/invoices" },
          status: "failed",
          attempts: 3,
          last_attempt_at: "2026-04-17T10:05:00Z",
          delivered_at: null,
          error_code: "timeout",
          error_message: "Read timeout after 30s",
          external_reference: null,
          created_at: "2026-04-17T10:00:00Z",
        },
      ],
      error: null,
    });

    const result = await listInvoiceDispatches.execute({ invoice_id: INVOICE_ID }, ctx);
    const rows = JSON.parse(String(result)) as Array<{
      channel: string;
      target: Record<string, unknown>;
      status: string;
    }>;

    expect(rows).toHaveLength(2);
    const emailRow = rows[0]!;
    const apiRow = rows[1]!;
    // Email row — PII masked.
    expect(emailRow.channel).toBe("email_customer");
    expect(emailRow.target.email).toBe("k***@example.com");
    // API row — target pass-through (non-email).
    expect(apiRow.channel).toBe("http_api");
    expect(apiRow.target.url).toBe("https://fiken.no/api/invoices");
    // Status preserved verbatim.
    expect(emailRow.status).toBe("delivered");
    expect(apiRow.status).toBe("failed");
  });

  test("masks single-letter local-part emails safely", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    admin.single.mockResolvedValueOnce({
      data: { company_id: OWN_COMPANY_ID },
      error: null,
    });
    admin.maybeSingle.mockResolvedValueOnce({
      data: { invoice_id: INVOICE_ID, company_id: OWN_COMPANY_ID },
      error: null,
    });
    admin.__setListResult({
      data: [
        {
          channel: "email_internal",
          target: { email: "a@smartout.no" },
          status: "delivered",
          attempts: 1,
          last_attempt_at: null,
          delivered_at: "2026-04-17T10:00:00Z",
          error_code: null,
          error_message: null,
          external_reference: null,
          created_at: "2026-04-17T09:59:59Z",
        },
      ],
      error: null,
    });

    const result = await listInvoiceDispatches.execute({ invoice_id: INVOICE_ID }, ctx);
    const rows = JSON.parse(String(result)) as Array<{
      target: Record<string, unknown>;
    }>;
    // Single-char local part → "***@domain" (no leading char leak).
    expect(rows[0]!.target.email).toBe("***@smartout.no");
  });

  test("rejects invalid invoice_id via zod schema", () => {
    const parse = listInvoiceDispatches.schema.safeParse({ invoice_id: "not-a-uuid" });
    expect(parse.success).toBe(false);
  });
});
