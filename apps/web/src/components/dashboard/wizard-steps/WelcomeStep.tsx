"use client";

import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, Pencil, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { IndustryType } from "@/lib/industry/types";
import type { ScrapedIntelligence } from "./wizard-state";

type KnownFact = {
  label: string;
  value: string;
};

const INDUSTRY_OPTIONS: { value: IndustryType; label: string; description: string }[] = [
  {
    value: "hospitality",
    label: "Restaurant og servering",
    description: "Restaurant, cafe, bar, hotell, catering",
  },
  {
    value: "retail",
    label: "Butikk og handel",
    description: "Dagligvare, klesbutikk, faghandel",
  },
  {
    value: "default",
    label: "Annen bransje",
    description: "Annen type virksomhet",
  },
];

export function WelcomeStep({
  scrapedData,
  detectedIndustry,
  onIndustryChange,
}: {
  scrapedData: ScrapedIntelligence;
  detectedIndustry: IndustryType;
  onIndustryChange: (type: IndustryType) => void;
}) {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist inline edits to DB
  const persistEdit = useMutation({
    mutationFn: async ({ label, value }: { label: string; value: string }) => {
      const supabase = createClient();

      // Map fact labels to DB columns
      if (label === "Bedrift") {
        await supabase
          .from("company")
          .update({ name: value })
          .eq("company_id", workspace.company_id!);
        await supabase
          .from("workspace")
          .update({ name: value })
          .eq("workspace_id", workspace.workspace_id);
      } else if (label === "Nettside") {
        await supabase
          .from("company")
          .update({ website: value })
          .eq("company_id", workspace.company_id!);
      } else if (label === "Adresse") {
        await supabase
          .from("company")
          .update({ address_line_1: value })
          .eq("company_id", workspace.company_id!);
      }

      // Update field_sources to mark as user_input
      const fieldMap: Record<string, string> = {
        Bedrift: "name",
        Nettside: "website",
        Adresse: "address",
      };
      const fieldKey = fieldMap[label];
      if (fieldKey) {
        const { data: details } = await supabase
          .from("company_details")
          .select("field_sources")
          .eq("workspace_id", workspace.workspace_id)
          .single();

        const existingSources = (details?.field_sources as Record<string, string>) ?? {};
        await supabase
          .from("company_details")
          .update({
            field_sources: { ...existingSources, [fieldKey]: "user_input" },
          })
          .eq("workspace_id", workspace.workspace_id);
      }
    },
    onSuccess: (_, { label, value }) => {
      void queryClient.invalidateQueries({ queryKey: ["wizard-company", workspace.workspace_id] });
      void emit({
        event: "wizard fact_edited",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: { data: { wizard_id: "dashboard-setup", label, value } },
      });
    },
  });

  const commitEdit = useCallback(
    (label: string, value: string) => {
      setOverrides((prev) => ({ ...prev, [label]: value }));
      setEditingLabel(null);
      // Persist to DB in background
      persistEdit.mutate({ label, value });
    },
    [persistEdit],
  );

  const { data: departments } = useQuery({
    queryKey: ["departments", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("department")
        .select("name")
        .eq("workspace_id", workspace.workspace_id)
        .order("name");
      return data ?? [];
    },
  });

  const facts = useMemo<KnownFact[]>(() => {
    const items: KnownFact[] = [];

    if (scrapedData.companyName) {
      const orgPart = scrapedData.orgNumber ? ` (org.nr ${scrapedData.orgNumber})` : "";
      items.push({
        label: "Bedrift",
        value: `${scrapedData.companyName}${orgPart}`,
      });
    }

    if (scrapedData.industryType) {
      items.push({ label: "Bransje", value: scrapedData.industryType });
    }

    if (scrapedData.openingHours) {
      items.push({
        label: "Åpningstider",
        value: scrapedData.openingHours,
      });
    }

    if (departments && departments.length > 0) {
      items.push({
        label: "Avdelinger",
        value: `${departments.length} avdelinger: ${departments.map((d) => d.name).join(", ")}`,
      });
    }

    if (scrapedData.address) {
      items.push({ label: "Adresse", value: scrapedData.address });
    }

    if (scrapedData.googleRating) {
      items.push({
        label: "Google-vurdering",
        value: `${scrapedData.googleRating} / 5`,
      });
    }

    if (scrapedData.website) {
      items.push({ label: "Nettside", value: scrapedData.website });
    }

    return items;
  }, [scrapedData, departments]);

  return (
    <div className="space-y-8">
      {/* Intro */}
      <div className="space-y-4">
        <div className={`flex items-start gap-3 rounded-xl border p-4 ${"border-border bg-card"}`}>
          <Sparkles className="text-brand-orange mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-2">
            <p className={`text-sm leading-relaxed ${"text-muted-foreground"}`}>
              Smartout er din digitale kollega. Vi sørger for at alle ansatte er klare &mdash;
              trent, compliant, og informert.
            </p>
            <div className="space-y-1.5">
              {[
                {
                  icon: "\ud83d\udccb",
                  text: "Retningslinjer — reglene dine, automatisk til opplæring",
                },
                {
                  icon: "\ud83d\udcc5",
                  text: "Vaktplan — riktig person, riktig tid, riktig rolle",
                },
                {
                  icon: "\ud83d\udd04",
                  text: "Drift — dagen styrer seg selv, fra åpning til stenging",
                },
              ].map((item) => (
                <p key={item.text} className={`text-sm ${"text-muted-foreground"}`}>
                  {item.icon} {item.text}
                </p>
              ))}
            </div>
            <p className={`text-sm font-medium ${"text-foreground"}`}>
              La oss sette opp arbeidsplassen din. Det tar ca. 10 minutter.
            </p>
          </div>
        </div>
      </div>

      {/* Industry selector — mandatory */}
      <div className="space-y-3">
        <h3 className={`text-sm font-bold ${"text-muted-foreground"}`}>
          Hvilken bransje er dere i?
        </h3>
        <RadioGroup
          value={detectedIndustry}
          onValueChange={(v) => onIndustryChange(v as IndustryType)}
          className="grid grid-cols-1 gap-2"
        >
          {INDUSTRY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                detectedIndustry === option.value
                  ? "border-brand-orange bg-brand-orange/50"
                  : "border-border bg-muted"
              }`}
            >
              <RadioGroupItem value={option.value} />
              <div>
                <span className={`text-sm font-medium ${"text-muted-foreground"}`}>
                  {option.label}
                </span>
                <p className={`text-xs ${"text-muted-foreground"}`}>{option.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Known facts */}
      {facts.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-sm font-bold ${"text-muted-foreground"}`}>Det vi allerede vet</h3>
          <div className="space-y-2">
            {facts.map((fact) => {
              const isEditing = editingLabel === fact.label;
              const displayValue = overrides[fact.label] ?? fact.value;

              return (
                <div
                  key={fact.label}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${"border-border bg-card"}`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs ${"text-muted-foreground"}`}>{fact.label}</p>
                      {isEditing ? (
                        <Input
                          ref={inputRef}
                          autoFocus
                          defaultValue={displayValue}
                          className={`mt-0.5 h-7 text-sm font-medium ${"border-border bg-muted text-foreground"}`}
                          onBlur={(e) => commitEdit(fact.label, e.currentTarget.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              commitEdit(fact.label, e.currentTarget.value);
                            }
                          }}
                        />
                      ) : (
                        <p className={`truncate text-sm font-medium ${"text-foreground"}`}>
                          {displayValue}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingLabel(fact.label)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${"text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {facts.length === 0 && (
        <div className={`rounded-xl border border-dashed p-6 text-center ${"border-border"}`}>
          <p className={`text-sm ${"text-muted-foreground"}`}>
            Vi har ikke hentet noe data enda. Gå videre for å fylle ut manuelt.
          </p>
        </div>
      )}
    </div>
  );
}
