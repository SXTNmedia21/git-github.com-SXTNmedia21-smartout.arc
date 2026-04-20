"use client";

// InvoicePaymentsHistoryClient — accordion-in-list per Frontend R6.
//
// Flat list by default. A row expands when the user clicks its
// disclosure toggle, revealing lazy-loaded payment_attempt rows via
// Framer Motion layout animation. The first row auto-expands if it is
// the only payment AND has multiple attempts (the "likely need to
// inspect" heuristic).

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { useTranslation } from "@smartout/i18n";

import { cn } from "@/lib/utils";
import { PaymentStatusBadge, type PaymentStatus } from "@/components/ui/PaymentStatusBadge";
import { fetchPaymentAttemptsAction } from "../../../_actions/payments/fetchPaymentAttemptsAction";

import type { InvoicePaymentRow } from "./InvoicePaymentsHistory";

type AttemptDTO = {
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

function formatAmount(amount: number, currency: string): string {
  return `${amount.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} ${currency}`;
}

export function InvoicePaymentsHistoryClient({ payments }: { payments: InvoicePaymentRow[] }) {
  const { t } = useTranslation("billing");

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h2 className="font-heading text-lg">{t("payments.history_section_title")}</h2>
      </header>

      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("payments.history_empty")}</p>
      ) : (
        <ol className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-xl border">
          {payments.map((p) => (
            <PaymentRow key={p.payment_id} payment={p} t={t} />
          ))}
        </ol>
      )}
    </section>
  );
}

function PaymentRow({
  payment,
  t,
}: {
  payment: InvoicePaymentRow;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [attempts, setAttempts] = useState<AttemptDTO[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Lazy-load attempts on first expand. Keep them cached so repeated
  // collapse/expand doesn't thrash the DB.
  useEffect(() => {
    if (!expanded || attempts !== null) return;
    setLoading(true);
    fetchPaymentAttemptsAction({ payment_id: payment.payment_id })
      .then((result) => {
        if (result.ok) setAttempts(result.data);
        else setAttempts([]);
      })
      .finally(() => setLoading(false));
  }, [expanded, attempts, payment.payment_id]);

  return (
    <li className="bg-background">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "grid w-full grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 text-sm",
          "hover:bg-muted/20 transition-colors",
        )}
      >
        <PaymentStatusBadge status={payment.status as PaymentStatus} size="sm" />
        <span className="text-left font-mono tabular-nums">
          {formatAmount(payment.amount, payment.currency)}
          {payment.refunded_amount && payment.refunded_amount > 0 ? (
            <span className="text-muted-foreground ml-2 text-xs">
              (−{formatAmount(payment.refunded_amount, payment.currency)})
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground text-xs">
          {formatDateTime(payment.paid_at ?? payment.created_at)}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "text-muted-foreground size-4 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }}
            className="overflow-hidden"
          >
            <div className="border-border/60 bg-muted/10 space-y-3 border-t p-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">{t("payments.history_column_method")}</dt>
                <dd>{t(`payments.method_${payment.payment_method}`)}</dd>
                <dt className="text-muted-foreground">{t("payments.history_column_reference")}</dt>
                <dd className="truncate font-mono">{payment.external_id ?? "—"}</dd>
              </dl>

              <div className="space-y-2">
                <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {t("payments.history_attempts_title")}
                </h4>
                {loading ? (
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Loader2 aria-hidden className="size-3 animate-spin" />
                    <span>…</span>
                  </div>
                ) : attempts && attempts.length > 0 ? (
                  <ol className="space-y-1.5">
                    {attempts.map((a) => (
                      <li
                        key={a.payment_attempt_id}
                        className="border-border/40 bg-background space-y-1 rounded-md border p-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            {t("payments_admin.detail_attempt_label", {
                              n: a.attempt_number,
                            })}
                          </span>
                          <PaymentStatusBadge
                            status={(a.status as PaymentStatus) || "pending"}
                            size="sm"
                          />
                        </div>
                        <div className="text-muted-foreground">{formatDateTime(a.created_at)}</div>
                        {a.error_code ? (
                          <div className="text-destructive font-mono text-[11px]">
                            {a.error_code}
                            {a.error_message ? `: ${a.error_message}` : ""}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {t("payments_admin.detail_no_attempts")}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
