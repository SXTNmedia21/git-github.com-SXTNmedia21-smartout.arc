"use client";

import { useState } from "react";
import {
  BookOpen,
  Play,
  ClipboardCheck,
  PenTool,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ImageIcon,
  VideoIcon,
} from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useProcedureSteps, type ProcedureStepWithTraining } from "../_hooks/use-procedure-steps";

type Stage = "understand" | "practice" | "test" | "confirm" | "done";

const STAGE_DEFS: { id: Stage; labelKey: string; icon: typeof BookOpen }[] = [
  { id: "understand", labelKey: "hms.learn_flow.understand", icon: BookOpen },
  { id: "practice", labelKey: "hms.learn_flow.practice", icon: Play },
  { id: "test", labelKey: "hms.learn_flow.test", icon: ClipboardCheck },
  { id: "confirm", labelKey: "hms.learn_flow.confirm", icon: PenTool },
  { id: "done", labelKey: "hms.learn_flow.done", icon: CheckCircle2 },
];

type Props = {
  procedureId: string;
  readOnly?: boolean;
};

export function LearnFlow({ procedureId, readOnly = false }: Props) {
  const { t } = useTranslation("dashboard");
  const { data: steps, isLoading } = useProcedureSteps(procedureId);
  const [activeStage, setActiveStage] = useState<Stage>("understand");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!steps || steps.length === 0) {
    return (
      <div className="border-border rounded-xl border-2 border-dashed p-8 text-center">
        <p className="text-muted-foreground text-sm">{t("hms.learn_flow.no_steps")}</p>
      </div>
    );
  }

  const currentStep = steps[currentStepIndex];
  const stageIndex = STAGE_DEFS.findIndex((s) => s.id === activeStage);

  return (
    <div className="space-y-6">
      {/* Stage progress bar */}
      <div className="flex items-center gap-1">
        {STAGE_DEFS.map((stage, i) => {
          const Icon = stage.icon;
          const isActive = stage.id === activeStage;
          const isPast = i < stageIndex;

          return (
            <button
              key={stage.id}
              onClick={() => !readOnly && setActiveStage(stage.id)}
              disabled={readOnly}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary/10 text-primary border-primary/30 border"
                  : isPast
                    ? "bg-green-500/10 text-green-600"
                    : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t(stage.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Stage content */}
      {activeStage === "understand" && currentStep && (
        <StepContent
          step={currentStep}
          stepIndex={currentStepIndex}
          totalSteps={steps.length}
          t={t}
          onPrev={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
          onNext={() => {
            if (currentStepIndex < steps.length - 1) {
              setCurrentStepIndex((i) => i + 1);
            } else {
              setActiveStage("practice");
              setCurrentStepIndex(0);
            }
          }}
        />
      )}

      {activeStage === "practice" && (
        <div className="border-border rounded-xl border p-6 text-center">
          <Play className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          <p className="text-foreground font-semibold">{t("hms.learn_flow.practice_title")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("hms.learn_flow.practice_desc")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setActiveStage("test")}
          >
            {t("hms.learn_flow.go_to_test")} <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {activeStage === "test" && (
        <div className="border-border rounded-xl border p-6 text-center">
          <ClipboardCheck className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          <p className="text-foreground font-semibold">{t("hms.learn_flow.test_title")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("hms.learn_flow.test_desc")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setActiveStage("confirm")}
          >
            {t("hms.learn_flow.go_to_confirm")} <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {activeStage === "confirm" && (
        <div className="border-border rounded-xl border p-6 text-center">
          <PenTool className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
          <p className="text-foreground font-semibold">{t("hms.learn_flow.confirm_title")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("hms.learn_flow.confirm_desc")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setActiveStage("done")}
          >
            {t("hms.learn_flow.mark_done")} <CheckCircle2 className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {activeStage === "done" && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-green-500" />
          <p className="text-foreground font-semibold">{t("hms.learn_flow.done_title")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("hms.learn_flow.done_desc")}</p>
        </div>
      )}
    </div>
  );
}

function StepContent({
  step,
  stepIndex,
  totalSteps,
  t,
  onPrev,
  onNext,
}: {
  step: ProcedureStepWithTraining;
  stepIndex: number;
  totalSteps: number;
  t: (key: string) => string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="border-border rounded-xl border">
      {/* Step header */}
      <div className="border-b border-inherit p-4">
        <div className="mb-1 flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {t("hms.learn_flow.step_of")} {stepIndex + 1}/{totalSteps}
          </Badge>
          {step.isRequired && (
            <Badge variant="secondary" className="text-xs">
              {t("hms.learn_flow.required")}
            </Badge>
          )}
          {step.estimatedMinutes && (
            <span className="text-muted-foreground ml-auto text-xs">
              ~{step.estimatedMinutes} min
            </span>
          )}
        </div>
        <h3 className="text-foreground text-lg font-bold">{step.title}</h3>
      </div>

      {/* Content */}
      <div className="space-y-4 p-4">
        {/* Training content (rich) or fallback to description */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {step.trainingContent ? (
            <div dangerouslySetInnerHTML={{ __html: step.trainingContent }} />
          ) : (
            <p>{step.description}</p>
          )}
        </div>

        {/* Media */}
        {step.mediaUrls && step.mediaUrls.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {step.mediaUrls.map((media, i) => (
              <div
                key={i}
                className="border-border bg-muted/30 flex items-center gap-3 rounded-lg border p-3"
              >
                {media.type === "image" ? (
                  <ImageIcon className="text-muted-foreground h-5 w-5 shrink-0" />
                ) : (
                  <VideoIcon className="text-muted-foreground h-5 w-5 shrink-0" />
                )}
                <span className="text-foreground truncate text-sm">{media.caption}</span>
              </div>
            ))}
          </div>
        )}

        {/* AI placeholder */}
        <Button variant="ghost" size="sm" disabled className="text-muted-foreground">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {t("hms.learn_flow.explain_simpler")}
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-inherit p-4">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={stepIndex === 0}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          {t("hms.learn_flow.previous")}
        </Button>
        <Button size="sm" onClick={onNext}>
          {stepIndex === totalSteps - 1 ? t("hms.learn_flow.next_phase") : t("hms.learn_flow.next")}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
