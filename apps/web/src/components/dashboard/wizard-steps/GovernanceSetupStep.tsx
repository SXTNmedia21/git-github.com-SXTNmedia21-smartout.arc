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
  ScrollText,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  FILTER_QUESTIONS,
  getVisibleTemplates,
  useCreatedPolicies,
  useCreateFromTemplate,
} from "@/app/dashboard/governance/_hooks/use-governance-templates";
import type {
  FilterKey,
  GovernanceTemplate,
} from "@/app/dashboard/governance/_hooks/use-governance-templates";
import type { IndustryPackage } from "@/lib/industry/types";

// ─── TemplateCard (used inside drawer) ───────────────────

function TemplateCard({
  template,
  isCreated,
  isCreating,
  isMandatory,
  isChecked,
  onToggle,
  onCreate,
}: {
  template: GovernanceTemplate;
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
      <div className="border-border bg-card overflow-hidden rounded-xl border transition-colors">
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center justify-between px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {!isMandatory && onToggle && (
                <Switch
                  checked={isChecked}
                  onCheckedChange={onToggle}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-semibold">{template.name}</p>
                {template.description && (
                  <p className="text-muted-foreground truncate text-sm">{template.description}</p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                    <FileText className="h-3 w-3" />
                    {procedureCount} prosedyre{procedureCount !== 1 ? "r" : ""}
                  </span>
                  {hasQuestions && (
                    <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                      1 test
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="ml-3 flex shrink-0 items-center gap-2">
              {isCreated ? (
                <CheckCircle2 className="text-success h-5 w-5" />
              ) : isCreating ? (
                <Loader2 className="text-brand-orange h-5 w-5 animate-spin" />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreate();
                  }}
                  disabled={!isMandatory && !isChecked}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    !isMandatory && !isChecked
                      ? "cursor-not-allowed opacity-40"
                      : "bg-brand-orange hover:bg-brand-orange/90 text-white"
                  }`}
                >
                  Aktiver
                </button>
              )}
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-border space-y-2 border-t px-4 py-3">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {template.longDescription}
            </p>
            <p className="text-muted-foreground text-xs font-medium">
              Inkluderer: {procedureCount} prosedyre{procedureCount !== 1 ? "r" : ""}, {stepCount}{" "}
              steg, {hasQuestions ? "1 kunnskapstest, " : ""}1 bekreftelse
            </p>
            <p className="text-muted-foreground text-xs">
              Alle ansatte i ber&oslash;rte avdelinger f&aring;r dette som oppl&aelig;ring. De
              m&aring; lese prosedyrene, best&aring; en kunnskapstest, og signere en bekreftelse.
            </p>
            {template.legalBasis && (
              <p className="text-warning/70 text-xs font-medium">&#x2696; {template.legalBasis}</p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Governance Drawer ───────────────────────────────────

function GovernanceDrawer({
  open,
  onOpenChange,
  mandatory,
  recommended,
  unchecked,
  createdNames,
  creatingId,
  onTemplateToggle,
  onCreate,
  onCreateAll,
  uncreatedCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mandatory: GovernanceTemplate[];
  recommended: GovernanceTemplate[];
  unchecked: Set<string>;
  createdNames: Set<string>;
  creatingId: string | null;
  onTemplateToggle: (id: string) => void;
  onCreate: (template: GovernanceTemplate) => void;
  onCreateAll: () => void;
  uncreatedCount: number;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Retningslinjer og policies</SheetTitle>
          <SheetDescription>
            Aktiver retningslinjene som gjelder for din virksomhet. Lovp&aring;lagte m&aring;
            aktiveres.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Create all button */}
          {uncreatedCount > 0 && (
            <button
              onClick={onCreateAll}
              disabled={creatingId !== null}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                creatingId !== null
                  ? "cursor-not-allowed opacity-50"
                  : "bg-brand-orange hover:bg-brand-orange/90 text-white"
              }`}
            >
              <Plus className="h-4 w-4" />
              Aktiver alle ({uncreatedCount})
            </button>
          )}

          {/* Mandatory */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-destructive h-4 w-4" />
              <span className="text-destructive/80 text-xs font-bold tracking-wider uppercase">
                Lovp&aring;lagt
              </span>
            </div>
            <div className="space-y-2">
              {mandatory.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  isCreated={createdNames.has(t.name)}
                  isCreating={creatingId === t.id}
                  isMandatory
                  isChecked
                  onCreate={() => onCreate(t)}
                />
              ))}
            </div>
          </div>

          {/* Recommended */}
          {recommended.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="text-brand-orange h-4 w-4" />
                <span className="text-brand-orange/80 text-xs font-bold tracking-wider uppercase">
                  Anbefalt
                </span>
              </div>
              <div className="space-y-2">
                {recommended.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isCreated={createdNames.has(t.name)}
                    isCreating={creatingId === t.id}
                    isMandatory={false}
                    isChecked={!unchecked.has(t.id)}
                    onToggle={() => onTemplateToggle(t.id)}
                    onCreate={() => onCreate(t)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── GovernanceSetupStep ─────────────────────────────────

export function GovernanceSetupStep({
  industryPackage,
  extractedPolicies,
}: {
  industryPackage?: IndustryPackage;
  extractedPolicies?: Array<{ name: string; content: string; source: string }>;
}) {
  const industryDefaults = useMemo<Record<FilterKey, boolean>>(() => {
    if (!industryPackage)
      return {
        food: false,
        alcohol: false,
        overnight: false,
        delivery: false,
        nightwork: false,
        minors: false,
        foreignWorkers: false,
        cashHandling: false,
      };
    return industryPackage.filterDefaults as Record<FilterKey, boolean>;
  }, [industryPackage]);
  const { data: createdPolicies } = useCreatedPolicies();
  const createFromTemplate = useCreateFromTemplate();

  const [filters, setFilters] = useState<Record<FilterKey, boolean>>(() => industryDefaults);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!hasUserEdited) setFilters(industryDefaults);
  }, [industryDefaults, hasUserEdited]);

  useEffect(() => {
    if (!extractedPolicies || extractedPolicies.length === 0) return;

    const allTemplates = getVisibleTemplates(filters);
    const allAvailable = [...allTemplates.mandatory, ...allTemplates.recommended];

    const matchedIds = new Set<string>();
    for (const extracted of extractedPolicies) {
      const extractedLower = extracted.name.toLowerCase();
      for (const template of allAvailable) {
        const templateLower = template.name.toLowerCase();
        if (templateLower.includes(extractedLower) || extractedLower.includes(templateLower)) {
          matchedIds.add(template.id);
        }
      }
    }

    if (matchedIds.size > 0) {
      setUnchecked((prev) => {
        const next = new Set(prev);
        for (const id of matchedIds) {
          next.delete(id);
        }
        return next;
      });
    }
  }, [extractedPolicies, filters]);

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

  const createdCount = [...mandatory, ...recommended].filter((t) =>
    createdNames.has(t.name),
  ).length;

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-8">
      {/* Drawer */}
      <GovernanceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mandatory={mandatory}
        recommended={recommended}
        unchecked={unchecked}
        createdNames={createdNames}
        creatingId={creatingId}
        onTemplateToggle={handleTemplateToggle}
        onCreate={handleCreate}
        onCreateAll={handleCreateAll}
        uncreatedCount={uncreatedCount}
      />

      {/* Filter questions */}
      <div className="space-y-4">
        <h3 className="text-muted-foreground text-sm font-bold">Hva gjelder for din virksomhet?</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FILTER_QUESTIONS.map((q) => (
            <label
              key={q.key}
              className={`flex cursor-pointer items-center justify-between rounded-xl border px-5 py-4 transition-colors ${
                filters[q.key] ? "border-brand-orange bg-brand-orange/5" : "border-border bg-muted"
              }`}
            >
              <div>
                <p
                  className={`text-sm font-semibold ${filters[q.key] ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {q.label}
                </p>
                <p className="text-muted-foreground text-xs">{q.description}</p>
              </div>
              <Switch checked={filters[q.key]} onCheckedChange={() => handleFilterToggle(q.key)} />
            </label>
          ))}
        </div>
      </div>

      {/* Summary + open drawer */}
      {activeFilters > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="border-border bg-card/50 flex items-center gap-3 rounded-xl border px-5 py-4">
              <ShieldCheck className="text-destructive h-5 w-5 shrink-0" />
              <div>
                <p className="text-foreground text-lg font-bold">{mandatory.length}</p>
                <p className="text-muted-foreground text-xs">Lovp&aring;lagte</p>
              </div>
            </div>
            <div className="border-border bg-card/50 flex items-center gap-3 rounded-xl border px-5 py-4">
              <Shield className="text-brand-orange h-5 w-5 shrink-0" />
              <div>
                <p className="text-foreground text-lg font-bold">{recommended.length}</p>
                <p className="text-muted-foreground text-xs">Anbefalte</p>
              </div>
            </div>
          </div>

          {createdCount > 0 && (
            <div className="border-success/30 bg-success/5 flex items-center gap-3 rounded-xl border px-5 py-3">
              <CheckCircle2 className="text-success h-5 w-5 shrink-0" />
              <p className="text-success text-sm font-medium">
                {createdCount} retningslinje{createdCount !== 1 ? "r" : ""} aktivert
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="border-border bg-card hover:bg-accent flex w-full items-center gap-3 rounded-xl border px-5 py-4 text-left transition-colors"
          >
            <ScrollText className="text-brand-orange h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-sm font-semibold">Se retningslinjer og policies</p>
              <p className="text-muted-foreground text-sm">
                {mandatory.length} lovp&aring;lagte, {recommended.length} anbefalte
                {uncreatedCount > 0 ? ` \u2014 ${uncreatedCount} gjenstår` : ""}
              </p>
            </div>
            <span className="text-muted-foreground text-sm font-medium">&rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
}
