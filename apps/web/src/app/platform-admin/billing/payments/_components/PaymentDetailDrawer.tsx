"use client";

// PaymentDetailDrawer — slide-out panel with full payment row + the
// payment_attempt history. Platform-admin only per ADR-0132 (RLS
// rejects workspace reads of payment_attempt).
//
// Attempts are loaded lazily on open via a Server Action wrapper so the
// PaymentsList server component doesn't pre-fetch attempts for every
// row (would bloat the initial payload). A useEffect fires the fetch
// when `open` transitions true.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@smartout/i18n";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PaymentStatusBadge, type PaymentStatus } from "@/components/ui/PaymentStatusBadge";

import { fetchPaymentAttemptsAction } from "../../_actions/payments/fetchPaymentAttemptsAction";
import type { PaymentRow } from "./PaymentsList";

type Attempt = {
  payment_attempt_id: string;
  attempt_number: number;
  status: string;
  stripe_event_id: string;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("nb-NO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PaymentDetailDrawer({
  payment,
  open,
  onOpenChange,
}: {
  payment: PaymentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("billing");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !payment) {
      setAttempts([]);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    fetchPaymentAttemptsAction({ payment_id: payment.payment_id })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.ok) {
          setAttempts(result.data);
        } else {
          setAttempts([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, payment]);

  if (!payment) return null;

  const amountLabel = `${Number(payment.amount).toLocaleString("nb-NO", {
    maximumFractionDigits: 2,
  })} ${payment.currency}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl">
            {t("payments_admin.detail_heading")}
          </SheetTitle>
          <SheetDescription>
            {payment.company_name ?? "—"} · {amountLabel}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <dl className="border-border/60 bg-muted/20 grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
            <dt className="text-muted-foreground">{t("payments.history_column_status")}</dt>
            <dd>
              <PaymentStatusBadge status={payment.status as PaymentStatus} size="sm" />
            </dd>
            <dt className="text-muted-foreground">{t("payments.history_column_amount")}</dt>
            <dd className="font-mono tabular-nums">{amountLabel}</dd>
            <dt className="text-muted-foreground">{t("payments.history_column_method")}</dt>
            <dd>{t(`payments.method_${payment.payment_method}`)}</dd>
            <dt className="text-muted-foreground">{t("payments.history_column_date")}</dt>
            <dd>{formatDateTime(payment.paid_at ?? payment.created_at)}</dd>
            <dt className="text-muted-foreground">{t("payments.history_column_reference")}</dt>
            <dd className="truncate font-mono text-xs">{payment.external_id ?? "—"}</dd>
          </dl>

          <section className="space-y-3">
            <h3 className="font-heading text-sm font-medium">
              {t("payments_admin.detail_attempts_heading")}
            </h3>
            {loading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                <span>…</span>
              </div>
            ) : attempts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("payments_admin.detail_no_attempts")}
              </p>
            ) : (
              <ol className="space-y-2">
                {attempts.map((a) => (
                  <li
                    key={a.payment_attempt_id}
                    className="border-border/60 bg-background space-y-1 rounded-md border p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">
                        {t("payments_admin.detail_attempt_label", { n: a.attempt_number })}
                      </span>
                      <PaymentStatusBadge
                        status={
                          // payment_attempt.status is text (not enum) per
                          // ADR-0132 — so we narrow to the PaymentStatus set.
                          (a.status as PaymentStatus) || "pending"
                        }
                        size="sm"
                      />
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatDateTime(a.created_at)}
                    </div>
                    {a.error_code ? (
                      <div className="text-destructive space-y-0.5 text-xs">
                        <span className="font-mono">
                          {t("payments_admin.detail_error_code")}: {a.error_code}
                        </span>
                        {a.error_message ? (
                          <div className="text-destructive/80">{a.error_message}</div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="text-muted-foreground truncate font-mono text-[11px]">
                      {a.stripe_event_id}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
