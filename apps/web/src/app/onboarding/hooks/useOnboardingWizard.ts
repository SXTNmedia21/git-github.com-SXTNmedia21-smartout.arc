"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import type {
  WizardStep,
  WizardContext,
  WorkspaceData,
  VerifiedOrgData,
  CoreDepartment,
  CoreLocation,
} from "../types";
import { EMPTY_WORKSPACE_DATA, STEP_INDEX, stepFromIndex } from "../types";

const SAVE_DEBOUNCE_MS = 500;

export function useOnboardingWizard(): WizardContext {
  const supabase = createClient();

  // Core state
  const [step, setStep] = useState<WizardStep>("init");
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData>(EMPTY_WORKSPACE_DATA);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Org verification state
  const [orgNumberInput, setOrgNumberInput] = useState("");
  const [verifiedOrgData, setVerifiedOrgData] = useState<VerifiedOrgData | null>(null);

  // Activation result
  const [activatedWorkspaceId, setActivatedWorkspaceId] = useState<string | null>(null);
  const [activatedWorkspaceSlug, setActivatedWorkspaceSlug] = useState<string | null>(null);

  // Debounce ref for save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasResumed = useRef(false);

  // -- Check auth state on mount --
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setIsAuthenticated(true);
        setUserId(user.id);
      }
    }
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
      } else {
        setIsAuthenticated(false);
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // -- Resume incomplete session --
  useEffect(() => {
    if (!isAuthenticated || !userId || hasResumed.current) return;
    hasResumed.current = true;

    async function resume() {
      const { data } = await supabase
        .from("onboarding_session")
        .select(
          "id, current_step, scraped_data, confirmed_departments, confirmed_locations, confirmed_branding",
        )
        .eq("user_id", userId!)
        .is("completed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;

      setSessionId(data.id);

      // Restore step from integer
      const restoredStep = stepFromIndex(data.current_step ?? 0);
      // Don't restore to transient steps
      const safeStep =
        restoredStep === "crawling" || restoredStep === "finalizing" ? "init" : restoredStep;
      setStep(safeStep);

      // Restore workspace data from JSONB columns
      if (
        data.scraped_data ||
        data.confirmed_departments ||
        data.confirmed_locations ||
        data.confirmed_branding
      ) {
        const scraped = (data.scraped_data ?? {}) as Record<string, unknown>;
        const depts = data.confirmed_departments as CoreDepartment[] | null;
        const locs = data.confirmed_locations as CoreLocation[] | null;
        const branding = (data.confirmed_branding ?? {}) as Record<string, unknown>;

        setWorkspaceData((prev) => ({
          ...prev,
          name: (scraped.companyName as string) ?? prev.name,
          email: (scraped.email as string) ?? prev.email,
          phone: (scraped.phone as string) ?? prev.phone,
          summary: (scraped.summary as string) ?? prev.summary,
          ...(depts ? { departments: depts } : {}),
          ...(locs ? { locations: locs } : {}),
          brandColor: (branding.brandColor as string) ?? prev.brandColor,
          slogan: (branding.slogan as string) ?? prev.slogan,
          communicationTone: (branding.communicationTone as string) ?? prev.communicationTone,
        }));
      }
    }

    resume();
  }, [isAuthenticated, userId]);

  // -- Save to onboarding_session --
  const save = useCallback(
    async (nextStep: WizardStep) => {
      if (!isAuthenticated || !userId) return;

      const now = new Date().toISOString();
      const payload = {
        user_id: userId,
        current_step: STEP_INDEX[nextStep],
        confirmed_departments: workspaceData.departments as unknown as Json,
        confirmed_locations: workspaceData.locations as unknown as Json,
        confirmed_branding: {
          brandColor: workspaceData.brandColor,
          slogan: workspaceData.slogan,
          communicationTone: workspaceData.communicationTone,
        } as unknown as Json,
        updated_at: now,
      };

      if (sessionId) {
        await supabase.from("onboarding_session").update(payload).eq("id", sessionId);
      } else {
        const { data } = await supabase
          .from("onboarding_session")
          .insert({ ...payload, started_at: now })
          .select("id")
          .single();
        if (data) setSessionId(data.id);
      }
    },
    [isAuthenticated, userId, sessionId, workspaceData, supabase],
  );

  // -- Step navigation with auto-save --
  const goTo = useCallback(
    (nextStep: WizardStep) => {
      setStep(nextStep);
      setError(null);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        save(nextStep);
      }, SAVE_DEBOUNCE_MS);
    },
    [save],
  );

  // -- Update workspace data --
  const updateData = useCallback((partial: Partial<WorkspaceData>) => {
    setWorkspaceData((prev) => ({ ...prev, ...partial }));
  }, []);

  // -- Finalize: call activate-workspace Edge Function --
  const finalize = useCallback(async () => {
    setStep("finalizing");
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("activate-workspace", {
        body: { workspaceData },
      });

      if (invokeError) {
        // supabase.functions.invoke returns a generic message for non-2xx responses.
        // The actual error is in the response context — try to extract it.
        let message = "Failed to activate workspace";
        try {
          const ctx = (invokeError as unknown as { context: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) message = body.error;
          }
        } catch {
          // Fallback to the generic message
          if (invokeError.message) message = invokeError.message;
        }
        throw new Error(message);
      }

      const workspaceId = data?.workspaceId;
      if (!workspaceId) throw new Error("No workspace ID returned");

      setActivatedWorkspaceId(workspaceId);

      // Fetch the workspace slug for redirect
      const { data: ws } = await supabase
        .from("workspace")
        .select("slug")
        .eq("workspace_id", workspaceId)
        .single();

      setActivatedWorkspaceSlug(ws?.slug ?? null);

      // Mark onboarding session as completed
      if (sessionId) {
        await supabase
          .from("onboarding_session")
          .update({
            workspace_id: workspaceId,
            completed_at: new Date().toISOString(),
            current_step: STEP_INDEX["invite"],
          })
          .eq("id", sessionId);
      }

      setStep("invite");
    } catch (err: unknown) {
      console.error("Finalization error:", err);
      setError(
        err instanceof Error ? err.message : "An error occurred while setting up your workspace.",
      );
      setStep("battlefield_review");
    }
  }, [workspaceData, sessionId, supabase]);

  const context = useMemo<WizardContext>(
    () => ({
      step,
      goTo,
      workspaceData,
      updateData,
      sessionId,
      isAuthenticated,
      userId,
      error,
      setError,
      orgNumberInput,
      setOrgNumberInput,
      verifiedOrgData,
      setVerifiedOrgData,
      activatedWorkspaceId,
      activatedWorkspaceSlug,
      finalize,
    }),
    [
      step,
      goTo,
      workspaceData,
      updateData,
      sessionId,
      isAuthenticated,
      userId,
      error,
      orgNumberInput,
      verifiedOrgData,
      activatedWorkspaceId,
      activatedWorkspaceSlug,
      finalize,
    ],
  );

  return context;
}
