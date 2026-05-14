"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-my-cv-tools.ts — Botsson tools for the /dashboard/my-cv surface.
 *
 * Four tools: 3 read, 1 status.
 *   getMyCvStatus        — reports surface state (placeholder vs populated)
 *   getMyCvProfile       — returns employee's display name, position, status
 *   getMyCvSkills        — returns employee's registered skills list
 *   getMyCvCertifications — returns employee's certifications / training completions
 *
 * Why placeholder-aware:
 *   /dashboard/my-cv is gated behind MY_CV feature flag and currently renders
 *   a "Under utvikling" placeholder. Tools report the surface state honestly so
 *   Botsson can tell the user "denne siden er under utvikling" rather than
 *   returning empty data silently.
 *
 *   When MY_CV ships real data, replace `isPlaceholder` with real query hooks
 *   and pass populated input to this hook. Tool signatures and descriptions are
 *   already written for the full surface — no rename needed.
 *
 * dataRef pattern keeps definitions stable while reading live state on every
 * invocation (same as use-my-contract-tools.ts and use-notifications-tools.ts).
 *
 * ADR-0151: no write tools — CV / skill data is authored by managers / admins.
 * Employee reads their own data; no unilateral self-edit via Botsson.
 * ADR-0238: page does not own a domain chat surface.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type CvSkillRow = {
  id: string;
  skill_name: string;
  category: string | null;
  level: string | null;
  verified: boolean;
};

export type CvCertificationRow = {
  id: string;
  title: string;
  issued_by: string | null;
  issued_at: string | null;
  expires_at: string | null;
};

export type MyCvToolInput = {
  /** True when the surface is in placeholder ("Under utvikling") mode. */
  isPlaceholder: boolean;
  /** Whether the page is still loading data. Ignored when isPlaceholder is true. */
  loading: boolean;
  /** Employee's display name. Null when not loaded. */
  displayName: string | null;
  /** Employee's current position title. Null when not set. */
  positionTitle: string | null;
  /** Employee's profile status (active, trainee, inactive, offboarding). */
  profileStatus: string | null;
  /** Registered skills for this employee. Empty array when none or not loaded. */
  skills: CvSkillRow[];
  /** Certifications / training completions for this employee. Empty when none. */
  certifications: CvCertificationRow[];
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useMyCvTools(input: MyCvToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getMyCvStatus",
          description:
            "Get the current state of the employee's CV surface — whether it is live, under development, or loading. Call first before any other my-cv tool to determine if data is available. Use when user asks 'hva er min CV?', 'fungerer CV-siden?', or navigates to /dashboard/my-cv.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getMyCvProfile",
          description:
            "Get the employee's basic CV profile — display name, position title, and employment status. Use when user asks 'hvem er jeg i systemet?', 'hva er stillingstittel min?', or wants a summary of their professional identity in Smartout.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getMyCvSkills",
          description:
            "List the employee's registered skills with category, level, and verification status. Use when user asks 'hvilke ferdigheter har jeg registrert?', 'hva kan jeg?', or 'er ferdighetene mine oppdatert?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getMyCvCertifications",
          description:
            "List the employee's certifications and completed training. Use when user asks 'hvilke kurs har jeg tatt?', 'hvilke sertifikater har jeg?', or 'er noen av sertifikatene mine utløpt?'.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getMyCvStatus: () => {
        const d = dataRef.current;
        if (d.isPlaceholder) {
          return JSON.stringify({
            ok: true,
            status: "placeholder",
            message:
              "CV-siden er under utvikling. Kompetanse- og CV-data er ikke tilgjengelig ennå.",
          });
        }
        if (d.loading) {
          return JSON.stringify({ ok: true, status: "loading" });
        }
        return JSON.stringify({
          ok: true,
          status: "ready",
          skillCount: d.skills.length,
          certificationCount: d.certifications.length,
          hasProfile: !!d.displayName,
        });
      },

      getMyCvProfile: () => {
        const d = dataRef.current;
        if (d.isPlaceholder) {
          return JSON.stringify({
            ok: false,
            reason: "CV-siden er under utvikling. Profildata ikke tilgjengelig ennå.",
          });
        }
        if (d.loading) {
          return JSON.stringify({ ok: false, reason: "Profile data is still loading." });
        }
        return JSON.stringify({
          ok: true,
          profile: {
            displayName: d.displayName,
            positionTitle: d.positionTitle,
            profileStatus: d.profileStatus,
          },
        });
      },

      getMyCvSkills: () => {
        const d = dataRef.current;
        if (d.isPlaceholder) {
          return JSON.stringify({
            ok: false,
            reason: "CV-siden er under utvikling. Ferdighetsdata ikke tilgjengelig ennå.",
          });
        }
        if (d.loading) {
          return JSON.stringify({ ok: false, reason: "Skills data is still loading." });
        }
        if (d.skills.length === 0) {
          return JSON.stringify({ ok: true, count: 0, skills: [] });
        }
        return JSON.stringify({
          ok: true,
          count: d.skills.length,
          skills: d.skills.map((s) => ({
            id: s.id,
            name: s.skill_name,
            category: s.category,
            level: s.level,
            verified: s.verified,
          })),
        });
      },

      getMyCvCertifications: () => {
        const d = dataRef.current;
        if (d.isPlaceholder) {
          return JSON.stringify({
            ok: false,
            reason: "CV-siden er under utvikling. Sertifikat- og kursdata ikke tilgjengelig ennå.",
          });
        }
        if (d.loading) {
          return JSON.stringify({ ok: false, reason: "Certification data is still loading." });
        }
        if (d.certifications.length === 0) {
          return JSON.stringify({ ok: true, count: 0, certifications: [] });
        }
        const now = new Date().toISOString();
        return JSON.stringify({
          ok: true,
          count: d.certifications.length,
          certifications: d.certifications.map((c) => ({
            id: c.id,
            title: c.title,
            issuedBy: c.issued_by,
            issuedAt: c.issued_at,
            expiresAt: c.expires_at,
            isExpired: c.expires_at ? c.expires_at < now : false,
          })),
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
