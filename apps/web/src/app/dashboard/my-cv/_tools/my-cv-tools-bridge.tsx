"use client";

/**
 * my-cv-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/my-cv surface.
 *
 * Why a bridge:
 *  - Keeps page.tsx clean from voice-tool registration concerns.
 *  - Receives live state from the page via props — no duplicate fetch.
 *  - useRegisterTools handles register/unregister on mount/unmount automatically.
 *
 * Placeholder-aware: when the MY_CV feature flag page is still in "Under utvikling"
 * mode, pass isPlaceholder={true}. Tools will report the surface state honestly
 * to Botsson rather than returning silent empty payloads.
 *
 * ADR-0238: page does not own a domain chat surface. No <DomainChatOwnership>
 * needed — Orb runs in interactive mode.
 * ADR-0151: no write tools. CV / skill authoring is manager/admin-only.
 * Employee reads; no unilateral self-edit via Botsson.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useMyCvTools, type CvCertificationRow, type CvSkillRow } from "./use-my-cv-tools";

type MyCvToolsBridgeProps = {
  isPlaceholder: boolean;
  loading: boolean;
  displayName: string | null;
  positionTitle: string | null;
  profileStatus: string | null;
  skills: CvSkillRow[];
  certifications: CvCertificationRow[];
};

export function MyCvToolsBridge({
  isPlaceholder,
  loading,
  displayName,
  positionTitle,
  profileStatus,
  skills,
  certifications,
}: MyCvToolsBridgeProps) {
  const tools = useMyCvTools({
    isPlaceholder,
    loading,
    displayName,
    positionTitle,
    profileStatus,
    skills,
    certifications,
  });

  useRegisterTools("my-cv", tools);

  return null;
}
