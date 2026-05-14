"use client";

/**
 * people-voice-tools-bridge.tsx
 *
 * Why: Registers people module tools into the Botsson tool registry on mount,
 * unregisters on unmount. Keeps PeoplePageClient free from registration
 * lifecycle code (same pattern as schedule-voice-tools-bridge.tsx).
 *
 * Returns: null — side-effect registration only.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { usePeopleVoiceTools } from "../_hooks/use-people-voice-tools";
import type { Employee, Department } from "./types";

type PeopleVoiceToolsBridgeProps = {
  employees: Employee[];
  departments: Department[];
};

export function PeopleVoiceToolsBridge({ employees, departments }: PeopleVoiceToolsBridgeProps) {
  const tools = usePeopleVoiceTools({ employees, departments });
  useRegisterTools("people", tools);

  return null;
}
