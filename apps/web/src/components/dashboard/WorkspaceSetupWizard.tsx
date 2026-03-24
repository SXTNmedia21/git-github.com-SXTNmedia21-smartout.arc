"use client";

import { useState, useCallback, useContext, useLayoutEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Loader2, Rocket, SkipForward } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { dashboardKeys } from "@/app/dashboard/_hooks/dashboard-keys";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useWorkspaceSetup } from "@/app/dashboard/_hooks/use-workspace-setup";
import { useIndustryPackage } from "@/lib/industry/use-industry-package";
import { WelcomeStep } from "@/components/dashboard/wizard-steps/WelcomeStep";
import { DocumentDropStep } from "@/components/dashboard/wizard-steps/DocumentDropStep";
import { GovernanceSetupStep } from "@/components/dashboard/wizard-steps/GovernanceSetupStep";
import { PayrollSetupStep } from "@/components/dashboard/wizard-steps/PayrollSetupStep";
import { EmploymentSetupStep } from "@/components/dashboard/wizard-steps/EmploymentSetupStep";
import { TeamSetupStep } from "@/components/dashboard/wizard-steps/TeamSetupStep";
import { ShiftTemplateSetupStep } from "@/components/dashboard/wizard-steps/ShiftTemplateSetupStep";
import { SeasonSetupStep } from "@/components/dashboard/wizard-steps/SeasonSetupStep";
import { HandbookSetupStep } from "@/components/dashboard/wizard-steps/HandbookSetupStep";
import { BotsTip } from "@/components/dashboard/wizard-steps/BotsTip";
import { HelpTip } from "@/components/dashboard/wizard-steps/HelpTip";
import type {
  SetupWizardState,
  DocumentExtractionResult,
  ScrapedIntelligence,
  TeamMember,
} from "@/components/dashboard/wizard-steps/wizard-state";
import { EMPTY_EXTRACTION } from "@/components/dashboard/wizard-steps/wizard-state";

// ─── Step definitions ────────────────────────────────────

type SetupStep = {
  id: string;
  title: string;
  subtitle: string;
  explanation: string;
  helpTip: string;
};

const STEPS: SetupStep[] = [
  {
    id: "welcome",
    title: "Velkommen til Smartout",
    subtitle: "Det vi vet om deg",
    explanation:
      "Vi har hentet informasjon om bedriften din fra Brønnøysund, Google og nettsiden din. Se over at det stemmer, og juster det som trengs.",
    helpTip: "Dataene er hentet automatisk. Alt kan endres.",
  },
  {
    id: "document-drop",
    title: "Last opp dokumenter",
    subtitle: "Valgfritt — vi analyserer",
    explanation:
      "Last opp det dere har — rutineperm, vaktlister, kontrakter, HMS-plan, personalhåndbok, meny, tariffavtale. Vi analyserer og fyller ut resten for dere.",
    helpTip: "Dokumentene analyseres med AI. Du kan hoppe over dette steget.",
  },
  {
    id: "governance",
    title: "Dine retningslinjer",
    subtitle: "Regler og prosedyrer",
    explanation:
      "Retningslinjer er reglene som styrer restauranten din. Mattrygghet, hygiene, brannsikkerhet — alt som ansatte må kunne. Når du legger inn reglene her, vil systemet automatisk sørge for at alle ansatte lærer dem og blir testet på at de kan dem.",
    helpTip:
      "Retningslinjer er reglene som styrer virksomheten. De blir automatisk til opplæring for ansatte.",
  },
  {
    id: "payroll",
    title: "Lønn og tillegg",
    subtitle: "Tariff og satser",
    explanation:
      "Sett opp lønnssatser og tillegg for virksomheten din. Velg tariffavtale, juster kvelds-, helge- og overtidstillegg, og sett timelønn per stilling.",
    helpTip:
      "Lønnsoppsettet bestemmer satser og tillegg. Det brukes automatisk når du inviterer ansatte og lager vaktplaner.",
  },
  {
    id: "employment",
    title: "Ansettelsesvilkår",
    subtitle: "Avtaleformer og betingelser",
    explanation:
      "Definer hvilke ansettelsesformer dere bruker og standardvilkårene for hver. Prøvetid, ferie, pensjon og arbeidsgiveravgift — alt samles her.",
    helpTip:
      "Ansettelsesvilkår definerer kontraktsmalene. Valget her bestemmer hva som står i arbeidsavtalene.",
  },
  {
    id: "team",
    title: "Ditt team",
    subtitle: "De første ansatte",
    explanation:
      "Legg til de første i teamet ditt. De får en invitasjon og starter med å lese håndboken og retningslinjene du nettopp la inn.",
    helpTip:
      "Inviter ansatte manuelt eller last opp en CSV-fil. De får tilgang til opplæring og håndbok automatisk.",
  },
  {
    id: "shift-template",
    title: "Dine vaktmaler",
    subtitle: "Grunnlaget for vaktplanen",
    explanation:
      "En vaktmal er en oppskrift for en vakt — navn, start- og sluttid, og hvilken avdeling den tilhører. Du bygger den ekte vaktplanen etterpå.",
    helpTip:
      "Vaktmaler er gjenbrukbare oppskrifter for vakter. De gjør det raskt å bygge ukeplaner.",
  },
  {
    id: "season",
    title: "Din sesong",
    subtitle: "Budsjett og mål",
    explanation:
      "Sesongen setter rammene for alt: budsjett, bemanningsmål, og KPI-er. Når sesongen er aktiv, begynner dashboardet å vise ekte tall.",
    helpTip:
      "Sesongen er tidsrammen for budsjett og mål. Dashboard viser først ekte data når en sesong er aktiv.",
  },
  {
    id: "handbook",
    title: "Din personalhåndbok",
    subtitle: "Generert fra oppsettet ditt",
    explanation:
      "Personalhåndboken er auto-generert fra det du har lagt inn i steg 1–7. Gå gjennom kapitlene, juster teksten der det trengs, og publiser.",
    helpTip:
      "Håndboken genereres automatisk fra data du allerede har lagt inn. Du reviewer og redigerer — ikke skriver.",
  },
];

// ─── Helpers ─────────────────────────────────────────────

const SKIP_KEY_PREFIX = "smartout_setup_skipped_";
const SKIP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSkipKey(workspaceId: string): string {
  return `${SKIP_KEY_PREFIX}${workspaceId}`;
}

function wasRecentlySkipped(workspaceId: string): boolean {
  if (typeof window === "undefined" || !workspaceId) return false;
  const raw = localStorage.getItem(getSkipKey(workspaceId));
  if (!raw) return false;
  const skippedAt = Number(raw);
  return Date.now() - skippedAt < SKIP_TTL_MS;
}

// Map wizard step IDs to setup module IDs for initial step calculation
const STEP_TO_MODULE: Record<string, string> = {
  welcome: "governance",
  "document-drop": "governance",
  governance: "governance",
  payroll: "governance",
  employment: "governance",
  team: "people",
  "shift-template": "schedule",
  season: "season",
  handbook: "governance",
};

// ─── Component ───────────────────────────────────────────

export function WorkspaceSetupWizard({
  onComplete,
  force = false,
}: {
  onComplete: () => void;
  force?: boolean;
}) {
  const queryClient = useQueryClient();
  const { profileId } = useContext(DashboardContext);
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? "";
  const { data: setupStatus } = useWorkspaceSetup();
  const { package: industryPackage, detectedType, setIndustryType } = useIndustryPackage();

  // ── Query all business data from DB for wizard steps ──
  const supabase = useMemo(() => createClient(), []);

  const { data: company } = useQuery({
    queryKey: ["wizard-company", workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company")
        .select("*")
        .eq("company_id", ctx?.workspace.company_id!)
        .single();
      return data;
    },
    enabled: !!ctx?.workspace.company_id,
  });

  const { data: companyDetails } = useQuery({
    queryKey: ["wizard-company-details", workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_details")
        .select("*")
        .eq("workspace_id", workspaceId)
        .single();
      return data;
    },
    enabled: !!workspaceId,
  });

  const { data: openingHoursData } = useQuery({
    queryKey: ["wizard-opening-hours", workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_opening_hours")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("day_of_week");
      return data ?? [];
    },
    enabled: !!workspaceId,
  });

  const { data: socialMedia } = useQuery({
    queryKey: ["wizard-social-media", workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_social_media")
        .select("*")
        .eq("workspace_id", workspaceId);
      return data ?? [];
    },
    enabled: !!workspaceId,
  });

  const scrapedData = useMemo<ScrapedIntelligence>(
    () => ({
      companyName: ctx?.workspace.name,
      orgNumber: company?.org_number ?? undefined,
      industryType: company?.industry ?? undefined,
      address:
        [company?.address_line_1, company?.postal_code, company?.city].filter(Boolean).join(", ") ||
        undefined,
      website: company?.website ?? undefined,
      email: company?.email ?? undefined,
      phone: company?.phone ?? undefined,
      openingHours:
        openingHoursData
          ?.filter((h) => !h.is_closed)
          .map(
            (h) =>
              `${["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"][h.day_of_week]}: ${h.open_time}-${h.close_time}`,
          )
          .join(", ") || undefined,
      googleRating: (ctx?.workspace as Record<string, unknown>)?.google_rating as
        | number
        | undefined,
      googleMapsUrl: (ctx?.workspace as Record<string, unknown>)?.google_maps_url as
        | string
        | undefined,
      googlePriceLevel: (ctx?.workspace as Record<string, unknown>)?.google_price_level as
        | string
        | undefined,
      aboutUs: companyDetails?.about_us ?? undefined,
      ourHistory: companyDetails?.our_history ?? undefined,
      ourConcept: companyDetails?.our_concept ?? undefined,
      restaurantType: companyDetails?.restaurant_type ?? undefined,
      cuisineTypes: companyDetails?.cuisine_types ?? undefined,
      priceCategory: companyDetails?.price_category ?? undefined,
      menuDescription: companyDetails?.menu_description ?? undefined,
      socialLinks:
        socialMedia && socialMedia.length > 0
          ? socialMedia.reduce(
              (acc, sm) => ({ ...acc, [sm.platform]: sm.url }),
              {} as Record<string, string>,
            )
          : undefined,
      fieldSources: (companyDetails?.field_sources as Record<string, string>) ?? undefined,
    }),
    [ctx, company, companyDetails, openingHoursData, socialMedia],
  );

  // ── Shared wizard state ──
  const [wizardState, setWizardState] = useState<SetupWizardState>(() => ({
    scrapedData,
    extractedData: EMPTY_EXTRACTION,
    industryPackage,
    createdPolicyIds: [],
    payrollSaved: false,
    employmentSaved: false,
    invitedCount: 0,
    shiftTemplateCount: 0,
    seasonCreated: false,
    teamMembers: [],
  }));

  // Keep industry package in sync
  const currentState = useMemo<SetupWizardState>(
    () => ({ ...wizardState, industryPackage, scrapedData }),
    [wizardState, industryPackage, scrapedData],
  );

  const handleExtractionComplete = useCallback((result: DocumentExtractionResult) => {
    setWizardState((prev) => ({ ...prev, extractedData: result }));
  }, []);

  const handleTeamChange = useCallback((members: TeamMember[]) => {
    setWizardState((prev) => ({ ...prev, teamMembers: members }));
  }, []);

  // ── Step navigation ──
  const [currentStep, setCurrentStep] = useState(() => {
    if (!setupStatus?.modules) return 0;
    const modules = setupStatus.modules;
    for (let i = 0; i < STEPS.length; i++) {
      const moduleId = STEP_TO_MODULE[STEPS[i]!.id];
      const mod = modules.find((m) => m.id === moduleId);
      if (mod && !mod.isComplete) return i;
    }
    return 0;
  });

  useLayoutEffect(() => {
    if (!force && workspaceId && wasRecentlySkipped(workspaceId)) {
      onComplete();
    }
  }, [force, workspaceId, onComplete]);

  const step = STEPS[currentStep]!;
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;
  const [isFinishing, setIsFinishing] = useState(false);

  const invitationsSentRef = useRef(false);

  const sendTeamInvitations = useCallback(async () => {
    const members = currentState.teamMembers;
    if (members.length === 0 || invitationsSentRef.current) return;
    invitationsSentRef.current = true;

    const supabase = createClient();

    // Resolve inviter profile — profileId from DashboardContext is already a profile_id
    const inviterProfileId = profileId;
    if (!inviterProfileId) {
      console.error("[wizard] Could not resolve inviter profile");
      return;
    }

    const { data: ws } = await supabase
      .from("workspace")
      .select("company_id")
      .eq("workspace_id", workspaceId)
      .single();

    const companyId = ws?.company_id;
    if (!companyId) {
      console.error("[wizard] Could not resolve company_id");
      return;
    }

    const inviteRecords = members.map((m) => ({
      workspace_id: workspaceId,
      company_id: companyId,
      email: m.email.trim() || null,
      first_name: m.firstName.trim(),
      last_name: m.lastName.trim(),
      role: m.role,
      department_ids: m.departmentId ? [m.departmentId] : [],
      status: "pending" as const,
      invite_type: "email" as const,
      invited_by: inviterProfileId,
      metadata: {
        ...(m.phone ? { phone: m.phone } : {}),
        ...(m.positionId ? { positionId: m.positionId } : {}),
        ...(m.employmentForm ? { employmentForm: m.employmentForm } : {}),
        ...(m.hourlyRate ? { hourlyRate: m.hourlyRate } : {}),
        ...(m.startDate ? { startDate: m.startDate } : {}),
        ...(m.positionPct ? { positionPct: m.positionPct } : {}),
        ...(m.birthDate ? { birthDate: m.birthDate } : {}),
        ...(m.address ? { address: m.address } : {}),
        ...(Object.keys(m.extraData).length > 0 ? { extraData: m.extraData } : {}),
      },
    }));

    const { error } = await supabase.from("invitation").insert(inviteRecords);

    if (error) {
      console.error("[wizard] Failed to create invitations:", error);
      toast.error("Kunne ikke opprette invitasjoner");
      throw error;
    }

    toast.success(`${members.length} invitasjon${members.length !== 1 ? "er" : ""} opprettet`);
  }, [currentState.teamMembers, workspaceId, profileId]);

  const handleNext = useCallback(async () => {
    // Emit step completion for the current step
    emit({
      event: "wizard step_completed",
      workspace_id: workspaceId,
      actor_id: profileId ?? "",
      properties: {
        data: {
          step_id: step.id,
          step_index: currentStep,
        },
      },
    }).catch((e: unknown) => console.error("[wizard] emit failed:", e));

    // Persist team invitations when leaving the team step
    if (step.id === "team" && currentState.teamMembers.length > 0) {
      try {
        await sendTeamInvitations();
      } catch {
        // Error already toasted — don't block navigation
      }
    }

    if (isLast) {
      setIsFinishing(true);

      try {
        // Emit wizard completed
        emit({
          event: "wizard completed",
          workspace_id: workspaceId,
          actor_id: profileId ?? "",
          properties: {
            data: {
              workspace_id: workspaceId,
            },
          },
        }).catch((e: unknown) => console.error("[wizard] emit failed:", e));

        void queryClient.invalidateQueries({
          queryKey: dashboardKeys.workspaceSetupStatus(workspaceId),
        });
        onComplete();
      } catch {
        // Error already toasted
      } finally {
        setIsFinishing(false);
      }
    } else {
      setCurrentStep((s) => s + 1);
      document.querySelector("[data-wizard-scroll]")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [
    isLast,
    queryClient,
    workspaceId,
    onComplete,
    profileId,
    step.id,
    currentStep,
    currentState.teamMembers,
    sendTeamInvitations,
  ]);

  const handleBack = useCallback(() => {
    if (!isFirst) {
      setCurrentStep((s) => s - 1);
      document.querySelector("[data-wizard-scroll]")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [isFirst]);

  const handleSkip = useCallback(() => {
    if (workspaceId) {
      localStorage.setItem(getSkipKey(workspaceId), String(Date.now()));
    }
    void queryClient.invalidateQueries({
      queryKey: dashboardKeys.workspaceSetupStatus(workspaceId),
    });
    onComplete();
  }, [queryClient, workspaceId, onComplete]);

  const progressPct = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="flex h-full flex-col">
      {/* ── Top bar: logo + skip ── */}
      <div className={`flex items-center justify-between border-b px-8 py-4 ${"border-border"}`}>
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${"bg-brand-orange"}`}
          >
            <Rocket className="text-brand-orange h-5 w-5" />
          </div>
          <span className={`text-sm font-bold tracking-tight ${"text-muted-foreground"}`}>
            Oppsett av arbeidsrom
          </span>
        </div>

        <button
          onClick={handleSkip}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${"text-muted-foreground hover:bg-accent hover:text-foreground"}`}
        >
          <SkipForward className="h-3.5 w-3.5" />
          Hopp over og gå til dashboard
        </button>
      </div>

      {/* ── Progress bar ── */}
      <div className={`h-1 w-full ${"bg-muted"}`}>
        <div
          className="bg-brand-orange h-full rounded-r-full transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Step indicator dots ── */}
      <div className="flex justify-center gap-1.5 overflow-x-auto px-4 pt-6 sm:gap-2 sm:px-8">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentStep(i)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-2 py-1.5 text-xs font-medium transition-all sm:px-3 ${
              i === currentStep
                ? "bg-brand-orange text-brand-orange"
                : i < currentStep
                  ? "text-success/60"
                  : "text-muted-foreground"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                i === currentStep
                  ? "bg-brand-orange text-white"
                  : i < currentStep
                    ? "bg-success text-success"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < currentStep ? "\u2713" : i}
            </span>
            {i === currentStep && <span className="hidden sm:inline">{s.title}</span>}
          </button>
        ))}
      </div>

      {/* ── Main content area ── */}
      <div
        data-wizard-scroll
        className="flex flex-1 flex-col items-center overflow-y-auto px-8 py-12"
      >
        <div className="w-full max-w-2xl space-y-8">
          {/* Step header */}
          <div className="space-y-3">
            <p className={`text-xs font-bold tracking-widest uppercase ${"text-brand-orange/70"}`}>
              Steg {currentStep} av {STEPS.length - 1} &middot; {step.subtitle}
            </p>
            <div className="flex items-center gap-2">
              <h1 className={`text-3xl font-black tracking-tight ${"text-foreground"}`}>
                {step.title}
              </h1>
              <HelpTip text={step.helpTip} />
            </div>
            <p className={`max-w-xl text-base leading-relaxed ${"text-muted-foreground"}`}>
              {step.explanation}
            </p>
          </div>

          {/* Step form */}
          {step.id === "welcome" && (
            <WelcomeStep
              scrapedData={currentState.scrapedData}
              detectedIndustry={detectedType}
              onIndustryChange={setIndustryType}
            />
          )}
          {step.id === "document-drop" && (
            <DocumentDropStep onExtractionComplete={handleExtractionComplete} />
          )}
          {step.id === "governance" && (
            <GovernanceSetupStep
              industryPackage={currentState.industryPackage}
              extractedPolicies={currentState.extractedData.policies}
            />
          )}
          {step.id === "payroll" && (
            <PayrollSetupStep
              industryTariffs={currentState.industryPackage.tariffs}
              defaultTariffKey={currentState.industryPackage.defaultTariffKey}
              extractedPayroll={currentState.extractedData.payroll}
            />
          )}
          {step.id === "employment" && (
            <EmploymentSetupStep
              industryDefaults={currentState.industryPackage.employmentDefaults}
              extractedTerms={currentState.extractedData.employmentTerms}
            />
          )}
          {step.id === "team" && (
            <TeamSetupStep
              extractedEmployees={currentState.extractedData.employees}
              teamMembers={currentState.teamMembers}
              onTeamChange={handleTeamChange}
            />
          )}
          {step.id === "shift-template" && (
            <ShiftTemplateSetupStep
              suggestedTemplates={currentState.industryPackage.shiftTemplates}
              extractedShiftPatterns={currentState.extractedData.shiftPatterns}
              openingHours={currentState.scrapedData.openingHours}
            />
          )}
          {step.id === "season" && (
            <SeasonSetupStep suggestedSeasons={currentState.industryPackage.seasonTemplates} />
          )}
          {step.id === "handbook" && <HandbookSetupStep wizardState={currentState} />}

          {/* Botsson tip */}
          <BotsTip tip={currentState.industryPackage.botsson[step.id] ?? ""} />
        </div>
      </div>

      {/* ── Bottom navigation ── */}
      <div className={`flex items-center justify-between border-t px-8 py-4 ${"border-border"}`}>
        <button
          onClick={handleBack}
          disabled={isFirst}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            isFirst ? "cursor-not-allowed opacity-30" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          Tilbake
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleNext}
            disabled={isFinishing}
            className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-bold transition-colors ${
              isFinishing
                ? "cursor-not-allowed opacity-50"
                : isLast
                  ? "bg-success hover:bg-success/80 text-white"
                  : "bg-brand-orange hover:bg-brand-orange/90 text-white"
            }`}
          >
            {isFinishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Oppretter...
              </>
            ) : isLast ? (
              "Fullfør og åpne dashboard"
            ) : (
              <>
                Neste
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
