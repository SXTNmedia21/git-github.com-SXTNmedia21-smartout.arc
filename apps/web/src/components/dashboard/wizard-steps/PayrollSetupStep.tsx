"use client";

import { useState, useCallback, useContext, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpTip } from "@/components/dashboard/wizard-steps/HelpTip";
import type { IndustryTariff } from "@/lib/industry/types";

// ─── Types ───────────────────────────────────────────────

type SupplementState = {
  kveldstillegg: { rate: number; unit: string; from_hour: string; to_hour: string };
  helgetillegg: { rate: number; unit: string; days: string[] };
  helligdagstillegg: { rate: number; unit: string };
  overtid_50: { threshold_hours: number; unit: string };
  overtid_100: { threshold_hours: number; unit: string };
};

type CustomSupplement = {
  id: string;
  name: string;
  rate: number;
  unit: string;
  description: string;
};

type PositionWage = {
  position_id: string;
  name: string;
  hourly_rate: number;
};

// ─── Constants ───────────────────────────────────────────

const EMPTY_SUPPLEMENT_STATE: SupplementState = {
  kveldstillegg: { rate: 0, unit: "kr/t", from_hour: "21:00", to_hour: "06:00" },
  helgetillegg: { rate: 0, unit: "kr/t", days: ["lordag", "sondag"] },
  helligdagstillegg: { rate: 0, unit: "%" },
  overtid_50: { threshold_hours: 9, unit: "t/dag" },
  overtid_100: { threshold_hours: 13, unit: "t/dag" },
};

const SUPPLEMENT_LABELS: Record<keyof SupplementState, string> = {
  kveldstillegg: "Kveldstillegg",
  helgetillegg: "Helgetillegg",
  helligdagstillegg: "Helligdagstillegg",
  overtid_50: "Overtid 50%",
  overtid_100: "Overtid 100%",
};

// ─── PayrollSetupStep ────────────────────────────────────

export function PayrollSetupStep({
  isDark,
  industryTariffs,
  defaultTariffKey,
  extractedPayroll,
}: {
  isDark: boolean;
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

  // ── Derived from industry package ──
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

  const tariffPresets = useMemo(() => {
    const presets: Record<string, SupplementState> = {};
    if (industryTariffs) {
      for (const t of industryTariffs) {
        presets[t.key] = t.supplements;
      }
    }
    presets.ingen = EMPTY_SUPPLEMENT_STATE;
    presets.annen = EMPTY_SUPPLEMENT_STATE;
    return presets;
  }, [industryTariffs]);

  const getHourlyRate = useCallback(
    (tariffKey: string) => {
      const tariff = industryTariffs?.find((t) => t.key === tariffKey);
      return tariff?.minWagePerHour ?? 0;
    },
    [industryTariffs],
  );

  // ── State ──
  const initialTariff = defaultTariffKey ?? "ingen";
  const [selectedTariff, setSelectedTariff] = useState(initialTariff);
  const [supplements, setSupplements] = useState<SupplementState>(
    () => tariffPresets[initialTariff] ?? EMPTY_SUPPLEMENT_STATE,
  );
  const [positionWages, setPositionWages] = useState<PositionWage[]>([]);
  const [customSupplements, setCustomSupplements] = useState<CustomSupplement[]>([]);
  const [wagesInitialized, setWagesInitialized] = useState(false);

  // ── Queries ──
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

  const { data: positions } = useQuery({
    queryKey: ["positions", workspace.workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("position")
        .select("position_id, name")
        .eq("workspace_id", workspace.workspace.workspace_id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const stablePositions = useMemo(() => positions ?? [], [positions]);

  // Initialize position wages when positions load
  useEffect(() => {
    if (stablePositions.length > 0 && !wagesInitialized) {
      const defaultRate = getHourlyRate(selectedTariff);
      setPositionWages(
        stablePositions.map((p) => ({
          position_id: p.position_id,
          name: p.name,
          hourly_rate: defaultRate,
        })),
      );
      setWagesInitialized(true);
    }
  }, [stablePositions, wagesInitialized, selectedTariff, getHourlyRate]);

  // Wire extracted payroll — pre-fill from extraction data
  useEffect(() => {
    if (!extractedPayroll?.tariff) return;
    const match = tariffOptions.find((o) =>
      o.label.toLowerCase().includes(extractedPayroll.tariff!.toLowerCase()),
    );
    if (match) {
      handleTariffChange(match.value);
    }
  }, [extractedPayroll]); // Pre-fill runs once when extraction data arrives

  // ── Handlers ──
  const handleTariffChange = useCallback(
    (value: string) => {
      setSelectedTariff(value);
      setSupplements(tariffPresets[value] ?? EMPTY_SUPPLEMENT_STATE);
      const rate = getHourlyRate(value);
      setPositionWages((prev) => prev.map((pw) => ({ ...pw, hourly_rate: rate })));
    },
    [tariffPresets, getHourlyRate],
  );

  const handleSupplementChange = useCallback(
    (key: keyof SupplementState, field: string, value: string) => {
      setSupplements((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          [field]: field === "rate" || field === "threshold_hours" ? Number(value) || 0 : value,
        },
      }));
    },
    [],
  );

  const handleWageChange = useCallback((positionId: string, value: string) => {
    setPositionWages((prev) =>
      prev.map((pw) =>
        pw.position_id === positionId ? { ...pw, hourly_rate: Number(value) || 0 } : pw,
      ),
    );
  }, []);

  const handleAddCustomSupplement = useCallback(() => {
    setCustomSupplements((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        rate: 0,
        unit: "kr/t",
        description: "",
      },
    ]);
  }, []);

  const handleRemoveCustomSupplement = useCallback((id: string) => {
    setCustomSupplements((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleCustomSupplementChange = useCallback(
    (id: string, field: keyof Omit<CustomSupplement, "id" | "unit">, value: string) => {
      setCustomSupplements((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, [field]: field === "rate" ? Number(value) || 0 : value } : s,
        ),
      );
    },
    [],
  );

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();

      // Delete existing payroll policies first (upsert pattern)
      await supabase
        .from("policy")
        .delete()
        .eq("workspace_id", workspace.workspace.workspace_id)
        .eq("policy_type", "payroll");

      // Insert tariff + supplements policy
      const { error: tariffError } = await supabase.from("policy").insert({
        name: "Tariffavtale og tillegg",
        statement: "Lønnstillegg og overtidsregler",
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
      if (tariffError) throw tariffError;

      // Insert position wages policy (only if positions exist)
      if (positionWages.length > 0) {
        const { error: wagesError } = await supabase.from("policy").insert({
          name: "Stillingslønn",
          statement: "Grunnlønn per stilling",
          policy_type: "payroll" as const,
          policy_scope: "workspace" as const,
          workspace_id: workspace.workspace.workspace_id,
          created_by: profileId ?? "",
          rules_json: {
            positions: positionWages,
          } as unknown as Json,
        });
        if (wagesError) throw wagesError;
      }
    },
    onSuccess: () => {
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: { trackingId: "payroll-setup-saved" },
      });
      toast.success("Lønnsoppsett lagret");
      void queryClient.invalidateQueries({
        queryKey: ["payroll-policies", workspace.workspace.workspace_id],
      });
    },
    onError: () => {
      toast.error("Kunne ikke lagre lønnsoppsett");
    },
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation.mutate]);

  const hasSaved = (existingPolicies ?? []).length > 0;

  // ── Render ──
  return (
    <div className="space-y-8">
      {/* Status banner */}
      {hasSaved && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${
            isDark ? "border-emerald-500/30 bg-emerald-500/10" : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <span
            className={`text-sm font-medium ${isDark ? "text-emerald-300" : "text-emerald-700"}`}
          >
            Lønnsoppsett er lagret
          </span>
        </div>
      )}

      {/* ── Del 1: Tariffavtale ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Tariffavtale
          </h3>
          <HelpTip text="Tariffavtalen bestemmer minstelønn og tillegg. Velg den avtalen din virksomhet følger." />
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
                  ? isDark
                    ? "border-orange-500/40 bg-orange-500/5"
                    : "border-orange-300 bg-orange-50/50"
                  : isDark
                    ? "border-zinc-800 bg-zinc-900/30"
                    : "border-zinc-200 bg-zinc-50/50"
              }`}
            >
              <RadioGroupItem value={option.value} />
              <span className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {option.label}
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* ── Del 2: Tillegg ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Tillegg
          </h3>
          <HelpTip text="Tillegg er ekstra betaling for kvelds-, helge- og overtidsarbeid. Satsene er forhåndsutfylt fra valgt tariff." />
        </div>
        <div
          className={`overflow-hidden rounded-xl border ${
            isDark ? "border-zinc-800" : "border-zinc-200"
          }`}
        >
          {/* Header */}
          <div
            className={`grid grid-cols-[1fr_100px_60px_1fr] gap-3 px-4 py-2 text-xs font-semibold tracking-wider uppercase ${
              isDark ? "bg-zinc-900/70 text-zinc-500" : "bg-zinc-50 text-zinc-400"
            }`}
          >
            <span>Type</span>
            <span>Sats</span>
            <span>Enhet</span>
            <span>Detaljer</span>
          </div>

          {/* Kveldstillegg */}
          <div
            className={`grid grid-cols-[1fr_100px_60px_1fr] items-center gap-3 border-t px-4 py-3 ${
              isDark ? "border-zinc-800" : "border-zinc-200"
            }`}
          >
            <Label className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              {SUPPLEMENT_LABELS.kveldstillegg}
            </Label>
            <Input
              type="number"
              value={supplements.kveldstillegg.rate}
              onChange={(e) => handleSupplementChange("kveldstillegg", "rate", e.target.value)}
              className="h-8 text-sm"
            />
            <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {supplements.kveldstillegg.unit}
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={supplements.kveldstillegg.from_hour}
                onChange={(e) =>
                  handleSupplementChange("kveldstillegg", "from_hour", e.target.value)
                }
                className="h-8 w-24 text-sm"
              />
              <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>-</span>
              <Input
                type="time"
                value={supplements.kveldstillegg.to_hour}
                onChange={(e) => handleSupplementChange("kveldstillegg", "to_hour", e.target.value)}
                className="h-8 w-24 text-sm"
              />
            </div>
          </div>

          {/* Helgetillegg */}
          <div
            className={`grid grid-cols-[1fr_100px_60px_1fr] items-center gap-3 border-t px-4 py-3 ${
              isDark ? "border-zinc-800" : "border-zinc-200"
            }`}
          >
            <Label className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              {SUPPLEMENT_LABELS.helgetillegg}
            </Label>
            <Input
              type="number"
              value={supplements.helgetillegg.rate}
              onChange={(e) => handleSupplementChange("helgetillegg", "rate", e.target.value)}
              className="h-8 text-sm"
            />
            <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {supplements.helgetillegg.unit}
            </span>
            <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              {supplements.helgetillegg.days.join(", ")}
            </span>
          </div>

          {/* Helligdagstillegg */}
          <div
            className={`grid grid-cols-[1fr_100px_60px_1fr] items-center gap-3 border-t px-4 py-3 ${
              isDark ? "border-zinc-800" : "border-zinc-200"
            }`}
          >
            <Label className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              {SUPPLEMENT_LABELS.helligdagstillegg}
            </Label>
            <Input
              type="number"
              value={supplements.helligdagstillegg.rate}
              onChange={(e) => handleSupplementChange("helligdagstillegg", "rate", e.target.value)}
              className="h-8 text-sm"
            />
            <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {supplements.helligdagstillegg.unit}
            </span>
            <span />
          </div>

          {/* Overtid 50% */}
          <div
            className={`grid grid-cols-[1fr_100px_60px_1fr] items-center gap-3 border-t px-4 py-3 ${
              isDark ? "border-zinc-800" : "border-zinc-200"
            }`}
          >
            <Label className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              {SUPPLEMENT_LABELS.overtid_50}
            </Label>
            <Input
              type="number"
              value={supplements.overtid_50.threshold_hours}
              onChange={(e) =>
                handleSupplementChange("overtid_50", "threshold_hours", e.target.value)
              }
              className="h-8 text-sm"
            />
            <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {supplements.overtid_50.unit}
            </span>
            <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Etter {supplements.overtid_50.threshold_hours} timer
            </span>
          </div>

          {/* Overtid 100% */}
          <div
            className={`grid grid-cols-[1fr_100px_60px_1fr] items-center gap-3 border-t px-4 py-3 ${
              isDark ? "border-zinc-800" : "border-zinc-200"
            }`}
          >
            <Label className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              {SUPPLEMENT_LABELS.overtid_100}
            </Label>
            <Input
              type="number"
              value={supplements.overtid_100.threshold_hours}
              onChange={(e) =>
                handleSupplementChange("overtid_100", "threshold_hours", e.target.value)
              }
              className="h-8 text-sm"
            />
            <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {supplements.overtid_100.unit}
            </span>
            <span className={`text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Etter {supplements.overtid_100.threshold_hours} timer
            </span>
          </div>

          {/* Custom supplements */}
          {customSupplements.map((cs) => (
            <div
              key={cs.id}
              className={`grid grid-cols-[1fr_100px_60px_1fr] items-center gap-3 border-t px-4 py-3 ${
                isDark ? "border-zinc-800" : "border-zinc-200"
              }`}
            >
              <Input
                type="text"
                value={cs.name}
                onChange={(e) => handleCustomSupplementChange(cs.id, "name", e.target.value)}
                placeholder="Navn på tillegg"
                className="h-8 text-sm"
              />
              <Input
                type="number"
                value={cs.rate || ""}
                onChange={(e) => handleCustomSupplementChange(cs.id, "rate", e.target.value)}
                placeholder="0"
                className="h-8 text-sm"
              />
              <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>kr/t</span>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={cs.description}
                  onChange={(e) =>
                    handleCustomSupplementChange(cs.id, "description", e.target.value)
                  }
                  placeholder="Beskrivelse"
                  className="h-8 flex-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveCustomSupplement(cs.id)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isDark
                      ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                      : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add custom supplement button */}
        <button
          type="button"
          onClick={handleAddCustomSupplement}
          className={`mt-2 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
            isDark
              ? "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <Plus className="h-4 w-4" />
          Legg til tillegg
        </button>
      </div>

      {/* ── Del 3: Stillingslønn ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Stillingslønn
          </h3>
          <HelpTip text="Sett grunnlønn per stilling. Denne brukes som default når du inviterer ansatte." />
        </div>

        {stablePositions.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Ingen stillinger opprettet enda. Du kan legge til stillinger under Organisasjon.
          </p>
        ) : (
          <div className="space-y-2">
            {positionWages.map((pw) => (
              <div
                key={pw.position_id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-white"
                }`}
              >
                <span
                  className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                >
                  {pw.name}
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.5"
                    value={pw.hourly_rate || ""}
                    onChange={(e) => handleWageChange(pw.position_id, e.target.value)}
                    placeholder="0"
                    className="h-8 w-28 text-right text-sm"
                  />
                  <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                    kr/t
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Save button ── */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
            saveMutation.isPending
              ? "cursor-not-allowed opacity-50"
              : "bg-orange-500 text-white hover:bg-orange-600"
          }`}
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Lagre
        </button>
      </div>
    </div>
  );
}
