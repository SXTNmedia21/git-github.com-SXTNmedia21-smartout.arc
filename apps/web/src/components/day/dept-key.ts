import type { DeptKey } from "./widgets";

/**
 * Name-based heuristic mapping department name → DeptKey. Falls back to
 * "storage" (neutral ocean token) when no match. A proper resolution via
 * a `department` metadata column is follow-up work; this heuristic prevents
 * header + roster lies.
 *
 * Shared by WebDayControl (header/SessionHeader) + RosterTab (per-shift
 * border colour). Matches Norwegian (kjøkken, sal, selskap) + English
 * (kitchen, floor, service, event) conventions.
 */
export function resolveDeptKey(name: string): DeptKey {
  const n = name.toLowerCase();
  if (n.includes("kjøkk") || n.includes("kjokk") || n.includes("kitchen")) return "kitchen";
  if (n.includes("sal") || n.includes("floor") || n.includes("servi")) return "floor";
  if (n.includes("bar")) return "bar";
  if (n.includes("event") || n.includes("selskap")) return "event";
  return "storage";
}
