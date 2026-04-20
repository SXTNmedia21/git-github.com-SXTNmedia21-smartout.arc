"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  addManualLineItemAction,
  updateManualLineItemAction,
  deleteManualLineItemAction,
} from "../../../_actions/invoice-editing";
import type { InvoiceLineItemRow } from "./InvoiceLineItemEditor";

// Fase 2 Spor C — platform-admin manual line-item CRUD on draft invoices.
//
// Derived lines (usage_snapshot_id != null) are shown with a primary
// accent and are read-only. Manual lines (usage_snapshot_id == null)
// are inline-editable + deletable. "Legg til linje" opens a dialog.
//
// Motion uses spring defaults from the Nordic Split skill
// (stiffness 35, damping 22, mass 2.2). AnimatePresence handles the
// row exit on delete + inline-edit swap.

type Row = InvoiceLineItemRow;

const SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 };

function lineTotals(quantity: number, unit_price: number, vat_rate: number) {
  const excl = Number((quantity * unit_price).toFixed(2));
  const vat = Number(((excl * vat_rate) / 100).toFixed(2));
  const incl = Number((excl + vat).toFixed(2));
  return { excl, vat, incl };
}

export function InvoiceLineItemEditorClient({
  invoiceId,
  initialLineItems,
}: {
  invoiceId: string;
  initialLineItems: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initialLineItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [pending, start] = useTransition();

  const derived = rows.filter((r) => r.usage_snapshot_id !== null);
  const manual = rows.filter((r) => r.usage_snapshot_id === null);

  const handleAdd = (patch: {
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
  }) => {
    start(async () => {
      const result = await addManualLineItemAction({ invoice_id: invoiceId, ...patch });
      if (result.ok) {
        // line_item shape from the pure function matches our Row shape after coercion.
        const li = result.line_item;
        setRows((prev) => [
          ...prev,
          {
            line_item_id: li.line_item_id,
            invoice_id: li.invoice_id,
            description: li.description,
            quantity: Number(li.quantity),
            unit_price: Number(li.unit_price),
            vat_rate: Number(li.vat_rate),
            amount_excl_vat: Number(li.amount_excl_vat),
            vat_amount: Number(li.vat_amount),
            amount_incl_vat: Number(li.amount_incl_vat),
            line_type: li.line_type,
            usage_snapshot_id: li.usage_snapshot_id,
          },
        ]);
        setShowAdd(false);
        toast.success("Linje lagt til");
      } else {
        toast.error(`Kunne ikke legge til linje: ${result.error}`);
      }
    });
  };

  const handleUpdate = (
    id: string,
    patch: {
      description?: string;
      quantity?: number;
      unit_price?: number;
      vat_rate?: number;
    },
  ) => {
    start(async () => {
      const result = await updateManualLineItemAction({ line_item_id: id, ...patch });
      if (result.ok) {
        const li = result.after;
        setRows((prev) =>
          prev.map((r) =>
            r.line_item_id === id
              ? {
                  ...r,
                  description: li.description,
                  quantity: Number(li.quantity),
                  unit_price: Number(li.unit_price),
                  vat_rate: Number(li.vat_rate),
                  amount_excl_vat: Number(li.amount_excl_vat),
                  vat_amount: Number(li.vat_amount),
                  amount_incl_vat: Number(li.amount_incl_vat),
                }
              : r,
          ),
        );
        setEditingId(null);
        toast.success("Linje oppdatert");
      } else {
        toast.error(`Kunne ikke oppdatere linje: ${result.error}`);
      }
    });
  };

  const handleDelete = (id: string) => {
    start(async () => {
      const result = await deleteManualLineItemAction({ line_item_id: id });
      if (result.ok) {
        setRows((prev) => prev.filter((r) => r.line_item_id !== id));
        toast.success("Linje fjernet");
      } else {
        toast.error(`Kunne ikke slette linje: ${result.error}`);
      }
    });
  };

  const totalExcl = rows.reduce((s, r) => s + r.amount_excl_vat, 0);
  const totalVat = rows.reduce((s, r) => s + r.vat_amount, 0);
  const totalIncl = rows.reduce((s, r) => s + r.amount_incl_vat, 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg">Rediger linjer</h3>
          <p className="text-muted-foreground text-sm">
            Utledede linjer (fra bruk) er låst. Manuelle linjer kan redigeres mens fakturaen er
            utkast.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} disabled={pending}>
          <Plus className="mr-2 h-4 w-4" />
          Legg til linje
        </Button>
      </div>

      <div className="border-border overflow-hidden rounded-md border">
        <div className="bg-muted/30 grid grid-cols-[4px_1fr_6rem_7rem_5rem_8rem_6rem] items-center gap-3 px-3 py-2 text-sm font-medium">
          <span />
          <span>Beskrivelse</span>
          <span className="text-right">Antall</span>
          <span className="text-right">À-pris</span>
          <span className="text-right">MVA %</span>
          <span className="text-right">Inkl. mva</span>
          <span />
        </div>

        <AnimatePresence initial={false}>
          {/* Derived rows first — always read-only. */}
          {derived.map((row) => (
            <motion.div
              key={row.line_item_id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="border-border grid grid-cols-[4px_1fr_6rem_7rem_5rem_8rem_6rem] items-center gap-3 border-t px-3 py-2 text-sm"
            >
              <span className="bg-primary/40 h-full w-1 rounded-full" aria-hidden />
              <span className="text-muted-foreground">
                <span className="font-mono text-xs">{row.line_type}</span> — {row.description}
              </span>
              <span className="text-right font-mono tabular-nums">{row.quantity}</span>
              <span className="text-right font-mono tabular-nums">
                {row.unit_price.toLocaleString("nb-NO")}
              </span>
              <span className="text-right font-mono tabular-nums">{row.vat_rate}</span>
              <span className="text-right font-mono tabular-nums">
                {row.amount_incl_vat.toLocaleString("nb-NO")}
              </span>
              <span className="text-muted-foreground text-right text-xs">Låst</span>
            </motion.div>
          ))}

          {/* Manual rows — editable. */}
          {manual.map((row) =>
            editingId === row.line_item_id ? (
              <EditRow
                key={row.line_item_id}
                row={row}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSave={(patch) => handleUpdate(row.line_item_id, patch)}
              />
            ) : (
              <motion.div
                key={row.line_item_id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={SPRING}
                className="border-border grid grid-cols-[4px_1fr_6rem_7rem_5rem_8rem_6rem] items-center gap-3 border-t px-3 py-2 text-sm"
              >
                <span className="bg-muted-foreground/40 h-full w-1 rounded-full" aria-hidden />
                <span>{row.description}</span>
                <span className="text-right font-mono tabular-nums">{row.quantity}</span>
                <span className="text-right font-mono tabular-nums">
                  {row.unit_price.toLocaleString("nb-NO")}
                </span>
                <span className="text-right font-mono tabular-nums">{row.vat_rate}</span>
                <span className="text-right font-mono tabular-nums">
                  {row.amount_incl_vat.toLocaleString("nb-NO")}
                </span>
                <span className="flex justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingId(row.line_item_id)}
                    disabled={pending}
                    aria-label="Rediger linje"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(row.line_item_id)}
                    disabled={pending}
                    aria-label="Slett linje"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </motion.div>
            ),
          )}
        </AnimatePresence>

        {/* Totals footer — always shown so the editor mirrors the read-only view. */}
        <div className="bg-muted/30 grid grid-cols-[4px_1fr_6rem_7rem_5rem_8rem_6rem] items-center gap-3 border-t px-3 py-2 text-sm">
          <span />
          <span className="text-muted-foreground col-span-4 text-right">Sum</span>
          <span className="text-right font-mono tabular-nums">
            eks. <span className="text-foreground">{totalExcl.toLocaleString("nb-NO")}</span> · mva{" "}
            <span className="text-foreground">{totalVat.toLocaleString("nb-NO")}</span>
          </span>
          <span className="text-right font-mono font-medium tabular-nums">
            {totalIncl.toLocaleString("nb-NO")}
          </span>
        </div>
      </div>

      <AddLineDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        pending={pending}
        onSubmit={handleAdd}
      />
    </section>
  );
}

// ─── Inline edit row ──────────────────────────────────────────────
function EditRow({
  row,
  pending,
  onCancel,
  onSave,
}: {
  row: Row;
  pending: boolean;
  onCancel: () => void;
  onSave: (patch: {
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
  }) => void;
}) {
  const [description, setDescription] = useState(row.description);
  const [quantity, setQuantity] = useState(row.quantity);
  const [unitPrice, setUnitPrice] = useState(row.unit_price);
  const [vatRate, setVatRate] = useState(row.vat_rate);

  const preview = lineTotals(quantity, unitPrice, vatRate);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SPRING}
      className="border-border bg-muted/10 grid grid-cols-[4px_1fr_6rem_7rem_5rem_8rem_6rem] items-center gap-3 border-t px-3 py-2 text-sm"
    >
      <span className="bg-muted-foreground/40 h-full w-1 rounded-full" aria-hidden />
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="h-9"
        aria-label="Beskrivelse"
      />
      <Input
        type="number"
        step="0.01"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value) || 0)}
        className="h-9 text-right font-mono tabular-nums"
        aria-label="Antall"
      />
      <Input
        type="number"
        step="0.01"
        value={unitPrice}
        onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
        className="h-9 text-right font-mono tabular-nums"
        aria-label="À-pris"
      />
      <Input
        type="number"
        step="0.01"
        value={vatRate}
        onChange={(e) => setVatRate(Number(e.target.value) || 0)}
        className="h-9 text-right font-mono tabular-nums"
        aria-label="MVA prosent"
      />
      <span className="text-right font-mono tabular-nums">
        {preview.incl.toLocaleString("nb-NO")}
      </span>
      <span className="flex justify-end gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() =>
            onSave({ description, quantity, unit_price: unitPrice, vat_rate: vatRate })
          }
          disabled={pending}
          aria-label="Lagre endringer"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
          aria-label="Avbryt redigering"
        >
          <X className="h-4 w-4" />
        </Button>
      </span>
    </motion.div>
  );
}

// ─── Add-line dialog ──────────────────────────────────────────────
function AddLineDialog({
  open,
  onClose,
  pending,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  onSubmit: (patch: {
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
  }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Legg til manuell linje</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSubmit({
              description: String(fd.get("description") ?? ""),
              quantity: Number(fd.get("quantity") ?? 0),
              unit_price: Number(fd.get("unit_price") ?? 0),
              vat_rate: Number(fd.get("vat_rate") ?? 25),
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="description">Beskrivelse</Label>
            <Input id="description" name="description" required maxLength={500} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Antall</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_price">À-pris</Label>
              <Input
                id="unit_price"
                name="unit_price"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat_rate">MVA %</Label>
              <Input
                id="vat_rate"
                name="vat_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                defaultValue={25}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Legger til…" : "Legg til linje"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
