// Schema validation tests for the Fase 2 Spor C inputs. Validates
// shapes that the web Server Actions use at the HTTP edge; mobile
// callers should validate identically.

import { describe, expect, test } from "vitest";
import {
  AddManualLineItemInputSchema,
  CreateAdHocInvoiceInputSchema,
  MarkInvoicePaidByWorkspaceAdminInputSchema,
  UpdateManualLineItemInputSchema,
} from "../../../schemas";

describe("AddManualLineItemInputSchema", () => {
  test("accepts minimal valid shape", () => {
    const parsed = AddManualLineItemInputSchema.safeParse({
      invoice_id: "11111111-1111-1111-1111-111111111111",
      description: "Ekstra",
      quantity: 1,
      unit_price: 100,
      vat_rate: 25,
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects negative unit_price", () => {
    const parsed = AddManualLineItemInputSchema.safeParse({
      invoice_id: "11111111-1111-1111-1111-111111111111",
      description: "x",
      quantity: 1,
      unit_price: -10,
      vat_rate: 25,
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects zero quantity", () => {
    const parsed = AddManualLineItemInputSchema.safeParse({
      invoice_id: "11111111-1111-1111-1111-111111111111",
      description: "x",
      quantity: 0,
      unit_price: 100,
      vat_rate: 25,
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects non-uuid invoice_id", () => {
    const parsed = AddManualLineItemInputSchema.safeParse({
      invoice_id: "not-a-uuid",
      description: "x",
      quantity: 1,
      unit_price: 100,
      vat_rate: 25,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("UpdateManualLineItemInputSchema", () => {
  test("accepts partial patch (only line_item_id required)", () => {
    const parsed = UpdateManualLineItemInputSchema.safeParse({
      line_item_id: "22222222-2222-2222-2222-222222222222",
      description: "Updated",
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects empty description", () => {
    const parsed = UpdateManualLineItemInputSchema.safeParse({
      line_item_id: "22222222-2222-2222-2222-222222222222",
      description: "",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("CreateAdHocInvoiceInputSchema", () => {
  test("requires at least one line item", () => {
    const parsed = CreateAdHocInvoiceInputSchema.safeParse({
      company_id: "33333333-3333-3333-3333-333333333333",
      period_from: "2026-04-01",
      period_to: "2026-04-30",
      line_items: [],
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects invalid calendar date (feb 30)", () => {
    const parsed = CreateAdHocInvoiceInputSchema.safeParse({
      company_id: "33333333-3333-3333-3333-333333333333",
      period_from: "2026-02-30",
      period_to: "2026-02-30",
      line_items: [{ description: "x", quantity: 1, unit_price: 100, vat_rate: 25 }],
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects invalid currency", () => {
    const parsed = CreateAdHocInvoiceInputSchema.safeParse({
      company_id: "33333333-3333-3333-3333-333333333333",
      period_from: "2026-04-01",
      period_to: "2026-04-30",
      currency: "USD",
      line_items: [{ description: "x", quantity: 1, unit_price: 100, vat_rate: 25 }],
    });
    expect(parsed.success).toBe(false);
  });

  test("accepts valid shape with NOK currency", () => {
    const parsed = CreateAdHocInvoiceInputSchema.safeParse({
      company_id: "33333333-3333-3333-3333-333333333333",
      period_from: "2026-04-01",
      period_to: "2026-04-30",
      currency: "NOK",
      line_items: [{ description: "Setup fee", quantity: 1, unit_price: 5000, vat_rate: 25 }],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("MarkInvoicePaidByWorkspaceAdminInputSchema", () => {
  test("accepts minimal valid shape", () => {
    const parsed = MarkInvoicePaidByWorkspaceAdminInputSchema.safeParse({
      invoice_id: "44444444-4444-4444-4444-444444444444",
      payment_date: "2026-04-15",
      payment_reference: "KID 12345",
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects missing payment_reference", () => {
    const parsed = MarkInvoicePaidByWorkspaceAdminInputSchema.safeParse({
      invoice_id: "44444444-4444-4444-4444-444444444444",
      payment_date: "2026-04-15",
      payment_reference: "",
    });
    expect(parsed.success).toBe(false);
  });
});
