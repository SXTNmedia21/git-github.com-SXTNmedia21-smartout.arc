"use client";

import { useState, useCallback, useContext, useMemo } from "react";
import { ChevronLeft, ChevronRight, Rocket } from "lucide-react";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useOnboardingGuide } from "@/app/dashboard/_hooks/use-onboarding-guide";
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
      "Vi har hentet informasjon om bedriften din fra Br\u00f8nn\u00f8ysund, Google og nettsiden din. Se over at det stemmer, og juster det som trengs.",
    helpTip: "Dataene er hentet automatisk. Alt kan endres.",
  },
  {
    id: "document-drop",
    title: "Last opp dokumenter",
    subtitle: "Valgfritt \u2014 vi analyserer",
    explanation:
      "Last opp det dere har \u2014 rutineperm, vaktlister, kontrakter, HMS-plan, personalh\u00e5ndbok, meny, tariffavtale. Vi analyserer og fyller ut resten for dere.",
    helpTip: "Dokumentene analyseres med AI. Du kan hoppe over dette steget.",
  },
  {
    id: "governance",
    title: "Dine retningslinjer",
    subtitle: "Regler og prosedyrer",
    explanation:
      "Retningslinjer er reglene som styrer restauranten din. Mattrygghet, hygiene, brannsikkerhet \u2014 alt som ansatte m\u00e5 kunne. N\u00e5r du legger inn reglene her, vil systemet automatisk s\u00f8rge for at alle ansatte l\u00e6rer dem og blir testet p\u00e5 at de kan dem.",
    helpTip:
      "Retningslinjer er reglene som styrer virksomheten. De blir automatisk til oppl\u00e6ring for ansatte.",
  },
  {
    id: "payroll",
    title: "L\u00f8nn og tillegg",
    subtitle: "Tariff og satser",
    explanation:
      "Sett opp l\u00f8nnssatser og tillegg for virksomheten din. Velg tariffavtale, juster kvelds-, helge- og overtidstillegg, og sett timel\u00f8nn per stilling.",
    helpTip:
      "L\u00f8nnsoppsettet bestemmer satser og tillegg. Det brukes automatisk n\u00e5r du inviterer ansatte og lager vaktplaner.",
  },
  {
    id: "employment",
    title: "Ansettelsesvilk\u00e5r",
    subtitle: "Avtaleformer og betingelser",
    explanation:
      "Definer hvilke ansettelsesformer dere bruker og standardvilk\u00e5rene for hver. Pr\u00f8vetid, ferie, pensjon og arbeidsgiveravgift \u2014 alt samles her.",
    helpTip:
      "Ansettelsesvilk\u00e5r definerer kontraktsmalene. Valget her bestemmer hva som st\u00e5r i arbeidsavtalene.",
  },
  {
    id: "team",
    title: "Ditt team",
    subtitle: "De f\u00f8rste ansatte",
    explanation:
      "Legg til de f\u00f8rste i teamet ditt. De f\u00e5r en invitasjon og starter med \u00e5 lese h\u00e5ndboken og retningslinjene du nettopp la inn.",
    helpTip:
      "Inviter ansatte manuelt eller last opp en CSV-fil. De f\u00e5r tilgang til oppl\u00e6ring og h\u00e5ndbok automatisk.",
  },
  {
    id: "shift-template",
    title: "Dine vaktmaler",
    subtitle: "Grunnlaget for vaktplanen",
    explanation:
      "En vaktmal er en oppskrift for en vakt \u2014 navn, start- og sluttid, og hvilken avdeling den tilh\u00f8rer. Du bygger den ekte vaktplanen etterp\u00e5.",
    helpTip:
      "Vaktmaler er gjenbrukbare oppskrifter for vakter. De gj\u00f8r det raskt \u00e5 bygge ukeplaner.",
  },
  {
    id: "season",
    title: "Din sesong",
    subtitle: "Budsjett og m\u00e5l",
    explanation:
      "Sesongen setter rammene for alt: budsjett, bemanningsm\u00e5l, og KPI-er. N\u00e5r sesongen er aktiv, begynner dashboardet \u00e5 vise ekte tall.",
    helpTip:
      "Sesongen er tidsrammen for budsjett og m\u00e5l. Dashboard viser f\u00f8rst ekte data n\u00e5r en sesong er aktiv.",
  },
  {
    id: "handbook",
    title: "Din personalh\u00e5ndbok",
    subtitle: "Generert fra oppsettet ditt",
    explanation:
      "Personalh\u00e5ndboken er auto-generert fra det du har lagt inn i steg 1\u20137. G\u00e5 gjennom kapitlene, juster teksten der det trengs, og publiser.",
    helpTip:
      "H\u00e5ndboken genereres automatisk fra data du allerede har lagt inn. Du reviewer og redigerer \u2014 ikke skriver.",
  },
];

// ─── Component ───────────────────────────────────────────

export function OnboardingGuide() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? "";
  const { profileId } = useContext(DashboardContext);
  const { package: industryPackage, detectedType, setIndustryType } = useIndustryPackage();

  const {
    currentStep,
    completedSteps,
    isComplete,
    shouldShow,
    markStepComplete,
    setCurrentStep,
    totalSteps,
  } = useOnboardingGuide();

  // ── Parse scraped data from workspace intelligence ──
  const scrapedData = useMemo<ScrapedIntelligence>(() => {
    return {
      companyName: ctx?.workspace.name,
    };
  }, [ctx]);

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
  const step = STEPS[currentStep]!;
  const isLast = currentStep === STEPS.length - 1;

  const handleNext = useCallback(() => {
    const s = STEPS[currentStep];
    if (!s) return;

    emit({
      event: "wizard step_completed",
      workspace_id: workspaceId,
      actor_id: profileId ?? "",
      properties: {
        data: {
          step_id: s.id,
          step_index: currentStep,
        },
      },
    }).catch((e: unknown) => console.error("[onboarding-guide] emit failed:", e));

    const nextStepIndex = currentStep + 1;
    markStepComplete(s.id, Math.min(nextStepIndex, totalSteps - 1));

    if (nextStepIndex >= totalSteps) {
      emit({
        event: "wizard completed",
        workspace_id: workspaceId,
        actor_id: profileId ?? "",
        properties: {
          data: {
            workspace_id: workspaceId,
          },
        },
      }).catch((e: unknown) => console.error("[onboarding-guide] emit failed:", e));
    }
  }, [currentStep, markStepComplete, totalSteps, workspaceId, profileId]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, setCurrentStep]);

  // ── Render ──

  if (!shouldShow || isComplete) return null;

  return (
    <div className="border-border bg-card mx-auto w-full max-w-3xl rounded-2xl border p-6 shadow-sm">
      {/* Progress indicator */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10">
            <Rocket className="h-5 w-5 text-orange-500" />
          </div>
          <h2 className="text-foreground text-lg font-semibold">Onboarding Guide</h2>
        </div>
        <span className="text-muted-foreground text-sm">
          Steg {currentStep + 1} av {totalSteps}
        </span>
      </div>

      {/* Progress bar */}
      <div className="bg-muted mb-6 h-1.5 w-full rounded-full">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-500 ease-out"
          style={{ width: `${(completedSteps.length / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step indicator dots */}
      <div className="mb-6 flex flex-wrap justify-center gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentStep(i)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-2 py-1.5 text-xs font-medium transition-all sm:px-3 ${
              i === currentStep
                ? "bg-orange-500/15 text-orange-400"
                : completedSteps.includes(s.id)
                  ? "text-emerald-400/60"
                  : "text-muted-foreground"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                i === currentStep
                  ? "bg-orange-500 text-white"
                  : completedSteps.includes(s.id)
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {completedSteps.includes(s.id) ? "\u2713" : i}
            </span>
            {i === currentStep && <span className="hidden sm:inline">{s.title}</span>}
          </button>
        ))}
      </div>

      {/* Step header */}
      <div className="mb-6 space-y-3">
        <p className="text-xs font-bold tracking-widest text-orange-500/70 uppercase">
          Steg {currentStep} av {totalSteps - 1} &middot; {step.subtitle}
        </p>
        <div className="flex items-center gap-2">
          <h3 className="text-foreground text-2xl font-black tracking-tight">{step.title}</h3>
          <HelpTip text={step.helpTip} />
        </div>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">{step.explanation}</p>
      </div>

      {/* Step content */}
      <div className="min-h-[200px]">
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

      {/* Navigation */}
      <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            currentStep === 0
              ? "cursor-not-allowed opacity-30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          Tilbake
        </button>
        <button
          onClick={handleNext}
          className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-bold text-white transition-colors ${
            isLast ? "bg-emerald-500 hover:bg-emerald-600" : "bg-orange-500 hover:bg-orange-600"
          }`}
        >
          {isLast ? "Fullf\u00f8r" : "Neste"}
          {!isLast && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
