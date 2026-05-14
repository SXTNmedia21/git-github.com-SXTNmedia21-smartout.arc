"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-close-tools.ts — Botsson tools for the /dashboard/close surface.
 *
 * Four tools — 3 read, 1 write:
 *   getCloseStatus      — current close workflow state (step, gates, department, session)
 *   listCloseSteps      — ordered step list with completion status
 *   getBlockers         — outstanding gate conditions that block submission
 *   proposeSubmitClose  — trigger the "Send inn dagsstenging" mutation (requires all gates met)
 *
 * Pattern: dataRef keeps tool definitions stable (useMemo once) while still
 * reading live state on every invocation. Follows use-notifications-tools.ts.
 *
 * Write tool delegates to the submitMutation callback — no direct API call,
 * no gateAction bypass. Server-side RLS + reconciliation validation runs
 * via the existing /api/reconciliation/validate route (see useSubmitReconciliation).
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type CloseStepId = "checklist" | "images" | "review" | "submit";

export type CloseToolInput = {
  /** Currently active workflow step. */
  currentStep: CloseStepId;
  /** Whether the closing checklist has been completed. */
  checklistComplete: boolean;
  /** Whether all required settlement images have been uploaded and accepted. */
  imagesReady: boolean;
  /** Whether all critical deviations are resolved or absent. */
  deviationsHandled: boolean;
  /** Derived gate: all three conditions above are true. */
  allGatesPass: boolean;
  /** Selected department name (display). Null if not yet chosen. */
  departmentName: string | null;
  /** Selected department id. Null if not yet chosen. */
  departmentId: string | null;
  /** Active session id for the selected department. Null if no session found. */
  sessionId: string | null;
  /** Reconciliation id for the current session. Null if not yet created. */
  reconciliationId: string | null;
  /** Whether the submission mutation is currently running. */
  isSubmitting: boolean;
  /** Whether the submission has already succeeded this session. */
  isSubmitted: boolean;
  /** Trigger the submit mutation. No-op if gates are not met or already submitted. */
  onSubmit: () => void;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useCloseTools(input: CloseToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getCloseStatus",
          description:
            "Get the current end-of-day close workflow status — active step, gate conditions, selected department and session. Use when user asks 'hva gjenstår?' or 'er dagsstenging ferdig?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listCloseSteps",
          description:
            "List the four close workflow steps (Sjekkliste, Oppgjørsbilder, Gjennomgang, Send inn) with their completion status. Use when user asks 'hvilke trinn er igjen?' or wants a progress overview.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getBlockers",
          description:
            "Return the outstanding gate conditions blocking submission. Use when user asks 'hva stopper innsending?' or 'hva mangler for å sende inn?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeSubmitClose",
          description:
            "Submit the end-of-day close for the current department. Only call when user explicitly asks to send in (e.g. 'send inn dagsstenging', 'fullfør stenging'). Fails gracefully if gates are not met.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getCloseStatus: () => {
        const d = dataRef.current;
        return JSON.stringify({
          currentStep: d.currentStep,
          departmentId: d.departmentId,
          departmentName: d.departmentName,
          sessionId: d.sessionId,
          reconciliationId: d.reconciliationId,
          gates: {
            checklistComplete: d.checklistComplete,
            imagesReady: d.imagesReady,
            deviationsHandled: d.deviationsHandled,
            allGatesPass: d.allGatesPass,
          },
          isSubmitting: d.isSubmitting,
          isSubmitted: d.isSubmitted,
        });
      },

      listCloseSteps: () => {
        const d = dataRef.current;
        const STEPS: Array<{ id: CloseStepId; label: string; number: number }> = [
          { id: "checklist", label: "Sjekkliste", number: 1 },
          { id: "images", label: "Oppgjørsbilder", number: 2 },
          { id: "review", label: "Gjennomgang", number: 3 },
          { id: "submit", label: "Send inn", number: 4 },
        ];

        const currentIndex = STEPS.findIndex((s) => s.id === d.currentStep);

        const gateByStep: Record<CloseStepId, boolean> = {
          checklist: d.checklistComplete,
          images: d.imagesReady,
          review: d.deviationsHandled,
          submit: d.isSubmitted,
        };

        return JSON.stringify({
          steps: STEPS.map((step, i) => ({
            id: step.id,
            label: step.label,
            number: step.number,
            isCurrent: step.id === d.currentStep,
            isComplete: i < currentIndex || gateByStep[step.id],
          })),
          currentStep: d.currentStep,
          totalSteps: STEPS.length,
        });
      },

      getBlockers: () => {
        const d = dataRef.current;

        if (d.isSubmitted) {
          return JSON.stringify({ blocked: false, reason: "Dagsstenging er allerede innsendt." });
        }

        if (!d.departmentId) {
          return JSON.stringify({
            blocked: true,
            blockers: ["Ingen avdeling valgt. Velg avdeling i nedtrekksmenyen for å fortsette."],
          });
        }

        const blockers: string[] = [];

        if (!d.checklistComplete) {
          blockers.push("Stengesjekkliste er ikke fullført.");
        }
        if (!d.imagesReady) {
          blockers.push("Oppgjørsbilder er ikke lastet opp eller godkjent.");
        }
        if (!d.deviationsHandled) {
          blockers.push("Kritiske avvik er ikke kommentert eller lukket.");
        }

        if (blockers.length === 0) {
          return JSON.stringify({
            blocked: false,
            reason: "Alle betingelser er oppfylt. Klar for innsending.",
          });
        }

        return JSON.stringify({ blocked: true, blockers });
      },

      proposeSubmitClose: () => {
        const d = dataRef.current;

        if (d.isSubmitted) {
          return JSON.stringify({ ok: true, alreadySubmitted: true });
        }

        if (!d.allGatesPass) {
          const blockers: string[] = [];
          if (!d.checklistComplete) blockers.push("Sjekkliste ikke fullført");
          if (!d.imagesReady) blockers.push("Oppgjørsbilder ikke klar");
          if (!d.deviationsHandled) blockers.push("Kritiske avvik ikke håndtert");
          return JSON.stringify({
            ok: false,
            reason: "Kan ikke sende inn — betingelser ikke oppfylt.",
            blockers,
          });
        }

        if (d.isSubmitting) {
          return JSON.stringify({ ok: true, inProgress: true });
        }

        if (!d.reconciliationId) {
          return JSON.stringify({
            ok: false,
            reason: "Ingen aktiv avstemming funnet for valgt avdeling og dato.",
          });
        }

        d.onSubmit();
        return JSON.stringify({
          ok: true,
          submitted: true,
          reconciliationId: d.reconciliationId,
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
