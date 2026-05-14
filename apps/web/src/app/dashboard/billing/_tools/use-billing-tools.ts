"use client";

/**
 * use-billing-tools.ts — Botsson tools for the /dashboard/billing surface.
 *
 * Five tools: 3 read, 2 nav — no write tools at root.
 * Writes (mark paid, initiate payment) live in [invoice_id] and settings sub-routes.
 *
 *   getBillingOverview      — current period summary, total outstanding, due dates
 *   listInvoices            — invoice list with optional status filter
 *   getInvoiceDetail        — detail for a single invoice by invoice_id
 *   openInvoiceDetail       — navigate to /dashboard/billing/<invoice_id>
 *   openBillingSettings     — navigate to /dashboard/billing/settings
 *
 * dataRef pattern keeps definitions stable while reading live state per invocation.
 * ADR-0151: no workspace_id in input — resolved server-side; tools read pre-fetched data.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type InvoiceRow = {
  invoice_id: string;
  invoice_number: number | null;
  period_from: string | null;
  period_to: string | null;
  amount_incl_vat: number | string;
  currency: string;
  status: string;
  due_at: string | null;
  issued_at: string | null;
};

export type BillingToolInput = {
  /** All invoices loaded on the page (max 48, ordered newest-first). */
  invoices: InvoiceRow[];
  /** Router navigate callback — used by nav tools. */
  navigate: (path: string) => void;
};

const VALID_STATUSES = new Set([
  "draft",
  "issued",
  "sent",
  "paid",
  "overdue",
  "void",
  "uncollectible",
]);

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useBillingTools(input: BillingToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getBillingOverview",
          description:
            "Get a billing overview for the current company: total invoices, outstanding amount, overdue count, and next due date. Use when user asks 'hva skylder vi?', 'er det noe forfalt?', or any billing status question.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listInvoices",
          description:
            "List invoices for this company. Filter by status (draft|issued|sent|paid|overdue|void|uncollectible) to narrow results. Use when user asks 'vis fakturaene', 'hva er ubetalt?', or 'hvilke fakturaer er forfalt?'.",
          dynamicParameters: [
            {
              name: "status",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["draft", "issued", "sent", "paid", "overdue", "void", "uncollectible"],
                description: "Filter by invoice status. Omit to return all invoices.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getInvoiceDetail",
          description:
            "Get detail for a specific invoice by its invoice_id or invoice_number. Use when user asks about a specific invoice number or references a particular billing period.",
          dynamicParameters: [
            {
              name: "invoiceId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "The invoice_id (UUID) or invoice_number (e.g. INV-0042) to look up.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openInvoiceDetail",
          description:
            "Navigate to the detail page for a specific invoice. Use when user wants to see or pay a specific invoice. Requires invoice_id.",
          dynamicParameters: [
            {
              name: "invoiceId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "The invoice_id (UUID) to open.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openBillingSettings",
          description:
            "Navigate to the billing settings page (/dashboard/billing/settings). Use when user asks to change billing details, update payment method, or adjust subscription.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getBillingOverview: () => {
        const { invoices } = dataRef.current;
        const outstanding = invoices.filter((inv) =>
          ["issued", "sent", "overdue"].includes(inv.status),
        );
        const overdue = invoices.filter((inv) => inv.status === "overdue");
        const totalOutstanding = outstanding.reduce(
          (sum, inv) => sum + Number(inv.amount_incl_vat),
          0,
        );
        const nextDue =
          outstanding
            .filter((inv) => inv.due_at)
            .sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1))[0]?.due_at ?? null;

        return JSON.stringify({
          totalInvoices: invoices.length,
          outstandingCount: outstanding.length,
          overdueCount: overdue.length,
          totalOutstandingNOK: totalOutstanding,
          nextDueDate: nextDue,
          currency: invoices[0]?.currency ?? "NOK",
        });
      },

      listInvoices: (params: Record<string, unknown>) => {
        const { invoices } = dataRef.current;
        const status = params.status as string | undefined;

        let rows = invoices;
        if (status && VALID_STATUSES.has(status)) {
          rows = invoices.filter((inv) => inv.status === status);
        }

        return JSON.stringify({
          filter: status ?? "all",
          total: rows.length,
          invoices: rows.map((inv) => ({
            invoiceId: inv.invoice_id,
            invoiceNumber: inv.invoice_number,
            period: `${inv.period_from ?? "?"} – ${inv.period_to ?? "?"}`,
            amountInclVat: Number(inv.amount_incl_vat),
            currency: inv.currency,
            status: inv.status,
            dueAt: inv.due_at,
            issuedAt: inv.issued_at,
          })),
        });
      },

      getInvoiceDetail: (params: Record<string, unknown>) => {
        const { invoices } = dataRef.current;
        const query = params.invoiceId as string | undefined;
        if (!query) {
          return JSON.stringify({ ok: false, reason: "invoiceId is required" });
        }

        const inv =
          invoices.find((i) => i.invoice_id === query) ??
          invoices.find(
            (i) =>
              i.invoice_number !== null &&
              String(i.invoice_number) === query.replace(/^INV-0*/i, ""),
          );

        if (!inv) {
          return JSON.stringify({
            ok: false,
            reason: `Invoice '${query}' not found in current view (${invoices.length} loaded).`,
          });
        }

        return JSON.stringify({
          ok: true,
          invoiceId: inv.invoice_id,
          invoiceNumber: inv.invoice_number,
          period: `${inv.period_from ?? "?"} – ${inv.period_to ?? "?"}`,
          amountInclVat: Number(inv.amount_incl_vat),
          currency: inv.currency,
          status: inv.status,
          dueAt: inv.due_at,
          issuedAt: inv.issued_at,
          detailUrl: `/dashboard/billing/${inv.invoice_id}`,
        });
      },

      openInvoiceDetail: (params: Record<string, unknown>) => {
        const { invoices, navigate } = dataRef.current;
        const invoiceId = params.invoiceId as string | undefined;
        if (!invoiceId) {
          return JSON.stringify({ ok: false, reason: "invoiceId is required" });
        }

        const exists = invoices.some((inv) => inv.invoice_id === invoiceId);
        if (!exists) {
          return JSON.stringify({
            ok: false,
            reason: `Invoice ${invoiceId} not found in current view.`,
          });
        }

        navigate(`/dashboard/billing/${invoiceId}`);
        return JSON.stringify({ ok: true, navigatedTo: `/dashboard/billing/${invoiceId}` });
      },

      openBillingSettings: () => {
        dataRef.current.navigate("/dashboard/billing/settings");
        return JSON.stringify({ ok: true, navigatedTo: "/dashboard/billing/settings" });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
