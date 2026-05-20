"use client";

/**
 * use-my-training-tools.ts — Botsson tools for the /dashboard/my-training surface.
 *
 * Five tools: 4 read, 1 nav.
 *   getMyReadiness       — overall readiness score (% protocols completed)
 *   listMyProtocols      — list all assigned protocols with status + progress
 *   getNextProtocol      — returns the next incomplete protocol (lowest progress %)
 *   listOverdue          — protocols marked expired or assigned > 30 days with 0 progress
 *   getCompletionProgress — detailed breakdown for a specific protocol by name or index
 *   openProtocol         — fires CustomEvent to expand a named protocol card in the UI
 *
 * dataRef pattern keeps definitions stable (useMemo [], []) while reading
 * live state on every invocation — same as use-my-cv-tools.ts.
 *
 * ADR-0151: no write tools — training step completion, test submission, and
 * confirmation signing are user-driven interactions in the UI, not Botsson actions.
 * workspace_id / profile_id are auth-derived from DashboardContext — never body-supplied.
 *
 * ADR-0238: page does not own a domain chat surface.
 * Orb runs in interactive mode — no <DomainChatOwnership> needed.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type TrainingProtocolSummary = {
  assignmentId: string;
  protocolName: string;
  protocolDescription: string | null;
  assignmentStatus: "not_started" | "in_progress" | "completed" | "expired" | "waived";
  assignedAt: string;
  completedAt: string | null;
  progress: {
    totalSteps: number;
    completedSteps: number;
    percent: number;
  };
};

export type MyTrainingToolInput = {
  /** Whether the protocols query is still loading. */
  loading: boolean;
  /** All assigned protocols for the current employee. Empty when none or not loaded. */
  protocols: TrainingProtocolSummary[];
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useMyTrainingTools(input: MyTrainingToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getMyReadiness",
          description:
            "Get the employee's overall training readiness score — how many protocols are completed out of total assigned. Use when the user asks 'hvor klar er jeg?', 'hva er treningsstatusen min?', 'er jeg klar for å jobbe?', or wants a summary of their training completion.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listMyProtocols",
          description:
            "List all assigned training protocols with their status and progress percentage. Use when the user asks 'hvilke protokoller har jeg?', 'vis meg opplaeringen min', 'hva må jeg lære?', or wants an overview of all assigned training.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getNextProtocol",
          description:
            "Get the next incomplete training protocol the employee should work on — the one with the lowest non-zero progress, or the first not-started one. Use when the user asks 'hva bør jeg gjøre nå?', 'hvilken protokoll er neste?', 'hvor skal jeg starte?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listOverdue",
          description:
            "List training protocols that are expired or have been assigned for more than 30 days with 0% progress. Use when the user asks 'har jeg noe forfalt?', 'er det noe jeg har oversett?', 'hva er ikke påbegynt?', or asks about overdue training.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getCompletionProgress",
          description:
            "Get detailed progress breakdown for a specific protocol — steps completed, tests passed, confirmations signed. Use when the user asks 'hvor langt er jeg på [protokoll]?', 'hva gjenstår på [navn]?', or wants details about a specific protocol's progress.",
          dynamicParameters: [
            {
              name: "protocolName",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {},
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openProtocol",
          description:
            "Open and expand a specific training protocol card in the UI so the employee can see its details and continue working on it. Use when the user says 'åpne [protokoll]', 'vis meg [navn]', 'jeg vil jobbe med [protokoll]'.",
          dynamicParameters: [
            {
              name: "protocolName",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {},
              required: true,
            },
          ],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getMyReadiness: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        if (d.protocols.length === 0) {
          return Promise.resolve(
            JSON.stringify({ ok: true, readinessPercent: 0, completed: 0, total: 0 }),
          );
        }
        const completed = d.protocols.filter((p) => p.assignmentStatus === "completed").length;
        const total = d.protocols.length;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            readinessPercent: Math.round((completed / total) * 100),
            completed,
            total,
          }),
        );
      },

      listMyProtocols: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: d.protocols.length,
            protocols: d.protocols.map((p) => ({
              assignmentId: p.assignmentId,
              name: p.protocolName,
              description: p.protocolDescription,
              status: p.assignmentStatus,
              progress: p.progress.percent,
              completedSteps: p.progress.completedSteps,
              totalSteps: p.progress.totalSteps,
              assignedAt: p.assignedAt,
              completedAt: p.completedAt,
            })),
          }),
        );
      },

      getNextProtocol: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const incomplete = d.protocols.filter(
          (p) => p.assignmentStatus !== "completed" && p.assignmentStatus !== "waived",
        );
        if (incomplete.length === 0) {
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              allComplete: true,
              message:
                "Alle tildelte protokoller er fullfort. Bra jobbet — du er klar for tjeneste.",
            }),
          );
        }
        // Prioritise in-progress first (highest % first = closest to done), then not-started
        const inProgress = incomplete.filter((p) => p.progress.percent > 0);
        const notStarted = incomplete.filter((p) => p.progress.percent === 0);
        const candidates =
          inProgress.length > 0
            ? inProgress.sort((a, b) => b.progress.percent - a.progress.percent)
            : notStarted;
        const next = candidates[0];
        if (!next) {
          // Guard: incomplete list was non-empty but candidates resolved empty (defensive)
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              allComplete: true,
              message: "Ingen neste protokoll funnet.",
            }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            allComplete: false,
            next: {
              assignmentId: next.assignmentId,
              name: next.protocolName,
              description: next.protocolDescription,
              status: next.assignmentStatus,
              progress: next.progress.percent,
              completedSteps: next.progress.completedSteps,
              totalSteps: next.progress.totalSteps,
            },
          }),
        );
      },

      listOverdue: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const now = new Date();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const overdue = d.protocols.filter((p) => {
          if (p.assignmentStatus === "expired") return true;
          if (p.assignmentStatus === "completed" || p.assignmentStatus === "waived") return false;
          if (p.progress.percent === 0) {
            const assignedAt = new Date(p.assignedAt);
            return now.getTime() - assignedAt.getTime() > thirtyDaysMs;
          }
          return false;
        });
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: overdue.length,
            overdue: overdue.map((p) => ({
              assignmentId: p.assignmentId,
              name: p.protocolName,
              status: p.assignmentStatus,
              assignedAt: p.assignedAt,
              progress: p.progress.percent,
            })),
          }),
        );
      },

      getCompletionProgress: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const name = String(params.protocolName ?? "")
          .toLowerCase()
          .trim();
        if (!name) {
          return Promise.resolve(
            JSON.stringify({ ok: false, reason: "protocolName parameter is required." }),
          );
        }
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const protocol = d.protocols.find((p) => p.protocolName.toLowerCase().includes(name));
        if (!protocol) {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason: `Fant ingen protokoll med navn som inneholder "${params.protocolName}". Bruk listMyProtocols for å se tilgjengelige navn.`,
            }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            protocol: {
              assignmentId: protocol.assignmentId,
              name: protocol.protocolName,
              description: protocol.protocolDescription,
              status: protocol.assignmentStatus,
              progress: protocol.progress.percent,
              completedSteps: protocol.progress.completedSteps,
              totalSteps: protocol.progress.totalSteps,
              assignedAt: protocol.assignedAt,
              completedAt: protocol.completedAt,
            },
          }),
        );
      },

      openProtocol: (params: Record<string, unknown>) => {
        const name = String(params.protocolName ?? "").trim();
        if (!name) {
          return Promise.resolve(
            JSON.stringify({ ok: false, reason: "protocolName parameter is required." }),
          );
        }
        // Dispatch CustomEvent so ProtocolList can expand the matching card.
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("botsson:open-protocol", { detail: { protocolName: name } }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            action: "open-protocol",
            protocolName: name,
            message: `Åpner protokoll "${name}" i treningsoversikten.`,
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
