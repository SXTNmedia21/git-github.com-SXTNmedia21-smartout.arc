"use client";

/**
 * CompositionWizard — 5-step wizard for composing employment contracts.
 *
 * Steps: Ansatt -> Stilling -> Gjennomgang -> Bekreft -> Send
 * Uses WizardShell from @smartout/ui with the "warm" theme.
 * TanStack Query hooks (useComposeContract, useSendContract) replace raw fetch.
 *
 * ADR-0076: composition as cascade derivation.
 */

import { useState, useEffect, useContext, useCallback, useMemo } from "react";
import { CheckCircle, Loader2, Lock, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import type { WizardDefinition, WizardStepProps } from "@smartout/ui";
import { Button, Input, Label } from "@smartout/ui";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { ContractDraftProposal, EmploymentCategory } from "@smartout/utils";
import { useComposeContract, useSendContract } from "../_hooks/use-employment-contracts";
import { GhostValueCard } from "./GhostValueCard";
import { ComplianceBadge } from "./ComplianceBadge";
import { BlockerCounter } from "./BlockerCounter";
import { AcknowledgementRing } from "./AcknowledgementRing";
import { ReasoningDrawer } from "./ReasoningDrawer";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type CompositionState = {
  profileId: string;
  positionTitle: string;
  employmentCategory: EmploymentCategory;
  employmentPercentage: number;
  proposal: (ContractDraftProposal & { contract_id?: string }) | null;
  acknowledgedBlocks: Set<string>;
  overrides: Record<string, { reason: string }>;
  isLoading: boolean;
  isSending: boolean;
};

// ---------------------------------------------------------------------------
// Step 1: Select Employee
// ---------------------------------------------------------------------------

type ProfileOption = {
  profile_id: string;
  display_name: string;
  role: string;
  department: { name: string } | null;
};

function SelectEmployeeStep({ state, updateState }: WizardStepProps<CompositionState>) {
  const { t } = useTranslation("contracts");
  const { workspaceData } = useContext(DashboardContext);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceData?.workspace_id) return;
    let cancelled = false;

    import("@smartout/supabase/client").then(async ({ createClient }) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profile")
        .select("profile_id, display_name, role, department:department_id(name)")
        .eq("workspace_id", workspaceData.workspace_id)
        .eq("is_active", true)
        .order("display_name");

      if (!cancelled && data) {
        setProfiles(data as unknown as ProfileOption[]);
      }
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceData?.workspace_id]);

  const filtered = profiles.filter(
    (p) =>
      p.display_name.toLowerCase().includes(search.toLowerCase()) ||
      p.role.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-xl font-semibold">{t("composition.select_employee")}</h2>
      <p className="text-muted-foreground text-sm">
        {t("composition.select_employee_description")}
      </p>
      <div className="max-w-md space-y-3">
        <Input
          placeholder={t("composition.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              {t("composition.no_employees")}
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.profile_id}
                type="button"
                onClick={() => updateState({ profileId: p.profile_id, proposal: null })}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  state.profileId === p.profile_id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted"
                }`}
              >
                <div className="flex-1">
                  <p className="font-medium">{p.display_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {p.role} {p.department?.name ? `\u00B7 ${p.department.name}` : ""}
                  </p>
                </div>
                {state.profileId === p.profile_id && (
                  <CheckCircle className="text-primary h-4 w-4" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Stilling — position title + employment category + percentage
// ---------------------------------------------------------------------------

const EMPLOYMENT_CATEGORY_KEYS: { value: EmploymentCategory; labelKey: string }[] = [
  { value: "fast", labelKey: "composition.category_full_time" },
  { value: "deltid", labelKey: "composition.category_part_time" },
  { value: "tilkalling", labelKey: "composition.category_on_call" },
];

function PositionStep({ state, updateState }: WizardStepProps<CompositionState>) {
  const { t } = useTranslation("contracts");

  // When category changes, auto-set percentage for non-deltid categories.
  function handleCategoryChange(category: EmploymentCategory) {
    if (category === "fast") {
      updateState({ employmentCategory: category, employmentPercentage: 100 });
    } else if (category === "tilkalling") {
      updateState({ employmentCategory: category, employmentPercentage: 0 });
    } else {
      // deltid: keep current percentage (or default to 50 if it's currently 100 or 0)
      const currentPct = state.employmentPercentage;
      const pct = currentPct > 0 && currentPct < 100 ? currentPct : 50;
      updateState({ employmentCategory: category, employmentPercentage: pct });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">{t("composition.position_title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("composition.position_description")}
        </p>
      </div>

      {/* Position title */}
      <div className="max-w-sm space-y-2">
        <Label htmlFor="position-title">{t("composition.position_label")}</Label>
        <Input
          id="position-title"
          placeholder={t("composition.position_placeholder")}
          value={state.positionTitle}
          onChange={(e) => updateState({ positionTitle: e.target.value })}
        />
      </div>

      {/* Employment category — inline segmented toggle */}
      <div className="max-w-sm space-y-2">
        <Label>{t("composition.employment_form")}</Label>
        <div className="flex gap-1 rounded-lg border p-1">
          {EMPLOYMENT_CATEGORY_KEYS.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => handleCategoryChange(cat.value)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                state.employmentCategory === cat.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Percentage slider — only shown for deltid */}
      {state.employmentCategory === "deltid" && (
        <div className="max-w-sm space-y-2">
          <Label htmlFor="employment-percentage">
            {t("composition.employment_percentage_label", {
              percentage: String(state.employmentPercentage),
            })}
          </Label>
          <input
            id="employment-percentage"
            type="range"
            min={10}
            max={99}
            step={5}
            value={state.employmentPercentage}
            onChange={(e) => updateState({ employmentPercentage: Number(e.target.value) })}
            className="accent-primary w-full"
          />
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>10%</span>
            <span>99%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Gjennomgang — derivation loading + GhostValueCards + clauses
// ---------------------------------------------------------------------------

function GjennomgangStep({ state, updateState }: WizardStepProps<CompositionState>) {
  const { t } = useTranslation("contracts");
  const { workspaceData } = useContext(DashboardContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerField, setDrawerField] = useState("");

  const composeMutation = useComposeContract();

  // Trigger derivation on mount when we don't have a proposal yet.
  // Wrapped in useCallback so the effect dependency is stable.
  const triggerDerive = useCallback(() => {
    if (!workspaceData?.workspace_id || !state.profileId || state.proposal) return;

    updateState({ isLoading: true });
    composeMutation.mutate(
      {
        workspace_id: workspaceData.workspace_id,
        profile_id: state.profileId,
        position_title: state.positionTitle,
        employment_category: state.employmentCategory,
        employment_percentage: state.employmentPercentage,
        persist: false,
      },
      {
        onSuccess: (proposal) => {
          updateState({ proposal, isLoading: false });
        },
        onError: (err: Error) => {
          updateState({ isLoading: false });
          toast.error(err.message);
        },
      },
    );
  }, [
    workspaceData?.workspace_id,
    state.profileId,
    state.positionTitle,
    state.employmentCategory,
    state.employmentPercentage,
    state.proposal,
  ]);

  // Run once on mount — triggerDerive is memoised via useCallback.
  // We intentionally pass an empty dep array: re-running on every dep change
  // would re-fetch on every parent render rather than once when the step mounts.
  useEffect(() => {
    triggerDerive();
  }, []);

  // --- Loading state ---
  if (state.isLoading || (!state.proposal && !composeMutation.isError)) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="text-primary mb-4 h-10 w-10 animate-spin" />
        <p className="text-muted-foreground text-sm">{t("composition.loading_cascade")}</p>
      </div>
    );
  }

  // --- Error state ---
  if (composeMutation.isError || !state.proposal) {
    const errorMessage =
      composeMutation.error instanceof Error
        ? composeMutation.error.message
        : t("composition.error_fetch_proposal");
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="text-destructive mb-4 h-10 w-10" />
        <p className="text-destructive mb-2 text-sm font-medium">{errorMessage}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            updateState({ proposal: null });
            triggerDerive();
          }}
        >
          {t("composition.try_again")}
        </Button>
      </div>
    );
  }

  const proposal = state.proposal;
  const terms = proposal.employment_terms;
  const allValidations = [
    ...proposal.validations.ok,
    ...proposal.validations.warning,
    ...proposal.validations.blocker,
  ];

  // Ghost value cards: the four derived values the admin needs to review
  const ghostValues = [
    {
      key: "timelonn",
      label: t("composition.ghost_hourly_rate"),
      value: terms.hourly_rate !== null ? `${terms.hourly_rate} kr/t` : t("composition.not_set"),
      source: t("composition.ghost_source_tariff", {
        framework: proposal.framework_snapshot.framework_name,
      }),
    },
    {
      key: "stillingsprosent",
      label: t("composition.ghost_percentage"),
      value: `${terms.employment_percentage}%`,
      source: t("composition.ghost_source_step2"),
    },
    {
      key: "kategori",
      label: t("composition.ghost_category"),
      value: terms.employment_category,
      source: t("composition.ghost_source_step2"),
    },
    {
      key: "rammeverk",
      label: t("composition.ghost_framework"),
      value: proposal.framework_snapshot.framework_name,
      source: t("composition.ghost_source_snapshot", {
        date: proposal.framework_snapshot.snapshot_date.split("T")[0] ?? "",
      }),
    },
  ];

  function handleAcknowledge(key: string) {
    const next = new Set(state.acknowledgedBlocks);
    next.add(key);
    updateState({ acknowledgedBlocks: next });
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold">{t("composition.review_title")}</h2>

      {/* Blocker / warning summary */}
      <BlockerCounter
        blockerCount={proposal.validations.blocker.length}
        warningCount={proposal.validations.warning.length}
      />

      {/* Ghost value cards — each requires acknowledgement */}
      <div className="space-y-3">
        {ghostValues.map((gv) => (
          <GhostValueCard
            key={gv.key}
            label={gv.label}
            value={gv.value}
            source={gv.source}
            acknowledged={state.acknowledgedBlocks.has(gv.key)}
            onAcknowledge={() => handleAcknowledge(gv.key)}
            onClickExplain={() => {
              setDrawerField(gv.key);
              setDrawerOpen(true);
            }}
          />
        ))}
      </div>

      {/* Compliance badges */}
      {allValidations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-muted-foreground text-xs tracking-wide uppercase">
            {t("composition.compliance_label")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {allValidations.map((v) => (
              <ComplianceBadge key={v.rule_id} level={v.level} message={v.message} />
            ))}
          </div>
        </div>
      )}

      {/* Mandatory clauses — collapsible */}
      {proposal.mandatory_clauses.length > 0 && (
        <details className="rounded-lg border">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium select-none">
            <Lock className="text-muted-foreground h-4 w-4" />
            {t("composition.mandatory_clauses", {
              count: String(proposal.mandatory_clauses.length),
            })}
          </summary>
          <div className="space-y-3 border-t px-4 py-3">
            {proposal.mandatory_clauses.map((clause) => (
              <div key={clause.rule_id}>
                <p className="text-sm font-medium">{clause.title}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{clause.text}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Reasoning drawer */}
      <ReasoningDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerField}
        source={proposal.framework_snapshot.framework_name}
        explanation={t("composition.reasoning_explanation", {
          framework: proposal.framework_snapshot.framework_name,
          date: proposal.framework_snapshot.snapshot_date.split("T")[0] ?? "",
        })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Bekreft — summary + AcknowledgementRing
// ---------------------------------------------------------------------------

function BekreftStep({ state, updateState }: WizardStepProps<CompositionState>) {
  const { t } = useTranslation("contracts");
  const proposal = state.proposal;

  if (!proposal) {
    return <p className="text-muted-foreground text-sm">{t("composition.no_proposal")}</p>;
  }

  const terms = proposal.employment_terms;

  const summaryItems = [
    {
      key: "stilling",
      label: t("composition.summary_position"),
      value: terms.position_title || "\u2014",
    },
    { key: "kategori", label: t("composition.summary_category"), value: terms.employment_category },
    {
      key: "prosent",
      label: t("composition.summary_percentage"),
      value: `${terms.employment_percentage}%`,
    },
    {
      key: "timelonn",
      label: t("composition.summary_hourly_rate"),
      value: terms.hourly_rate !== null ? `${terms.hourly_rate} kr/t` : t("composition.not_set"),
    },
  ];

  function handleAcknowledge(key: string) {
    const next = new Set(state.acknowledgedBlocks);
    next.add(key);
    updateState({ acknowledgedBlocks: next });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">{t("composition.confirm_title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("composition.confirm_description")}</p>
      </div>

      <AcknowledgementRing
        totalBlocks={summaryItems.length}
        acknowledgedBlocks={
          summaryItems.filter((item) => state.acknowledgedBlocks.has(item.key)).length
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {summaryItems.map((item) => {
            const isAcknowledged = state.acknowledgedBlocks.has(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleAcknowledge(item.key)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  isAcknowledged
                    ? "border-primary/40 bg-primary/5"
                    : "hover:border-muted-foreground/40"
                }`}
              >
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-medium">{item.value}</p>
                {isAcknowledged && <CheckCircle className="text-primary mt-2 h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </AcknowledgementRing>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Send — two-path submit using TanStack Query hooks
// ---------------------------------------------------------------------------

function SendStep({ state, updateState }: WizardStepProps<CompositionState>) {
  const { t } = useTranslation("contracts");
  const { workspaceData } = useContext(DashboardContext);
  const composeMutation = useComposeContract();
  const sendMutation = useSendContract();

  const blockerCount = state.proposal?.validations.blocker.length ?? 0;
  const missingPii = state.proposal?.placeholder_status.missing ?? [];
  const hasBlockers = blockerCount > 0;

  // True when PII is complete — we can send directly after persist-compose
  const piiComplete = missingPii.length === 0;

  const isSubmitting = state.isSending;

  async function handleSubmit() {
    if (!workspaceData?.workspace_id || !state.profileId) return;

    updateState({ isSending: true });

    try {
      // Step A: compose with persist=true to get a contract_id
      const composed = await composeMutation.mutateAsync({
        workspace_id: workspaceData.workspace_id,
        profile_id: state.profileId,
        position_title: state.positionTitle,
        employment_category: state.employmentCategory,
        employment_percentage: state.employmentPercentage,
        persist: true,
      });

      const contractId = composed.contract_id;
      if (!contractId) {
        throw new Error(t("composition.contract_not_saved"));
      }

      updateState({ proposal: composed });

      if (piiComplete) {
        // Step B (PII complete path): send immediately for signing
        await sendMutation.mutateAsync({ contract_id: contractId });
        toast.success(t("composition.contract_sent_for_signing"));
      } else {
        // Step B (PII missing path): contract created, PII collection flow starts
        toast.success(t("composition.contract_created_collecting"));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("toast.something_went_wrong");
      toast.error(message);
    } finally {
      updateState({ isSending: false });
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      {hasBlockers ? (
        <>
          <AlertTriangle className="h-10 w-10 text-red-600" />
          <div className="text-center">
            <p className="text-sm font-medium text-red-600">
              {t("composition.cannot_send", {
                count: String(blockerCount),
                blockerWord:
                  blockerCount === 1
                    ? t("composition.blocker_singular")
                    : t("composition.blocker_plural"),
              })}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t("composition.resolve_blockers")}
            </p>
          </div>
        </>
      ) : (
        <>
          <Sparkles className="text-primary h-10 w-10" />
          <div className="text-center">
            <p className="text-sm font-medium">{t("composition.ready_to_send")}</p>
            {!piiComplete && (
              <p className="text-muted-foreground mt-1 text-xs">
                {t("composition.missing_pii_notice")}
              </p>
            )}
          </div>
        </>
      )}

      {/* Missing PII notice */}
      {missingPii.length > 0 && (
        <div className="max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="mb-1 font-medium">{t("composition.missing_pii_title")}</p>
          <ul className="list-inside list-disc text-xs">
            {missingPii.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">{t("composition.missing_pii_footer")}</p>
        </div>
      )}

      {/* Submit button — two labels depending on PII completeness */}
      <Button
        onClick={() => void handleSubmit()}
        disabled={hasBlockers || isSubmitting}
        size="lg"
        className="min-w-48"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("composition.sending")}
          </>
        ) : piiComplete ? (
          t("composition.send_contract")
        ) : (
          t("composition.create_and_collect")
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported Component
// ---------------------------------------------------------------------------

export function CompositionWizard() {
  const { t } = useTranslation("contracts");

  // Build wizard definition inside the component so brandPanel messages
  // are translated at render time via the active locale.
  const definition = useMemo<WizardDefinition<CompositionState>>(
    () => ({
      id: "contract-composition",
      theme: "warm",
      metadata: {
        titleKey: "contracts.composition.title",
        descriptionKey: "contracts.composition.description",
        i18nNamespace: "contracts",
      },
      brandPanel: {
        messages: {
          ansatt: {
            heading: t("composition.brand_ansatt_heading"),
            sub: t("composition.brand_ansatt_sub"),
          },
          stilling: {
            heading: t("composition.brand_stilling_heading"),
            sub: t("composition.brand_stilling_sub"),
          },
          gjennomgang: {
            heading: t("composition.brand_gjennomgang_heading"),
            sub: t("composition.brand_gjennomgang_sub"),
          },
          bekreft: {
            heading: t("composition.brand_bekreft_heading"),
            sub: t("composition.brand_bekreft_sub"),
          },
          send: {
            heading: t("composition.brand_send_heading"),
            sub: t("composition.brand_send_sub"),
          },
        },
      },
      steps: [
        {
          id: "ansatt",
          labelKey: "contracts.composition.steps.ansatt",
          component: SelectEmployeeStep,
        },
        {
          id: "stilling",
          labelKey: "contracts.composition.steps.stilling",
          component: PositionStep,
        },
        {
          id: "gjennomgang",
          labelKey: "contracts.composition.steps.gjennomgang",
          component: GjennomgangStep,
        },
        {
          id: "bekreft",
          labelKey: "contracts.composition.steps.bekreft",
          component: BekreftStep,
        },
        {
          id: "send",
          labelKey: "contracts.composition.steps.send",
          component: SendStep,
        },
      ],
      initialState: {
        profileId: "",
        positionTitle: "",
        employmentCategory: "fast",
        employmentPercentage: 100,
        proposal: null,
        acknowledgedBlocks: new Set<string>(),
        overrides: {},
        isLoading: false,
        isSending: false,
      },
    }),
    [t],
  );

  return <AnimatedWizardShell definition={definition} />;
}
