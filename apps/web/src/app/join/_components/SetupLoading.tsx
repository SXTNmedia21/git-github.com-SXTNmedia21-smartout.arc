"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignupWizard } from "../_hooks/useSignupWizard";
import { completeSignup } from "../_lib/setupActions";
import { buildPostSignupRedirectPath } from "../_lib/onboarding-shell";
import type {
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
  Step5Data,
  Step6Data,
} from "../_lib/validation";

const LOADING_MESSAGES = [
  "Oppretter bedriftsprofil...",
  "Konfigurerer arbeidsområde...",
  "Lagrer åpningstider...",
  "Klargjør dashbordet ditt...",
];

export function SetupLoading() {
  const router = useRouter();
  const { state, goToStep, flushPersist } = useSignupWizard();
  const [messageIndex, setMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  // Rotate loading messages
  useEffect(() => {
    if (error) return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev));
    }, 2000);

    return () => clearInterval(interval);
  }, [error]);

  // Run the setup action once on mount
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    async function runSetup() {
      // Flush any pending debounced state before setup
      flushPersist();

      try {
        const result = await completeSignup({
          step1: state.step1 as Step1Data,
          step2: state.step2 as Step2Data,
          step3: state.step3 as Step3Data,
          step4: state.step4 as Step4Data,
          step5: state.step5 as Step5Data,
          step6: state.step6 as Step6Data,
          intelligence: state.intelligence ?? null,
        });

        // Clear wizard state from localStorage — signup is complete
        try {
          localStorage.removeItem("smartout_signup_wizard");
        } catch {
          // localStorage might be unavailable
        }

        if (result?.workspaceId) {
          router.push(buildPostSignupRedirectPath(result.workspaceId));
        } else {
          router.push("/onboarding");
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Noe gikk galt under oppsettet.";

        console.error("[SetupLoading] Setup failed:", {
          message,
          error: err,
          step1Email: state.step1?.email,
          timestamp: new Date().toISOString(),
        });

        setError(message);
      }
    }

    runSetup();
  }, []); // eslint-disable-line

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/30" />
          <AlertCircle className="absolute inset-0 m-auto h-8 w-8 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-foreground text-xl font-semibold">Noe gikk galt</h2>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">{error}</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              // Go back to last step so user can retry — avoids duplicate creates
              goToStep(6);
            }}
          >
            Gå tilbake
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setError(null);
              hasStarted.current = false;
            }}
          >
            Prøv igjen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-950/30" />
        <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-orange-500" />
      </div>
      <div className="text-center">
        <h2 className="text-foreground text-xl font-semibold">Vi setter opp alt for deg</h2>
        <p className="text-muted-foreground mt-2 text-sm transition-opacity duration-300">
          {LOADING_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  );
}
