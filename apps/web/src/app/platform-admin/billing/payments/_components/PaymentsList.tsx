"use client";

// PaymentsList — platform-admin payments dashboard table.
//
// Renders rows from listPayments() with inline filters (status,
// company text). A row click opens PaymentDetailDrawer for a full
// view + attempts accordion. "Refunder"-button per refundable row
// opens RefundDialog.
//
// Filter state is client-only for Fase 3A (no URL persistence) — the
// list is capped at 500 rows and the dashboard is a short-lived admin
// surface. Fase 3B may push filters to searchParams when the list
// grows past the cap.

import { useMemo, useState } from "react";
import { CircleDollarSign, Filter, RotateCcw } from "lucide-react";
import { useTranslation } from "@smartout/i18n";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentStatusBadge, type PaymentStatus } from "@/components/ui/PaymentStatusBadge";

import { PaymentDetailDrawer } from "./PaymentDetailDrawer";
import { RefundDialog } from "./RefundDialog";

type PaymentRow = {
  payment_id: string;
  invoice_id: string;
  company_id: string;
  company_name: string | null;
  amount: number;
  refunded_amount: number | null;
  currency: string;
  status: PaymentStatus;
  payment_method: string;
  external_id: string | null;
  paid_at: string | null;
  created_at: string;
};

const STATUS_OPTIONS: Array<PaymentStatus | "all"> = [
  "all",
  "pending",
  "processing",
  "succeeded",
  "failed",
  "refunded",
  "partially_refunded",
];

const REFUNDABLE_STATUSES = new Set<PaymentStatus>(["succeeded", "partially_refunded"]);

function truncate(id: string | null, len = 14): string {
  if (!id) return "—";
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

function formatAmount(amount: number, currency: string): string {
  return `${amount.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} ${currency}`;
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("nb-NO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PaymentsList({ payments }: { payments: PaymentRow[] }) {
  const { t } = useTranslation("billing");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");
  const [companyQuery, setCompanyQuery] = useState("");
  const [detailFor, setDetailFor] = useState<PaymentRow | null>(null);
  const [refundFor, setRefundFor] = useState<PaymentRow | null>(null);

  const filtered = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (q && !(p.company_name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [payments, statusFilter, companyQuery]);

  if (payments.length === 0) {
    return (
      <div className="border-border/60 bg-muted/10 space-y-2 rounded-xl border p-10 text-center">
        <CircleDollarSign aria-hidden className="text-muted-foreground mx-auto size-8" />
        <h2 className="font-heading text-lg">{t("payments_admin.empty_title")}</h2>
        <p className="text-muted-foreground mx-auto max-w-prose text-sm">
          {t("payments_admin.empty_description")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl">{t("payments_admin.page_title")}</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("payments_admin.page_description")}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label
            htmlFor="payments-status-filter"
            className="text-muted-foreground flex items-center gap-1 text-xs"
          >
            <Filter aria-hidden className="size-3" />
            {t("payments_admin.filter_status_label")}
          </label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as PaymentStatus | "all")}
          >
            <SelectTrigger id="payments-status-filter" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? t("payments_admin.filter_status_all") : t(`payments.status_${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="payments-company-filter" className="text-muted-foreground text-xs">
            {t("payments_admin.filter_company_placeholder")}
          </label>
          <Input
            id="payments-company-filter"
            value={companyQuery}
            onChange={(e) => setCompanyQuery(e.target.value)}
            placeholder={t("payments_admin.filter_company_placeholder")}
            className="w-72"
          />
        </div>
      </div>

      <div className="border-border/60 overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("payments_admin.column_status")}</TableHead>
              <TableHead className="text-right">{t("payments_admin.column_amount")}</TableHead>
              <TableHead>{t("payments_admin.column_company")}</TableHead>
              <TableHead>{t("payments_admin.column_paid_at")}</TableHead>
              <TableHead>{t("payments_admin.column_external_id")}</TableHead>
              <TableHead className="text-right">{t("payments_admin.column_actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow
                key={p.payment_id}
                className="hover:bg-muted/20 cursor-pointer"
                onClick={() => setDetailFor(p)}
              >
                <TableCell>
                  <PaymentStatusBadge status={p.status} size="sm" />
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatAmount(p.amount, p.currency)}
                </TableCell>
                <TableCell className="truncate">{p.company_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatRelativeDate(p.paid_at ?? p.created_at)}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {truncate(p.external_id)}
                </TableCell>
                <TableCell
                  className="text-right"
                  // Row is clickable — nested button must not propagate.
                  onClick={(e) => e.stopPropagation()}
                >
                  {REFUNDABLE_STATUSES.has(p.status) ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setRefundFor(p)}>
                      <RotateCcw aria-hidden className="size-3.5" />
                      <span className="ml-1">{t("payments_admin.action_refund")}</span>
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PaymentDetailDrawer
        payment={detailFor}
        open={detailFor !== null}
        onOpenChange={(v) => !v && setDetailFor(null)}
      />

      <RefundDialog
        payment={refundFor}
        open={refundFor !== null}
        onOpenChange={(v) => !v && setRefundFor(null)}
      />
    </div>
  );
}

export type { PaymentRow };
