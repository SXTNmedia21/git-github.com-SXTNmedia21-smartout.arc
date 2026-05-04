"use client";

import { useState, useCallback, useContext, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import type { TariffSupplement, IndustryTariff } from "@smartout/types";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit, nonEmpty } from "@smartout/telemetry";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { HelpTip } from "@/components/dashboard/wizard-steps/HelpTip";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { usePayrollTools } from "./tools/payroll-tools";

// ─── Add Supplement Dialog ──────────────────────────────

const EMPTY_DRAFT: Omit<TariffSupplement, "id"> = {
  name: "",
  rate: 0,
  unit: "kr/t",
  condition_type: "always",
  from_hour: "21:00",
  to_hour: "06:00",
  after_hours: 2,
  description: "",
};

function AddSupplementDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (supplement: TariffSupplement) => void;
}) {
  const [draft, setDraft] = useState<Omit<TariffSupplement, "id">>(EMPTY_DRAFT);

  const handleAdd = useCallback(() => {
    if (!draft.name.trim()) {
      toast.error("Gi tillegget et navn");
      return;
    }
    onAdd({ ...draft, id: crypto.randomUUID() });
    setDraft(EMPTY_DRAFT);
    onOpenChange(false);
  }, [draft, onAdd, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Legg til tillegg</DialogTitle>
          <DialogDescription>
            Definer et nytt l&oslash;nnstillegg med sats og betingelser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm">Navn</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="F.eks. Nattillegg, Ansiennitetstillegg"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Sats</Label>
              <Input
                type="number"
                value={draft.rate || ""}
                onChange={(e) => setDraft((d) => ({ ...d, rate: Number(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Type</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, unit: "kr/t" }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    draft.unit === "kr/t"
                      ? "border-brand-orange bg-brand-orange/5 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  kr/t
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, unit: "%" }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    draft.unit === "%"
                      ? "border-brand-orange bg-brand-orange/5 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  %
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Betingelse</Label>
            <div className="flex gap-2">
              {(["always", "time_range", "after_hours", "days"] as const).map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, condition_type: ct }))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    draft.condition_type === ct
                      ? "border-brand-orange bg-brand-orange/5 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {ct === "always" && "Alltid"}
                  {ct === "time_range" && "Tidsrom"}
                  {ct === "after_hours" && "Etter X t"}
                  {ct === "days" && "Ukedager"}
                </button>
              ))}
            </div>
          </div>

          {draft.condition_type === "time_range" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Fra</Label>
                <Input
                  type="time"
                  value={draft.from_hour ?? "21:00"}
                  onChange={(e) => setDraft((d) => ({ ...d, from_hour: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Til</Label>
                <Input
                  type="time"
                  value={draft.to_hour ?? "06:00"}
                  onChange={(e) => setDraft((d) => ({ ...d, to_hour: e.target.value }))}
                />
              </div>
            </div>
          )}

          {draft.condition_type === "after_hours" && (
            <div className="space-y-2">
              <Label className="text-sm">Etter antall timer</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={draft.after_hours ?? 2}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, after_hours: Number(e.target.value) || 0 }))
                  }
                  className="w-28"
                />
                <span className="text-muted-foreground text-sm">timer</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm">Beskrivelse (valgfritt)</Label>
            <Input
              value={draft.description ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="F.eks. Gjelder alle ansatte med nattskift"
            />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground hover:text-foreground rounded-lg border px-4 py-2 text-sm transition-colors"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="bg-brand-orange hover:bg-brand-orange/90 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Legg til
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Supplement description helper ──────────────────────

function supplementConditionText(s: TariffSupplement): string {
  if (s.condition_type === "time_range" && s.from_hour && s.to_hour)
    return `${s.from_hour} \u2013 ${s.to_hour}`;
  if (s.condition_type === "after_hours" && s.after_hours) return `Etter ${s.after_hours} timer`;
  if (s.condition_type === "days" && s.days?.length) return s.days.join(", ");
  return s.description ?? "";
}

// ─── PayrollSetupStep ────────────────────────────────────

export function PayrollSetupStep({
  industryTariffs,
  defaultTariffKey,
  extractedPayroll,
}: {
  industryTariffs?: IndustryTariff[];
  defaultTariffKey?: string;
  extractedPayroll?: {
    tariff?: string;
    supplements?: Record<string, unknown>;
    source: string;
  };
}) {
  const workspace = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  const tariffOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    if (industryTariffs) {
      for (const t of industryTariffs) {
        options.push({ value: t.key, label: t.label });
      }
    }
    options.push({ value: "ingen", label: "Ingen tariffavtale" });
    options.push({ value: "annen", label: "Annen" });
    return options;
  }, [industryTariffs]);

  const tariffSupplementMap = useMemo(() => {
    const map: Record<string, TariffSupplement[]> = {};
    if (industryTariffs) {
      for (const t of industryTariffs) {
        map[t.key] = t.supplements;
      }
    }
    map.ingen = [];
    map.annen = [];
    return map;
  }, [industryTariffs]);

  // ── State ──
  const initialTariff = defaultTariffKey ?? "ingen";
  const [selectedTariff, setSelectedTariff] = useState(initialTariff);
  const [supplements, setSupplements] = useState<TariffSupplement[]>(
    () => tariffSupplementMap[initialTariff] ?? [],
  );
  const [customSupplements, setCustomSupplements] = useState<TariffSupplement[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: existingPolicies } = useQuery({
    queryKey: ["payroll-policies", workspace.workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("policy")
        .select("policy_id, name, rules_json")
        .eq("workspace_id", workspace.workspace.workspace_id)
        .eq("policy_type", "payroll")
        .eq("is_active", true);
      return data ?? [];
    },
  });

  // ── Handlers ──
  const handleTariffChange = useCallback(
    (value: string) => {
      setSelectedTariff(value);
      setSupplements(tariffSupplementMap[value] ?? []);
    },
    [tariffSupplementMap],
  );

  useEffect(() => {
    if (!extractedPayroll?.tariff) return;
    const match = tariffOptions.find((o) =>
      o.label.toLowerCase().includes(extractedPayroll.tariff!.toLowerCase()),
    );
    if (match) handleTariffChange(match.value);
  }, [extractedPayroll, handleTariffChange, tariffOptions]);

  const handleSupplementRateChange = useCallback((id: string, value: string) => {
    setSupplements((prev) =>
      prev.map((s) => (s.id === id ? { ...s, rate: Number(value) || 0 } : s)),
    );
  }, []);

  const handleRemoveSupplement = useCallback((id: string) => {
    setSupplements((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleAddCustom = useCallback((supplement: TariffSupplement) => {
    setCustomSupplements((prev) => [...prev, supplement]);
  }, []);

  const handleRemoveCustom = useCallback((id: string) => {
    setCustomSupplements((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // ── Save ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      await supabase
        .from("policy")
        .delete()
        .eq("workspace_id", workspace.workspace.workspace_id)
        .eq("policy_type", "payroll");

      const { error } = await supabase.from("policy").insert({
        name: "Tariffavtale og tillegg",
        statement: "L\u00f8nnstillegg og overtidsregler",
        policy_type: "payroll" as const,
        policy_scope: "workspace" as const,
        workspace_id: workspace.workspace.workspace_id,
        created_by: profileId ?? "",
        rules_json: {
          tariff: selectedTariff,
          supplements,
          custom_supplements: customSupplements.filter((s) => s.name.trim() !== ""),
        } as unknown as Json,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void emit({
        event: "button clicked",
        workspace_id: nonEmpty(workspace.workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: { trackingId: "payroll-setup-saved" },
      });
      toast.success("L\u00f8nnsoppsett lagret");
      void queryClient.invalidateQueries({
        queryKey: ["payroll-policies", workspace.workspace.workspace_id],
      });
    },
    onError: () => {
      toast.error("Kunne ikke lagre l\u00f8nnsoppsett");
    },
  });

  const hasSaved = (existingPolicies ?? []).length > 0;
  const allSupplements = [...supplements, ...customSupplements];

  const payrollTools = usePayrollTools(
    selectedTariff,
    allSupplements,
    tariffOptions,
    handleTariffChange,
    handleAddCustom,
  );
  useRegisterTools("wizard-setup-payroll", payrollTools);

  return (
    <div className="space-y-8">
      <AddSupplementDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddCustom}
      />

      {hasSaved && (
        <div className="border-success bg-success flex items-center gap-2 rounded-xl border px-4 py-3">
          <CheckCircle2 className="text-success h-5 w-5" />
          <span className="text-success text-sm font-medium">L&oslash;nnsoppsett er lagret</span>
        </div>
      )}

      {/* Tariffavtale */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-muted-foreground text-sm font-bold">Tariffavtale</h3>
          <HelpTip text="Tariffavtalen bestemmer tillegg og satser. Velg den avtalen din virksomhet f\u00f8lger." />
        </div>
        <RadioGroup
          value={selectedTariff}
          onValueChange={handleTariffChange}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {tariffOptions.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                selectedTariff === option.value
                  ? "border-brand-orange bg-brand-orange/5"
                  : "border-border bg-muted"
              }`}
            >
              <RadioGroupItem value={option.value} />
              <span className="text-sm font-medium">{option.label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Tillegg */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-muted-foreground text-sm font-bold">Tillegg</h3>
          {supplements.length > 0 && (
            <span className="text-muted-foreground text-xs">
              {supplements.length} fra tariff
              {customSupplements.length > 0 ? ` + ${customSupplements.length} egne` : ""}
            </span>
          )}
        </div>

        {allSupplements.length > 0 ? (
          <div className="border-border overflow-hidden rounded-xl border">
            <div className="bg-muted text-muted-foreground grid grid-cols-[1fr_80px_50px_1fr_32px] gap-3 px-4 py-2 text-xs font-semibold tracking-wider uppercase">
              <span>Tillegg</span>
              <span>Sats</span>
              <span>Type</span>
              <span>Betingelse</span>
              <span />
            </div>

            {supplements.map((s) => (
              <div
                key={s.id}
                className="border-border grid grid-cols-[1fr_80px_50px_1fr_32px] items-center gap-3 border-t px-4 py-3"
              >
                <span className="text-foreground text-sm font-medium">{s.name}</span>
                <Input
                  type="number"
                  value={s.rate}
                  onChange={(e) => handleSupplementRateChange(s.id, e.target.value)}
                  className="h-8 text-sm"
                />
                <span className="text-muted-foreground text-xs">{s.unit}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {supplementConditionText(s)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveSupplement(s.id)}
                  className="text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {customSupplements.map((s) => (
              <div
                key={s.id}
                className="border-brand-orange/20 bg-brand-orange/5 grid grid-cols-[1fr_80px_50px_1fr_32px] items-center gap-3 border-t px-4 py-3"
              >
                <span className="text-foreground text-sm font-medium">{s.name}</span>
                <span className="text-foreground text-sm">{s.rate}</span>
                <span className="text-muted-foreground text-xs">{s.unit}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {supplementConditionText(s)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveCustom(s.id)}
                  className="text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-border rounded-xl border border-dashed px-5 py-6 text-center">
            <p className="text-muted-foreground text-sm">
              Ingen tillegg. Legg til egne tillegg nedenfor.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAddDialogOpen(true)}
          className="border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Legg til tillegg
        </button>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
            saveMutation.isPending
              ? "cursor-not-allowed opacity-50"
              : "bg-brand-orange hover:bg-brand-orange/90 text-white"
          }`}
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Lagre
        </button>
      </div>
    </div>
  );
}
