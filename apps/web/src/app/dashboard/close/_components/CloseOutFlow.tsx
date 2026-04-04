"use client";

import { useState, useCallback, useContext } from "react";
import { CheckCircle2, ChevronRight, Loader2, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { ChecklistSection } from "./ChecklistSection";
import { ImageUpload } from "./ImageUpload";
import { GatekeeperStatus } from "./GatekeeperStatus";
import {
  useDepartmentSession,
  useReconciliation,
  useSessionDeviations,
  useSubmitReconciliation,
} from "../_hooks/useCloseOut";

type StepId = "checklist" | "images" | "review" | "submit";

const STEPS: { id: StepId; label: string; number: number }[] = [
  { id: "checklist", label: "Sjekkliste", number: 1 },
  { id: "images", label: "Oppgjørsbilder", number: 2 },
  { id: "review", label: "Gjennomgang", number: 3 },
  { id: "submit", label: "Send inn", number: 4 },
];

export function CloseOutFlow() {
  const dashCtx = useContext(DashboardContext);
  const profileId = dashCtx.profileId ?? "";
  const workspaceId = dashCtx.workspaceData?.workspace_id ?? "";

  const [currentStep, setCurrentStep] = useState<StepId>("checklist");
  const [checklistComplete, setChecklistComplete] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);

  // Fetch departments for the workspace and let the user select which one to close out
  const supabase = createClient();
  const { data: departments } = useQuery({
    queryKey: ["departments", workspaceId],
    queryFn: async (): Promise<Array<{ department_id: string; name: string }>> => {
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspaceId)
        .order("name");
      return (data ?? []) as Array<{ department_id: string; name: string }>;
    },
    enabled: !!workspaceId,
  });
  const [departmentId, setDepartmentId] = useState<string | null>(null);

  const { data: session } = useDepartmentSession(departmentId);
  const { data: reconciliation } = useReconciliation(session?.department_session_id ?? null);
  const { data: deviations } = useSessionDeviations(session?.department_session_id ?? null);
  const submitMutation = useSubmitReconciliation();

  const criticalDeviations = (deviations ?? []).filter(
    (d: Record<string, unknown>) => d.severity === "high" || d.severity === "critical",
  );
  const deviationsHandled =
    criticalDeviations.length === 0 ||
    criticalDeviations.every((d: Record<string, unknown>) => d.status !== "open");

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const canAdvance = (() => {
    switch (currentStep) {
      case "checklist":
        return checklistComplete;
      case "images":
        return imagesReady;
      case "review":
        return true;
      case "submit":
        return false;
      default:
        return false;
    }
  })();

  const allGatesPass = checklistComplete && imagesReady && deviationsHandled;

  function goNext() {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]!.id);
    }
  }

  function goBack() {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]!.id);
    }
  }

  const handleChecklistChange = useCallback((complete: boolean) => {
    setChecklistComplete(complete);
  }, []);

  const handleImagesReady = useCallback((ready: boolean) => {
    setImagesReady(ready);
  }, []);

  async function handleSubmit() {
    if (!reconciliation?.reconciliation_id || !profileId) return;
    await submitMutation.mutateAsync({
      reconciliationId: reconciliation.reconciliation_id,
      profileId,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dagsstenging</h1>
        <p className="text-muted-foreground text-sm">Fullfør alle trinn for å stenge dagen</p>
      </div>

      {/* Department selector — must choose a department before proceeding */}
      {departments && departments.length > 0 && (
        <div className="flex items-center gap-3">
          <label htmlFor="close-dept-select" className="text-sm font-medium whitespace-nowrap">
            Avdeling
          </label>
          <select
            id="close-dept-select"
            value={departmentId ?? ""}
            onChange={(e) => setDepartmentId(e.target.value || null)}
            className="border-input bg-background text-foreground focus:ring-ring rounded-md border px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
          >
            <option value="">Velg avdeling...</option>
            {departments.map((dept) => (
              <option key={dept.department_id} value={dept.department_id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const isActive = step.id === currentStep;
          const isPast = i < stepIndex;
          return (
            <div key={step.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="text-muted-foreground/40 h-3 w-3" />}
              <button
                type="button"
                onClick={() => {
                  if (isPast) setCurrentStep(step.id);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  isActive && "bg-primary text-primary-foreground",
                  isPast && "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20",
                  !isActive && !isPast && "bg-muted text-muted-foreground",
                )}
                disabled={!isPast && !isActive}
              >
                {isPast ? <CheckCircle2 className="h-3 w-3" /> : <span>{step.number}</span>}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="min-h-[300px]">
        {currentStep === "checklist" && <ChecklistSection onComplete={handleChecklistChange} />}

        {currentStep === "images" && reconciliation && (
          <ImageUpload
            reconciliationId={reconciliation.reconciliation_id}
            profileId={profileId}
            onImagesReady={handleImagesReady}
          />
        )}

        {currentStep === "images" && !reconciliation && (
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <p className="text-muted-foreground text-sm">
                Ingen aktiv avstemming funnet for dagens dato.
              </p>
            </CardContent>
          </Card>
        )}

        {currentStep === "review" && (
          <div className="space-y-4">
            <GatekeeperStatus
              checklistComplete={checklistComplete}
              imagesUploaded={imagesReady}
              ocrValidated={imagesReady}
              deviationsHandled={deviationsHandled}
              reconciliationReady={allGatesPass}
            />

            {criticalDeviations.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Avvik som krever handling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {criticalDeviations.map((dev: Record<string, unknown>) => (
                    <div
                      key={dev.deviation_id as string}
                      className="flex items-center gap-2 rounded-lg border p-3"
                    >
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          dev.severity === "critical" ? "bg-destructive" : "bg-amber-500",
                        )}
                      />
                      <span className="text-sm">{dev.title as string}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {currentStep === "submit" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              {submitMutation.isSuccess ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  <div>
                    <h3 className="text-lg font-semibold">Avstemming innsendt</h3>
                    <p className="text-muted-foreground text-sm">
                      Dagsstenging er sendt til godkjenning.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Send className="text-muted-foreground h-10 w-10" />
                  <div>
                    <h3 className="text-lg font-semibold">Klar for innsending</h3>
                    <p className="text-muted-foreground text-sm">
                      Alle betingelser er oppfylt. Send inn for admin-godkjenning.
                    </p>
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={!allGatesPass || submitMutation.isPending || !reconciliation}
                    className="w-full max-w-xs"
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send inn dagsstenging
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={goBack} disabled={stepIndex === 0}>
          Tilbake
        </Button>
        {currentStep !== "submit" && (
          <Button onClick={goNext} disabled={!canAdvance}>
            Neste
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
