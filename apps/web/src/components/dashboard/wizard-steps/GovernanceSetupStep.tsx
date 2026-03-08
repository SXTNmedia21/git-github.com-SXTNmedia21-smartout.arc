"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Plus,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  FileText,
  ChevronDown,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  FILTER_QUESTIONS,
  getVisibleTemplates,
  useIndustryFilters,
  useCreatedPolicies,
  useCreateFromTemplate,
} from "@/app/dashboard/governance/_hooks/use-governance-templates";
import type {
  FilterKey,
  GovernanceTemplate,
} from "@/app/dashboard/governance/_hooks/use-governance-templates";
import { PolicyForm } from "@/app/dashboard/governance/_components/PolicyForm";

// ─── TemplateCard ──────────────────────────────────────────

function TemplateCard({
  template,
  isDark,
  isCreated,
  isCreating,
  isMandatory,
  isChecked,
  onToggle,
  onCreate,
}: {
  template: GovernanceTemplate;
  isDark: boolean;
  isCreated: boolean;
  isCreating: boolean;
  isMandatory: boolean;
  isChecked: boolean;
  onToggle?: () => void;
  onCreate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const procedureCount = template.procedures.length;
  const stepCount = template.procedures.reduce((sum, p) => sum + p.steps.length, 0);
  const hasQuestions = template.knowledgeTest.questions.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={`overflow-hidden rounded-xl border transition-colors ${
          isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-white"
        }`}
      >
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center justify-between px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {/* Toggle for recommended only */}
              {!isMandatory && onToggle && (
                <Switch
                  checked={isChecked}
                  onCheckedChange={onToggle}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                />
              )}

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-semibold ${
                    isDark ? "text-zinc-200" : "text-zinc-800"
                  }`}
                >
                  {template.name}
                </p>
                {template.description && (
                  <p className={`truncate text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                    {template.description}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    <FileText className="h-3 w-3" />
                    {procedureCount} prosedyre{procedureCount !== 1 ? "r" : ""}
                  </span>
                  {hasQuestions && (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      1 test
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="ml-3 flex shrink-0 items-center gap-2">
              {/* Action */}
              {isCreated ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : isCreating ? (
                <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreate();
                  }}
                  disabled={!isMandatory && !isChecked}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    !isMandatory && !isChecked
                      ? "cursor-not-allowed opacity-40"
                      : "bg-orange-500 text-white hover:bg-orange-600"
                  }`}
                >
                  Opprett
                </button>
              )}
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div
            className={`space-y-2 border-t px-4 py-3 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
          >
            <p className={`text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
              {template.longDescription}
            </p>
            <p className={`text-[10px] font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              Inkluderer: {procedureCount} prosedyre{procedureCount !== 1 ? "r" : ""}, {stepCount}{" "}
              steg, {hasQuestions ? "1 kunnskapstest, " : ""}1 bekreftelse
            </p>
            <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              Alle ansatte i berorte avdelinger far dette som opplaering. De ma lese prosedyrene,
              besta en kunnskapstest, og signere en bekreftelse.
            </p>
            {template.legalBasis && (
              <p
                className={`text-[10px] font-medium ${isDark ? "text-amber-400/70" : "text-amber-600/70"}`}
              >
                {"\u2696"} {template.legalBasis}
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── GovernanceSetupStep ───────────────────────────────────

export function GovernanceSetupStep({ isDark }: { isDark: boolean }) {
  const industryDefaults = useIndustryFilters();
  const { data: createdPolicies } = useCreatedPolicies();
  const createFromTemplate = useCreateFromTemplate();

  // ── State ──
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>(() => industryDefaults);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [hasUserEdited, setHasUserEdited] = useState(false);

  // Sync industry defaults when query resolves
  useEffect(() => {
    if (!hasUserEdited) setFilters(industryDefaults);
  }, [industryDefaults, hasUserEdited]);

  // ── Derived data ──
  const { mandatory, recommended } = useMemo(() => getVisibleTemplates(filters), [filters]);

  const selectedRecommended = useMemo(
    () => recommended.filter((t) => !unchecked.has(t.id)),
    [recommended, unchecked],
  );

  const createdNames = useMemo(() => {
    const names = new Set<string>();
    for (const p of createdPolicies ?? []) {
      names.add(p.name);
    }
    return names;
  }, [createdPolicies]);

  // ── Handlers ──
  const handleFilterToggle = useCallback((key: FilterKey) => {
    setHasUserEdited(true);
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleTemplateToggle = useCallback((id: string) => {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCreate = useCallback(
    (template: GovernanceTemplate) => {
      if (createdNames.has(template.name)) return;
      setCreatingId(template.id);
      createFromTemplate.mutate(template, {
        onSettled: () => setCreatingId(null),
      });
    },
    [createdNames, createFromTemplate],
  );

  const handleCreateAll = useCallback(() => {
    const all = [...mandatory, ...selectedRecommended].filter((t) => !createdNames.has(t.name));
    if (all.length === 0) return;
    let chain = Promise.resolve();
    for (const template of all) {
      chain = chain.then(
        () =>
          new Promise<void>((resolve) => {
            setCreatingId(template.id);
            createFromTemplate.mutate(template, {
              onSettled: () => {
                setCreatingId(null);
                resolve();
              },
            });
          }),
      );
    }
  }, [mandatory, selectedRecommended, createdNames, createFromTemplate]);

  const uncreatedCount = [...mandatory, ...selectedRecommended].filter(
    (t) => !createdNames.has(t.name),
  ).length;

  // ── Render ──
  return (
    <div className="space-y-8">
      {/* ── Section 1: Filter questions ── */}
      <div className="space-y-3">
        <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
          Hva gjelder for dere?
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FILTER_QUESTIONS.map((q) => (
            <label
              key={q.key}
              className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                filters[q.key]
                  ? isDark
                    ? "border-orange-500/40 bg-orange-500/5"
                    : "border-orange-300 bg-orange-50/50"
                  : isDark
                    ? "border-zinc-800 bg-zinc-900/30"
                    : "border-zinc-200 bg-zinc-50/50"
              }`}
            >
              <span className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {q.label}
              </span>
              <Switch checked={filters[q.key]} onCheckedChange={() => handleFilterToggle(q.key)} />
            </label>
          ))}
        </div>
      </div>

      {/* ── Section 2: Suggested templates ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Foreslåtte retningslinjer
          </h3>
          {uncreatedCount > 0 && (
            <button
              onClick={handleCreateAll}
              disabled={creatingId !== null}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                creatingId !== null
                  ? "cursor-not-allowed opacity-50"
                  : "bg-orange-500 text-white hover:bg-orange-600"
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              Opprett alle ({uncreatedCount})
            </button>
          )}
        </div>

        {/* Mandatory group */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-red-500" />
            <span
              className={`text-xs font-bold tracking-wider uppercase ${
                isDark ? "text-red-400/80" : "text-red-600/80"
              }`}
            >
              Lovpålagt
            </span>
          </div>
          <div className="space-y-2">
            {mandatory.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                isDark={isDark}
                isCreated={createdNames.has(t.name)}
                isCreating={creatingId === t.id}
                isMandatory
                isChecked
                onCreate={() => handleCreate(t)}
              />
            ))}
          </div>
        </div>

        {/* Recommended group */}
        {recommended.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-500" />
              <span
                className={`text-xs font-bold tracking-wider uppercase ${
                  isDark ? "text-orange-400/80" : "text-orange-600/80"
                }`}
              >
                Anbefalt for din virksomhet
              </span>
            </div>
            <div className="space-y-2">
              {recommended.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  isDark={isDark}
                  isCreated={createdNames.has(t.name)}
                  isCreating={creatingId === t.id}
                  isMandatory={false}
                  isChecked={!unchecked.has(t.id)}
                  onToggle={() => handleTemplateToggle(t.id)}
                  onCreate={() => handleCreate(t)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Custom policies ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Egne retningslinjer
          </h3>
          <PolicyForm />
        </div>

        {(createdPolicies ?? []).length > 0 && (
          <div className="space-y-1.5">
            {(createdPolicies ?? []).map((p) => {
              const procCount = p.protocol?.procedure?.length ?? 0;
              return (
                <div
                  key={p.policy_id}
                  className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${
                    isDark ? "bg-zinc-900/40" : "bg-zinc-50"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span
                    className={`flex-1 truncate text-sm font-medium ${
                      isDark ? "text-zinc-300" : "text-zinc-700"
                    }`}
                  >
                    {p.name}
                  </span>
                  <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                    {procCount} prosedyre{procCount !== 1 ? "r" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
