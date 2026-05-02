"use client";

// MarkReceivedDialog.tsx — "Marker som mottatt og betalt" dialog.
//
// Client component. Trigger button opens a shadcn Dialog with:
//   - paid_at: date picker (default today)
//   - paid_amount: pre-filled from invoice.amount_incl_vat, edit-toggle
//   - note: textarea for accountant note (max 200 chars)
//
// On confirm: POST /api/orders/[id]/mark-received.
// On 200: sonner toast + router.refresh().
// On error: sonner error toast.
//
// Uses shadcn Dialog (NOT AlertDialog) — AlertDialog is for destructive
// confirmations; this is a constructive mutation. AlertDialog also has
// no form-field affordance.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  invoice: {
    invoice_id: string;
    invoice_number: number | null;
    amount_incl_vat: number;
    currency: string;
  };
};

export function MarkReceivedDialog({ invoice }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Form state
  const today = new Date().toISOString().split("T")[0];
  const [paidAt, setPaidAt] = useState(today);
  const [paidAmount, setPaidAmount] = useState(String(invoice.amount_incl_vat));
  const [amountEditable, setAmountEditable] = useState(false);
  const [note, setNote] = useState("");

  const [, startTransition] = useTransition();

  const handleConfirm = () => {
    const amount = parseFloat(paidAmount);
    if (!paidAt || isNaN(amount) || amount <= 0) {
      toast.error("Fyll ut gyldig dato og beløp.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/orders/${invoice.invoice_id}/mark-received`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paid_at: paidAt,
            paid_amount: amount,
            note: note.trim() || undefined,
          }),
        });

        if (res.ok) {
          toast.success("Markert som mottatt og betalt.");
          setOpen(false);
          router.refresh();
        } else {
          const body = await res.json().catch(() => ({}));
          const msg = (body as Record<string, string>).error ?? `HTTP ${res.status}`;
          toast.error(`Feil ved markering: ${msg}`);
        }
      } catch (err) {
        toast.error("Nettverksfeil. Prøv igjen.");
        console.error("[MarkReceivedDialog] fetch failed:", err);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <CheckCircle2 className="mr-2 size-4" aria-hidden />
          Marker som mottatt
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marker som mottatt og betalt</DialogTitle>
          <DialogDescription>
            Ordre #{invoice.invoice_number ?? "—"} —{" "}
            {Number(invoice.amount_incl_vat).toLocaleString("nb-NO")} {invoice.currency} inkl. mva.
            <br />
            Betalingen registreres med metode «Regnskapsbilag».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Paid at */}
          <div className="space-y-1.5">
            <Label htmlFor="paid-at">Betalingsdato</Label>
            <Input
              id="paid-at"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              max={today}
            />
          </div>

          {/* Paid amount — locked by default, edit-toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="paid-amount">Beløp (inkl. mva)</Label>
              <button
                type="button"
                onClick={() => setAmountEditable((v) => !v)}
                className="text-muted-foreground text-xs underline"
              >
                {amountEditable ? "Lås beløp" : "Endre beløp"}
              </button>
            </div>
            <Input
              id="paid-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              disabled={!amountEditable}
              className="font-mono"
            />
            {amountEditable ? (
              <p className="text-muted-foreground text-xs">
                Avviker dette fra faktureert beløp bør avviket noteres nedenfor.
              </p>
            ) : null}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="note">
              Notat fra regnskapsfører{" "}
              <span className="text-muted-foreground font-normal">(valgfritt)</span>
            </Label>
            <textarea
              id="note"
              rows={3}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="F.eks. bankreferanse, betalingsdato avviker fra forfall…"
              className="border-border bg-background placeholder:text-muted-foreground text-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1"
            />
            <p className="text-muted-foreground text-right text-xs">{note.length}/200</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button variant="default" onClick={handleConfirm}>
            Bekreft mottak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
