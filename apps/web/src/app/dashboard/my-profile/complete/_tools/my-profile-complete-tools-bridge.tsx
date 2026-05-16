"use client";

/**
 * my-profile-complete-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/my-profile/complete (PII intake) surface.
 *
 * Receives only filled-state booleans from the page — NEVER the actual PII
 * values. The hook enforces the same invariant. ADR-0077.
 *
 * ADR-0078: chat-only channel. Bridge does not declare voice support.
 * ADR-0238: page does not own a domain chat surface — Orb interactive mode.
 * ADR-0151: no write tools; PII submit happens via the form's own RPC.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useMyProfileCompleteTools } from "./use-my-profile-complete-tools";

type MyProfileCompleteToolsBridgeProps = {
  submitted: boolean;
  submitting: boolean;
  personalNumberFilled: boolean;
  addressFilled: boolean;
  postalCodeFilled: boolean;
  cityFilled: boolean;
};

export function MyProfileCompleteToolsBridge({
  submitted,
  submitting,
  personalNumberFilled,
  addressFilled,
  postalCodeFilled,
  cityFilled,
}: MyProfileCompleteToolsBridgeProps) {
  const tools = useMyProfileCompleteTools({
    submitted,
    submitting,
    fields: {
      personalNumberFilled,
      addressFilled,
      postalCodeFilled,
      cityFilled,
    },
  });

  useRegisterTools("my-profile-complete", tools);

  return null;
}
