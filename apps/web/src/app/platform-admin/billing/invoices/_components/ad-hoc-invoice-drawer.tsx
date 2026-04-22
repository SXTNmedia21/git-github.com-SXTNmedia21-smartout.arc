"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { createAdHocInvoiceAction } from "../../_actions/invoice-editing";

// Fase 2 Spor C — ad-hoc invoice drawer.
//
// Slide-in Sheet from the right (spec §13). Company picker uses
// Popover + Command (shadcn's recommended Combobox pattern). Line
// items are rendered as an editable array with add/remove; each line
// can pick from the product catalog (dropdown) or stay free-text.
// Status + due-date selectable at creation time.

type CompanyOption = { company_id: string; name: string };

type ProductOption = {
  product_id: string;
  name: string;
  description: string | null;
  default_unit_price: number;
  default_vat_rate: number;
  currency: string;
};

type Line = {
  product_id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
};

type InitialStatus = "draft" | "issued" | "sent";

const SPRING = { type: "spring" as const, stiffness: 35, damping: 22, mass: 2.2 };

const EMPTY_LINE: Line = {
  product_id: null,
  description: "",
  quantity: "1",
  unit_price: "0",
  vat_rate: "25",
};

export function AdHocInvoiceDrawer({
  companies,
  products,
}: {
  companies: CompanyOption[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [periodFrom, setPeriodFrom] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [periodTo, setPeriodTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<"NOK" | "EUR">("NOK");
  const [status, setStatus] = useState<InitialStatus>("draft");
  const [dueAt, setDueAt] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.company_id === companyId) ?? null,
    [companies, companyId],
  );

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, l) => {
        const q = Number(l.quantity) || 0;
        const p = Number(l.unit_price) || 0;
        const v = Number(l.vat_rate) || 0;
        const excl = q * p;
        const vat = (excl * v) / 100;
        acc.excl += excl;
        acc.vat += vat;
        acc.incl += excl + vat;
        return acc;
      },
      { excl: 0, vat: 0, incl: 0 },
    );
  }, [lines]);

  const canSubmit =
    companyId !== null &&
    lines.length > 0 &&
    lines.every(
      (l) =>
        l.description.trim().length > 0 &&
        Number(l.quantity) > 0 &&
        Number(l.unit_price) >= 0 &&
        Number(l.vat_rate) >= 0,
    );

  const reset = () => {
    setCompanyId(null);
    setPeriodFrom(new Date().toISOString().slice(0, 10));
    setPeriodTo(new Date().toISOString().slice(0, 10));
    setCurrency("NOK");
    setStatus("draft");
    setDueAt("");
    setLines([{ ...EMPTY_LINE }]);
  };

  const applyProduct = (idx: number, productId: string) => {
    const product = products.find((p) => p.product_id === productId);
    if (!product) return;
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              product_id: product.product_id,
              description: product.name,
              unit_price: String(product.default_unit_price),
              vat_rate: String(product.default_vat_rate),
            }
          : l,
      ),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !companyId) return;

    start(async () => {
      const result = await createAdHocInvoiceAction({
        company_id: companyId,
        period_from: periodFrom,
        period_to: periodTo,
        currency,
        status,
        ...(dueAt ? { due_at: dueAt } : {}),
        line_items: lines.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          vat_rate: Number(l.vat_rate),
        })),
      });

      if (result.ok) {
        toast.success(
          status === "draft"
            ? "Ad-hoc faktura opprettet som utkast"
            : `Ad-hoc faktura opprettet (${status})`,
        );
        reset();
        // Navigation unmounts the drawer — skipping setOpen(false)
        // avoids Radix starting a close animation while the route is
        // being torn down (same null.dispatchEvent race as invoice
        // detail sheet).
        router.push(`/platform-admin/billing/invoices/${result.invoice.invoice_id}`);
      } else {
        toast.error(`Kunne ikke opprette faktura: ${result.error}`);
      }
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <Button onClick={() => setOpen(true)} size="sm" data-testid="ad-hoc-invoice-open">
        <Plus className="mr-2 h-4 w-4" />
        Lag ad-hoc faktura
      </Button>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl"
        data-testid="ad-hoc-invoice-drawer"
      >
        <SheetHeader className="border-border bg-background/80 sticky top-0 z-10 border-b p-6 backdrop-blur-xl">
          <SheetTitle className="font-heading text-2xl">Ad-hoc faktura</SheetTitle>
          <SheetDescription>
            Manuelt opprettet faktura (oppstartsgebyr, egen avtale). Velg status ved opprettelse —
            utkast kan redigeres fritt, utstedt/sendt tildeles fakturanummer umiddelbart.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6 p-6">
          <div className="space-y-2">
            <Label>Selskap</Label>
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={companyOpen}
                  className="w-full justify-between"
                  data-testid="company-picker"
                >
                  {selectedCompany ? selectedCompany.name : "Velg selskap…"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Søk selskap…" />
                  <CommandList>
                    <CommandEmpty>Ingen selskap funnet.</CommandEmpty>
                    <CommandGroup>
                      {companies.map((c) => (
                        <CommandItem
                          key={c.company_id}
                          value={c.name}
                          onSelect={() => {
                            setCompanyId(c.company_id);
                            setCompanyOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              companyId === c.company_id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="period_from">Periode fra</Label>
              <Input
                id="period_from"
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_to">Periode til</Label>
              <Input
                id="period_to"
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="currency">Valuta</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "NOK" | "EUR")}>
                <SelectTrigger id="currency" data-testid="currency-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOK">NOK</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as InitialStatus)}>
                <SelectTrigger id="status" data-testid="status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Utkast</SelectItem>
                  <SelectItem value="issued">Utstedt</SelectItem>
                  <SelectItem value="sent">Sendt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_at">Forfallsdato</Label>
              <Input
                id="due_at"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                disabled={status === "draft"}
                placeholder="Auto: periode + 14d"
              />
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Linjer</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}
                data-testid="add-line"
              >
                <Plus className="mr-2 h-4 w-4" />
                Legg til linje
              </Button>
            </div>

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {lines.map((line, idx) => (
                  <motion.div
                    key={idx}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={SPRING}
                    className="border-border space-y-2 rounded-md border p-3"
                  >
                    {products.length > 0 ? (
                      <div className="space-y-1">
                        <Label htmlFor={`product_${idx}`} className="text-muted-foreground text-xs">
                          Produkt (valgfritt — eller fyll ut manuelt)
                        </Label>
                        <Select
                          value={line.product_id ?? "custom"}
                          onValueChange={(v) => {
                            if (v === "custom") {
                              setLines((prev) =>
                                prev.map((l, i) => (i === idx ? { ...l, product_id: null } : l)),
                              );
                            } else {
                              applyProduct(idx, v);
                            }
                          }}
                        >
                          <SelectTrigger
                            id={`product_${idx}`}
                            data-testid={`line-product-picker-${idx}`}
                          >
                            <SelectValue placeholder="Velg fra katalog…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Egen linje (fri tekst)</SelectItem>
                            {products.map((p) => (
                              <SelectItem key={p.product_id} value={p.product_id}>
                                {p.name} —{" "}
                                {p.default_unit_price.toLocaleString("nb-NO", {
                                  maximumFractionDigits: 2,
                                })}{" "}
                                {p.currency}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-[1fr_5rem_6rem_4rem_auto] items-end gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`desc_${idx}`} className="text-muted-foreground text-xs">
                          Beskrivelse
                        </Label>
                        <Input
                          id={`desc_${idx}`}
                          value={line.description}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx
                                  ? { ...l, description: e.target.value, product_id: null }
                                  : l,
                              ),
                            )
                          }
                          placeholder="Oppstartsgebyr"
                          data-testid={`line-description-${idx}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`qty_${idx}`} className="text-muted-foreground text-xs">
                          Antall
                        </Label>
                        <Input
                          id={`qty_${idx}`}
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={line.quantity}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, quantity: e.target.value } : l,
                              ),
                            )
                          }
                          className="text-right font-mono tabular-nums"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`price_${idx}`} className="text-muted-foreground text-xs">
                          À-pris
                        </Label>
                        <Input
                          id={`price_${idx}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unit_price}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx
                                  ? { ...l, unit_price: e.target.value, product_id: null }
                                  : l,
                              ),
                            )
                          }
                          className="text-right font-mono tabular-nums"
                          data-testid={`line-unit-price-${idx}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`vat_${idx}`} className="text-muted-foreground text-xs">
                          MVA %
                        </Label>
                        <Input
                          id={`vat_${idx}`}
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={line.vat_rate}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l, i) =>
                                i === idx
                                  ? { ...l, vat_rate: e.target.value, product_id: null }
                                  : l,
                              ),
                            )
                          }
                          className="text-right font-mono tabular-nums"
                        />
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setLines((prev) =>
                            prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx),
                          )
                        }
                        disabled={lines.length <= 1}
                        aria-label="Fjern linje"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          <div className="border-border bg-muted/20 rounded-md border p-4">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Sum eks. mva</dt>
              <dd className="text-right font-mono tabular-nums">
                {totals.excl.toLocaleString("nb-NO", { maximumFractionDigits: 2 })}
              </dd>
              <dt className="text-muted-foreground">MVA</dt>
              <dd className="text-right font-mono tabular-nums">
                {totals.vat.toLocaleString("nb-NO", { maximumFractionDigits: 2 })}
              </dd>
              <dt className="font-medium">Totalt inkl. mva</dt>
              <dd className="text-right font-mono font-medium tabular-nums">
                {totals.incl.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} {currency}
              </dd>
            </dl>
          </div>

          <div className="border-border mt-auto flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={!canSubmit || pending} data-testid="submit-invoice">
              {pending ? "Oppretter…" : "Opprett faktura"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
