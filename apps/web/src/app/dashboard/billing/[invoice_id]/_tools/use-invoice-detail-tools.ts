"use client";

/**
 * use-invoice-detail-tools.ts — Botsson tools for
 * /dashboard/billing/[invoice_id].
 *
 * Five read tools — no mutation tools.
 *   getInvoiceDetail        — number, status, period, amount, currency
 *   listInvoiceLineItems    — description, qty, unit price, amount per line
 *   getInvoicePaymentInfo   — paid_at, payment_reference, payment_channel
 *   getInvoiceActionState   — canMarkPaid / canPayNow flags based on status
 *   getInvoiceTotalsSummary — line item count + total incl VAT
 *
 * Why no mutation tools:
 *   MarkPaidButton + PayNowButton are component-internal mutation flows
 *   with their own Server Actions + telemetry. Botsson reads + describes;
 *   the human clicks the button to mutate.
 *
 * ADR-0151: getMyInvoiceDetail resolves company via auth-derived RLS scope.
 * ADR-0238: page does not own a domain chat surface.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type InvoiceLineRow = {
  description: string;
  quantity: number;
  unit_price: number;
  amount_incl_vat: number;
};

export type InvoiceSummary = {
  invoice_id: string;
  invoice_number: number | null;
  status: string;
  period_from: string | null;
  period_to: string | null;
  amount_incl_vat: number;
  currency: string;
  paid_at: string | null;
  payment_reference: string | null;
  payment_channel: string | null;
};

export type InvoiceDetailToolInput = {
  invoice: InvoiceSummary;
  lineItems: InvoiceLineRow[];
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useInvoiceDetailTools(input: InvoiceDetailToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getInvoiceDetail",
          description:
            "Get the metadata of the currently-open invoice — number, status (draft/issued/paid/cancelled), period (from/to), total amount incl. VAT, and currency. Use as the first tool when the user asks 'hva er denne fakturaen?', 'hvor mye er denne på?', or 'hva er status?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listInvoiceLineItems",
          description:
            "List the invoice line items — each with description, quantity, unit price, and amount (incl. VAT). Use when the user asks 'hva består fakturaen av?', 'vis linjene', or 'hvilke poster er på denne fakturaen?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getInvoicePaymentInfo",
          description:
            "Get payment-related details — when was the invoice paid (if paid), payment reference, and channel. Use when the user asks 'er denne betalt?', 'når ble den betalt?', or 'hvilken referanse har den?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getInvoiceActionState",
          description:
            "Get which actions are available right now — canMarkPaid (status=issued) and canPayNow (status=issued and not paid). Use when the user asks 'kan jeg betale denne?', 'kan jeg merke den som betalt?', or 'hvilke knapper er aktive?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getInvoiceTotalsSummary",
          description:
            "Get a totals summary — count of line items and grand total (incl. VAT) with currency. Use when the user asks 'hva er totalen?' or 'hvor mange linjer har fakturaen?'.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getInvoiceDetail: () => {
        const d = dataRef.current;
        const inv = d.invoice;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            invoice: {
              id: inv.invoice_id,
              number: inv.invoice_number,
              status: inv.status,
              periodFrom: inv.period_from,
              periodTo: inv.period_to,
              amountInclVat: inv.amount_incl_vat,
              currency: inv.currency,
            },
          }),
        );
      },

      listInvoiceLineItems: () => {
        const d = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: d.lineItems.length,
            lines: d.lineItems.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unit_price,
              amountInclVat: l.amount_incl_vat,
            })),
          }),
        );
      },

      getInvoicePaymentInfo: () => {
        const d = dataRef.current;
        const inv = d.invoice;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            paid: inv.status === "paid",
            paidAt: inv.paid_at,
            reference: inv.payment_reference,
            channel: inv.payment_channel,
          }),
        );
      },

      getInvoiceActionState: () => {
        const d = dataRef.current;
        const isIssued = d.invoice.status === "issued";
        const isPaid = d.invoice.status === "paid";
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            currentStatus: d.invoice.status,
            canMarkPaid: isIssued,
            canPayNow: isIssued && !isPaid,
            hint: isPaid
              ? "Fakturaen er allerede betalt."
              : isIssued
                ? "Fakturaen er utstedt og venter på betaling. 'Betal nå' og 'Merk som betalt' er begge tilgjengelige."
                : `Status er ${d.invoice.status}; ingen betalingsknapper aktive.`,
          }),
        );
      },

      getInvoiceTotalsSummary: () => {
        const d = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            lineCount: d.lineItems.length,
            totalInclVat: d.invoice.amount_incl_vat,
            currency: d.invoice.currency,
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
