"use client";

/**
 * CompositionWizard — 6-step wizard for composing employment contracts.
 *
 * Uses WizardShell from @smartout/ui with the "warm" theme.
 * Each step guides the admin through selecting an employee, setting position,
 * reviewing cascade-derived values, acknowledging clauses, and sending.
 *
 * ADR-0076: composition as cascade derivation.
 */

import { useState, useEffect, useContext } from "react";
import { CheckCircle, Loader2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import type { WizardDefinition, WizardStepProps } from "@smartout/ui";
import { Button, Input, Label } from "@smartout/ui";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import type { ContractDraftProposal } from "@/lib/contracts/resolve-composition";
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
  proposal: ContractDraftProposal | null;
  acknowledgedBlocks: Set<string>;
  overrides: Record<string, { reason: string }>;
  isLoading: boolean;
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
      <h2 className="font-heading text-xl font-semibold">Velg ansatt</h2>
      <p className="text-muted-foreground text-sm">Velg den ansatte som skal motta kontrakten.</p>
      <div className="max-w-md space-y-3">
        <Input
          placeholder="Søk etter navn..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">Ingen ansatte funnet</p>
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
                    {p.role} {p.department?.name ? `· ${p.department.name}` : ""}
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
// Step 2: Position
// ---------------------------------------------------------------------------

function PositionStep({ state, updateState }: WizardStepProps<CompositionState>) {
  return (
    <div className="space-y-4">
      <h2 className="font-heading text-xl font-semibold">Stilling</h2>
      <p className="text-muted-foreground text-sm">Angi stillingstittel for kontrakten.</p>
      <div className="max-w-sm space-y-2">
        <Label htmlFor="position-title">Stillingstittel</Label>
        <Input
          id="position-title"
          placeholder="F.eks. Servitor, Bartender, Kokk"
          value={state.positionTitle}
          onChange={(e) => updateState({ positionTitle: e.target.value })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Derivation (loading state)
// ---------------------------------------------------------------------------

function DerivationStep({ state, updateState }: WizardStepProps<CompositionState>) {
  const { workspaceData } = useContext(DashboardContext);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceData?.workspace_id || !state.profileId || state.proposal) return;

    let cancelled = false;
    updateState({ isLoading: true });
    setError(null);

    fetch("/api/employment-contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceData.workspace_id,
        profile_id: state.profileId,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Kunne ikke hente forslag");
        }
        return res.json() as Promise<ContractDraftProposal>;
      })
      .then((proposal) => {
        if (!cancelled) {
          updateState({ proposal, isLoading: false });
          void emit({
            event: "contract composed",
            workspace_id: workspaceData?.workspace_id ?? null,
            actor_id: "unknown",
            properties: {
              entity: { entity_type: "profile", entity_id: state.profileId },
              data: {
                template_id: "",
                profile_id: state.profileId,
                framework_id: proposal.framework_snapshot?.framework_name ?? "",
                override_count: 0,
                blocker_count: proposal.validations?.blocker?.length ?? 0,
              },
            },
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Feil ved henting av forslag";
          setError(msg);
          updateState({ isLoading: false });
          toast.error(msg);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceData?.workspace_id, state.profileId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="text-destructive mb-4 h-10 w-10" />
        <p className="text-destructive mb-2 text-sm font-medium">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            updateState({ proposal: null });
            setError(null);
          }}
        >
          Prøv igjen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      {state.isLoading || !state.proposal ? (
        <>
          <Loader2 className="text-primary mb-4 h-10 w-10 animate-spin" />
          <p className="text-muted-foreground text-sm">Henter tariff-forslag fra Cascade...</p>
        </>
      ) : (
        <>
          <CheckCircle className="mb-4 h-10 w-10 text-emerald-500" />
          <p className="text-sm font-medium">Forslag hentet</p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Review
// ---------------------------------------------------------------------------

function ReviewStep({ state, updateState }: WizardStepProps<CompositionState>) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerField, setDrawerField] = useState("");

  const proposal = state.proposal;
  if (!proposal) {
    return (
      <p className="text-muted-foreground text-sm">
        Ingen forslag tilgjengelig. Gaa tilbake og hent paa nytt.
      </p>
    );
  }

  const terms = proposal.employment_terms;
  const allValidations = [
    ...proposal.validations.ok,
    ...proposal.validations.warning,
    ...proposal.validations.blocker,
  ];

  // Ghost value cards: rate, percentage, category
  const ghostValues = [
    {
      key: "hourly_rate",
      label: "Timelonn",
      value: terms.hourly_rate !== null ? `${terms.hourly_rate} kr/t` : "Ikke satt",
      source: `Tariff — ${proposal.framework_snapshot.framework_name}`,
    },
    {
      key: "employment_percentage",
      label: "Stillingsprosent",
      value: `${terms.employment_percentage}%`,
      source: "Standard — kan overstyres",
    },
    {
      key: "employment_category",
      label: "Ansettelseskategori",
      value: terms.employment_category,
      source: "Standard — fra profil",
    },
  ];

  function handleAcknowledge(key: string) {
    const next = new Set(state.acknowledgedBlocks);
    next.add(key);
    updateState({ acknowledgedBlocks: next });
  }

  function openReasoning(field: string) {
    setDrawerField(field);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold">Gjennomgang</h2>

      {/* Blocker / warning summary */}
      <BlockerCounter
        blockerCount={proposal.validations.blocker.length}
        warningCount={proposal.validations.warning.length}
      />

      {/* Ghost value cards inside acknowledgement ring */}
      <AcknowledgementRing
        totalBlocks={ghostValues.length}
        acknowledgedBlocks={state.acknowledgedBlocks.size}
      >
        <div className="space-y-3">
          {ghostValues.map((gv) => (
            <GhostValueCard
              key={gv.key}
              label={gv.label}
              value={gv.value}
              source={gv.source}
              acknowledged={state.acknowledgedBlocks.has(gv.key)}
              onAcknowledge={() => handleAcknowledge(gv.key)}
              onClickExplain={() => openReasoning(gv.key)}
            />
          ))}
        </div>
      </AcknowledgementRing>

      {/* Compliance badges */}
      <div className="space-y-2">
        <h3 className="text-muted-foreground text-xs tracking-wide uppercase">Samsvar</h3>
        <div className="flex flex-wrap gap-2">
          {allValidations.map((v) => (
            <ComplianceBadge key={v.rule_id} level={v.level} message={v.message} />
          ))}
        </div>
      </div>

      {/* Reasoning drawer */}
      <ReasoningDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerField}
        source={proposal.framework_snapshot.framework_name}
        explanation={`Verdi utledet fra ${proposal.framework_snapshot.framework_name} (snapshot ${proposal.framework_snapshot.snapshot_date}).`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Clauses
// ---------------------------------------------------------------------------

function ClausesStep({ state }: WizardStepProps<CompositionState>) {
  const clauses = state.proposal?.mandatory_clauses ?? [];

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-xl font-semibold">Obligatoriske klausuler</h2>
      {clauses.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Ingen obligatoriske klausuler funnet i rammeverket.
        </p>
      ) : (
        <div className="space-y-3">
          {clauses.map((clause) => (
            <div key={clause.rule_id} className="rounded-lg border p-4">
              <div className="mb-1 flex items-center gap-2">
                <Lock className="text-muted-foreground h-3.5 w-3.5" />
                <span className="text-sm font-medium">{clause.title}</span>
                <span className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase dark:bg-zinc-800">
                  Laast
                </span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{clause.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6: Send
// ---------------------------------------------------------------------------

function SendStep({ state }: WizardStepProps<CompositionState>) {
  const blockerCount = state.proposal?.validations.blocker.length ?? 0;
  const missingData = state.proposal?.placeholder_status.missing ?? [];
  const hasBlockers = blockerCount > 0;

  return (
    <div className="flex flex-col items-center justify-center py-12">
      {hasBlockers ? (
        <>
          <AlertTriangle className="mb-4 h-10 w-10 text-red-600" />
          <p className="mb-2 text-sm font-medium text-red-600">
            Kan ikke sende — {blockerCount} {blockerCount === 1 ? "blokkering" : "blokkeringer"}{" "}
            gjenstaar
          </p>
          <p className="text-muted-foreground text-xs">
            Gaa tilbake og loess blokkeringene foer du sender.
          </p>
        </>
      ) : (
        <>
          <CheckCircle className="mb-4 h-10 w-10 text-green-600" />
          <p className="text-sm font-medium">Klar til aa sende</p>
        </>
      )}

      {/* Missing data warning */}
      {missingData.length > 0 && (
        <div className="mt-6 max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="mb-1 font-medium">Manglende data fra ansatt:</p>
          <ul className="list-inside list-disc text-xs">
            {missingData.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">Kontrakten vil inneholde plassholdere for disse feltene.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard Definition
// ---------------------------------------------------------------------------

const compositionWizard: WizardDefinition<CompositionState> = {
  id: "contract-composition",
  theme: "warm",
  metadata: {
    titleKey: "contracts.composition.title",
    descriptionKey: "contracts.composition.description",
    i18nNamespace: "contracts",
  },
  brandPanel: {
    messages: {
      "select-employee": {
        heading: "Hvem skal faa kontrakt?",
        sub: "Velg den ansatte som skal motta avtalen.",
      },
      position: {
        heading: "Stilling",
        sub: "Stillingstittel brukes i kontrakten og loennsberegningen.",
      },
      derivation: {
        heading: "Cascade henter data",
        sub: "Tariff, regler og klausuler hentes automatisk fra rammeverket.",
      },
      review: {
        heading: "Kontroller forslaget",
        sub: "Godkjenn verdier og sjekk samsvar foer du gaar videre.",
      },
      clauses: {
        heading: "Obligatoriske klausuler",
        sub: "Disse er laast av rammeverket og kan ikke fjernes.",
      },
      send: {
        heading: "Alt klart?",
        sub: "Send kontrakten til den ansatte for signering.",
      },
    },
  },
  steps: [
    {
      id: "select-employee",
      labelKey: "contracts.composition.steps.selectEmployee",
      component: SelectEmployeeStep,
    },
    {
      id: "position",
      labelKey: "contracts.composition.steps.position",
      component: PositionStep,
    },
    {
      id: "derivation",
      labelKey: "contracts.composition.steps.derivation",
      component: DerivationStep,
    },
    {
      id: "review",
      labelKey: "contracts.composition.steps.review",
      component: ReviewStep,
    },
    {
      id: "clauses",
      labelKey: "contracts.composition.steps.clauses",
      component: ClausesStep,
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
    proposal: null,
    acknowledgedBlocks: new Set<string>(),
    overrides: {},
    isLoading: false,
  },
};

// ---------------------------------------------------------------------------
// Exported Component
// ---------------------------------------------------------------------------

export function CompositionWizard() {
  return <AnimatedWizardShell definition={compositionWizard} />;
}
