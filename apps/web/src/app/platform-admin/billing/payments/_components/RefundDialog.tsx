"use client";

// RefundDialog — platform-admin-initiated Stripe refund.
//
// "Grave but not destructive" per Frontend council R3:
//   - NOT AlertDialog's default red-destructive styling
//   - Lucide RotateCcw (rotation = reversal) instead of a Trash icon
//   - Instrument Serif italic heading, NOT all caps
//   - Confirm button: variant="outline" with focus-ring via custom
//     className; not `variant="destructive"` which flashes red
//   - Irreversible warning copy is inline, not shouting
//
// Flow:
//   1. User clicks "Refunder" on a row → dialog opens
//   2. Amount defaults to refundable balance (amount - refunded_amount)
//   3. Reason Select: duplicate / fraudulent / requested_by_customer /
//      other; `other` reveals a textarea for reason_detail
//   4. Confirm → refundPaymentAction with a fresh idempotency key
//   5. Success → toast + close + Server Component refetches on
//      revalidatePath()

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { refundPaymentAction } from "../../_actions/payments/refundPaymentAction";

import type { PaymentRow } from "./PaymentsList";

type RefundReason = "duplicate" | "fraudulent" | "requested_by_customer" | "other";

// crypto.randomUUID is available in modern browsers (client component).
// Fallback to a time-based string for the old Edge / e2e harness so we
// never block submit on missing crypto.
function freshIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `refund-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function RefundDialog({
  payment,
  open,
  onOpenChange,
}: {
  payment: PaymentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("billing");
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<RefundReason>("requested_by_customer");
  const [reasonDetail, setReasonDetail] = useState("");

  const refundable = payment ? Number(payment.amount) - Number(payment.refunded_amount ?? 0) : 0;

  // Reset form each time a new payment is opened.
  useEffect(() => {
    if (payment) {
      setAmount(refundable.toFixed(2));
      setReason("requested_by_customer");
      setReasonDetail("");
    }
  }, [payment, refundable]);

  if (!payment) return null;

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= refundable;
  // reason_detail required per Zod schema (min 10 chars).
  const detailValid = reasonDetail.trim().length >= 10;

  const handleSubmit = () => {
    if (!amountValid || !detailValid) return;

    startTransition(async () => {
      const result = await refundPaymentAction({
        payment_id: payment.payment_id,
        amount: amountNum,
        reason,
        reason_detail: reasonDetail.trim(),
        idempotency_key: freshIdempotencyKey(),
      });

      if (result.ok) {
        toast.success(t("refund.success_toast"));
        onOpenChange(false);
      } else {
        toast.error(t("refund.error_toast", { error: result.error }));
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border/60 bg-background/95 relative max-w-md overflow-hidden backdrop-blur-xl">
        {/* Noise overlay — Nordic Split glass recipe. Pointer-events-none
            so it never blocks the form. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />
        <div className="relative space-y-5">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <RotateCcw aria-hidden className="text-muted-foreground size-5" />
              <AlertDialogTitle className="font-heading text-xl tracking-tight italic">
                {t("refund.dialog_title")}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription>{t("refund.dialog_description")}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="refund-amount">{t("refund.amount_label")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-mono text-sm">{payment.currency}</span>
                <Input
                  id="refund-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  max={refundable}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="font-mono tabular-nums"
                />
              </div>
              <p className="text-muted-foreground text-xs">{t("refund.amount_hint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-reason">{t("refund.reason_label")}</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as RefundReason)}>
                <SelectTrigger id="refund-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="duplicate">{t("refund.reason_duplicate")}</SelectItem>
                  <SelectItem value="fraudulent">{t("refund.reason_fraudulent")}</SelectItem>
                  <SelectItem value="requested_by_customer">
                    {t("refund.reason_requested_by_customer")}
                  </SelectItem>
                  <SelectItem value="other">{t("refund.reason_other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-reason-detail">{t("refund.reason_detail_label")}</Label>
              <Textarea
                id="refund-reason-detail"
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                placeholder={t("refund.reason_detail_placeholder")}
                rows={3}
                maxLength={1000}
              />
            </div>

            <div className="border-border bg-muted/30 space-y-2 rounded-md border p-3 text-sm">
              <p className="text-foreground font-medium">{t("refund.summary_heading")}</p>
              <p className="text-muted-foreground">
                {t("refund.summary_line", {
                  amount: amountNum.toLocaleString("nb-NO", {
                    maximumFractionDigits: 2,
                  }),
                  currency: payment.currency,
                  company: payment.company_name ?? "—",
                })}
              </p>
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <AlertCircle aria-hidden className="mt-0.5 size-3.5" />
                <span>{t("refund.irreversible_warning")}</span>
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {t("refund.cancel_button")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSubmit}
              disabled={pending || !amountValid || !detailValid}
              // Amber focus-ring per Frontend R3 — "grave but not destructive".
              className="focus-visible:ring-warning/50 border-foreground/30"
            >
              {pending ? t("refund.submitting") : t("refund.confirm_button")}
            </Button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
