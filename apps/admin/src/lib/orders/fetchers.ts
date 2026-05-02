/**
 * fetchers.ts — typed order fetcher stubs
 *
 * Stub — implemented in M3.
 * Will wrap @smartout/billing/queries (fetchOrdersForAccountant, fetchInvoiceDetail,
 * fetchInvoiceDispatches, fetchInvoicePayments).
 *
 * Returns empty arrays / null until M3 connects real queries.
 */

export type OrderListRow = {
  invoice_id: string;
  invoice_number: string;
  status: string;
  issued_at: string | null;
  due_at: string | null;
  amount_incl_vat: number;
  company_name: string;
};

export type OrderFilters = {
  status?: string;
  companyId?: string;
};

/**
 * Fetch paginated order list for the accountant across all granted companies.
 * TODO M3: replace with @smartout/billing/queries fetchOrdersForAccountant
 */
export async function fetchOrdersForAccountant(
  _grantedCompanyIds: string[],
  _filters: OrderFilters,
): Promise<OrderListRow[]> {
  return [];
}

/**
 * Fetch full invoice detail for /orders/[id].
 * TODO M3: replace with @smartout/billing/queries fetchInvoiceDetail
 */
export async function fetchOrderDetail(_invoiceId: string): Promise<null> {
  return null;
}
