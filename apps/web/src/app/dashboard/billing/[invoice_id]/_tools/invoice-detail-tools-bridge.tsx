"use client";

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import {
  useInvoiceDetailTools,
  type InvoiceLineRow,
  type InvoiceSummary,
} from "./use-invoice-detail-tools";

type InvoiceDetailToolsBridgeProps = {
  invoice: InvoiceSummary;
  lineItems: InvoiceLineRow[];
};

export function InvoiceDetailToolsBridge(props: InvoiceDetailToolsBridgeProps) {
  const tools = useInvoiceDetailTools(props);
  useRegisterTools("invoice-detail", tools);
  return null;
}
